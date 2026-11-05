import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ParticlePortrait } from './particle-portrait/index.js';
import { CometCursor } from './experience/CometCursor.js';
import { splitText } from './experience/text.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(window.location.search);
const base = import.meta.env.BASE_URL;

const stage = $('[data-pp-stage]');
const ring = $('[data-pp-ring]');
const ringPath = $('[data-pp-ring-path]');

/** Keeps the orbiting "Available everywhere / Working globally" text hugging the globe. */
function layoutRing(layout) {
  const fontSize = parseFloat(getComputedStyle(ring).fontSize) || 24;
  const r = layout.globe.radiusPx + fontSize * 0.42;
  const half = Math.ceil(r + fontSize * 1.5);
  ring.setAttribute('viewBox', `${-half} ${-half} ${half * 2} ${half * 2}`);
  ring.style.width = `${half * 2}px`;
  ring.style.height = `${half * 2}px`;
  ringPath.setAttribute('d', `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}`);
}

const portrait = new ParticlePortrait(stage, {
  map: `${base}portrait/portrait-map.png`,
  meta: `${base}portrait/portrait-map.json`,
  count: params.has('count') ? Number(params.get('count')) : null,
  onLayout: layoutRing,
});
const cursor = new CometCursor();

// ------------------------------------------------------------------ intro (time based)
const nameChars = splitText($('[data-pp-name]'));
const roleChars = splitText($('[data-pp-role]'));
gsap.set([...nameChars, ...roleChars], { opacity: 0, filter: 'blur(10px)' });

const intro = gsap.timeline({ paused: true });
intro
  .to(nameChars, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out', stagger: 0.035 }, 1.2)
  .to(roleChars, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out', stagger: 0.018 }, 1.6);

portrait.ready
  .then(() => {
    intro.add(portrait.intro(), 0);
    intro.play(0);
  })
  .catch(() => intro.progress(1));

// ------------------------------------------------------------------ scroll choreography
// One scrubbed timeline across the whole experience; 1 unit = 100vh of scroll
// (hero 100vh + about 100vh + globe 160vh = 360vh, i.e. 260vh of scroll distance).
const ringState = { spin: 0, drift: 0 };
gsap
  .timeline({
    scrollTrigger: { trigger: '[data-pp-experience]', start: 'top top', end: 'bottom bottom', scrub: 1 },
  })
  .to(portrait.state, { shift: 1, ease: 'power2.inOut', duration: 0.95 }, 0.05)
  .to(portrait.state, { morph: 1, ease: 'none', duration: 0.75 }, 1.05)
  .to(ringState, { spin: 32, ease: 'none', duration: 0.8 }, 1.8)
  .to({}, { duration: 0.01 }, 2.59);

const words = splitText($('[data-pp-about]'), 'words');
gsap.fromTo(
  words,
  { opacity: 0.16 },
  {
    opacity: 1,
    ease: 'none',
    stagger: 0.1,
    scrollTrigger: { trigger: '[data-pp-about]', start: 'top 92%', end: 'bottom 48%', scrub: 0.6 },
  },
);

// Orbiting text: fades/unblurs in as the globe completes, then turns slowly (time + scroll).
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let ringValue = -1;
gsap.ticker.add((_, deltaMs) => {
  const m = portrait.state.morph;
  const t = Math.min(1, Math.max(0, (m - 0.84) / 0.16));
  const v = t * t * (3 - 2 * t);
  if (v <= 0) {
    ringState.drift = 0;
    if (ringValue === 0) return;
  } else if (!reduceMotion) {
    ringState.drift += (deltaMs / 1000) * 2.4;
  }
  ring.style.transform = `translate(-50%, -50%) rotate(${(8 + ringState.spin + ringState.drift).toFixed(2)}deg)`;
  if (Math.abs(v - ringValue) < 0.002) return;
  ringValue = v;
  ring.style.opacity = v.toFixed(3);
  ring.style.filter = v > 0.995 ? 'none' : `blur(${((1 - v) * 10).toFixed(2)}px)`;
});

// Debug / capture hooks (used by tools/capture.mjs).
window.__pp = { portrait, intro, cursor, gsap, ScrollTrigger };
