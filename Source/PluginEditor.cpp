#include "PluginEditor.h"

namespace m84
{
namespace
{
    // Section colours.
    const auto cOscA   = Palette::cyan;
    const auto cOscB   = Palette::pink;
    const auto cOscC   = Palette::purple;
    const auto cSub    = Palette::blue;
    const auto cFilter = Palette::magenta;
    const auto cFEnv   = Palette::orange;
    const auto cAEnv   = Palette::yellow;
    const auto cLfo    = Palette::cyan;
    const auto cVoice  = Palette::purple;
    const auto cDrive  = Palette::red;
    const auto cChorus = Palette::cyan;
    const auto cDelay  = Palette::pink;
    const auto cReverb = Palette::blue;
    const auto cPump   = Palette::magenta;
    const auto cArp    = Palette::orange;
    const auto cMod    = Palette::pink;
    const auto cSquash = Palette::red;

    constexpr int horizonY = 780;
}

MainContent::MainContent (Midnight84AudioProcessor& p)
    : processor (p), presetBar (p), scope (p.scope)
{
    setSize (baseWidth, baseHeight);
    // Header ---------------------------------------------------------------
    addAndMakeVisible (presetBar);
    presetBar.setBounds (480, 33, 380, 34);
    toggle (ID::hq, "HQ 4x", Palette::cyan, { 480, 73, 84, 20 });
    addAndMakeVisible (scope);
    scope.setBounds (878, 14, 206, 72);
    knob (ID::master, "Master", Palette::pink, { 1098, 12, 84, 82 });

    // Row 1: oscillators -----------------------------------------------------
    const juce::Colour oscColours[] = { cOscA, cOscB, cOscC };
    const char* oscTitles[] = { "OSC A", "OSC B", "OSC C" };
    for (int i = 0; i < kNumOscs; ++i)
    {
        const auto c = oscColours[i];
        const auto r = panel (12 + i * 300, 110, 292, 190, oscTitles[i], c);
        const int x = r.getX(), y = r.getY();

        if (i == 1)
        {
            // Osc B can be hard-synced to, and frequency-modulated by, osc A.
            selector (ID::oscId (i, "Wave"), {}, c, { x + 10, y + 30, 102, 44 }, ChoiceSelector::Display::oscWave);
            toggle (ID::oscSync, "Sync A", c, { x + 10, y + 78, 102, 20 });
            knob (ID::oscFM, "FM", c, { x + 114, y + 28, 52, 70 });
            knob (ID::oscId (i, "Level"), "Level", c, { x + 166, y + 28, 58, 70 });
            knob (ID::oscId (i, "PW"), "PW", c, { x + 226, y + 28, 58, 70 });
        }
        else
        {
            selector (ID::oscId (i, "Wave"), {}, c, { x + 10, y + 32, 146, 62 }, ChoiceSelector::Display::oscWave);
            knob (ID::oscId (i, "Level"), "Level", c, { x + 162, y + 28, 60, 70 });
            knob (ID::oscId (i, "PW"), "PW", c, { x + 224, y + 28, 60, 70 });
        }

        const char* ids[] = { "Oct", "Semi", "Fine", "Unison", "Detune" };
        const char* labels[] = { "Oct", "Semi", "Fine", "Unison", "Detune" };
        for (int k = 0; k < 5; ++k)
            knob (ID::oscId (i, ids[k]), labels[k], c, { x + 6 + k * 56, y + 106, 56, 74 });
    }

    {
        const auto r = panel (912, 110, 276, 190, "SUB / MIXER", cSub);
        const int x = r.getX(), y = r.getY();
        selector (ID::subWave, "Sub Wave", cSub, { x + 10, y + 30, 122, 44 });
        selector (ID::subOct, "Sub Octave", cSub, { x + 144, y + 30, 122, 44 });
        const char* ids[] = { ID::subLevel, ID::noise, ID::spread, ID::grit, ID::feedback };
        const char* labels[] = { "Sub", "Noise", "Spread", "Grit", "Feedbk" };
        for (int k = 0; k < 5; ++k)
            knob (ids[k], labels[k], k >= 3 ? Palette::red : cSub, { x + 5 + k * 53, y + 98, 54, 80 });
    }

    // Row 2: filter, envelopes, LFO ---------------------------------------------
    {
        const auto r = panel (12, 308, 400, 200, "LADDER FILTER", cFilter);
        const int x = r.getX(), y = r.getY();
        selector (ID::fltType, "Type", cFilter, { x + 10, y + 32, 110, 44 });
        knob (ID::cutoff, "Cutoff", cFilter, { x + 128, y + 26, 84, 92 });
        knob (ID::res, "Resonance", cFilter, { x + 214, y + 26, 84, 92 });
        knob (ID::fltDrive, "Drive", cFilter, { x + 300, y + 26, 84, 92 });

        const char* ids[] = { ID::fltEnv, ID::fltKey, ID::fltVel, ID::fltLfo, ID::hpf };
        const char* labels[] = { "Env Amt", "Key Trk", "Velocity", "LFO", "HPF" };
        for (int k = 0; k < 5; ++k)
            knob (ids[k], labels[k], cFilter, { x + 8 + k * 77, y + 120, 76, 74 });
    }

    {
        const auto r = panel (420, 308, 196, 200, "FILTER ENV", cFEnv);
        const char* ids[] = { ID::fA, ID::fD, ID::fS, ID::fR };
        const char* labels[] = { "A", "D", "S", "R" };
        for (int k = 0; k < 4; ++k)
            fader (ids[k], labels[k], cFEnv, { r.getX() + 10 + k * 45, r.getY() + 30, 42, 162 });
    }

    {
        const auto r = panel (624, 308, 250, 200, "AMP ENV", cAEnv);
        const char* ids[] = { ID::aA, ID::aD, ID::aS, ID::aR };
        const char* labels[] = { "A", "D", "S", "R" };
        for (int k = 0; k < 4; ++k)
            fader (ids[k], labels[k], cAEnv, { r.getX() + 10 + k * 45, r.getY() + 30, 42, 162 });
        knob (ID::ampVel, "Vel", cAEnv, { r.getX() + 190, r.getY() + 64, 54, 72 });
    }

    {
        const auto r = panel (882, 308, 306, 200, "LFO", cLfo);
        const int x = r.getX(), y = r.getY();
        selector (ID::lfoWave, {}, cLfo, { x + 10, y + 32, 132, 56 }, ChoiceSelector::Display::lfoWave);
        toggle (ID::lfoSync, "Sync", cLfo, { x + 152, y + 32, 70, 24 });
        toggle (ID::lfoRetrig, "Retrig", cLfo, { x + 228, y + 32, 70, 24 });
        selector (ID::lfoSyncRate, {}, cLfo, { x + 152, y + 62, 146, 26 });
        knob (ID::lfoRate, "Rate", cLfo, { x + 14, y + 106, 80, 86 });
        knob (ID::lfoPitch, "> Pitch", cLfo, { x + 112, y + 106, 80, 86 });
        knob (ID::lfoPW, "> PWM", cLfo, { x + 210, y + 106, 80, 86 });
    }

    // Row 3: voice + effects --------------------------------------------------
    {
        const auto r = panel (12, 516, 244, 180, "VOICE", cVoice);
        const int x = r.getX(), y = r.getY();
        selector (ID::voiceMode, "Mode", cVoice, { x + 10, y + 30, 224, 44 });
        const char* ids[] = { ID::polyphony, ID::glide, ID::bendRange, ID::analog };
        const char* labels[] = { "Voices", "Glide", "Bend", "Analog" };
        for (int k = 0; k < 4; ++k)
            knob (ids[k], labels[k], cVoice, { x + 4 + k * 59, y + 92, 60, 78 });
    }

    {
        const auto r = panel (264, 516, 210, 180, "DRIVE", cDrive);
        const int x = r.getX(), y = r.getY();
        selector (ID::drvType, "Type", cDrive, { x + 10, y + 30, 190, 44 });
        const char* ids[] = { ID::drvAmt, ID::drvTone, ID::drvMix };
        const char* labels[] = { "Amount", "Tone", "Mix" };
        for (int k = 0; k < 3; ++k)
            knob (ids[k], labels[k], cDrive, { x + 6 + k * 66, y + 92, 66, 78 });
    }

    {
        const auto r = panel (482, 516, 180, 180, "CHORUS", cChorus);
        const char* ids[] = { ID::chRate, ID::chDepth, ID::chMix };
        const char* labels[] = { "Rate", "Depth", "Mix" };
        for (int k = 0; k < 3; ++k)
            knob (ids[k], labels[k], cChorus, { r.getX() + 4 + k * 58, r.getY() + 52, 58, 96 });
    }

    {
        const auto r = panel (670, 516, 210, 180, "DELAY", cDelay);
        const int x = r.getX(), y = r.getY();
        selector (ID::dlyTime, "Time", cDelay, { x + 10, y + 30, 190, 44 });
        const char* ids[] = { ID::dlyFb, ID::dlyTone, ID::dlyMix };
        const char* labels[] = { "Feedback", "Tone", "Mix" };
        for (int k = 0; k < 3; ++k)
            knob (ids[k], labels[k], cDelay, { x + 6 + k * 66, y + 92, 66, 78 });
    }

    {
        const auto r = panel (888, 516, 180, 180, "REVERB", cReverb);
        const char* ids[] = { ID::revSize, ID::revDamp, ID::revMix };
        const char* labels[] = { "Size", "Damp", "Mix" };
        for (int k = 0; k < 3; ++k)
            knob (ids[k], labels[k], cReverb, { r.getX() + 4 + k * 58, r.getY() + 52, 58, 96 });
    }

    {
        const auto r = panel (1076, 516, 112, 180, "PUMP", cPump);
        selector (ID::pumpRate, "Rate", cPump, { r.getX() + 8, r.getY() + 30, 96, 44 });
        knob (ID::pumpAmt, "Amount", cPump, { r.getX() + 16, r.getY() + 88, 80, 84 });
    }

    // Row 4: arpeggiator, poly-mod / ring, squash -------------------------------------------
    {
        const auto r = panel (12, 704, 400, 150, "ARPEGGIATOR", cArp);
        const int x = r.getX(), y = r.getY();
        toggle (ID::arpOn, "Arp On", cArp, { x + 10, y + 44, 92, 26 });
        selector (ID::arpMode, "Mode", cArp, { x + 110, y + 28, 140, 44 });
        selector (ID::arpRate, "Rate", cArp, { x + 258, y + 28, 132, 44 });
        knob (ID::arpOct, "Octaves", cArp, { x + 140, y + 78, 72, 66 });
        knob (ID::arpGate, "Gate", cArp, { x + 288, y + 78, 72, 66 });
    }

    {
        const auto r = panel (420, 704, 360, 150, "POLY-MOD / RING", cMod);
        const char* ids[] = { ID::pmEnvB, ID::pmBCut, ID::ring };
        const char* labels[] = { "Env > B Pitch", "B > Cutoff", "Ring A*B" };
        for (int k = 0; k < 3; ++k)
            knob (ids[k], labels[k], cMod, { r.getX() + 14 + k * 114, r.getY() + 28, 104, 114 });
    }

    {
        const auto r = panel (788, 704, 400, 150, "SQUASH", cSquash);
        const char* ids[] = { ID::sqDepth, ID::sqTime, ID::sqUp, ID::sqDown };
        const char* labels[] = { "Depth", "Time", "Upward", "Downward" };
        for (int k = 0; k < 4; ++k)
            knob (ids[k], labels[k], cSquash, { r.getX() + 10 + k * 96, r.getY() + 28, 92, 114 });
    }
}

juce::Rectangle<int> MainContent::panel (int x, int y, int w, int h, const juce::String& title, juce::Colour colour)
{
    panels.push_back ({ { x, y, w, h }, title, colour });
    return { x, y, w, h };
}

ParamControl& MainContent::knob (const juce::String& id, const juce::String& label, juce::Colour c, juce::Rectangle<int> r)
{
    auto ctl = std::make_unique<ParamControl> (processor.apvts, id, label, c, ParamControl::Style::knob);
    ctl->setBounds (r);
    addAndMakeVisible (*ctl);
    auto& ref = *ctl;
    controls.push_back (std::move (ctl));
    return ref;
}

ParamControl& MainContent::fader (const juce::String& id, const juce::String& label, juce::Colour c, juce::Rectangle<int> r)
{
    auto ctl = std::make_unique<ParamControl> (processor.apvts, id, label, c, ParamControl::Style::fader);
    ctl->setBounds (r);
    addAndMakeVisible (*ctl);
    auto& ref = *ctl;
    controls.push_back (std::move (ctl));
    return ref;
}

ChoiceSelector& MainContent::selector (const juce::String& id, const juce::String& label, juce::Colour c,
                                       juce::Rectangle<int> r, ChoiceSelector::Display d)
{
    auto ctl = std::make_unique<ChoiceSelector> (processor.apvts, id, label, c, d);
    ctl->setBounds (r);
    addAndMakeVisible (*ctl);
    auto& ref = *ctl;
    controls.push_back (std::move (ctl));
    return ref;
}

ToggleLed& MainContent::toggle (const juce::String& id, const juce::String& label, juce::Colour c, juce::Rectangle<int> r)
{
    auto ctl = std::make_unique<ToggleLed> (processor.apvts, id, label, c);
    ctl->setBounds (r);
    addAndMakeVisible (*ctl);
    auto& ref = *ctl;
    controls.push_back (std::move (ctl));
    return ref;
}

//==============================================================================
void MainContent::paint (juce::Graphics& g)
{
    paintBackground (g);
    paintLogo (g);
    for (const auto& p : panels)
        paintPanel (g, p);
}

void MainContent::paintBackground (juce::Graphics& g)
{
    const auto w = (float) getWidth();
    const auto h = (float) getHeight();

    juce::ColourGradient sky (Palette::bgTop, 0.0f, 0.0f, Palette::bgBottom, 0.0f, h, false);
    sky.addColour (0.55, Palette::bgMid);
    g.setGradientFill (sky);
    g.fillAll();

    // Stars.
    juce::Random rng (84);
    for (int i = 0; i < 140; ++i)
    {
        const float x = rng.nextFloat() * w;
        const float y = rng.nextFloat() * h * 0.8f;
        const float s = rng.nextFloat() < 0.1f ? 2.0f : 1.0f;
        g.setColour (juce::Colours::white.withAlpha (0.15f + rng.nextFloat() * 0.45f));
        g.fillEllipse (x, y, s, s);
    }

    // Horizon glow and perspective grid along the bottom.
    const float hy = (float) horizonY;
    g.setGradientFill (juce::ColourGradient (Palette::magenta.withAlpha (0.35f), 0.0f, hy,
                                             Palette::magenta.withAlpha (0.0f), 0.0f, hy - 90.0f, false));
    g.fillRect (0.0f, hy - 90.0f, w, 90.0f);

    g.setColour (Palette::bgTop.withAlpha (0.65f));
    g.fillRect (0.0f, hy, w, h - hy);

    const float vx = w * 0.5f;
    for (int i = -24; i <= 24; ++i)
    {
        const float bx = vx + (float) i * 70.0f;
        g.setColour (Palette::magenta.withAlpha (0.35f));
        g.drawLine (vx + (float) i * 6.0f, hy, bx, h, 1.0f);
    }
    for (int i = 0; i < 9; ++i)
    {
        const float t = (float) i / 8.0f;
        const float y = hy + (h - hy) * t * t;
        g.setColour (Palette::magenta.withAlpha (0.2f + 0.3f * t));
        g.drawHorizontalLine ((int) y, 0.0f, w);
    }
    g.setColour (Palette::pink.withAlpha (0.8f));
    g.drawHorizontalLine ((int) hy, 0.0f, w);

    // Header strip.
    g.setColour (juce::Colour (0x8a05010d));
    g.fillRect (0.0f, 0.0f, w, 100.0f);
    juce::Path line;
    line.startNewSubPath (0.0f, 100.0f);
    line.lineTo (w, 100.0f);
    g.setGradientFill (juce::ColourGradient (Palette::magenta, 0.0f, 0.0f, Palette::cyan, w, 0.0f, false));
    g.strokePath (line, juce::PathStrokeType (1.5f));
    g.setGradientFill (juce::ColourGradient (Palette::magenta.withAlpha (0.25f), 0.0f, 100.0f,
                                             Palette::magenta.withAlpha (0.0f), 0.0f, 108.0f, false));
    g.fillRect (0.0f, 100.0f, w, 8.0f);

    // Footer text.
    g.setFont (synthFont (11.0f).withExtraKerningFactor (0.35f));
    g.setColour (Palette::textDim.withAlpha (0.8f));
    g.drawText ("MIDNIGHT 84  //  POLYPHONIC DARKWAVE SYNTHESIZER  //  V1.0",
                juce::Rectangle<float> (0.0f, h - 34.0f, w, 20.0f), juce::Justification::centred);
}

void MainContent::paintLogo (juce::Graphics& g)
{
    // Retro sun with horizontal cut-outs.
    const juce::Point<float> c (66.0f, 54.0f);
    const float r = 40.0f;
    g.setColour (Palette::magenta.withAlpha (0.12f));
    g.fillEllipse (c.x - r - 6.0f, c.y - r - 6.0f, (r + 6.0f) * 2.0f, (r + 6.0f) * 2.0f);
    {
        juce::Graphics::ScopedSaveState save (g);
        juce::Path disc;
        disc.addEllipse (c.x - r, c.y - r, r * 2.0f, r * 2.0f);
        g.reduceClipRegion (disc);
        for (int i = 0; i < 6; ++i)
        {
            const float y = c.y + 2.0f + (float) i * 6.5f;
            const float th = 1.0f + (float) i * 0.7f;
            g.excludeClipRegion (juce::Rectangle<float> (c.x - r, y, r * 2.0f, th).toNearestInt());
        }

        juce::ColourGradient grad (Palette::yellow, 0.0f, c.y - r, juce::Colour (0xff8c1eff), 0.0f, c.y + r, false);
        grad.addColour (0.45, Palette::orange);
        grad.addColour (0.7, Palette::magenta);
        g.setGradientFill (grad);
        g.fillRect (disc.getBounds());
    }

    // "MIDNIGHT" in chrome, "84" as a neon outline.
    const auto titleFont = synthFont (46.0f, true, true).withExtraKerningFactor (0.04f);
    juce::GlyphArrangement ga;
    ga.addLineOfText (titleFont, "MIDNIGHT", 122.0f, 60.0f);
    juce::Path title;
    ga.createPath (title);
    const auto tb = title.getBounds();

    g.setColour (Palette::magenta.withAlpha (0.25f));
    g.strokePath (title, juce::PathStrokeType (6.0f, juce::PathStrokeType::curved));

    juce::ColourGradient chrome (juce::Colour (0xffeafcff), 0.0f, tb.getY(), juce::Colour (0xffff7ad9), 0.0f, tb.getBottom(), false);
    chrome.addColour (0.48, juce::Colour (0xff6fd8ff));
    chrome.addColour (0.52, juce::Colour (0xff2b1055));
    chrome.addColour (0.75, juce::Colour (0xffb05cff));
    g.setGradientFill (chrome);
    g.fillPath (title);
    g.setColour (juce::Colours::white.withAlpha (0.6f));
    g.strokePath (title, juce::PathStrokeType (0.6f));

    juce::GlyphArrangement ga84;
    ga84.addLineOfText (titleFont, "84", tb.getRight() + 12.0f, 60.0f);
    juce::Path num;
    ga84.createPath (num);
    strokeNeon (g, num, Palette::pink, 1.6f);

    g.setFont (synthFont (10.5f).withExtraKerningFactor (0.42f));
    g.setColour (Palette::cyan.withAlpha (0.85f));
    g.drawText ("POLYPHONIC DARKWAVE SYNTH", juce::Rectangle<float> (124.0f, 68.0f, 320.0f, 16.0f),
                juce::Justification::centredLeft);
}

void MainContent::paintPanel (juce::Graphics& g, const Panel& p)
{
    const auto r = p.bounds.toFloat();
    g.setColour (Palette::panel);
    g.fillRoundedRectangle (r, 6.0f);

    // Subtle inner gradient from the section colour.
    g.setGradientFill (juce::ColourGradient (p.colour.withAlpha (0.08f), 0.0f, r.getY(),
                                             p.colour.withAlpha (0.0f), 0.0f, r.getY() + 60.0f, false));
    g.fillRoundedRectangle (r, 6.0f);

    g.setColour (p.colour.withAlpha (0.35f));
    g.drawRoundedRectangle (r.reduced (0.5f), 6.0f, 1.0f);

    // Title with a neon underline.
    g.setFont (synthFont (12.0f).withExtraKerningFactor (0.25f));
    g.setColour (p.colour);
    g.drawText (p.title, juce::Rectangle<float> (r.getX() + 10.0f, r.getY() + 5.0f, r.getWidth() - 20.0f, 16.0f),
                juce::Justification::centredLeft);

    juce::Path accent;
    accent.startNewSubPath (r.getX() + 10.0f, r.getY() + 23.0f);
    accent.lineTo (r.getX() + 42.0f, r.getY() + 23.0f);
    strokeNeon (g, accent, p.colour, 1.2f);
}
} // namespace m84

