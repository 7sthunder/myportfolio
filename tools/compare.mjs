// Quantitative comparison between a reference frame and a capture.
// Prints mean luminance + histogram for matching regions and writes a side-by-side crop.
//
// Usage: node tools/compare.mjs <reference.png> <capture.png> <refX,refY,w,h> <capX,capY,w,h> [out.png]
import sharp from 'sharp';

const [refPath, capPath, refBox, capBox, outPath] = process.argv.slice(2);
const box = (s) => {
  const [left, top, width, height] = s.split(',').map(Number);
  return { left, top, width, height };
};

async function stats(file, region) {
  const { data } = await sharp(file).extract(region).greyscale().raw().toBuffer({ resolveWithObject: true });
  const bins = new Array(26).fill(0);
  let sum = 0;
  for (const v of data) {
    sum += v;
    bins[Math.min(25, (v / 10) | 0)]++;
  }
  const n = data.length;
  const pct = (from) => ((bins.slice(from / 10).reduce((a, b) => a + b, 0) / n) * 100).toFixed(1);
  return { mean: (sum / n).toFixed(1), over50: pct(50), over60: pct(60), over100: pct(100), over150: pct(150), bins };
}

const a = await stats(refPath, box(refBox));
const b = await stats(capPath, box(capBox));
const row = (name, s) =>
  `${name.padEnd(10)} mean ${s.mean.padStart(5)} | >50 ${s.over50.padStart(5)}% | >60 ${s.over60.padStart(5)}% | >100 ${s.over100.padStart(5)}% | >150 ${s.over150.padStart(4)}%`;
console.log(row('reference', a));
console.log(row('capture', b));

if (outPath) {
  const rb = box(refBox);
  const cb = box(capBox);
  const h = Math.max(rb.height, cb.height);
  const left = await sharp(refPath).extract(rb).resize({ height: h }).png().toBuffer();
  const right = await sharp(capPath).extract(cb).resize({ height: h }).png().toBuffer();
  const lw = Math.round((rb.width * h) / rb.height);
  const rw = Math.round((cb.width * h) / cb.height);
  await sharp({ create: { width: lw + rw + 8, height: h, channels: 3, background: '#808080' } })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: lw + 8, top: 0 },
    ])
    .png()
    .toFile(outPath);
  console.log('wrote', outPath);
}
