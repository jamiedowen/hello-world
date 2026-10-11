#pragma once

#include <juce_dsp/juce_dsp.h>
#include "DSP.h"

namespace m84
{
struct FxParams
{
    int drvType = 0; float drvAmt = 0, drvTone = 0.8f, drvMix = 1;
    float chRate = 0.6f, chDepth = 0.4f, chMix = 0;
    int dlyTime = 4; float dlyFb = 0.35f, dlyTone = 0.5f, dlyMix = 0;
    float revSize = 0.7f, revDamp = 0.5f, revMix = 0;
    int pumpRate = 1; float pumpAmt = 0;
    float masterDb = -6.0f;
};

struct Transport
{
    double bpm = 120.0;
    double ppq = 0.0;
    bool playing = false;
};

// 2x oversampled distortion: tube / hard clip / wavefolder / bitcrusher.
class Drive
{
public:
    void prepare (double sampleRate, int maxBlock);
    void reset();
    void process (juce::AudioBuffer<float>& buffer, const FxParams& p);

private:
    juce::dsp::Oversampling<float> oversampler { 2, 1, juce::dsp::Oversampling<float>::filterHalfBandPolyphaseIIR, true, false };
    juce::AudioBuffer<float> dry;
    double sr = 44100.0;
    // Grind / Amp: split at ~140 Hz, keep the sub clean and mono, distort the rest,
    // then roll it off like a speaker cabinet.
    void processMultiband (juce::dsp::AudioBlock<float>& up, const FxParams& p, float gain);

    float toneState[2] {};
    float crushHold[2] {};
    int crushCounter[2] {};
    Svf lowA[2], lowB[2], highA[2], highB[2]; // Linkwitz-Riley 4th-order crossover
    Svf midBoost[2], cabA[2], cabB[2], cabLowCut[2];
};

// Tempo-synced ping-pong delay with a darkening filter in the feedback path.
class PingPongDelay
{
public:
    void prepare (double sampleRate);
    void reset();
    void process (juce::AudioBuffer<float>& buffer, const FxParams& p, const Transport& t);

private:
    float read (const std::vector<float>& line, float delay) const noexcept;

    std::vector<float> lineL, lineR;
    int writePos = 0;
    double sr = 44100.0;
    float smoothedDelay = -1.0f;
    float lpL = 0, lpR = 0;
};

// Sidechain-style volume ducking locked to the host tempo.
class Pump
{
public:
    void prepare (double sampleRate) { sr = sampleRate; phase = 0.0; }
    void process (juce::AudioBuffer<float>& buffer, const FxParams& p, const Transport& t);

private:
    double sr = 44100.0;
    double phase = 0.0;
};

class FxChain
{
public:
    void prepare (double sampleRate, int maxBlock);
    void reset();
    void process (juce::AudioBuffer<float>& buffer, const FxParams& p, const Transport& t);

private:
    Drive drive;
    juce::dsp::Chorus<float> chorus;
    PingPongDelay delay;
    juce::Reverb reverb;
    Pump pump;
    juce::SmoothedValue<float> masterGain;
    float dcX[2] {}, dcY[2] {};
    float dcCoef = 0.999f;
};
} // namespace m84
