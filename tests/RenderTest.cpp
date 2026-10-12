// Renders every factory preset offline, reports level / NaN / CPU stats, writes WAVs,
// and saves a screenshot of the editor. Usage: Midnight84RenderTest <outputDir>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_gui_basics/juce_gui_basics.h>
#include "../Source/PluginEditor.h"
#include "../Source/PluginProcessor.h"
#include "../Source/Presets.h"

namespace
{
struct Note { double start, length; int note; float vel; };

std::vector<Note> patternFor (const juce::String& name)
{
    const bool isPad = name.containsIgnoreCase ("Pad") || name.containsIgnoreCase ("Chords")
                    || name.containsIgnoreCase ("Brass") || name.containsIgnoreCase ("Stab");
    std::vector<Note> notes;
    if (isPad)
    {
        for (int n : { 45, 52, 57, 60, 64 }) notes.push_back ({ 0.0, 1.6, n, 0.8f });
        for (int n : { 41, 48, 53, 57, 60 }) notes.push_back ({ 1.8, 1.4, n, 0.8f });
    }
    else
    {
        // Driving darksynth 8th-note bass line with an overlapping legato pair.
        const int line[] = { 33, 33, 45, 33, 36, 33, 31, 43, 33, 33, 45, 33, 40, 38, 36, 31 };
        for (int i = 0; i < 16; ++i)
            notes.push_back ({ i * 0.2, i == 6 ? 0.3 : 0.17, line[i] + (name.containsIgnoreCase ("Lead") ? 24 : 0),
                               i % 2 == 0 ? 1.0f : 0.7f });
    }
    return notes;
}
}

