#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

namespace m84
{
namespace Palette
{
    const juce::Colour bgTop    { 0xff05010d };
    const juce::Colour bgMid    { 0xff12041f };
    const juce::Colour bgBottom { 0xff2a0a3a };
    const juce::Colour panel    { 0xd80d0518 };
    const juce::Colour knobBody { 0xff1c1030 };
    const juce::Colour track    { 0xff2a1a40 };
    const juce::Colour text     { 0xfff3e6ff };
    const juce::Colour textDim  { 0xff9a86b8 };

    const juce::Colour cyan     { 0xff00f0ff };
    const juce::Colour magenta  { 0xffff2a6d };
    const juce::Colour pink     { 0xffff4fd8 };
    const juce::Colour purple   { 0xffb967ff };
    const juce::Colour orange   { 0xffff9e3d };
    const juce::Colour yellow   { 0xffffd319 };
    const juce::Colour blue     { 0xff4d7cff };
    const juce::Colour red      { 0xffff3b3b };
}

juce::Font synthFont (float height, bool bold = true, bool italic = false);

// Strokes a path several times with growing width and falling alpha for a neon glow.
void strokeNeon (juce::Graphics& g, const juce::Path& path, juce::Colour colour, float width);

class SynthwaveLookAndFeel : public juce::LookAndFeel_V4
{
public:
    SynthwaveLookAndFeel();

    void drawRotarySlider (juce::Graphics&, int x, int y, int width, int height, float sliderPos,
                           float startAngle, float endAngle, juce::Slider&) override;

    void drawLinearSlider (juce::Graphics&, int x, int y, int width, int height, float sliderPos,
                           float minSliderPos, float maxSliderPos, juce::Slider::SliderStyle, juce::Slider&) override;

    void drawButtonBackground (juce::Graphics&, juce::Button&, const juce::Colour&, bool highlighted, bool down) override;
    juce::Font getTextButtonFont (juce::TextButton&, int buttonHeight) override;

    void drawPopupMenuBackground (juce::Graphics&, int width, int height) override;
    juce::Font getPopupMenuFont() override;
};
} // namespace m84
