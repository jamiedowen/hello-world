#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "Components.h"
#include "LookAndFeel.h"
#include "PluginProcessor.h"

namespace m84
{
// Fixed-size (1200 x 900) panel holding every control; the editor scales it.
class MainContent : public juce::Component
{
public:
    static constexpr int baseWidth = 1200;
    static constexpr int baseHeight = 900;

    explicit MainContent (Midnight84AudioProcessor& p);
    void paint (juce::Graphics&) override;

private:
    struct Panel
    {
        juce::Rectangle<int> bounds;
        juce::String title;
        juce::Colour colour;
    };

    juce::Rectangle<int> panel (int x, int y, int w, int h, const juce::String& title, juce::Colour colour);
    ParamControl& knob (const juce::String& id, const juce::String& label, juce::Colour c, juce::Rectangle<int> r);
    ParamControl& fader (const juce::String& id, const juce::String& label, juce::Colour c, juce::Rectangle<int> r);
    ChoiceSelector& selector (const juce::String& id, const juce::String& label, juce::Colour c,
                              juce::Rectangle<int> r, ChoiceSelector::Display d = ChoiceSelector::Display::text);
    ToggleLed& toggle (const juce::String& id, const juce::String& label, juce::Colour c, juce::Rectangle<int> r);

    void paintBackground (juce::Graphics&);
    void paintLogo (juce::Graphics&);
    void paintPanel (juce::Graphics&, const Panel&);

    Midnight84AudioProcessor& processor;
    std::vector<Panel> panels;
    std::vector<std::unique_ptr<juce::Component>> controls;
    PresetBar presetBar;
    Oscilloscope scope;
};
} // namespace m84

class Midnight84AudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit Midnight84AudioProcessorEditor (Midnight84AudioProcessor&);
    ~Midnight84AudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    m84::SynthwaveLookAndFeel lookAndFeel;
    m84::MainContent content;
    juce::TooltipWindow tooltips { this, 700 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Midnight84AudioProcessorEditor)
};
