import { useSyncExternalStore } from 'react';
import { BUILT_IN_EXERCISES, EXERCISE_MAP } from '../data/exercises';
import type { ActiveWorkout, Exercise, RestTimer, Routine, Settings, Workout } from '../types';

export interface State {
  workouts: Workout[]; // newest first
  routines: Routine[];
  customExercises: Exercise[];
  settings: Settings;
  active: ActiveWorkout | null;
  rest: RestTimer | null;
}

const LEGACY_KEY = 'repcount:v1';
const PREFIX = 'repcount:v2:';

export const DEFAULT_SETTINGS: Settings = {
  unit: 'kg',
  distanceUnit: 'km',
  defaultRest: 90,
  restSound: true,
  restVibrate: true,
  name: 'Athlete',
};

/*
 * Each slice of state is stored under its own key and only rewritten when it changes, so
 * typing into the active workout doesn't re-serialise your whole history on every keystroke.
 */
const SLICES: Record<string, (keyof State)[]> = {
  workouts: ['workouts'],
  routines: ['routines'],
  customExercises: ['customExercises'],
  settings: ['settings'],
  session: ['active', 'rest'],
};

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function load(): State {
  const empty: State = { workouts: [], routines: [], customExercises: [], settings: DEFAULT_SETTINGS, active: null, rest: null };
  const legacy = read<Partial<State>>(LEGACY_KEY);
  if (legacy) return { ...empty, ...legacy, settings: { ...DEFAULT_SETTINGS, ...(legacy.settings ?? {}) } };
  const session = read<Pick<State, 'active' | 'rest'>>(PREFIX + 'session');
  return {
    workouts: read(PREFIX + 'workouts') ?? [],
    routines: read(PREFIX + 'routines') ?? [],
    customExercises: read(PREFIX + 'customExercises') ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(PREFIX + 'settings') ?? {}) },
    active: session?.active ?? null,
    rest: session?.rest ?? null,
  };
}

let state: State = load();
const listeners = new Set<() => void>();
let saved: Partial<State> = {}; // what's currently written to storage (compared by reference)
let timer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  clearTimeout(timer);
  timer = undefined;
  for (const [key, fields] of Object.entries(SLICES)) {
    if (fields.every((f) => saved[f] === state[f])) continue;
    try {
      const value = fields.length === 1 ? state[fields[0]] : Object.fromEntries(fields.map((f) => [f, state[f]]));
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      for (const f of fields) Object.assign(saved, { [f]: state[f] });
    } catch {
      // storage full or unavailable – keep in memory
    }
  }
}

try {
  if (localStorage.getItem(LEGACY_KEY) !== null) {
    // First run after upgrading from the single-key format: write the new keys, then drop the old one.
    flush();
    localStorage.removeItem(LEGACY_KEY);
  } else saved = { ...state };
} catch {
  /* storage unavailable */
}

// Save immediately if the app is backgrounded or closed.
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
window.addEventListener('pagehide', flush);

function persist() {
  if (timer === undefined) timer = setTimeout(flush, 300);
}

export function getState(): State {
  return state;
}

export function setState(update: Partial<State> | ((s: State) => Partial<State>)) {
  const patch = typeof update === 'function' ? update(state) : update;
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_MAP[id] ?? state.customExercises.find((e) => e.id === id);
}

const byName = (a: Exercise, b: Exercise) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
let builtInSorted: Exercise[] | undefined;
let allCache: { custom: Exercise[]; list: Exercise[] } | undefined;

/** Every exercise (built-in + custom), sorted by name. Cached until custom exercises change. */
export function allExercises(s: State = state): Exercise[] {
  if (allCache?.custom === s.customExercises) return allCache.list;
  builtInSorted ??= [...BUILT_IN_EXERCISES].sort(byName);
  const list = s.customExercises.length ? [...builtInSorted, ...s.customExercises].sort(byName) : builtInSorted;
  allCache = { custom: s.customExercises, list };
  return list;
}

export function exportData(): string {
  const { workouts, routines, customExercises, settings } = state;
  return JSON.stringify({ app: 'repcount', version: 1, exportedAt: Date.now(), workouts, routines, customExercises, settings }, null, 2);
}

export function importData(json: string) {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.workouts)) throw new Error('Not a valid backup file');
  setState({
    workouts: data.workouts,
    routines: data.routines ?? [],
    customExercises: data.customExercises ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
  });
}
