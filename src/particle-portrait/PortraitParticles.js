import * as THREE from 'three';
import { particleFragment, particleVertex } from './shaders/particles.js';

/**
 * The portrait point cloud: one BufferGeometry + one ShaderMaterial, a single draw call.
 * All motion (formation, drift, morph, interaction) happens in the vertex shader;
 * the CPU only updates a handful of uniforms per frame.
 *
 * Framework-agnostic: in React Three Fiber use `<primitive object={particles.points} />`
 * and write uniforms inside useFrame.
 */
export class PortraitParticles {
  constructor(data, options = {}) {
    const o = options;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('aSphere', new THREE.BufferAttribute(data.sphere, 4));
    geometry.setAttribute('aScatter', new THREE.BufferAttribute(data.scatter, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(data.random, 4));
    geometry.setAttribute('aShade', new THREE.BufferAttribute(data.shade, 4));
    const journey = data.journey ?? { map: new Float32Array(data.count * 4), journey: new Float32Array(data.count * 4) };
    geometry.setAttribute('aMap', new THREE.BufferAttribute(journey.map, 4));
    geometry.setAttribute('aJourney', new THREE.BufferAttribute(journey.journey, 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.count = data.count;
    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: o.particleSize ?? 1.8 },
      uMinSize: { value: 1.5 },
      uMaxSize: { value: 64 },
      uFocus: { value: 10 },
      uAperture: { value: o.aperture ?? 9 },
      uBlur: { value: 0 },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uTanHalfFov: { value: 0.27 },
      uAspect: { value: 1 },

      uIntro: { value: 1 },
      uFormation: { value: 1 },
      uScatterScale: { value: new THREE.Vector3(5, 3, 7) },
      uScatterOffset: { value: new THREE.Vector3() },

      uMorph: { value: 0 },
      uSwirl: { value: 0 },
      uSphereRadius: { value: data.sphereRadius ?? 0.86 },
      uMap: { value: 0 },
      uMapScale: { value: 1 },
      uDna: { value: 0 },
      uAxisOrigin: { value: new THREE.Vector3() },
      uAxisDir: { value: new THREE.Vector3(1, 0, 0) },
      uAxisN1: { value: new THREE.Vector3(0, 1, 0) },
      uAxisN2: { value: new THREE.Vector3(0, 0, 1) },
      uAxisLength: { value: 10 },
      uRibbonWidth: { value: 0.6 },
      uTwist: { value: 1.5 },
      uFlow: { value: 0 },
      uCoil: { value: 0 },
      uCoilRadius: { value: 0 },
      uLoops: { value: 6 },
      uHalf: { value: new THREE.Vector2(4, 2.7) },
      uExp: { value: 0 },
      uLine: { value: new THREE.Vector3(0, 2, -2) },
      uNodes: { value: new THREE.Vector4(0, 1, 0, -1) },
      uNodeR: { value: 0.1 },
      uAch: { value: 0 },
      uFrame: { value: 0 },
      uFrameCenter: { value: new THREE.Vector2() },
      uFrameHalf: { value: new THREE.Vector2(3, 1) },
      uFrameBand: { value: 0.25 },
      uSpherePhase: { value: 0 },
      uBands: { value: new THREE.Vector3(data.bands.count, data.bands.top, data.bands.height) },
      uBandSphere: { value: Float32Array.from({ length: 8 }, (_, i) => data.bands.sphereCenters[i] ?? 0) },

      uDrift: { value: o.drift ?? 0.0028 },

      uField: { value: null },
      uFieldEnabled: { value: 0 },
      uFieldPush: { value: o.fieldPush ?? 11 },
      uFieldGlow: { value: o.fieldGlow ?? 0.32 },

      uPointer: { value: new THREE.Vector2(0.72, -0.55) },
      uPointerLight: { value: o.pointerLight ?? 0.9 },
      uLightRadius: { value: o.lightRadius ?? 0.5 },

      uRim: { value: o.rim ?? 2.1 },
      uFeature: { value: o.feature ?? 0.5 },
      uDepthFade: { value: o.depthFade ?? 0.15 },
      uBrightness: { value: o.brightness ?? 1 },

      uColor: { value: new THREE.Color(o.color ?? '#ffffff') },
      uColorAlt: { value: new THREE.Color(o.colorAlt ?? '#c9c6dc') },
    };
    // Colours are authored in display (sRGB) space; the shader writes them unconverted.
    this.uniforms.uColor.value.convertLinearToSRGB();
    this.uniforms.uColorAlt.value.convertLinearToSRGB();

    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.geometry = geometry;
  }

  /** Draw only a fraction of the particles (they are randomly ordered, so this thins evenly). */
  setDensity(fraction) {
    this.geometry.setDrawRange(0, Math.max(1, Math.round(this.count * Math.min(1, Math.max(0.05, fraction)))));
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
