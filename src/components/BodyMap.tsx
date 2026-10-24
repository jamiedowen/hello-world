import type { Muscle } from '../types';

/*
 * Anatomical body map. Each figure is drawn in a 200×400 box. Paths are written for the
 * figure's left half (x < 100) and mirrored, except where `center` is set.
 */

type Part = { m: Muscle; d: string; center?: boolean };

const SILHOUETTE = {
  torso:
    'M78 58C70 64 58 64 52 72C44 80 44 96 48 110L58 120C60 150 62 175 64 195C62 205 62 215 66 222L134 222C138 215 138 205 136 195C138 175 140 150 142 120L152 110C156 96 156 80 148 72C142 64 130 64 122 58Z',
  arm: 'M50 76C40 86 36 110 35 130C34 142 31 150 29 160C25 180 22 198 22 212C18 222 16 232 20 240C24 244 30 238 32 230C34 222 34 216 34 212C38 196 44 178 47 160C50 150 54 135 58 120Z',
  leg: 'M66 218C62 240 62 265 66 290C66 310 66 340 72 368C70 378 64 386 70 390L92 390C94 384 90 376 90 368C92 340 94 312 94 292C96 270 98 240 100 226Z',
};

const SHOULDER = 'M52 74C60 68 72 70 76 78C70 84 64 92 58 104C52 104 46 100 46 92C46 84 48 78 52 74Z';
const FOREARM = 'M36 158C42 156 46 160 45 166C42 182 38 196 34 208C28 208 25 204 25 198C27 184 30 170 36 158Z';

const FRONT: Part[] = [
  { m: 'traps', d: 'M90 56C84 62 72 67 62 71C72 71 82 70 91 64Z' },
  { m: 'shoulders', d: SHOULDER },
  { m: 'chest', d: 'M98 76L98 112C90 118 76 118 66 112C62 104 62 94 66 86C74 78 86 74 98 76Z' },
  { m: 'biceps', d: 'M46 104C52 104 56 110 56 118C54 132 50 144 46 150C40 148 38 140 38 130C39 118 42 108 46 104Z' },
  { m: 'forearms', d: FOREARM },
  { m: 'abdominals', d: 'M98 118L98 192C92 196 86 194 84 188C82 168 82 140 84 122C88 118 94 117 98 118Z' },
  { m: 'obliques', d: 'M80 124C82 145 82 170 82 186C76 182 70 176 67 168C66 155 64 140 64 124C70 120 76 120 80 124Z' },
  { m: 'abductors', d: 'M66 200C70 206 72 214 70 222C66 226 64 222 64 214C64 208 64 204 66 200Z' },
  { m: 'quadriceps', d: 'M72 226C82 224 92 232 93 244C93 262 91 282 88 292C80 294 74 292 70 284C66 268 66 246 72 226Z' },
  { m: 'adductors', d: 'M96 232C99 242 99 256 96 266C94 256 94 242 96 232Z' },
  { m: 'calves', d: 'M70 304C76 304 80 312 80 322C80 338 78 352 74 360C70 352 68 336 68 322C68 314 68 308 70 304Z' },
];

const BACK: Part[] = [
  {
    m: 'traps',
    center: true,
    d: 'M100 50C104 56 114 64 140 72C128 78 116 84 108 96L100 130L92 96C84 84 72 78 60 72C86 64 96 56 100 50Z',
  },
  { m: 'shoulders', d: SHOULDER },
  { m: 'upper_back', d: 'M66 86C76 84 86 90 92 100L96 118C86 116 76 110 68 104C64 98 64 92 66 86Z' },
  { m: 'lats', d: 'M64 108C76 116 88 122 96 126L96 150C90 162 82 172 74 178C68 166 64 146 60 124C60 116 61 110 64 108Z' },
  { m: 'lower_back', d: 'M98 140L98 196C92 196 86 192 82 186C86 172 92 158 98 140Z' },
  { m: 'triceps', d: 'M44 100C50 102 56 108 56 118C54 132 50 144 46 150C40 148 37 140 37 128C38 116 40 106 44 100Z' },
  { m: 'forearms', d: FOREARM },
  { m: 'glutes', d: 'M98 200C98 214 98 226 96 236C86 240 74 238 68 230C64 220 64 208 70 200C80 196 90 196 98 200Z' },
  { m: 'hamstrings', d: 'M72 244C82 242 92 246 93 256C93 272 91 286 88 294C80 296 74 292 70 284C66 270 66 256 72 244Z' },
  { m: 'calves', d: 'M70 302C78 300 86 306 88 318C88 334 84 348 80 356C74 354 70 346 68 334C66 322 66 310 70 302Z' },
];

const COLORS = {
  body: '#1d1d21',
  outline: '#55555c',
  idle: '#38383e',
  primary: '#e5392f',
  secondary: '#f5b937',
};

const MIRROR = 'translate(200 0) scale(-1 1)';

function Figure({ parts, color }: { parts: Part[]; color: (m: Muscle) => string }) {
  const silhouette = (
    <>
      <ellipse cx={100} cy={28} rx={16} ry={20} />
      <rect x={90} y={42} width={20} height={22} rx={4} />
      <path d={SILHOUETTE.torso} />
      <path d={SILHOUETTE.arm} />
      <path d={SILHOUETTE.arm} transform={MIRROR} />
      <path d={SILHOUETTE.leg} />
      <path d={SILHOUETTE.leg} transform={MIRROR} />
    </>
  );
  return (
    <svg viewBox="0 0 200 400" style={{ display: 'block', height: '100%', width: 'auto' }}>
      {/* Outline: draw the silhouette with a thick stroke, then again filled to hide inner seams. */}
      <g fill={COLORS.outline} stroke={COLORS.outline} strokeWidth={4} strokeLinejoin="round">
        {silhouette}
      </g>
      <g fill={COLORS.body}>{silhouette}</g>
      <g stroke={COLORS.body} strokeWidth={1.6} strokeLinejoin="round">
        {parts.map((p, i) => (
          <g key={i} fill={color(p.m)}>
            <path d={p.d} />
            {!p.center && <path d={p.d} transform={MIRROR} />}
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Front + back figures. `intensity` 0–1 per muscle: ≥0.6 shows as primary (red), >0 as secondary (yellow). */
export function BodyMap({ intensity, height = 280, legend = true }: { intensity: Partial<Record<Muscle, number>>; height?: number; legend?: boolean }) {
  const color = (m: Muscle) => {
    const v = Math.max(intensity[m] ?? 0, (intensity.full_body ?? 0) * 0.5);
    if (v >= 0.6) return COLORS.primary;
    if (v > 0) return COLORS.secondary;
    return COLORS.idle;
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6%', height }}>
        <Figure parts={FRONT} color={color} />
        <Figure parts={BACK} color={color} />
      </div>
      {legend && (
        <div className="row small muted" style={{ justifyContent: 'center', gap: 18, marginTop: 10 }}>
          <span className="row" style={{ gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: COLORS.primary }} /> Primary
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: COLORS.secondary }} /> Secondary
          </span>
        </div>
      )}
    </div>
  );
}

export function intensityFromSplit(split: { muscle: Muscle; sets: number }[]): Partial<Record<Muscle, number>> {
  const max = Math.max(1, ...split.map((s) => s.sets));
  return Object.fromEntries(split.map((s) => [s.muscle, s.sets / max]));
}
