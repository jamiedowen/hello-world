import type { ActiveWorkout, Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { uid } from './format';
import { connect as connectHr, disconnect as disconnectHr, startRecording, takeRecording } from './heartRate';
import { cancelRestNotification } from './native';
import { getExercise, getState, setState } from './store';

function defaultTitle(ts: number): string {
  const h = new Date(ts).getHours();
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

export function newSet(prev?: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: uid(),
    kind: 'normal',
    weight: prev?.weight,
    reps: prev?.reps,
    distance: prev?.distance,
    duration: prev?.duration,
    done: false,
  };
}

export function startWorkout(routine?: Routine) {
  const now = Date.now();
  const active: ActiveWorkout = {
    id: uid(),
    title: routine?.title ?? defaultTitle(now),
    startedAt: now,
    routineId: routine?.id,
    exercises: (routine?.exercises ?? []).map((re) => ({
      id: uid(),
      exerciseId: re.exerciseId,
      notes: re.notes,
      restSeconds: re.restSeconds,
      sets: re.sets.map((s) => ({ ...s, id: uid(), done: false })),
    })),
  };
  setState({ active, rest: null });
  startHeartRate();
}

/** Record heart rate for the active workout if a monitor is paired (also used to resume after a restart). */
export function startHeartRate() {
  const { active, settings } = getState();
  if (!active || !settings.hrDevice) return;
  startRecording(active.id, active.startedAt);
  connectHr(settings.hrDevice);
}

export function updateActive(fn: (a: ActiveWorkout) => ActiveWorkout) {
  const a = getState().active;
  if (a) setState({ active: fn(a) });
}

export function makeWorkoutExercise(exerciseId: string): WorkoutExercise {
  const s = getState();
  const prev = lastPerformance(exerciseId);
  const count = prev?.sets.length ?? 1;
  return {
    id: uid(),
    exerciseId,
    restSeconds: prev?.restSeconds ?? s.settings.defaultRest,
    sets: Array.from({ length: Math.max(1, count) }, () => newSet()),
  };
}

export function addExercisesToActive(ids: string[]) {
  updateActive((a) => ({ ...a, exercises: [...a.exercises, ...ids.map(makeWorkoutExercise)] }));
}

/** Most recent logged instance of an exercise (used for the "Previous" column). */
export function lastPerformance(exerciseId: string): WorkoutExercise | undefined {
  for (const w of getState().workouts) {
    const we = w.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done));
    if (we) return { ...we, sets: we.sets.filter((s) => s.done) };
  }
  return undefined;
}

export function startRest(seconds: number, exerciseId: string) {
  if (seconds <= 0) return;
  setState({ rest: { endsAt: Date.now() + seconds * 1000, total: seconds, exerciseName: getExercise(exerciseId)?.name ?? '' } });
}

export function adjustRest(delta: number) {
  const r = getState().rest;
  if (!r) return;
  const endsAt = r.endsAt + delta * 1000;
  if (endsAt <= Date.now()) return stopRest();
  setState({ rest: { ...r, endsAt, total: Math.max(1, r.total + delta) } });
}

export function stopRest() {
  setState({ rest: null });
  cancelRestNotification();
}

/** Saves the active workout, dropping incomplete sets & empty exercises. Returns saved id. */
export function finishWorkout(opts: { title: string; notes?: string; startedAt: number; endedAt: number }): string | null {
  const a = getState().active;
  if (!a) return null;
  const exercises = a.exercises
    .map((we) => ({ ...we, sets: we.sets.filter((s) => s.done) }))
    .filter((we) => we.sets.length > 0);
  const w: Workout = {
    id: a.id,
    title: opts.title.trim() || defaultTitle(opts.startedAt),
    notes: opts.notes?.trim() || undefined,
    startedAt: opts.startedAt,
    endedAt: Math.max(opts.endedAt, opts.startedAt),
    routineId: a.routineId,
    exercises,
    hr: takeRecording(a.id),
  };
  disconnectHr();
  setState((s) => ({
    workouts: [w, ...s.workouts].sort((x, y) => y.startedAt - x.startedAt),
    active: null,
    rest: null,
  }));
  cancelRestNotification();
  return w.id;
}

export function discardWorkout() {
  const a = getState().active;
  if (a) takeRecording(a.id);
  disconnectHr();
  setState({ active: null, rest: null });
  cancelRestNotification();
}

export function deleteWorkout(id: string) {
  setState((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) }));
}

export function saveWorkout(w: Workout) {
  setState((s) => ({
    workouts: s.workouts.map((o) => (o.id === w.id ? w : o)).sort((x, y) => y.startedAt - x.startedAt),
  }));
}

export function routineFromWorkout(w: { title: string; exercises: WorkoutExercise[] }): Routine {
  return {
    id: uid(),
    title: w.title,
    createdAt: Date.now(),
    exercises: w.exercises.map(
      (we): RoutineExercise => ({
        id: uid(),
        exerciseId: we.exerciseId,
        restSeconds: we.restSeconds,
        notes: we.notes,
        sets: we.sets.map(({ kind, weight, reps, distance, duration }) => ({ kind, weight, reps, distance, duration })),
      }),
    ),
  };
}

export function saveRoutine(r: Routine) {
  setState((s) => ({
    routines: s.routines.some((o) => o.id === r.id) ? s.routines.map((o) => (o.id === r.id ? r : o)) : [...s.routines, r],
  }));
}

export function deleteRoutine(id: string) {
  setState((s) => ({ routines: s.routines.filter((r) => r.id !== id) }));
}
