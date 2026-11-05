import { works } from '../data/works.js';

const base = import.meta.env.BASE_URL;

export default function FeaturedWorks() {
  return (
    <section className="pp-works" aria-labelledby="pp-works-title">
      <h2 className="pp-works__title" id="pp-works-title">
        My Featured Works
      </h2>

      <ul className="pp-works__grid">
        {works.map((work) => (
          <li className="pp-work" key={work.title}>
            <div className="pp-work__shot">
              <img src={`${base}${work.shot}`} alt={work.shotAlt} loading="lazy" decoding="async" />
            </div>
            <div className="pp-work__body">
              <p className="pp-work__label">
                {work.label}
                {work.status && <span className="pp-work__status"> · {work.status}</span>}
              </p>
              <h3 className="pp-work__name">{work.title}</h3>
              <p className="pp-work__blurb">{work.blurb}</p>
              <p className="pp-work__tags">{work.tags.join(' · ')}</p>
              {work.live && (
                <a className="pp-work__link" href={work.live} target="_blank" rel="noreferrer">
                  View live
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
