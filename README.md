# Particle Portrait Hero

An interactive 3D particle portrait built with Three.js and custom GLSL. The portrait is generated from a photo: a matte and a depth map are computed offline, then sampled into about 85k particles that form, react to the cursor, and morph into a globe while scrolling.

## Features

- **Intro:** dust condenses into an out-of-focus silhouette that sharpens.
- **Idle:** very subtle per-particle drift and twinkle.
- **Cursor:** a GPU trail field pushes particles aside and sparkles them, and the cursor acts as a soft light. A custom comet cursor draws a tapered tail.
- **Depth:** real depth relief, depth of field and subtle pointer parallax.
- **Scroll stage 1:** the bust slides right and grows while a paragraph reveals word by word.
- **Scroll stage 2:** the bust is sliced into bands that spin into discs, then latitude rings, then a particle globe with orbiting text.

## Quick start

```bash
npm install                 # three, gsap, vite
cd tools && npm install     # offline tooling only (sharp, playwright-core, @huggingface/transformers)
cd ..
npm run reference:frames    # optional: re-extract reference frames (needs FFmpeg)
```

```bash
npm run dev       # http://localhost:5173
npm run build     # production build -> dist/
npm run preview   # http://localhost:4173
```

## Replacing the photo

1. Put the new photo at `reference/portrait-original.jpeg`.
2. Check `EXCLUDE_CIRCLES` in `tools/prepare-portrait.mjs`. Set it to `[]` if nothing touches the subject.
3. Run `npm run portrait:prepare -- --refresh`. The first run downloads about 120 MB of models.
4. Inspect `reference/debug/cutout-preview.png` and `reference/debug/depth-subject.png`.

## Module

The reusable module lives in `src/particle-portrait/` and has no framework dependency.

- `ParticlePortrait.js`: orchestrator (renderer, loading, layout, input, loop, intro, dispose). Options are in `DEFAULT_OPTIONS`.
- `PortraitParticles.js`: `THREE.Points` plus the shader material. Usable with React Three Fiber via `<primitive>`.
- `InteractionField.js`: cursor trail field.
- `Atmosphere.js`: background and ambient dust.
- `layout.js`: responsive composition for hero, about and globe.
- `sampling.js`, `samplerClient.js`, `sampler.worker.js`: sampling, run in a Web Worker.
- `shaders/`: particle and field GLSL.

Tuning values are listed in `plan.md` §8.

## Browser support and fallbacks

- No WebGL: the container gets the `.pp-no-webgl` class.
- No half-float render target: the cursor trail is disabled and only the cursor light remains.
- No Worker or OffscreenCanvas: sampling runs on the main thread.
- `prefers-reduced-motion`: the intro is skipped and the native cursor is used.

## Tools

- `tools/capture.mjs`: deterministic screenshots through Chrome (needs the dev server running).
- `tools/compare.mjs`: histogram comparison of two image regions.
- `tools/sheet.mjs`: contact sheets.
- `tools/extract-frames.mjs`: FFmpeg frame extraction from the reference video.

See `plan.md` §6 for usage.
