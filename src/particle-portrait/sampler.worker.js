import { createPortraitSampler, decodePortraitMap } from './sampling.js';

// Runs the portrait analysis + particle sampling off the main thread.
let sampler = null;

self.onmessage = async ({ data: msg }) => {
  try {
    if (msg.type === 'init') {
      const map = await decodePortraitMap(msg.blob);
      sampler = createPortraitSampler(map, msg.meta, msg.options);
      self.postMessage({ type: 'ready', areaLocal: sampler.areaLocal });
    } else if (msg.type === 'sample') {
      const data = sampler.sample(msg.count);
      const transfer = [data.positions, data.sphere, data.scatter, data.random, data.shade].map((a) => a.buffer);
      self.postMessage({ type: 'sampled', data }, transfer);
      sampler = null; // free the analysis buffers
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error?.message ?? error) });
  }
};
