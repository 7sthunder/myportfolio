import * as THREE from 'three';
import gsap from 'gsap';
import { Background, Dust } from './Atmosphere.js';
import { InteractionField } from './InteractionField.js';
import { buildJourneyTargets } from './journey.js';
import { computeLayout, DEFAULT_COMPOSITION } from './layout.js';
import { PortraitParticles } from './PortraitParticles.js';
import { createSampler, fetchPortraitMap } from './samplerClient.js';
import { DEFAULT_SAMPLING, headTopLocal, particleBudget } from './sampling.js';
import { clamp, createRandom, damp, easeInOutCubic, lerp, smoothstep } from './utils.js';

/** Pixels per local unit of the hero bust in the reference (1900x956); particle sizes scale from it. */
const REFERENCE_PX_PER_UNIT = 458;

/** Works formations: particles per ink pixel of the illustration / of the text. */
const WORK_ART_DENSITY = 0.45;
const WORK_TEXT_DENSITY = 0.6;
const GOLDEN = 0.6180339887498949;

/** Index along a Hilbert curve on an n x n grid (n = power of two): nearby points, nearby indices. */
function hilbertIndex(n, x, y) {
  let d = 0;
  for (let s = n >> 1; s > 0; s >>= 1) {
    const rx = x & s ? 1 : 0;
    const ry = y & s ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (!ry) {
      if (rx) {
        x = n - 1 - x;
        y = n - 1 - y;
      }
      [x, y] = [y, x];
    }
  }
  return d;
}

/** Raster ink points (pixel indices) ordered along a Hilbert curve over the viewport. */
function hilbertOrder(points, width, height) {
  const N = 1024;
  const SHIFT = 2 ** 22;
  const keys = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const gx = Math.min(N - 1, (((p % width) * N) / width) | 0);
    const gy = Math.min(N - 1, ((Math.floor(p / width) * N) / height) | 0);
    keys[i] = hilbertIndex(N, gx, gy) * SHIFT + i;
  }
  keys.sort();
  const out = new Uint32Array(points.length);
  for (let i = 0; i < keys.length; i++) out[i] = points[keys[i] % SHIFT];
  return out;
}

