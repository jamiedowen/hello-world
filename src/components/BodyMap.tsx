import type { ReactElement } from 'react';
import type { Muscle } from '../types';

type Shape = { m: Muscle | null; el: (fill: string, key: string) => ReactElement };

const e = (m: Muscle | null, cx: number, cy: number, rx: number, ry: number): Shape[] => [
  { m, el: (f, k) => <ellipse key={k} cx={cx} cy={cy} rx={rx} ry={ry} fill={f} /> },
  { m, el: (f, k) => <ellipse key={k} cx={100 - cx} cy={cy} rx={rx} ry={ry} fill={f} /> },
];
const r = (m: Muscle | null, x: number, y: number, w: number, h: number, mirror = true): Shape[] => {
  const out: Shape[] = [{ m, el: (f, k) => <rect key={k} x={x} y={y} width={w} height={h} rx={Math.min(w, h) / 3} fill={f} /> }];
  if (mirror) out.push({ m, el: (f, k) => <rect key={k} x={100 - x - w} y={y} width={w} height={h} rx={Math.min(w, h) / 3} fill={f} /> });
  return out;
};
const poly = (m: Muscle | null, pts: [number, number][], mirror = true): Shape[] => {
  const out: Shape[] = [{ m, el: (f, k) => <polygon key={k} points={pts.map((p) => p.join(',')).join(' ')} fill={f} /> }];
  if (mirror) out.push({ m, el: (f, k) => <polygon key={k} points={pts.map(([x, y]) => `${100 - x},${y}`).join(' ')} fill={f} /> });
  return out;
};

const HEAD: Shape[] = [
  { m: null, el: (f, k) => <circle key={k} cx={50} cy={13} r={10} fill={f} /> },
  ...r(null, 45, 22, 10, 8, false),
];

const FRONT: Shape[] = [
  ...HEAD,
  ...e('shoulders', 29, 40, 9, 8),
  ...r('chest', 34, 33, 15.5, 19),
  ...e('biceps', 23, 60, 5.5, 11),
  ...e('forearms', 19, 85, 4.5, 13),
  ...e(null, 17, 103, 3.5, 4),
  ...r('obliques', 34, 55, 6, 30),
  ...r('abdominals', 41, 54, 18, 36, false),
  ...e('abductors', 33, 98, 5, 9),
  ...e('quadriceps', 40, 126, 8.5, 23),
  ...e('adductors', 47, 112, 3, 12),
  ...e('calves', 40, 170, 5.5, 17),
  ...e(null, 40, 192, 5, 3),
];

const BACK: Shape[] = [
  ...HEAD,
  ...poly('traps', [[40, 27], [60, 27], [67, 36], [50, 46], [33, 36]], false),
  ...e('shoulders', 29, 40, 9, 8),
  ...r('upper_back', 41, 40, 18, 16, false),
  ...poly('lats', [[34, 44], [41, 50], [44, 74], [36, 70]]),
  ...e('triceps', 23, 60, 5.5, 11),
  ...e('forearms', 19, 85, 4.5, 13),
  ...e(null, 17, 103, 3.5, 4),
  ...r('lower_back', 43, 72, 14, 18, false),
  ...e('glutes', 42, 101, 9.5, 11),
  ...e('hamstrings', 41, 132, 7.5, 20),
  ...e('calves', 41, 170, 6.5, 17),
  ...e(null, 41, 192, 5, 3),
];

/** Front + back silhouettes with each muscle shaded by intensity (0–1). */
export function BodyMap({ intensity, height = 220 }: { intensity: Partial<Record<Muscle, number>>; height?: number }) {
  const fill = (m: Muscle | null) => {
    const base = 'var(--surface-3)';
    if (!m) return base;
    const v = Math.max(intensity[m] ?? 0, (intensity.full_body ?? 0) * 0.6);
    if (v <= 0) return base;
    return `rgba(29,131,234,${0.3 + 0.7 * Math.min(1, v)})`;
  };
  const draw = (shapes: Shape[]) => shapes.map((s, i) => s.el(fill(s.m), String(i)));
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
      {[{ label: 'Front', shapes: FRONT }, { label: 'Back', shapes: BACK }].map((side) => (
        <div key={side.label} style={{ textAlign: 'center' }}>
          <svg viewBox="0 0 100 200" height={height} style={{ display: 'block' }}>
            {draw(side.shapes)}
          </svg>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {side.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function intensityFromSplit(split: { muscle: Muscle; sets: number }[]): Partial<Record<Muscle, number>> {
  const max = Math.max(1, ...split.map((s) => s.sets));
  return Object.fromEntries(split.map((s) => [s.muscle, s.sets / max]));
}
