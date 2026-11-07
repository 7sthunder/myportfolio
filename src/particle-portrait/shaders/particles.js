// Shaders for the portrait point cloud. Written as plain strings so they work in any bundler
// (Vite, Next.js, CRA) without raw-loader configuration.

const common = /* glsl */ `
  #define PI 3.141592653589793
  #define TAU 6.283185307179586

  float easeInOutCubic(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;
  }
`;

// Depth of field + size model shared by the portrait and the ambient dust.
const pointSizeChunk = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uMinSize;
  uniform float uMaxSize;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uBlur;

  // Returns vec2(pointSize, energy) and writes softness (0 = crisp, 1 = bokeh disc).
  vec2 dofPoint(float dist, float sizeRand, out float soft) {
    // Crisp size never drops below uMinSize device px: smaller points miss pixel centres and
    // flicker. Energy only accounts for real defocus (circle of confusion).
    float sharp = max(uSize * uPixelRatio * (0.6 + 1.25 * sizeRand * sizeRand) * (uFocus / dist), uMinSize);
    float coc = (uAperture * abs(1.0 - uFocus / dist) + uBlur) * uPixelRatio;
    float size = sharp + coc;
    // Energy conservation: a defocused point spreads the same light over a larger disc.
    float ratio = sharp / size;
    float energy = ratio * ratio;
    size = min(size, uMaxSize);
    soft = clamp(coc / size, 0.0, 1.0);
    return vec2(size, energy);
  }
