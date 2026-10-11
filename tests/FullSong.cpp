// "Neon Requiem": a full darksynth track rendered with Midnight 84.
// Every synth part is the plugin itself (one instance per track, with automation);
// drums are synthesized here. F minor, 120 BPM, 88 bars.
// Usage: Midnight84FullSong <outputDir>   -> writes neon_requiem.wav
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include "../Source/PluginProcessor.h"
#include "../Source/Presets.h"

namespace
{
constexpr double sr = 48000.0;
constexpr double bpm = 120.0;
constexpr int block = 256;
constexpr int totalBars = 88;
constexpr double tailSeconds = 5.0;
constexpr float targetRmsDb = -9.5f;  // pre-clipper loudness; higher = louder and more saturated

double beatToSec (double b) { return b * 60.0 / bpm; }
int64_t beatToSample (double b) { return (int64_t) (beatToSec (b) * sr); }

struct Event { double beat, length; int note; float vel; };
struct Bend { double beat; float value; };
struct Automation { juce::String param; double from, to, start, end; }; // beats

struct Track
{
    juce::String name, preset;
    float gain = 1.0f;
    std::vector<std::pair<juce::String, float>> overrides;
    std::vector<Event> events;
    std::vector<Bend> bends;
    std::vector<Automation> automation;
    bool ducked = true; // sidechained to the kick
};

// Fm - Db - Eb - C
const int bassRoots[4] = { 41, 37, 39, 36 };
const std::vector<std::vector<int>> padChords { { 53, 56, 60 }, { 53, 56, 61 }, { 55, 58, 63 }, { 52, 55, 60 } };
const std::vector<std::vector<int>> arpTones { { 65, 68, 72, 77 }, { 65, 68, 73, 77 }, { 67, 70, 75, 79 }, { 64, 67, 72, 76 } };

constexpr int R = -1, T = -2;

void addSteps (Track& t, int barFrom, int barTo, const std::vector<int>& steps, double gate, bool accent = true)
{
    for (int bar = barFrom; bar < barTo; ++bar)
    {
        const int root = bassRoots[bar % 4];
        for (size_t i = 0; i < steps.size(); ++i)
        {
            if (steps[i] == R || steps[i] == T) continue;
            size_t len = 1;
            while (i + len < steps.size() && steps[i + len] == T) ++len;
            const float vel = accent ? (i % 4 == 0 ? 1.0f : (i % 2 == 0 ? 0.8f : 0.68f)) : 0.85f;
            t.events.push_back ({ bar * 4.0 + (double) i * 0.25, (double) len * 0.25 * gate, root + steps[i], vel });
        }
    }
}

void addPad (Track& t, int barFrom, int barTo)
{
    for (int bar = barFrom; bar < barTo; ++bar)
        for (int n : padChords[(size_t) (bar % 4)])
            t.events.push_back ({ bar * 4.0, 3.95, n, 0.75f });
}

void addArp (Track& t, int barFrom, int barTo)
{
    static const int order[] = { 0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2 };
    for (int bar = barFrom; bar < barTo; ++bar)
        for (int i = 0; i < 16; ++i)
            t.events.push_back ({ bar * 4.0 + i * 0.25, 0.2, arpTones[(size_t) (bar % 4)][(size_t) order[i]],
                                  i % 4 == 0 ? 0.95f : 0.7f });
}

void addStabs (Track& t, int barFrom, int barTo)
{
    static const double hits[] = { 0.0, 0.75, 1.5, 3.0, 3.5 };
    for (int bar = barFrom; bar < barTo; ++bar)
        for (double h : hits)
            for (int n : padChords[(size_t) (bar % 4)])
                t.events.push_back ({ bar * 4.0 + h, 0.22, n + 12, h == 0.0 ? 1.0f : 0.8f });
}

struct Note { int note; double beats; bool slur; bool scoop; };

// Main lead theme (8 bars over Fm Db Eb C x2). Notes are original.
std::vector<Note> themeA()
{
    return {
        { 77, 0.75, false, true }, { 75, 0.75, false, false }, { 72, 0.5, true, false }, { 68, 1.0, false, false }, { 72, 1.0, false, false },
        { 73, 0.75, false, true }, { 72, 0.75, false, false }, { 68, 0.5, true, false }, { 65, 2.0, false, false },
        { 67, 0.75, false, false }, { 68, 0.75, false, false }, { 70, 0.5, true, false }, { 75, 1.5, false, true }, { 73, 0.5, true, false },
        { 72, 2.0, false, false }, { 76, 2.0, false, true },
        { 77, 0.75, false, true }, { 75, 0.75, false, false }, { 72, 0.5, true, false }, { 80, 1.0, false, true }, { 79, 1.0, false, false },
        { 77, 0.75, false, false }, { 75, 0.75, false, false }, { 73, 0.5, true, false }, { 72, 1.0, false, false }, { 68, 1.0, false, false },
        { 70, 0.5, true, false }, { 72, 0.5, true, false }, { 75, 0.5, true, false }, { 79, 0.5, true, false }, { 82, 1.0, false, true },
        { 80, 0.5, true, false }, { 79, 0.5, true, false },
        { 79, 1.5, false, true }, { 77, 0.5, true, false }, { 76, 2.0, false, true },
    };
}

// Climactic variation: second half an octave up with a 16th-note run.
std::vector<Note> themeB()
{
    auto a = themeA();
    std::vector<Note> b (a.begin(), a.begin() + 16); // first 4 bars as-is
    for (size_t i = 16; i < 26; ++i)                 // bars 5-6 up an octave
        b.push_back ({ a[i].note + 12, a[i].beats, a[i].slur, a[i].scoop });
    for (int n : { 82, 84, 87, 84, 82, 79, 82, 84 })
        b.push_back ({ n, 0.25, true, false });
    b.push_back ({ 87, 1.5, false, true });
    b.push_back ({ 85, 0.5, true, false });
    b.push_back ({ 84, 2.0, false, true });
    b.push_back ({ 88, 2.0, false, true });
    return b;
}

void addMelody (Track& t, const std::vector<Note>& notes, double startBeat, double detachedGate = 0.9)
{
    double b = startBeat;
    for (const auto& n : notes)
    {
        if (n.note >= 0)
        {
            t.events.push_back ({ b, n.beats * (n.slur ? 1.06 : detachedGate), n.note, n.slur ? 0.8f : 0.95f });
            if (n.scoop)
                for (int i = 0; i <= 10; ++i)
                    t.bends.push_back ({ std::max (0.0, b - 0.01) + i * 0.012, -0.5f * (1.0f - (float) i / 10.0f) });
        }
        b += n.beats;
    }
}

//==============================================================================
struct HostTransport : juce::AudioPlayHead
{
    int64_t sample = 0;
    juce::Optional<PositionInfo> getPosition() const override
    {
        PositionInfo info;
        info.setBpm (bpm);
        info.setIsPlaying (true);
        info.setTimeInSamples (sample);
        info.setPpqPosition ((double) sample / sr * bpm / 60.0);
        info.setTimeSignature (juce::AudioPlayHead::TimeSignature { 4, 4 });
        return info;
    }
};

int presetIndex (const juce::String& name)
{
    const auto& p = m84::factoryPresets();
    for (size_t i = 0; i < p.size(); ++i)
        if (p[i].name == name) return (int) i;
    jassertfalse;
    return 0;
}

void setParam (Midnight84AudioProcessor& proc, const juce::String& id, float value)
{
    if (auto* p = proc.apvts.getParameter (id))
        p->setValueNotifyingHost (p->convertTo0to1 (value));
}

juce::AudioBuffer<float> renderTrack (const Track& track, int totalSamples)
{
    Midnight84AudioProcessor proc;
    HostTransport transport;
    proc.setPlayHead (&transport);
    proc.setPlayConfigDetails (0, 2, sr, block);
    proc.setCurrentProgram (presetIndex (track.preset));
    for (const auto& [id, v] : track.overrides)
        setParam (proc, id, v);
    proc.prepareToPlay (sr, block);

    juce::AudioBuffer<float> out (2, totalSamples), buf (2, block);
    out.clear();

    for (int pos = 0; pos < totalSamples; pos += block)
    {
        const int n = std::min (block, totalSamples - pos);
        buf.setSize (2, n, false, false, true);
        const double beatNow = (double) pos / sr * bpm / 60.0;

        for (const auto& a : track.automation)
        {
            if (beatNow < a.start || beatNow > a.end + 0.5) continue;
            const double t = juce::jlimit (0.0, 1.0, (beatNow - a.start) / std::max (0.001, a.end - a.start));
            setParam (proc, a.param, (float) (a.from + (a.to - a.from) * t));
        }

        juce::MidiBuffer midi;
        for (const auto& e : track.events)
        {
            const int64_t on = beatToSample (e.beat), off = beatToSample (e.beat + e.length);
            if (on >= pos && on < pos + n)   midi.addEvent (juce::MidiMessage::noteOn (1, e.note, e.vel), (int) (on - pos));
            if (off >= pos && off < pos + n) midi.addEvent (juce::MidiMessage::noteOff (1, e.note), (int) (off - pos));
        }
        for (const auto& b : track.bends)
        {
            const int64_t at = beatToSample (b.beat);
            if (at >= pos && at < pos + n)
                midi.addEvent (juce::MidiMessage::pitchWheel (1, juce::jlimit (0, 16383, 8192 + (int) (b.value * 8191.0f))), (int) (at - pos));
        }

        transport.sample = pos;
        proc.processBlock (buf, midi);
        for (int ch = 0; ch < 2; ++ch)
            out.copyFrom (ch, pos, buf, ch, 0, n);
    }

    out.applyGain (track.gain);
    return out;
}

//==============================================================================
// Drums
struct DrumPlan
{
    bool kick = false, halftimeKick = false, snare = false, hats = false, openHats = false, crash = false;
};

DrumPlan planForBar (int bar)
{
    DrumPlan p;
    if (bar >= 4 && bar < 8)        { p.hats = true; }
    else if (bar >= 8 && bar < 16)  { p.kick = true; p.hats = true; p.snare = bar >= 12; p.crash = bar == 8; }
    else if (bar >= 16 && bar < 48) { p.kick = p.snare = p.hats = p.openHats = true; p.crash = bar % 8 == 0; }
    else if (bar >= 48 && bar < 56) { p.halftimeKick = bar >= 52; p.crash = bar == 48; }
    else if (bar >= 56 && bar < 64) { p.kick = bar < 63; p.hats = true; p.snare = bar < 60; }
    else if (bar >= 64 && bar < 80) { p.kick = p.snare = p.hats = p.openHats = true; p.crash = bar % 8 == 0; }
    else if (bar >= 80 && bar < 84) { p.kick = p.hats = true; p.crash = bar == 80; }
    return p;
}

struct Drums
{
    juce::AudioBuffer<float> bus, reverbSend;
    std::vector<int64_t> kicks, snares;
    juce::Random rng { 1984 };
    int mask = 0xff; // debug: 1 kick, 2 snare dry, 4 snare reverb, 8 hats, 16 crash

