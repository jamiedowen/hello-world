#!/usr/bin/env python3
"""
Import exercises + images from Free Exercise DB (public domain, https://github.com/yuhonas/free-exercise-db).

Usage:
  git clone --depth 1 https://github.com/yuhonas/free-exercise-db.git /tmp/fedb
  python3 scripts/import-exercises.py /tmp/fedb

Writes:
  src/data/library.json          imported exercises (in the app's Exercise shape)
  src/data/curated-images.json   image ids for the hand-written exercises in exercises.ts
  public/ex/<id>/{t,0,1}.webp    thumbnail + start/end position photos
"""
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
OUT_IMG = ROOT / 'public' / 'ex'

# Hand-written exercises (src/data/exercises.ts) → Free Exercise DB image id. None = no photo.
CURATED = {
    'bench_press_bb': 'Barbell_Bench_Press_-_Medium_Grip',
    'incline_bench_bb': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    'decline_bench_bb': 'Decline_Barbell_Bench_Press',
    'bench_press_db': 'Dumbbell_Bench_Press',
    'incline_bench_db': 'Incline_Dumbbell_Press',
    'chest_fly_db': 'Dumbbell_Flyes',
    'cable_fly': 'Cable_Crossover',
    'pec_deck': 'Butterfly',
    'chest_press_machine': 'Machine_Bench_Press',
    'push_up': 'Pushups',
    'chest_dip': 'Dips_-_Chest_Version',
    'chest_dip_weighted': 'Dips_-_Chest_Version',
    'deadlift_bb': 'Barbell_Deadlift',
    'romanian_deadlift_bb': 'Romanian_Deadlift',
    'romanian_deadlift_db': 'Stiff-Legged_Dumbbell_Deadlift',
    'sumo_deadlift': 'Sumo_Deadlift',
    'pull_up': 'Pullups',
    'pull_up_weighted': 'Weighted_Pull_Ups',
    'pull_up_assisted': 'Band_Assisted_Pull-Up',
    'chin_up': 'Chin-Up',
    'lat_pulldown': 'Wide-Grip_Lat_Pulldown',
    'lat_pulldown_close': 'V-Bar_Pulldown',
    'bent_over_row_bb': 'Bent_Over_Barbell_Row',
    'dumbbell_row': 'One-Arm_Dumbbell_Row',
    'seated_cable_row': 'Seated_Cable_Rows',
    't_bar_row': 'Bent_Over_Two-Arm_Long_Bar_Row',
    'chest_supported_row': 'Dumbbell_Incline_Row',
    'face_pull': 'Face_Pull',
    'shrug_bb': 'Barbell_Shrug',
    'shrug_db': 'Dumbbell_Shrug',
    'back_extension': 'Hyperextensions_Back_Extensions',
    'straight_arm_pulldown': 'Straight-Arm_Pulldown',
    'inverted_row': 'Inverted_Row',
    'overhead_press_bb': 'Standing_Military_Press',
    'shoulder_press_db': 'Dumbbell_Shoulder_Press',
    'shoulder_press_machine': 'Machine_Shoulder_Military_Press',
    'arnold_press': 'Arnold_Dumbbell_Press',
    'lateral_raise_db': 'Side_Lateral_Raise',
    'lateral_raise_cable': 'Cable_Seated_Lateral_Raise',
    'front_raise_db': 'Front_Dumbbell_Raise',
    'rear_delt_fly_db': 'Seated_Bent-Over_Rear_Delt_Raise',
    'rear_delt_machine': 'Reverse_Machine_Flyes',
    'upright_row': 'Upright_Barbell_Row',
    'bicep_curl_bb': 'Barbell_Curl',
    'bicep_curl_db': 'Dumbbell_Bicep_Curl',
    'hammer_curl': 'Hammer_Curls',
    'preacher_curl': 'Preacher_Curl',
    'incline_curl_db': 'Incline_Dumbbell_Curl',
    'cable_curl': 'Standing_Biceps_Cable_Curl',
    'triceps_pushdown': 'Triceps_Pushdown',
    'triceps_rope_pushdown': 'Triceps_Pushdown_-_Rope_Attachment',
    'skull_crusher': 'EZ-Bar_Skullcrusher',
    'overhead_triceps_db': 'Standing_Dumbbell_Triceps_Extension',
    'overhead_triceps_cable': 'Cable_Rope_Overhead_Triceps_Extension',
    'close_grip_bench': 'Close-Grip_Barbell_Bench_Press',
    'triceps_dip': 'Dips_-_Triceps_Version',
    'bench_dip': 'Bench_Dips',
    'wrist_curl': 'Seated_Palm-Up_Barbell_Wrist_Curl',
    'squat_bb': 'Barbell_Squat',
    'front_squat': 'Front_Barbell_Squat',
    'goblet_squat': 'Goblet_Squat',
    'leg_press': 'Leg_Press',
    'hack_squat': 'Hack_Squat',
    'bulgarian_split_squat': 'Split_Squat_with_Dumbbells',
    'lunge_db': 'Dumbbell_Lunges',
    'walking_lunge': 'Barbell_Walking_Lunge',
    'leg_extension': 'Leg_Extensions',
    'lying_leg_curl': 'Lying_Leg_Curls',
    'seated_leg_curl': 'Seated_Leg_Curl',
    'hip_thrust_bb': 'Barbell_Hip_Thrust',
    'glute_bridge': 'Butt_Lift_Bridge',
    'hip_abduction': 'Thigh_Abductor',
    'hip_adduction': 'Thigh_Adductor',
    'standing_calf_raise': 'Standing_Calf_Raises',
    'seated_calf_raise': 'Seated_Calf_Raise',
    'bodyweight_squat': 'Bodyweight_Squat',
    'step_up': 'Dumbbell_Step_Ups',
    'good_morning': 'Good_Morning',
    'kettlebell_swing': 'One-Arm_Kettlebell_Swings',
    'plank': 'Plank',
    'side_plank': 'Side_Bridge',
    'crunch': 'Crunches',
    'cable_crunch': 'Cable_Crunch',
    'hanging_leg_raise': 'Hanging_Leg_Raise',
    'hanging_knee_raise': 'Knee_Hip_Raise_On_Parallel_Bars',
    'russian_twist': 'Russian_Twist',
    'ab_wheel': 'Ab_Roller',
    'dead_bug': 'Dead_Bug',
    'mountain_climber': 'Mountain_Climbers',
    'power_clean': 'Power_Clean',
    'thruster': 'Kettlebell_Thruster',
    'farmers_walk': 'Farmers_Walk',
    'sled_push': 'Sled_Push',
    'running': 'Trail_Running_Walking',
    'treadmill': 'Running_Treadmill',
    'walking': 'Walking_Treadmill',
    'incline_walk': 'Walking_Treadmill',
    'cycling': 'Bicycling',
    'stationary_bike': 'Bicycling_Stationary',
    'spin_bike': 'Bicycling_Stationary',
    'rowing_machine': 'Rowing_Stationary',
    'elliptical': 'Elliptical_Trainer',
    'stair_machine': 'Stairmaster',
    'jump_rope': 'Rope_Jumping',
    'hiking': 'Trail_Running_Walking',
}

