# RepCount

A free, offline workout tracker for Android, inspired by Hevy. It uses the same dark design with blue accents.

## Features

- **Workouts**: log workouts live, with a running duration clock and live volume and set counts.
- **About 760 exercises with photos**: a round photo icon for each one in every list, plus start and end position photos on the exercise page that alternate like a demo.
- **Premade routines**: Push Day, Pull Day, Leg Day, Cardio Mix, 5K Run and Core Finisher. Start one directly, or save it to My Routines and edit it.
- **Exercise types**: each exercise is tracked the right way:
  - weight × reps (bench press, squat…)
  - bodyweight reps, plus weighted and assisted variants (pull ups, dips…)
  - duration (plank)
  - distance + time with automatic pace (running, treadmill, bike, rowing, swimming…)
  - weight + distance (farmer's walk, sled push)
- **Set types**: warm-up, normal, failure and drop sets.
- **Previous column**: shows what you did last time. Tap it to copy the values, or tick a blank set to reuse them.
- **Rest timer**: counts down between sets, with per-exercise rest times, ±15s and skip. It sounds and vibrates when rest ends, and sends a notification if the app is in the background.
- **Date and time**: every workout has an editable date, time and duration.
- **Workout summary**: shows duration, volume, sets, personal records, a muscle heat-map and per-muscle split, a fun weight comparison ("that's like lifting 2.3 Grand Pianos 🎹"), and cardio distance, time and pace.
- **Exercise detail**: a description, step-by-step instructions and tips, the muscles worked, progress charts (heaviest weight, estimated 1RM, volume, pace…), personal records, rep maxes and full history.
- **Routines**: reusable workout templates. You can also save any finished workout as a routine.
- **Profile**: weekly charts for duration, volume, reps and distance, a training calendar, muscle distribution, and a week streak.
- **Custom exercises**, kg/lbs, km/miles, and JSON backup export and import.

All data stays on the phone. Use **Settings → Export backup** now and then.

## Getting the APK

Every push runs the **Build Android APK** GitHub Action:

- **Any branch**: open the workflow run in the *Actions* tab and download the `RepCount-apk` artifact. GitHub delivers it as a zip with the APK inside.
- **`main` branch**: a GitHub **Release** is also published with `RepCount.apk` attached. Open the Releases page on your phone and tap the APK to install it. Allow installs from unknown sources when asked.

Every build is signed with the same key, so a new APK installs over the old one and keeps your data.

> The signing keystore (`android/app/repcount-release.keystore`) is committed to make this work with zero setup. That's fine for a personal sideloaded app. If you'd rather keep a private key, set `REPCOUNT_KEYSTORE`, `REPCOUNT_KEYSTORE_PASSWORD`, `REPCOUNT_KEY_ALIAS` and `REPCOUNT_KEY_PASSWORD` in the build environment.

## Developing

```bash
npm install
npm run dev            # run in the browser at http://localhost:5173
npm run build          # typecheck + production build
npx cap sync android   # copy the web build into the Android project
cd android && ./gradlew assembleRelease   # needs the Android SDK
```

Exercise photos and the extra exercises come from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), which is public domain (Unlicense). To regenerate them, run `python3 scripts/import-exercises.py <path-to-free-exercise-db-clone>`.

Tech: React + TypeScript + Vite, wrapped as a native Android app with Capacitor. It uses the haptics, local notifications, status bar and back-button plugins.
