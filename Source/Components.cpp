#include "Components.h"
#include "PluginProcessor.h"
#include "Presets.h"

namespace m84
{
//==============================================================================
juce::Path makeWavePath (int wave, bool lfoShapes, juce::Rectangle<float> r, int cycles)
{
    // Map oscillator waves onto the LFO shape list (sine, tri, saw down, saw up, square, S&H).
    if (! lfoShapes)
    {
        static const int oscToShape[] = { 0, 1, 3, 4 };
        wave = oscToShape[std::clamp (wave, 0, 3)];
    }

    static const float sh[] = { 0.55f, -0.35f, 0.9f, -0.75f, 0.15f, -0.5f, 0.4f, -0.1f };

    auto shape = [wave] (float t) // t in cycles
    {
        const float ph = t - std::floor (t);
        switch (wave)
        {
            case 0:  return std::sin (kTwoPi * ph);
            case 1:  return 1.0f - 4.0f * std::abs (ph - 0.5f);
            case 2:  return 1.0f - 2.0f * ph;
            case 3:  return 2.0f * ph - 1.0f;
            case 4:  return ph < 0.5f ? 1.0f : -1.0f;
            default: return sh[(int) (t * 4.0f) % 8];
        }
    };

    juce::Path p;
    const int points = 240;
    for (int i = 0; i <= points; ++i)
    {
        const float t = (float) i / (float) points;
        // Start slightly into the cycle so discontinuities are drawn as vertical edges.
        const float v = shape (t * (float) cycles + 0.001f);
        const float x = r.getX() + t * r.getWidth();
        const float y = r.getCentreY() - v * r.getHeight() * 0.5f;
        if (i == 0) p.startNewSubPath (x, y);
        else        p.lineTo (x, y);
    }
    return p;
}

//==============================================================================
ParamControl::ParamControl (APVTS& state, const juce::String& paramId, const juce::String& labelText, juce::Colour c, Style style)
    : label (labelText), colour (c)
{
    if (style == Style::knob)
    {
        slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
        slider.setRotaryParameters (juce::MathConstants<float>::pi * 1.25f, juce::MathConstants<float>::pi * 2.75f, true);
    }
    else
    {
        slider.setSliderStyle (juce::Slider::LinearVertical);
    }

    slider.setTextBoxStyle (juce::Slider::NoTextBox, false, 0, 0);
    slider.setColour (juce::Slider::rotarySliderFillColourId, colour);
    slider.setColour (juce::Slider::trackColourId, colour);
    attachment = std::make_unique<APVTS::SliderAttachment> (state, paramId, slider);

    if (auto* p = state.getParameter (paramId))
    {
        slider.setDoubleClickReturnValue (true, p->convertFrom0to1 (p->getDefaultValue()));
        slider.setTooltip (p->getName (64) + "  (double-click to reset)");
    }

    slider.onValueChange = [this] { repaint(); };
    slider.addMouseListener (this, false);
    addAndMakeVisible (slider);
}

void ParamControl::resized()
{
    auto r = getLocalBounds();
    r.removeFromBottom (16);
    slider.setBounds (r);
}

void ParamControl::paint (juce::Graphics& g)
{
    const bool active = slider.isMouseOverOrDragging();
    const auto text = active ? slider.getTextFromValue (slider.getValue()) : label;
    g.setFont (synthFont (11.0f).withExtraKerningFactor (0.08f));
    g.setColour (active ? colour.brighter (0.4f) : Palette::textDim);
    g.drawFittedText (text.toUpperCase(), getLocalBounds().removeFromBottom (16), juce::Justification::centred, 1);
}

//==============================================================================
ChoiceSelector::ChoiceSelector (APVTS& state, const juce::String& paramId, const juce::String& labelText,
                                juce::Colour c, Display d)
    : param (*dynamic_cast<juce::AudioParameterChoice*> (state.getParameter (paramId))),
      attachment (param, [this] (float v) { index = juce::roundToInt (v); repaint(); }, nullptr),
      label (labelText), colour (c), display (d)
{
    attachment.sendInitialUpdate();
    setTooltip (param.getName (64));
    setRepaintsOnMouseActivity (true);
}

juce::Rectangle<float> ChoiceSelector::boxBounds() const
{
    auto r = getLocalBounds().toFloat();
    if (label.isNotEmpty())
        r.removeFromTop (15.0f);
    return r.reduced (1.0f);
}

void ChoiceSelector::paint (juce::Graphics& g)
{
    if (label.isNotEmpty())
    {
        g.setFont (synthFont (10.5f).withExtraKerningFactor (0.08f));
        g.setColour (Palette::textDim);
        g.drawText (label.toUpperCase(), getLocalBounds().removeFromTop (14), juce::Justification::centredLeft);
    }

    auto box = boxBounds();
    g.setColour (juce::Colour (0xff07030d));
    g.fillRoundedRectangle (box, 4.0f);
    g.setColour (colour.withAlpha (isMouseOver() ? 0.85f : 0.4f));
    g.drawRoundedRectangle (box, 4.0f, 1.0f);

    // Arrows.
    auto drawArrow = [&] (juce::Rectangle<float> a, bool left)
    {
        juce::Path t;
        const auto c = a.getCentre();
        if (left) t.addTriangle (c.x + 3.0f, c.y - 4.5f, c.x + 3.0f, c.y + 4.5f, c.x - 3.0f, c.y);
        else      t.addTriangle (c.x - 3.0f, c.y - 4.5f, c.x - 3.0f, c.y + 4.5f, c.x + 3.0f, c.y);
        g.setColour (colour.withAlpha (0.75f));
        g.fillPath (t);
    };
    auto inner = box;
    drawArrow (inner.removeFromLeft (16.0f), true);
    drawArrow (inner.removeFromRight (16.0f), false);

    if (display == Display::text)
    {
        g.setColour (Palette::text);
        g.setFont (synthFont (12.5f).withExtraKerningFactor (0.05f));
        g.drawFittedText (param.choices[index].toUpperCase(), inner.toNearestInt(), juce::Justification::centred, 1);
        return;
    }

    const auto waveArea = inner.reduced (4.0f, inner.getHeight() * 0.2f);
    const auto path = makeWavePath (index, display == Display::lfoWave, waveArea, 2);

    juce::Path fill (path);
    fill.lineTo (waveArea.getRight(), waveArea.getCentreY());
    fill.lineTo (waveArea.getX(), waveArea.getCentreY());
    fill.closeSubPath();
    g.setGradientFill (juce::ColourGradient (colour.withAlpha (0.28f), 0.0f, waveArea.getY(),
                                             colour.withAlpha (0.0f), 0.0f, waveArea.getCentreY() + 4.0f, false));
    g.fillPath (fill);
    strokeNeon (g, path, colour, 1.6f);

    g.setColour (Palette::textDim);
    g.setFont (synthFont (9.5f).withExtraKerningFactor (0.08f));
    g.drawText (param.choices[index].toUpperCase(), box.reduced (18.0f, 2.0f).toNearestInt(), juce::Justification::bottomRight);
}

void ChoiceSelector::mouseDown (const juce::MouseEvent& e)
{
    const auto box = boxBounds();
    if (! box.contains (e.position))
        return;

    if (e.position.x < box.getX() + 18.0f) { step (-1); return; }
    if (e.position.x > box.getRight() - 18.0f) { step (1); return; }

    juce::PopupMenu menu;
    for (int i = 0; i < param.choices.size(); ++i)
        menu.addItem (i + 1, param.choices[i], true, i == index);

    menu.showMenuAsync (juce::PopupMenu::Options().withTargetComponent (this),
                        [safe = juce::Component::SafePointer<ChoiceSelector> (this)] (int result)
                        {
                            if (safe != nullptr && result > 0)
                                safe->select (result - 1);
                        });
}

void ChoiceSelector::mouseWheelMove (const juce::MouseEvent&, const juce::MouseWheelDetails& wheel)
{
    if (wheel.deltaY > 0.0f)      step (-1);
    else if (wheel.deltaY < 0.0f) step (1);
}

void ChoiceSelector::step (int delta)
{
    const int n = param.choices.size();
    select (((index + delta) % n + n) % n);
}

void ChoiceSelector::select (int newIndex)
{
    attachment.setValueAsCompleteGesture ((float) newIndex);
}

//==============================================================================
ToggleLed::ToggleLed (APVTS& state, const juce::String& paramId, const juce::String& labelText, juce::Colour c)
    : param (*state.getParameter (paramId)),
      attachment (param, [this] (float v) { on = v > 0.5f; repaint(); }, nullptr),
      label (labelText), colour (c)
{
    attachment.sendInitialUpdate();
    setTooltip (param.getName (64));
    setRepaintsOnMouseActivity (true);
}

void ToggleLed::paint (juce::Graphics& g)
{
    auto r = getLocalBounds().toFloat().reduced (1.0f);
    g.setColour (juce::Colour (0xff07030d));
    g.fillRoundedRectangle (r, 4.0f);
    g.setColour (colour.withAlpha (on ? 0.9f : (isMouseOver() ? 0.6f : 0.3f)));
    g.drawRoundedRectangle (r, 4.0f, 1.0f);

    auto led = r.removeFromLeft (r.getHeight()).reduced (r.getHeight() * 0.3f);
    if (on)
    {
        g.setColour (colour.withAlpha (0.3f));
        g.fillEllipse (led.expanded (3.0f));
    }
    g.setColour (on ? colour : Palette::track);
    g.fillEllipse (led);

    g.setColour (on ? Palette::text : Palette::textDim);
    g.setFont (synthFont (11.0f).withExtraKerningFactor (0.08f));
    g.drawText (label.toUpperCase(), r.toNearestInt(), juce::Justification::centredLeft);
}

void ToggleLed::mouseDown (const juce::MouseEvent&)
{
    attachment.setValueAsCompleteGesture (on ? 0.0f : 1.0f);
}

//==============================================================================
Oscilloscope::Oscilloscope (const ScopeBuffer& buffer) : scope (buffer)
{
    samples.resize (2048);
    startTimerHz (30);
}

void Oscilloscope::paint (juce::Graphics& g)
{
    auto r = getLocalBounds().toFloat().reduced (0.5f);
    g.setColour (juce::Colour (0xff06020c));
    g.fillRoundedRectangle (r, 5.0f);

    g.setColour (Palette::purple.withAlpha (0.12f));
    for (int i = 1; i < 8; ++i)
        g.drawVerticalLine ((int) (r.getX() + r.getWidth() * (float) i / 8.0f), r.getY() + 2.0f, r.getBottom() - 2.0f);
    for (int i = 1; i < 4; ++i)
        g.drawHorizontalLine ((int) (r.getY() + r.getHeight() * (float) i / 4.0f), r.getX() + 2.0f, r.getRight() - 2.0f);

    scope.copyLatest (samples.data(), (int) samples.size());

    // Trigger on a rising zero crossing for a stable picture.
    const int window = 1024;
    int start = 0;
    for (int i = 1; i < (int) samples.size() - window; ++i)
        if (samples[(size_t) i - 1] <= 0.0f && samples[(size_t) i] > 0.0f) { start = i; break; }

    juce::Path p;
    const auto area = r.reduced (4.0f, 6.0f);
    for (int i = 0; i < window; i += 2)
    {
        const float v = std::clamp (samples[(size_t) (start + i)] * 1.6f, -1.0f, 1.0f);
        const float x = area.getX() + area.getWidth() * (float) i / (float) window;
        const float y = area.getCentreY() - v * area.getHeight() * 0.5f;
        if (i == 0) p.startNewSubPath (x, y);
        else        p.lineTo (x, y);
    }

    g.saveState();
    g.reduceClipRegion (r.toNearestInt());
    strokeNeon (g, p, Palette::cyan, 1.4f);
    g.restoreState();

    g.setColour (Palette::magenta.withAlpha (0.5f));
    g.drawRoundedRectangle (r, 5.0f, 1.0f);
}

//==============================================================================
namespace
{
    juce::File presetDirectory()
    {
        auto dir = juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
                       .getChildFile ("Midnight 84").getChildFile ("Presets");
        dir.createDirectory();
        return dir;
    }
}

PresetBar::PresetBar (Midnight84AudioProcessor& p) : processor (p)
{
    addAndMakeVisible (saveButton);
    addAndMakeVisible (loadButton);
    saveButton.setTooltip ("Save the current sound as a .m84 preset file");
    loadButton.setTooltip ("Load a .m84 preset file");

    saveButton.onClick = [this]
    {
        chooser = std::make_unique<juce::FileChooser> ("Save preset",
                                                       presetDirectory().getChildFile (processor.getPresetName() + ".m84"),
                                                       "*.m84");
        chooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles
                                  | juce::FileBrowserComponent::warnAboutOverwriting,
                              [this] (const juce::FileChooser& fc)
                              {
                                  const auto file = fc.getResult();
                                  if (file != juce::File())
                                      processor.saveUserPreset (file.withFileExtension ("m84"));
                              });
    };

