// Renders every factory preset offline, reports level / NaN / CPU stats, writes WAVs,
// and saves a screenshot of the editor. Usage: Midnight84RenderTest <outputDir>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_gui_basics/juce_gui_basics.h>
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

    // Editor screenshot.
    proc.setCurrentProgram (2);
    {
        std::unique_ptr<juce::AudioProcessorEditor> editor (proc.createEditor());
        editor->setSize (1200, 760);
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
