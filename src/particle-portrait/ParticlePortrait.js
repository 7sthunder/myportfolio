import * as THREE from 'three';
import gsap from 'gsap';
import { Background, Dust } from './Atmosphere.js';
import { InteractionField } from './InteractionField.js';
import { computeLayout, DEFAULT_COMPOSITION } from './layout.js';
import { PortraitParticles } from './PortraitParticles.js';
import { createSampler, fetchPortraitMap } from './samplerClient.js';
import { DEFAULT_SAMPLING, headTopLocal, particleBudget } from './sampling.js';
import { clamp, damp, easeInOutCubic, lerp } from './utils.js';

/** Pixels per local unit of the hero bust in the reference (1900x956); particle sizes scale from it. */
const REFERENCE_PX_PER_UNIT = 458;

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

    this.state = { shift: 0, morph: 0 };
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
    u.uSpherePhase.value = this.spherePhase;
    u.uPointer.value.copy(this.light);
    u.uField.value = this.field.texture;

    // Background glow follows the subject.
    const glow = this.background.uniforms.uGlowCenter.value;
    const gx = 0.5 + this.group.position.x / (2 * L.halfWidth);
    const gy = 0.5 + (this.group.position.y + 0.15 * this.group.scale.x) / (2 * L.halfHeight);
    glow.set(gx, clamp(gy, 0.3, 0.7));
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
