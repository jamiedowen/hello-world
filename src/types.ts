export type Muscle =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'traps'
  | 'abdominals'
  | 'obliques'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'neck'
  | 'cardio'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'kettlebell'
  | 'bodyweight'
  | 'band'
  | 'plate'
  | 'smith'
  | 'cardio_machine'
  | 'other'
  | 'none';

/**
 * How an exercise is tracked. Determines which inputs each set shows.
 * - weight_reps: kg × reps (bench press)
 * - bodyweight_reps: reps only (push up)
 * - weighted_bodyweight: +kg × reps (weighted pull up)
 * - assisted_bodyweight: -kg × reps (assisted pull up)
 * - duration: time only (plank)
 * - distance_duration: km + time (running)
 * - weight_distance: kg + metres (farmer's walk)
 */
export type ExerciseType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'duration'
  | 'distance_duration'
  | 'weight_distance';

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  equipment: Equipment;
  primary: Muscle;
  secondary: Muscle[];
  description: string;
  instructions: string[];
  tips?: string[];
  custom?: boolean;
  image?: string; // folder under public/ex with t.webp (thumbnail), 0.webp & 1.webp (start/end photos)
  emoji?: string; // fallback icon when there's no photo
}

export type SetKind = 'normal' | 'warmup' | 'failure' | 'drop';

export interface WorkoutSet {
  id: string;
  kind: SetKind;
  weight?: number; // always stored in kg
  reps?: number;
  distance?: number; // always stored in km (metres for weight_distance stored as km too)
  duration?: number; // seconds
  rpe?: number;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  notes?: string;
  restSeconds: number; // 0 = off
  supersetId?: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  title: string;
  notes?: string;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  exercises: WorkoutExercise[];
  routineId?: string;
  hr?: [number, number][]; // heart-rate samples: [seconds since start, bpm]
}

export interface ActiveWorkout {
  id: string;
  title: string;
  notes?: string;
  startedAt: number;
  exercises: WorkoutExercise[];
  routineId?: string;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  restSeconds: number;
  notes?: string;
  sets: Omit<WorkoutSet, 'done' | 'id'>[];
}

export interface Routine {
  id: string;
  title: string;
  notes?: string;
  exercises: RoutineExercise[];
  createdAt: number;
  templateId?: string; // set when copied from a premade routine
}

export interface Settings {
  unit: 'kg' | 'lbs';
  distanceUnit: 'km' | 'mi';
  defaultRest: number;
  bodyweight?: number; // kg
  restSound: boolean;
  restVibrate: boolean;
  name: string;
  hrDevice?: { id: string; name: string }; // paired Bluetooth heart-rate source (e.g. Garmin broadcast)
  maxHr: number;
}

export interface RestTimer {
  endsAt: number;
  total: number;
  exerciseName: string;
}