/** 0 -> 1 between a and b, back to 0 between c and d. */
const bump = (x, a, b, c, d) => smoothstep(a, b, x) * (1 - smoothstep(c, d, x));
const mix3 = (out, a, b, t) => out.set(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const DEFAULT_OPTIONS = {
  map: '/portrait/portrait-map.png',
  meta: '/portrait/portrait-map.json', // URL or the parsed JSON object
  count: null, // fixed particle count; null = derived from the on-screen bust area (see density)
  density: 0.2, // particles per CSS px² of the hero bust (reference look at 1900x956)
  maxParticles: 140000,
  maxPixelRatio: 2,
  fov: 30,
  cameraZ: 10,
  aperture: 3.5, // depth-of-field strength once formed (CSS px)
  introAperture: 18, // stronger defocus while the dust gathers
  tilt: 0.3, // X tilt (rad) at the middle of the globe morph, reveals the vortex discs
  parallax: 1, // pointer parallax strength (0 disables)
  interaction: 1, // cursor field strength (0 disables)
  dust: true,
  adaptive: true,
  worker: true, // sample the portrait in a Web Worker (falls back to the main thread)
  sampling: {}, // forwarded to the sampler (depth, inflate, bands, sphereRadius, ...)
  particles: {}, // forwarded to PortraitParticles (particleSize, brightness, rim, ...)
  background: {}, // forwarded to Background (color, edge, glow, grain)
  composition: DEFAULT_COMPOSITION,
  reducedMotion: null, // null = follow prefers-reduced-motion
  pointerTarget: null, // element receiving pointer events (default: window)
  outline: null, // { width, height, path } country silhouette for the "Based in" map (journey.js)
  mapHeight: 0.86, // map height as a fraction of the viewport height
  onLayout: null, // (layout) => void, called after every resize (sync DOM overlays)
  onReady: null,
};

/**
 * Interactive 3D particle portrait.
 *
 *   const portrait = new ParticlePortrait(containerEl, options);
 *   await portrait.ready;
 *   portrait.intro();                 // formation timeline (GSAP)
 *   portrait.state.shift = 0..1;      // hero -> about (scroll driven)
 *   portrait.state.morph = 0..1;      // portrait -> globe (scroll driven)
 *   portrait.state.map = 0..1;        // globe -> country map
 *   portrait.state.dna = 0..1;        // map -> twisted ribbon
 *   portrait.state.flow = radians;    // ribbon phase (scroll driven, added to time)
 *   portrait.state.work = -1..N;      // ribbon -> project 0 -> ... -> project N-1 -> ribbon
 *   portrait.state.coil = 0..1;       // ribbon -> coil
 *   portrait.state.tunnel = 0..1;     // coil turns to face the camera (tunnel)
 *   portrait.state.experience = 0..1; // tunnel -> timeline around portrait.timelineAnchors
 *   portrait.state.achievements = 0..1; // timeline -> corner currents
 *   portrait.state.frame = 0..1;      // -> frame around portrait.frameElement
 *   portrait.dispose();
 *
 * Nothing here touches framework state: scroll/pointer inputs are plain fields read by the
 * render loop, so it can be driven from React refs/effects without re-renders.
 */
export class ParticlePortrait {
  constructor(container, options = {}) {
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.options.composition = { ...DEFAULT_COMPOSITION, ...(options.composition ?? {}) };
    this.reducedMotion = this.options.reducedMotion ?? prefersReducedMotion();

    this.state = {
      shift: 0,
      morph: 0,
      map: 0,
      dna: 0,
      flow: 0,
      work: -1, // works: -1 = ribbon, k = project k formed, fractions = transitions (setWorkTargets)
      coil: 0,
      tunnel: 0,
      experience: 0,
      expSpell: 0, // particles assemble into (and become) the experience text / elements
      achievements: 0,
      achSpell: 0,
      frame: 0,
    };
    this.spellDirty = true; // formation targets need rebuilding (resize / density change)
    this.workDirty = true; // same for the works formations
    this.frameElement = null;
    this.timelineAnchors = null; // { line: Element, nodes: [Element, Element] }
    this.flowTime = 0;
    this.anim = { intro: 0, formation: 0, blur: 0, aperture: this.options.introAperture };
    this.time = 0;
    this.swirl = 0;
    this.spherePhase = 0;
    this.running = false;
    this.inView = true;
    this.disposed = false;
    this.loaded = false;
    this.density = 1;
    this.perf = { avg: 1 / 60, elapsed: 0, warmup: 3 };

    this.pointer = { clientX: 0, clientY: 0, u: 0.86, v: 0.22, inside: false, present: false, moved: false, has: false };
    this.light = new THREE.Vector2(0.72, -0.55);
    this.parallax = new THREE.Vector2();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false, // points are anti-aliased in the fragment shader
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      this.supported = false;
      container.classList.add('pp-no-webgl');
      this.ready = Promise.reject(error);
      this.ready.catch(() => {});
      return;
    }
    this.supported = true;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.options.fov, 1, 0.1, 100);
    this.camera.position.set(0, 0, this.options.cameraZ);

    this.background = new Background(this.options.background);
    this.scene.add(this.background.mesh);
    if (this.options.dust) {
      this.dust = new Dust();
      this.scene.add(this.dust.points);
    }
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.field = new InteractionField(this.renderer);

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onPointerOut = this.onPointerOut.bind(this);
    this.onVisibility = () => this.updateRunning();
    this.tick = this.tick.bind(this);

    const target = this.options.pointerTarget ?? window;
    target.addEventListener('pointermove', this.onPointerMove, { passive: true });
    target.addEventListener('touchmove', this.onTouchMove, { passive: true });
    document.addEventListener('pointerout', this.onPointerOut, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.inView = entry.isIntersecting;
      this.updateRunning();
    });
    this.intersectionObserver.observe(container);

    this.resize();
    this.updateRunning(true);
    this.ready = this.load();
  }

  async load() {
    const { options } = this;
    const t0 = performance.now();
    const [meta, blob] = await Promise.all([
      typeof options.meta === 'string' ? fetch(options.meta).then((r) => r.json()) : options.meta,
      fetchPortraitMap(options.map),
    ]);
    if (this.disposed) return this;

    this.meta = meta;
    this.layoutInputs = {
      headTop: headTopLocal(meta),
      sphereRadius: options.sampling?.sphereRadius ?? DEFAULT_SAMPLING.sphereRadius,
    };

    const sampler = await createSampler(blob, meta, options.sampling ?? {}, { useWorker: options.worker });
    if (this.disposed) {
      sampler.dispose();
      return this;
    }
    this.samplerMode = sampler.mode;
    this.areaLocal = sampler.areaLocal;
    // Generate enough particles for the largest viewport this screen allows (plus the rotated
    // orientation on touch devices), then thin with a draw range for the current size, so
    // resizing never needs a re-sample.
    const rect = this.size ?? { width: window.innerWidth, height: window.innerHeight };
    const sw = Math.max(rect.width, window.screen?.width || 0);
    const sh = Math.max(rect.height, window.screen?.height || 0);
    const rotates = window.matchMedia?.('(pointer: coarse)').matches;
    const count =
      options.count ??
      clamp(
        Math.max(this.budgetFor(rect.width, rect.height), this.budgetFor(sw, sh), rotates ? this.budgetFor(sh, sw) : 0),
        6000,
        options.maxParticles,
      );
    this.data = await sampler.sample(Math.round(count));
    sampler.dispose();
    if (this.disposed) return this;
    if (options.outline) {
      this.outlineAspect = options.outline.width / options.outline.height;
      this.data.journey = buildJourneyTargets(this.data, options.outline);
    }
    this.samplingTime = performance.now() - t0;
    if (this.disposed) return this;

    this.particles = new PortraitParticles(this.data, { aperture: options.aperture, ...options.particles });
    this.baseParticleSize = this.particles.uniforms.uSize.value;
    this.particles.uniforms.uFieldEnabled.value = this.field.enabled && options.interaction > 0 ? 1 : 0;
    if (this.reducedMotion) this.particles.uniforms.uDrift.value *= 0.25;
    // Compile the particle program without blocking the main thread (KHR_parallel_shader_compile).
    try {
      await this.renderer.compileAsync(this.particles.points, this.camera, this.scene);
    } catch {
      // Older drivers: the program simply compiles on first render.
    }
    if (this.disposed) {
      this.particles.dispose();
      return this;
    }
    this.group.add(this.particles.points);

    this.loaded = true;
    this.resize();
    this.updateRunning();
    options.onReady?.(this);
    return this;
  }

  layoutFor(width, height) {
    return computeLayout({
      width,
      height,
      fov: this.options.fov,
      cameraZ: this.options.cameraZ,
      meta: this.meta,
      composition: this.options.composition,
      ...this.layoutInputs,
    });
  }

  /** Particle size follows the bust scale; density compensates so the texture stays consistent. */
  sizeScaleFor(layout) {
    return clamp(layout.hero.s / layout.wpp / REFERENCE_PX_PER_UNIT, 0.78, 1.1);
  }

  budgetFor(width, height) {
    if (!width || !height) return 0;
    const layout = this.layoutFor(width, height);
    const s = this.sizeScaleFor(layout);
    return particleBudget(layout, this.areaLocal, this.options.density / (s * s));
  }

  applyDensity() {
    if (!this.particles || !this.size) return;
    const target = this.budgetFor(this.size.width, this.size.height) / this.particles.count;
    this.particles.setDensity(Math.min(1, target) * this.density);
    this.spellDirty = true;
    this.workDirty = true;
  }

  /**
   * Assigns the works formations: one { width, height, art, text } raster per project (ink pixel
   * indices in CSS px of the viewport, see experience/glyphTargets.js), at most 6.
   *
   * Every project is drawn by the same particles (the illustration from the front of the random
   * particle order, the text from the back), and each particle takes the same relative spot
   * along a Hilbert curve in every drawing, so between two projects the particles fly to the
   * matching part of the next drawing instead of crossing the screen at random.
   */
  setWorkTargets(projects) {
    if (!this.particles || !this.layout) return;
    const geo = this.particles.geometry;
    const attrs = ['aWorkA', 'aWorkB', 'aWorkC'].map((name) => geo.getAttribute(name));
    for (const attr of attrs) attr.array.fill(1e4);
    const visible = Math.min(geo.drawRange.count, this.particles.count);
    // Leave at least 40% of the scenery in place.
    const limit = Math.floor(visible * 0.6);
    const { wpp } = this.layout;
    const { width: W, height: H } = this.size;
    const list = projects.slice(0, 6);

    list.forEach((raster, k) => {
      const a = attrs[k >> 1].array;
      const off = (k & 1) * 2;
      const rand = createRandom(97 + k);
      const art = hilbertOrder(raster.art, raster.width, raster.height);
      const text = hilbertOrder(raster.text, raster.width, raster.height);
      const want = art.length * WORK_ART_DENSITY + text.length * WORK_TEXT_DENSITY;
      const scale = Math.min(1, limit / Math.max(want, 1));
      const nArt = art.length ? Math.floor(art.length * WORK_ART_DENSITY * scale) : 0;
      const nText = text.length ? Math.floor(text.length * WORK_TEXT_DENSITY * scale) : 0;
      const place = (i, j, points, flag) => {
        // Golden-ratio sequence: evenly spread for any count, and the same spot for particle j
        // in every project.
        const u = (0.5 + j * GOLDEN) % 1;
        const p = points[(u * points.length) | 0];
        const px = (p % raster.width) + rand();
        const py = Math.floor(p / raster.width) + rand();
        a[i * 4 + off] = (px - W / 2) * wpp + flag;
        a[i * 4 + off + 1] = (H / 2 - py) * wpp;
      };
      for (let j = 0; j < nArt; j++) place(j, j, art, 1000);
      for (let j = 0; j < nText; j++) place(visible - 1 - j, j, text, 0);
    });

    for (const attr of attrs) attr.needsUpdate = true;
    this.particles.uniforms.uWorkCount.value = list.length;
  }

  /**
   * Assigns text / element formation targets for one section (slot 0 = experience,
   * 1 = achievements) from a rasterised mask ({ width, height, points } in CSS px of the
   * viewport, see experience/glyphTargets.js). Only drawn particles are used, and the particles
   * that draw the timeline line / orbs (or the achievements orbit) keep their own job.
   */
  setSpellTargets(slot, raster) {
    if (!this.particles || !this.layout) return;
    const geo = this.particles.geometry;
    const attr = geo.getAttribute('aSpell');
    const a = attr.array;
    const J = this.data.journey?.journey;
    const count = this.particles.count;
    const visible = Math.min(geo.drawRange.count, count);
    const off = slot * 2;
    for (let i = 0; i < count; i++) a[i * 4 + off] = a[i * 4 + off + 1] = 1e4;

    const n = raster.points.length;
    if (J && n) {
      const keep = slot === 0 ? 0.1 : 0.07;
      const eligible = [];
      for (let i = 0; i < visible; i++) if (J[i * 4] >= keep) eligible.push(i);
      // ~0.6 particles per ink pixel, but leave at least 40% of the scenery in place.
      const share = Math.min(0.6, (n * 0.6) / Math.max(eligible.length, 1));
      const rand = createRandom(31 + slot);
      const { wpp } = this.layout;
      const { width: W, height: H } = this.size;
      for (const i of eligible) {
        if (rand() > share) continue;
        const p = raster.points[(rand() * n) | 0];
        const px = (p % raster.width) + rand();
        const py = Math.floor(p / raster.width) + rand();
        a[i * 4 + off] = (px - W / 2) * wpp;
        a[i * 4 + off + 1] = (H / 2 - py) * wpp;
      }
    }
    attr.needsUpdate = true;
  }

  /** Cinematic formation: dust fades in, drifts, then condenses and focuses into the portrait. */
  intro({ delay = 0 } = {}) {
    const a = this.anim;
    const base = this.options.aperture;
    this.introTimeline?.kill();
    if (this.reducedMotion) {
      Object.assign(a, { intro: 1, formation: 1, blur: 0, aperture: base });
      return (this.introTimeline = gsap.timeline());
    }
    // Timing measured from the reference: dust 0-1.2s, cloud gathers ~1.5-2.2s,
    // soft silhouette ~2.5s, crisp by ~3.3s.
    const tl = gsap.timeline({ delay });
    tl.fromTo(a, { intro: 0 }, { intro: 1, duration: 1.8, ease: 'power1.out' }, 0)
      .fromTo(a, { formation: 0 }, { formation: 1, duration: 2.45, ease: 'power1.inOut' }, 0.9)
      .fromTo(a, { aperture: this.options.introAperture }, { aperture: base, duration: 2.6, ease: 'power2.inOut' }, 0.8)
      .fromTo(a, { blur: 4 }, { blur: 0, duration: 1.7, ease: 'power2.out' }, 1.9);
    this.introTimeline = tl;
    return tl;
  }

  /** Jump straight to the formed portrait (e.g. when returning to the page). */
  showImmediately() {
    this.introTimeline?.kill();
    Object.assign(this.anim, { intro: 1, formation: 1, blur: 0, aperture: this.options.aperture });
  }

  // ---------------------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------------------
  /** Records the pointer in client space; it is resolved against the canvas once per frame. */
  setPointerFromClient(clientX, clientY) {
    const p = this.pointer;
    p.clientX = clientX;
    p.clientY = clientY;
    p.present = true;
    p.moved = true;
    p.has = true;
  }

  resolvePointer() {
    const p = this.pointer;
    if (!p.has) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = p.clientX - rect.left;
    const y = p.clientY - rect.top;
    p.inside = p.present && x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    p.u = x / rect.width;
    p.v = 1 - y / rect.height;
  }

  onPointerMove(event) {
    if (event.pointerType === 'touch') return; // handled by touchmove (keeps working while scrolling)
    this.setPointerFromClient(event.clientX, event.clientY);
  }

  onTouchMove(event) {
    const t = event.touches[0];
    if (t) this.setPointerFromClient(t.clientX, t.clientY);
  }

  onPointerOut(event) {
    if (!event.relatedTarget) this.pointer.present = false;
  }

  // ---------------------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------------------
  resize() {
    if (!this.supported || this.disposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.size = { width, height };

    const dpr = Math.min(window.devicePixelRatio || 1, this.options.maxPixelRatio) * (this.dprScale ?? 1);
    this.pixelRatio = Math.max(1, dpr);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const tanHalf = Math.tan((this.options.fov * Math.PI) / 360);
    const minSize = 2 + 0.35 * (this.pixelRatio - 1); // device px
    this.background.uniforms.uResolution.value.set(width * this.pixelRatio, height * this.pixelRatio);
    this.field.setAspect(width / height);

    const halfH = this.options.cameraZ * tanHalf;
    const halfW = halfH * (width / height);
    if (this.dust) {
      const du = this.dust.uniforms;
      du.uPixelRatio.value = this.pixelRatio;
      du.uMinSize.value = minSize;
      du.uFocus.value = this.options.cameraZ;
      du.uScale.value.set(halfW, halfH, this.options.cameraZ * 0.75);
    }

    if (!this.data) return;
    this.layout = this.layoutFor(width, height);

    const u = this.particles.uniforms;
    u.uSize.value = this.baseParticleSize * this.sizeScaleFor(this.layout);
    this.applyDensity();
    u.uPixelRatio.value = this.pixelRatio;
    u.uViewport.value.set(width * this.pixelRatio, height * this.pixelRatio);
    u.uTanHalfFov.value = tanHalf;
    u.uAspect.value = width / height;
    u.uMinSize.value = minSize;
    u.uFocus.value = this.options.cameraZ;
    u.uScatterScale.value.set(halfW * 1.1, halfH * 1.1, this.options.cameraZ * 0.75);

    this.options.onLayout?.(this.layout, this);
    if (!this.running) this.renderFrame(0);
  }

  updateRunning(force = false) {
    const shouldRun = this.supported && !this.disposed && this.inView && !document.hidden;
    if (shouldRun && (!this.running || force)) {
      this.running = true;
      this.lastTime = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.tick);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
  }

  tick(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0), 1 / 20);
    this.lastTime = now;
    this.renderFrame(dt);
    this.monitor(dt);
  }

  renderFrame(dt) {
    this.time += dt;
    if (this.loaded) this.update(dt);
    if (this.dust) {
      const du = this.dust.uniforms;
      du.uTime.value = this.time;
      du.uIntro.value = this.anim.intro;
      du.uAperture.value = this.anim.aperture;
      du.uOpacity.value = lerp(1, 0.3, this.anim.formation) * (1 - clamp(this.state.morph) * 0.4);
    }
    this.background.uniforms.uTime.value = this.time;
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const L = this.layout;
    if (!L) return;
    const u = this.particles.uniforms;
    const p = this.pointer;
    this.resolvePointer();
    const shift = clamp(this.state.shift);
    const morph = clamp(this.state.morph);
    const em = easeInOutCubic(morph);
    // The vortex glides to centre early, so the discs swirl mid-screen (as in the reference).
    const pm = easeInOutCubic(clamp((morph - 0.15) / 0.75));

    // Group transform: hero -> about (shift) -> globe (morph).
    const ax = lerp(L.hero.x, L.about.x, shift);
    const ay = lerp(L.hero.y, L.about.y, shift);
    const as = lerp(L.hero.s, L.about.s, shift);
    this.group.position.set(lerp(ax, L.globe.x, pm), lerp(ay, L.globe.y, pm), 0);
    this.group.scale.setScalar(lerp(as, L.globe.s, pm));

    // Pointer light + parallax (smoothed, frame-rate independent).
    const lx = p.has ? p.u * 2 - 1 : 0.72;
    const ly = p.has ? p.v * 2 - 1 : -0.55;
    this.light.set(damp(this.light.x, lx, 7, dt), damp(this.light.y, ly, 7, dt));
    const par = this.reducedMotion ? 0 : this.options.parallax;
    this.parallax.set(
      damp(this.parallax.x, p.has ? (p.u - 0.5) * 2 : 0, 2.2, dt),
      damp(this.parallax.y, p.has ? (p.v - 0.5) * 2 : 0, 2.2, dt),
    );
    const mid = Math.sin(Math.PI * em);
    this.group.rotation.y = this.parallax.x * 0.075 * par;
    this.group.rotation.x = -this.parallax.y * 0.045 * par + this.options.tilt * mid;
    this.group.rotation.z = -0.13 * mid;

    // Vortex keeps swirling while the scroll rests mid-morph; globe slowly turns once formed.
    if (morph > 0.001 && morph < 0.999 && !this.reducedMotion) this.swirl = Math.min(this.swirl + dt * 0.28, 4);
    else this.swirl = 0;
    if (morph >= 0.999 && !this.reducedMotion) this.spherePhase = (this.spherePhase + dt * 0.12) % (Math.PI * 2);

    const aspect = this.size.width / this.size.height;
    this.field.update(dt, p, aspect, this.options.interaction * (this.reducedMotion ? 0.35 : 1));
    p.moved = false;

    u.uTime.value = this.time;
    u.uIntro.value = this.anim.intro;
    u.uFormation.value = this.anim.formation;
    u.uBlur.value = this.anim.blur;
    u.uAperture.value = this.anim.aperture;
    u.uMorph.value = morph;
    u.uSwirl.value = this.swirl;
    this.updateJourney(dt);
    u.uSpherePhase.value = this.spherePhase;
    u.uPointer.value.copy(this.light);
    u.uField.value = this.field.texture;

    // Background glow follows the subject.
    const glow = this.background.uniforms.uGlowCenter.value;
    const gx = 0.5 + this.group.position.x / (2 * L.halfWidth);
    const gy = 0.5 + (this.group.position.y + 0.15 * this.group.scale.x) / (2 * L.halfHeight);
    glow.set(gx, clamp(gy, 0.3, 0.7));
  }

  /**
   * Shapes after the globe, all in world units relative to the viewport (z = 0 plane):
   * country map -> diagonal twisted ribbon -> coil -> tunnel (axis turned towards the camera)
   * -> rectangular frame around `frameElement` (the contact card).
   */
  updateJourney(dt) {
    const L = this.layout;
    const u = this.particles.uniforms;
    const s = this.state;
    const map = clamp(s.map);
    const dna = clamp(s.dna);
    const coil = easeInOutCubic(clamp(s.coil));
    const tunnel = easeInOutCubic(clamp(s.tunnel));
    const frame = clamp(s.frame);
    const exp = clamp(s.experience);
    const ach = clamp(s.achievements);

    u.uMap.value = map;
    u.uExp.value = exp;
    u.uAch.value = ach;
    u.uExpSpell.value = clamp(s.expSpell);
    u.uAchSpell.value = clamp(s.achSpell);
    u.uHalf.value.set(L.halfWidth, L.halfHeight);
    u.uDna.value = dna;
    u.uWork.value = s.work;
    u.uWorkDim.value = u.uWorkCount.value ? clamp(Math.min(s.work + 1, u.uWorkCount.value - s.work)) : 0;
    u.uFrame.value = frame;
    u.uCoil.value = coil;

    const mapAspect = this.outlineAspect ?? 0.88;
    const mapPx = Math.min(this.options.mapHeight * this.size.height, (0.9 * this.size.width) / mapAspect);
    u.uMapScale.value = (mapPx * L.wpp) / L.globe.s;

    // The map defocuses as it dissolves; the ribbon sharpens as it condenses.
    u.uBlur.value =
      this.anim.blur +
      5 * bump(dna, 0.04, 0.3, 0.45, 0.9) +
      3 * bump(exp, 0.0, 0.35, 0.5, 0.95) +
      3 * bump(ach, 0.0, 0.35, 0.5, 0.95) +
      2.5 * bump(frame, 0.0, 0.35, 0.5, 0.95);

    if (dna <= 0) return;
    if (!this.reducedMotion) this.flowTime += dt * (0.22 + 0.25 * tunnel);
    u.uFlow.value = this.flowTime + s.flow;

    const hw = L.halfWidth;
    const hh = L.halfHeight;
    const k = Math.min(hh, hw * 1.15);
    // Ribbon: rises from the lower left to the upper right, its right end closer to the camera.
    const ribbon = { a: [-hw * 1.3, -hh * 0.62, -0.8], b: [hw * 1.3, hh * 1.05, 1.2] };
    // Coil: flatter and deeper, so the loops read as arcs with cusps.
    const coiled = { a: [-hw * 1.25, -hh * 0.02, -2.4], b: [hw * 1.2, hh * 0.32, 1.4] };
    const a = this._a ?? (this._a = new THREE.Vector3());
    const b = this._b ?? (this._b = new THREE.Vector3());
    const t2 = this._t ?? (this._t = new THREE.Vector3());
    mix3(a, ribbon.a, coiled.a, coil);
    mix3(b, ribbon.b, coiled.b, coil);

    // Tunnel: the coil's axis swings round to point away from the camera, through the centre.
    const dir = t2.subVectors(b, a);
    let length = dir.length();
    dir.normalize();
    const tunnelDir = [0.07, 0.03, -1];
    const origin = u.uAxisOrigin.value;
    mix3(origin, a.toArray(), [0, 0, 2.4], tunnel);
    const axis = u.uAxisDir.value;
    mix3(axis, dir.toArray(), tunnelDir, tunnel).normalize();
    length = lerp(length, 36, tunnel);

    const up = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    u.uAxisN1.value.crossVectors(axis, up).normalize();
    u.uAxisN2.value.crossVectors(u.uAxisN1.value, axis).normalize();
    u.uAxisLength.value = length;
    u.uTwist.value = lerp(1.45, 3, coil);
    u.uLoops.value = lerp(lerp(0, 5.5, coil), 10, tunnel);
    u.uCoilRadius.value = lerp(k * 0.32 * coil, k * 0.6, tunnel);
    u.uRibbonWidth.value = lerp(lerp(k * 0.3, k * 0.17, coil), k * 0.14, tunnel);

    // Experience timeline: the particle line and orbs follow their DOM anchors.
    const anchors = this.timelineAnchors;
    if (exp > 0 && anchors?.line) {
      const c = this.renderer.domElement.getBoundingClientRect();
      const wx = (x) => (x - c.left - c.width / 2) * L.wpp;
      const wy = (y) => (c.top + c.height / 2 - y) * L.wpp;
      const line = anchors.line.getBoundingClientRect();
      u.uLine.value.set(wx(line.left + line.width / 2), wy(line.top), wy(line.bottom));
      const [a0, a1] = anchors.nodes.map((el) => el.getBoundingClientRect());
      u.uNodes.value.set(wx(a0.left + a0.width / 2), wy(a0.top + a0.height / 2), wx(a1.left + a1.width / 2), wy(a1.top + a1.height / 2));
      // offsetWidth: the anchor's own size, ignoring the CSS halo's scale.
      u.uNodeR.value = Math.max(anchors.nodes[0].offsetWidth / 2, 6) * L.wpp;
    }

    if (frame > 0 && this.frameElement) {
      const r = this.frameElement.getBoundingClientRect();
      const c = this.renderer.domElement.getBoundingClientRect();
      const band = clamp(r.height * 0.13, 16, 64);
      u.uFrameCenter.value.set(
        (r.left + r.width / 2 - c.left - c.width / 2) * L.wpp,
        (c.top + c.height / 2 - r.top - r.height / 2) * L.wpp,
      );
      u.uFrameHalf.value.set(((r.width - band) / 2) * L.wpp, ((r.height - band) / 2) * L.wpp);
      u.uFrameBand.value = band * L.wpp;
    }
  }

  /** Adaptive quality: lower pixel ratio first, then particle density, if frames are slow. */
  monitor(dt) {
    if (!this.options.adaptive || !this.loaded || dt <= 0) return;
    const perf = this.perf;
    perf.avg = lerp(perf.avg, dt, 0.05);
    perf.elapsed += dt;
    if (perf.elapsed < perf.warmup) return;
    if (perf.elapsed > perf.warmup + 2) {
      perf.elapsed = perf.warmup;
      if (perf.avg > 1 / 45) {
        if (this.pixelRatio > 1.01) {
          this.dprScale = Math.max(0.5, (this.dprScale ?? 1) - 0.15);
          this.resize();
        } else if (this.density > 0.45) {
          this.density -= 0.15;
          this.applyDensity();
        }
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.introTimeline?.kill();
    if (!this.supported) return;
    const target = this.options.pointerTarget ?? window;
    target.removeEventListener('pointermove', this.onPointerMove);
    target.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('pointerout', this.onPointerOut);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.particles?.dispose();
    this.dust?.dispose();
    this.background.dispose();
    this.field.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
