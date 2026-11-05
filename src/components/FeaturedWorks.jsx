import { useEffect, useLayoutEffect, useRef } from 'react';
import { works } from '../data/works.js';
import { usePortrait } from './ParticleBackground.jsx';

const base = import.meta.env.BASE_URL;
const GAP_VW = 12;

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const smootherstep = (t) => t * t * t * (t * (6 * t - 15) + 10);

// Scroll geometry for the pinned, horizontally sliding track. Mirrors the reference motion:
// the track starts off-screen left, slides across the viewport, and the section height is
// derived from the travel distance so one scroll gesture moves through every work.
function getLayout(count) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const portrait = vw < vh;
  const tileVw = portrait ? 85 : 50;
  const leadIn = 0.09 * vw + (portrait ? 0.9 * vh : 0);
  const revealSpan = 2 * vh;
  const trackWidth = (vw * (count * tileVw + (count - 1) * GAP_VW)) / 100;
  const start = -trackWidth - leadIn;
  const maxTravel = vw + leadIn - start;
  const speed = portrait ? 0.6 : 1;
  const sectionHeight = Math.max(maxTravel / speed - revealSpan + vh, vh);
  return { portrait, revealSpan, start, maxTravel, speed, sectionHeight };
}

function WorkTile({ work }) {
  const Link = work.live ? 'a' : 'span';
  const linkProps = work.live ? { href: work.live, target: '_blank', rel: 'noreferrer' } : {};
  return (
    <div className="pp-works__tile">
      <Link className="pp-works__link" {...linkProps}>
        <img
          className="pp-works__media"
          src={`${base}works/${work.shot}`}
          alt={work.shotAlt}
          loading="lazy"
          draggable="false"
        />
      </Link>
      <div className="pp-works__caption">
        <Link className="pp-works__title" {...linkProps}>
          {work.title}
        </Link>
        <span className="pp-works__meta">
          <span className="pp-works__info">{work.info}</span>
        </span>
      </div>
    </div>
  );
}

export default function FeaturedWorks() {
  const portrait = usePortrait();
  const section = useRef(null);
  const kicker = useRef(null);
  const closing = useRef(null);
  const stage = useRef(null);
  const track = useRef(null);

  useLayoutEffect(() => {
    const el = section.current;
    const apply = () => {
      el.style.height = `${getLayout(works.length).sectionHeight}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  useEffect(() => {
    const el = section.current;
    const helixTarget = portrait?.state ?? null;
    let frame = 0;

    const update = () => {
      frame = 0;
      const { portrait, revealSpan, start, maxTravel, speed } = getLayout(works.length);
      const rect = el.getBoundingClientRect();
      const inView = rect.top < revealSpan && rect.bottom > 0;
      stage.current.dataset.active = String(inView);
      if (!inView) {
        kicker.current.dataset.active = 'false';
        closing.current.dataset.active = 'false';
        if (helixTarget) helixTarget.work = 0;
        return;
      }

      const near = rect.top < 0.4 * window.innerHeight && rect.bottom > 0.6 * window.innerHeight;
      const travel = Math.min(Math.max(revealSpan - rect.top, 0) * speed, maxTravel);
      const progress = travel / maxTravel;
      track.current.style.transform = `translateX(${start + smootherstep(progress) * maxTravel}px)`;

      const pastThreshold = portrait ? 0.4 : 0.6;
      const closingAmount = smootherstep(clamp01((progress - pastThreshold) / (1 - pastThreshold)));
      const showClosing = near && closingAmount > 0.5;
      closing.current.dataset.active = String(showClosing);
      kicker.current.dataset.active = String(near && !showClosing);

      // The particle cloud forms the helix while the works are on screen and dissolves back
      // as the closing line arrives.
      if (helixTarget) {
        helixTarget.work = smootherstep(clamp01(Math.min(progress * 2.5, 1) * (1 - closingAmount)));
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (helixTarget) helixTarget.work = 0;
    };
  }, [portrait]);

  return (
    <section className="pp-works" ref={section} aria-label="Featured works">
      <div className="pp-works__kicker">
        <p className="pp-works__kicker-label" ref={kicker} data-active="false">
          My Featured Works
        </p>
      </div>

      <div className="pp-works__closing-wrap">
        <p className="pp-works__closing" ref={closing} data-active="false">
          And still working on plenty more.
        </p>
      </div>

      <div className="pp-works__stage" ref={stage} data-active="false">
        <div className="pp-works__marquee">
          <div className="pp-works__track" ref={track}>
            {works.map((work) => (
              <WorkTile key={work.title} work={work} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
