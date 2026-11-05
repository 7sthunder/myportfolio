import * as THREE from 'three';
import { fieldFragment, fullscreenVertex } from './shaders/field.js';

/** Shared full-screen triangle (covers clip space with a single triangle). */
export function createFullscreenTriangle() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return geometry;
}

/**
 * Decaying cursor trail rendered into a small half-float texture (ping-pong).
 * Particles sample it in the vertex shader: R = sparkle intensity, GB = displacement.
 * Because the field decays exponentially, displaced particles ease back to their exact
 * resting positions without any per-particle CPU work.
 */
export class InteractionField {
  constructor(renderer, { size = 256, radius = 0.075, decay = 0.5 } = {}) {
    this.renderer = renderer;
    this.radius = radius;
    this.decay = decay; // seconds (time constant)
    const ext = renderer.extensions;
    this.enabled = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');

    const options = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    };
    this.targets = [new THREE.WebGLRenderTarget(size, size, options), new THREE.WebGLRenderTarget(size, size, options)];
    this.index = 0;

    this.material = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: fieldFragment,
      uniforms: {
        uPrev: { value: null },
        uFrom: { value: new THREE.Vector2(0.5, 0.5) },
        uTo: { value: new THREE.Vector2(0.5, 0.5) },
        uAspect: { value: 1 },
        uRadius: { value: radius },
        uStrength: { value: 0 },
        uDecay: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.geometry = createFullscreenTriangle();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.last = null;
    this.activity = 0;
    this.idle = Infinity; // seconds since the last stamp; the pass is skipped once fully decayed
    this.clear();
  }

  get texture() {
    return this.targets[this.index].texture;
  }

  clear() {
    if (!this.enabled) return;
    const { renderer } = this;
    const prevTarget = renderer.getRenderTarget();
    const prevColor = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const target of this.targets) {
      renderer.setRenderTarget(target);
      renderer.clear(true, false, false);
    }
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevColor, prevAlpha);
  }

  setAspect(aspect) {
    this.material.uniforms.uAspect.value = aspect;
  }

  /**
   * @param {number} dt seconds
   * @param {{u:number, v:number, inside:boolean, moved:boolean}} pointer uv in [0,1], v up
   * @param {number} aspect viewport aspect ratio
   * @param {number} gain 0..1 global interaction strength
   */
  update(dt, pointer, aspect, gain = 1) {
    if (!this.enabled) return;
    const u = this.material.uniforms;
    const to = u.uTo.value;
    const from = u.uFrom.value;

    if (!pointer.inside) {
      this.last = null;
      this.activity *= Math.exp(-dt / 0.2);
    } else {
      if (!this.last) this.last = { u: pointer.u, v: pointer.v };
      if (pointer.moved) this.activity = 1;
      else this.activity *= Math.exp(-dt / 0.25);
    }

    const cur = pointer.inside ? pointer : this.last ?? pointer;
    from.set(this.last ? this.last.u : cur.u, this.last ? this.last.v : cur.v);
    to.set(cur.u, cur.v);
    const dx = (to.x - from.x) * aspect;
    const dy = to.y - from.y;
    const speed = Math.hypot(dx, dy) / Math.max(dt, 1e-3); // screen heights per second
    const stroke = Math.min(1, speed / 1.8);

    u.uStrength.value = pointer.inside ? gain * this.activity * (0.1 + 0.9 * stroke) * Math.min(1, dt * 60) : 0;
    this.idle = u.uStrength.value > 1e-4 ? 0 : this.idle + dt;
    if (this.idle > this.decay * 8) {
      if (pointer.inside) this.last = { u: cur.u, v: cur.v };
      return; // field has decayed below visibility: nothing to render
    }
    u.uDecay.value = Math.exp(-dt / this.decay);
    u.uAspect.value = aspect;
    u.uPrev.value = this.targets[this.index].texture;

    const write = this.targets[1 - this.index];
    const { renderer } = this;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(write);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prevTarget);
    this.index = 1 - this.index;

    if (pointer.inside) this.last = { u: cur.u, v: cur.v };
  }

  dispose() {
    for (const t of this.targets) t.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}
