#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "Presets.h"

using namespace m84;

Midnight84AudioProcessor::Midnight84AudioProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "Midnight84", createParameterLayout())
{
    cacheParameterPointers();
}

void Midnight84AudioProcessor::cacheParameterPointers()
{
    auto get = [this] (const juce::String& id)
    {
        auto* p = apvts.getRawParameterValue (id);
        jassert (p != nullptr);
        return p;
    };

    for (int i = 0; i < kNumOscs; ++i)
    {
        auto& o = pp.osc[(size_t) i];
        o.wave = get (ID::oscId (i, "Wave"));
        o.oct = get (ID::oscId (i, "Oct"));
        o.semi = get (ID::oscId (i, "Semi"));
        o.fine = get (ID::oscId (i, "Fine"));
        o.pw = get (ID::oscId (i, "PW"));
        o.level = get (ID::oscId (i, "Level"));
        o.unison = get (ID::oscId (i, "Unison"));
        o.detune = get (ID::oscId (i, "Detune"));
    }

    pp.subLevel = get (ID::subLevel);   pp.subOct = get (ID::subOct);     pp.subWave = get (ID::subWave);
    pp.noise = get (ID::noise);         pp.spread = get (ID::spread);
    pp.fltType = get (ID::fltType);     pp.cutoff = get (ID::cutoff);     pp.res = get (ID::res);
    pp.fltDrive = get (ID::fltDrive);   pp.fltEnv = get (ID::fltEnv);     pp.fltKey = get (ID::fltKey);
    pp.fltVel = get (ID::fltVel);       pp.fltLfo = get (ID::fltLfo);
    pp.fA = get (ID::fA); pp.fD = get (ID::fD); pp.fS = get (ID::fS); pp.fR = get (ID::fR);
    pp.aA = get (ID::aA); pp.aD = get (ID::aD); pp.aS = get (ID::aS); pp.aR = get (ID::aR);
    pp.ampVel = get (ID::ampVel);
    pp.lfoWave = get (ID::lfoWave);     pp.lfoRate = get (ID::lfoRate);   pp.lfoSync = get (ID::lfoSync);
    pp.lfoSyncRate = get (ID::lfoSyncRate); pp.lfoRetrig = get (ID::lfoRetrig);
    pp.lfoPitch = get (ID::lfoPitch);   pp.lfoPW = get (ID::lfoPW);
    pp.voiceMode = get (ID::voiceMode); pp.polyphony = get (ID::polyphony); pp.glide = get (ID::glide);
    pp.bendRange = get (ID::bendRange); pp.analog = get (ID::analog);
    pp.drvType = get (ID::drvType);     pp.drvAmt = get (ID::drvAmt);     pp.drvTone = get (ID::drvTone);
    pp.drvMix = get (ID::drvMix);
    pp.chRate = get (ID::chRate);       pp.chDepth = get (ID::chDepth);   pp.chMix = get (ID::chMix);
    pp.dlyTime = get (ID::dlyTime);     pp.dlyFb = get (ID::dlyFb);       pp.dlyTone = get (ID::dlyTone);
    pp.dlyMix = get (ID::dlyMix);
    pp.revSize = get (ID::revSize);     pp.revDamp = get (ID::revDamp);   pp.revMix = get (ID::revMix);
    pp.pumpRate = get (ID::pumpRate);   pp.pumpAmt = get (ID::pumpAmt);   pp.master = get (ID::master);
}

EngineParams Midnight84AudioProcessor::readEngineParams() const
{
    auto f = [] (std::atomic<float>* a) { return a->load (std::memory_order_relaxed); };
    auto i = [] (std::atomic<float>* a) { return juce::roundToInt (a->load (std::memory_order_relaxed)); };

    EngineParams p;
    for (int o = 0; o < kNumOscs; ++o)
    {
        const auto& src = pp.osc[(size_t) o];
        auto& dst = p.osc[(size_t) o];
        dst.wave = i (src.wave);
        dst.octave = (float) i (src.oct);
        dst.semi = (float) i (src.semi);
        dst.fine = f (src.fine);
        dst.pw = f (src.pw);
        dst.level = f (src.level);
        dst.unison = i (src.unison);
        dst.detune = f (src.detune);
    }

    p.subLevel = f (pp.subLevel); p.subOct = i (pp.subOct); p.subWave = i (pp.subWave);
    p.noise = f (pp.noise); p.spread = f (pp.spread);
    p.fltType = i (pp.fltType); p.cutoff = f (pp.cutoff); p.res = f (pp.res); p.fltDrive = f (pp.fltDrive);
    p.fltEnv = f (pp.fltEnv); p.fltKey = f (pp.fltKey); p.fltVel = f (pp.fltVel); p.fltLfo = f (pp.fltLfo);
    p.fA = f (pp.fA); p.fD = f (pp.fD); p.fS = f (pp.fS); p.fR = f (pp.fR);
    p.aA = f (pp.aA); p.aD = f (pp.aD); p.aS = f (pp.aS); p.aR = f (pp.aR); p.ampVel = f (pp.ampVel);
    p.lfoWave = i (pp.lfoWave); p.lfoRate = f (pp.lfoRate); p.lfoSync = f (pp.lfoSync) > 0.5f;
    p.lfoSyncRate = i (pp.lfoSyncRate); p.lfoRetrig = f (pp.lfoRetrig) > 0.5f;
    p.lfoPitch = f (pp.lfoPitch); p.lfoPW = f (pp.lfoPW);
    p.voiceMode = i (pp.voiceMode); p.polyphony = i (pp.polyphony); p.glide = f (pp.glide);
    p.bendRange = f (pp.bendRange); p.analog = f (pp.analog);
    return p;
}

