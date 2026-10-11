#include "Arpeggiator.h"
#include "Parameters.h"

namespace m84
{
void Arpeggiator::prepare (double sampleRate)
{
    sr = sampleRate;
    held.reserve (128);
    pattern.reserve (512);
    scratch.reserve (128);
    out.ensureSize (2048);
    reset();
}

void Arpeggiator::reset()
{
    held.clear();
    freePos = 0.0;
    lastStep = -1;
    counter = 0;
    sounding = -1;
    wasOn = false;
}

int Arpeggiator::nextNote (const ArpParams& p)
{
    // Build the note pattern: sorted (or press order) across the octave range.
    auto& base = scratch;
    base.clear();
    for (const auto& h : held)
        base.push_back (h.note);
    if (p.mode != 4)
        std::sort (base.begin(), base.end());

    pattern.clear();
    for (int o = 0; o < std::max (1, p.octaves); ++o)
        for (int n : base)
            if (n + 12 * o <= 127)
                pattern.push_back (n + 12 * o);

    const int n = (int) pattern.size();
    if (n == 0)
        return -1;

    const int64_t c = counter++;
    switch (p.mode)
    {
        case 1:  return pattern[(size_t) (n - 1 - (int) (c % n))];
        case 2:
        {
            const int period = std::max (1, 2 * n - 2);
            const int k = (int) (c % period);
            return pattern[(size_t) (k < n ? k : period - k)];
        }
        case 3:  return pattern[(size_t) rng.nextInt (n)];
        default: return pattern[(size_t) (c % n)];
    }
}

void Arpeggiator::process (juce::MidiBuffer& midi, int numSamples, const ArpParams& p, double bpm, double ppq, bool playing)
{
    if (! p.on)
    {
        if (wasOn)
        {
            // Switched off: silence the arp's note; incoming MIDI passes through untouched.
            if (sounding >= 0)
                midi.addEvent (juce::MidiMessage::noteOff (1, sounding), 0);
            reset();
        }
        return;
    }
    wasOn = true;

    out.clear();
    const double beats = arpRateBeats()[(size_t) std::clamp (p.rate, 0, (int) arpRateBeats().size() - 1)];
    const double stepSamples = std::max (1.0, beats * 60.0 / std::max (bpm, 1.0) * sr);
    const double startPos = playing ? ppq / beats : freePos;

    // Starting fresh while the host plays: sync to the grid without firing mid-step, so the
    // first note lands on the next boundary (or right now if we're exactly on one).
    if (playing && lastStep < 0)
    {
        const double fl = std::floor (startPos + 1.0e-7);
        lastStep = startPos - fl > 1.0e-6 ? (int64_t) fl : (int64_t) fl - 1;
    }

    auto it = midi.begin();
    for (int s = 0; s < numSamples; ++s)
    {
        bool restart = false;
        for (; it != midi.end() && (*it).samplePosition <= s; ++it)
        {
            const auto m = (*it).getMessage();
            if (m.isNoteOn())
            {
                restart = held.empty() && ! playing; // when stopped, start right away
                held.erase (std::remove_if (held.begin(), held.end(), [&] (const Held& h) { return h.note == m.getNoteNumber(); }), held.end());
                held.push_back ({ m.getNoteNumber(), m.getFloatVelocity() });
                if (held.size() == 1)
                    counter = 0;
            }
            else if (m.isNoteOff())
            {
                held.erase (std::remove_if (held.begin(), held.end(), [&] (const Held& h) { return h.note == m.getNoteNumber(); }), held.end());
                if (held.empty() && sounding >= 0)
                {
                    out.addEvent (juce::MidiMessage::noteOff (1, sounding), s);
                    sounding = -1;
                }
            }
            else if (m.isAllNotesOff() || m.isAllSoundOff())
            {
                held.clear();
                if (sounding >= 0)
                    out.addEvent (juce::MidiMessage::noteOff (1, sounding), s);
                sounding = -1;
                out.addEvent (m, s);
            }
            else
            {
                out.addEvent (m, s);
            }
        }

        if (restart)
        {
            freePos = -s / stepSamples; // so step 0 starts exactly at this sample
            lastStep = -1;
        }

        // Gate: release the current step's note.
        if (sounding >= 0)
        {
            offCountdown -= 1.0;
            if (offCountdown <= 0.0)
            {
                out.addEvent (juce::MidiMessage::noteOff (1, sounding), s);
                sounding = -1;
            }
        }

        const double pos = playing ? startPos + s / stepSamples : freePos + s / stepSamples;
        const auto step = (int64_t) std::floor (pos + 1.0e-7);
        if (step != lastStep || restart)
        {
            lastStep = step;
            if (! held.empty())
            {
                if (sounding >= 0)
                    out.addEvent (juce::MidiMessage::noteOff (1, sounding), s);
                const int note = nextNote (p);
                if (note >= 0)
                {
                    out.addEvent (juce::MidiMessage::noteOn (1, note, held.back().velocity), s);
                    sounding = note;
                    offCountdown = std::max (1.0, p.gate * stepSamples);
                }
            }
        }
    }

    if (! playing)
        freePos += numSamples / stepSamples;

    midi.swapWith (out);
}
} // namespace m84