int main (int argc, char* argv[])
{
    juce::ScopedJuceInitialiser_GUI gui;
    const juce::File outDir (argc > 1 ? juce::String (argv[1]) : juce::File::getCurrentWorkingDirectory().getFullPathName());
    outDir.createDirectory();

    constexpr double sr = 48000.0;
    constexpr int block = 512;
    const double seconds = 3.6;

    Midnight84AudioProcessor proc;
    proc.setPlayConfigDetails (0, 2, sr, block);
    proc.prepareToPlay (sr, block);

    bool ok = true;
    juce::WavAudioFormat wav;

    for (int prog = 0; prog < proc.getNumPrograms(); ++prog)
    {
        proc.setCurrentProgram (prog);
        proc.prepareToPlay (sr, block); // reset tails between presets
        const auto name = proc.getProgramName (prog);
        const auto notes = patternFor (name);

        const int total = (int) (seconds * sr);
        juce::AudioBuffer<float> out (2, total);
        juce::AudioBuffer<float> buf (2, block);
        double cpu = 0.0, worstBlock = 0.0;

        for (int pos = 0; pos < total; pos += block)
        {
            const int n = std::min (block, total - pos);
            buf.setSize (2, n, false, false, true);
            juce::MidiBuffer midi;
            for (const auto& nt : notes)
            {
                const int on = (int) (nt.start * sr), off = (int) ((nt.start + nt.length) * sr);
                if (on >= pos && on < pos + n) midi.addEvent (juce::MidiMessage::noteOn (1, nt.note, nt.vel), on - pos);
                if (off >= pos && off < pos + n) midi.addEvent (juce::MidiMessage::noteOff (1, nt.note), off - pos);
            }
            const auto t0 = juce::Time::getHighResolutionTicks();
            proc.processBlock (buf, midi);
            const double dt = juce::Time::highResolutionTicksToSeconds (juce::Time::getHighResolutionTicks() - t0);
            cpu += dt;
            worstBlock = std::max (worstBlock, dt / ((double) n / sr));
            for (int ch = 0; ch < 2; ++ch)
                out.copyFrom (ch, pos, buf, ch, 0, n);
        }

        float peak = 0.0f; double sumSq = 0.0; bool nan = false;
        for (int ch = 0; ch < 2; ++ch)
            for (int i = 0; i < total; ++i)
            {
                const float s = out.getSample (ch, i);
                if (! std::isfinite (s)) nan = true;
                peak = std::max (peak, std::abs (s));
                sumSq += (double) s * s;
            }
        const double rmsDb = juce::Decibels::gainToDecibels (std::sqrt (sumSq / (2.0 * total)));
        const bool bad = nan || peak < 0.01f || peak > 2.0f;
        ok = ok && ! bad;

        std::printf ("%-20s peak %6.2f dBFS  rms %6.1f dB  cpu %5.1f%% avg / %5.1f%% worst  %s\n",
                     name.toRawUTF8(), juce::Decibels::gainToDecibels (peak), rmsDb,
                     100.0 * cpu / seconds, 100.0 * worstBlock, bad ? (nan ? "NaN!" : "LEVEL!") : "ok");

        auto file = outDir.getChildFile (juce::String (prog).paddedLeft ('0', 2) + "_" + name.replaceCharacter (' ', '_') + ".wav");
        file.deleteFile();
        if (auto stream = std::unique_ptr<juce::OutputStream> (file.createOutputStream()))
            if (auto writer = std::unique_ptr<juce::AudioFormatWriter> (wav.createWriterFor (stream.get(), sr, 2, 24, {}, 0)))
            {
                stream.release();
                writer->writeFromAudioSampleBuffer (out, 0, total);
            }
    }

    // Feature checks -----------------------------------------------------------------------
    {
        // Arpeggiator: hold C-E-G for one second at 120 BPM, 1/16 steps, Up, 2 octaves.
        m84::Arpeggiator arp;
        arp.prepare (sr);
        m84::ArpParams ap;
        ap.on = true; ap.mode = 0; ap.rate = 3; ap.octaves = 2; ap.gate = 0.5f;
        std::vector<int> ons;
        std::vector<int> onTimes, offTimes;
        for (int pos = 0; pos < (int) sr; pos += block)
        {
            juce::MidiBuffer midi;
            if (pos == 0)
                for (int n : { 64, 60, 67 }) midi.addEvent (juce::MidiMessage::noteOn (1, n, 0.9f), 0);
            arp.process (midi, block, ap, 120.0, 0.0, false);
            for (const auto meta : midi)
            {
                const auto m = meta.getMessage();
                if (pos + meta.samplePosition >= (int) sr) continue; // only count the 1 s window
                if (m.isNoteOn()) { ons.push_back (m.getNoteNumber()); onTimes.push_back (pos + meta.samplePosition); }
                if (m.isNoteOff()) offTimes.push_back (pos + meta.samplePosition);
            }
        }
        const std::vector<int> expectOrder { 60, 64, 67, 72, 76, 79, 60, 64 };
        const bool countOk = ons.size() == 8;
        const bool orderOk = countOk && ons == expectOrder;
        const bool gateOk = ! offTimes.empty() && std::abs ((offTimes[0] - onTimes[0]) - (int) (0.5 * 0.125 * sr)) <= 2;
        juce::String got;
        for (size_t k = 0; k < ons.size(); ++k) got << ons[k] << "@" << onTimes[k] << " ";
        std::printf ("arp notes: %s\n", got.toRawUTF8());
        std::printf ("arp: %d steps in 1 s (expect 8), order %s, gate %s\n", (int) ons.size(),
                     orderOk ? "ok" : "WRONG", gateOk ? "ok" : "WRONG");
        ok = ok && countOk && orderOk && gateOk;
    }

    {
        // Arpeggiator locked to a playing host: start 0.3 beats in, 1/8 steps at 100 BPM.
        // Steps must land exactly on the grid (beats 0.5, 1.0, 1.5 ...).
        m84::Arpeggiator arp;
        arp.prepare (sr);
        m84::ArpParams ap;
        ap.on = true; ap.rate = 1; ap.gate = 0.5f;
        const double bpmT = 100.0, spb = 60.0 / bpmT * sr;
        double ppqT = 0.3;
        std::vector<double> stepBeats;
        for (int pos = 0; pos < (int) (2.0 * sr); pos += block)
        {
            juce::MidiBuffer midi;
            if (pos == 0) midi.addEvent (juce::MidiMessage::noteOn (1, 48, 0.9f), 0);
            arp.process (midi, block, ap, bpmT, ppqT, true);
            for (const auto meta : midi)
                if (meta.getMessage().isNoteOn())
                    stepBeats.push_back (ppqT + meta.samplePosition / spb);
            ppqT += block / spb;
        }
        double worst = 0.0;
        for (auto b : stepBeats) worst = std::max (worst, std::abs (b * 2.0 - std::round (b * 2.0)) * 0.5 * spb);
        const bool firstOk = ! stepBeats.empty() && std::abs (stepBeats[0] - 0.5) < 0.001;
        std::printf ("arp (host playing): %d steps, first at beat %.3f (expect 0.500), worst grid error %.2f samples  %s\n",
                     (int) stepBeats.size(), stepBeats.empty() ? -1.0 : stepBeats[0], worst, firstOk && worst <= 1.0 ? "ok" : "OFF GRID!");
        ok = ok && firstOk && worst <= 1.0;
    }

    auto renderWith = [&] (const std::vector<std::pair<const char*, float>>& overrides, std::vector<int> notes, double secs)
    {
        Midnight84AudioProcessor fp;
        fp.setPlayConfigDetails (0, 2, sr, block);
        for (const auto& [id, v] : overrides)
            if (auto* prm = fp.apvts.getParameter (id))
                prm->setValueNotifyingHost (prm->convertTo0to1 (v));
        fp.prepareToPlay (sr, block);
        const int total = (int) (secs * sr);
        juce::AudioBuffer<float> outBuf (2, total), b (2, block);
        for (int pos = 0; pos < total; pos += block)
        {
            const int n = std::min (block, total - pos);
            b.setSize (2, n, false, false, true);
            juce::MidiBuffer midi;
            if (pos == 0)
                for (int nt : notes) midi.addEvent (juce::MidiMessage::noteOn (1, nt, 1.0f), 0);
            fp.processBlock (b, midi);
            for (int ch = 0; ch < 2; ++ch) outBuf.copyFrom (ch, pos, b, ch, 0, n);
        }
        return outBuf;
    };
    auto report = [&] (const char* name, const juce::AudioBuffer<float>& b, float maxPeak)
    {
        bool finite = true;
        for (int ch = 0; ch < 2; ++ch)
            for (int i = 0; i < b.getNumSamples(); ++i)
                finite = finite && std::isfinite (b.getSample (ch, i));
        const float peak = b.getMagnitude (0, b.getNumSamples());
        const bool good = finite && peak > 0.005f && peak < maxPeak;
        std::printf ("%-34s peak %6.2f dBFS  %s\n", name, juce::Decibels::gainToDecibels (peak), good ? "ok" : (finite ? "LEVEL!" : "NaN!"));
        ok = ok && good;
        return peak;
    };

    report ("MS-20 filter, resonance 100%", renderWith ({ { "fltType", 4 }, { "res", 1.0f }, { "cutoff", 600.0f }, { "fltDrive", 1.0f } }, { 36, 48 }, 3.0), 2.0f);
    report ("MS-20 filter, no input (self-osc)", renderWith ({ { "fltType", 4 }, { "res", 1.0f }, { "osc1Level", 0.0f }, { "noise", 0.02f } }, { 48 }, 3.0), 2.0f);
    report ("Poly-mod + ring + sync at max", renderWith ({ { "osc2Level", 0.8f }, { "osc2Sync", 1 }, { "osc2Oct", 1 }, { "pmEnvB", 1.0f },
                                                            { "pmBCut", 1.0f }, { "ring", 1.0f }, { "fltEnv", 0.6f } }, { 40, 52 }, 3.0), 2.0f);
    report ("HPF at 2 kHz", renderWith ({ { "hpf", 2000.0f } }, { 48 }, 2.0), 2.0f);

    {
        // Squash should cut the crest factor (peak vs RMS) of a plucky, dynamic sound.
        auto crest = [] (const juce::AudioBuffer<float>& b)
        {
            const float rms = b.getRMSLevel (0, 0, b.getNumSamples());
            return juce::Decibels::gainToDecibels (b.getMagnitude (0, 0, b.getNumSamples()) / std::max (rms, 1.0e-9f));
        };
        const std::vector<std::pair<const char*, float>> pluck { { "aS", 0.0f }, { "aD", 4.0f }, { "fltEnv", 0.6f }, { "cutoff", 400.0f }, { "master", 0.0f } };
        auto squashed = pluck;
        squashed.push_back ({ "sqDepth", 1.0f });
        const auto a = renderWith (pluck, { 48, 55 }, 2.0);
        const auto b = renderWith (squashed, { 48, 55 }, 2.0);
        report ("Squash at 100%", b, 2.0f);
        juce::ignoreUnused (crest);
        auto win = [] (const juce::AudioBuffer<float>& x, double t0, double t1)
        { return juce::Decibels::gainToDecibels (x.getRMSLevel (0, (int) (t0 * 48000), (int) ((t1 - t0) * 48000))); };
        const float gapA = win (a, 0.0, 0.3) - win (a, 1.4, 1.9);
        const float gapB = win (b, 0.0, 0.3) - win (b, 1.4, 1.9);
        std::printf ("squash: loud-to-quiet gap %.1f dB -> %.1f dB  %s\n", gapA, gapB, gapB < gapA - 6.0f ? "ok" : "NO EFFECT!");
        ok = ok && gapB < gapA - 6.0f;
    }

    {
        // On-screen keyboard (mobile / standalone): a key press must reach the synth.
        Midnight84AudioProcessor kp;
        kp.setPlayConfigDetails (0, 2, sr, block);
        kp.prepareToPlay (sr, block);
        kp.keyboardState.noteOn (1, 48, 0.9f);
        juce::AudioBuffer<float> b (2, block);
        float peak = 0.0f;
        for (int pos = 0; pos < (int) (0.3 * sr); pos += block)
        {
            juce::MidiBuffer midi;
            kp.processBlock (b, midi);
            peak = std::max (peak, b.getMagnitude (0, block));
        }
        kp.keyboardState.allNotesOff (1);
        std::printf ("on-screen keyboard: peak %.2f dBFS  %s\n", juce::Decibels::gainToDecibels (peak), peak > 0.01f ? "ok" : "SILENT!");
        ok = ok && peak > 0.01f;
    }

    {
        // Mobile layout screenshots, one per tab page, at a phone-in-landscape size.
        Midnight84AudioProcessor mp;
        mp.setCurrentProgram (2);
        Midnight84AudioProcessorEditor ed (mp, true);
        ed.setSize (844, 390);
        for (int page = 0; page < 4; ++page)
        {
            ed.showPage (page);
            auto img = ed.createComponentSnapshot (ed.getLocalBounds(), true, 2.0f);
            auto file = outDir.getChildFile ("mobile_page" + juce::String (page + 1) + ".png");
            file.deleteFile();
            if (auto stream = std::unique_ptr<juce::FileOutputStream> (file.createOutputStream()))
                juce::PNGImageFormat().writeImageToStream (img, *stream);
        }
    }

    // Editor screenshot: optional argv[2] names the preset; a held chord fills the scope first.
    {
        int prog = 2;
        if (argc > 2)
            for (int i = 0; i < proc.getNumPrograms(); ++i)
                if (proc.getProgramName (i) == juce::String (argv[2])) prog = i;
        proc.setCurrentProgram (prog);
        proc.prepareToPlay (sr, block);
        juce::AudioBuffer<float> b (2, block);
        for (int pos = 0; pos < (int) (0.6 * sr); pos += block)
        {
            juce::MidiBuffer midi;
            if (pos == 0)
                for (int n : { 41, 53 }) midi.addEvent (juce::MidiMessage::noteOn (1, n, 1.0f), 0);
            proc.processBlock (b, midi);
        }
    }
    {
        std::unique_ptr<juce::AudioProcessorEditor> editor (proc.createEditor());
        editor->setSize (1200, 900);
        auto img = editor->createComponentSnapshot (editor->getLocalBounds(), true, 1.0f);
        juce::PNGImageFormat png;
        auto file = outDir.getChildFile ("editor.png");
        file.deleteFile();
        if (auto stream = std::unique_ptr<juce::FileOutputStream> (file.createOutputStream()))
            png.writeImageToStream (img, *stream);
    }

    std::printf (ok ? "ALL OK\n" : "FAILURES\n");
    return ok ? 0 : 1;
}