    explicit Drums (int total) : bus (2, total), reverbSend (2, total) { bus.clear(); reverbSend.clear(); }

    void add (int64_t at, int ch, float v) { if (at >= 0 && at < bus.getNumSamples()) bus.addSample (ch, (int) at, v); }

    void kick (double beat, float gain)
    {
        const int64_t at = beatToSample (beat);
        kicks.push_back (at);
        if (! (mask & 1)) return;
        double phase = 0.0;
        for (int i = 0; i < (int) (0.45 * sr); ++i)
        {
            const double t = i / sr;
            phase += 2.0 * juce::MathConstants<double>::pi * (48.0 + 150.0 * std::exp (-t * 32.0)) / sr;
            float s = (float) (std::sin (phase) * std::exp (-t * 9.0));
            s = std::tanh (s * 2.4f) * 0.9f;
            if (i < 140) s += (rng.nextFloat() - 0.5f) * 0.5f * (1.0f - (float) i / 140.0f);
            add (at + i, 0, s * gain);
            add (at + i, 1, s * gain);
        }
    }

    void snare (double beat, float gain)
    {
        const int64_t at = beatToSample (beat);
        snares.push_back (at);
        double p1 = 0, p2 = 0;
        float lpL = 0, lpR = 0, hpL = 0, hpR = 0;
        for (int i = 0; i < (int) (0.3 * sr); ++i)
        {
            const double t = i / sr;
            p1 += 2.0 * juce::MathConstants<double>::pi * 190.0 / sr;
            p2 += 2.0 * juce::MathConstants<double>::pi * 330.0 / sr;
            const float body = (float) (std::sin (p1) * std::exp (-t * 22.0) * 0.55 + std::sin (p2) * std::exp (-t * 35.0) * 0.25);
            const float env = (float) std::exp (-t * 13.0);
            const float nL = rng.nextFloat() * 2.0f - 1.0f, nR = rng.nextFloat() * 2.0f - 1.0f;
            lpL += 0.45f * (nL - lpL); lpR += 0.45f * (nR - lpR);   // gentle low-pass
            hpL += 0.06f * (lpL - hpL); hpR += 0.06f * (lpR - hpR); // remove lows
            const float sL = body + (lpL - hpL) * env * 1.3f, sR = body + (lpR - hpR) * env * 1.3f;
            if (mask & 2) { add (at + i, 0, sL * gain); add (at + i, 1, sR * gain); }
            if ((mask & 4) && at + i < reverbSend.getNumSamples())
            {
                reverbSend.addSample (0, (int) (at + i), sL * gain);
                reverbSend.addSample (1, (int) (at + i), sR * gain);
            }
        }
    }

