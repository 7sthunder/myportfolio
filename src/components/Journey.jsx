import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { achievements, experience } from '../data/milestones.js';
import { site } from '../data/site.js';
import { works } from '../data/works.js';
import { splitText } from '../experience/text.js';
import { WorksCanvas } from '../experience/WorksCanvas.js';
import { CalendarIcon, MilestoneIcon, SilverDefs } from './MilestoneIcons.jsx';
import { usePortrait } from './ParticleBackground.jsx';

gsap.registerPlugin(ScrollTrigger);

const base = import.meta.env.BASE_URL;

/**
 * Scroll choreography after the globe, in viewport heights of scroll (1 = 100vh), measured from
 * the moment this section's top enters the bottom of the viewport (the globe is complete then):
 *
 *   globe -> map of India ("Based in India" scrolls past) -> map dissolves into a twisted ribbon
 *   (statement) -> works slide across over the ribbon -> ribbon winds into a coil, then a tunnel
 *   ("And still working on plenty more.") -> the tunnel unravels into the experience timeline
 *   (glowing line + orbs) -> corner currents behind the achievements -> the frame of the
 *   contact card.
 */
const WORKS_SPAN = works.length * 1.05 + 0.7;
const T = (() => {
  const t = { mapIn: 0.02, mapDone: 1.05, dnaIn: 1.6, dnaDone: 2.9, statementIn: 2.55, statementOut: 3.45 };
  t.worksIn = 3.4;
  t.worksOut = t.worksIn + WORKS_SPAN;
  t.kickerIn = t.worksIn + 0.15;
  t.kickerOut = t.worksOut - 0.4;
  t.coilIn = t.worksOut - 1.15;
  t.coilDone = t.worksOut + 0.2;
  t.closingIn = t.worksOut - 0.45;
  t.tunnelIn = t.worksOut + 0.05;
  t.tunnelDone = t.worksOut + 1.3;
  t.closingOut = t.tunnelDone + 0.4;
  t.expIn = t.tunnelDone + 0.35;
  t.expDone = t.expIn + 1.0;
  t.expTextIn = t.expIn + 0.7;
  t.expTextOut = t.expDone + 1.0;
  t.achIn = t.expDone + 1.05;
  t.achDone = t.achIn + 1.0;
  t.achTextIn = t.achIn + 0.7;
  t.achTextOut = t.achDone + 1.1;
  t.frameIn = t.achDone + 1.15;
  t.frameDone = t.frameIn + 1.05;
  t.contactIn = t.frameIn + 0.65;
  t.end = t.frameDone + 0.35;
  return t;
})();

function WorkTile({ work, mediaRef }) {
  const Link = work.live ? 'a' : 'span';
  const linkProps = work.live ? { href: work.live, target: '_blank', rel: 'noreferrer' } : {};
  return (
    <li className="pp-works__tile">
      <Link className="pp-works__link" {...linkProps}>
        <span className="pp-works__media" ref={mediaRef} style={{ '--tone': work.tone }}>
          <img src={`${base}works/${work.shot}`} alt={work.shotAlt} loading="lazy" draggable="false" />
        </span>
      </Link>
      <div className="pp-works__caption">
        <Link className="pp-works__title" {...linkProps}>
          {work.title}
        </Link>
        <span className="pp-works__info">{work.info}</span>
      </div>
    </li>
  );
}

