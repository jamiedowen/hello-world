#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <vector>

namespace m84
{
struct Preset
{
    juce::String name;
    // Parameter ID -> value in real units (choice params use the item index).
    std::vector<std::pair<juce::String, float>> values;
};

const std::vector<Preset>& factoryPresets();

// Resets every parameter to its default, then applies the preset's values.
void applyPreset (juce::AudioProcessorValueTreeState& apvts, const Preset& preset);
} // namespace m84
