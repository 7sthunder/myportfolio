// Offline portrait preprocessing for the particle portrait.
//
//   1. MODNet portrait matting  -> soft alpha matte of the subject (hair-aware)
//   2. Depth Anything V2 (small) -> relative depth for real 3D relief
//   3. Matte cleanup, subject crop, depth normalisation inside the subject
//   4. Packs everything into ONE opaque PNG consumed at runtime by the Canvas sampler:
//        R = local-contrast luminance (feature detail)
//        G = depth (0 = far, 255 = near), only meaningful where B > 0
//        B = subject matte (0 = background, 255 = subject)
//      An opaque PNG is used on purpose: canvas premultiplication would destroy RGB
//      values in transparent pixels if the matte lived in the alpha channel.
//
// Usage: node tools/prepare-portrait.mjs [--refresh] [--src path/to/photo.jpg]
// Model outputs are cached in reference/debug so post-processing can be re-run quickly.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SRC = resolve(option('--src', join(root, 'reference', 'portrait-original.jpeg')));
const OUT_DIR = join(root, 'public', 'portrait');
const DEBUG_DIR = join(root, 'reference', 'debug');
const MAP_HEIGHT = Number(option('--height', 640));

// Regions (in source pixels) that must never be part of the subject, e.g. objects touching
// the silhouette that the matting model may merge into it. Circles: [cx, cy, r].
const EXCLUDE_CIRCLES = [
  [690, 446, 58], // scooter mirror, bottom right (kept clear of the arm edge at x~617)
  [4, 425, 48], // scooter mirror, bottom left
];

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(DEBUG_DIR, { recursive: true });

const RAW_MATTE = join(DEBUG_DIR, 'raw-matte.png');
const RAW_DEPTH = join(DEBUG_DIR, 'raw-depth.f32'); // Float32, W*H, bilinear-resized to the source size
const RAW_DEPTH_PREVIEW = join(DEBUG_DIR, 'raw-depth.png');

const { width: W, height: H } = await sharp(SRC).metadata();
console.log(`Source: ${SRC} (${W}x${H})`);

// ---------------------------------------------------------------------------------------
// 1 + 2. Run (or load cached) model outputs
// ---------------------------------------------------------------------------------------
if (flag('--refresh') || !existsSync(RAW_MATTE) || !existsSync(RAW_DEPTH)) {
  const { AutoModel, AutoProcessor, RawImage, pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = join(root, 'tools', '.model-cache');
  const image = await RawImage.read(SRC);

  console.log('Running MODNet portrait matting...');
  const matting = await AutoModel.from_pretrained('Xenova/modnet', { dtype: 'fp32' });
  const processor = await AutoProcessor.from_pretrained('Xenova/modnet');
  const { pixel_values } = await processor(image);
  const { output } = await matting({ input: pixel_values });
  const matteSmall = await RawImage.fromTensor(output[0].mul(255).to('uint8'));
  const matteImg = await matteSmall.resize(W, H);
  await sharp(Buffer.from(matteImg.data), { raw: { width: W, height: H, channels: 1 } }).png().toFile(RAW_MATTE);

  console.log('Running Depth Anything V2 (small)...');
  const estimator = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { dtype: 'fp32' });
  const result = await estimator(image);
  const out = Array.isArray(result) ? result[0] : result;
  const pd = out.predicted_depth; // raw relative inverse depth (larger = nearer)
  const [dh, dw] = pd.dims.slice(-2);
  const src = pd.data;
  let min = Infinity;
  let max = -Infinity;
  for (const v of src) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  // Bilinear resize to the source resolution, kept as float for full precision.
  const full = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(dh - 1, Math.max(0, ((y + 0.5) / H) * dh - 0.5));
    const y0i = Math.floor(fy);
    const y1i = Math.min(dh - 1, y0i + 1);
    const ty = fy - y0i;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(dw - 1, Math.max(0, ((x + 0.5) / W) * dw - 0.5));
      const x0i = Math.floor(fx);
      const x1i = Math.min(dw - 1, x0i + 1);
      const tx = fx - x0i;
      const a = src[y0i * dw + x0i] * (1 - tx) + src[y0i * dw + x1i] * tx;
      const b = src[y1i * dw + x0i] * (1 - tx) + src[y1i * dw + x1i] * tx;
      full[y * W + x] = ((a * (1 - ty) + b * ty) - min) / (max - min);
    }
  }
  writeFileSync(RAW_DEPTH, Buffer.from(full.buffer));
  const preview = Buffer.alloc(W * H);
  for (let i = 0; i < preview.length; i++) preview[i] = Math.round(full[i] * 255);
  await sharp(preview, { raw: { width: W, height: H, channels: 1 } }).png().toFile(RAW_DEPTH_PREVIEW);
} else {
  console.log('Using cached model outputs (pass --refresh to recompute).');
}