FxParams Midnight84AudioProcessor::readFxParams() const
{
    auto f = [] (std::atomic<float>* a) { return a->load (std::memory_order_relaxed); };
    auto i = [] (std::atomic<float>* a) { return juce::roundToInt (a->load (std::memory_order_relaxed)); };

    FxParams p;
    p.drvType = i (pp.drvType); p.drvAmt = f (pp.drvAmt); p.drvTone = f (pp.drvTone); p.drvMix = f (pp.drvMix);
    p.chRate = f (pp.chRate); p.chDepth = f (pp.chDepth); p.chMix = f (pp.chMix);
    p.dlyTime = i (pp.dlyTime); p.dlyFb = f (pp.dlyFb); p.dlyTone = f (pp.dlyTone); p.dlyMix = f (pp.dlyMix);
    p.revSize = f (pp.revSize); p.revDamp = f (pp.revDamp); p.revMix = f (pp.revMix);
    p.pumpRate = i (pp.pumpRate); p.pumpAmt = f (pp.pumpAmt);
    p.masterDb = f (pp.master);
    return p;
}

void Midnight84AudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    const int block = std::max (samplesPerBlock, 32);
    engine.prepare (sampleRate, block);
    fx.prepare (sampleRate, block);
}

bool Midnight84AudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void Midnight84AudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear();

    Transport t;
    if (auto* ph = getPlayHead())
    {
        if (auto pos = ph->getPosition())
        {
            if (auto bpm = pos->getBpm()) t.bpm = *bpm;
            if (auto ppq = pos->getPpqPosition()) t.ppq = *ppq;
            t.playing = pos->getIsPlaying();
        }
    }

    const auto params = readEngineParams();
    if (params.voiceMode != lastVoiceMode)
    {
        // Switching between poly and mono mid-note would strand voices.
        if (lastVoiceMode >= 0)
            engine.allNotesOff();
        lastVoiceMode = params.voiceMode;
    }

    engine.setParams (params);
    engine.setTransport (t.bpm, t.ppq, t.playing);
    engine.process (buffer, midi);

    fx.process (buffer, readFxParams(), t);

    scope.push (buffer.getReadPointer (0),
                buffer.getNumChannels() > 1 ? buffer.getReadPointer (1) : nullptr,
                buffer.getNumSamples());
}

juce::AudioProcessorEditor* Midnight84AudioProcessor::createEditor()
{
    return new Midnight84AudioProcessorEditor (*this);
}

//==============================================================================
int Midnight84AudioProcessor::getNumPrograms()
{
    return (int) factoryPresets().size();
}

void Midnight84AudioProcessor::setCurrentProgram (int index)
{
    const auto& presets = factoryPresets();
    if (! juce::isPositiveAndBelow (index, (int) presets.size()))
        return;

    currentProgram = index;
    applyPreset (apvts, presets[(size_t) index]);
    setPresetName (presets[(size_t) index].name);
}

const juce::String Midnight84AudioProcessor::getProgramName (int index)
{
    const auto& presets = factoryPresets();
    return juce::isPositiveAndBelow (index, (int) presets.size()) ? presets[(size_t) index].name : juce::String();
}

void Midnight84AudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.setProperty ("presetName", getPresetName(), nullptr);
    state.setProperty ("program", currentProgram, nullptr);
    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void Midnight84AudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
    {
        if (xml->hasTagName (apvts.state.getType()))
        {
            auto state = juce::ValueTree::fromXml (*xml);
            setPresetName (state.getProperty ("presetName", "Init").toString());
            currentProgram = state.getProperty ("program", 0);
            apvts.replaceState (state);
        }
    }
}

bool Midnight84AudioProcessor::saveUserPreset (const juce::File& file)
{
    auto state = apvts.copyState();
    state.setProperty ("presetName", file.getFileNameWithoutExtension(), nullptr);
    if (auto xml = state.createXml())
    {
        if (xml->writeTo (file))
        {
            setPresetName (file.getFileNameWithoutExtension());
            return true;
        }
    }
    return false;
}

bool Midnight84AudioProcessor::loadUserPreset (const juce::File& file)
{
    auto xml = juce::XmlDocument::parse (file);
    if (xml == nullptr || ! xml->hasTagName (apvts.state.getType()))
        return false;

    auto state = juce::ValueTree::fromXml (*xml);
    // Keep the plugin's parameter values in sync with the host through the normal parameter API.
    for (auto* p : getParameters())
    {
        if (auto* rp = dynamic_cast<juce::RangedAudioParameter*> (p))
        {
            auto child = state.getChildWithProperty ("id", rp->getParameterID());
            if (child.isValid())
                rp->setValueNotifyingHost (rp->convertTo0to1 ((float) child.getProperty ("value")));
            else
                rp->setValueNotifyingHost (rp->getDefaultValue());
        }
    }
    setPresetName (file.getFileNameWithoutExtension());
    return true;
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new Midnight84AudioProcessor();
}
