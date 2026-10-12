# Midnight 84: project guide for Claude

A polyphonic darkwave / synthwave synth plugin (JUCE 8, C++17, CMake) for **FL Studio on Windows** (VST3).
It also builds AU and Standalone on macOS, and VST3 and Standalone on Linux, plus an **Android app (APK)**.
The user plays it on Android while away from their PC. Keep both working, and never remove the VST. See README.md for the user-facing feature list.

## The user and what they want
- Makes dark, heavy synthwave / darksynth: Perturbator, Carpenter Brut, GosT. Likes Serum, Harmor, Sawer and the Behringer Poly D.
- Priorities, in order: **heavy, gritty, analog-feeling bass** with "teeth"; dark tone that isn't just low notes or minor chords;
  dark neon synthwave theming. Pushes back when it sounds too clean or digital.
- Uses FL Studio on Windows and gets builds from the GitHub Actions artifacts (they don't compile locally).
- Likes hearing results: render audio demos (MP3) and screenshots and send them with SendUserFile.

## Working rules learned so far
- **Claude can't listen.** Verify sound with measurements (band energy, crest factor, aliasing, LUFS, spectrograms),
  and say so honestly. Loudness-match any before/after A/B.
- Add a **feature test to tests/RenderTest.cpp** for every new feature, and run it before committing. These tests caught
  real bugs: an off-grid arp, a Squash that made things quieter, a multiband crossover that leaked sub into the distortion.
- Avoid sub notes below ~25 Hz in demos. The sub oscillator plays an octave down, so low roots become inaudible rumble.
- Don't copy real songs' melodies; write original parts "in the style of".
- After pushing, check the "Build Midnight 84" GitHub Actions run (Windows matters most).
- Branch: `claude/synthwave-vst-fl-studio-d2pw83`. Don't open a PR unless asked.

## Build and test
```bash
# JUCE 8.0.4 is fetched by CMake. Point at a local clone to skip the download:
cmake -B build -DCMAKE_BUILD_TYPE=Release -DM84_BUILD_TESTS=ON [-DFETCHCONTENT_SOURCE_DIR_JUCE=/path/to/JUCE]
cmake --build build -j4
# Linux deps: libasound2-dev libx11-dev libxrandr-dev libxinerama-dev libxcursor-dev libxext-dev
#             libfreetype-dev libfontconfig1-dev libgl1-mesa-dev; run the tools under xvfb-run.
xvfb-run -a build/Midnight84RenderTest_artefacts/Release/Midnight84RenderTest <outDir> ["Preset Name"]
  # renders every preset (NaN/level/CPU), runs feature tests, writes editor.png (of the named preset)
xvfb-run -a build/Midnight84DemoSong_artefacts/Release/Midnight84DemoSong <outDir> [lead | riff "A,B" | features | probe "id=v,..."]
  # demo renders; "riff" plays the same F-minor chug through each preset; "probe" is the aliasing probe
xvfb-run -a build/Midnight84FullSong_artefacts/Release/Midnight84FullSong <outDir> [stems]
  # "Neon Requiem": an 88-bar arranged track (rendered before the grit and feature updates)
```
Encode demos with `ffmpeg -b:a 256k` into `demo/`.

### Android
- `android/Midnight84.jucer` is a Projucer project (JUCE's CMake API can't target Android) that compiles the same
  `../Source` files as a standalone app. **When you add a Source file, add it to the .jucer too.**
- CI (the `android` job) clones JUCE to `./JUCE`, builds Projucer, runs `--resave`, installs NDK 26.2.11394342 and
  CMake 3.22.1, then runs `gradlew assembleRelease_Release` (signed with a debug keystore). Artifact: Midnight84-Android-APK.
- dl.google.com is blocked in the cloud sandbox, so the APK can only be built in CI. Projucer and `--resave` work
  locally (they need libcurl4-openssl-dev).
- The mobile UI is `M84_MOBILE_UI` (on for JUCE_ANDROID / JUCE_IOS): header strip, 4 tab pages (each a scaled region of
  `MainContent`), and a `NeonKeyboard` feeding `processor.keyboardState`. RenderTest writes `mobile_page1..4.png` at
  844x390, and checks that the on-screen keyboard produces sound. The LTO link is slow (a few minutes).

## Architecture (Source/)
- `Parameters.*`: every parameter ID and the layout. **Add new parameters at the end** and never rename IDs,
  so saved projects and presets keep loading. Choice lists can only be appended to.
- `DSP.h`: PolyBLEP `Oscillator` (with hard-sync support), `LadderFilter` (ZDF 4-pole, saturation in every stage),
  `Ms20Filter` (SVF with a diode-limited resonance), `Svf`, `Envelope` (analog-style exponential), `asymSat`, `fastTanh`.
- `SynthEngine.*`: `Voice` (3 oscs with 7-voice unison, sub, noise, ring mod, Grit/Feedback mixer, HPF, filter,
  poly-mod, analog drift and slop) and `SynthEngine` (voice allocation, poly/mono/legato, MIDI, LFO).
  **Voices render 2x oversampled (4x with HQ)** inside `SynthEngine::process`, so `sr` in the voices is the oversampled rate.
- `Arpeggiator.*`: rewrites the block's MIDI before the engine. Grid-locked to the host's ppq while playing.
- `Effects.*`: `Drive` (2x OS; Tube/Hard/Fold/Crush, plus multiband Grind/Amp with an LR4 split at 140 Hz, clean mono sub,
  cabinet roll-off and low cut), `Squash` (OTT-style 3-band, -20 dB target), `PingPongDelay`, `Pump`, and `FxChain`
  (order: drive, squash, chorus, delay, reverb, pump, master and DC block).
- `Presets.*`: factory presets as (paramId, real value) lists, applied on top of the defaults. They're exposed as host programs.
- `PluginProcessor.*`: caches atomic parameter pointers, reads snapshots once per block, keeps state and handles .m84 user presets.
- `LookAndFeel.*`, `Components.*`, `PluginEditor.*`: neon UI on a fixed 1200x900 `MainContent`, scaled by the
  editor (aspect-locked). Panels are placed manually in the `MainContent` constructor; colours are in `Palette`.

## Ideas not done yet (offer, don't assume)
- Digital features: wavetables, a Serum-style mod matrix, a second LFO and mod envelope.
- Re-render "Neon Requiem" with the new grit engine and presets.
- Per-voice LFO, a step sequencer, preset browser categories, MIDI learn.
