import * as THREE from 'three';

const vertex = /* glsl */ `
  uniform vec2 uSize;     // tile size (CSS px)
  uniform float uMargin;  // extra quad around the tile for the soft halo (CSS px)
  uniform float uTime;
  uniform float uPhase;
  uniform float uWave;    // idle + velocity driven wave amplitude (CSS px)
  uniform float uDrag;    // signed horizontal velocity (CSS px / frame, smoothed)

  varying vec2 vPx;       // undisplaced position inside the tile, origin at the centre (px)
  varying float vShade;

  void main() {
    vec2 full = uSize + 2.0 * uMargin;
    vec2 p = position.xy * full;
    vec2 n = p / uSize; // -0.5..0.5 across the tile

    // Cloth-like motion: a travelling wave across the width bends the top / bottom edges, a
    // slower one bows the sides, and the drag bows the whole sheet against the direction of travel.
    float wx = n.x * 5.2 + uTime * 1.25 + uPhase;
    float wy = n.y * 3.6 + uTime * 0.95 + uPhase * 1.7;
    float dy = uWave * sin(wx) * (0.75 + 0.25 * sin(n.y * 3.1 + uTime * 0.6));
    float dx = uWave * 0.55 * sin(wy);
    float bow = 1.0 - 4.0 * n.y * n.y;
    dx -= uDrag * bow * 1.6;

    vPx = p;
    // Light catches the slopes of the wave, like a sheet of paper.
    vShade = 0.06 * cos(wx) * clamp(uWave / (uSize.y * 0.015), 0.0, 2.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + vec2(dx, dy), 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec2 uSize;
  uniform float uMargin;
  uniform float uRadius;
  uniform float uPad;
  uniform vec3 uTone;
  uniform sampler2D uMap;
  uniform float uImageAspect;
  uniform float uLoaded;
  uniform float uOpacity;

  varying vec2 vPx;
  varying float vShade;

  float sdRound(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 halfSize = uSize * 0.5;
    float d = sdRound(vPx, halfSize, uRadius);
    float inside = 1.0 - smoothstep(-0.75, 0.75, d);

    vec2 innerHalf = halfSize - uPad;
    float di = sdRound(vPx, innerHalf, max(uRadius * 1.6, 2.0));
    float inImage = 1.0 - smoothstep(-0.75, 0.75, di);

    // object-fit: cover, anchored to the top of the screenshot.
    vec2 q = vPx / (innerHalf * 2.0); // -0.5..0.5
    float boxAspect = innerHalf.x / innerHalf.y;
    vec2 uv;
    if (uImageAspect > boxAspect) {
      uv = vec2(0.5 + q.x * boxAspect / uImageAspect, 0.5 + q.y);
    } else {
      float k = uImageAspect / boxAspect;
      uv = vec2(0.5 + q.x, 1.0 - (0.5 - q.y) * k);
    }
    vec3 image = texture2D(uMap, uv).rgb;

    vec3 col = mix(uTone, image, inImage * uLoaded);
    col *= 1.0 + vShade;
    // Soft light halo around the sheet, as in the reference.
    float halo = (1.0 - smoothstep(0.0, uMargin, d)) * 0.07 * (1.0 - inside);
    float alpha = (inside + halo) * uOpacity;
    gl_FragColor = vec4(mix(vec3(1.0), col, inside), alpha);
  }
`;

const toDisplay = (hex) => new THREE.Color(hex).convertLinearToSRGB();

/**
 * Draws the work tiles as waving sheets in a transparent WebGL layer, tracking the size and
 * position of their DOM placeholders every frame (the DOM keeps links, captions and a11y).
 */
export class WorksCanvas {
  constructor(container, tiles) {
    this.container = container;
    this.tiles = [];
    this.time = 0;
    this.lastX = null;
    this.drag = 0;
    this.visible = false;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.className = 'pp-works__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.geometry = new THREE.PlaneGeometry(1, 1, 40, 24);
    const loader = new THREE.TextureLoader();
    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blank.needsUpdate = true;

    tiles.forEach(({ el, src, tone }, index) => {
      const uniforms = {
        uSize: { value: new THREE.Vector2(1, 1) },
        uMargin: { value: 40 },
        uTime: { value: 0 },
        uPhase: { value: index * 1.7 },
        uWave: { value: 0 },
        uDrag: { value: 0 },
        uRadius: { value: 6 },
        uPad: { value: 24 },
        uTone: { value: toDisplay(tone) },
        uMap: { value: blank },
        uImageAspect: { value: 1.6 },
        uLoaded: { value: 0 },
        uOpacity: { value: 1 },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      const tile = { el, mesh, uniforms, hover: 0, hovered: false, fade: 0 };
      el.addEventListener('pointerenter', () => (tile.hovered = true));
      el.addEventListener('pointerleave', () => (tile.hovered = false));
      this.tiles.push(tile);

      loader.load(src, (texture) => {
        if (this.disposed) return texture.dispose();
        // Raw sRGB values in, raw values out: the shader writes the screenshot unconverted.
        texture.colorSpace = THREE.NoColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        uniforms.uMap.value = texture;
        uniforms.uImageAspect.value = texture.image.width / texture.image.height;
        tile.loaded = true;
      });
    });

    this.resize();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    Object.assign(this.camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 });
    this.camera.updateProjectionMatrix();
  }

  /** @param {number} dt seconds  @param {number} trackX current track translation (px) */
  render(dt, trackX) {
    if (this.disposed) return;
    if (this.container.clientWidth !== this.width || this.container.clientHeight !== this.height) this.resize();
    this.time += dt;
    const velocity = this.lastX === null || dt <= 0 ? 0 : (trackX - this.lastX) / Math.max(dt * 60, 0.5);
    this.lastX = trackX;
    this.drag += (Math.max(-40, Math.min(40, velocity)) - this.drag) * (1 - Math.exp(-dt * 6));

    const box = this.container.getBoundingClientRect();
    for (const tile of this.tiles) {
      const r = tile.el.getBoundingClientRect();
      const u = tile.uniforms;
      const onScreen = r.right > box.left - 200 && r.left < box.right + 200;
      tile.mesh.visible = onScreen;
      if (!onScreen) continue;
      tile.hover += ((tile.hovered ? 1 : 0) - tile.hover) * (1 - Math.exp(-dt * 6));
      tile.fade += ((tile.loaded ? 1 : 0) - tile.fade) * (1 - Math.exp(-dt * 4));
      const margin = Math.max(24, r.height * 0.12);
      u.uSize.value.set(r.width, r.height);
      u.uMargin.value = margin;
      u.uPad.value = Math.round(r.height * 0.07);
      u.uRadius.value = Math.max(3, r.height * 0.012);
      u.uTime.value = this.time;
      u.uWave.value = r.height * (0.006 + 0.004 * tile.hover) + Math.min(Math.abs(this.drag) * 0.55, r.height * 0.045);
      u.uDrag.value = this.drag;
      u.uLoaded.value = tile.fade;
      tile.mesh.position.set(r.left + r.width / 2 - box.left - this.width / 2, this.height / 2 - (r.top + r.height / 2 - box.top), 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  clear() {
    this.lastX = null;
    this.renderer.clear();
  }

  dispose() {
    this.disposed = true;
    for (const tile of this.tiles) {
      tile.mesh.material.dispose();
      if (tile.uniforms.uMap.value?.isTexture) tile.uniforms.uMap.value.dispose();
    }
    this.geometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