    loadButton.onClick = [this]
    {
        chooser = std::make_unique<juce::FileChooser> ("Load preset", presetDirectory(), "*.m84");
        chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
                              [this] (const juce::FileChooser& fc)
                              {
                                  const auto file = fc.getResult();
                                  if (file.existsAsFile())
                                      processor.loadUserPreset (file);
                              });
    };

    startTimerHz (5);
    timerCallback();
}

void PresetBar::timerCallback()
{
    const auto name = processor.getPresetName();
    if (name != shownName)
    {
        shownName = name;
        repaint();
    }
}

juce::Rectangle<float> PresetBar::nameBounds() const
{
    return getLocalBounds().withTrimmedRight (124).toFloat().reduced (1.0f);
}

void PresetBar::resized()
{
    auto r = getLocalBounds().removeFromRight (118);
    loadButton.setBounds (r.removeFromRight (56));
    r.removeFromRight (6);
    saveButton.setBounds (r);
}

void PresetBar::paint (juce::Graphics& g)
{
    auto box = nameBounds();
    g.setColour (juce::Colour (0xff07030d));
    g.fillRoundedRectangle (box, 5.0f);
    g.setColour (Palette::magenta.withAlpha (isMouseOver (true) ? 0.9f : 0.55f));
    g.drawRoundedRectangle (box, 5.0f, 1.0f);

    auto inner = box;
    for (bool left : { true, false })
    {
        auto a = left ? inner.removeFromLeft (24.0f) : inner.removeFromRight (24.0f);
        juce::Path t;
        const auto c = a.getCentre();
        if (left) t.addTriangle (c.x + 4.0f, c.y - 6.0f, c.x + 4.0f, c.y + 6.0f, c.x - 4.0f, c.y);
        else      t.addTriangle (c.x - 4.0f, c.y - 6.0f, c.x - 4.0f, c.y + 6.0f, c.x + 4.0f, c.y);
        g.setColour (Palette::magenta);
        g.fillPath (t);
    }

    g.setColour (Palette::text);
    g.setFont (synthFont (15.0f).withExtraKerningFactor (0.1f));
    g.drawFittedText (shownName.toUpperCase(), inner.toNearestInt(), juce::Justification::centred, 1);
}

