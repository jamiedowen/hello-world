import { BleClient, type BleDevice } from '@capacitor-community/bluetooth-le';
import { useSyncExternalStore } from 'react';

/*
 * Live heart rate from any standard Bluetooth heart-rate sensor — chest straps, or a Garmin watch
 * with "Broadcast Heart Rate" turned on. Readings are kept here rather than in the app store so
 * a new beat every second doesn't re-render (or re-save) the workout screen.
 */

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const SAMPLES_KEY = 'repcount:v2:hr';
const SAMPLE_EVERY_MS = 2000;

export type HrStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface HrState {
  status: HrStatus;
  bpm: number | null;
  device: { id: string; name: string } | null;
  error?: string;
}

/** [secondsSinceWorkoutStart, bpm] */
export type HrSample = [number, number];

let state: HrState = { status: 'idle', bpm: null, device: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<HrState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useHeartRate(): HrState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ───── Recording ─────

let recording: { workoutId: string; startedAt: number; samples: HrSample[] } | null = null;
let lastSampleAt = 0;
let lastSavedAt = 0;

try {
  recording = JSON.parse(localStorage.getItem(SAMPLES_KEY) ?? 'null');
} catch {
  recording = null;
}

function saveSamples() {
  lastSavedAt = Date.now();
  try {
    localStorage.setItem(SAMPLES_KEY, JSON.stringify(recording));
  } catch {
    /* ignore */
  }
}

/** Start (or resume, after an app restart) recording samples for a workout. */
export function startRecording(workoutId: string, startedAt: number) {
  if (recording?.workoutId === workoutId) return;
  recording = { workoutId, startedAt, samples: [] };
  saveSamples();
}

/** Stop recording and return the samples captured for this workout. */
export function takeRecording(workoutId: string): HrSample[] | undefined {
  const r = recording?.workoutId === workoutId ? recording.samples : undefined;
  recording = null;
  try {
    localStorage.removeItem(SAMPLES_KEY);
  } catch {
    /* ignore */
  }
  return r && r.length ? r : undefined;
}

function onBeat(bpm: number) {
  set({ bpm });
  const now = Date.now();
  if (!recording || now - lastSampleAt < SAMPLE_EVERY_MS) return;
  lastSampleAt = now;
  recording.samples.push([Math.round((now - recording.startedAt) / 1000), bpm]);
  if (now - lastSavedAt > 30000) saveSamples();
}

/** Parses the standard Heart Rate Measurement characteristic (flags byte, then uint8 or uint16 bpm). */
function parseBpm(v: DataView): number {
  return v.getUint8(0) & 0x01 ? v.getUint16(1, true) : v.getUint8(1);
}

// ───── Connection ─────

let initialised = false;
let wanted = false; // keep reconnecting while true
let retryTimer: ReturnType<typeof setTimeout> | undefined;

async function init() {
  if (initialised) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  initialised = true;
}

/** Shows the system Bluetooth picker. Returns the chosen device, or null if cancelled. */
export async function pairDevice(showAll = false): Promise<{ id: string; name: string } | null> {
  try {
    await init();
    const d: BleDevice = await BleClient.requestDevice(showAll ? { optionalServices: [HR_SERVICE] } : { services: [HR_SERVICE] });
    return { id: d.deviceId, name: d.name ?? 'Heart rate monitor' };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (/cancel/i.test(msg)) return null;
    set({ status: 'error', error: msg });
    return null;
  }
}

export async function connect(device: { id: string; name: string }) {
  wanted = true;
  clearTimeout(retryTimer);
  if (state.status === 'connected' && state.device?.id === device.id) return;
  set({ status: state.status === 'reconnecting' ? 'reconnecting' : 'connecting', device, error: undefined });
  try {
    await init();
    await BleClient.connect(device.id, () => {
      set({ status: wanted ? 'reconnecting' : 'idle', bpm: null });
      if (wanted) retryTimer = setTimeout(() => connect(device), 4000);
    });
    await BleClient.startNotifications(device.id, HR_SERVICE, HR_MEASUREMENT, (v) => onBeat(parseBpm(v)));
    set({ status: 'connected' });
  } catch (e) {
    if (!wanted) return;
    set({ status: 'reconnecting', bpm: null, error: (e as Error).message });
    retryTimer = setTimeout(() => connect(device), 5000);
  }
}

export async function disconnect() {
  wanted = false;
  clearTimeout(retryTimer);
  const id = state.device?.id;
  set({ status: 'idle', bpm: null });
  if (id) await BleClient.disconnect(id).catch(() => {});
}

// ───── Analysis ─────

export const ZONES = [
  { name: 'Warm Up', min: 0.5, color: '#8e8e93' },
  { name: 'Easy', min: 0.6, color: '#1d83ea' },
  { name: 'Aerobic', min: 0.7, color: '#33c35b' },
  { name: 'Threshold', min: 0.8, color: '#f5b937' },
  { name: 'Maximum', min: 0.9, color: '#e5392f' },
];

export function hrSummary(samples: HrSample[], maxHr: number) {
  const bpms = samples.map((s) => s[1]);
  const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
  const max = Math.max(...bpms);
  // Time in each zone: each sample covers the gap until the next one (capped so pauses don't count).
  const zones = ZONES.map(() => 0);
  for (let i = 0; i < samples.length; i++) {
    const dt = Math.min(10, (samples[i + 1]?.[0] ?? samples[i][0] + 2) - samples[i][0]);
    const pct = samples[i][1] / maxHr;
    for (let z = ZONES.length - 1; z >= 0; z--) {
      if (pct >= ZONES[z].min) {
        zones[z] += dt;
        break;
      }
    }
  }
  return { avg, max, zones };
}

/** Averages samples into at most `points` buckets for charting. */
export function downsample(samples: HrSample[], points = 60): HrSample[] {
  if (samples.length <= points) return samples;
  const size = samples.length / points;
  return Array.from({ length: points }, (_, i) => {
    const chunk = samples.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    return [chunk[0][0], Math.round(chunk.reduce((a, s) => a + s[1], 0) / chunk.length)] as HrSample;
  });
}
