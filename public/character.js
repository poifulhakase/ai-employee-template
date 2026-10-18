// AI社員のキャラクター（画面イメージの SVG をそのまま関数にしたもの）

const POSES = {
  wave: { t: 'rotate(-6 60 70)', armL: 'M30 80 Q 20 90 26 100', armR: 'M90 78 Q 104 66 104 48', hL: [26, 100], hR: [104, 48], mouth: 'M54 76 q6 5 12 0', laptop: 0, spark: 1, zzz: 0, eyes: 1 },
  laptop: { t: 'rotate(3 60 70)', armL: 'M30 80 Q 28 92 42 96', armR: 'M90 80 Q 92 92 78 96', hL: [42, 96], hR: [78, 96], mouth: 'M55 77 q5 3 10 0', laptop: 1, spark: 0, zzz: 0, eyes: 1 },
  jump: { t: 'translate(0 -10)', armL: 'M30 76 Q 14 66 18 46', armR: 'M90 76 Q 106 66 102 46', hL: [18, 46], hR: [102, 46], mouth: 'M53 75 q7 8 14 0 z', laptop: 0, spark: 1, zzz: 0, eyes: 1 },
  rest: { t: 'rotate(8 60 70) translate(0 4)', armL: 'M30 82 Q 24 94 34 100', armR: 'M90 82 Q 96 94 86 100', hL: [34, 100], hR: [86, 100], mouth: 'M57 77 q3 2 6 0', laptop: 0, spark: 0, zzz: 1, eyes: 0 },
};

