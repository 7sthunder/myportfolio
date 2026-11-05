// Builds a contact sheet from a list of images (same layout as the reference sheets).
// Usage: node tools/sheet.mjs <out.jpg> <columns> <tileWidth> <img1> <img2> ...
import sharp from 'sharp';

const [out, columns, tileWidth, ...files] = process.argv.slice(2);
const cols = Number(columns);
const tw = Number(tileWidth);
const first = await sharp(files[0]).metadata();
const th = Math.round((first.height * tw) / first.width);
const rows = Math.ceil(files.length / cols);
const pad = 4;
const tiles = await Promise.all(
  files.map(async (f, i) => ({
    input: await sharp(f).resize(tw, th).toBuffer(),
    left: (i % cols) * (tw + pad),
    top: Math.floor(i / cols) * (th + pad),
  })),
);
await sharp({
  create: { width: cols * (tw + pad) - pad, height: rows * (th + pad) - pad, channels: 3, background: '#808080' },
})
  .composite(tiles)
  .jpeg({ quality: 88 })
  .toFile(out);
console.log('wrote', out);
