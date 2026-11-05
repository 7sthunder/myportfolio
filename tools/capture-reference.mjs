// Captures the live reference site at a list of scroll positions (in viewport heights) so the
// particle behaviour can be compared frame by frame with our build.
//   node tools/capture-reference.mjs --scroll 3.8,4.2,4.6 --tag ref
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const scrolls = String(opt('scroll', '')).split(',').filter(Boolean).map(Number);
const tag = opt('tag', 'ref');
const url = opt('url', 'https://ingrassiadaniel.it/');
const out = join(root, 'reference', 'captures');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1900, height: 956 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

for (const s of scrolls) {
  await page.evaluate((y) => window.scrollTo(0, y), s * 956);
  await page.waitForTimeout(2500);
  const file = join(out, `${tag}_s${s.toFixed(2)}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
}
await browser.close();
