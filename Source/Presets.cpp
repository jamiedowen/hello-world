#include "Presets.h"

namespace m84
{
// Oscillator waves: 0 Sine, 1 Triangle, 2 Saw, 3 Square.
// Filter types: 0 LP24, 1 LP12, 2 BP, 3 HP24. Drive: 0 Tube, 1 Hard, 2 Fold, 3 Crush, 4 Grind, 5 Amp.
// Voice mode: 0 Poly, 1 Mono, 2 Legato.
const std::vector<Preset>& factoryPresets()
{
    static const std::vector<Preset> presets {
        { "Init", {} },

        { "Perturbed Bass", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f },
            { "osc2Wave", 2 }, { "osc2Level", 0.7f }, { "osc2Fine", 8 },
            { "osc3Wave", 3 }, { "osc3Level", 0.4f }, { "osc3Oct", -1 },
            { "subLevel", 0.5f },
            { "cutoff", 180 }, { "res", 0.35f }, { "fltDrive", 0.5f }, { "fltEnv", 0.55f }, { "fltKey", 0.4f },
            { "fA", 0.0f }, { "fD", 0.25f }, { "fS", 0.15f }, { "fR", 0.15f },
            { "aA", 0.001f }, { "aD", 0.5f }, { "aS", 0.9f }, { "aR", 0.12f },
            { "grit", 0.3f }, { "feedback", 0.2f },
            { "drvType", 4 }, { "drvAmt", 0.45f }, { "drvTone", 0.55f },
            { "voiceMode", 1 }, { "glide", 0.03f }, { "analog", 0.4f } } },

