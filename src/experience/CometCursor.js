/**
 * Custom cursor from the reference: a soft luminous dot that stretches into a tapered comet
 * tail proportional to its speed (the tail is simply the path of the last ~120 ms).
 * Only enabled for fine pointers; touch devices keep native behaviour.
 */
export class CometCursor {
  constructor({ parent = document.body, trail = 0.16, headRadius = 3.2, tailWidth = 6.5, zIndex = 60 } = {}) {
    this.enabled =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.enabled) return;

    this.trail = trail;
    this.headRadius = headRadius;
    this.tailWidth = tailWidth;
    this.points = [];
    this.visible = false;
    this.alpha = 0;
    this.press = 0;
    this.pressed = false;
    this.dirty = null;

    const canvas = document.createElement('canvas');
    canvas.className = 'pp-cursor';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: String(zIndex),
    });
    parent.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    document.documentElement.classList.add('pp-has-cursor');

    this.onMove = (e) => {
      const now = performance.now();
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (events && events.length) {
        for (const ev of events) this.points.push({ x: ev.clientX, y: ev.clientY, t: now });
      } else {
        this.points.push({ x: e.clientX, y: e.clientY, t: now });
      }
      if (this.points.length > 96) this.points.splice(0, this.points.length - 96);
      this.visible = true;
    };
    this.onLeave = (e) => {
      if (!e.relatedTarget) this.visible = false;
    };
    this.onDown = () => (this.pressed = true);
    this.onUp = () => (this.pressed = false);
    this.onResize = () => this.resize();
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onDown, { passive: true });
    window.addEventListener('pointerup', this.onUp, { passive: true });
    document.addEventListener('pointerout', this.onLeave, { passive: true });
    window.addEventListener('resize', this.onResize);
    this.resize();

    this.loop = this.loop.bind(this);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
    this.dirty = null;
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { ctx, dpr, points } = this;

    this.alpha += ((this.visible ? 1 : 0) - this.alpha) * (1 - Math.exp(-dt * 10));
    this.press += ((this.pressed ? 1 : 0) - this.press) * (1 - Math.exp(-dt * 14));

    // Drop history older than the trail window, but always keep the newest point.
    const cutoff = now - this.trail * 1000;
    let drop = 0;
    while (drop < points.length - 1 && points[drop].t < cutoff) drop++;
    if (drop) points.splice(0, drop);
    // Stationary cursor: let the tail retract into the head.
    if (points.length > 1 && now - points[points.length - 1].t > this.trail * 1000) points.splice(0, points.length - 1);

    if (this.dirty) {
      const d = this.dirty;
      ctx.clearRect(d.x, d.y, d.w, d.h);
    }
    if (!points.length || this.alpha < 0.01) {
      this.dirty = null;
      return;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'lighter';
    const head = points[points.length - 1];
    let minX = head.x;
    let maxX = head.x;
    let minY = head.y;
    let maxY = head.y;

    if (points.length > 2) {
      const n = points.length;
      const left = [];
      const right = [];
      for (let i = 0; i < n; i++) {
        const a = points[Math.max(0, i - 1)];
        const b = points[Math.min(n - 1, i + 1)];
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        const k = i / (n - 1);
        const w = this.tailWidth * 0.5 * k ** 1.35;
        const p = points[i];
        left.push([p.x + nx * w, p.y + ny * w]);
        right.push([p.x - nx * w, p.y - ny * w]);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const tail = points[0];
      const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.55, `rgba(235,235,245,${0.22 * this.alpha})`);
      grad.addColorStop(1, `rgba(255,255,255,${0.95 * this.alpha})`);
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      ctx.shadowColor = `rgba(255,255,255,${0.55 * this.alpha})`;
      ctx.shadowBlur = 14;
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Head: bright core + soft halo.
    const r = this.headRadius * (1 - this.press * 0.35);
    const halo = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r * 5);
    halo.addColorStop(0, `rgba(255,255,255,${0.42 * this.alpha})`);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(head.x, head.y, r * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${this.alpha})`;
    ctx.beginPath();
    ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const pad = 32;
    this.dirty = {
      x: Math.floor((Math.min(minX, head.x) - pad) * dpr),
      y: Math.floor((Math.min(minY, head.y) - pad) * dpr),
      w: Math.ceil((Math.max(maxX, head.x) - Math.min(minX, head.x) + pad * 2) * dpr),
      h: Math.ceil((Math.max(maxY, head.y) - Math.min(minY, head.y) + pad * 2) * dpr),
    };
  }

  dispose() {
    if (!this.enabled) return;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('pointerout', this.onLeave);
    window.removeEventListener('resize', this.onResize);
    document.documentElement.classList.remove('pp-has-cursor');
    this.canvas.remove();
  }
}