`;

export const particleVertex = /* glsl */ `
  ${common}
  ${pointSizeChunk}

  uniform float uTime;
  uniform vec2 uViewport;
  uniform float uTanHalfFov;
  uniform float uAspect;

  uniform float uIntro;
  uniform float uFormation;
  uniform vec3 uScatterScale;
  uniform vec3 uScatterOffset;

  uniform float uMorph;
  uniform float uSwirl;
  uniform float uSpherePhase;
  uniform vec3 uBands; // x = count, y = top (local y), z = band height
  uniform float uBandSphere[8]; // mean globe latitude of each slice

  uniform float uDrift;

  uniform sampler2D uField;
  uniform float uFieldEnabled;
  uniform float uFieldPush;
  uniform float uFieldGlow;

  uniform vec2 uPointer;
  uniform float uPointerLight;
  uniform float uLightRadius;

  uniform float uRim;
  uniform float uFeature;
  uniform float uDepthFade;
  uniform float uBrightness;

  // Journey after the globe (see journey.js and ParticlePortrait.updateJourney).
  uniform float uSphereRadius;
  uniform float uMap;        // globe -> country map (local space)
  uniform float uMapScale;   // local units per normalised map unit
  uniform float uDna;        // map -> dust cloud -> twisted ribbon (world space)
  uniform vec3 uAxisOrigin;  // ribbon / coil axis
  uniform vec3 uAxisDir;
  uniform vec3 uAxisN1;
  uniform vec3 uAxisN2;
  uniform float uAxisLength;
  uniform float uRibbonWidth;
  uniform float uTwist;      // ribbon turns along the axis
  uniform float uFlow;       // ribbon / coil phase (time + scroll)
  uniform float uCoil;       // ribbon cross-section -> radial (coil bands)
  uniform float uCoilRadius;
  uniform float uLoops;
  uniform vec2 uHalf;        // half viewport size at z = 0 (world)
  uniform float uExp;        // tunnel -> experience timeline (line + orbs) and dunes
  uniform vec3 uLine;        // timeline: x, top y, bottom y (world)
  uniform vec4 uNodes;       // timeline orbs: xy, zw (world)
  uniform float uNodeR;
  uniform float uAch;        // experience -> achievements streak bands + orbit
  uniform float uFrame;      // coil / tunnel -> contact frame
  uniform vec2 uFrameCenter;
  uniform vec2 uFrameHalf;
  uniform float uFrameBand;

  attribute vec4 aSphere;  // xyz = globe target, w = horizontal slice index
  attribute vec3 aScatter; // normalised intro position
  attribute vec4 aRandom;  // x = size, y = brightness, z = phase, w = stagger
  attribute vec4 aShade;   // x = rim, y = feature edges, z = matte, w = depth
  attribute vec4 aMap;     // xyz = country target (normalised), w = coastline
  attribute vec4 aJourney; // x = along, y = across, zw = gaussian jitter

  varying float vAlpha;
  varying float vSoft;
  varying float vTint;

  // Portrait -> globe. Each horizontal slice spins around the vertical axis (neighbouring slices
  // counter-rotate), flattens into a disc with differential "galaxy" rotation, then settles on
  // its latitude band of the sphere. Exactly the identity at m = 0 and the sphere at m = 1.
  vec3 toSphere(vec3 p, float m, out float w) {
    float band = aSphere.w;
    float bandT = band / max(uBands.x - 1.0, 1.0);
    float t = clamp((m - bandT * 0.2 - aRandom.w * 0.08) / 0.72, 0.0, 1.0);
    float e = easeInOutCubic(t);
    w = sin(PI * t);

    float rp = length(p.xz);
    float thp = atan(p.z, p.x);
    vec3 s = aSphere.xyz;
    float rs = length(s.xz);
    float ths = atan(s.z, s.x) + uSpherePhase;

    float dir = mod(band, 2.0) < 0.5 ? 1.0 : -1.0;
    float spiral = w * dir * (uSwirl + 1.1 / (0.32 + rp));
    float th = mix(thp, ths + TAU * dir, e) + spiral;
    // Slices travel to their globe latitude early as compact discs, but keep the portrait's
    // proportions (small head discs, wide shoulder disc) until they settle onto the rings.
    float r = mix(rp, rs, smoothstep(0.4, 0.95, t)) * (1.0 + 0.12 * w);

    float k = smoothstep(0.12, 0.75, t);
    float center = mix(uBands.y - (band + 0.5) * uBands.z, uBandSphere[int(band + 0.5)], k);
    float y = mix(p.y, s.y, k);
    float squash = smoothstep(0.15, 0.4, t) * (1.0 - smoothstep(0.88, 1.0, t));
    y = mix(y, center + (y - center) * 0.18, squash * 0.95);
    return vec3(r * cos(th), y, r * sin(th));
  }

  // Globe -> country. The globe is cut into horizontal slices that squash into thin discs and
  // twist a little, then every particle glides to its spot on the map (matched by height, so
  // the northern slices become the north of the country).
  vec3 toMap(vec3 p, float m) {
    const float SLICES = 6.0;
    float sl = clamp(floor((aSphere.y / uSphereRadius * 0.5 + 0.5) * SLICES), 0.0, SLICES - 1.0);
    float order = (SLICES - 1.0 - sl) / (SLICES - 1.0);
    float t = clamp((m - order * 0.16 - aRandom.w * 0.08) / 0.76, 0.0, 1.0);
    float center = ((sl + 0.5) / SLICES * 2.0 - 1.0) * uSphereRadius;
    float squash = smoothstep(0.0, 0.3, t);
    vec3 s = p;
    s.y = mix(p.y, center + (p.y - center) * 0.2, squash);
    float spin = sin(PI * smoothstep(0.0, 0.7, t)) * (mod(sl, 2.0) < 0.5 ? 0.55 : -0.55);
    float cs = cos(spin);
    float sn = sin(spin);
    s.xz = mat2(cs, sn, -sn, cs) * s.xz;
    vec3 target = vec3(aMap.xy, aMap.z) * uMapScale;
    return mix(s, target, easeInOutCubic(smoothstep(0.22, 1.0, t)));
  }

  // Twisted ribbon along an axis; as uCoil grows the ribbon winds into a coil (helix of radius
  // uCoilRadius) whose bands face the axis, so looking down the axis reads as a tunnel.
  vec3 ribbonPoint(out float edgeOn) {
    float u = aJourney.x;
    float th = u * uTwist * TAU + uFlow;
    float phi = u * uLoops * TAU + uFlow * 0.6;
    vec3 twistAcross = uAxisN1 * cos(th) + uAxisN2 * sin(th);
    vec3 radial = uAxisN1 * cos(phi) + uAxisN2 * sin(phi);
    vec3 across = normalize(mix(twistAcross, radial, uCoil) + vec3(1e-4));
    vec3 normal = normalize(cross(uAxisDir, across) + vec3(1e-4));
    vec3 center = uAxisOrigin + uAxisDir * (u * uAxisLength) + radial * uCoilRadius;
    // The flat ribbon catches more light where it turns edge-on to the viewer.
    edgeOn = 1.0 - abs(normal.z);
    return center + across * (aJourney.y * uRibbonWidth) + normal * (aJourney.z * uRibbonWidth * 0.045);
  }

  // Point on the contact frame (rounded band around a rectangle), ordered by angle around the
  // frame centre so the tunnel collapses onto it radially. xy = point, zw = outward normal.
  vec4 rectPoint(float q, vec2 h) {
    float d = q * 4.0 * (h.x + h.y);
    if (d < h.y) return vec4(h.x, d, 1.0, 0.0);
    d -= h.y;
    if (d < 2.0 * h.x) return vec4(h.x - d, h.y, 0.0, 1.0);
    d -= 2.0 * h.x;
    if (d < 2.0 * h.y) return vec4(-h.x, h.y - d, -1.0, 0.0);
    d -= 2.0 * h.y;
    if (d < 2.0 * h.x) return vec4(-h.x + d, -h.y, 0.0, -1.0);
    d -= 2.0 * h.x;
    return vec4(h.x, -h.y + d, 1.0, 0.0);
  }

  vec3 framePoint(vec3 from) {
    vec2 rel = from.xy - uFrameCenter;
    // Ordered by angle so a centred shape collapses radially; from the corner currents of the
    // achievements every particle takes its own slot instead, so the band fills evenly.
    float q = fract(atan(rel.y, rel.x) / TAU + 1.0);
    q = mix(q, fract(aJourney.x * 17.31 + aRandom.w), step(0.5, uAch));
    vec4 e = rectPoint(q, uFrameHalf);
    // Band: even fill across its width with a soft, fuzzy outer edge; slightly heavier on the
    // right side, like the reference's perspective.
    float band = uFrameBand * (1.0 + 0.25 * smoothstep(-uFrameHalf.x, uFrameHalf.x, e.x));
    float across = (fract(aJourney.x * 37.13 + aRandom.z) - 0.5) * band + abs(aJourney.w) * band * 0.16;
    return vec3(uFrameCenter + e.xy + e.zw * across, aJourney.z * 0.02);
  }

  // A soft band of particles along a quadratic curve (p0 -> p2, bent towards p1). s is the
  // offset across the band in band widths; the band ripples slowly, like drifting sand.
  vec3 bandPoint(vec2 p0, vec2 p1, vec2 p2, float a, float width, float s, float seed) {
    vec2 c = mix(mix(p0, p1, a), mix(p1, p2, a), a);
    vec2 d = normalize(2.0 * (1.0 - a) * (p1 - p0) + 2.0 * a * (p2 - p1) + vec2(1e-5));
    vec2 n = vec2(-d.y, d.x);
    float ripple = sin(a * 13.0 + uTime * 0.45 + seed) * 0.3 + sin(a * 29.0 - uTime * 0.6 + seed * 2.0) * 0.12;
    return vec3(c + n * width * (s + ripple), aJourney.z * 0.45);
  }

  // Experience: a crisp vertical timeline, a glittering orb on each role, and a dune of sand
  // sweeping from the left edge along the bottom of the screen. glow = brightness factor.
  vec3 experiencePoint(out float glow) {
    float u = aJourney.x;
    float h = fract(u * 91.7 + aRandom.z * 13.1);
    if (u < 0.045) {
      glow = 1.5 * smoothstep(0.0, 0.2, h) * (1.0 - smoothstep(0.8, 1.0, h)) + 0.1;
      return vec3(uLine.x + aJourney.w * uNodeR * 0.02, mix(uLine.z, uLine.y, h), aJourney.z * 0.02);
    }
    if (u < 0.1) {
      vec2 c = h < 0.5 ? uNodes.xy : uNodes.zw;
      float th = fract(h * 37.9) * TAU;
      float cz = fract(u * 113.3) * 2.0 - 1.0;
      vec3 dir = vec3(sqrt(1.0 - cz * cz) * vec2(cos(th), sin(th)), cz);
      float shell = step(fract(u * 53.1), 0.55);
      float r = uNodeR * mix(1.0 + abs(aJourney.w) * 1.4, pow(fract(u * 7.7), 0.25), shell);
      glow = mix(0.7, 1.7, shell);
      return vec3(c, 0.0) + dir * r * vec3(1.0, 1.0, 0.4);
    }
    float a = pow(fract(u * 7.31), 1.25);
    vec2 hw = uHalf;
    glow = 0.95;
    return bandPoint(vec2(-1.2 * hw.x, 0.05 * hw.y), vec2(-0.5 * hw.x, -1.35 * hw.y), vec2(1.2 * hw.x, -0.75 * hw.y),
      a, hw.y * 0.17, aJourney.w * 0.55 - 0.15, 0.0);
  }

  // Achievements: streaky particle currents in the top-left and bottom-right corners and a
  // faint tilted orbit around the title.
  vec3 achievementPoint(out float glow) {
    float u = aJourney.x;
    float h = fract(u * 91.7 + aRandom.z * 13.1);
    vec2 hw = uHalf;
    if (u < 0.07) {
      float t = h * TAU;
      vec2 e = vec2(cos(t) * 0.74 * hw.x, sin(t) * 0.66 * hw.y);
      float r = -0.2;
      e = mat2(cos(r), sin(r), -sin(r), cos(r)) * e;
      glow = 0.45;
      return vec3(e + vec2(0.0, 0.08 * hw.y) + aJourney.w * 0.008, aJourney.z * 0.03);
    }
    // Streaks: the edge-weighted across value draws distinct strands inside each current.
    float s = aJourney.y * 0.5 + aJourney.w * 0.18;
    if (u < 0.52) {
      float a = fract(u * 5.17);
      glow = 1.15;
      return bandPoint(vec2(-1.2 * hw.x, 0.72 * hw.y), vec2(-0.45 * hw.x, 0.58 * hw.y), vec2(0.12 * hw.x, 1.15 * hw.y),
        a, hw.y * 0.1, s, 2.0);
    }
    float a = fract(u * 3.73);
    glow = 1.0;
    return bandPoint(vec2(-0.2 * hw.x, -1.2 * hw.y), vec2(0.45 * hw.x, -0.72 * hw.y), vec2(1.2 * hw.x, -0.7 * hw.y),
      a, hw.y * 0.13, s, 4.0);
  }

  void main() {
    float ph = aRandom.z * TAU;

    // Idle motion: tiny, independent per particle (looser on soft hair edges).
    vec3 drift = vec3(
      sin(uTime * 0.55 + ph * 3.0) + 0.5 * sin(uTime * 1.31 + ph * 7.0),
      cos(uTime * 0.47 + ph * 2.0) + 0.5 * cos(uTime * 1.07 + ph * 5.0),
      sin(uTime * 0.39 + ph * 4.0)
    ) * uDrift * (0.35 + aRandom.x * 0.65 + (1.0 - aShade.z) * 1.6);

    vec3 local = position + drift;
    float discW = 0.0;
    if (uMorph > 0.0001) local = toSphere(local, uMorph, discW);
    if (uMap > 0.0001) local = toMap(local, uMap);

    vec4 world = modelMatrix * vec4(local, 1.0);

    // Map -> ribbon (world space): the map defocuses and spreads into a long drifting cloud
    // around the ribbon, which then condenses onto it. Later the ribbon winds into a coil /
    // tunnel and finally collapses onto the contact frame.
    float edgeOn = 0.0;
    if (uDna > 0.0001) {
      vec3 ribbon = ribbonPoint(edgeOn);
      float t = clamp((uDna - aRandom.w * 0.14) / 0.86, 0.0, 1.0);
      float leave = smoothstep(0.0, 0.55, t);
      float settle = smoothstep(0.3, 1.0, t);
      vec3 cloud = aScatter * vec3(2.6, 0.75, 1.0) * uRibbonWidth * 1.6 * (1.0 - settle);
      cloud += vec3(
        sin(uTime * 0.3 + ph * 3.0),
        cos(uTime * 0.27 + ph * 2.0),
        sin(uTime * 0.23 + ph * 5.0)
      ) * 0.06 * sin(PI * t);
      world.xyz = mix(world.xyz, ribbon + cloud, easeInOutCubic(leave));
      edgeOn *= settle;
    }
    float shapeGlow = 1.0;
    if (uExp > 0.0001) {
      float g;
      vec3 target = experiencePoint(g);
      float t = easeInOutCubic(clamp((uExp - aRandom.w * 0.2) / 0.8, 0.0, 1.0));
      world.xyz = mix(world.xyz, target, t);
      shapeGlow = mix(1.0, g, t);
      edgeOn *= 1.0 - t;
    }
    if (uAch > 0.0001) {
      float g;
      vec3 target = achievementPoint(g);
      float t = easeInOutCubic(clamp((uAch - aRandom.w * 0.2) / 0.8, 0.0, 1.0));
      world.xyz = mix(world.xyz, target, t);
      shapeGlow = mix(shapeGlow, g, t);
    }
    if (uFrame > 0.0001) {
      float t = clamp((uFrame - aRandom.w * 0.18) / 0.82, 0.0, 1.0);
      world.xyz = mix(world.xyz, framePoint(world.xyz), easeInOutCubic(t));
    }

    // Formation: dust -> portrait. Particles contract almost in unison (small stagger), so the
    // cloud reads as an out-of-focus silhouette that tightens and sharpens, as in the reference.
    float f = clamp((uFormation - aRandom.w * 0.16) / 0.84, 0.0, 1.0);
    float ef = f * f * (3.0 - 2.0 * f);
    if (ef < 0.9999) {
      vec3 sc = uScatterOffset + aScatter * uScatterScale;
      sc += vec3(
        sin(uTime * 0.21 + ph * 5.0),
        cos(uTime * 0.17 + ph * 3.0),
        sin(uTime * 0.13 + ph * 2.0)
      ) * uScatterScale.y * 0.04;
      vec3 travel = world.xyz - sc;
      float side = fract(aRandom.z * 13.7 + aRandom.w * 5.3) - 0.5;
      vec3 curve = vec3(-travel.y, travel.x, 0.0) * 0.16 * sin(PI * ef) * side;
      world.xyz = mix(sc, world.xyz, ef) + curve;
    }

    vec4 mv = viewMatrix * world;
    float dist = max(-mv.z, 0.05);

    // Cursor interaction field (screen space): parting + sparkle along the cursor path.
    float glow = 0.0;
    if (uFieldEnabled > 0.5) {
      vec4 clip = projectionMatrix * mv;
      vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
      vec4 field = texture2D(uField, uv);
      float a = (aRandom.z - 0.5) * 1.7;
      float ca = cos(a);
      float sa = sin(a);
      vec2 push = vec2(ca * field.g - sa * field.b, sa * field.g + ca * field.b) * (0.4 + aRandom.x * 1.2);
      float unitsPerPx = 2.0 * dist * uTanHalfFov / uViewport.y;
      mv.xy += push * uFieldPush * uPixelRatio * unitsPerPx;
      mv.z += length(field.gb) * uFieldPush * uPixelRatio * unitsPerPx * (aRandom.y - 0.35) * 1.5;
      glow = field.r;
    }

    gl_Position = projectionMatrix * mv;
    dist = max(-mv.z, 0.05);

    float soft;
    vec2 pe = dofPoint(dist, aRandom.x, soft);
    gl_PointSize = pe.x;
    vSoft = soft;

    // Brightness: exponential distribution measured from the reference — a faint fill,
    // ~20% clearly visible specks and ~1-2% bright sparks — boosted along contours.
    // Portrait shading (rim, features, matte, depth) fades out once the cloud leaves the globe.
    float post = smoothstep(0.0, 0.6, max(uMap, uDna));
    float rim = aShade.x * (1.0 - post);
    float b = 0.003 + 0.085 * -log(1.0 - 0.9995 * aRandom.y);
    b *= 1.0 + uRim * rim * rim + uFeature * aShade.y * (1.0 - post);
    b *= mix(mix(0.75, 1.0, aShade.z), 1.0, post);
    b *= mix(mix(1.0 - uDepthFade, 1.0, aShade.w), 1.0, post);
    b *= 1.0 + 0.6 * discW;
    b *= 1.0 + post * (0.55 + 0.5 * aMap.w * (1.0 - smoothstep(0.0, 0.4, uDna)));
    b *= 1.0 + 0.9 * edgeOn * edgeOn * (1.0 - uCoil);
    b *= mix(shapeGlow, 1.0, uFrame);
    b *= 0.86 + 0.14 * sin(uTime * (0.6 + aRandom.z * 2.4) + ph * 9.0);

    // The cursor doubles as a soft light: contours facing it catch more light.
    vec2 ndc = gl_Position.xy / gl_Position.w;
    vec2 dl = (ndc - uPointer) * vec2(uAspect, 1.0);
    float light = exp(-dot(dl, dl) / (uLightRadius * uLightRadius));
    b *= 1.0 + uPointerLight * light * (0.35 + 1.1 * rim);
    b += glow * uFieldGlow * (0.35 + aRandom.y);

    // While scattered only a sparse subset reads as floating dust (plus near-lens bokeh);
    // everything else fades in as the cloud contracts.
    float lens = step(0.25, aScatter.z); // near-lens particles become bokeh discs
    float dustMote = max(step(fract(aRandom.z * 7.31 + aRandom.w * 3.17), 0.05), lens);
    float visible = mix(dustMote * 2.2, 1.0, smoothstep(0.1, 0.65, ef));
    float appear = smoothstep(aRandom.z * 0.65, aRandom.z * 0.65 + 0.35, uIntro);
    float bokeh = 1.0 + lens * (1.0 - ef) * 28.0;
    vAlpha = b * pe.y * bokeh * uBrightness * appear * visible;
    vTint = aRandom.y;
  }
