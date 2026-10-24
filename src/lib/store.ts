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

const KEY = 'repcount:v1';

export const DEFAULT_SETTINGS: Settings = {
  unit: 'kg',
  distanceUnit: 'km',
  defaultRest: 90,
  restSound: true,
  restVibrate: true,
  name: 'Athlete',
};

function load(): State {
  const empty: State = { workouts: [], routines: [], customExercises: [], settings: DEFAULT_SETTINGS, active: null, rest: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      ...empty,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return empty;
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable – keep in memory
  }
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

export function allExercises(s: State = state): Exercise[] {
  return [...BUILT_IN_EXERCISES, ...s.customExercises].sort((a, b) => a.name.localeCompare(b.name));
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
