import type { Equipment, ExerciseType, Muscle, SetKind } from '../types';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  lats: 'Lats',
  upper_back: 'Upper Back',
  lower_back: 'Lower Back',
  traps: 'Traps',
  abdominals: 'Abdominals',
  obliques: 'Obliques',
  quadriceps: 'Quadriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  adductors: 'Adductors',
  abductors: 'Abductors',
  neck: 'Neck',
  cardio: 'Cardio',
  full_body: 'Full Body',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
  band: 'Resistance Band',
  plate: 'Plate',
  smith: 'Smith Machine',
  cardio_machine: 'Cardio Machine',
  other: 'Other',
  none: 'None',
};

export const TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight & Reps',
  bodyweight_reps: 'Bodyweight Reps',
  weighted_bodyweight: 'Weighted Bodyweight',
  assisted_bodyweight: 'Assisted Bodyweight',
  duration: 'Duration',
  distance_duration: 'Distance & Duration',
  weight_distance: 'Weight & Distance',
};

export const SET_KIND_LABELS: Record<SetKind, string> = {
  normal: 'Normal',
  warmup: 'Warm Up',
  failure: 'Failure',
  drop: 'Drop Set',
};

/** Things to compare total session volume against. Sorted ascending by weight (kg). */
export const COMPARISONS: { name: string; plural: string; kg: number; emoji: string }[] = [
  { name: 'Chihuahua', plural: 'Chihuahuas', kg: 2, emoji: '🐕' },
  { name: 'House Cat', plural: 'House Cats', kg: 4.5, emoji: '🐈' },
  { name: 'Bowling Ball', plural: 'Bowling Balls', kg: 7, emoji: '🎳' },
  { name: 'Microwave', plural: 'Microwaves', kg: 15, emoji: '📦' },
  { name: 'Golden Retriever', plural: 'Golden Retrievers', kg: 30, emoji: '🦮' },
  { name: 'Washing Machine', plural: 'Washing Machines', kg: 75, emoji: '🧺' },
  { name: 'Giant Panda', plural: 'Giant Pandas', kg: 110, emoji: '🐼' },
  { name: 'Lion', plural: 'Lions', kg: 190, emoji: '🦁' },
  { name: 'Vending Machine', plural: 'Vending Machines', kg: 300, emoji: '🥤' },
  { name: 'Grizzly Bear', plural: 'Grizzly Bears', kg: 400, emoji: '🐻' },
  { name: 'Grand Piano', plural: 'Grand Pianos', kg: 480, emoji: '🎹' },
  { name: 'Horse', plural: 'Horses', kg: 550, emoji: '🐎' },
  { name: 'Cow', plural: 'Cows', kg: 750, emoji: '🐄' },
  { name: 'Small Car', plural: 'Small Cars', kg: 1100, emoji: '🚗' },
  { name: 'Hippo', plural: 'Hippos', kg: 1500, emoji: '🦛' },
  { name: 'Pickup Truck', plural: 'Pickup Trucks', kg: 2500, emoji: '🛻' },
  { name: 'African Elephant', plural: 'African Elephants', kg: 6000, emoji: '🐘' },
  { name: 'T-Rex', plural: 'T-Rexes', kg: 8000, emoji: '🦖' },
  { name: 'School Bus', plural: 'School Buses', kg: 11000, emoji: '🚌' },
  { name: 'Humpback Whale', plural: 'Humpback Whales', kg: 30000, emoji: '🐋' },
  { name: 'Boeing 737', plural: 'Boeing 737s', kg: 41000, emoji: '✈️' },
  { name: 'Blue Whale', plural: 'Blue Whales', kg: 150000, emoji: '🐳' },
];

export const MUSCLE_GROUPS: Muscle[] = [
  'chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'upper_back', 'lower_back', 'traps',
  'abdominals', 'obliques', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors',
  'cardio', 'full_body',
];
