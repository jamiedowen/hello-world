import type { ActiveWorkout, Exercise, ExerciseType, Settings, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { fmtClock, fmtDistance, fmtPace, fmtWeight } from './format';
import { oneRepMax, setVolume, usesReps, usesWeight } from './stats';
import { getExercise } from './store';

export type RecordKey = 'weight' | 'oneRm' | 'setVolume' | 'sessionVolume' | 'reps' | 'distance' | 'duration' | 'pace';

export const RECORD_LABELS: Record<RecordKey, string> = {
  weight: 'Heaviest Weight',
  oneRm: 'Best 1RM',
  setVolume: 'Best Set Volume',
  sessionVolume: 'Best Session Volume',
  reps: 'Most Reps',
  distance: 'Longest Distance',
  duration: 'Longest Time',
  pace: 'Fastest Pace',
};

export interface RecordValue {
  value: number;
  date: number;
  workoutId: string;
  setId?: string;
  reps?: number; // for weight records: the reps done at that weight
}

export interface ExerciseRecords {
  best: Partial<Record<RecordKey, RecordValue>>;
  /** Heaviest weight lifted for exactly N reps. */
  repMax: Record<number, RecordValue>;
  sessions: number;
}

export interface PrEvent {
  exercise: Exercise;
  key: RecordKey;
  value: number;
  previous: number;
  setId?: string;
  date: number;
  workoutId: string;
}

export interface RecordIndex {
  byExercise: Map<string, ExerciseRecords>;
  byWorkout: Map<string, PrEvent[]>;
  prSets: Set<string>;
}

/** Which records apply to an exercise type. `pace` is lower-is-better, everything else higher. */
export function recordKeysFor(type: ExerciseType): RecordKey[] {
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      return ['weight', 'oneRm', 'setVolume', 'sessionVolume', 'reps'];
    case 'assisted_bodyweight':
    case 'bodyweight_reps':
      return ['reps'];
    case 'duration':
      return ['duration'];
    case 'distance_duration':
      return ['distance', 'duration', 'pace'];
    case 'weight_distance':
      return ['weight', 'distance'];
  }
}

const lowerIsBetter = (k: RecordKey) => k === 'pace';
const better = (k: RecordKey, a: number, b: number | undefined) => b === undefined || (lowerIsBetter(k) ? a < b : a > b);

function setValue(key: RecordKey, s: WorkoutSet, type: ExerciseType): number | undefined {
  if (!s.done || s.kind === 'warmup') return undefined;
  const v = (() => {
    switch (key) {
      case 'weight':
        return usesWeight(type) ? s.weight : undefined;
      case 'oneRm':
        return oneRepMax(s.weight ?? 0, s.reps ?? 0);
      case 'setVolume':
        return setVolume(s, type);
      case 'reps':
        return usesReps(type) ? s.reps : undefined;
      case 'distance':
        return s.distance;
      case 'duration':
        return s.duration;
      case 'pace':
        return s.distance && s.duration && s.distance >= 0.2 ? s.duration / s.distance : undefined;
      default:
        return undefined;
    }
  })();
  return v && v > 0 ? v : undefined;
}

/** Best set per record key for one exercise in one workout. */
function bestSets(we: WorkoutExercise, type: ExerciseType) {
  const out: Partial<Record<RecordKey, { value: number; set?: WorkoutSet }>> = {};
  for (const key of recordKeysFor(type)) {
    if (key === 'sessionVolume') {
      const v = we.sets.reduce((a, s) => a + (s.kind === 'warmup' ? 0 : setVolume(s, type)), 0);
      if (v > 0) out[key] = { value: v };
      continue;
    }
    for (const s of we.sets) {
      const v = setValue(key, s, type);
      if (v !== undefined && better(key, v, out[key]?.value)) out[key] = { value: v, set: s };
    }
  }
  return out;
}

const cache = new WeakMap<Workout[], RecordIndex>();

/** All personal records, computed in one chronological pass and cached per workouts array. */
export function recordIndex(workouts: Workout[]): RecordIndex {
  const hit = cache.get(workouts);
  if (hit) return hit;
  const idx: RecordIndex = { byExercise: new Map(), byWorkout: new Map(), prSets: new Set() };
  const ordered = [...workouts].sort((a, b) => a.startedAt - b.startedAt || a.endedAt - b.endedAt);
  for (const w of ordered) {
    const events: PrEvent[] = [];
    for (const we of w.exercises) {
      const ex = getExercise(we.exerciseId);
      if (!ex || !we.sets.some((s) => s.done)) continue;
      let rec = idx.byExercise.get(ex.id);
      const first = !rec;
      if (!rec) idx.byExercise.set(ex.id, (rec = { best: {}, repMax: {}, sessions: 0 }));
      rec.sessions++;
      for (const [k, b] of Object.entries(bestSets(we, ex.type)) as [RecordKey, { value: number; set?: WorkoutSet }][]) {
        const prev = rec.best[k];
        if (!better(k, b.value, prev?.value)) continue;
        // The first time you do an exercise sets your baseline; it isn't counted as a PR.
        if (!first && prev) {
          events.push({ exercise: ex, key: k, value: b.value, previous: prev.value, setId: b.set?.id, date: w.startedAt, workoutId: w.id });
          if (b.set) idx.prSets.add(b.set.id);
        }
        rec.best[k] = { value: b.value, date: w.startedAt, workoutId: w.id, setId: b.set?.id, reps: b.set?.reps };
      }
      if (ex.type === 'weight_reps' || ex.type === 'weighted_bodyweight') {
        for (const s of we.sets) {
          if (!s.done || s.kind === 'warmup' || !s.reps || !s.weight) continue;
          const cur = rec.repMax[s.reps];
          if (!cur || s.weight > cur.value) rec.repMax[s.reps] = { value: s.weight, date: w.startedAt, workoutId: w.id, setId: s.id, reps: s.reps };
        }
      }
    }
    if (events.length) idx.byWorkout.set(w.id, events);
  }
  cache.set(workouts, idx);
  return idx;
}

/** Sets in the in-progress workout that beat your previous records (shown with a trophy as you log). */
export function livePrSets(active: ActiveWorkout, idx: RecordIndex): Set<string> {
  const out = new Set<string>();
  for (const we of active.exercises) {
    const ex = getExercise(we.exerciseId);
    const rec = ex && idx.byExercise.get(ex.id);
    if (!ex || !rec) continue;
    for (const [k, b] of Object.entries(bestSets(we, ex.type)) as [RecordKey, { value: number; set?: WorkoutSet }][]) {
      const prev = rec.best[k]?.value;
      if (b.set && prev !== undefined && better(k, b.value, prev)) out.add(b.set.id);
    }
  }
  return out;
}

/** Most recent PR events across all workouts, newest first. */
export function recentPrs(idx: RecordIndex, limit = 20): PrEvent[] {
  return [...idx.byWorkout.values()]
    .flat()
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);
}

export function fmtRecord(key: RecordKey, value: number, ex: Exercise, s: Settings): string {
  switch (key) {
    case 'weight':
    case 'oneRm':
    case 'setVolume':
    case 'sessionVolume':
      return fmtWeight(value, s);
    case 'reps':
      return `${value} reps`;
    case 'distance':
      return ex.type === 'weight_distance' ? `${Math.round(value * 1000)} m` : fmtDistance(value, s);
    case 'duration':
      return fmtClock(value);
    case 'pace':
      return fmtPace(value, 1, s);
  }
}