function Monogram() {
  return (
    <svg className="pp-footer__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M6 26 L14.5 6 L23 26 M9.6 18.5 H19.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M20 26 V12 L27 26 V9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function Journey() {
  const portrait = usePortrait();
  const root = useRef(null);
  const statement = useRef(null);
  const kicker = useRef(null);
  const stage = useRef(null);
  const track = useRef(null);
  const glLayer = useRef(null);
  const closing = useRef(null);
  const contact = useRef(null);
  const card = useRef(null);
  const exp = useRef(null);
  const expLine = useRef(null);
  const expNodes = useRef([]);
  const ach = useRef(null);
  const media = useRef([]);

  useEffect(() => {
    if (!portrait) return;
    const state = portrait.state;
    const reveal = [...splitText(contact.current.querySelector('.pp-contact__kicker')), ...splitText(contact.current.querySelector('.pp-contact__alt'))];
    reveal.forEach((el, i) => el.style.setProperty('--d', `${i * 18}ms`));
    portrait.frameElement = card.current;
    portrait.timelineAnchors = { line: expLine.current, nodes: expNodes.current };

    let gl = null;
    try {
      gl = new WorksCanvas(
        glLayer.current,
        works.map((work, i) => ({ el: media.current[i], src: `${base}works/${work.shot}`, tone: work.tone })),
      );
      root.current.classList.add('pp-journey--gl');
    } catch {
      gl = null;
    }

    const works$ = { progress: 0 };
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom bottom', scrub: 1 },
      });
      tl.to(state, { map: 1, duration: T.mapDone - T.mapIn }, T.mapIn)
        .to(state, { dna: 1, duration: T.dnaDone - T.dnaIn }, T.dnaIn)
        .to(state, { flow: 9, duration: T.frameIn - T.dnaIn }, T.dnaIn)
        .to(works$, { progress: 1, duration: T.worksOut - T.worksIn }, T.worksIn)
        .to(state, { coil: 1, duration: T.coilDone - T.coilIn }, T.coilIn)
        .to(state, { tunnel: 1, duration: T.tunnelDone - T.tunnelIn }, T.tunnelIn)
        .to(state, { experience: 1, duration: T.expDone - T.expIn }, T.expIn)
        .to(state, { achievements: 1, duration: T.achDone - T.achIn }, T.achIn)
        .to(state, { frame: 1, duration: T.frameDone - T.frameIn }, T.frameIn)
        .to({}, { duration: 0.001 }, T.end - 0.001);

      const set = (el, on) => {
        const v = String(on);
        if (el.dataset.active !== v) el.dataset.active = v;
      };

      const tick = (_, deltaMs) => {
        const t = tl.time();
        set(statement.current, t >= T.statementIn && t < T.statementOut);
        set(kicker.current, t >= T.kickerIn && t < T.kickerOut);
        set(closing.current, t >= T.closingIn && t < T.closingOut);
        set(exp.current, t >= T.expTextIn && t < T.expTextOut);
        set(ach.current, t >= T.achTextIn && t < T.achTextOut);
        set(contact.current, t >= T.contactIn);

        const active = t > T.worksIn - 0.05 && t < T.worksOut + 0.05;
        set(stage.current, active);
        if (!active) {
          if (gl?.lastX !== null) gl?.clear();
          return;
        }
        const width = track.current.scrollWidth;
        const x = -width + works$.progress * (window.innerWidth + width);
        track.current.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
        gl?.render(deltaMs / 1000, x);
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    });

    return () => {
      ctx.revert();
      gl?.dispose();
      root.current?.classList.remove('pp-journey--gl');
      if (portrait.frameElement === card.current) portrait.frameElement = null;
      portrait.timelineAnchors = null;
      Object.assign(state, { map: 0, dna: 0, flow: 0, coil: 0, tunnel: 0, experience: 0, achievements: 0, frame: 0 });
    };
  }, [portrait]);

  return (
    <section className="pp-journey" ref={root} aria-label="About, works and contact">
      <div className="pp-journey__stage">
        <p className="pp-statement" ref={statement} data-active="false">
          I don’t just execute what’s handed to me - I bring my own creative instinct into the mix, pushing interactions,
          animation and visual ideas wherever they’d genuinely elevate the work.
        </p>

        <p className="pp-works__kicker" ref={kicker} data-active="false">
          Some selected works
        </p>

        <div className="pp-works" ref={stage} data-active="false">
          <div className="pp-works__gl" ref={glLayer} />
          <ul className="pp-works__track" ref={track} aria-label="Selected works">
            {works.map((work, i) => (
              <WorkTile key={work.title} work={work} mediaRef={(el) => (media.current[i] = el)} />
            ))}
          </ul>
        </div>

        <p className="pp-closing" ref={closing} data-active="false">
          And still working on plenty more.
        </p>

        <section className="pp-exp" ref={exp} data-active="false" aria-labelledby="pp-exp-title">
          <div className="pp-exp__intro">
            <p className="pp-exp__kicker pp-reveal" style={{ '--d': '0ms' }}>
              My journey
            </p>
            <h2 className="pp-exp__title pp-reveal" id="pp-exp-title" style={{ '--d': '90ms' }}>
              Experience
            </h2>
            <p className="pp-exp__lead pp-reveal" style={{ '--d': '180ms' }}>
              A glimpse into my professional journey so far.
            </p>
          </div>
          <div className="pp-exp__line" ref={expLine} />
          <ol className="pp-exp__items">
            {experience.map((item, i) => (
              <li className="pp-exp__item pp-reveal" key={item.role} style={{ '--d': `${260 + i * 140}ms` }}>
                <span className="pp-exp__node" ref={(el) => (expNodes.current[i] = el)} />
                <span className="pp-exp__date">
                  <CalendarIcon />
                  {item.date}
                </span>
                <h3 className="pp-exp__role">{item.role}</h3>
              </li>
            ))}
          </ol>
        </section>

        <section className="pp-ach" ref={ach} data-active="false" aria-labelledby="pp-ach-title">
          <SilverDefs />
          <div className="pp-ach__mark pp-reveal" style={{ '--d': '0ms' }} aria-hidden="true">
            <span />
            <svg viewBox="0 0 24 24">
              <path d="M12 1.5c.8 6.2 4.3 9.7 10.5 10.5-6.2.8-9.7 4.3-10.5 10.5C11.2 16.3 7.7 12.8 1.5 12 7.7 11.2 11.2 7.7 12 1.5z" />
            </svg>
            <span />
          </div>
          <h2 className="pp-ach__title pp-reveal" id="pp-ach-title" style={{ '--d': '80ms' }}>
            Achievements
          </h2>
          <p className="pp-ach__lead pp-reveal" style={{ '--d': '160ms' }}>
            Milestones that fuel my journey
          </p>
          <ul className="pp-ach__cards">
            {achievements.map((a, i) => (
              <li className="pp-ach__card pp-reveal" key={`${a.date}-${a.venue}`} style={{ '--d': `${240 + i * 90}ms` }}>
                <span className="pp-ach__art">
                  <MilestoneIcon name={a.icon} />
                </span>
                <span className="pp-ach__body">
                  <span className="pp-ach__date">{a.date}</span>
                  <span className="pp-ach__what">
                    <strong>{a.result}</strong> {a.event}
                  </span>
                  {a.detail && <span className="pp-ach__detail">{a.detail}</span>}
                  <span className="pp-ach__detail">({a.venue})</span>
                </span>
                <span className="pp-ach__rule" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </section>

        <div className="pp-contact" ref={contact} data-active="false">
          <div className="pp-contact__card" ref={card}>
            <p className="pp-contact__kicker">Get in touch</p>
            <a className="pp-contact__email" href={`mailto:${site.email}`}>
              {site.email}
            </a>
            <p className="pp-contact__alt">
              or reach out on{' '}
              <a href={site.linkedin} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </p>
          </div>
          <footer className="pp-footer">
            <p className="pp-footer__left">
              <Monogram />
              {site.name} - © {new Date().getFullYear()}
            </p>
            <p className="pp-footer__right">This website doesn’t use cookies.</p>
          </footer>
        </div>
      </div>

      <div className="pp-journey__content" style={{ height: `${T.end * 100}vh` }}>
        <p className="pp-based">Based in {site.basedIn}</p>
      </div>
    </section>
  );
}
