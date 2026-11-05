import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ParticlePortrait } from '../particle-portrait/index.js';

const base = import.meta.env.BASE_URL;

const PortraitContext = createContext(null);

/** The shared particle portrait; null until the background mounts. */
export function usePortrait() {
  return useContext(PortraitContext);
}

/**
 * One fixed, full-page particle layer behind every section. Sections are text layers on top;
 * the particles change shape through `portrait.state` (shift, morph, work) as the page scrolls.
 */
export default function ParticleBackground({ children }) {
  const stage = useRef(null);
  const [portrait, setPortrait] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const instance = new ParticlePortrait(stage.current, {
      map: `${base}portrait/portrait-map.png`,
      meta: `${base}portrait/portrait-map.json`,
      count: params.has('count') ? Number(params.get('count')) : null,
    });
    setPortrait(instance);
    if (import.meta.env.DEV || params.has('debug')) {
      window.__pp = { ...window.__pp, portrait: instance };
    }
    return () => {
      instance.dispose();
      setPortrait(null);
      if (window.__pp) delete window.__pp.portrait;
    };
  }, []);

  return (
    <PortraitContext.Provider value={portrait}>
      <div className="pp-background" ref={stage} aria-hidden="true" />
      {children}
    </PortraitContext.Provider>
  );
}
