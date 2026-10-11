#include "Parameters.h"

namespace m84
{
juce::StringArray oscWaveNames()    { return { "Sine", "Triangle", "Saw", "Square" }; }
juce::StringArray lfoWaveNames()    { return { "Sine", "Triangle", "Saw Down", "Saw Up", "Square", "S&H" }; }
juce::StringArray filterTypeNames() { return { "LP 24", "LP 12", "BP", "HP 24" }; }
juce::StringArray driveTypeNames()  { return { "Tube", "Hard", "Fold", "Crush" }; }
juce::StringArray voiceModeNames()  { return { "Poly", "Mono", "Legato" }; }

const juce::StringArray& lfoSyncNames()
{
    static const juce::StringArray n { "4 Bars", "2 Bars", "1 Bar", "1/2", "1/4", "1/4T", "1/8", "1/8T", "1/16", "1/16T", "1/32" };
    return n;
}
const std::vector<double>& lfoSyncBeats()
{
    static const std::vector<double> b { 16.0, 8.0, 4.0, 2.0, 1.0, 2.0 / 3.0, 0.5, 1.0 / 3.0, 0.25, 1.0 / 6.0, 0.125 };
    return b;
}
const juce::StringArray& delayTimeNames()
{
    static const juce::StringArray n { "1/16", "1/8T", "1/8", "1/4T", "1/8D", "1/4", "1/4D", "1/2" };
    return n;
}
const std::vector<double>& delayTimeBeats()
{
    static const std::vector<double> b { 0.25, 1.0 / 3.0, 0.5, 2.0 / 3.0, 0.75, 1.0, 1.5, 2.0 };
    return b;
}
const juce::StringArray& pumpRateNames()
{
    static const juce::StringArray n { "1/2", "1/4", "1/8", "1/16" };
    return n;
}
const std::vector<double>& pumpRateBeats()
{
    static const std::vector<double> b { 2.0, 1.0, 0.5, 0.25 };
    return b;
}

namespace
{
    using Attr = juce::AudioParameterFloatAttributes;

    juce::String pct (float v, int)      { return juce::String (juce::roundToInt (v * 100.0f)) + "%"; }
    juce::String bipct (float v, int)    { auto i = juce::roundToInt (v * 100.0f); return (i > 0 ? "+" : "") + juce::String (i) + "%"; }
    juce::String hz (float v, int)       { return v >= 1000.0f ? juce::String (v / 1000.0f, 2) + " kHz" : juce::String (v, v < 100.0f ? 1 : 0) + " Hz"; }
    juce::String secs (float v, int)     { return v < 1.0f ? juce::String (juce::roundToInt (v * 1000.0f)) + " ms" : juce::String (v, 2) + " s"; }
    juce::String semis (float v, int)    { auto i = juce::roundToInt (v); return (i > 0 ? "+" : "") + juce::String (i) + " st"; }
    juce::String octs (float v, int)     { auto i = juce::roundToInt (v); return (i > 0 ? "+" : "") + juce::String (i) + " oct"; }
    juce::String cents (float v, int)    { auto i = juce::roundToInt (v); return (i > 0 ? "+" : "") + juce::String (i) + " ct"; }
    juce::String plain (float v, int)    { return juce::String (juce::roundToInt (v)); }
    juce::String db (float v, int)       { return juce::String (v, 1) + " dB"; }

    juce::NormalisableRange<float> skewed (float lo, float hi, float centre)
    {
        juce::NormalisableRange<float> r (lo, hi);
        r.setSkewForCentre (centre);
        return r;
    }

    template <typename Fn>
    std::unique_ptr<juce::AudioParameterFloat> flt (const juce::String& id, const juce::String& name,
                                                    juce::NormalisableRange<float> range, float def, Fn toText)
    {
        return std::make_unique<juce::AudioParameterFloat> (juce::ParameterID { id, 1 }, name, range, def,
                                                            Attr().withStringFromValueFunction (toText));
    }

