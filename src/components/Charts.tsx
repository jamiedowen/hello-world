import { useState } from 'react';

const W = 340;
const H = 170;
const PAD = { l: 8, r: 8, t: 26, b: 22 };

export function BarChart({ data, format }: { data: { label: string; value: number }[]; format: (v: number) => string }) {
  const [sel, setSel] = useState(data.length - 1);
  const max = Math.max(1, ...data.map((d) => d.value));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const bw = iw / data.length;
  const cur = data[sel];
  return (
    <div>
      <div className="row between small" style={{ marginBottom: 6 }}>
        <span className="muted">{cur?.label}</span>
        <strong>{cur ? format(cur.value) : '-'}</strong>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke="var(--border)" />
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t} y2={PAD.t} stroke="var(--border)" strokeDasharray="3 4" />
        {data.map((d, i) => {
          const h = (d.value / max) * ih;
          const x = PAD.l + i * bw + bw * 0.18;
          return (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              <rect x={PAD.l + i * bw} y={PAD.t} width={bw} height={ih} fill="transparent" />
              <rect
                x={x}
                y={PAD.t + ih - h}
                width={bw * 0.64}
                height={Math.max(h, d.value > 0 ? 2 : 0)}
                rx={3}
                fill={i === sel ? 'var(--accent)' : 'rgba(29,131,234,0.45)'}
              />
              {(data.length - 1 - i) % Math.ceil(data.length / 5) === 0 && (
                <text x={PAD.l + i * bw + bw / 2} y={H - 6} fontSize="10" fill="var(--text-3)" textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({ data, format }: { data: { label: string; value: number }[]; format: (v: number) => string }) {
  const [sel, setSel] = useState(data.length - 1);
  if (data.length === 0) return <div className="muted small">No data yet.</div>;
  const vals = data.map((d) => d.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - ((v - min) / (max - min)) * ih;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  const area = `${path} L${x(data.length - 1)},${PAD.t + ih} L${x(0)},${PAD.t + ih} Z`;
  const cur = data[Math.min(sel, data.length - 1)];
  return (
    <div>
      <div className="row between small" style={{ marginBottom: 6 }}>
        <span className="muted">{cur.label}</span>
        <strong>{format(cur.value)}</strong>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke="var(--border)" />
        <path d={area} fill="url(#lg)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(i)} cy={y(d.value)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(d.value)} r={i === sel ? 5 : 3} fill={i === sel ? '#fff' : 'var(--accent)'} stroke="var(--accent)" strokeWidth={2} />
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--text-3)">
          {data[0].label}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" fill="var(--text-3)" textAnchor="end">
          {data[data.length - 1].label}
        </text>
      </svg>
    </div>
  );
}
