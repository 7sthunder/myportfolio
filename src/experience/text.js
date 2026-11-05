/**
 * Splits an element's text into spans for staggered reveals while keeping inner markup
 * (e.g. line wrappers) intact. Screen readers get the original text via aria-label.
 *
 * @param {HTMLElement} el
 * @param {'chars'|'words'} mode
 * @returns {HTMLElement[]} the created spans, in reading order
 */
export function splitText(el, mode = 'chars') {
  if (!el) return [];
  if (el.dataset.split) return [...el.querySelectorAll('.pp-split')];
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  el.dataset.split = mode;
  const out = [];

  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        const parts = child.textContent.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(' '));
            continue;
          }
          const word = document.createElement('span');
          word.className = 'pp-word';
          word.setAttribute('aria-hidden', 'true');
          if (mode === 'words') {
            word.classList.add('pp-split');
            word.textContent = part;
            out.push(word);
          } else {
            for (const ch of part) {
              const span = document.createElement('span');
              span.className = 'pp-char pp-split';
              span.textContent = ch;
              word.appendChild(span);
              out.push(span);
            }
          }
          frag.appendChild(word);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    }
  };
  walk(el);
  return out;
}