void PresetBar::mouseDown (const juce::MouseEvent& e)
{
    const auto box = nameBounds();
    if (! box.contains (e.position))
        return;

    if (e.position.x < box.getX() + 26.0f) { step (-1); return; }
    if (e.position.x > box.getRight() - 26.0f) { step (1); return; }

    juce::PopupMenu menu;
    menu.addSectionHeader ("FACTORY PRESETS");
    const auto& presets = factoryPresets();
    for (int i = 0; i < (int) presets.size(); ++i)
        menu.addItem (i + 1, presets[(size_t) i].name, true, presets[(size_t) i].name == shownName);

    menu.showMenuAsync (juce::PopupMenu::Options().withTargetComponent (this).withMinimumWidth ((int) box.getWidth()),
                        [safe = juce::Component::SafePointer<PresetBar> (this)] (int result)
                        {
                            if (safe != nullptr && result > 0)
                                safe->step (result - 1 - safe->processor.getCurrentProgram());
                        });
}

void PresetBar::step (int delta)
{
    const int n = processor.getNumPrograms();
    const int next = ((processor.getCurrentProgram() + delta) % n + n) % n;
    processor.setCurrentProgram (next);
    processor.updateHostDisplay (juce::AudioProcessor::ChangeDetails().withProgramChanged (true));
    timerCallback();
}
} // namespace m84
