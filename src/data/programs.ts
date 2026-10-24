import type { Routine, RoutineExercise, SetKind } from '../types';

type Target = { reps?: number; distance?: number; duration?: number; kind?: SetKind };

let n = 0;
function ex(exerciseId: string, restSeconds: number, sets: Target[], notes?: string): RoutineExercise {
  return {
    id: `tpl_ex_${++n}`,
    exerciseId,
    restSeconds,
    notes,
    sets: sets.map(({ kind = 'normal', ...t }) => ({ kind, ...t })),
  };
}

const reps = (n: number, count: number, warmups = 0): Target[] => [
  ...Array.from({ length: warmups }, () => ({ reps: 10, kind: 'warmup' as const })),
  ...Array.from({ length: count }, () => ({ reps: n })),
];

export interface Program extends Routine {
  emoji: string;
  summary: string;
}

/** Ready-made routines shown under "Premade Routines" on the Workout tab. */
export const PROGRAMS: Program[] = [
  {
    id: 'tpl_push',
    title: 'Push Day',
    emoji: '💪',
    summary: 'Chest, shoulders & triceps',
    createdAt: 0,
    exercises: [
      ex('bench_press_bb', 180, reps(8, 4, 1), 'Main lift – add weight when you hit 8 reps on every set.'),
      ex('incline_bench_db', 120, reps(10, 3)),
      ex('shoulder_press_db', 120, reps(10, 3)),
      ex('cable_fly', 90, reps(12, 3)),
      ex('lateral_raise_db', 60, reps(15, 3)),
      ex('triceps_rope_pushdown', 60, reps(12, 3)),
      ex('overhead_triceps_cable', 60, reps(12, 3)),
    ],
  },
  {
    id: 'tpl_pull',
    title: 'Pull Day',
    emoji: '🦍',
    summary: 'Back, rear delts & biceps',
    createdAt: 0,
    exercises: [
      ex('deadlift_bb', 180, reps(5, 3, 1), 'Main lift – keep your back flat and the bar close.'),
      ex('pull_up', 120, reps(8, 3)),
      ex('bent_over_row_bb', 120, reps(10, 3)),
      ex('lat_pulldown', 90, reps(12, 3)),
      ex('face_pull', 60, reps(15, 3)),
      ex('bicep_curl_db', 60, reps(12, 3)),
      ex('hammer_curl', 60, reps(12, 2)),
    ],
  },
  {
    id: 'tpl_legs',
    title: 'Leg Day',
    emoji: '🦵',
    summary: 'Quads, hamstrings, glutes & calves',
    createdAt: 0,
    exercises: [
      ex('squat_bb', 180, reps(8, 4, 1), 'Main lift – hips to at least knee height.'),
      ex('romanian_deadlift_bb', 120, reps(10, 3)),
      ex('leg_press', 120, reps(12, 3)),
      ex('leg_extension', 60, reps(15, 3)),
      ex('lying_leg_curl', 60, reps(12, 3)),
      ex('hip_thrust_bb', 90, reps(10, 3)),
      ex('standing_calf_raise', 60, reps(15, 4)),
    ],
  },
  {
    id: 'tpl_cardio',
    title: 'Cardio Mix',
    emoji: '🫀',
    summary: '45 min across four machines',
    createdAt: 0,
    exercises: [
      ex('incline_walk', 0, [{ distance: 1, duration: 600 }], 'Warm up: 8–12% incline, brisk walk.'),
      ex('treadmill', 0, [{ distance: 3, duration: 1200 }], 'Steady run at a pace you could just about talk at.'),
      ex('rowing_machine', 0, [{ distance: 2, duration: 600 }]),
      ex('stationary_bike', 0, [{ distance: 4, duration: 600 }], 'Finish with a hard last 2 minutes.'),
    ],
  },
  {
    id: 'tpl_5k',
    title: '5K Run',
    emoji: '🏃',
    summary: 'Warm up, 5 km, cool down',
    createdAt: 0,
    exercises: [
      ex('walking', 0, [{ distance: 0.5, duration: 300 }], 'Warm up walk'),
      ex('running', 0, [{ distance: 5, duration: 1800 }], 'Log your actual time when you finish.'),
      ex('walking', 0, [{ distance: 0.5, duration: 300 }], 'Cool down walk'),
    ],
  },
  {
    id: 'tpl_core',
    title: 'Core Finisher',
    emoji: '🔥',
    summary: '10-minute abs circuit',
    createdAt: 0,
    exercises: [
      ex('plank', 30, [{ duration: 45 }, { duration: 45 }, { duration: 45 }]),
      ex('hanging_leg_raise', 45, reps(12, 3)),
      ex('cable_crunch', 45, reps(15, 3)),
      ex('russian_twist', 30, reps(20, 3)),
    ],
  },
];