        { "Brut Force", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f }, { "osc1Unison", 5 }, { "osc1Detune", 0.3f },
            { "osc2Wave", 3 }, { "osc2Level", 0.5f }, { "osc2Oct", -1 },
            { "subLevel", 0.6f }, { "subWave", 1 },
            { "cutoff", 260 }, { "res", 0.25f }, { "fltDrive", 0.6f }, { "fltEnv", 0.6f }, { "fltKey", 0.4f },
            { "fD", 0.18f }, { "fS", 0.25f }, { "fR", 0.1f },
            { "aA", 0.001f }, { "aS", 1.0f }, { "aR", 0.1f },
            { "grit", 0.45f }, { "feedback", 0.25f },
            { "drvType", 4 }, { "drvAmt", 0.55f }, { "drvTone", 0.55f },
            { "pumpRate", 1 }, { "pumpAmt", 0.5f },
            { "voiceMode", 1 }, { "glide", 0.02f } } },

        { "Night Drive Pluck", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f },
            { "osc2Wave", 3 }, { "osc2Level", 0.3f }, { "osc2Oct", 1 }, { "osc2PW", 0.35f },
            { "cutoff", 300 }, { "res", 0.3f }, { "fltEnv", 0.7f }, { "fltVel", 0.5f },
            { "fD", 0.22f }, { "fS", 0.0f }, { "fR", 0.3f },
            { "aA", 0.001f }, { "aD", 0.5f }, { "aS", 0.0f }, { "aR", 0.3f },
            { "chMix", 0.3f }, { "dlyTime", 4 }, { "dlyFb", 0.4f }, { "dlyMix", 0.3f },
            { "revMix", 0.25f }, { "voiceMode", 0 }, { "polyphony", 8 } } },

        { "Dark Reese", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f }, { "osc1Unison", 3 }, { "osc1Detune", 0.2f },
            { "osc2Wave", 2 }, { "osc2Level", 0.8f }, { "osc2Fine", 18 },
            { "subLevel", 0.6f },
            { "cutoff", 420 }, { "res", 0.2f }, { "fltDrive", 0.4f }, { "fltEnv", 0.15f }, { "fltLfo", 0.25f },
            { "fD", 0.6f }, { "fS", 0.5f },
            { "lfoWave", 1 }, { "lfoRate", 0.3f },
            { "aA", 0.005f }, { "aS", 1.0f }, { "aR", 0.25f },
            { "drvType", 2 }, { "drvAmt", 0.3f }, { "drvMix", 0.6f },
            { "voiceMode", 2 }, { "glide", 0.08f } } },

        { "Turbo Slayer", {
            { "osc1Wave", 3 }, { "osc1Level", 0.8f }, { "osc1PW", 0.3f },
            { "osc2Wave", 2 }, { "osc2Level", 0.7f }, { "osc2Oct", -1 },
            { "subLevel", 0.4f },
            { "cutoff", 500 }, { "res", 0.45f }, { "fltDrive", 0.8f }, { "fltEnv", 0.4f },
            { "fD", 0.2f }, { "fS", 0.3f },
            { "lfoPW", 0.3f }, { "lfoRate", 0.8f },
            { "aA", 0.001f }, { "aS", 1.0f }, { "aR", 0.08f },
            { "grit", 0.5f }, { "feedback", 0.3f },
            { "drvType", 5 }, { "drvAmt", 0.6f }, { "drvTone", 0.5f },
            { "pumpRate", 1 }, { "pumpAmt", 0.7f },
            { "voiceMode", 1 } } },

        { "VHS Pad", {
            { "osc1Wave", 2 }, { "osc1Level", 0.7f }, { "osc1Unison", 5 }, { "osc1Detune", 0.35f },
            { "osc2Wave", 3 }, { "osc2Level", 0.3f }, { "osc2Oct", 1 }, { "osc2PW", 0.35f },
            { "cutoff", 1400 }, { "res", 0.15f }, { "fltEnv", 0.2f },
            { "fA", 1.2f }, { "fD", 2.0f }, { "fS", 0.6f }, { "fR", 1.5f },
            { "aA", 0.8f }, { "aD", 1.0f }, { "aS", 0.9f }, { "aR", 1.8f },
            { "lfoWave", 1 }, { "lfoRate", 0.25f }, { "lfoPW", 0.2f },
            { "chMix", 0.6f }, { "chDepth", 0.5f }, { "revMix", 0.45f }, { "revSize", 0.85f },
            { "analog", 0.6f }, { "voiceMode", 0 }, { "polyphony", 12 } } },

        { "Neon Lead", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f }, { "osc1Unison", 7 }, { "osc1Detune", 0.4f },
            { "osc2Wave", 3 }, { "osc2Level", 0.25f }, { "osc2Oct", 1 },
            { "cutoff", 2600 }, { "res", 0.2f }, { "fltEnv", 0.25f }, { "fD", 0.4f }, { "fS", 0.5f },
            { "lfoWave", 0 }, { "lfoRate", 5.5f }, { "lfoPitch", 0.1f },
            { "aA", 0.01f }, { "aS", 1.0f }, { "aR", 0.3f },
            { "dlyTime", 6 }, { "dlyFb", 0.35f }, { "dlyMix", 0.3f }, { "revMix", 0.3f },
            { "voiceMode", 2 }, { "glide", 0.06f } } },

        { "Hellfire Arp", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f },
            { "osc2Wave", 2 }, { "osc2Level", 0.4f }, { "osc2Semi", 7 },
            { "cutoff", 350 }, { "res", 0.4f }, { "fltEnv", 0.55f }, { "fD", 0.15f }, { "fS", 0.0f },
            { "aA", 0.001f }, { "aD", 0.25f }, { "aS", 0.0f }, { "aR", 0.15f },
            { "drvType", 0 }, { "drvAmt", 0.3f },
            { "dlyTime", 2 }, { "dlyFb", 0.45f }, { "dlyMix", 0.25f },
            { "pumpRate", 1 }, { "pumpAmt", 0.45f }, { "voiceMode", 0 } } },

        { "Ladder Mono Bass", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f },
            { "osc2Wave", 2 }, { "osc2Level", 0.7f }, { "osc2Fine", -7 },
            { "osc3Wave", 3 }, { "osc3Level", 0.6f }, { "osc3Oct", -1 },
            { "cutoff", 220 }, { "res", 0.55f }, { "fltDrive", 0.6f }, { "fltEnv", 0.45f },
            { "fD", 0.35f }, { "fS", 0.2f }, { "fR", 0.2f },
            { "aA", 0.002f }, { "aS", 1.0f }, { "aR", 0.15f },
            { "grit", 0.25f }, { "feedback", 0.45f },
            { "voiceMode", 2 }, { "glide", 0.05f }, { "analog", 0.5f } } },

        { "Sub Doom", {
            { "osc1Wave", 3 }, { "osc1Level", 0.5f }, { "osc1Oct", -1 },
            { "subLevel", 0.9f },
            { "cutoff", 140 }, { "res", 0.1f }, { "fltEnv", 0.3f }, { "fD", 0.4f }, { "fS", 0.1f },
            { "aA", 0.002f }, { "aS", 1.0f }, { "aR", 0.2f },
            { "drvType", 0 }, { "drvAmt", 0.25f }, { "voiceMode", 1 } } },

        { "Synth Brass 84", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f },
            { "osc2Wave", 2 }, { "osc2Level", 0.7f }, { "osc2Fine", 10 },
            { "cutoff", 500 }, { "res", 0.1f }, { "fltEnv", 0.45f },
            { "fA", 0.08f }, { "fD", 0.6f }, { "fS", 0.45f }, { "fR", 0.4f },
            { "aA", 0.03f }, { "aS", 0.9f }, { "aR", 0.35f },
            { "chMix", 0.25f }, { "revMix", 0.2f }, { "voiceMode", 0 } } },

        { "Blade Stab", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f }, { "osc1Unison", 5 }, { "osc1Detune", 0.45f },
            { "osc2Wave", 2 }, { "osc2Level", 0.5f }, { "osc2Oct", -1 }, { "osc2Unison", 3 },
            { "cutoff", 900 }, { "fltEnv", 0.5f }, { "fD", 0.3f }, { "fS", 0.1f },
            { "aA", 0.001f }, { "aD", 0.35f }, { "aS", 0.0f }, { "aR", 0.4f },
            { "revMix", 0.4f }, { "revSize", 0.9f }, { "dlyTime", 5 }, { "dlyMix", 0.2f },
            { "voiceMode", 0 } } },

        { "Pulse Wobble", {
            { "osc1Wave", 3 }, { "osc1Level", 0.8f }, { "osc1PW", 0.4f },
            { "osc2Wave", 2 }, { "osc2Level", 0.6f }, { "osc2Fine", 12 },
            { "subLevel", 0.5f },
            { "cutoff", 300 }, { "res", 0.5f }, { "fltDrive", 0.5f }, { "fltLfo", 0.55f },
            { "lfoWave", 0 }, { "lfoSync", 1 }, { "lfoSyncRate", 6 },
            { "aA", 0.002f }, { "aS", 1.0f }, { "aR", 0.15f },
            { "drvType", 2 }, { "drvAmt", 0.35f }, { "voiceMode", 1 } } },

        { "Outrun Chords", {
            { "osc1Wave", 2 }, { "osc1Level", 0.75f }, { "osc1Unison", 3 }, { "osc1Detune", 0.25f },
            { "osc2Wave", 3 }, { "osc2Level", 0.2f }, { "osc2Oct", 1 },
            { "cutoff", 1800 }, { "res", 0.1f }, { "fltEnv", 0.2f }, { "fD", 0.5f }, { "fS", 0.4f },
            { "aA", 0.005f }, { "aS", 0.85f }, { "aR", 0.4f },
            { "chMix", 0.45f }, { "pumpRate", 1 }, { "pumpAmt", 0.6f }, { "revMix", 0.3f },
            { "voiceMode", 0 }, { "polyphony", 12 } } },

        { "Crimson Overdrive", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f }, { "osc1Unison", 5 }, { "osc1Detune", 0.32f },
            { "osc2Wave", 2 }, { "osc2Level", 0.35f }, { "osc2Oct", 1 }, { "osc2Fine", 6 },
            { "osc3Wave", 3 }, { "osc3Level", 0.3f }, { "osc3PW", 0.3f }, { "osc3Fine", -9 },
            { "spread", 0.75f },
            { "cutoff", 7000 }, { "res", 0.22f }, { "fltDrive", 0.75f }, { "fltEnv", 0.2f }, { "fltKey", 0.5f },
            { "fA", 0.0f }, { "fD", 0.45f }, { "fS", 0.55f }, { "fR", 0.3f },
            { "aA", 0.004f }, { "aD", 0.5f }, { "aS", 1.0f }, { "aR", 0.28f }, { "ampVel", 0.2f },
            { "lfoWave", 0 }, { "lfoRate", 5.6f }, { "lfoPitch", 0.11f },
            { "drvType", 1 }, { "drvAmt", 0.52f }, { "drvTone", 0.86f }, { "drvMix", 0.85f },
            { "chMix", 0.2f }, { "chDepth", 0.35f },
            { "dlyTime", 4 }, { "dlyFb", 0.42f }, { "dlyTone", 0.55f }, { "dlyMix", 0.26f },
            { "revMix", 0.3f }, { "revSize", 0.82f }, { "revDamp", 0.4f },
            { "voiceMode", 2 }, { "glide", 0.055f }, { "bendRange", 2 }, { "analog", 0.35f },
            { "master", -7.0f } } },

        { "Iron Teeth", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f },
            { "osc2Wave", 3 }, { "osc2Level", 0.6f }, { "osc2Fine", 9 }, { "osc2PW", 0.42f },
            { "osc3Wave", 2 }, { "osc3Level", 0.5f }, { "osc3Oct", -1 },
            { "grit", 0.55f }, { "feedback", 0.35f },
            { "cutoff", 320 }, { "res", 0.3f }, { "fltDrive", 0.55f }, { "fltEnv", 0.5f }, { "fltKey", 0.4f },
            { "fD", 0.22f }, { "fS", 0.3f }, { "fR", 0.12f },
            { "aA", 0.001f }, { "aS", 1.0f }, { "aR", 0.1f },
            { "drvType", 4 }, { "drvAmt", 0.55f }, { "drvTone", 0.65f },
            { "voiceMode", 1 }, { "glide", 0.02f }, { "analog", 0.45f } } },

        { "Gutter Grinder", {
            { "osc1Wave", 2 }, { "osc1Level", 0.7f }, { "osc1Unison", 3 }, { "osc1Detune", 0.2f },
            { "osc2Wave", 2 }, { "osc2Level", 0.55f }, { "osc2Oct", 1 }, { "osc2Semi", 5 },
            { "osc2Sync", 1 }, { "osc2FM", 0.25f },
            { "subLevel", 0.5f },
            { "grit", 0.7f }, { "feedback", 0.5f },
            { "cutoff", 600 }, { "res", 0.35f }, { "fltDrive", 0.5f }, { "fltEnv", 0.35f }, { "fltKey", 0.3f },
            { "fD", 0.3f }, { "fS", 0.5f },
            { "aA", 0.001f }, { "aS", 1.0f }, { "aR", 0.12f },
            { "drvType", 5 }, { "drvAmt", 0.6f }, { "drvTone", 0.5f },
            { "voiceMode", 1 }, { "glide", 0.015f }, { "analog", 0.4f } } },

        { "Doom Engine", {
            { "osc1Wave", 2 }, { "osc1Level", 0.8f },
            { "osc2Wave", 3 }, { "osc2Level", 0.6f }, { "osc2Oct", -1 }, { "osc2Fine", -6 },
            { "subLevel", 0.7f },
            { "grit", 0.4f }, { "feedback", 0.6f },
            { "cutoff", 150 }, { "res", 0.45f }, { "fltDrive", 0.6f }, { "fltEnv", 0.3f }, { "fltKey", 0.3f },
            { "fD", 0.6f }, { "fS", 0.4f }, { "fR", 0.3f },
            { "aA", 0.004f }, { "aS", 1.0f }, { "aR", 0.25f },
            { "drvType", 4 }, { "drvAmt", 0.45f }, { "drvTone", 0.5f },
            { "voiceMode", 2 }, { "glide", 0.08f }, { "analog", 0.5f } } },

        { "Chainsaw", {
            { "osc1Wave", 3 }, { "osc1Level", 0.6f }, { "osc1PW", 0.2f },
            { "osc2Wave", 2 }, { "osc2Level", 0.7f }, { "osc2Oct", 1 }, { "osc2Sync", 1 },
            { "subLevel", 0.45f }, { "subWave", 1 },
            { "grit", 0.5f }, { "feedback", 0.2f },
            { "cutoff", 1800 }, { "res", 0.2f }, { "fltDrive", 0.5f }, { "fltEnv", 0.25f },
            { "fD", 0.25f }, { "fS", 0.6f },
            { "lfoWave", 1 }, { "lfoRate", 6.0f }, { "lfoPW", 0.4f },
            { "aA", 0.001f }, { "aS", 1.0f }, { "aR", 0.1f },
            { "drvType", 4 }, { "drvAmt", 0.6f }, { "drvTone", 0.6f },
            { "voiceMode", 1 } } },
    };
    return presets;
}

void applyPreset (juce::AudioProcessorValueTreeState& apvts, const Preset& preset)
{
    for (auto* p : apvts.processor.getParameters())
        if (auto* rp = dynamic_cast<juce::RangedAudioParameter*> (p))
            rp->setValueNotifyingHost (rp->getDefaultValue());

    for (const auto& [id, value] : preset.values)
        if (auto* rp = apvts.getParameter (id))
            rp->setValueNotifyingHost (rp->convertTo0to1 (value));
}
} // namespace m84
