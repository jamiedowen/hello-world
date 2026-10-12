#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>
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

namespace m84
{
// Touch keyboard drawn in the synthwave style: dark keys with neon edges, glowing when held.
class NeonKeyboard : public juce::MidiKeyboardComponent
{
public:
    using MidiKeyboardComponent::MidiKeyboardComponent;

    void drawWhiteNote (int note, juce::Graphics&, juce::Rectangle<float> area, bool isDown, bool isOver,
                        juce::Colour lineColour, juce::Colour textColour) override;
    void drawBlackNote (int note, juce::Graphics&, juce::Rectangle<float> area, bool isDown, bool isOver,
                        juce::Colour noteFillColour) override;
};
} // namespace m84

// Phones and tablets get a touch layout (tab pages + on-screen keyboard); desktop / plugin
// hosts get the full panel. Override with -DM84_MOBILE_UI=0/1.
#ifndef M84_MOBILE_UI
 #if JUCE_ANDROID || JUCE_IOS
  #define M84_MOBILE_UI 1
 #else
  #define M84_MOBILE_UI 0
 #endif
#endif

class Midnight84AudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit Midnight84AudioProcessorEditor (Midnight84AudioProcessor&, bool mobileLayout = M84_MOBILE_UI);
    ~Midnight84AudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;
    void showPage (int index); // mobile layout: select a tab page

private:
    void resizedMobile();
    void shiftOctave (int delta);

    Midnight84AudioProcessor& processor;
    const bool mobile;
    m84::SynthwaveLookAndFeel lookAndFeel;
    m84::MainContent content; // the whole panel on desktop; the current page on mobile
    juce::TooltipWindow tooltips { this, 700 };

    // Mobile only ------------------------------------------------------------------------
    // Each view is a full MainContent, shifted and scaled inside a clipping holder.
    std::unique_ptr<m84::MainContent> headerContent;
    juce::Component headerHolder, pageHolder;
    juce::OwnedArray<juce::TextButton> tabs;
    std::unique_ptr<m84::NeonKeyboard> keyboard;
    juce::TextButton octDown { "< OCT" }, octUp { "OCT >" };
    juce::Rectangle<int> pageSpace;
    int currentPage = 0;
    int lowestKey = 48; // C3 at the left edge

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Midnight84AudioProcessorEditor)
};
