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
  uniform float uWork;
  uniform float uHelixTime;
  uniform float uHelixRadius;
  uniform float uHelixLength;
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

  attribute vec4 aSphere;  // xyz = globe target, w = horizontal slice index
  attribute vec3 aScatter; // normalised intro position
  attribute vec4 aRandom;  // x = size, y = brightness, z = phase, w = stagger
  attribute vec4 aShade;   // x = rim, y = feature edges, z = matte, w = depth

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

    // Works section: the cloud gathers into a double helix (DNA) along the vertical axis. Each
    // particle is pinned to one of two strands (aRandom.w picks the strand, aRandom.z the slot
    // along the helix) and the strands wind with uHelixTime, so the whole field turns as the
    // visitor scrolls. Blended by uWork, so the globe/portrait states are unchanged at uWork = 0.
    if (uWork > 0.0001) {
      float strand = step(0.5, fract(aRandom.w * 17.3));
      float along = (fract(aRandom.z * 31.7) - 0.5) * uHelixLength;
      float angle = along * 4.2 + uHelixTime + strand * PI;
      float radius = uHelixRadius * (0.96 + 0.08 * fract(aRandom.x * 9.1));
      vec3 helix = vec3(cos(angle) * radius, along, sin(angle) * radius * 0.35);
      local = mix(local, helix, smoothstep(0.0, 1.0, uWork));
    }

    vec4 world = modelMatrix * vec4(local, 1.0);

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
    float rim = aShade.x;
    float b = 0.003 + 0.085 * -log(1.0 - 0.9995 * aRandom.y);
    b *= 1.0 + uRim * rim * rim + uFeature * aShade.y;
    b *= mix(0.75, 1.0, aShade.z);
    b *= mix(1.0 - uDepthFade, 1.0, aShade.w);
    b *= 1.0 + 0.6 * discW;
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