    std::unique_ptr<juce::AudioParameterChoice> choice (const juce::String& id, const juce::String& name,
                                                        const juce::StringArray& items, int def)
    {
        return std::make_unique<juce::AudioParameterChoice> (juce::ParameterID { id, 1 }, name, items, def);
    }

    std::unique_ptr<juce::AudioParameterBool> toggle (const juce::String& id, const juce::String& name, bool def)
    {
        return std::make_unique<juce::AudioParameterBool> (juce::ParameterID { id, 1 }, name, def);
    }
} // namespace

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    const char* oscNames[] = { "Osc A", "Osc B", "Osc C" };
    for (int i = 0; i < kNumOscs; ++i)
    {
        const juce::String n = oscNames[i];
        layout.add (choice (ID::oscId (i, "Wave"), n + " Wave", oscWaveNames(), 2));
        layout.add (flt (ID::oscId (i, "Oct"), n + " Octave", { -3.0f, 3.0f, 1.0f }, 0.0f, octs));
        layout.add (flt (ID::oscId (i, "Semi"), n + " Semitone", { -12.0f, 12.0f, 1.0f }, 0.0f, semis));
        layout.add (flt (ID::oscId (i, "Fine"), n + " Fine", { -100.0f, 100.0f }, 0.0f, cents));
        layout.add (flt (ID::oscId (i, "PW"), n + " Pulse Width", { 0.05f, 0.95f }, 0.5f, pct));
        layout.add (flt (ID::oscId (i, "Level"), n + " Level", { 0.0f, 1.0f }, i == 0 ? 0.8f : 0.0f, pct));
        layout.add (flt (ID::oscId (i, "Unison"), n + " Unison", { 1.0f, (float) kMaxUnison, 1.0f }, 1.0f, plain));
        layout.add (flt (ID::oscId (i, "Detune"), n + " Detune", { 0.0f, 1.0f }, 0.25f, pct));
    }

    layout.add (flt (ID::subLevel, "Sub Level", { 0.0f, 1.0f }, 0.0f, pct));
    layout.add (choice (ID::subOct, "Sub Octave", { "-1 Oct", "-2 Oct" }, 0));
    layout.add (choice (ID::subWave, "Sub Wave", { "Sine", "Square" }, 0));
    layout.add (flt (ID::noise, "Noise", { 0.0f, 1.0f }, 0.0f, pct));
    layout.add (flt (ID::spread, "Unison Spread", { 0.0f, 1.0f }, 0.6f, pct));

    layout.add (choice (ID::fltType, "Filter Type", filterTypeNames(), 0));
    layout.add (flt (ID::cutoff, "Cutoff", skewed (20.0f, 20000.0f, 900.0f), 8000.0f, hz));
    layout.add (flt (ID::res, "Resonance", { 0.0f, 1.0f }, 0.1f, pct));
    layout.add (flt (ID::fltDrive, "Filter Drive", { 0.0f, 1.0f }, 0.2f, pct));
    layout.add (flt (ID::fltEnv, "Filter Env Amount", { -1.0f, 1.0f }, 0.0f, bipct));
    layout.add (flt (ID::fltKey, "Key Tracking", { 0.0f, 1.0f }, 0.3f, pct));
    layout.add (flt (ID::fltVel, "Filter Velocity", { 0.0f, 1.0f }, 0.3f, pct));
    layout.add (flt (ID::fltLfo, "Filter LFO", { 0.0f, 1.0f }, 0.0f, pct));

    const auto envTime = skewed (0.0f, 10.0f, 0.6f);
    layout.add (flt (ID::fA, "Filter Attack", envTime, 0.0f, secs));
    layout.add (flt (ID::fD, "Filter Decay", envTime, 0.3f, secs));
    layout.add (flt (ID::fS, "Filter Sustain", { 0.0f, 1.0f }, 0.0f, pct));
    layout.add (flt (ID::fR, "Filter Release", envTime, 0.3f, secs));
    layout.add (flt (ID::aA, "Amp Attack", envTime, 0.002f, secs));
    layout.add (flt (ID::aD, "Amp Decay", envTime, 0.4f, secs));
    layout.add (flt (ID::aS, "Amp Sustain", { 0.0f, 1.0f }, 1.0f, pct));
    layout.add (flt (ID::aR, "Amp Release", envTime, 0.2f, secs));
    layout.add (flt (ID::ampVel, "Amp Velocity", { 0.0f, 1.0f }, 0.3f, pct));