`;

export const particleFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColorAlt;

  varying float vAlpha;
  varying float vSoft;
  varying float vTint;

  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float r = sqrt(r2);
    // Crisp particles: soft-edged dot (keeps energy at 1-3px sizes) with a faint glow halo.
    // Defocused particles: flat bokeh disc.
    float speck = 1.0 - smoothstep(0.3, 1.0, r);
    float crisp = speck * 0.85 + exp(-r2 * 3.0) * 0.15;
    float disc = 1.0 - smoothstep(0.72, 1.0, r);
    float shape = mix(crisp, disc * 0.9, smoothstep(0.12, 0.65, vSoft));
    float a = shape * vAlpha;
    if (a < 0.0012) discard;
    gl_FragColor = vec4(mix(uColorAlt, uColor, vTint), a);
  }
`;

export const dustVertex = /* glsl */ `
  ${common}
  ${pointSizeChunk}

  uniform float uTime;
  uniform float uIntro;
  uniform float uOpacity;
  uniform vec3 uScale;

  attribute vec4 aRandom;

  varying float vAlpha;
  varying float vSoft;
  varying float vTint;

  void main() {
    float ph = aRandom.z * TAU;
    vec3 p = position;
    p.x += sin(uTime * (0.03 + aRandom.x * 0.05) + ph) * 0.06;
    p.y += sin(uTime * (0.02 + aRandom.y * 0.04) + ph * 1.7) * 0.08 + uTime * 0.004 * (aRandom.w - 0.5);
    p.y = mod(p.y + 1.2, 2.4) - 1.2;
    vec4 mv = viewMatrix * vec4(p * uScale, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(-mv.z, 0.05);
    float soft;
    vec2 pe = dofPoint(dist, aRandom.x, soft);
    gl_PointSize = pe.x;
    vSoft = soft;
    float twinkle = 0.7 + 0.3 * sin(uTime * (0.4 + aRandom.y) + ph * 5.0);
    float appear = smoothstep(aRandom.w * 0.7, aRandom.w * 0.7 + 0.3, uIntro);
    float bokeh = 1.0 + step(0.3, position.z) * 30.0;
    vAlpha = mix(0.08, 0.32, pow(aRandom.y, 2.0)) * pe.y * bokeh * twinkle * appear * uOpacity;
    vTint = aRandom.y;
  }
`;