const FUR = (() => {
  const cx = 60, cy = 64, rx = 37, ry = 42, n = 24, bump = 4.5;
  const pt = (th) => [cx + rx * Math.cos(th), cy + ry * Math.sin(th)];
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    const cxp = cx + (rx + bump * 2.2) * Math.cos(am), cyp = cy + (ry + bump * 2.2) * Math.sin(am);
    d += (i === 0 ? `M${x0.toFixed(1)} ${y0.toFixed(1)}` : '') + ` Q${cxp.toFixed(1)} ${cyp.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d + ' Z';
})();

export function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const m = (c) => Math.round(c * (1 - t)).toString(16).padStart(2, '0');
  return '#' + m((n >> 16) & 255) + m((n >> 8) & 255) + m(n & 255);
}

let uid = 0;

/** @param {{shirt:string, shirtLight:string, shirtDark:string}} c 色 @param {string} acc 小物 @param {keyof POSES} pose */
export function characterSvg(c, acc, pose, size = 150) {
  const p = POSES[pose] ?? POSES.laptop;
  const id = `c${++uid}`;
  const show = (on) => (on ? 1 : 0);
  return `
<svg width="${size}" height="${size}" viewBox="0 0 120 120" fill="none" aria-hidden="true">
  <ellipse class="${pose === 'jump' ? 'shadow-jump' : ''}" cx="60" cy="114" rx="26" ry="4" fill="#2b3340" opacity="0.16"/>
  <g transform="${p.t}"><g class="anim-${pose}">
    <path d="${p.armL}" stroke="${c.shirt}" stroke-width="11" stroke-linecap="round"/>
    <g class="${pose === 'wave' ? 'armwave' : ''}">
      <path d="${p.armR}" stroke="${c.shirt}" stroke-width="11" stroke-linecap="round"/>
      <circle cx="${p.hR[0]}" cy="${p.hR[1]}" r="7" fill="${c.shirtLight}"/>
    </g>
    <ellipse cx="50" cy="106" rx="9" ry="5.5" fill="${c.shirtLight}"/>
    <ellipse cx="70" cy="106" rx="9" ry="5.5" fill="${c.shirtLight}"/>
    <defs><radialGradient id="g-${id}" cx="42%" cy="30%" r="72%">
      <stop offset="0" stop-color="${c.shirtLight}"/><stop offset="0.5" stop-color="${c.shirt}"/><stop offset="1" stop-color="${c.shirtDark}"/>
    </radialGradient></defs>
    <path d="${FUR}" fill="url(#g-${id})"/>
    <path d="M60 18 c -3 -7 -9 -8 -11 -3 c 4 -2 8 0 11 3 z" fill="${c.shirtLight}"/>
    <ellipse cx="60" cy="88" rx="22" ry="13" fill="${c.shirtLight}" opacity="0.8"/>
    <ellipse cx="45" cy="38" rx="7" ry="10" fill="#fff" opacity="0.45"/>
    <g opacity="${p.eyes}">
      <ellipse cx="48" cy="62" rx="6" ry="7" fill="#2b2320"/><ellipse cx="72" cy="62" rx="6" ry="7" fill="#2b2320"/>
      <circle cx="50.5" cy="59" r="2.4" fill="#fff"/><circle cx="74.5" cy="59" r="2.4" fill="#fff"/>
      <circle cx="46" cy="65" r="1.2" fill="#fff"/><circle cx="70" cy="65" r="1.2" fill="#fff"/>
    </g>
    <g opacity="${1 - p.eyes}">
      <path d="M42 63 q6 5 12 0" stroke="#2b2320" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M66 63 q6 5 12 0" stroke="#2b2320" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <ellipse cx="38" cy="72" rx="7" ry="4.5" fill="#ffb3bd" opacity="0.75"/>
    <ellipse cx="82" cy="72" rx="7" ry="4.5" fill="#ffb3bd" opacity="0.75"/>
    <path d="${p.mouth}" stroke="#2b2320" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <g opacity="${show(acc === 'bow')}">
      <ellipse cx="78" cy="30" rx="7" ry="4.5" transform="rotate(-25 78 30)" fill="#ff7aa8" stroke="#a84f6e" stroke-width="1.5"/>
      <ellipse cx="90" cy="34" rx="7" ry="4.5" transform="rotate(25 90 34)" fill="#ff7aa8" stroke="#a84f6e" stroke-width="1.5"/>
      <circle cx="84" cy="32" r="3" fill="#ffd0e0"/>
    </g>
    <g opacity="${show(acc === 'glasses')}">
      <circle cx="48" cy="62" r="9.5" stroke="#5b4a44" stroke-width="2"/><circle cx="72" cy="62" r="9.5" stroke="#5b4a44" stroke-width="2"/>
      <path d="M57.5 62 h5" stroke="#5b4a44" stroke-width="2"/>
    </g>
    <g opacity="${show(acc === 'headset')}">
      <path d="M30 60 a30 30 0 0 1 60 0" stroke="#4a3b35" stroke-width="3.5"/>
      <rect x="24" y="56" width="8" height="12" rx="3" fill="#4a3b35"/><rect x="88" y="56" width="8" height="12" rx="3" fill="#4a3b35"/>
      <path d="M30 68 q0 12 14 12" stroke="#4a3b35" stroke-width="2.5"/><circle cx="44" cy="80" r="2.5" fill="#4a3b35"/>
    </g>
    <g opacity="${show(acc === 'sprout')}">
      <path d="M60 20 q0 -8 0 -10" stroke="#3a8f4a" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M60 11 q-8 -4 -8 2 q4 4 8 -2 z" fill="#5fc46f" stroke="#3a8f4a" stroke-width="1.5"/>
      <path d="M60 11 q8 -4 8 2 q-4 4 -8 -2 z" fill="#5fc46f" stroke="#3a8f4a" stroke-width="1.5"/>
    </g>
    <g opacity="${show(acc === 'cap')}">
      <path d="M34 36 a26 18 0 0 1 52 0 z" fill="${c.shirtDark}"/>
      <path d="M30 36 h60" stroke="${c.shirtDark}" stroke-width="4" stroke-linecap="round"/>
      <path d="M86 36 q14 -2 14 6" stroke="${c.shirtDark}" stroke-width="4" stroke-linecap="round"/>
    </g>
    <g opacity="${show(acc === 'halo')}"><ellipse cx="60" cy="14" rx="14" ry="4" stroke="#ffd36a" stroke-width="3"/></g>
    <circle cx="${p.hL[0]}" cy="${p.hL[1]}" r="7" fill="${c.shirtLight}"/>
    <g opacity="${p.laptop}">
      <rect x="40" y="84" width="40" height="20" rx="5" fill="#5b4a44"/>
      <rect class="screen" x="44" y="88" width="32" height="12" rx="2" fill="#9fd7ff"/>
      <path d="M58 94 l3 3 l5 -5" stroke="#5b4a44" stroke-width="1.5"/>
    </g>
  </g>
  <g opacity="${p.spark}">
    <path class="spark" d="M100 28 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z" fill="#ffd36a"/>
    <path class="spark2" d="M18 40 l1.5 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 z" fill="#ffd36a"/>
    <circle class="spark2" cx="104" cy="52" r="2" fill="#ff8a8a"/><circle class="spark" cx="14" cy="60" r="2" fill="#9fd7ff"/>
  </g>
  <g opacity="${p.zzz}"><text class="zzz" x="90" y="36" font-family="Zen Maru Gothic, sans-serif" font-size="12" font-weight="900" fill="#8a7a74">zzz</text></g>
  </g>
</svg>`;
}
