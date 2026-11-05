import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CometCursor } from '../experience/CometCursor.js';
import { splitText } from '../experience/text.js';
import { usePortrait } from './ParticleBackground.jsx';

gsap.registerPlugin(ScrollTrigger);

export default function ParticleHero() {
  const portrait = usePortrait();
  const experience = useRef(null);
  const ring = useRef(null);
  const ringPath = useRef(null);
  const name = useRef(null);
  const role = useRef(null);
  const about = useRef(null);

  useEffect(() => {
    if (!portrait) return;
    const ringEl = ring.current;
    const ringPathEl = ringPath.current;
    const params = new URLSearchParams(window.location.search);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Keeps the orbiting "Available everywhere / Working globally" text hugging the globe.
    const layoutRing = (layout) => {
      const fontSize = parseFloat(getComputedStyle(ringEl).fontSize) || 24;
      const r = layout.globe.radiusPx + fontSize * 1.1;
      const half = Math.ceil(r + fontSize * 1.5);
      ringEl.setAttribute('viewBox', `${-half} ${-half} ${half * 2} ${half * 2}`);
      ringEl.style.width = `${half * 2}px`;
      ringEl.style.height = `${half * 2}px`;
      ringPathEl.setAttribute('d', `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}`);
    };

    const cursor = new CometCursor();
    const prevLayout = portrait.options.onLayout;
    portrait.options.onLayout = (layout, instance) => {
      prevLayout?.(layout, instance);
      layoutRing(layout);
    };
    if (portrait.layout) layoutRing(portrait.layout);
    const ringState = { spin: 0, drift: 0 };
    let ringValue = -1;
    let alive = true;
    let intro = null;

    const ctx = gsap.context(() => {
      // ---------------------------------------------------------- intro (time based)
      const nameChars = splitText(name.current);
      const roleChars = splitText(role.current);
      gsap.set([...nameChars, ...roleChars], { opacity: 0, filter: 'blur(10px)' });

      intro = gsap.timeline({ paused: true });
      intro
        .to(nameChars, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out', stagger: 0.035 }, 1.2)
        .to(roleChars, { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out', stagger: 0.018 }, 1.6);

      portrait.ready
        .then(() => {
          if (!alive) return;
          intro.add(portrait.intro(), 0);
          intro.play(0);
        })
        .catch(() => intro.progress(1));

      // ---------------------------------------------------------- scroll choreography
      // One scrubbed timeline across the whole experience; 1 unit = 100vh of scroll.
      gsap
        .timeline({
          scrollTrigger: { trigger: experience.current, start: 'top top', end: 'bottom bottom', scrub: 1 },
        })
        .to(portrait.state, { shift: 1, ease: 'power2.inOut', duration: 0.95 }, 0.05)
        .to(portrait.state, { morph: 1, ease: 'none', duration: 0.75 }, 1.05)
        .to(ringState, { spin: 32, ease: 'none', duration: 0.8 }, 1.8)
        .to({}, { duration: 0.01 }, 2.59);

      const words = splitText(about.current, 'words');
      gsap.fromTo(
        words,
        { opacity: 0.16 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: about.current, start: 'top 92%', end: 'bottom 48%', scrub: 0.6 },
        },
      );
    });

    // Orbiting text: fades/unblurs in as the globe completes, then turns slowly (time + scroll).
    const tick = (_, deltaMs) => {
      const m = portrait.state.morph;
      const t = Math.min(1, Math.max(0, (m - 0.84) / 0.16));
      const v = t * t * (3 - 2 * t);
      if (v <= 0) {
        ringState.drift = 0;
        if (ringValue === 0) return;
      } else if (!reduceMotion) {
        ringState.drift += (deltaMs / 1000) * 2.4;
      }
      ringEl.style.transform = `translate(-50%, -50%) rotate(${(8 + ringState.spin + ringState.drift).toFixed(2)}deg)`;
      if (Math.abs(v - ringValue) < 0.002) return;
      ringValue = v;
      ringEl.style.opacity = v.toFixed(3);
      ringEl.style.filter = v > 0.995 ? 'none' : `blur(${((1 - v) * 10).toFixed(2)}px)`;
    };
    gsap.ticker.add(tick);

    // Debug / capture hooks (used by tools/capture.mjs). Enabled in dev or with ?debug.
    if (import.meta.env.DEV || params.has('debug')) {
      window.__pp = { ...window.__pp, portrait, intro, cursor, gsap, ScrollTrigger };
    }

    return () => {
      alive = false;
      gsap.ticker.remove(tick);
      ctx.revert();
      cursor.dispose();
      portrait.options.onLayout = prevLayout;
      if (window.__pp) delete window.__pp.intro;
    };
  }, [portrait]);

  return (
    <div className="pp-experience" ref={experience}>
      <div className="pp-ring-stage">
        <svg className="pp-ring" ref={ring} aria-hidden="true" focusable="false">
          <defs>
            <path id="pp-ring-path" ref={ringPath} d="M0 -1 A1 1 0 1 1 0 1 A1 1 0 1 1 0 -1" />
          </defs>
          <text>
            <textPath href="#pp-ring-path" startOffset="75%" textAnchor="middle">
              Available everywhere
            </textPath>
          </text>
          <text>
            <textPath href="#pp-ring-path" startOffset="25%" textAnchor="middle">
              Working globally
            </textPath>
          </text>
        </svg>
      </div>

      <div className="pp-content">
        <section className="pp-hero" aria-label="Introduction">
          <h1 className="pp-hero__name" ref={name}>
            Aadhi Narayanan
          </h1>
          <p className="pp-hero__role" ref={role}>
            <span className="pp-role__line">Software Developer /</span>{' '}
            <span className="pp-role__line">Full Stack Developer</span>
          </p>
        </section>

        <section className="pp-about" aria-label="About">
          <p className="pp-about__text" ref={about}>
            I turn ambitious ideas into fast, reliable web products. Frontend, backend, performance. As a technical
            partner for startups, founders and product teams.
          </p>
        </section>

        <section className="pp-globe" aria-label="Availability">
          <p className="pp-sr-only">Available everywhere. Working globally.</p>
        </section>
      </div>
    </div>
  );
}
