import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';
import { achievements, experience } from '../data/milestones.js';
import { site } from '../data/site.js';
import { works } from '../data/works.js';
import { splitText } from '../experience/text.js';
import { emphasiseEdges, rasteriseSection } from '../experience/glyphTargets.js';
import { CalendarIcon, MilestoneIcon, SilverDefs } from './MilestoneIcons.jsx';
import { usePortrait } from './ParticleBackground.jsx';
import WorkArt from './WorkArt.jsx';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll choreography after the globe, in viewport heights of scroll (1 = 100vh), measured from
 * the moment this section's top enters the bottom of the viewport (the globe is complete then):
 *
 *   globe -> map of India ("Based in India" scrolls past) -> map dissolves into a twisted ribbon
 *   (statement) -> the ribbon's particles draw the works one at a time (illustration + text),
 *   flying from one project straight into the next -> ribbon winds into a coil, then a tunnel
 *   ("And still working on plenty more.") -> the tunnel unravels into the experience timeline
 *   (glowing line + orbs) -> corner currents behind the achievements -> the frame of the
 *   contact card.
 */
const WORK_MOVE = 0.85; // scroll for one transition (ribbon -> project, project -> project, ...)
const WORK_HOLD = 0.45; // scroll a formed project stays put
const WORKS_SPAN = (works.length + 1) * WORK_MOVE + works.length * WORK_HOLD;
// Landing front of the works transitions (must match works() in the particle shader): a particle
// whose target sits at screen fraction x has landed once the transition is >= 0.5 x + 0.46.
const WORK_LAND = { slope: 0.5, start: 0.46 };
const SPELL_LAND = { slope: 0.55, start: 0.45 };
const T = (() => {
  const t = { mapIn: 0.02, mapDone: 1.05, dnaIn: 1.6, dnaDone: 2.9, statementIn: 2.55, statementOut: 3.45 };
  t.worksIn = 3.4;
  t.worksOut = t.worksIn + WORKS_SPAN;
  t.kickerIn = t.worksIn + 0.3;
  t.kickerOut = t.worksOut - 0.75;
  t.coilIn = t.worksOut - 0.95;
  t.coilDone = t.worksOut + 0.2;
  t.closingIn = t.worksOut - 0.45;
  t.tunnelIn = t.worksOut + 0.05;
  t.tunnelDone = t.worksOut + 1.3;
  t.closingOut = t.tunnelDone + 0.4;
  // Each milestone section: the scene forms, part of the particles assemble into the text and
  // elements, the real text fades in as they dissolve, and on the way out it turns back to dust.
  t.expIn = t.tunnelDone + 0.35;
  t.expDone = t.expIn + 1.0;
  t.expSpellIn = t.expDone - 0.4;
  t.expSpellDone = t.expSpellIn + 1.15;
  t.expOutIn = t.expSpellDone + 0.9;
  t.expOutDone = t.expOutIn + 0.8;
  t.achIn = t.expOutDone - 0.2;
  t.achDone = t.achIn + 1.0;
  t.achSpellIn = t.achDone - 0.4;
  t.achSpellDone = t.achSpellIn + 1.15;
  t.achOutIn = t.achSpellDone + 1.0;
  t.achOutDone = t.achOutIn + 0.8;
  t.frameIn = t.achOutDone - 0.2;
  t.frameDone = t.frameIn + 1.05;
  t.contactIn = t.frameIn + 0.65;
  t.end = t.frameDone + 0.35;
  return t;
})();

const pad = (n) => String(n).padStart(2, '0');

