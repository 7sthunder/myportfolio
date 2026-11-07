import { createRandom } from './utils.js';

/**
 * Extra per-particle targets for the scroll journey after the globe:
 *
 *   aMap     xyz = position inside the country silhouette (normalised: height 1, centred, y up)
 *            w   = 1 on the coastline / border (slightly brighter)
 *   aJourney x   = position along the ribbon / coil (0..1)
 *            y   = position across the ribbon (-1..1, weighted towards the two edges)
 *            z,w = gaussian jitter (ribbon thickness, frame band fuzz)
 *
 * Map targets are matched to the globe by height rank, so the globe's latitude slices land on
 * the matching rows of the map (north -> top) and the transition reads as slices reshaping.
 */
export function buildJourneyTargets(data, outline, { seed = 7, resolution = 720 } = {}) {
  const { count } = data;
  const rand = createRandom(seed);
  const raster = rasterise(outline, resolution);
  const { W, H, inside, edge } = raster;
  const aspect = outline.width / outline.height;

  // Interior samples (normalised, y up).
  const mx = new Float32Array(count);
  const my = new Float32Array(count);
  const mz = new Float32Array(count);
  const me = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const idx = inside[(rand() * inside.length) | 0];
    const px = (idx % W) + rand();
    const py = Math.floor(idx / W) + rand();
    mx[i] = (px / W - 0.5) * aspect;
    my[i] = 0.5 - py / H;
    mz[i] = rand.gaussian() * 0.006;
    me[i] = edge[idx];
  }

  // Rank-match: globe particles sorted by height <-> map samples sorted by height, then
  // matched left-to-right inside small row groups so neighbours stay neighbours.
  const byGlobe = Uint32Array.from({ length: count }, (_, i) => i).sort(
    (a, b) => data.sphere[b * 4 + 1] - data.sphere[a * 4 + 1],
  );
  const byMap = Uint32Array.from({ length: count }, (_, i) => i).sort((a, b) => my[b] - my[a]);
  const GROUP = 48;
  const map = new Float32Array(count * 4);
  for (let start = 0; start < count; start += GROUP) {
    const end = Math.min(count, start + GROUP);
    const g = Array.from(byGlobe.subarray(start, end)).sort((a, b) => data.sphere[a * 4] - data.sphere[b * 4]);
    const m = Array.from(byMap.subarray(start, end)).sort((a, b) => mx[a] - mx[b]);
    for (let k = 0; k < g.length; k++) {
      const i = g[k];
      const j = m[k];
      map[i * 4] = mx[j];
      map[i * 4 + 1] = my[j];
      map[i * 4 + 2] = mz[j];
      map[i * 4 + 3] = me[j];
    }
  }

  const journey = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    journey[i * 4] = rand();
    journey[i * 4 + 1] = side * (1 - 0.97 * rand() ** 3);
    journey[i * 4 + 2] = rand.gaussian();
    journey[i * 4 + 3] = rand.gaussian();
  }

  return { map, journey };
}

/** Rasterises an SVG outline (normalised to height 1, y down) into inside / edge pixel lists. */
function rasterise(outline, H) {
  const W = Math.max(1, Math.ceil(H * (outline.width / outline.height)));
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(H / outline.height, 0, 0, H / outline.height, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D(outline.path));
  const pixels = ctx.getImageData(0, 0, W, H).data;

  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = pixels[i * 4 + 3] > 127 ? 1 : 0;

  const inside = [];
  const edge = new Float32Array(W * H);
  const R = 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!solid[i]) continue;
      inside.push(i);
      let border = 0;
      for (let dy = -R; dy <= R && !border; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || !solid[yy * W + xx]) {
            border = 1;
            break;
          }
        }
      }
      edge[i] = border;
    }
  }
  return { W, H, inside: Uint32Array.from(inside), edge };
}
