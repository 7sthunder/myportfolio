// Brushed-silver illustrations for the works section (gradient: <SilverDefs /> in MilestoneIcons).
// The particles assemble into exactly these shapes (experience/glyphTargets.js): silver areas
// become particles, the dark details (#2a2a30) stay empty, so keep them as clean separations.

const silver = 'url(#pp-silver)';
const dark = '#2a2a30';
const line = '#d2d2d8';
const edge = { stroke: dark, strokeWidth: 1.6 };

const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

const Wheel = ({ x }) => (
  <g>
    <circle cx={x} cy="126" r="12.5" fill={silver} stroke={dark} strokeWidth="2.6" />
    <circle cx={x} cy="126" r="5.2" fill="none" stroke={dark} strokeWidth="2" />
    <circle cx={x} cy="126" r="1.8" fill={dark} />
  </g>
);

const art = {
  truck: (
    <>
      <path d="M8 147h224" stroke={line} strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="16 10" />
      <rect x="12" y="32" width="150" height="82" rx="3" fill={silver} />
      <g stroke={dark} strokeOpacity="0.5" strokeWidth="1.4">
        {range(22, 152, 10).map((x) => (
          <path key={x} d={`M${x} 40v66`} />
        ))}
        <path d="M12 40h150M12 106h150" strokeOpacity="0.65" />
      </g>
      <rect x="163" y="28" width="4.5" height="34" rx="1.5" fill={silver} />
      <rect x="8" y="114" width="208" height="7" rx="1.5" fill={silver} {...edge} />
      <path d="M169 114V56a6 6 0 0 1 6-6h24c5 0 8 2 10 6l12 26c1.5 3 2 5 2 8v24z" fill={silver} {...edge} />
      <path d="M177 58h20c2.5 0 4 1 5 3l9.5 21H177z" fill={dark} fillOpacity="0.8" />
      <path d="M197 88v24M184 94h8" stroke={dark} strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="215" y="96" width="8" height="6" rx="2" fill={dark} fillOpacity="0.7" />
      {[34, 60, 146, 201].map((x) => (
        <Wheel key={x} x={x} />
      ))}
    </>
  ),

  dumbbell: (
    <g transform="rotate(-8 120 80)">
      <rect x="66" y="74" width="108" height="12" rx="4" fill={silver} />
      <g stroke={dark} strokeOpacity="0.5" strokeWidth="1.1">
        {range(90, 150, 5).map((x) => (
          <path key={x} d={`M${x} 76.5v7`} />
        ))}
      </g>
      {[
        [6, 74, 10, 12, 3],
        [16, 44, 14, 72, 6],
        [30, 28, 28, 104, 8],
        [58, 66, 10, 28, 2.5],
      ].map(([x, y, w, h, r]) => (
        <g key={x}>
          <rect x={x} y={y} width={w} height={h} rx={r} fill={silver} {...edge} />
          <rect x={240 - x - w} y={y} width={w} height={h} rx={r} fill={silver} {...edge} />
        </g>
      ))}
      <rect x="36.5" y="38" width="15" height="84" rx="6" fill="none" stroke={dark} strokeOpacity="0.5" strokeWidth="1.4" />
      <rect x="188.5" y="38" width="15" height="84" rx="6" fill="none" stroke={dark} strokeOpacity="0.5" strokeWidth="1.4" />
    </g>
  ),

  interview: (
    <>
      {/* chair */}
      <rect x="22" y="60" width="7" height="58" rx="3" fill={silver} opacity="0.75" />
      <rect x="22" y="100" width="48" height="7" rx="3" fill={silver} opacity="0.75" />
      <path d="M28 107v36M64 107v36" stroke={line} strokeOpacity="0.75" strokeWidth="4" strokeLinecap="round" />
      {/* candidate: seated, in a tie, holding a resume */}
      <rect x="80" y="98" width="11" height="40" rx="4" fill={silver} {...edge} />
      <path d="M80 136h16a4 4 0 0 1 0 8H80z" fill={silver} {...edge} />
      <rect x="48" y="92" width="43" height="13" rx="5.5" fill={silver} {...edge} />
      <path d="M36 102V80c0-11 8-18 19-18s19 7 19 18v22z" fill={silver} {...edge} />
      <path d="M50 63l5 8 5-8" fill="none" stroke={dark} strokeWidth="1.6" />
      <path d="M55 71l-3 5 3 17 3-17z" fill={dark} fillOpacity="0.75" />
      <circle cx="55" cy="47" r="12" fill={silver} {...edge} />
      <path d="M64 79l15 9" stroke={line} strokeWidth="7" strokeLinecap="round" />
      <g transform="rotate(-10 92 82)">
        <rect x="84" y="71" width="16" height="21" rx="1.5" fill={silver} {...edge} />
        <path d="M88 77h8M88 81h8M88 85h5" stroke={dark} strokeOpacity="0.6" strokeWidth="1.3" strokeLinecap="round" />
      </g>
      {/* speech bubble */}
      <path
        d="M80 8h34a9 9 0 0 1 9 9v10a9 9 0 0 1-9 9H92l-13 10 2-10a9 9 0 0 1-9-9V17a9 9 0 0 1 8-9z"
        fill={silver}
        {...edge}
      />
      {[87, 97, 107].map((x) => (
        <circle key={x} cx={x} cy="22" r="2.7" fill={dark} />
      ))}
      {/* interviewer behind the desk, with a laptop */}
      <path d="M170 96V80c0-11 9-18 20-18s20 7 20 18v16z" fill={silver} {...edge} />
      <path d="M185 63l5 7 5-7" fill="none" stroke={dark} strokeWidth="1.6" />
      <circle cx="190" cy="47" r="12" fill={silver} {...edge} />
      <path d="M128 96l8-30h31l-8 30z" fill={silver} {...edge} />
      <circle cx="148" cy="81" r="3" fill={dark} />
      <rect x="112" y="96" width="116" height="7" rx="2" fill={silver} {...edge} />
      <path d="M118 103v40M222 103v40" stroke={line} strokeOpacity="0.85" strokeWidth="4" strokeLinecap="round" />
    </>
  ),

  stamp: (
    <>
      <path d="M111 34c2 9 1 15-5 24h28c-6-9-7-15-5-24z" fill={silver} {...edge} />
      <ellipse cx="120" cy="24" rx="17" ry="13" fill={silver} {...edge} />
      <rect x="82" y="58" width="76" height="18" rx="4" fill={silver} {...edge} />
      <rect x="88" y="76" width="64" height="8" rx="2" fill={silver} opacity="0.8" {...edge} />
      <path d="M100 66h40" stroke={dark} strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M72 82l-10 5M168 82l10 5M76 92l-13 2M164 92l13 2" stroke={line} strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
      <g transform="rotate(-5 120 124)">
        <rect x="62" y="102" width="116" height="42" rx="6" fill="none" stroke={line} strokeWidth="3.2" />
        <rect x="68.5" y="108.5" width="103" height="29" rx="3" fill="none" stroke={line} strokeOpacity="0.6" strokeWidth="1.3" />
        <text
          x="120"
          y="129.5"
          fill="#ececf0"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="17"
          fontWeight="700"
          letterSpacing="2.5"
          textAnchor="middle"
        >
          APPROVED
        </text>
      </g>
    </>
  ),

  pills: (
    <>
      <rect x="140" y="31" width="40" height="10" fill={silver} {...edge} />
      <rect x="126" y="40" width="68" height="108" rx="10" fill={silver} {...edge} />
      <rect x="134" y="12" width="52" height="20" rx="4" fill={silver} {...edge} />
      <g stroke={dark} strokeOpacity="0.5" strokeWidth="1.2">
        {range(142, 178, 6).map((x) => (
          <path key={x} d={`M${x} 16v12`} />
        ))}
      </g>
      <rect x="134" y="66" width="52" height="58" rx="4" fill={dark} fillOpacity="0.78" />
      <path d="M154 80h12v13h13v12h-13v13h-12v-13h-13V93h13z" fill="#ececf0" />
      <path d="M134 50v8" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.4" strokeLinecap="round" />
      <g transform="rotate(-32 70 104)">
        <path d="M48 92h22v24H48a12 12 0 0 1 0-24z" fill={silver} {...edge} />
        <path d="M70 93.3h22a10.7 10.7 0 0 1 0 21.4H70z" fill="none" stroke={line} strokeWidth="2.6" />
      </g>
      <g transform="rotate(28 58 50)">
        <path d="M42 42h16v16H42a8 8 0 0 1 0-16z" fill={silver} {...edge} />
        <path d="M58 43.1h16a6.9 6.9 0 0 1 0 13.8H58z" fill="none" stroke={line} strokeWidth="2.2" />
      </g>
      <circle cx="104" cy="139" r="12" fill={silver} {...edge} />
      <path d="M96 139h16" stroke={dark} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="30" cy="134" r="9" fill={silver} {...edge} />
      <path d="M25 129l10 10" stroke={dark} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="98" cy="58" r="6" fill={silver} {...edge} />
    </>
  ),

  document: (
    <>
      <path d="M56 8h74l28 28v116H56z" fill={silver} {...edge} />
      <path d="M130 8v28h28" fill={dark} fillOpacity="0.35" stroke={dark} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="68" y="24" width="42" height="6" rx="3" fill={dark} fillOpacity="0.75" />
      {[
        [46, 76],
        [58, 66],
        [70, 76],
        [82, 54],
        [94, 70],
        [106, 48],
      ].map(([y, w]) => (
        <rect key={y} x="68" y={y} width={w} height="4" rx="2" fill={dark} fillOpacity="0.55" />
      ))}
      <path d="M68 134c6-9 10 4 15-3s8 6 13-1 6 4 10 0" fill="none" stroke={dark} strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
      <path d="M177 125l25 25" stroke={line} strokeWidth="11" strokeLinecap="round" />
      <circle cx="157" cy="105" r="27" fill={dark} fillOpacity="0.94" stroke={silver} strokeWidth="7" />
      <path d="M144 106l9 9 17-19" fill="none" stroke="#f2f2f5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export default function WorkArt({ name }) {
  return (
    <svg className="pp-work__svg" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
      {art[name]}
    </svg>
  );
}
