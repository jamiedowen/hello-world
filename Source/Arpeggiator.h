#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <vector>

namespace m84
{
struct ArpParams
{
    bool on = false;
    int mode = 0;     // Up, Down, Up/Down, Random, As Played
    int rate = 3;     // index into arpRateBeats()
    int octaves = 1;
    float gate = 0.6f;
};

// Classic hardware-style arpeggiator (Poly D / Juno / Prophet). Turns the notes held in a
// block's MIDI into tempo-locked steps, rewriting the buffer in place. Other messages pass through.
class Arpeggiator
{
public:
    void prepare (double sampleRate);
    void reset();
    void process (juce::MidiBuffer& midi, int numSamples, const ArpParams& p, double bpm, double ppq, bool playing);

private:
    int nextNote (const ArpParams& p);

    struct Held { int note; float velocity; };
    std::vector<Held> held;   // in press order
    std::vector<int> pattern, scratch;
    juce::MidiBuffer out;
    juce::Random rng;

    double sr = 44100.0;
    double freePos = 0.0;     // step position while the host is stopped
    int64_t lastStep = -1;
    int64_t counter = 0;
    int sounding = -1;
    double offCountdown = 0.0;
    bool wasOn = false;
};
} // namespace m84
