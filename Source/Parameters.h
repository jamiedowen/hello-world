#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace m84
{
// Parameter IDs. Oscillator IDs are built with oscId(index, suffix), e.g. "osc1Wave".
namespace ID
{
    inline juce::String oscId (int index, const char* suffix) { return "osc" + juce::String (index + 1) + suffix; }

    inline constexpr const char* subLevel   = "subLevel";
    inline constexpr const char* subOct     = "subOct";
    inline constexpr const char* subWave    = "subWave";
    inline constexpr const char* noise      = "noise";
    inline constexpr const char* spread     = "spread";
    inline constexpr const char* grit       = "grit";
    inline constexpr const char* feedback   = "feedback";
    inline constexpr const char* oscSync    = "osc2Sync";
    inline constexpr const char* oscFM      = "osc2FM";

    inline constexpr const char* fltType    = "fltType";
    inline constexpr const char* cutoff     = "cutoff";
    inline constexpr const char* res        = "res";
    inline constexpr const char* fltDrive   = "fltDrive";
    inline constexpr const char* fltEnv     = "fltEnv";
    inline constexpr const char* fltKey     = "fltKey";
    inline constexpr const char* fltVel     = "fltVel";
    inline constexpr const char* fltLfo     = "fltLfo";

    inline constexpr const char* fA = "fA";
    inline constexpr const char* fD = "fD";
    inline constexpr const char* fS = "fS";
    inline constexpr const char* fR = "fR";
    inline constexpr const char* aA = "aA";
    inline constexpr const char* aD = "aD";
    inline constexpr const char* aS = "aS";
    inline constexpr const char* aR = "aR";
    inline constexpr const char* ampVel = "ampVel";

    inline constexpr const char* lfoWave    = "lfoWave";
    inline constexpr const char* lfoRate    = "lfoRate";
    inline constexpr const char* lfoSync    = "lfoSync";
    inline constexpr const char* lfoSyncRate = "lfoSyncRate";
    inline constexpr const char* lfoRetrig  = "lfoRetrig";
    inline constexpr const char* lfoPitch   = "lfoPitch";
    inline constexpr const char* lfoPW      = "lfoPW";

    inline constexpr const char* voiceMode  = "voiceMode";
    inline constexpr const char* polyphony  = "polyphony";
    inline constexpr const char* glide      = "glide";
    inline constexpr const char* bendRange  = "bendRange";
    inline constexpr const char* analog     = "analog";

    inline constexpr const char* drvType    = "drvType";
    inline constexpr const char* drvAmt     = "drvAmt";
    inline constexpr const char* drvTone    = "drvTone";
    inline constexpr const char* drvMix     = "drvMix";

    inline constexpr const char* chRate     = "chRate";
    inline constexpr const char* chDepth    = "chDepth";
    inline constexpr const char* chMix      = "chMix";

    inline constexpr const char* dlyTime    = "dlyTime";
    inline constexpr const char* dlyFb      = "dlyFb";
    inline constexpr const char* dlyTone    = "dlyTone";
    inline constexpr const char* dlyMix     = "dlyMix";

    inline constexpr const char* revSize    = "revSize";
    inline constexpr const char* revDamp    = "revDamp";
    inline constexpr const char* revMix     = "revMix";

    inline constexpr const char* pumpRate   = "pumpRate";
    inline constexpr const char* pumpAmt    = "pumpAmt";

    inline constexpr const char* master     = "master";
    inline constexpr const char* hq         = "hq";

    inline constexpr const char* hpf        = "hpf";
    inline constexpr const char* pmEnvB     = "pmEnvB";   // poly-mod: filter env -> osc B pitch
    inline constexpr const char* pmBCut     = "pmBCut";   // poly-mod: osc B -> filter cutoff
    inline constexpr const char* ring       = "ring";

    inline constexpr const char* arpOn      = "arpOn";
    inline constexpr const char* arpMode    = "arpMode";
    inline constexpr const char* arpRate    = "arpRate";
    inline constexpr const char* arpOct     = "arpOct";
    inline constexpr const char* arpGate    = "arpGate";

    inline constexpr const char* sqDepth    = "sqDepth";
    inline constexpr const char* sqTime     = "sqTime";
    inline constexpr const char* sqUp       = "sqUp";
    inline constexpr const char* sqDown     = "sqDown";
}

constexpr int kNumOscs = 3;
constexpr int kMaxUnison = 7;
constexpr int kMaxVoices = 16;

juce::StringArray oscWaveNames();
juce::StringArray lfoWaveNames();
juce::StringArray filterTypeNames();
juce::StringArray driveTypeNames();
juce::StringArray voiceModeNames();
juce::StringArray arpModeNames();
const juce::StringArray& arpRateNames();
const std::vector<double>& arpRateBeats();

// Note lengths in beats, paired with their display names.
const juce::StringArray& lfoSyncNames();
const std::vector<double>& lfoSyncBeats();
const juce::StringArray& delayTimeNames();
const std::vector<double>& delayTimeBeats();
const juce::StringArray& pumpRateNames();
const std::vector<double>& pumpRateBeats();

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
} // namespace m84
