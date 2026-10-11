#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_dsp/juce_dsp.h>
#include <array>
#include <vector>
#include "DSP.h"
#include "Parameters.h"

namespace m84
{
struct OscParams
{
    int wave = waveSaw;
    float octave = 0, semi = 0, fine = 0, pw = 0.5f, level = 0, detune = 0;
    int unison = 1;
};

// Snapshot of every parameter the voices need, read once per block.
struct EngineParams
{
    std::array<OscParams, kNumOscs> osc;
    float subLevel = 0; int subOct = 0; int subWave = 0;
    float noise = 0, spread = 0.6f;
    float grit = 0, feedback = 0;      // mixer overdrive and filter-to-mixer feedback
    bool oscSync = false; float oscFM = 0; // osc B hard-synced to / frequency-modulated by osc A

    int fltType = 0;
    float cutoff = 8000, res = 0, fltDrive = 0, fltEnv = 0, fltKey = 0, fltVel = 0, fltLfo = 0;
    float fA = 0, fD = 0.3f, fS = 0, fR = 0.3f;
    float aA = 0, aD = 0.4f, aS = 1, aR = 0.2f, ampVel = 0.3f;

    int lfoWave = 0; float lfoRate = 2; bool lfoSync = false; int lfoSyncRate = 4; bool lfoRetrig = false;
    float lfoPitch = 0, lfoPW = 0;

    int voiceMode = 0; int polyphony = 8;
    float glide = 0, bendRange = 2, analog = 0.3f;
};

class Voice
{
public:
    void prepare (double sampleRate, int seed);
    void start (int note, float velocity, bool retrigger, bool glide, const EngineParams& p);
    void release();
    void kill();
    bool isActive() const noexcept { return ampEnv.isActive(); }
    bool isReleasing() const noexcept { return ampEnv.stage == Envelope::release; }
    float level() const noexcept { return ampEnv.out; }

    // Adds num samples into outL/outR. lfo holds num bipolar LFO values.
    void render (float* outL, float* outR, int num, const EngineParams& p,
                 const float* lfo, float bendSemis, float modWheel);
    float getVelocity() const noexcept { return velocity; }

    int note = -1;
    uint64_t age = 0;
    bool keyDown = false;
    bool sustained = false;

private:
    float sr = 44100.0f;
    std::array<std::array<Oscillator, kMaxUnison>, kNumOscs> oscs;
    Oscillator sub;
    Noise noise;
    LadderFilter filterL, filterR;
    float prevOut[2] {}, fbLow[2] {}; // mixer feedback path (DC-blocked)
    Envelope ampEnv, filtEnv;

    float currentNote = 60.0f, targetNote = 60.0f, glideCoef = 0.0f;
    float velocity = 1.0f;
    bool hasPlayed = false;

    // Analog character: slow random pitch wander plus fixed per-voice offsets.
    juce::Random rng;
    float driftTarget = 0, drift = 0;
    int driftCounter = 0;
    std::array<float, kNumOscs> oscOffset {};
    float cutoffOffset = 0;
};

class SynthEngine
{
public:
    void prepare (double sampleRate, int maxBlock);
    void setParams (const EngineParams& p) { params = p; }
    void setTransport (double bpm, double ppqAtBlockStart, bool playing);

    // Renders into the (already cleared) stereo buffer, handling MIDI sample-accurately.
    void process (juce::AudioBuffer<float>& buffer, const juce::MidiBuffer& midi);
    void allNotesOff();

    // Switches between 2x and 4x internal oversampling (stops any sounding notes).
    void setHighQuality (bool high);

private:
    void handleMidi (const juce::MidiMessage& m);
    void noteOn (int note, float velocity);
    void noteOff (int note);
    void renderChunk (float* L, float* R, int start, int num);
    void computeLfo (int num);
    Voice* findVoiceFor (int note);

    EngineParams params;
    std::array<Voice, kMaxVoices> voices;
    std::vector<int> monoStack;
    static constexpr int kChunk = 128;
    std::array<float, kChunk> lfoBuffer {};

    // Voices run at 2x (or 4x in high quality) the host rate so saturation doesn't alias.
    juce::dsp::Oversampling<float> os2x { 2, 1, juce::dsp::Oversampling<float>::filterHalfBandPolyphaseIIR, true, false };
    juce::dsp::Oversampling<float> os4x { 2, 2, juce::dsp::Oversampling<float>::filterHalfBandPolyphaseIIR, true, false };
    int osFactor = 2;
    int maxBlock = 512;
    double hostRate = 44100.0;

    double sr = 44100.0; // internal (oversampled) rate
    double bpm = 120.0, ppq = 0.0;
    bool playing = false;
    bool sustainPedal = false;
    float bend = 0.0f, modWheel = 0.0f;
    uint64_t ageCounter = 0;

    double lfoPhase = 0.0;
    float lfoHeld = 0.0f;
    juce::Random lfoRandom;
};
} // namespace m84