MUSCLE = {
    'abdominals': 'abdominals', 'abductors': 'abductors', 'adductors': 'adductors', 'biceps': 'biceps',
    'calves': 'calves', 'chest': 'chest', 'forearms': 'forearms', 'glutes': 'glutes', 'hamstrings': 'hamstrings',
    'lats': 'lats', 'lower back': 'lower_back', 'middle back': 'upper_back', 'neck': 'neck',
    'quadriceps': 'quadriceps', 'shoulders': 'shoulders', 'traps': 'traps', 'triceps': 'triceps',
}
MUSCLE_WORDS = {
    'lower_back': 'lower back', 'upper_back': 'upper back',
}
EQUIPMENT = {
    'barbell': 'barbell', 'e-z curl bar': 'barbell', 'dumbbell': 'dumbbell', 'machine': 'machine', 'cable': 'cable',
    'kettlebells': 'kettlebell', 'body only': 'bodyweight', 'bands': 'band', 'medicine ball': 'other',
    'exercise ball': 'other', 'other': 'other', None: 'none',
}
# Imported names that would clash with hand-written exercises.
RENAME = {'Air_Bike': 'Air Bike Crunch'}
DURATION_CARDIO = {'Rope Jumping', 'Stairmaster', 'Step Mill'}
CARRY_WORDS = ('walk', 'carry', 'drag', 'sled push', 'prowler', 'yoke')
HOLD_WORDS = ('plank', 'wall sit', ' hold', 'static', 'flexed-arm hang', 'side bridge')


