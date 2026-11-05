// Captures deterministic screenshots of the running experience for side-by-side comparison
// with the reference video frames.
//
// Usage:
//   node tools/capture.mjs [--url http://localhost:5173] [--w 1900] [--h 956] [--dpr 1]
//                          [--times 0.5,1,2,2.5,3,4] [--scroll 0.5,1,1.3,1.6,2.2] [--cursor] [--tag name]
//                          [--headed] [--query "count=60000"]
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
const has = (name) => args.includes(`--${name}`);
const list = (v) => (v ? String(v).split(',').filter(Boolean).map(Number) : []);

const url = opt('url', 'http://localhost:5173/');
const width = Number(opt('w', 1900));
const height = Number(opt('h', 956));
const dpr = Number(opt('dpr', 1));
const tag = opt('tag', `${width}x${height}`);
const times = list(opt('times', ''));
const scrolls = list(opt('scroll', ''));
const query = opt('query', '');
const out = join(root, 'reference', 'captures');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !has('headed'),
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
const logs = [];
await page.addInitScript(() => {
  window.__longTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
});
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const frames = (n = 2) =>
  page.evaluate(
    (count) =>
      new Promise((done) => {
        let i = 0;
        const step = () => (++i >= count ? done() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n,
  );

const target = query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url;
// Retry once: a dev-server reload (HMR / dependency optimisation) can interrupt the first load.
for (let attempt = 0; ; attempt++) {
  try {
    await page.goto(target, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__pp?.portrait?.loaded, null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__pp.portrait.loaded);
    break;
  } catch (error) {
    if (attempt >= 2) throw error;
    await page.waitForTimeout(1500);
  }
}

const info = await page.evaluate(() => {
  const p = window.__pp.portrait;
  const gl = p.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    generated: p.data.count,
    drawn: Math.min(p.data.count, p.particles.geometry.drawRange.count),
    size: +p.particles.uniforms.uSize.value.toFixed(2),
    samplingMs: Math.round(p.samplingTime),
    sampler: p.samplerMode,
    pixelRatio: p.pixelRatio,
    field: p.field.enabled,
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
    longTasksMs: window.__longTasks.join(',') || 'none',
  };
});
console.log('info', info);

for (const t of times) {
  await page.evaluate((time) => {
    const { intro } = window.__pp;
    intro.pause();
    intro.seek(time, false);
  }, t);
  await frames(3);
  const file = join(out, `${tag}_t${t.toFixed(2)}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
}

if (scrolls.length || has('cursor')) {
  await page.evaluate(() => window.__pp.intro.progress(1));
}

for (const s of scrolls) {
  await page.evaluate((units) => window.scrollTo(0, units * window.innerHeight), s);
  await page.waitForTimeout(2200);
  await frames(2);
  const file = join(out, `${tag}_s${s.toFixed(2)}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
}

if (has('cursor')) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1800);
  await page.mouse.move(width * 0.1, height * 0.05);
  await page.waitForTimeout(300);
  // Fast sweep through the head, like the reference's comet pass.
  const path = [
    [0.1, 0.05],
    [0.3, 0.2],
    [0.45, 0.3],
    [0.55, 0.36],
    [0.66, 0.42],
  ];
  for (let i = 1; i < path.length; i++) {
    await page.mouse.move(path[i][0] * width, path[i][1] * height, { steps: 4 });
    await page.waitForTimeout(16);
  }
  await page.screenshot({ path: join(out, `${tag}_cursor_fast.png`) });
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(out, `${tag}_cursor_after350.png`) });
  await page.mouse.move(width * 0.84, height * 0.68, { steps: 10 });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: join(out, `${tag}_cursor_rest.png`) });
  console.log('saved cursor captures');
}

const perf = await page.evaluate(
  () =>
    new Promise((done) => {
      const samples = [];
      let last = performance.now();
      const step = (now) => {
        samples.push(now - last);
        last = now;
        if (samples.length < 120) requestAnimationFrame(step);
        else done(samples.slice(10));
      };
      requestAnimationFrame(step);
    }),
);
perf.sort((a, b) => a - b);
console.log('frame ms: median', perf[perf.length >> 1].toFixed(2), 'p95', perf[Math.floor(perf.length * 0.95)].toFixed(2));

const interesting = logs.filter((l) => !l.includes('[vite]') && !l.includes('Download the React DevTools'));
if (interesting.length) console.log('console:\n' + interesting.join('\n'));
await browser.close();