//==============================================================================
namespace
{
    // Regions of MainContent shown as pages on mobile (they line up with the panel rows).
    struct Page { const char* name; juce::Rectangle<int> area; };
    const Page mobilePages[] = {
        { "OSC",     { 0, 104, 1200, 200 } },
        { "FILTER",  { 0, 302, 1200, 210 } },
        { "FX",      { 0, 510, 1200, 190 } },
        { "ARP/MOD", { 0, 698, 1200, 160 } },
    };
    const juce::Rectangle<int> headerArea { 0, 0, 1200, 100 };

    // Shows exactly `area` of a MainContent, scaled to fit inside `space` and centred there.
    // The holder is sized to the scaled area, so it clips away the neighbouring rows.
    void fitRegion (juce::Component& holder, juce::Component& content, juce::Rectangle<int> area, juce::Rectangle<int> space)
    {
        const float s = std::min ((float) space.getWidth() / (float) area.getWidth(),
                                  (float) space.getHeight() / (float) area.getHeight());
        holder.setBounds (space.withSizeKeepingCentre (juce::roundToInt ((float) area.getWidth() * s),
                                                       juce::roundToInt ((float) area.getHeight() * s)));
        content.setBounds (0, 0, m84::MainContent::baseWidth, m84::MainContent::baseHeight);
        content.setTransform (juce::AffineTransform::translation ((float) -area.getX(), (float) -area.getY()).scaled (s));
    }
}

