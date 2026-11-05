import { createPortraitSampler, decodePortraitMap, readImagePixels } from './sampling.js';

const canUseWorker = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';

/** Fetches the packed portrait map as a Blob (matches `<link rel="preload" as="fetch">`). */
export async function fetchPortraitMap(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Portrait map failed to load: ${response.status} ${url}`);
  return response.blob();
}

/**
 * Creates a portrait sampler from the map Blob, running the analysis in a Web Worker when
 * possible so page-load animations never stall. Same async interface either way:
 *   { areaLocal, sample(count) => Promise<data>, dispose() }
 */
export async function createSampler(blob, meta, options = {}, { useWorker = true } = {}) {
  if (useWorker && canUseWorker()) {
    try {
      return await createWorkerSampler(blob, meta, options);
    } catch (error) {
      console.warn('[particle-portrait] Worker sampling unavailable, using the main thread.', error);
    }
  }
  const map =
    typeof createImageBitmap !== 'undefined' ? await decodePortraitMap(blob) : await decodeWithImage(blob);
  const sampler = createPortraitSampler(map, meta, options);
  return { mode: 'main', areaLocal: sampler.areaLocal, sample: async (count) => sampler.sample(count), dispose() {} };
}

async function decodeWithImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return readImagePixels(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createWorkerSampler(blob, meta, options) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./sampler.worker.js', import.meta.url), { type: 'module' });
    let pending = null;
    const fail = (error) => {
      worker.terminate();
      if (pending) pending.reject(error);
      else reject(error);
    };
    worker.onerror = (event) => fail(new Error(event.message || 'Sampler worker failed'));
    worker.onmessage = ({ data: msg }) => {
      if (msg.type === 'ready') {
        resolve({
          mode: 'worker',
          areaLocal: msg.areaLocal,
          sample: (count) =>
            new Promise((res, rej) => {
              pending = { resolve: res, reject: rej };
              worker.postMessage({ type: 'sample', count });
            }),
          dispose: () => worker.terminate(),
        });
      } else if (msg.type === 'sampled') {
        pending?.resolve(msg.data);
        pending = null;
        worker.terminate();
      } else if (msg.type === 'error') {
        fail(new Error(msg.message));
      }
    };
    worker.postMessage({ type: 'init', blob, meta, options });
  });
}