// ---------------------------------------------------------------------------------------
// 3. Post-processing
// ---------------------------------------------------------------------------------------
const readGrey = async (file) => {
  const { data, info } = await sharp(file)
    .resize(W, H, { kernel: 'cubic', fit: 'fill' })
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const f = new Float32Array(info.width * info.height);
  for (let i = 0; i < f.length; i++) f[i] = data[i] / 255;
  return f;
};

const matteRaw = await readGrey(RAW_MATTE);
const depthBytes = readFileSync(RAW_DEPTH);
const depthRaw = new Float32Array(depthBytes.buffer, depthBytes.byteOffset, W * H);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Exclusion zones.
for (const [cx, cy, r] of EXCLUDE_CIRCLES) {
  for (let y = Math.max(0, cy - r - 8); y < Math.min(H, cy + r + 8); y++) {
    for (let x = Math.max(0, cx - r - 8); x < Math.min(W, cx + r + 8); x++) {
      const d = Math.hypot(x - cx, y - cy);
      matteRaw[y * W + x] *= smoothstep(r, r + 8, d);
    }
  }
}

// Keep only the largest connected component (removes stray blobs from the busy background).
const binary = new Uint8Array(W * H);
for (let i = 0; i < binary.length; i++) binary[i] = matteRaw[i] > 0.5 ? 1 : 0;
const labels = new Int32Array(W * H);
let best = 0;
let bestSize = 0;
let next = 1;
const stack = new Int32Array(W * H);
for (let i = 0; i < binary.length; i++) {
  if (!binary[i] || labels[i]) continue;
  let sp = 0;
  let size = 0;
  stack[sp++] = i;
  labels[i] = next;
  while (sp) {
    const p = stack[--sp];
    size++;
    const x = p % W;
    const y = (p / W) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
    for (const q of nb) {
      if (q >= 0 && binary[q] && !labels[q]) {
        labels[q] = next;
        stack[sp++] = q;
      }
    }
  }
  if (size > bestSize) {
    bestSize = size;
    best = next;
  }
  next++;
}

// Soft keep-mask: largest component, dilated so hair strands / soft edges survive.
const keep = new Float32Array(W * H);
const DILATE = 10;
{
  // Distance to the kept component via two-pass chamfer transform.
  const INF = 1e9;
  const dist = new Float32Array(W * H);
  for (let i = 0; i < dist.length; i++) dist[i] = labels[i] === best ? 0 : INF;
  const D1 = 1;
  const D2 = Math.SQRT2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + D1);
      if (y > 0) {
        v = Math.min(v, dist[i - W] + D1);
        if (x > 0) v = Math.min(v, dist[i - W - 1] + D2);
        if (x < W - 1) v = Math.min(v, dist[i - W + 1] + D2);
      }
      dist[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = dist[i];
      if (x < W - 1) v = Math.min(v, dist[i + 1] + D1);
      if (y < H - 1) {
        v = Math.min(v, dist[i + W] + D1);
        if (x < W - 1) v = Math.min(v, dist[i + W + 1] + D2);
        if (x > 0) v = Math.min(v, dist[i + W - 1] + D2);
      }
      dist[i] = v;
    }
  }
  for (let i = 0; i < keep.length; i++) keep[i] = 1 - smoothstep(DILATE * 0.5, DILATE, dist[i]);
}

const matte = new Float32Array(W * H);
for (let i = 0; i < matte.length; i++) matte[i] = smoothstep(0.04, 0.96, matteRaw[i] * keep[i]);

// Subject bounds.
let x0 = W;
let y0 = H;
let x1 = 0;
let y1 = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (matte[y * W + x] > 0.3) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
}
const subjectH = y1 - y0;
const margin = Math.round(subjectH * 0.04);
const crop = {
  left: Math.max(0, x0 - margin),
  top: Math.max(0, y0 - margin),
};
crop.width = Math.min(W, x1 + margin) - crop.left;
crop.height = Math.min(H, y1 + 1) - crop.top; // subject is cut by the bottom of the photo
console.log('Subject bounds', { x0, y0, x1, y1 }, 'crop', crop);