    void hat (double beat, float gain, bool open, float pan)
    {
        if (! (mask & 8)) return;
        const int64_t at = beatToSample (beat);
        float prev = 0, prev2 = 0;
        const double decay = open ? 9.0 : 55.0;
        for (int i = 0; i < (int) ((open ? 0.4 : 0.07) * sr); ++i)
        {
            const float nz = rng.nextFloat() * 2.0f - 1.0f;
            const float hp = nz - 2.0f * prev + prev2; // 2nd-difference high-pass
            prev2 = prev; prev = nz;
            const float s = hp * 0.1f * (float) std::exp (-(i / sr) * decay) * gain;
            add (at + i, 0, s * (1.0f - pan));
            add (at + i, 1, s * (1.0f + pan));
        }
    }

    void crash (double beat, float gain)
    {
        if (! (mask & 16)) return;
        const int64_t at = beatToSample (beat);
        float pL = 0, pR = 0;
        for (int i = 0; i < (int) (3.0 * sr); ++i)
        {
            const double t = i / sr;
            const float nL = rng.nextFloat() * 2.0f - 1.0f, nR = rng.nextFloat() * 2.0f - 1.0f;
            const float env = (float) (std::exp (-t * 1.4) * std::min (1.0, t / 0.002)) * 0.09f * gain;
            add (at + i, 0, (nL - pL) * env);
            add (at + i, 1, (nR - pR) * env);
            pL = nL; pR = nR;
        }
    }

