import type { Settings } from '../types';

export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function trim(n: number, dp = 1): string {
  return Number(n.toFixed(dp)).toLocaleString(undefined, { maximumFractionDigits: dp });
}

/** kg (storage) → display unit number */
export function toDisplayWeight(kg: number, s: Settings): number {
  return s.unit === 'kg' ? kg : kg / KG_PER_LB;
}
export function fromDisplayWeight(v: number, s: Settings): number {
  return s.unit === 'kg' ? v : v * KG_PER_LB;
}
export function toDisplayDistance(km: number, s: Settings): number {
  return s.distanceUnit === 'km' ? km : km / KM_PER_MI;
}
export function fromDisplayDistance(v: number, s: Settings): number {
  return s.distanceUnit === 'km' ? v : v * KM_PER_MI;
}

export function fmtWeight(kg: number, s: Settings, dp = 1): string {
  return `${trim(toDisplayWeight(kg, s), dp)} ${s.unit}`;
}
export function fmtDistance(km: number, s: Settings): string {
  return `${trim(toDisplayDistance(km, s), 2)} ${s.distanceUnit}`;
}

/** 3725 → "1h 2m" ; 95 → "1m 35s" */
export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return s ? `${m}m ${s}s` : `${m}min`;
  return `${s}s`;
}

/** 95 → "1:35" ; 3725 → "1:02:05" */
export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "1:35" / "95" / "1:02:05" → seconds */
export function parseClock(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return undefined;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function fmtPace(sec: number, km: number, s: Settings): string {
  const d = toDisplayDistance(km, s);
  if (!d || !sec) return '-';
  return `${fmtClock(sec / d)} /${s.distanceUnit}`;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
export function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString();
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmtShortDate(ts);
}

/** datetime-local input value helpers */
export function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(ts - off).toISOString().slice(0, 16);
}
/** Parse a datetime-local value; keeps `original` (with its seconds) if the minute wasn't changed. */
export function fromLocalInput(v: string, original?: number): number {
  if (original !== undefined && toLocalInput(original) === v) return original;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? (original ?? Date.now()) : t;
}