function WorkPanel({ work, index, panelRef }) {
  return (
    <li className="pp-work" ref={panelRef} data-active="false">
      <div className="pp-work__text">
        <p className="pp-work__kicker pp-reveal">
          {pad(index + 1)} <span aria-hidden="true">-</span> {work.info}
        </p>
        <h3 className="pp-work__title pp-reveal">{work.title}</h3>
        <p className="pp-work__summary pp-reveal">{work.summary}</p>
        <ul className="pp-work__tags pp-reveal" aria-label="Built with">
          {work.tags.map((tag) => (
            <li className="pp-work__tag" key={tag}>
              {tag}
            </li>
          ))}
        </ul>
        <div className="pp-work__actions">
          <Link className="pp-work__link pp-reveal" to={`/projects/${work.slug}`}>
            Read the case study
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {work.live && (
            <a className="pp-work__link pp-reveal" href={work.live} target="_blank" rel="noreferrer">
              Visit live site
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>
      </div>
      <div className="pp-work__art pp-reveal">
        <WorkArt name={work.art} />
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
  const panels = useRef([]);
  const closing = useRef(null);
  const contact = useRef(null);
  const card = useRef(null);
  const exp = useRef(null);
  const expLine = useRef(null);
  const expNodes = useRef([]);
  const ach = useRef(null);

  useEffect(() => {
    if (!portrait) return;
    const state = portrait.state;
    const reveal = [...splitText(contact.current.querySelector('.pp-contact__kicker')), ...splitText(contact.current.querySelector('.pp-contact__alt'))];
    reveal.forEach((el, i) => el.style.setProperty('--d', `${i * 18}ms`));
    portrait.frameElement = card.current;
    portrait.timelineAnchors = { line: expLine.current, nodes: expNodes.current };

    let alive = true;
    let building = false;
    let buildingWorks = false;
    let fontsReady = false;
    document.fonts.ready.then(() => (fontsReady = true));
    const onResize = () => {
      portrait.spellDirty = true;
      portrait.workDirty = true;
    };

    const partsOf = (el) => [...el.querySelectorAll('.pp-reveal')].map((part) => ({ el: part, css: '' }));
    const expParts = partsOf(exp.current);
    const achParts = partsOf(ach.current);
    const workParts = panels.current.map(partsOf);

    // Reveals content exactly where the particles have landed: a mask follows the landing front
    // of the particle sweep (land.start + land.slope * x, see the particle shader).
    const condense = (parts, amount, land = SPELL_LAND) => {
      const w = window.innerWidth;
      const front = ((amount - land.start) / land.slope) * w;
      const feather = 0.12 * w;
      for (const part of parts) {
        const r = part.el.getBoundingClientRect();
        const s = front - r.left;
        let css;
        if (amount <= 0 || s + feather <= 0) css = 'hidden';
        else if (s >= r.width) css = 'solid';
        else css = `linear-gradient(90deg, #000 ${s.toFixed(1)}px, transparent ${(s + feather).toFixed(1)}px)`;
        if (css === part.css) continue;
        part.css = css;
        const { style } = part.el;
        style.opacity = css === 'hidden' ? '0' : '1';
        const mask = css === 'hidden' || css === 'solid' ? '' : css;
        style.maskImage = mask;
        style.webkitMaskImage = mask;
      }
    };
    const fade = (parts, alpha) => {
      const css = alpha <= 0 ? 'hidden' : alpha >= 1 ? 'solid' : `fade ${alpha.toFixed(3)}`;
      for (const part of parts) {
        if (css === part.css) continue;
        part.css = css;
        const { style } = part.el;
        style.opacity = css === 'hidden' ? '0' : css === 'solid' ? '1' : alpha.toFixed(3);
        style.maskImage = '';
        style.webkitMaskImage = '';
      }
    };

    // Works: the formed project (k0) dissolves back into its particles first, then the next one
    // condenses where they land (see works() in the particle shader).
    const showWorks = () => {
      const k0 = Math.floor(state.work);
      const f = state.work - k0;
      workParts.forEach((parts, k) => {
        if (k === k0) fade(parts, 1 - gsap.utils.clamp(0, 1, f / 0.12));
        else if (k === k0 + 1) condense(parts, f, WORK_LAND);
        else fade(parts, 0);
        set(panels.current[k], (k === k0 && f < 0.1) || (k === k0 + 1 && f > 0.9));
      });
    };

    // Rasterises every project (illustration and text separately) from the live layout.
    const buildWorks = async () => {
      const origin = stage.current;
      const list = [];
      for (const panel of panels.current) {
        const [art, text] = await Promise.all([
          rasteriseSection(panel.querySelector('.pp-work__svg'), { origin }),
          rasteriseSection(panel, { origin, exclude: '.pp-work__art', outline: '.pp-work__tag, .pp-work__link' }),
        ]);
        const drawing = emphasiseEdges(art);
        list.push({ width: drawing.width, height: drawing.height, art: drawing.points, text: text.points });
      }
      return list;
    };

    const set = (el, on) => {
      const v = String(on);
      if (el.dataset.active !== v) el.dataset.active = v;
    };

    window.addEventListener('resize', onResize);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom bottom', scrub: 1 },
      });
      tl.to(state, { map: 1, duration: T.mapDone - T.mapIn }, T.mapIn)
        .to(state, { dna: 1, duration: T.dnaDone - T.dnaIn }, T.dnaIn)
        .to(state, { flow: 9, duration: T.frameIn - T.dnaIn }, T.dnaIn)
        .to(state, { coil: 1, duration: T.coilDone - T.coilIn }, T.coilIn)
        .to(state, { tunnel: 1, duration: T.tunnelDone - T.tunnelIn }, T.tunnelIn)
        .to(state, { experience: 1, duration: T.expDone - T.expIn }, T.expIn)
        .to(state, { expSpell: 1, duration: T.expSpellDone - T.expSpellIn }, T.expSpellIn)
        .to(state, { expSpell: 0, duration: T.expOutDone - T.expOutIn }, T.expOutIn)
        .to(state, { achievements: 1, duration: T.achDone - T.achIn }, T.achIn)
        .to(state, { achSpell: 1, duration: T.achSpellDone - T.achSpellIn }, T.achSpellIn)
        .to(state, { achSpell: 0, duration: T.achOutDone - T.achOutIn }, T.achOutIn)
        .to(state, { frame: 1, duration: T.frameDone - T.frameIn }, T.frameIn)
        .to({}, { duration: 0.001 }, T.end - 0.001);
      // Ribbon -> project 0 -> project 1 -> ... -> last project -> ribbon, one step per project.
      for (let k = 0; k <= works.length; k++) {
        tl.fromTo(
          state,
          { work: k - 1 },
          { work: k, duration: WORK_MOVE, immediateRender: false },
          T.worksIn + k * (WORK_MOVE + WORK_HOLD),
        );
      }

      const tick = () => {
        if (!root.current) return;
        const t = tl.time();
        set(statement.current, t >= T.statementIn && t < T.statementOut);
        set(kicker.current, t >= T.kickerIn && t < T.kickerOut);
        set(closing.current, t >= T.closingIn && t < T.closingOut);
        // The milestone sections are made of the particles: the solid content condenses exactly
        // where they have landed, so there is only ever one copy on screen.
        set(exp.current, state.expSpell > 0.5);
        set(ach.current, state.achSpell > 0.5);
        condense(expParts, state.expSpell);
        condense(achParts, state.achSpell);

        // Formation targets come from the live layout; rebuild them when it (or density) changes.
        if (!building && portrait.spellDirty && t > T.expIn - 0.6 && t < T.frameIn && fontsReady) {
          building = true;
          portrait.spellDirty = false;
          Promise.all([
            rasteriseSection(exp.current, { outline: '.pp-exp__date' }),
            rasteriseSection(ach.current, { outline: '.pp-ach__card', rule: '.pp-ach__rule, .pp-ach__mark span' }),
          ])
            .then(([e, a]) => {
              if (!alive) return;
              portrait.setSpellTargets(0, e);
              portrait.setSpellTargets(1, a);
            })
            .catch(() => {})
            .finally(() => (building = false));
        }
        set(contact.current, t >= T.contactIn);

        // Works targets are built once the visitor heads past the globe (not during the intro).
        if (!buildingWorks && portrait.workDirty && portrait.loaded && fontsReady && t > T.mapIn && t < T.worksOut) {
          buildingWorks = true;
          portrait.workDirty = false;
          buildWorks()
            .then((list) => alive && portrait.setWorkTargets(list))
            .catch(() => {})
            .finally(() => (buildingWorks = false));
        }
        set(stage.current, t > T.worksIn - 0.05 && t < T.worksOut + 0.05);
        showWorks();
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    });

    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      ctx.revert();
      if (portrait.frameElement === card.current) portrait.frameElement = null;
      portrait.timelineAnchors = null;
      Object.assign(state, { map: 0, dna: 0, flow: 0, work: -1, coil: 0, tunnel: 0, experience: 0, expSpell: 0, achievements: 0, achSpell: 0, frame: 0 });
    };
  }, [portrait]);

  return (
    <section className="pp-journey" ref={root} aria-label="About, works and contact">
      <div className="pp-journey__stage">
        <SilverDefs />
        <p className="pp-statement" ref={statement} data-active="false">
          I don’t just execute what’s handed to me. I bring my own creative instinct into the mix, pushing interactions,
          animation and visual ideas wherever they’d genuinely elevate the work.
        </p>

        <p className="pp-works__kicker" ref={kicker} data-active="false">
          Some selected works
        </p>

        <ol className="pp-works" ref={stage} data-active="false" aria-label="Selected works">
          {works.map((work, i) => (
            <WorkPanel key={work.title} work={work} index={i} panelRef={(el) => (panels.current[i] = el)} />
          ))}
        </ol>

        <p className="pp-closing" ref={closing} data-active="false">
          And still working on plenty more.
        </p>

        <section className="pp-exp" ref={exp} data-active="false" aria-labelledby="pp-exp-title">
          <div className="pp-exp__intro">
            <p className="pp-exp__kicker pp-reveal">
              My journey
            </p>
            <h2 className="pp-exp__title pp-reveal" id="pp-exp-title">
              Experience
            </h2>
            <p className="pp-exp__lead pp-reveal">
              A glimpse into my professional journey so far.
            </p>
          </div>
          <div className="pp-exp__line" ref={expLine} />
          <ol className="pp-exp__items">
            {experience.map((item, i) => (
              <li className="pp-exp__item pp-reveal" key={item.role}>
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
          <div className="pp-ach__mark pp-reveal" aria-hidden="true">
            <span />
            <svg viewBox="0 0 24 24">
              <path d="M12 1.5c.8 6.2 4.3 9.7 10.5 10.5-6.2.8-9.7 4.3-10.5 10.5C11.2 16.3 7.7 12.8 1.5 12 7.7 11.2 11.2 7.7 12 1.5z" />
            </svg>
            <span />
          </div>
          <h2 className="pp-ach__title pp-reveal" id="pp-ach-title">
            Achievements
          </h2>
          <p className="pp-ach__lead pp-reveal">
            Milestones that fuel my journey
          </p>
          <ul className="pp-ach__cards">
            {achievements.map((a, i) => (
              <li className="pp-ach__card pp-reveal" key={`${a.date}-${a.venue}`}>
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
              {site.name} © {new Date().getFullYear()}
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