    void build()
    {
        for (int bar = 0; bar < totalBars; ++bar)
        {
            const auto p = planForBar (bar);
            const double b0 = bar * 4.0;
            if (p.crash) crash (b0, bar == 48 ? 0.6f : 1.0f);
            for (int beat = 0; beat < 4; ++beat)
            {
                const double b = b0 + beat;
                if (p.kick) kick (b, 0.5f);
                if (p.halftimeKick && beat == 0) kick (b, 0.5f);
                if (p.snare && (beat == 1 || beat == 3)) snare (b, 0.42f);
            }
            if (p.hats)
                for (int i = 0; i < 16; ++i)
                {
                    const bool offbeat8 = i % 4 == 2;
                    if (p.openHats && offbeat8) hat (b0 + i * 0.25, 0.7f, true, 0.1f);
                    else hat (b0 + i * 0.25, offbeat8 ? 0.8f : (i % 2 ? 0.45f : 0.6f), false, i % 2 ? 0.25f : -0.25f);
                }
        }

        // Build-up snare roll: 8ths, 16ths, then 32nds, rising in level.
        for (int i = 0; i < 8; ++i)  snare (240.0 + i * 0.5, 0.15f + 0.01f * i);
        for (int i = 0; i < 16; ++i) snare (244.0 + i * 0.25, 0.18f + 0.006f * i);
        for (int i = 0; i < 56; ++i) snare (248.0 + i * 0.125, 0.14f + 0.12f * (float) i / 56.0f);

        // 80s gated reverb on the snares.
        juce::Reverb verb;
        verb.setSampleRate (sr);
        juce::Reverb::Parameters rp;
        rp.roomSize = 0.92f; rp.damping = 0.35f; rp.wetLevel = 1.0f; rp.dryLevel = 0.0f; rp.width = 1.0f;
        verb.setParameters (rp);
        verb.processStereo (reverbSend.getWritePointer (0), reverbSend.getWritePointer (1), reverbSend.getNumSamples());

        std::vector<float> gate ((size_t) bus.getNumSamples(), 0.0f);
        const int open = (int) (0.30 * sr), fade = (int) (0.03 * sr);
        for (auto at : snares)
            for (int i = 0; i < open + fade && at + i < (int64_t) gate.size(); ++i)
                gate[(size_t) (at + i)] = std::max (gate[(size_t) (at + i)], i < open ? 1.0f : 1.0f - (float) (i - open) / (float) fade);
        for (int ch = 0; ch < 2; ++ch)
        {
            auto* d = bus.getWritePointer (ch);
            const auto* r = reverbSend.getReadPointer (ch);
            for (int i = 0; i < bus.getNumSamples(); ++i)
                d[i] += r[i] * gate[(size_t) i] * 0.55f;
        }
    }
};

//==============================================================================
std::vector<Track> buildTracks()
{
    std::vector<Track> tracks;
    const std::pair<juce::String, float> noPump { "pumpAmt", 0.0f };

    // Pad: whole song, swelling open through the intro and closing in the outro.
    {
        Track t { "Pad", "VHS Pad", 0.55f, { noPump }, {}, {}, {} };
        addPad (t, 0, 86);
        t.automation = { { "cutoff", 350, 1400, 0, 32 }, { "cutoff", 1400, 300, 320, 344 } };
        tracks.push_back (t);
    }

    // Arp: filtered in the intro, ducks out to a murmur in the breakdown, opens for the drops.
    {
        Track t { "Arp", "Hellfire Arp", 1.8f, { noPump, { "dlyMix", 0.18f } }, {}, {}, {} };
        addArp (t, 0, 48);
        addArp (t, 52, 86);
        t.automation = { { "cutoff", 140, 700, 0, 32 }, { "cutoff", 700, 220, 188, 208 },
                         { "cutoff", 220, 900, 224, 256 }, { "cutoff", 900, 120, 320, 344 } };
        tracks.push_back (t);
    }

    // Driving 16th bass: verse, lead section and the build.
    {
        Track t { "Pulse Bass", "Perturbed Bass", 0.95f, { noPump, { "subLevel", 0.6f } }, {}, {}, {} };
        const std::vector<int> pulse { 0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 12 };
        addSteps (t, 8, 16, pulse, 0.8);
        addSteps (t, 32, 48, pulse, 0.8);
        addSteps (t, 56, 64, pulse, 0.8);
        t.automation = { { "cutoff", 110, 180, 32, 34 }, { "cutoff", 110, 650, 224, 256 } };
        tracks.push_back (t);
    }

    // Heavy galloping bass for the drops (and fading out in the outro).
    {
        Track t { "Drop Bass", "Brut Force", 0.9f, { noPump }, {}, {}, {} };
        const std::vector<int> gallop { 0, T, 0, 0, 0, T, 0, 0, 0, T, 0, 0, 0, T, 12, 0 };
        addSteps (t, 16, 32, gallop, 0.85);
        addSteps (t, 64, 84, gallop, 0.85);
        t.automation = { { "master", -6.0f, -40.0f, 320, 336 } };
        tracks.push_back (t);
    }

    // Reese for the breakdown.
    {
        Track t { "Reese", "Dark Reese", 0.55f, { noPump }, {}, {}, {} };
        addSteps (t, 48, 56, { 0, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T }, 1.03, false);
        tracks.push_back (t);
    }

    // Syncopated chord stabs in the drops.
    {
        Track t { "Stabs", "Blade Stab", 2.1f, { noPump, { "revMix", 0.25f } }, {}, {}, {} };
        addStabs (t, 16, 32);
        addStabs (t, 64, 80);
        tracks.push_back (t);
    }

    // The lead: theme twice in the lead section, theme A + B in the final drop, resolve at bar 80.
    {
        Track t { "Lead", "Crimson Overdrive", 1.15f, { noPump }, {}, {}, {} };
        addMelody (t, themeA(), 128.0);
        addMelody (t, themeA(), 160.0);
        addMelody (t, themeA(), 256.0);
        addMelody (t, themeB(), 288.0);
        t.events.push_back ({ 320.0, 7.5, 89, 1.0f });
        for (int i = 0; i <= 10; ++i) t.bends.push_back ({ 319.99 + i * 0.012, -0.5f * (1.0f - i / 10.0f) });
        for (int i = 0; i <= 30; ++i) t.bends.push_back ({ 324.0 + i * 0.1, -(float) i / 30.0f }); // dive at the end
        t.bends.push_back ({ 330.0, 0.0f });
        tracks.push_back (t);
    }

    // Echoing pluck states the theme in the breakdown.
    {
        Track t { "Pluck", "Night Drive Pluck", 4.0f, { noPump, { "dlyMix", 0.35f } }, {}, {}, {} };
        addMelody (t, themeA(), 192.0, 0.5);
        tracks.push_back (t);
    }

    // Noise riser into each drop, made with the synth's noise + band-pass filter.
    {
        Track t { "Riser", "Init", 1.4f,
                  { noPump, { "osc1Level", 0.0f }, { "noise", 1.0f }, { "fltType", 2 }, { "res", 0.55f },
                    { "aA", 3.0f }, { "aR", 0.4f }, { "revMix", 0.35f }, { "fltKey", 0.0f } }, {}, {}, {} };
        t.ducked = false;
        t.events = { { 56.0, 7.9, 60, 1.0f }, { 224.0, 31.9, 60, 1.0f } };
        t.automation = { { "cutoff", 300, 9000, 56, 64 }, { "cutoff", 200, 10000, 224, 256 } };
        tracks.push_back (t);
    }

    // Sub drops on the downbeat of each drop.
    {
        Track t { "Impact", "Sub Doom", 0.8f, { noPump, { "aR", 1.2f } }, {}, {}, {} };
        t.ducked = false;
        for (double b : { 64.0, 128.0, 256.0 })
        {
            t.events.push_back ({ b, 6.0, 41, 1.0f });
            for (int i = 0; i <= 40; ++i) t.bends.push_back ({ b + 0.5 + i * 0.1, -(float) i / 40.0f });
            t.bends.push_back ({ b + 7.9, 0.0f });
        }
        tracks.push_back (t);
    }

    return tracks;
}

void writeWav (const juce::File& file, const juce::AudioBuffer<float>& buffer)
{
    file.deleteFile();
    juce::WavAudioFormat wav;
    auto stream = std::unique_ptr<juce::OutputStream> (file.createOutputStream());
    if (auto writer = std::unique_ptr<juce::AudioFormatWriter> (wav.createWriterFor (stream.get(), sr, 2, 24, {}, 0)))
    {
        stream.release();
        writer->writeFromAudioSampleBuffer (buffer, 0, buffer.getNumSamples());
    }
}
} // namespace

