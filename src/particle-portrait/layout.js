import { LOCAL_HEIGHT } from './sampling.js';

/**
 * Composition targets measured from the reference video (fractions of the viewport).
 * hero  : head top at 11.5% from the top, bust cropped by the bottom edge, head centred.
 * about : bust grows ~1.22x and slides right (head centre ~67% across, top ~2%).
 * globe : sphere centred, diameter ~80% of the viewport height.
 */
export const DEFAULT_COMPOSITION = {
  hero: { top: 0.115, bottom: 1.035, maxWidth: 0.78 },
  heroNarrow: { bottom: 1.0, maxWidth: 1.2, maxHeight: 0.62 },
  about: { scale: 1.22, centerX: 0.67, top: 0.02 },
  aboutNarrow: { scale: 1.06, bottom: 1.08 },
  globe: { radius: 0.4, maxRadiusWidth: 0.36, maxRadiusWidthNarrow: 0.37 },
  narrowAspect: 0.85,
};

/**
 * Computes world-space group transforms for each scroll state.
 * The camera looks down -Z from (0, 0, cameraZ); the portrait group sits on z = 0.
 */
export function computeLayout({
  width,
  height,
  fov,
  cameraZ,
  meta,
  headTop, // local y of the top of the hair
  sphereRadius, // local radius of the globe
  composition = DEFAULT_COMPOSITION,
}) {
  const c = composition;
  const wpp = (2 * cameraZ * Math.tan((fov * Math.PI) / 360)) / height; // world units per CSS px at z = 0
  const aspect = width / height;
  const narrow = aspect < c.narrowAspect;
  const anchors = meta.anchors;

  const worldY = (fromTop) => (0.5 - fromTop) * height * wpp;
  const worldX = (fromLeft) => (fromLeft - 0.5) * width * wpp;

  const bottom = -LOCAL_HEIGHT / 2; // local y of the photo's bottom crop
  const mapAspect = meta.map.width / meta.map.height;
  const subjectWidth = (anchors.subjectRight - anchors.subjectLeft) * mapAspect * LOCAL_HEIGHT;
  const subjectHeight = headTop - bottom;

  let hero;
  if (!narrow) {
    const h = c.hero;
    const byHeight = ((h.bottom - h.top) * height * wpp) / subjectHeight;
    const byWidth = (h.maxWidth * width * wpp) / subjectWidth;
    const s = Math.min(byHeight, byWidth);
    hero = { x: 0, y: worldY(h.bottom) - bottom * s, s };
  } else {
    const h = c.heroNarrow;
    const byWidth = (h.maxWidth * width * wpp) / subjectWidth;
    const byHeight = (h.maxHeight * height * wpp) / subjectHeight;
    const s = Math.min(byWidth, byHeight);
    hero = { x: 0, y: worldY(h.bottom) - bottom * s, s };
  }

  let about;
  if (!narrow) {
    const a = c.about;
    const s = hero.s * a.scale;
    about = { x: worldX(a.centerX), y: worldY(a.top) - headTop * s, s };
  } else {
    const a = c.aboutNarrow;
    const s = hero.s * a.scale;
    about = { x: 0, y: worldY(a.bottom) - bottom * s, s };
  }

  const g = c.globe;
  const radiusPx = Math.min(g.radius * height, (narrow ? g.maxRadiusWidthNarrow : g.maxRadiusWidth) * width);
  const globe = { x: 0, y: 0, s: (radiusPx * wpp) / sphereRadius, radiusPx };

  return { wpp, aspect, narrow, hero, about, globe, halfHeight: height * wpp * 0.5, halfWidth: width * wpp * 0.5 };
}
