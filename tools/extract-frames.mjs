// Extracts analysis frames + contact sheets from the inspiration video with FFmpeg.
// Usage: node tools/extract-frames.mjs [path/to/video.mp4]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const video = resolve(process.argv[2] ?? join(root, 'reference', 'inspiration.mp4'));
const out = join(root, 'reference', 'frames');

const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

for (const dir of ['q4', 'sheet', 'interaction']) mkdirSync(join(out, dir), { recursive: true });

// Full-resolution frames every 0.25 s.
ffmpeg(['-i', video, '-vf', 'fps=4', '-q:v', '2', join(out, 'q4', 'f_%03d.jpg')]);

// Contact sheets for each phase of the sequence: [name, start, duration, fps, grid, filter prefix]
const sheets = [
  ['contact_2fps', 0, 11, 2, '4x6', ''],
  ['intro_0-2s_4fps', 0, 2, 4, '4x2', ''],
  ['formation_2.0-3.5s_8fps', 2, 1.5, 8, '4x3', 'crop=1100:956:400:0,'],
  ['comet_3.8-5.2s_10fps', 3.8, 1.4, 10, '4x4', ''],
  ['scroll_5-7s_6fps', 5, 2, 6, '4x3', ''],
  ['morph_6.8-9s_6fps', 6.8, 2.2, 6, '4x4', ''],
  ['sphere_8.9-10.9s_5fps', 8.9, 2, 5, '5x2', ''],
];

for (const [name, ss, t, fps, grid, pre] of sheets) {
  ffmpeg([
    '-ss', String(ss), '-t', String(t), '-i', video,
    '-vf', `fps=${fps},${pre}scale=475:-1,tile=${grid}:padding=4:color=gray`,
    '-frames:v', '1', '-q:v', '2', join(out, 'sheet', `${name}.jpg`),
  ]);
}

// Cursor-interaction study: zoomed crops while the comet cursor sweeps through the head.
ffmpeg(['-ss', '4.2', '-t', '1.0', '-i', video, '-vf', 'fps=15,crop=760:620:580:60', '-q:v', '2', join(out, 'interaction', 'i_%02d.jpg')]);

console.log(`Frames written to ${out}`);
