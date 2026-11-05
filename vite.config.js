import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  // three.js accounts for most of the bundle (~190 kB gzip in total), which is expected for WebGL.
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 800 },
});
