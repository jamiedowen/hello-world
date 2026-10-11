// Renders a short demo track using the real plugin engine: eight 4-bar sections of
// dark bass lines (plus pads / arps / leads and a simple synthesized drum kit for context).
// Usage: Midnight84DemoSong <outputDir>
// Writes demo_full.wav (everything) and demo_bass_only.wav (bass layers only, no drums).
#include <juce_audio_formats/juce_audio_formats.h>
#include "../Source/PluginProcessor.h"
#include "../Source/Presets.h"

namespace
{
constexpr double sr = 48000.0;
constexpr double bpm = 110.0;
constexpr int block = 256;
constexpr int R = -1; // rest
constexpr int T = -2; // tie (extend previous note)

double beatsToSeconds (double beats) { return beats * 60.0 / bpm; }

struct Event { double beat, length; int note; float vel; };

struct Layer
{
    juce::String preset;
    std::vector<Event> events;
    float gain = 1.0f;
    bool isBass = false;
};

enum class Drums { none, fourFloor, halftime };

struct Section
{
    std::vector<Layer> layers;
    Drums drums = Drums::fourFloor;
};

// One bar of 16th-note steps (offsets from root, R = rest, T = tie), repeated per root.
std::vector<Event> stepLine (const std::vector<int>& roots, const std::vector<int>& steps, double gate,
                             const std::vector<float>& accents = {})
{
    std::vector<Event> ev;
    for (size_t bar = 0; bar < roots.size(); ++bar)
    {
        for (size_t i = 0; i < steps.size(); ++i)
        {
            if (steps[i] == R || steps[i] == T) continue;
            size_t len = 1;
            while (i + len < steps.size() && steps[i + len] == T) ++len;
            const float vel = accents.empty() ? (i % 4 == 0 ? 1.0f : 0.75f) : accents[i % accents.size()];
            ev.push_back ({ (double) bar * 4.0 + (double) i * 0.25, (double) len * 0.25 * gate,
                            roots[bar] + steps[i], vel });
        }
    }
    return ev;
}

// Chords held for the given number of beats each.
std::vector<Event> chords (const std::vector<std::vector<int>>& cs, double beatsEach, double gate = 0.95)
{
    std::vector<Event> ev;
    for (size_t c = 0; c < cs.size(); ++c)
        for (int n : cs[c])
            ev.push_back ({ (double) c * beatsEach, beatsEach * gate, n, 0.8f });
    return ev;
}

// Monophonic line from (note, beats) pairs; note < 0 is a rest.
std::vector<Event> melody (const std::vector<std::pair<int, double>>& notes, double gate = 0.9)
{
    std::vector<Event> ev;
    double t = 0.0;
    for (auto [n, len] : notes)
    {
        if (n >= 0) ev.push_back ({ t, len * gate, n, 0.85f });
        t += len;
    }
    return ev;
}

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

// Renders one layer into dest starting at startSample, with a tail.
void renderLayer (const Layer& layer, int64_t startSample, int lengthSamples, juce::AudioBuffer<float>& dest)
{
    Midnight84AudioProcessor proc;
    HostTransport transport;
    proc.setPlayHead (&transport);
    proc.setPlayConfigDetails (0, 2, sr, block);
    proc.setCurrentProgram (presetIndex (layer.preset));
    proc.prepareToPlay (sr, block);

    juce::AudioBuffer<float> buf (2, block);
    for (int pos = 0; pos < lengthSamples; pos += block)
    {
        const int n = std::min (block, lengthSamples - pos);
        buf.setSize (2, n, false, false, true);
        juce::MidiBuffer midi;
        for (const auto& e : layer.events)
        {
            const int on = (int) (beatsToSeconds (e.beat) * sr);
            const int off = (int) (beatsToSeconds (e.beat + e.length) * sr);
            if (on >= pos && on < pos + n)   midi.addEvent (juce::MidiMessage::noteOn (1, e.note, e.vel), on - pos);
            if (off >= pos && off < pos + n) midi.addEvent (juce::MidiMessage::noteOff (1, e.note), off - pos);
        }
        transport.sample = startSample + pos;
        proc.processBlock (buf, midi);

        for (int ch = 0; ch < 2; ++ch)
        {
            const int64_t at = startSample + pos;
            const int len = (int) std::min<int64_t> (n, dest.getNumSamples() - at);
            if (len > 0) dest.addFrom (ch, (int) at, buf, ch, 0, len, layer.gain);
        }
    }
}

// Simple synthesized drums so the bass lines sit in a groove.
void renderDrums (Drums mode, int64_t start, int bars, juce::AudioBuffer<float>& dest, juce::Random& rng)
{
    if (mode == Drums::none) return;
    const double beatLen = beatsToSeconds (1.0) * sr;

    auto addHit = [&] (int64_t at, int type, float gain)
    {
        const int len = (int) (sr * (type == 0 ? 0.45 : type == 1 ? 0.25 : 0.05));
        double phase = 0.0;
        float bp1 = 0.0f, bp2 = 0.0f, hpPrev = 0.0f;
        for (int i = 0; i < len && at + i < dest.getNumSamples(); ++i)
        {
            const double t = i / sr;
            float s;
            if (type == 0) // kick: pitch-swept sine with a click
            {
                const double f = 45.0 + 120.0 * std::exp (-t * 30.0);
                phase += 2.0 * juce::MathConstants<double>::pi * f / sr;
                s = (float) (std::sin (phase) * std::exp (-t * 7.0));
                s = std::tanh (s * 1.8f) * 0.9f + (i < 60 ? (rng.nextFloat() - 0.5f) * 0.3f : 0.0f);
            }
            else if (type == 1) // snare: tone + filtered noise, gated-reverb-ish decay
            {
                phase += 2.0 * juce::MathConstants<double>::pi * 185.0 / sr;
                const float noise = rng.nextFloat() * 2.0f - 1.0f;
                bp1 += 0.35f * (noise - bp1);
                bp2 += 0.08f * (bp1 - bp2);
                s = (float) (std::sin (phase) * std::exp (-t * 25.0) * 0.5)
                  + (bp1 - bp2) * (float) std::exp (-t * 11.0) * 1.4f;
            }
            else // hat: high-passed noise
            {
                const float noise = rng.nextFloat() * 2.0f - 1.0f;
                s = (noise - hpPrev) * (float) std::exp (-t * 70.0) * 0.35f;
                hpPrev = noise;
            }
            dest.addSample (0, (int) (at + i), s * gain);
            dest.addSample (1, (int) (at + i), s * gain);
        }
    };

    for (int beat = 0; beat < bars * 4; ++beat)
    {
        const int64_t at = start + (int64_t) (beat * beatLen);
        const int inBar = beat % 4;
        if (mode == Drums::fourFloor)
        {
            addHit (at, 0, 0.55f);
            if (inBar == 1 || inBar == 3) addHit (at, 1, 0.4f);
        }
        else
        {
            if (inBar == 0) addHit (at, 0, 0.6f);
            if (inBar == 2) addHit (at, 1, 0.45f);
        }
        addHit (at + (int64_t) (beatLen * 0.5), 2, 0.25f);
        addHit (at, 2, 0.15f);
    }
}

std::vector<Section> buildSong()
{
    std::vector<Section> song;
    const std::vector<int> gallop { 0, T, 0, 0, 0, T, 0, 0, 0, T, 0, 0, 0, T, 0, 0 };

    // 1. Perturbed Bass: relentless 16ths with octave pops under a VHS pad.
    song.push_back ({ {
        { "Perturbed Bass", stepLine ({ 33, 29, 31, 28 }, { 0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 12 }, 0.8), 1.0f, true },
        { "VHS Pad", chords ({ { 57, 60, 64 }, { 53, 57, 60 }, { 55, 59, 62 }, { 52, 56, 59 } }, 4.0), 0.5f },
    }, Drums::fourFloor });

    // 2. Brut Force: galloping, pumping bass with a hellish arp.
    {
        std::vector<Event> arp;
        const std::vector<std::vector<int>> tones { { 62, 65, 69, 74 }, { 62, 65, 69, 74 }, { 58, 62, 65, 70 }, { 60, 64, 67, 72 } };
        for (int bar = 0; bar < 4; ++bar)
            for (int i = 0; i < 16; ++i)
                arp.push_back ({ bar * 4.0 + i * 0.25, 0.2, tones[(size_t) bar][(size_t) ((i * 3) % 4)] + (i % 8 >= 4 ? 12 : 0), 0.8f });
        song.push_back ({ {
            { "Brut Force", stepLine ({ 38, 38, 34, 36 }, gallop, 0.85), 1.0f, true },
            { "Hellfire Arp", arp, 0.45f },
        }, Drums::fourFloor });
    }

    // 3. Dark Reese: long legato notes sliding into each other.
    song.push_back ({ {
        { "Dark Reese", stepLine ({ 33, 29, 31, 33 },
                                  { 0, T, T, T, T, T, T, T, T, T, T, T, 3, T, T, T }, 1.04), 1.0f, true },
    }, Drums::halftime });

    // 4. Turbo Slayer: syncopated, distorted and slammed by the pump.
    song.push_back ({ {
        { "Turbo Slayer", stepLine ({ 28, 28, 24, 26 }, { 0, R, 0, 0, R, 0, 0, R, 0, R, 0, 0, 3, R, 5, R }, 0.8), 1.4f, true },
    }, Drums::fourFloor });

    // 5. Ladder Mono Bass: resonant acid-ish line with glides between overlapping notes.
    song.push_back ({ {
        { "Ladder Mono Bass", stepLine ({ 33, 33, 31, 29 }, { 0, 12, 0, T, 15, 0, 12, 0, 0, 7, T, 10, 12, 0, 3, 0 }, 1.08,
                                        { 1.0f, 0.6f, 0.8f, 0.6f, 1.0f, 0.6f, 0.9f, 0.6f }), 1.6f, true },
    }, Drums::fourFloor });

    // 6. Sub Doom: slow and crushing, with blade stabs.
    song.push_back ({ {
        { "Sub Doom", stepLine ({ 38, 34, 36, 33 }, { 0, T, T, T, T, T, 0, T, T, T, R, R, 0, T, 0, R }, 0.9), 1.0f, true },
        { "Blade Stab", chords ({ { 62, 65, 69 }, { 58, 62, 65 }, { 60, 64, 67 }, { 57, 61, 64 } }, 4.0, 0.15), 0.45f },
    }, Drums::halftime });

    // 7. Pulse Wobble: tempo-synced filter wobble.
    song.push_back ({ {
        { "Pulse Wobble", stepLine ({ 33, 29, 31, 28 }, { 0, T, T, T, T, T, T, 0, T, T, T, T, T, T, T, T }, 0.95), 1.0f, true },
    }, Drums::fourFloor });

    // 8. Finale: galloping bass, pumping chords and a neon lead.
    song.push_back ({ {
        { "Brut Force", stepLine ({ 33, 29, 31, 28 }, gallop, 0.85), 1.0f, true },
        { "Outrun Chords", chords ({ { 57, 60, 64 }, { 53, 57, 60 }, { 55, 59, 62 }, { 52, 56, 59 } }, 4.0), 0.45f },
        { "Neon Lead", melody ({ { 69, 1 }, { 72, 1 }, { 76, 1 }, { 74, 1 }, { 72, 2 }, { 69, 2 },
                                 { 67, 1 }, { 71, 1 }, { 74, 1 }, { 72, 1 }, { 71, 3.5 }, { -1, 0.5 } }, 1.02), 0.5f },
    }, Drums::fourFloor });

    return song;
}

void writeWav (const juce::File& file, juce::AudioBuffer<float> buffer)
{
    // Gentle soft-clip then normalise to -1 dBFS.
    for (int ch = 0; ch < 2; ++ch)
    {
        auto* d = buffer.getWritePointer (ch);
        for (int i = 0; i < buffer.getNumSamples(); ++i)
            d[i] = std::tanh (d[i] * 1.2f);
    }
    const float peak = buffer.getMagnitude (0, buffer.getNumSamples());
    if (peak > 0.0f) buffer.applyGain (0.89f / peak);

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

    const auto song = buildSong();
    const int barsPerSection = 4;
    const int sectionLen = (int) (beatsToSeconds (barsPerSection * 4.0) * sr);
    const int tail = (int) (2.5 * sr);
    const int total = sectionLen * (int) song.size() + tail;

    juce::AudioBuffer<float> full (2, total), bassOnly (2, total);
    full.clear();
    bassOnly.clear();
    juce::Random rng (1984);

    for (size_t s = 0; s < song.size(); ++s)
    {
        const int64_t start = (int64_t) s * sectionLen;
        for (const auto& layer : song[s].layers)
        {
            std::printf ("section %d: %s\n", (int) s + 1, layer.preset.toRawUTF8());
            renderLayer (layer, start, sectionLen + tail, full);
            if (layer.isBass)
                renderLayer (layer, start, sectionLen + tail, bassOnly);
        }
        renderDrums (song[s].drums, start, barsPerSection, full, rng);
    }

    writeWav (outDir.getChildFile ("demo_full.wav"), full);
    writeWav (outDir.getChildFile ("demo_bass_only.wav"), bassOnly);
    std::printf ("done: %.1f s\n", total / sr);
    return 0;
}
