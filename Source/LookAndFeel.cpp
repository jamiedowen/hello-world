#include "LookAndFeel.h"

namespace m84
{
juce::Font synthFont (float height, bool bold, bool italic)
{
    int style = juce::Font::plain;
    if (bold) style |= juce::Font::bold;
    if (italic) style |= juce::Font::italic;
    return juce::Font (juce::FontOptions (height, style));
}

void strokeNeon (juce::Graphics& g, const juce::Path& path, juce::Colour colour, float width)
{
    const juce::PathStrokeType::JointStyle joint = juce::PathStrokeType::curved;
    g.setColour (colour.withAlpha (0.10f));
    g.strokePath (path, juce::PathStrokeType (width * 4.0f, joint, juce::PathStrokeType::rounded));
    g.setColour (colour.withAlpha (0.22f));
    g.strokePath (path, juce::PathStrokeType (width * 2.2f, joint, juce::PathStrokeType::rounded));
    g.setColour (colour);
    g.strokePath (path, juce::PathStrokeType (width, joint, juce::PathStrokeType::rounded));
    g.setColour (juce::Colours::white.withAlpha (0.45f));
    g.strokePath (path, juce::PathStrokeType (width * 0.35f, joint, juce::PathStrokeType::rounded));
}

SynthwaveLookAndFeel::SynthwaveLookAndFeel()
{
    setColour (juce::PopupMenu::backgroundColourId, juce::Colour (0xf0100720));
    setColour (juce::PopupMenu::textColourId, Palette::text);
    setColour (juce::PopupMenu::highlightedBackgroundColourId, Palette::magenta.withAlpha (0.35f));
    setColour (juce::PopupMenu::highlightedTextColourId, juce::Colours::white);
    setColour (juce::PopupMenu::headerTextColourId, Palette::cyan);
    setColour (juce::TextButton::textColourOffId, Palette::text);
    setColour (juce::TextButton::textColourOnId, Palette::cyan);
    setColour (juce::TooltipWindow::backgroundColourId, juce::Colour (0xf0100720));
    setColour (juce::TooltipWindow::textColourId, Palette::text);
    setColour (juce::TooltipWindow::outlineColourId, Palette::magenta);
    setColour (juce::AlertWindow::backgroundColourId, juce::Colour (0xff100720));
    setColour (juce::AlertWindow::textColourId, Palette::text);
}

void SynthwaveLookAndFeel::drawRotarySlider (juce::Graphics& g, int x, int y, int width, int height, float sliderPos,
                                             float startAngle, float endAngle, juce::Slider& slider)
{
    const auto colour = slider.findColour (juce::Slider::rotarySliderFillColourId);
    const auto bounds = juce::Rectangle<int> (x, y, width, height).toFloat();
    const float size = std::min (bounds.getWidth(), bounds.getHeight());
    const auto centre = bounds.getCentre();
    const float radius = size * 0.5f - 5.0f;
    const float angle = startAngle + sliderPos * (endAngle - startAngle);

    // Bipolar parameters draw their arc from the centre.
    const bool bipolar = slider.getMinimum() < 0.0 && slider.getMaximum() > 0.0;
    const float zeroAngle = bipolar ? startAngle + (float) slider.valueToProportionOfLength (0.0) * (endAngle - startAngle)
                                    : startAngle;

    juce::Path track;
    track.addCentredArc (centre.x, centre.y, radius, radius, 0.0f, startAngle, endAngle, true);
    g.setColour (Palette::track);
    g.strokePath (track, juce::PathStrokeType (3.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    if (std::abs (angle - zeroAngle) > 0.01f)
    {
        juce::Path arc;
        arc.addCentredArc (centre.x, centre.y, radius, radius, 0.0f, std::min (zeroAngle, angle), std::max (zeroAngle, angle), true);
        strokeNeon (g, arc, colour, 2.6f);
    }

    // Body: dark disc with a subtle top highlight.
    const float bodyR = radius * 0.72f;
    juce::ColourGradient body (Palette::knobBody.brighter (0.35f), centre.x, centre.y - bodyR,
                               juce::Colour (0xff0a0512), centre.x, centre.y + bodyR, false);
    g.setGradientFill (body);
    g.fillEllipse (centre.x - bodyR, centre.y - bodyR, bodyR * 2.0f, bodyR * 2.0f);
    g.setColour (colour.withAlpha (slider.isMouseOverOrDragging() ? 0.7f : 0.3f));
    g.drawEllipse (centre.x - bodyR, centre.y - bodyR, bodyR * 2.0f, bodyR * 2.0f, 1.0f);

    juce::Path pointer;
    const auto inner = centre.getPointOnCircumference (bodyR * 0.3f, angle);
    const auto outer = centre.getPointOnCircumference (bodyR * 0.88f, angle);
    pointer.startNewSubPath (inner);
    pointer.lineTo (outer);
    strokeNeon (g, pointer, colour.brighter (0.3f), 2.0f);
}

void SynthwaveLookAndFeel::drawLinearSlider (juce::Graphics& g, int x, int y, int width, int height, float sliderPos,
                                             float, float, juce::Slider::SliderStyle style, juce::Slider& slider)
{
    if (style != juce::Slider::LinearVertical)
    {
        LookAndFeel_V4::drawLinearSlider (g, x, y, width, height, sliderPos, 0, 0, style, slider);
        return;
    }

    const auto colour = slider.findColour (juce::Slider::trackColourId);
    const auto bounds = juce::Rectangle<int> (x, y, width, height).toFloat();
    const float cx = bounds.getCentreX();

    // Tick marks either side of the groove, like a hardware fader panel.
    g.setColour (Palette::textDim.withAlpha (0.25f));
    for (int i = 0; i <= 10; ++i)
    {
        const float ty = bounds.getY() + bounds.getHeight() * (float) i / 10.0f;
        const float len = (i % 5 == 0) ? 7.0f : 4.0f;
        g.drawHorizontalLine ((int) ty, cx - 9.0f - len, cx - 9.0f);
        g.drawHorizontalLine ((int) ty, cx + 9.0f, cx + 9.0f + len);
    }

    auto groove = juce::Rectangle<float> (cx - 2.5f, bounds.getY(), 5.0f, bounds.getHeight());
    g.setColour (juce::Colour (0xff05020a));
    g.fillRoundedRectangle (groove, 2.5f);

    juce::Path fill;
    fill.startNewSubPath (cx, bounds.getBottom());
    fill.lineTo (cx, sliderPos);
    strokeNeon (g, fill, colour, 2.5f);

    // Fader cap.
    auto cap = juce::Rectangle<float> (cx - 12.0f, sliderPos - 7.0f, 24.0f, 14.0f);
    juce::ColourGradient capGrad (juce::Colour (0xff3a2a52), cap.getX(), cap.getY(),
                                  juce::Colour (0xff120a1e), cap.getX(), cap.getBottom(), false);
    g.setGradientFill (capGrad);
    g.fillRoundedRectangle (cap, 2.5f);
    g.setColour (colour.withAlpha (slider.isMouseOverOrDragging() ? 0.9f : 0.5f));
    g.drawRoundedRectangle (cap, 2.5f, 1.0f);
    g.setColour (colour);
    g.fillRect (cap.getX() + 3.0f, cap.getCentreY() - 1.0f, cap.getWidth() - 6.0f, 2.0f);
}

void SynthwaveLookAndFeel::drawButtonBackground (juce::Graphics& g, juce::Button& b, const juce::Colour&,
                                                 bool highlighted, bool down)
{
    auto r = b.getLocalBounds().toFloat().reduced (0.5f);
    const bool on = b.getToggleState();
    g.setColour (on ? Palette::magenta.withAlpha (0.35f)
                    : juce::Colour (0xff120822).brighter (down ? 0.2f : (highlighted ? 0.1f : 0.0f)));
    g.fillRoundedRectangle (r, 4.0f);
    g.setColour ((on ? Palette::magenta : Palette::cyan).withAlpha (on || highlighted ? 0.95f : 0.45f));
    g.drawRoundedRectangle (r, 4.0f, on ? 1.5f : 1.0f);
}

juce::Font SynthwaveLookAndFeel::getTextButtonFont (juce::TextButton&, int buttonHeight)
{
    return synthFont (std::min (13.0f, (float) buttonHeight * 0.55f)).withExtraKerningFactor (0.1f);
}

void SynthwaveLookAndFeel::drawPopupMenuBackground (juce::Graphics& g, int width, int height)
{
    g.fillAll (findColour (juce::PopupMenu::backgroundColourId));
    g.setColour (Palette::magenta.withAlpha (0.6f));
    g.drawRect (0, 0, width, height, 1);
}

juce::Font SynthwaveLookAndFeel::getPopupMenuFont()
{
    return synthFont (14.0f, false);
}
} // namespace m84
