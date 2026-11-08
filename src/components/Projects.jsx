import { site } from '../data/site.js';
import { works } from '../data/works.js';

const Arrow = ({ className = 'pp-proj__arrow-icon' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Diagonal = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Star = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z" fill="currentColor" />
  </svg>
);

const featureIcons = [
  <path key="bolt" d="M13 2 5 13.5h6L10 22l8-11.5h-6z" />,
  <g key="grid">
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </g>,
  <g key="shield">
    <path d="M12 2.8 4.5 5.6v6c0 4.8 3.2 8.4 7.5 9.6 4.3-1.2 7.5-4.8 7.5-9.6v-6z" />
    <path d="m8.8 12 2.3 2.3 4.2-4.6" />
  </g>,
];

const at = (i) => works[(i + works.length) % works.length];

function Card({ slot, index, featured, cardRef, artRef, onSelect }) {
  const work = at(index);
  const isCenter = slot === 'current';
  const Link = work.live ? 'a' : 'span';
  const linkProps = work.live ? { href: work.live, target: '_blank', rel: 'noreferrer', 'aria-label': `Open ${work.title}` } : {};
  return (
    <article
      className={`pp-proj__card pp-proj__card--${slot} pp-reveal`}
      ref={cardRef}
      onClick={isCenter ? undefined : () => onSelect((index + works.length) % works.length)}
      aria-label={work.title}
    >
      {isCenter && (
        <span className="pp-proj__pill pp-proj__featured">
          <Star /> Featured
        </span>
      )}
      {/* The drawing is made of particles; this box only anchors it. */}
      <span className="pp-proj__art" ref={artRef} aria-hidden="true" />
      <div className="pp-proj__card-text" key={`${slot}-${featured}`}>
        <h3 className="pp-proj__card-title">{work.title}</h3>
        <p className="pp-proj__card-sub">{work.subtitle}</p>
      </div>
      <Link className="pp-proj__arrow" {...linkProps} onClick={(e) => e.stopPropagation()}>
        <Diagonal />
      </Link>
    </article>
  );
}

/**
 * Holographic projects showcase. Layout only: the particles (scene, text formation and the card
 * holograms) and the featured project are driven from Journey.jsx.
 */
export default function Projects({ sectionRef, featured, cardRefs, artRefs, onSelect }) {
  const work = works[featured];
  const slots = [
    ['prev', featured - 1],
    ['current', featured],
    ['next', featured + 1],
  ];
  return (
    <section className="pp-proj" ref={sectionRef} data-active="false" aria-labelledby="pp-proj-title">
      <div className="pp-proj__frame">
        <header className="pp-proj__head">
          <p className="pp-proj__kicker pp-reveal">My projects</p>
          <h2 className="pp-proj__title pp-reveal" id="pp-proj-title">
            Projects
          </h2>
          <p className="pp-proj__lead pp-reveal">
            Real-world solutions, built with passion.
            <br />
            Explore some of my key projects below.
          </p>
        </header>

        <a className="pp-proj__btn pp-proj__all pp-reveal" href={site.projectsUrl} target="_blank" rel="noreferrer">
          View All Projects <Arrow />
        </a>

        <div className="pp-proj__stage3d">
          {slots.map(([slot, index], i) => (
            <Card
              key={slot}
              slot={slot}
              index={index}
              featured={featured}
              cardRef={(el) => (cardRefs.current[i] = el)}
              artRef={(el) => (artRefs.current[i] = el)}
              onSelect={onSelect}
            />
          ))}
          <a className="pp-proj__card pp-proj__more pp-reveal" href={site.projectsUrl} target="_blank" rel="noreferrer">
            <span className="pp-proj__plus" aria-hidden="true" />
            More Projects
          </a>
        </div>

        <div className="pp-proj__panel pp-reveal">
          <div className="pp-proj__panel-main" key={`main-${featured}`}>
            <span className="pp-proj__pill">
              <Star /> Featured Project
            </span>
            <h3 className="pp-proj__name">{work.title}</h3>
            <p className="pp-proj__desc">{work.description}</p>
            <ul className="pp-proj__tags" aria-label="Tech stack">
              {work.tags.slice(0, 6).map((tag) => (
                <li className="pp-proj__tag" key={tag}>
                  {tag}
                </li>
              ))}
            </ul>
          </div>
          <span className="pp-proj__divider" aria-hidden="true" />
          <ul className="pp-proj__features" key={`features-${featured}`}>
            {work.features.map((feature, i) => (
              <li key={feature}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {featureIcons[i % featureIcons.length]}
                </svg>
                {feature}
              </li>
            ))}
          </ul>
          {work.live ? (
            <a className="pp-proj__btn pp-proj__view" href={work.live} target="_blank" rel="noreferrer" key={`view-${featured}`}>
              View Project <Arrow />
            </a>
          ) : (
            <span className="pp-proj__btn pp-proj__view pp-proj__view--private" key={`view-${featured}`}>
              Private build
            </span>
          )}
        </div>

        <ol className="pp-proj__dots" aria-hidden="true">
          {works.map((w, i) => (
            <li key={w.title} data-on={i === featured} />
          ))}
        </ol>
      </div>
    </section>
  );
}
