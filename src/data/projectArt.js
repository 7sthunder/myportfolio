// Line-art for the holographic project cards. These are never shown as SVG: they are rasterised
// and traced by particles (strokes = dense, fills = a faint volume). viewBox 0 0 200 130.
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 130" width="200" height="130">` +
  `<g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

const soft = 'fill="#fff" fill-opacity="0.22"';

export const projectArt = {
  dumbbell: svg(`
    <rect x="44" y="60" width="112" height="10" rx="4" ${soft}/>
    ${[88, 93, 98, 103, 108, 113].map((x) => `<path d="M${x} 61.5v7"/>`).join('')}
    <rect x="76" y="56" width="7" height="18" rx="2" ${soft}/><rect x="117" y="56" width="7" height="18" rx="2" ${soft}/>
    <ellipse cx="70" cy="65" rx="7" ry="20" ${soft}/><ellipse cx="60" cy="65" rx="9" ry="28" ${soft}/>
    <ellipse cx="48" cy="65" rx="10" ry="34" ${soft}/><ellipse cx="48" cy="65" rx="5" ry="17"/>
    <ellipse cx="130" cy="65" rx="7" ry="20" ${soft}/><ellipse cx="140" cy="65" rx="9" ry="28" ${soft}/>
    <ellipse cx="152" cy="65" rx="10" ry="34" ${soft}/><ellipse cx="152" cy="65" rx="5" ry="17"/>
    <path d="M30 110h140" stroke-opacity="0.35"/>`),

  truck: svg(`
    <rect x="70" y="26" width="118" height="62" rx="2" ${soft}/>
    ${Array.from({ length: 12 }, (_, i) => `<path d="M${79 + i * 9} 30v54" stroke-opacity="0.6"/>`).join('')}
    <path d="M70 34h118M70 80h118" stroke-opacity="0.5"/>
    <path d="M16 90V60l10-20h36c3 0 5 2 5 5v45z" ${soft}/>
    <path d="M27 46h28v16H21z"/><path d="M16 74h10M16 80h10" stroke-opacity="0.7"/>
    <path d="M12 94h180" stroke-width="3"/><path d="M60 90h10"/>
    ${[34, 56, 136, 156, 176]
      .map((x) => `<circle cx="${x}" cy="98" r="9.5" fill="#1a1a1a"/><circle cx="${x}" cy="98" r="3.5"/>`)
      .join('')}
    <path d="M8 112h188" stroke-opacity="0.3"/>`),

  interview: svg(`
    <path d="M60 8h44a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H76l-8 8v-8h-8a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"/>
    <circle cx="72" cy="20" r="1.6" fill="#fff"/><circle cx="82" cy="20" r="1.6" fill="#fff"/><circle cx="92" cy="20" r="1.6" fill="#fff"/>
    <circle cx="48" cy="50" r="10" ${soft}/>
    <path d="M34 92c0-16 6-26 14-26s14 10 14 26z" ${soft}/>
    <path d="M60 78l18-4" /><path d="M30 92h36M32 92v26M64 92v26M30 70v22"/>
    <circle cx="152" cy="50" r="10" ${soft}/>
    <path d="M138 92c0-16 6-26 14-26s14 10 14 26z" ${soft}/>
    <path d="M140 78l-16-4"/><path d="M134 92h36M136 92v26M168 92v26M170 70v22"/>
    <path d="M78 84h46" stroke-width="3"/><path d="M84 84v34M118 84v34"/>
    <path d="M86 82l4-8h14l-4 8z" ${soft}/><path d="M108 82l3-12h12l-3 12z" ${soft}/>`),

  stamp: svg(`
    <ellipse cx="100" cy="18" rx="15" ry="10" ${soft}/>
    <path d="M93 27l-3 22h20l-3-22" ${soft}/>
    <rect x="74" y="49" width="52" height="14" rx="3" ${soft}/>
    <rect x="68" y="63" width="64" height="10" rx="2" ${soft}/>
    <path d="M60 80l-8 6M140 80l8 6M100 78v6" stroke-opacity="0.6"/>
    <g transform="rotate(-7 100 106)">
      <rect x="52" y="90" width="96" height="32" rx="5"/><rect x="56" y="94" width="88" height="24" rx="3" stroke-opacity="0.5"/>
      <text x="100" y="111.5" fill="#fff" stroke="none" font-family="Arial, sans-serif" font-weight="700" font-size="14" letter-spacing="2" text-anchor="middle">APPROVED</text>
    </g>`),

  pills: svg(`
    <rect x="132" y="12" width="26" height="12" rx="2" ${soft}/>
    <path d="M136 24v8M154 24v8"/>
    <path d="M136 32c-10 4-14 10-14 18v54a8 8 0 0 0 8 8h30a8 8 0 0 0 8-8V50c0-8-4-14-14-18z" ${soft}/>
    <rect x="126" y="58" width="38" height="32" rx="3"/>
    <path d="M145 66v16M137 74h16" stroke-width="3"/>
    <path d="M124 48h42" stroke-opacity="0.5"/>
    <g transform="rotate(-28 50 82)"><rect x="28" y="74" width="44" height="17" rx="8.5" ${soft}/><path d="M50 74v17"/></g>
    <g transform="rotate(24 86 56)"><rect x="66" y="48" width="40" height="15" rx="7.5" ${soft}/><path d="M86 48v15"/></g>
    <circle cx="88" cy="100" r="11" ${soft}/><path d="M80 100h16" stroke-opacity="0.7"/>
    <circle cx="62" cy="112" r="8" ${soft}/>
    <path d="M18 122h170" stroke-opacity="0.3"/>`),

  document: svg(`
    <path d="M56 6h56l22 22v94H56z" ${soft}/>
    <path d="M112 6v22h22"/>
    <path d="M66 26h34" stroke-width="3.2"/>
    ${[42, 52, 62, 72, 82].map((y, i) => `<path d="M66 ${y}h${[56, 50, 58, 44, 52][i]}" stroke-opacity="0.75"/>`).join('')}
    <path d="M66 104c6-8 10 4 16-4s8 6 14-2" stroke-opacity="0.8"/>
    <circle cx="140" cy="88" r="17" fill="#1a1a1a"/><circle cx="140" cy="88" r="17"/>
    <path d="M152 100l16 16" stroke-width="5"/>
    <path d="M132 88l6 6 10-12" stroke-width="3"/>`),
};