def exercise_type(x):
    name = x['name'].lower()
    if x['category'] == 'cardio':
        if x['name'] in DURATION_CARDIO:
            return 'duration'
        if 'prowler' in name:
            return 'weight_distance'
        return 'distance_duration'
    if x['category'] == 'strongman' and any(w in name for w in CARRY_WORDS):
        return 'weight_distance'
    if any(w in name for w in HOLD_WORDS) and 'push' not in name:
        return 'duration'
    if 'assisted' in name and x['equipment'] in ('machine', 'bands'):
        return 'assisted_bodyweight'
    if x['equipment'] in ('body only', None):
        return 'weighted_bodyweight' if name.startswith('weighted') else 'bodyweight_reps'
    return 'weight_reps'


def words(ms):
    ms = [MUSCLE_WORDS.get(m, m) for m in ms]
    return ms[0] if len(ms) == 1 else ', '.join(ms[:-1]) + ' and ' + ms[-1]


def describe(x, primary, secondary):
    level = {'beginner': 'A beginner-friendly', 'intermediate': 'An intermediate', 'expert': 'An advanced'}[x['level']]
    kind = {'compound': ' compound', 'isolation': ' isolation'}.get(x.get('mechanic') or '', '')
    cat = {
        'plyometrics': 'plyometric exercise', 'olympic weightlifting': 'Olympic lift',
        'powerlifting': 'powerlifting exercise', 'strongman': 'strongman event', 'cardio': 'cardio exercise',
    }.get(x['category'], 'exercise')
    if x['category'] == 'cardio':
        return f'{level} {cat} for heart and lung fitness.'
    s = f'{level}{kind} {cat} that mainly works the {words([primary])}'
    if secondary:
        s += f', with help from the {words(secondary[:3])}'
    return s + '.'


def slug(fid):
    return 'fx_' + re.sub(r'[^a-z0-9]+', '_', fid.lower()).strip('_')


def save_images(fid):
    src = SRC / 'exercises' / fid
    dst = OUT_IMG / fid
    dst.mkdir(parents=True, exist_ok=True)
    for i in (0, 1):
        p = src / f'{i}.jpg'
        if not p.exists():
            continue
        im = Image.open(p).convert('RGB')
        big = im.copy()
        big.thumbnail((480, 480))
        big.save(dst / f'{i}.webp', 'WEBP', quality=55, method=6)
        if i == 0:
            w, h = im.size
            side = min(w, h)
            left = (w - side) // 2
            sq = im.crop((left, (h - side) // 2, left + side, (h - side) // 2 + side)).resize((112, 112), Image.LANCZOS)
            sq.save(dst / 't.webp', 'WEBP', quality=65, method=6)


def main():
    data = json.loads((SRC / 'dist' / 'exercises.json').read_text())
    by_id = {x['id']: x for x in data}
    for cid, fid in CURATED.items():
        assert fid in by_id, f'{cid}: unknown image id {fid}'
    used = set(CURATED.values())

    if OUT_IMG.exists():
        shutil.rmtree(OUT_IMG)
    library = []
    for x in sorted(data, key=lambda e: e['name']):
        if x['category'] == 'stretching' or x['equipment'] == 'foam roll' or x['id'] in used:
            continue
        assert re.fullmatch(r'[A-Za-z0-9_-]+', x['id']), x['id']
        muscles = [MUSCLE[m] for m in x['primaryMuscles']] + [MUSCLE[m] for m in x['secondaryMuscles']]
        primary = 'cardio' if x['category'] == 'cardio' else muscles[0]
        secondary = [m for i, m in enumerate(muscles) if m != primary and m not in muscles[:i]]
        library.append({
            'id': slug(x['id']),
            'name': RENAME.get(x['id'], x['name'].strip()),
            'type': exercise_type(x),
            'equipment': EQUIPMENT[x['equipment']],
            'primary': primary,
            'secondary': secondary,
            'description': describe(x, primary, secondary),
            'instructions': [re.sub(r'\s+', ' ', s).strip() for s in x['instructions'] if s.strip()],
            'image': x['id'],
        })
        save_images(x['id'])
    for fid in used:
        save_images(fid)

    (ROOT / 'src' / 'data' / 'library.json').write_text(json.dumps(library, separators=(',', ':')))
    (ROOT / 'src' / 'data' / 'curated-images.json').write_text(json.dumps(CURATED, indent=1, sort_keys=True))
    print(f'{len(library)} imported exercises, {len(used)} curated images')


if __name__ == '__main__':
    main()