// Depth: normalise using percentiles of the subject only, then lightly smooth.
const subjectDepths = [];
for (let i = 0; i < matte.length; i++) if (matte[i] > 0.6) subjectDepths.push(depthRaw[i]);
subjectDepths.sort((a, b) => a - b);
const pct = (p) => subjectDepths[Math.min(subjectDepths.length - 1, Math.floor(p * subjectDepths.length))];
const dLo = pct(0.01);
const dHi = pct(0.995);
const depthN = new Uint8Array(W * H);
for (let i = 0; i < depthN.length; i++) {
  const v = Math.min(1, Math.max(0, (depthRaw[i] - dLo) / (dHi - dLo)));
  depthN[i] = matte[i] > 0.01 ? Math.round(v * 255) : 0;
}

// Head geometry (used by the runtime layout to centre the head like the reference).
// Head rows = top 42% of the subject. Use the matte's horizontal centroid there.
const headRows = Math.round(subjectH * 0.42);
let sx = 0;
let sw = 0;
for (let y = y0; y < y0 + headRows; y++) {
  for (let x = x0; x <= x1; x++) {
    const m = matte[y * W + x];
    if (m > 0.5) {
      sx += x * m;
      sw += m;
    }
  }
}
const headCenterX = sx / sw;

// Neck (narrowest row between the head and the shoulders) for layout + debugging.
let neckY = y0;
let neckWidth = Infinity;
for (let y = y0 + Math.round(subjectH * 0.45); y < y0 + Math.round(subjectH * 0.8); y++) {
  let count = 0;
  for (let x = x0; x <= x1; x++) if (matte[y * W + x] > 0.5) count++;
  if (count < neckWidth) {
    neckWidth = count;
    neckY = y;
  }
}

// ---------------------------------------------------------------------------------------
// 4. Pack + write
// ---------------------------------------------------------------------------------------
const lumaBuf = await sharp(SRC)
  .grayscale()
  .clahe({ width: 48, height: 48, maxSlope: 3 })
  .raw()
  .toBuffer();

const packed = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  // Luminance is only needed inside the subject; zeroing the rest keeps the PNG small.
  packed[i * 3] = matte[i] > 0.004 ? lumaBuf[i] : 0;
  packed[i * 3 + 1] = depthN[i];
  packed[i * 3 + 2] = Math.round(matte[i] * 255);
}

const outW = Math.round((crop.width / crop.height) * MAP_HEIGHT);
const mapFile = join(OUT_DIR, 'portrait-map.png');
await sharp(packed, { raw: { width: W, height: H, channels: 3 } })
  .extract(crop)
  .resize(outW, MAP_HEIGHT, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(mapFile);

const toMapX = (x) => (x - crop.left) / crop.width;
const toMapY = (y) => (y - crop.top) / crop.height;
const meta = {
  version: 1,
  channels: { r: 'luminance (local contrast)', g: 'depth, 255 = nearest', b: 'subject matte' },
  map: { width: outW, height: MAP_HEIGHT },
  source: { width: W, height: H, crop },
  // All anchors are normalised to the map (0..1, origin top-left).
  anchors: {
    headCenterX: toMapX(headCenterX),
    headTop: toMapY(y0),
    neckY: toMapY(neckY),
    subjectLeft: toMapX(x0),
    subjectRight: toMapX(x1),
    bottom: 1,
  },
};
writeFileSync(join(OUT_DIR, 'portrait-map.json'), JSON.stringify(meta, null, 2));

// Debug previews.
await sharp(packed, { raw: { width: W, height: H, channels: 3 } }).extract(crop).extractChannel(2).png().toFile(join(DEBUG_DIR, 'matte-clean.png'));
await sharp(packed, { raw: { width: W, height: H, channels: 3 } }).extract(crop).extractChannel(1).png().toFile(join(DEBUG_DIR, 'depth-subject.png'));
{
  const rgb = await sharp(SRC).removeAlpha().raw().toBuffer();
  const cut = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const a = matte[i];
    for (let c = 0; c < 3; c++) cut[i * 3 + c] = Math.round(rgb[i * 3 + c] * a + 24 * (1 - a));
  }
  await sharp(cut, { raw: { width: W, height: H, channels: 3 } }).png().toFile(join(DEBUG_DIR, 'cutout-preview.png'));
}

console.log(`Wrote ${mapFile} (${outW}x${MAP_HEIGHT})`);
console.log(JSON.stringify(meta.anchors, null, 2));