Midnight84AudioProcessorEditor::Midnight84AudioProcessorEditor (Midnight84AudioProcessor& p, bool mobileLayout)
    : AudioProcessorEditor (&p), processor (p), mobile (mobileLayout), content (p)
{
    setLookAndFeel (&lookAndFeel);

    if (! mobile)
    {
        addAndMakeVisible (content);
        constexpr double aspect = (double) m84::MainContent::baseWidth / (double) m84::MainContent::baseHeight;
        setResizable (true, true);
        setResizeLimits (840, 630, 1800, 1350);
        if (auto* c = getConstrainer())
            c->setFixedAspectRatio (aspect);
        setSize (m84::MainContent::baseWidth, m84::MainContent::baseHeight);
        return;
    }

    // Mobile: header strip, tab bar, one page of controls, and a playable keyboard.
    headerContent = std::make_unique<m84::MainContent> (p);
    headerHolder.addAndMakeVisible (*headerContent);
    pageHolder.addAndMakeVisible (content);
    addAndMakeVisible (headerHolder);
    addAndMakeVisible (pageHolder);

    for (int i = 0; i < (int) std::size (mobilePages); ++i)
    {
        auto* b = tabs.add (new juce::TextButton (mobilePages[i].name));
        b->setClickingTogglesState (true);
        b->setRadioGroupId (84);
        b->onClick = [this, i] { showPage (i); };
        addAndMakeVisible (b);
    }
    tabs[0]->setToggleState (true, juce::dontSendNotification);

    keyboard = std::make_unique<m84::NeonKeyboard> (p.keyboardState, juce::MidiKeyboardComponent::horizontalKeyboard);
    keyboard->setScrollButtonsVisible (false);
    keyboard->setOctaveForMiddleC (4); // C4 = middle C, like FL Studio
    keyboard->setAvailableRange (lowestKey, lowestKey + 24);
    addAndMakeVisible (*keyboard);

    octDown.onClick = [this] { shiftOctave (-1); };
    octUp.onClick = [this] { shiftOctave (1); };
    addAndMakeVisible (octDown);
    addAndMakeVisible (octUp);

    setResizable (true, false);
    setResizeLimits (320, 200, 8192, 8192);
   #if JUCE_ANDROID || JUCE_IOS
    if (auto* d = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
        setSize (d->userArea.getWidth(), d->userArea.getHeight());
    else
   #endif
        setSize (844, 390); // a typical phone in landscape
}

Midnight84AudioProcessorEditor::~Midnight84AudioProcessorEditor()
{
    setLookAndFeel (nullptr);
}

void Midnight84AudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (m84::Palette::bgTop);
    if (mobile)
    {
        // A neon rule above the keyboard.
        g.setGradientFill (juce::ColourGradient (m84::Palette::magenta, 0.0f, 0.0f, m84::Palette::cyan, (float) getWidth(), 0.0f, false));
        g.fillRect (0, keyboard->getY() - 2, getWidth(), 2);
    }
}

