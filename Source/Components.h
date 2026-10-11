#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "LookAndFeel.h"

class Midnight84AudioProcessor;
struct ScopeBuffer;

namespace m84
{
using APVTS = juce::AudioProcessorValueTreeState;

// Knob or vertical fader bound to a parameter. Shows its name, or its value while hovered/dragged.
class ParamControl : public juce::Component
{
public:
    enum class Style { knob, fader };

    ParamControl (APVTS& state, const juce::String& paramId, const juce::String& label, juce::Colour colour, Style style = Style::knob);

    void paint (juce::Graphics&) override;
    void resized() override;
    void mouseEnter (const juce::MouseEvent&) override { repaint(); }
    void mouseExit (const juce::MouseEvent&) override  { repaint(); }

private:
    juce::Slider slider;
    std::unique_ptr<APVTS::SliderAttachment> attachment;
    juce::String label;
    juce::Colour colour;
};

// Stepped selector for a choice parameter: < value >, click the middle for a menu.
// Oscillator / LFO wave selectors draw the waveform instead of its name.
class ChoiceSelector : public juce::Component, public juce::SettableTooltipClient
{
public:
    enum class Display { text, oscWave, lfoWave };

    ChoiceSelector (APVTS& state, const juce::String& paramId, const juce::String& label, juce::Colour colour,
                    Display display = Display::text);

    void paint (juce::Graphics&) override;
    void mouseDown (const juce::MouseEvent&) override;
    void mouseWheelMove (const juce::MouseEvent&, const juce::MouseWheelDetails&) override;

private:
    void step (int delta);
    void select (int index);
    juce::Rectangle<float> boxBounds() const;

    juce::AudioParameterChoice& param;
    juce::ParameterAttachment attachment;
    juce::String label;
    juce::Colour colour;
    Display display;
    int index = 0;
};

class ToggleLed : public juce::Component, public juce::SettableTooltipClient
{
public:
    ToggleLed (APVTS& state, const juce::String& paramId, const juce::String& label, juce::Colour colour);
    void paint (juce::Graphics&) override;
    void mouseDown (const juce::MouseEvent&) override;

private:
    juce::RangedAudioParameter& param;
    juce::ParameterAttachment attachment;
    juce::String label;
    juce::Colour colour;
    bool on = false;
};

class Oscilloscope : public juce::Component, private juce::Timer
{
public:
    explicit Oscilloscope (const ScopeBuffer& buffer);
    void paint (juce::Graphics&) override;

private:
    void timerCallback() override { repaint(); }
    const ScopeBuffer& scope;
    std::vector<float> samples;
};

class PresetBar : public juce::Component, private juce::Timer
{
public:
    explicit PresetBar (Midnight84AudioProcessor& p);
    void paint (juce::Graphics&) override;
    void resized() override;
    void mouseDown (const juce::MouseEvent&) override;

private:
    void timerCallback() override;
    void step (int delta);
    juce::Rectangle<float> nameBounds() const;

    Midnight84AudioProcessor& processor;
    juce::TextButton saveButton { "SAVE" }, loadButton { "LOAD" };
    std::unique_ptr<juce::FileChooser> chooser;
    juce::String shownName;
};

// Builds a path of one waveform over r. lfoShapes selects the LFO wave list.
juce::Path makeWavePath (int wave, bool lfoShapes, juce::Rectangle<float> r, int cycles);
} // namespace m84
