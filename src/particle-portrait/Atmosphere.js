import * as THREE from 'three';
import { backgroundFragment, fullscreenVertex } from './shaders/field.js';
import { dustVertex, particleFragment } from './shaders/particles.js';
import { createFullscreenTriangle } from './InteractionField.js';
import { createRandom } from './utils.js';

const srgb = (hex) => new THREE.Color(hex).convertLinearToSRGB();

/** Full-screen charcoal backdrop: near-flat tone, soft vignette, faint glow, film grain. */
export class Background {
  constructor({ color = '#28272c', edge = '#252429', glow = '#3a3846', glowStrength = 0.012, grain = 0.014 } = {}) {
    this.uniforms = {
      uColor: { value: srgb(color) },
      uEdge: { value: srgb(edge) },
      uGlow: { value: srgb(glow) },
      uGlowCenter: { value: new THREE.Vector2(0.5, 0.55) },
      uGlowStrength: { value: glowStrength },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uGrain: { value: grain },
    };
    this.geometry = createFullscreenTriangle();
    this.material = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: backgroundFragment,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Sparse floating motes in front of / behind the subject for atmospheric depth. */
export class Dust {
  constructor({ count = 320, seed = 99, size = 1.6 } = {}) {
    const rand = createRandom(seed);
    const positions = new Float32Array(count * 3);
    const random = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() * 2 - 1) * 1.15;
      positions[i * 3 + 1] = (rand() * 2 - 1) * 1.2;
      // Most motes sit near the focal plane; a few drift close to the lens as bokeh.
      positions[i * 3 + 2] = rand() < 0.06 ? 0.35 + rand() * 0.45 : rand.gaussian() * 0.25 - 0.1;
      random[i * 4] = rand();
      random[i * 4 + 1] = rand();
      random[i * 4 + 2] = rand();
      random[i * 4 + 3] = rand();
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(random, 4));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: size },
      uMinSize: { value: 1.5 },
      uMaxSize: { value: 64 },
      uFocus: { value: 10 },
      uAperture: { value: 9 },
      uBlur: { value: 0 },
      uIntro: { value: 1 },
      uOpacity: { value: 0.35 },
      uScale: { value: new THREE.Vector3(5, 3, 7) },
      uColor: { value: srgb('#ffffff') },
      uColorAlt: { value: srgb('#c9c6dc') },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: particleFragment,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -5;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
