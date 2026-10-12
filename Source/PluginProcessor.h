#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <array>
#include <atomic>
#include "Arpeggiator.h"
#include "Effects.h"
#include "Parameters.h"
#include "SynthEngine.h"

// Lock-free ring buffer feeding the oscilloscope in the editor.
struct ScopeBuffer
{
    static constexpr int size = 4096;
    std::array<float, size> data {};
    std::atomic<int> writePos { 0 };

    void push (const float* L, const float* R, int n) noexcept
    {
        int w = writePos.load (std::memory_order_relaxed);
        for (int i = 0; i < n; ++i)
        {
            data[(size_t) w] = R != nullptr ? 0.5f * (L[i] + R[i]) : L[i];
            w = (w + 1) & (size - 1);
        }
        writePos.store (w, std::memory_order_release);
    }

    void copyLatest (float* dest, int n) const noexcept
    {
        const int w = writePos.load (std::memory_order_acquire);
        for (int i = 0; i < n; ++i)
            dest[i] = data[(size_t) ((w - n + i + size) & (size - 1))];
    }
};

class Midnight84AudioProcessor : public juce::AudioProcessor
{
public:
    Midnight84AudioProcessor();
    ~Midnight84AudioProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 4.0; }

    int getNumPrograms() override;
    int getCurrentProgram() override { return currentProgram; }
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    bool saveUserPreset (const juce::File& file);
    bool loadUserPreset (const juce::File& file);
    juce::String getPresetName() const { const juce::ScopedLock sl (nameLock); return presetName; }

    juce::AudioProcessorValueTreeState apvts;
    ScopeBuffer scope;
    juce::MidiKeyboardState keyboardState; // on-screen keyboard (standalone / mobile)

private:
    struct ParamPointers
    {
        struct Osc { std::atomic<float> *wave, *oct, *semi, *fine, *pw, *level, *unison, *detune; };
        std::array<Osc, m84::kNumOscs> osc;
        std::atomic<float> *subLevel, *subOct, *subWave, *noise, *spread, *grit, *feedback, *oscSync, *oscFM;
        std::atomic<float> *fltType, *cutoff, *res, *fltDrive, *fltEnv, *fltKey, *fltVel, *fltLfo;
        std::atomic<float> *fA, *fD, *fS, *fR, *aA, *aD, *aS, *aR, *ampVel;
        std::atomic<float> *lfoWave, *lfoRate, *lfoSync, *lfoSyncRate, *lfoRetrig, *lfoPitch, *lfoPW;
        std::atomic<float> *voiceMode, *polyphony, *glide, *bendRange, *analog;
        std::atomic<float> *drvType, *drvAmt, *drvTone, *drvMix, *chRate, *chDepth, *chMix;
        std::atomic<float> *dlyTime, *dlyFb, *dlyTone, *dlyMix, *revSize, *revDamp, *revMix;
        std::atomic<float> *pumpRate, *pumpAmt, *master, *hq;
        std::atomic<float> *hpf, *pmEnvB, *pmBCut, *ring;
        std::atomic<float> *arpOn, *arpMode, *arpRate, *arpOct, *arpGate;
        std::atomic<float> *sqDepth, *sqTime, *sqUp, *sqDown;
    };

    void cacheParameterPointers();
    m84::EngineParams readEngineParams() const;
    m84::FxParams readFxParams() const;
    void setPresetName (const juce::String& name) { const juce::ScopedLock sl (nameLock); presetName = name; }

    ParamPointers pp {};
    m84::Arpeggiator arp;
    m84::SynthEngine engine;
    m84::FxChain fx;
    int lastVoiceMode = -1;

    int currentProgram = 0;
    juce::CriticalSection nameLock;
    juce::String presetName { "Init" };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Midnight84AudioProcessor)
};