int main (int argc, char* argv[])
{
    juce::ScopedJuceInitialiser_GUI init;
    const juce::File outDir (argc > 1 ? juce::String (argv[1]) : juce::File::getCurrentWorkingDirectory().getFullPathName());
    outDir.createDirectory();
    const bool writeStems = argc > 2 && juce::String (argv[2]) == "stems";

    const int total = (int) (beatToSec (totalBars * 4.0) * sr + tailSeconds * sr);

    if (argc > 2 && juce::String (argv[2]) == "drumtest")
    {
        const int a = (int) (beatToSec (64) * sr), n = (int) (beatToSec (64) * sr); // drop 1
        for (auto [m, name] : std::vector<std::pair<int, const char*>> { { 1, "kick" }, { 2, "snare dry" }, { 4, "snare verb" }, { 8, "hats" }, { 16, "crash" }, { 31, "all" } })
        {
            Drums d (total);
            d.mask = m;
            d.build();
            const float rms = std::sqrt (0.5f * (d.bus.getRMSLevel (0, a, n) * d.bus.getRMSLevel (0, a, n) + d.bus.getRMSLevel (1, a, n) * d.bus.getRMSLevel (1, a, n)));
            std::printf ("%-11s peak %6.1f  rms %6.1f\n", name, juce::Decibels::gainToDecibels (d.bus.getMagnitude (a, n)), juce::Decibels::gainToDecibels (rms));
        }
        return 0;
    }

    Drums drums (total);
    drums.build();

    // Kick sidechain envelope for the synth bus.
    std::vector<float> duck ((size_t) total, 1.0f);
    for (auto at : drums.kicks)
        for (int i = 0; i < (int) (0.4 * sr) && at + i < total; ++i)
        {
            const double t = i / sr;
            const float d = (float) (std::min (1.0, t / 0.004) * std::exp (-t / 0.11));
            duck[(size_t) (at + i)] = std::min (duck[(size_t) (at + i)], 1.0f - 0.5f * d);
        }

    juce::AudioBuffer<float> mix (2, total);
    mix.clear();
    for (const auto& track : buildTracks())
    {
        auto audio = renderTrack (track, total);
        const float rms = std::sqrt ((audio.getRMSLevel (0, 0, total) * audio.getRMSLevel (0, 0, total)
                                      + audio.getRMSLevel (1, 0, total) * audio.getRMSLevel (1, 0, total)) * 0.5f);
        std::printf ("%-11s peak %6.1f dBFS  rms %6.1f dB\n", track.name.toRawUTF8(),
                     juce::Decibels::gainToDecibels (audio.getMagnitude (0, total)), juce::Decibels::gainToDecibels (rms));
        if (track.ducked)
            for (int ch = 0; ch < 2; ++ch)
            {
                auto* d = audio.getWritePointer (ch);
                for (int i = 0; i < total; ++i) d[i] *= duck[(size_t) i];
            }
        if (writeStems)
            { juce::AudioBuffer<float> d (audio); d.applyGain (0.25f); writeWav (outDir.getChildFile ("stem_" + track.name.replaceCharacter (' ', '_') + ".wav"), d); }
        for (int ch = 0; ch < 2; ++ch)
            mix.addFrom (ch, 0, audio, ch, 0, total);
    }
    if (writeStems)
        { juce::AudioBuffer<float> d (drums.bus); d.applyGain (0.25f); writeWav (outDir.getChildFile ("stem_Drums.wav"), d); } // stems at -12 dB
    std::printf ("%-11s peak %6.1f dBFS\n", "Drums", juce::Decibels::gainToDecibels (drums.bus.getMagnitude (0, total)));
    for (int ch = 0; ch < 2; ++ch)
        mix.addFrom (ch, 0, drums.bus, ch, 0, total);

    // Master bus: glue compressor (stereo-linked) -> drive to a target RMS -> soft clipper -> -0.8 dBFS.
    {
        mix.applyGain (1.0f / std::max (mix.getMagnitude (0, total), 1.0e-6f));
        const float thresh = juce::Decibels::decibelsToGain (-18.0f), ratio = 3.0f;
        const float att = std::exp (-1.0f / (0.01f * (float) sr)), rel = std::exp (-1.0f / (0.15f * (float) sr));
        float env = 0.0f;
        auto* L = mix.getWritePointer (0);
        auto* Rt = mix.getWritePointer (1);
        for (int i = 0; i < total; ++i)
        {
            const float x = std::max (std::abs (L[i]), std::abs (Rt[i]));
            env = x > env ? att * env + (1.0f - att) * x : rel * env + (1.0f - rel) * x;
            const float g = env > thresh ? std::pow (env / thresh, 1.0f / ratio - 1.0f) : 1.0f;
            L[i] *= g;
            Rt[i] *= g;
        }

        const float rms = std::sqrt (0.5f * (mix.getRMSLevel (0, 0, total) * mix.getRMSLevel (0, 0, total)
                                             + mix.getRMSLevel (1, 0, total) * mix.getRMSLevel (1, 0, total)));
        const float drive = juce::Decibels::decibelsToGain (targetRmsDb) / std::max (rms, 1.0e-6f);
        for (int i = 0; i < total; ++i)
        {
            L[i] = std::tanh (L[i] * drive);
            Rt[i] = std::tanh (Rt[i] * drive);
        }
        mix.applyGain (0.912f / std::max (mix.getMagnitude (0, total), 1.0e-6f));
    }

    writeWav (outDir.getChildFile ("neon_requiem.wav"), mix);
    std::printf ("done: %.1f s\n", total / sr);
    return 0;
}
