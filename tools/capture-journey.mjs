// Screenshots of the scroll journey at given points of its timeline (Journey.jsx, units of
// viewport height measured from the moment the journey section enters the viewport).
//
// Usage:
//   node tools/capture-journey.mjs --t 3.9,4.6,5.2 [--w 1900] [--h 956] [--dpr 1] [--tag works]
//                                  [--url http://localhost:5173/] [--wait 2600]
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const url = opt('url', 'http://localhost:5173/');
const width = Number(opt('w', 1900));
const height = Number(opt('h', 956));
const dpr = Number(opt('dpr', 1));
const wait = Number(opt('wait', 2600));
const tag = opt('tag', 'journey');
const times = String(opt('t', '')).split(',').filter(Boolean).map(Number);
const has = (name) => args.includes(`--${name}`);
const out = join(root, 'reference', 'captures');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(`${url}${url.includes('?') ? '&' : '?'}debug`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__pp?.portrait?.loaded, null, { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => window.__pp.intro?.progress(1));

const scrollTo = (t) =>
  page.evaluate((time) => {
    const el = document.querySelector('.pp-journey');
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - window.innerHeight + time * window.innerHeight);
  }, t);

// --end: jump to the bottom of the page (the contact card).
for (const t of has('end') ? ['end'] : times) {
  if (t === 'end') await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  else await scrollTo(t);
  await page.waitForTimeout(wait);
  const file = join(out, `${tag}_${t === 'end' ? 'end' : `j${t.toFixed(2)}`}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file, await page.evaluate(() => window.__pp.portrait.state.work.toFixed(3)));
}

const interesting = logs.filter((l) => !l.includes('[vite]') && !l.includes('React DevTools'));
if (interesting.length) console.log('console:\n' + interesting.join('\n'));
await browser.close();
