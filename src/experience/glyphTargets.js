/**
 * Rasterises what a section *looks like* (every word with its real font, plus outlined boxes,
 * rules and inline SVG icons) into a mask, and returns the "ink" pixels. Particles use these as
 * targets to assemble into the section before the real DOM text fades in.
 *
 * Everything is measured from the live layout, so it matches any viewport and breakpoint.
 *
 * @param {HTMLElement} root   section to rasterise (may be invisible, but must be laid out)
 * @param {object} shapes      { outline: selector, rule: selector }
 * @returns {Promise<{ width, height, points: Uint32Array }>} points = pixel indices (y * width + x)
 */
export async function rasteriseSection(root, { outline = '', rule = '' } = {}) {
  const stage = root.getBoundingClientRect();
  const origin = root.offsetParent?.getBoundingClientRect() ?? stage;
  const width = Math.max(1, Math.round(origin.width));
  const height = Math.max(1, Math.round(origin.height));
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const ox = origin.left;
  const oy = origin.top;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';

  // --- text, word by word (handles wrapping, letter-spacing and text-transform)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || el.closest('svg') || !node.textContent.trim()) continue;
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const m = ctx.measureText('Hg');
    const ascent = m.fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * 0.8;
    const descent = m.fontBoundingBoxDescent ?? parseFloat(cs.fontSize) * 0.2;
    const upper = cs.textTransform === 'uppercase';
    for (const match of node.textContent.matchAll(/\S+/g)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const r = range.getClientRects()[0];
      if (!r || !r.width) continue;
      const word = upper ? match[0].toUpperCase() : match[0];
      ctx.fillText(word, r.left - ox, r.top - oy + (ascent * r.height) / (ascent + descent));
    }
  }
  ctx.letterSpacing = '0px';

  // --- outlined boxes (pills, cards) and solid rules
  if (outline) {
    ctx.lineWidth = 1.5;
    for (const el of root.querySelectorAll(outline)) {
      const r = el.getBoundingClientRect();
      const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, r.height / 2, r.width / 2);
      ctx.beginPath();
      ctx.roundRect(r.left - ox + 0.75, r.top - oy + 0.75, r.width - 1.5, r.height - 1.5, radius);
      ctx.stroke();
    }
  }
  if (rule) {
    for (const el of root.querySelectorAll(rule)) {
      const r = el.getBoundingClientRect();
      ctx.fillRect(r.left - ox, r.top - oy, r.width, Math.max(r.height, 1.5));
    }
  }

  // --- inline SVG icons, drawn white (dark inner details stay dark, so they read as holes)
  const serializer = new XMLSerializer();
  const icons = [...root.querySelectorAll('svg')].map(async (svg) => {
    const r = svg.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', r.width);
    clone.setAttribute('height', r.height);
    clone.setAttribute('fill', '#fff');
    clone.setAttribute('color', '#fff');
    const markup = serializer
      .serializeToString(clone)
      .replaceAll('url(#pp-silver)', '#fff')
      .replaceAll('#2a2a30', '#000')
      .replaceAll('currentColor', '#fff');
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    try {
      await img.decode();
      ctx.drawImage(img, r.left - ox, r.top - oy, r.width, r.height);
    } catch {
      // An icon that fails to decode is simply not part of the particle formation.
    }
  });
  await Promise.all(icons);

  const data = ctx.getImageData(0, 0, width, height).data;
  const ink = [];
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] > 110 && data[i] > 110) ink.push(p);
  }
  return { width, height, points: Uint32Array.from(ink) };
}
