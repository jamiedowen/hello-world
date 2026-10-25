import { COMPARISONS } from '../data/meta';
import type { ExerciseType, Muscle, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { getExercise } from './store';

export function usesWeight(t: ExerciseType) {
  return t === 'weight_reps' || t === 'weighted_bodyweight' || t === 'assisted_bodyweight' || t === 'weight_distance';
}
export function usesReps(t: ExerciseType) {
  return t === 'weight_reps' || t === 'bodyweight_reps' || t === 'weighted_bodyweight' || t === 'assisted_bodyweight';
}
export function usesDistance(t: ExerciseType) {
  return t === 'distance_duration' || t === 'weight_distance';
}
export function usesDuration(t: ExerciseType) {
  return t === 'duration' || t === 'distance_duration';
}

export function setVolume(set: WorkoutSet, type: ExerciseType): number {
  if (!set.done) return 0;
  if (type === 'weight_reps' || type === 'weighted_bodyweight') return (set.weight ?? 0) * (set.reps ?? 0);
  return 0;
}

export function exerciseVolume(we: WorkoutExercise): number {
  const ex = getExercise(we.exerciseId);
  if (!ex) return 0;
  return we.sets.reduce((acc, s) => acc + setVolume(s, ex.type), 0);
}

export function workoutVolume(w: { exercises: WorkoutExercise[] }): number {
  return w.exercises.reduce((acc, we) => acc + exerciseVolume(we), 0);
}

export function completedSets(w: { exercises: WorkoutExercise[] }): number {
  return w.exercises.reduce((acc, we) => acc + we.sets.filter((s) => s.done).length, 0);
}

export function totalReps(w: { exercises: WorkoutExercise[] }): number {
  return w.exercises.reduce((acc, we) => acc + we.sets.filter((s) => s.done).reduce((a, s) => a + (s.reps ?? 0), 0), 0);
}

export function cardioTotals(w: { exercises: WorkoutExercise[] }) {
  let distance = 0;
  let duration = 0;
  for (const we of w.exercises) {
    const ex = getExercise(we.exerciseId);
    if (!ex || ex.type !== 'distance_duration') continue;
    for (const s of we.sets) {
      if (!s.done) continue;
      distance += s.distance ?? 0;
      duration += s.duration ?? 0;
    }
  }
  return { distance, duration };
}

/** Epley estimated one-rep max */
export function oneRepMax(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Share of work per muscle, by completed sets. Primary muscle counts 1,
 * each secondary counts 0.5. Returns sorted descending with percentages.
 */
export function muscleSplit(workouts: { exercises: WorkoutExercise[] }[]): { muscle: Muscle; sets: number; pct: number }[] {
  const map = new Map<Muscle, number>();
  for (const w of workouts) {
    for (const we of w.exercises) {
      const ex = getExercise(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter((s) => s.done).length;
      if (!n) continue;
      map.set(ex.primary, (map.get(ex.primary) ?? 0) + n);
      for (const m of ex.secondary) map.set(m, (map.get(m) ?? 0) + n * 0.5);
    }
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  return [...map.entries()]
    .map(([muscle, sets]) => ({ muscle, sets, pct: (sets / total) * 100 }))
    .sort((a, b) => b.sets - a.sets);
}

export function comparisonFor(volumeKg: number) {
  if (volumeKg <= 0) return null;
  let pick = COMPARISONS[0];
  for (const c of COMPARISONS) if (c.kg <= volumeKg) pick = c;
  const count = volumeKg / pick.kg;
  return { ...pick, count };
}

export interface BestSet {
  weight: number;
  reps: number;
  oneRm: number;
  volume: number;
  distance: number;
  duration: number;
}

export function bestOf(sets: WorkoutSet[], type: ExerciseType): BestSet {
  const b: BestSet = { weight: 0, reps: 0, oneRm: 0, volume: 0, distance: 0, duration: 0 };
  for (const s of sets) {
    if (!s.done) continue;
    b.weight = Math.max(b.weight, s.weight ?? 0);
    b.reps = Math.max(b.reps, s.reps ?? 0);
    b.oneRm = Math.max(b.oneRm, oneRepMax(s.weight ?? 0, s.reps ?? 0));
    b.volume = Math.max(b.volume, setVolume(s, type));
    b.distance = Math.max(b.distance, s.distance ?? 0);
    b.duration = Math.max(b.duration, s.duration ?? 0);
  }
  return b;
}

/** History of a given exercise, oldest first. */
export function exerciseHistory(workouts: Workout[], exerciseId: string) {
  const out: { workout: Workout; we: WorkoutExercise }[] = [];
  for (const w of workouts) for (const we of w.exercises) if (we.exerciseId === exerciseId) out.push({ workout: w, we });
  return out.sort((a, b) => a.workout.startedAt - b.workout.startedAt);
}

/** Start of the week (Monday 00:00) for a timestamp. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function streakWeeks(workouts: Workout[]): number {
  const weeks = new Set(workouts.map((w) => weekStart(w.startedAt)));
  let n = 0;
  let cur = weekStart(Date.now());
  if (!weeks.has(cur)) cur -= 7 * 86400000; // current week not yet trained doesn't break streak
  while (weeks.has(cur)) {
    n++;
    cur = weekStart(cur - 3 * 86400000);
  }
  return n;
}