    layout.add (choice (ID::lfoWave, "LFO Wave", lfoWaveNames(), 0));
    layout.add (flt (ID::lfoRate, "LFO Rate", skewed (0.02f, 30.0f, 2.0f), 2.0f, hz));
    layout.add (toggle (ID::lfoSync, "LFO Sync", false));
    layout.add (choice (ID::lfoSyncRate, "LFO Sync Rate", lfoSyncNames(), 4));
    layout.add (toggle (ID::lfoRetrig, "LFO Retrigger", false));
    layout.add (flt (ID::lfoPitch, "LFO > Pitch", { 0.0f, 1.0f }, 0.0f, pct));
    layout.add (flt (ID::lfoPW, "LFO > PWM", { 0.0f, 1.0f }, 0.0f, pct));

    layout.add (choice (ID::voiceMode, "Voice Mode", voiceModeNames(), 0));
    layout.add (flt (ID::polyphony, "Polyphony", { 1.0f, (float) kMaxVoices, 1.0f }, 8.0f, plain));
    layout.add (flt (ID::glide, "Glide", skewed (0.0f, 2.0f, 0.25f), 0.0f, secs));
    layout.add (flt (ID::bendRange, "Bend Range", { 0.0f, 24.0f, 1.0f }, 2.0f, semis));
    layout.add (flt (ID::analog, "Analog Drift", { 0.0f, 1.0f }, 0.3f, pct));

    layout.add (choice (ID::drvType, "Drive Type", driveTypeNames(), 0));
    layout.add (flt (ID::drvAmt, "Drive", { 0.0f, 1.0f }, 0.0f, pct));
    layout.add (flt (ID::drvTone, "Drive Tone", { 0.0f, 1.0f }, 0.8f, pct));
    layout.add (flt (ID::drvMix, "Drive Mix", { 0.0f, 1.0f }, 1.0f, pct));

    layout.add (flt (ID::chRate, "Chorus Rate", skewed (0.05f, 5.0f, 0.8f), 0.6f, hz));
    layout.add (flt (ID::chDepth, "Chorus Depth", { 0.0f, 1.0f }, 0.4f, pct));
    layout.add (flt (ID::chMix, "Chorus Mix", { 0.0f, 1.0f }, 0.0f, pct));

    layout.add (choice (ID::dlyTime, "Delay Time", delayTimeNames(), 4));
    layout.add (flt (ID::dlyFb, "Delay Feedback", { 0.0f, 0.95f }, 0.35f, pct));
    layout.add (flt (ID::dlyTone, "Delay Tone", { 0.0f, 1.0f }, 0.5f, pct));
    layout.add (flt (ID::dlyMix, "Delay Mix", { 0.0f, 1.0f }, 0.0f, pct));

    layout.add (flt (ID::revSize, "Reverb Size", { 0.0f, 1.0f }, 0.7f, pct));
    layout.add (flt (ID::revDamp, "Reverb Damping", { 0.0f, 1.0f }, 0.5f, pct));
    layout.add (flt (ID::revMix, "Reverb Mix", { 0.0f, 1.0f }, 0.0f, pct));

    layout.add (choice (ID::pumpRate, "Pump Rate", pumpRateNames(), 1));
    layout.add (flt (ID::pumpAmt, "Pump Amount", { 0.0f, 1.0f }, 0.0f, pct));

    layout.add (flt (ID::master, "Master Volume", { -36.0f, 6.0f }, -6.0f, db));

    return layout;
}
} // namespace m84
