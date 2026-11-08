import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { caseStudies } from '../data/caseStudies.js';
import { site } from '../data/site.js';
import { works } from '../data/works.js';

const Arrow = ({ flip }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Diagonal = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** One project's blog-style write-up at /projects/:slug. Text only, with the site's own styles. */
export default function CaseStudy() {
  const { slug } = useParams();
  const index = works.findIndex((w) => w.slug === slug);
  const work = works[index];
  const study = caseStudies[slug];

  useEffect(() => {
    if (!work) return;
    const previousTitle = document.title;
    document.title = `${work.title} · Aadhi Narayanan`;
    window.scrollTo(0, 0);
    return () => {
      document.title = previousTitle;
    };
  }, [work]);

  if (!work || !study) return <Navigate to="/" replace />;

  const prev = works[(index - 1 + works.length) % works.length];
  const next = works[(index + 1) % works.length];

  return (
    <div className="pp-case">
      <article className="pp-case__article">
        <Link className="pp-case__back" to="/">
          <Arrow flip /> Back to work
        </Link>

        <header className="pp-case__header">
          <p className="pp-case__kicker">{work.info}</p>
          <h1 className="pp-case__title">{work.title}</h1>
          <p className="pp-case__lead">{study.lead}</p>
          <ul className="pp-work__tags pp-case__tags" aria-label="Built with">
            {work.tags.map((tag) => (
              <li className="pp-work__tag" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
        </header>

        <div className="pp-case__body">
          {study.sections.map((section) => (
            <section className="pp-case__section" key={section.heading}>
              <h2 className="pp-case__heading">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p className="pp-case__text" key={paragraph}>
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="pp-case__list">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {work.live && (
          <a className="pp-work__link pp-case__live" href={work.live} target="_blank" rel="noreferrer">
            Visit live site
            <Diagonal />
          </a>
        )}
      </article>

      <nav className="pp-case__pager" aria-label="More projects">
        <Link className="pp-case__pager-link" to={`/projects/${prev.slug}`}>
          <span className="pp-case__pager-label">
            <Arrow flip /> Previous project
          </span>
          <span className="pp-case__pager-title">{prev.title}</span>
        </Link>
        <Link className="pp-case__pager-link pp-case__pager-link--next" to={`/projects/${next.slug}`}>
          <span className="pp-case__pager-label">
            Next project <Arrow />
          </span>
          <span className="pp-case__pager-title">{next.title}</span>
        </Link>
      </nav>

      <footer className="pp-case__footer">
        <p>
          {site.name} © {new Date().getFullYear()}
        </p>
        <p>
          <a href={`mailto:${site.email}`}>Get in touch</a>
        </p>
      </footer>
    </div>
  );
}