void Midnight84AudioProcessorEditor::resized()
{
    if (mobile)
    {
        resizedMobile();
        return;
    }

    const float scale = (float) getWidth() / (float) m84::MainContent::baseWidth;
    content.setBounds (0, 0, m84::MainContent::baseWidth, m84::MainContent::baseHeight);
    content.setTransform (juce::AffineTransform::scale (scale));
}

void Midnight84AudioProcessorEditor::resizedMobile()
{
    auto r = getLocalBounds();
    const int w = r.getWidth();

    // Header: the logo / preset / scope strip, scaled to the full width.
    const int headerH = juce::roundToInt ((float) headerArea.getHeight() * (float) w / (float) headerArea.getWidth());
    fitRegion (headerHolder, *headerContent, headerArea, r.removeFromTop (std::min (headerH, r.getHeight() / 5)));

    // Keyboard takes about a third of the screen, with octave buttons on its left.
    auto keys = r.removeFromBottom (juce::roundToInt ((float) getHeight() * 0.32f));
    keys.removeFromTop (4);
    auto octaveCol = keys.removeFromLeft (std::max (56, w / 14));
    octUp.setBounds (octaveCol.removeFromTop (octaveCol.getHeight() / 2).reduced (3));
    octDown.setBounds (octaveCol.reduced (3));
    keyboard->setBounds (keys);
    keyboard->setKeyWidth ((float) keys.getWidth() / 15.0f); // two octaves plus the top C

    // Tab bar.
    auto tabBar = r.removeFromTop (std::max (30, getHeight() / 12)).reduced (4, 3);
    const int tw = tabBar.getWidth() / tabs.size();
    for (auto* t : tabs)
        t->setBounds (tabBar.removeFromLeft (tw).reduced (3, 0));

    pageSpace = r;
    fitRegion (pageHolder, content, mobilePages[currentPage].area, pageSpace);
}

