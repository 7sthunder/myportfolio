// Brushed-silver line icons for the achievements cards (shared gradient in <SilverDefs />).

const star = (cx, cy, R, r) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r : R;
    return `${i ? 'L' : 'M'}${(cx + Math.cos(a) * d).toFixed(2)} ${(cy + Math.sin(a) * d).toFixed(2)}`;
  }).join('') + 'Z';

// Laurel branch: leaves along an arc around the badge (angles in degrees, y down), each one
// rotated to follow the arc. side -1 = left branch, 1 = right branch.
const leaves = (side) =>
  Array.from({ length: 6 }, (_, i) => {
    const deg = side < 0 ? 125 + i * 21 : 55 - i * 21;
    const a = (deg * Math.PI) / 180;
    const x = (32 + Math.cos(a) * 21).toFixed(2);
    const y = (30 + Math.sin(a) * 21).toFixed(2);
    return <ellipse key={i} cx={x} cy={y} rx="2.4" ry="5.2" transform={`rotate(${deg} ${x} ${y})`} />;
  });

export function SilverDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pp-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#c9c9cf" />
          <stop offset="0.7" stopColor="#7d7d85" />
          <stop offset="1" stopColor="#d7d7dc" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const icons = {
  trophy: (
    <>
      <path d="M20 9h24v14c0 9-5.4 15-12 15s-12-6-12-15z" fill="url(#pp-silver)" />
      <path d="M20 13h-7c0 8 3.4 13 9 14M44 13h7c0 8-3.4 13-9 14" fill="none" stroke="url(#pp-silver)" strokeWidth="2.6" />
      <path d="M29 38h6v8h-6z" fill="url(#pp-silver)" />
      <path d="M23 46h18v4H23zM19.5 50h25v5.5h-25z" fill="url(#pp-silver)" />
      <path d="M25 13v9c0 5 2 8.5 5 10" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" />
    </>
  ),
  medal: (
    <>
      <path d="M19 5h9l7 16h-9zM45 5h-9l-7 16h9z" fill="url(#pp-silver)" opacity="0.85" />
      <circle cx="32" cy="39" r="15.5" fill="url(#pp-silver)" />
      <circle cx="32" cy="39" r="11" fill="none" stroke="#2a2a30" strokeOpacity="0.55" strokeWidth="1.6" />
      <path d={star(32, 39.5, 7, 3)} fill="#2a2a30" fillOpacity="0.6" />
    </>
  ),
  code: (
    <path
      d="M21 19 8.5 32 21 45M43 19l12.5 13L43 45M36.5 12l-9 40"
      fill="none"
      stroke="url(#pp-silver)"
      strokeWidth="4.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  laurel: (
    <>
      <g fill="url(#pp-silver)">
        {leaves(-1)}
        {leaves(1)}
      </g>
      <circle cx="32" cy="29" r="13" fill="url(#pp-silver)" />
      <circle cx="32" cy="29" r="9.5" fill="none" stroke="#2a2a30" strokeOpacity="0.55" strokeWidth="1.5" />
      <path d={star(32, 29.5, 6, 2.6)} fill="#2a2a30" fillOpacity="0.6" />
      <path d="M24 52c3-4 5.5-6 8-7 2.5 1 5 3 8 7" fill="none" stroke="url(#pp-silver)" strokeWidth="2.2" />
    </>
  ),
};

export function MilestoneIcon({ name }) {
  return (
    <svg className="pp-ach__icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {icons[name] ?? icons.trophy}
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg className="pp-exp__cal" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 13.5h1.5M11.25 13.5h1.5M14.5 13.5H16M8 16.5h1.5M11.25 16.5h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
