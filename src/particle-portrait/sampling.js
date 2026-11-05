import { clamp, createRandom, smoothstep } from './utils.js';

/** The portrait map spans this many local units vertically (x is scaled by the map aspect). */
export const LOCAL_HEIGHT = 2;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const DEFAULT_SAMPLING = {
  seed: 20261105,
  depth: 0.46, // z range of the relief in local units
  inflate: 0.16, // rounds the silhouette like a real volume
  thickness: 0.018, // organic jitter around the surface
  rimWidth: 0.013, // fraction of map height
  sphereRadius: 0.86,
  bands: 4, // horizontal slices in the globe morph (max 8): two for the head, two for the shoulders
  hairFuzz: 0.16, // fraction of hair-edge particles pushed outward into wisps
};

/** Reads pixels from a decoded image source with the Canvas API. */
export function readImagePixels(source, width, height) {
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

/**
 * Decodes the packed map without colour management: its channels are data, not colours.
 * Works on the main thread and inside workers.
 */
export async function decodePortraitMap(blob) {
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const map = readImagePixels(bitmap, bitmap.width, bitmap.height);
  bitmap.close?.();
  return map;
}

/**
 * Loads the packed portrait map (R = luminance, G = depth, B = matte) and returns raw pixels.
 */
export async function loadPortraitMap(url) {
  if (typeof createImageBitmap !== 'undefined') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Portrait map failed to load: ${response.status} ${url}`);
    return decodePortraitMap(await response.blob());
  }
  const img = new Image();
  img.decoding = 'async';
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  return readImagePixels(img, img.naturalWidth, img.naturalHeight);
}

/** Local y of the top of the hair, derived from the map metadata (no sampling needed). */
export const headTopLocal = (meta) => (0.5 - (meta?.anchors?.headTop ?? 0.04)) * LOCAL_HEIGHT;

/** Chamfer distance, in pixels, from inside pixels (m >= threshold) to the outside. */
function insideDistance(m, w, h, threshold) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = m[i] >= threshold ? INF : 0;
  const a = 1;
  const b = 1.4142;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + a);
      if (y > 0) {
        v = Math.min(v, d[i - w] + a);
        if (x > 0) v = Math.min(v, d[i - w - 1] + b);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + b);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + a);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + a);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + b);
        if (x > 0) v = Math.min(v, d[i + w - 1] + b);
      }
      d[i] = v;
    }
  }
  return d;
}

/** Sobel gradient. Returns { mag, gx, gy }. */
function sobel(src, w, h) {
  const mag = new Float32Array(w * h);
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = src[i - w - 1];
      const t = src[i - w];
      const tr = src[i - w + 1];
      const l = src[i - 1];
      const r = src[i + 1];
      const bl = src[i + w - 1];
      const bm = src[i + w];
      const br = src[i + w + 1];
      const sx = tr + 2 * r + br - (tl + 2 * l + bl);
      const sy = bl + 2 * bm + br - (tl + 2 * t + tr);
      gx[i] = sx;
      gy[i] = sy;
      mag[i] = Math.hypot(sx, sy);
    }
  }
  return { mag, gx, gy };
}

/** Separable box blur (radius r), used to soften edge maps so particles trace bands, not 1px lines. */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc * norm;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Histogram-based percentile of `values` where mask > 0.5 (O(N), no sorting). */
function percentile(values, mask, p) {
  let max = 0;
  let n = 0;
  for (let i = 0; i < values.length; i++) {
    if (mask[i] > 0.5) {
      n++;
      if (values[i] > max) max = values[i];
    }
  }
  if (!n || max <= 0) return 1;
  const BINS = 2048;
  const hist = new Uint32Array(BINS);
  const scale = (BINS - 1) / max;
  for (let i = 0; i < values.length; i++) if (mask[i] > 0.5) hist[(values[i] * scale) | 0]++;
  const target = p * n;
  let acc = 0;
  for (let b = 0; b < BINS; b++) {
    acc += hist[b];
    if (acc >= target) return (b + 0.5) / scale || 1;
  }
  return max;
}

/**
 * Turns the portrait map into particle attributes in one call.
 * @see createPortraitSampler for the two-step version (analyse once, sample any count).
 */
export function samplePortrait(map, meta, options = {}) {
  return createPortraitSampler(map, meta, options).sample(options.count ?? 80000);
}

/**
 * Analyses the portrait map once (feature maps + cumulative density) and returns a sampler.
 *
 * Local space: x right, y up, z towards the viewer. The map spans LOCAL_HEIGHT units vertically,
 * x = 0 is the centre of the head, y = 0 is the vertical centre of the map.
 *
 * @returns {{ areaLocal: number, sample: (count: number) => object }}
 */
export function createPortraitSampler(map, meta, options = {}) {
  const { seed, depth, inflate, thickness, rimWidth, sphereRadius, hairFuzz, ...rest } = {
    ...DEFAULT_SAMPLING,
    ...options,
  };
  const bands = clamp(Math.round(rest.bands), 1, 8); // the shader holds up to 8 slice centres
  const { width: W, height: H, data } = map;
  const N = W * H;
  const L = new Float32Array(N);
  const D = new Float32Array(N);
  const M = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    L[i] = data[j] / 255;
    D[i] = data[j + 1] / 255;
    M[i] = data[j + 2] / 255;
  }

  const anchors = meta?.anchors ?? { headCenterX: 0.5, headTop: 0.04, neckY: 0.5 };
  const unit = LOCAL_HEIGHT / H; // local units per map pixel
  const cx = anchors.headCenterX * W;

  // --- Feature maps ----------------------------------------------------------------------
  const dist = insideDistance(M, W, H, 0.5);
  let maxDist = 0;
  for (let i = 0; i < N; i++) if (dist[i] < 1e8 && dist[i] > maxDist) maxDist = dist[i];
  const rimPx = rimWidth * H;

  const gL = sobel(boxBlur(L, W, H, 1), W, H);
  const gD = sobel(boxBlur(D, W, H, 2), W, H);
  const gM = sobel(boxBlur(M, W, H, 2), W, H);
  const lumaEdge = boxBlur(gL.mag, W, H, 1);
  const depthEdge = boxBlur(gD.mag, W, H, 2);
  const lNorm = 1 / percentile(lumaEdge, M, 0.97);
  const dNorm = 1 / percentile(depthEdge, M, 0.97);

  const rim = new Float32Array(N);
  const feature = new Float32Array(N);
  const weight = new Float64Array(N);
  let total = 0;
  let coverage = 0;
  for (let i = 0; i < N; i++) {
    const m = M[i];
    if (m < 0.02) {
      weight[i] = total;
      continue;
    }
    const dpx = m >= 0.5 ? dist[i] : 0;
    rim[i] = Math.exp(-dpx / rimPx);
    const fl = clamp(lumaEdge[i] * lNorm) ** 1.6;
    const fd = clamp(depthEdge[i] * dNorm) ** 1.3;
    feature[i] = clamp(fl * 0.55 + fd * 0.75);
    // Density: even fill (as in the reference), a crisp silhouette (sharpened matte) and a
    // denser band of particles right on the contour.
    const fill = smoothstep(0.22, 0.7, m);
    coverage += fill;
    total += fill * (1 + 1.1 * rim[i] + 0.4 * feature[i]);
    weight[i] = total; // cumulative distribution
  }

  const headTopY = anchors.headTop * H;
  const neckY = anchors.neckY * H;
  const hairLimitY = headTopY + (neckY - headTopY) * 0.5;
  const yTop = (H * 0.5 - headTopY) * unit;
  const yBottom = -LOCAL_HEIGHT * 0.5;
  const bandHeight = (yTop - yBottom) / bands;

  const pick = (r) => {
    let lo = 0;
    let hi = N - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (weight[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  function sample(count) {
    const rand = createRandom(seed);
    const positions = new Float32Array(count * 3);
    const sphere = new Float32Array(count * 4);
    const scatter = new Float32Array(count * 3);
    const random = new Float32Array(count * 4);
    const shade = new Float32Array(count * 4);

    let minX = Infinity;
    let maxX = -Infinity;
    for (let p = 0; p < count; p++) {
      const idx = pick(rand() * total);
      let px = (idx % W) + rand();
      let py = Math.floor(idx / W) + rand();
      const m = M[idx];
      const r = rim[idx];

      // Hair wisps: push a few edge particles outward along the matte normal.
      let wisp = 0;
      if (py < hairLimitY && r > 0.5 && rand() < hairFuzz) {
        const gx = gM.gx[idx];
        const gy = gM.gy[idx];
        const len = Math.hypot(gx, gy);
        if (len > 1e-4) {
          wisp = rand() ** 2.2;
          const reach = wisp * 0.022 * H;
          px -= (gx / len) * reach; // the gradient points inward (matte increases inside)
          py -= (gy / len) * reach;
        }
      }

      const d = D[idx];
      const inside = dist[idx] < 1e8 ? dist[idx] : 0;
      const bulge = Math.sqrt(clamp(inside / (maxDist * 0.55)));
      const x = (px - cx) * unit;
      const y = (H * 0.5 - py) * unit;
      const z =
        (d - 0.5) * depth + bulge * inflate - wisp * 0.05 + rand.gaussian() * thickness * (1 + 2.5 * (1 - m) + 1.5 * wisp);

      positions[p * 3] = x;
      positions[p * 3 + 1] = y;
      positions[p * 3 + 2] = z;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;

      random[p * 4] = rand(); // size
      random[p * 4 + 1] = rand(); // brightness
      random[p * 4 + 2] = rand(); // phase
      random[p * 4 + 3] = rand(); // stagger

      shade[p * 4] = clamp(r + wisp * 0.6);
      shade[p * 4 + 1] = feature[idx];
      shade[p * 4 + 2] = wisp > 0 ? m * (1 - wisp * 0.5) : m;
      shade[p * 4 + 3] = d;

      // Intro scatter, normalised to [-1, 1]^3 (mapped to the viewport volume in the shader).
      const lens = rand() < 0.0012;
      scatter[p * 3] = clamp((rand() * 2 - 1) * 0.72 + rand.gaussian() * 0.22, -1.2, 1.2);
      scatter[p * 3 + 1] = clamp((rand() * 2 - 1) * 0.72 + rand.gaussian() * 0.22, -1.2, 1.2);
      scatter[p * 3 + 2] = lens ? 0.3 + rand() * 0.55 : rand.gaussian() * 0.1 - 0.05;
    }

    // --- Globe targets: Fibonacci lattice matched by height rank ---------------------------
    // Particles keep their vertical order (hair -> top of the globe, shoulders -> bottom), so
    // the morph reads as horizontal slices spinning into latitude rings.
    // Bucket sort by height (O(N)); order within a bucket is irrelevant at this resolution.
    const BUCKETS = 4096;
    const yMax = LOCAL_HEIGHT * 0.5 + 0.1;
    const bucketOf = (y) => Math.min(BUCKETS - 1, Math.max(0, ((yMax - y) / (2 * yMax)) * BUCKETS) | 0);
    const starts = new Uint32Array(BUCKETS + 1);
    for (let i = 0; i < count; i++) starts[bucketOf(positions[i * 3 + 1]) + 1]++;
    for (let b = 0; b < BUCKETS; b++) starts[b + 1] += starts[b];
    const order = new Uint32Array(count);
    for (let i = 0; i < count; i++) order[starts[bucketOf(positions[i * 3 + 1])]++] = i;

    const bandSum = new Float64Array(bands);
    const bandCount = new Uint32Array(bands);
    for (let k = 0; k < count; k++) {
      const i = order[k];
      const sy = 1 - (2 * (k + 0.5)) / count;
      const ring = Math.sqrt(Math.max(0, 1 - sy * sy));
      const theta = k * GOLDEN_ANGLE + rand() * 0.02;
      const radius = sphereRadius * (1 + rand.gaussian() * 0.008);
      const band = clamp(Math.floor((yTop - positions[i * 3 + 1]) / bandHeight), 0, bands - 1);
      sphere[i * 4] = Math.cos(theta) * ring * radius;
      sphere[i * 4 + 1] = sy * radius;
      sphere[i * 4 + 2] = Math.sin(theta) * ring * radius;
      sphere[i * 4 + 3] = band;
      bandSum[band] += sy * radius;
      bandCount[band]++;
    }
    // Mean globe latitude of each slice: slices travel there as compact discs mid-morph.
    const sphereCenters = Array.from(bandSum, (sum, b) => (bandCount[b] ? sum / bandCount[b] : 0));

    return {
      count,
      positions,
      sphere,
      scatter,
      random,
      shade,
      bounds: { top: yTop, bottom: yBottom, left: minX, right: maxX },
      bands: { count: bands, top: yTop, height: bandHeight, sphereCenters },
      sphereRadius,
    };
  }

  return {
    /** Silhouette area in local units² (used to keep a constant on-screen particle density). */
    areaLocal: coverage * unit * unit,
    sample,
  };
}

/**
 * Particle budget for a layout: keeps a constant density per CSS px² of the on-screen bust,
 * so the portrait looks the same on a phone, a laptop and a 4K monitor.
 * The default density (0.2 / px²) reproduces the reference measured at 1900x956.
 */
export function particleBudget(layout, areaLocal, density = 0.2) {
  const pxPerLocal = layout.hero.s / layout.wpp;
  return Math.round(areaLocal * pxPerLocal * pxPerLocal * density);
}
