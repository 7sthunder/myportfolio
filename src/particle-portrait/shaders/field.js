// Full-screen triangle vertex shader (no matrices needed).
export const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Cursor trail field. R = intensity, GB = displacement vector (screen space, aspect-correct).
// Each frame the previous state decays and the swept capsule from the last to the current
// pointer position is stamped in, so fast strokes leave a continuous wake.
export const fieldFragment = /* glsl */ `
  uniform sampler2D uPrev;
  uniform vec2 uFrom;
  uniform vec2 uTo;
  uniform float uAspect;
  uniform float uRadius;
  uniform float uStrength;
  uniform float uDecay;

  varying vec2 vUv;

  void main() {
    vec4 prev = texture2D(uPrev, vUv);
    prev.r *= uDecay;
    prev.gb *= uDecay;

    vec2 asp = vec2(uAspect, 1.0);
    vec2 p = vUv * asp;
    vec2 a = uFrom * asp;
    vec2 b = uTo * asp;
    vec2 ba = b - a;
    vec2 pa = p - a;
    float len2 = dot(ba, ba);
    float h = len2 > 1e-10 ? clamp(dot(pa, ba) / len2, 0.0, 1.0) : 0.0;
    vec2 d = pa - ba * h;
    float dist = length(d);

    float brush = 1.0 - smoothstep(0.0, uRadius, dist);
    brush = brush * brush * uStrength;

    vec2 away = dist > 1e-5 ? d / dist : vec2(0.0);
    vec2 along = len2 > 1e-10 ? ba / sqrt(len2) : vec2(0.0);
    vec2 dir = away * 0.85 + along * 0.4;

    float intensity = prev.r + brush * (1.0 - prev.r);
    vec2 disp = prev.gb + dir * brush;
    float l = length(disp);
    if (l > 1.25) disp *= 1.25 / l;

    gl_FragColor = vec4(intensity, disp, 1.0);
  }
`;

export const backgroundFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEdge;
  uniform vec3 uGlow;
  uniform vec2 uResolution;
  uniform vec2 uGlowCenter;
  uniform float uGlowStrength;
  uniform float uTime;
  uniform float uGrain;

  varying vec2 vUv;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    float vignette = smoothstep(1.35, 0.2, length(p * vec2(0.82, 1.0)));
    vec3 col = mix(uEdge, uColor, vignette);
    // Faint atmospheric bloom behind the subject.
    vec2 g = (vUv - uGlowCenter) * vec2(aspect, 1.0);
    col += uGlow * exp(-dot(g, g) * 3.2) * uGlowStrength;
    // Film grain (static per frame, very low amplitude) also dithers the gradient.
    float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 517.0) - 0.5;
    col += n * uGrain;
    gl_FragColor = vec4(col, 1.0);
  }
`;