void Midnight84AudioProcessorEditor::showPage (int index)
{
    currentPage = juce::jlimit (0, (int) std::size (mobilePages) - 1, index);
    if (auto* t = tabs[currentPage])
        t->setToggleState (true, juce::dontSendNotification);
    fitRegion (pageHolder, content, mobilePages[currentPage].area, pageSpace);
    repaint();
}

void Midnight84AudioProcessorEditor::shiftOctave (int delta)
{
    lowestKey = juce::jlimit (12, 84, lowestKey + delta * 12);
    if (keyboard != nullptr)
    {
        processor.keyboardState.allNotesOff (1);
        keyboard->setAvailableRange (lowestKey, lowestKey + 24);
    }
}

//==============================================================================
void m84::NeonKeyboard::drawWhiteNote (int note, juce::Graphics& g, juce::Rectangle<float> area, bool isDown, bool,
                                       juce::Colour, juce::Colour)
{
    auto r = area.reduced (1.0f, 0.0f);
    g.setGradientFill (juce::ColourGradient (juce::Colour (0xff241238), 0.0f, r.getY(),
                                             juce::Colour (0xff0e0619), 0.0f, r.getBottom(), false));
    g.fillRect (r);
    if (isDown)
    {
        g.setGradientFill (juce::ColourGradient (Palette::magenta.withAlpha (0.25f), 0.0f, r.getY(),
                                                 Palette::magenta.withAlpha (0.85f), 0.0f, r.getBottom(), false));
        g.fillRect (r);
    }
    g.setColour (Palette::magenta.withAlpha (isDown ? 1.0f : 0.45f));
    g.drawRect (r, 1.0f);

    if (note % 12 == 0)
    {
        g.setColour (isDown ? juce::Colours::white : Palette::textDim);
        g.setFont (synthFont (std::min (13.0f, r.getWidth() * 0.32f)));
        g.drawText (getWhiteNoteText (note), r.removeFromBottom (r.getHeight() * 0.2f), juce::Justification::centred);
    }
}

void m84::NeonKeyboard::drawBlackNote (int, juce::Graphics& g, juce::Rectangle<float> area, bool isDown, bool, juce::Colour)
{
    g.setColour (juce::Colour (0xff040207));
    g.fillRect (area);
    auto top = area.reduced (area.getWidth() * 0.12f, 0.0f).withTrimmedBottom (area.getHeight() * 0.08f);
    g.setGradientFill (juce::ColourGradient (juce::Colour (0xff1b1030), 0.0f, top.getY(),
                                             juce::Colour (0xff07040c), 0.0f, top.getBottom(), false));
    g.fillRect (top);
    if (isDown)
    {
        g.setColour (Palette::cyan.withAlpha (0.7f));
        g.fillRect (top);
    }
    g.setColour (Palette::cyan.withAlpha (isDown ? 1.0f : 0.35f));
    g.drawRect (area, 1.0f);
}
