#include "SynthEngine.h"

namespace m84
{
//==============================================================================
void Voice::prepare (double sampleRate, int seed)
{
    sr = (float) sampleRate;
    rng.setSeed (seed * 7919 + 17);
    noise.state = 0x9E3779B9u + (uint32_t) seed * 2654435761u;
    kill();
}

void Voice::start (int newNote, float vel, bool retrigger, bool glide, const EngineParams& p)
{
    note = newNote;
    targetNote = (float) newNote;
    if (! glide || ! hasPlayed)
        currentNote = targetNote;
    hasPlayed = true;
    keyDown = true;
    sustained = false;

    if (retrigger)
    {
        velocity = vel;

        if (! ampEnv.isActive())
        {
            // Fresh voice: lock phases for a punchy, consistent attack. Unison
            // stacks get spread phases so the supersaw doesn't start as one wave.
            for (int o = 0; o < kNumOscs; ++o)
            {
                const int n = p.osc[(size_t) o].unison;
                for (int u = 0; u < kMaxUnison; ++u)
                    oscs[(size_t) o][(size_t) u].phase = n > 1 ? rng.nextFloat() : 0.0f;
                oscOffset[(size_t) o] = rng.nextFloat() * 2.0f - 1.0f;
            }
            sub.phase = 0.0f;
            cutoffOffset = rng.nextFloat() * 2.0f - 1.0f;
            filterL.reset();
            filterR.reset();
        }

        ampEnv.noteOn();
        filtEnv.noteOn();
    }
}

void Voice::release()
{
    keyDown = false;
    sustained = false;
    ampEnv.noteOff();
    filtEnv.noteOff();
}

void Voice::kill()
{
    ampEnv.reset();
    filtEnv.reset();
    keyDown = false;
    sustained = false;
    note = -1;
}

void Voice::render (float* outL, float* outR, int num, const EngineParams& p,
                    const float* lfo, float bendSemis, float modWheel)
{
    if (! ampEnv.isActive())
        return;

    ampEnv.setParameters (p.aA, p.aD, p.aS, p.aR, sr);
    filtEnv.setParameters (p.fA, p.fD, p.fS, p.fR, sr);
    glideCoef = p.glide > 0.0005f ? std::exp (-3.0f / (p.glide * sr)) : 0.0f;

    // Slow analog pitch wander.
    driftCounter -= num;
    if (driftCounter <= 0)
    {
        driftTarget = rng.nextFloat() * 2.0f - 1.0f;
        driftCounter = (int) (sr * (0.15f + 0.35f * rng.nextFloat()));
    }
    drift += (driftTarget - drift) * std::min (1.0f, (float) num / (sr * 0.3f));
    const float driftSemis = drift * p.analog * 0.12f;

    struct OscRender
    {
        bool on = false;
        int n = 1;
        float ratio[kMaxUnison], gainL[kMaxUnison], gainR[kMaxUnison];
    };
    OscRender ro[kNumOscs];

    for (int o = 0; o < kNumOscs; ++o)
    {
        const auto& op = p.osc[(size_t) o];
        auto& r = ro[o];
        r.on = op.level > 0.0001f;
        if (! r.on) continue;

        r.n = std::clamp (op.unison, 1, kMaxUnison);
        const float base = op.octave * 12.0f + op.semi + op.fine * 0.01f + oscOffset[(size_t) o] * p.analog * 0.08f;
        const float detuneSemis = std::pow (op.detune, 1.5f) * 0.6f;
        const float norm = op.level / std::sqrt ((float) r.n);

        for (int u = 0; u < r.n; ++u)
        {
            const float pos = r.n == 1 ? 0.0f : 2.0f * (float) u / (float) (r.n - 1) - 1.0f;
            r.ratio[u] = semitonesToRatio (base + pos * detuneSemis);
            const float angle = (pos * p.spread + 1.0f) * kPi * 0.25f;
            r.gainL[u] = std::cos (angle) * 1.41421356f * norm;
            r.gainR[u] = std::sin (angle) * 1.41421356f * norm;
        }
    }

    const float subRatio = p.subOct == 0 ? 0.5f : 0.25f;
    const int subWave = p.subWave == 0 ? waveSine : waveSquare;
    const float lfoPitchSemis = p.lfoPitch * p.lfoPitch * 12.0f + modWheel * 0.4f;
    const float lfoCut = std::clamp (p.fltLfo + modWheel * 0.5f, 0.0f, 1.0f) * 3.0f;
    const float cutoffOct = std::log2 (p.cutoff);
    const float velFilter = 1.0f - p.fltVel * (1.0f - velocity);
    const float ampGain = 1.0f - p.ampVel * (1.0f - velocity);
    const float k = p.res * 4.1f;
    const float drive = 1.0f + p.fltDrive * 5.0f;
    const float postGain = 1.0f / (1.0f + p.fltDrive * 1.8f);
    const float maxFc = sr * 0.45f;
    const float invSr = 1.0f / sr;

    for (int i = 0; i < num; ++i)
    {
        currentNote = targetNote + (currentNote - targetNote) * glideCoef;
        const float l = lfo[i];

        const float pitch = currentNote + bendSemis + l * lfoPitchSemis + driftSemis;
        const float baseDt = 440.0f * std::exp2 ((pitch - 69.0f) * (1.0f / 12.0f)) * invSr;

        float sL = 0.0f, sR = 0.0f;
        for (int o = 0; o < kNumOscs; ++o)
        {
            const auto& r = ro[o];
            if (! r.on) continue;
            const auto& op = p.osc[(size_t) o];
            const float pw = std::clamp (op.pw + l * p.lfoPW * 0.45f, 0.03f, 0.97f);
            for (int u = 0; u < r.n; ++u)
            {
                const float s = oscs[(size_t) o][(size_t) u].process (op.wave, std::min (baseDt * r.ratio[u], 0.45f), pw);
                sL += s * r.gainL[u];
                sR += s * r.gainR[u];
            }
        }

        if (p.subLevel > 0.0001f)
        {
            const float s = sub.process (subWave, baseDt * subRatio, 0.5f) * p.subLevel;
            sL += s;
            sR += s;
        }

        if (p.noise > 0.0001f)
        {
            const float n = noise.next() * p.noise * 0.7f;
            sL += n;
            sR += n;
        }

        const float fe = filtEnv.next();
        const float ae = ampEnv.next();

        const float oct = cutoffOct + p.fltEnv * fe * velFilter * 8.0f
                        + p.fltKey * (currentNote - 60.0f) * (1.0f / 12.0f)
                        + l * lfoCut + cutoffOffset * p.analog * 0.15f;
        const float fc = std::clamp (std::exp2 (oct), 16.0f, maxFc);
        const float g = std::tan (kPi * fc * invSr);
        const float G = g / (1.0f + g);

        const float amp = ae * ampGain * postGain;
        outL[i] += filterL.process (sL * 0.35f, G, k, drive, p.fltType) * amp;
        outR[i] += filterR.process (sR * 0.35f, G, k, drive, p.fltType) * amp;

        if (! ampEnv.isActive())
        {
            note = -1;
            break;
        }
    }
}

//==============================================================================
void SynthEngine::prepare (double sampleRate, int)
{
    sr = sampleRate;
    for (int i = 0; i < kMaxVoices; ++i)
        voices[(size_t) i].prepare (sampleRate, i + 1);
    monoStack.clear();
    monoStack.reserve (128);
    lfoPhase = 0.0;
}

void SynthEngine::setTransport (double newBpm, double ppqAtBlockStart, bool isPlaying)
{
    bpm = newBpm > 1.0 ? newBpm : 120.0;
    ppq = ppqAtBlockStart;
    playing = isPlaying;
}

void SynthEngine::allNotesOff()
{
    for (auto& v : voices)
        v.kill();
    monoStack.clear();
}

void SynthEngine::process (juce::AudioBuffer<float>& buffer, const juce::MidiBuffer& midi)
{
    const int n = buffer.getNumSamples();
    float* L = buffer.getWritePointer (0);
    float* R = buffer.getNumChannels() > 1 ? buffer.getWritePointer (1) : nullptr;

    // Tempo-synced LFO locks to the host's bar position while playing.
    if (params.lfoSync && playing && ! params.lfoRetrig)
    {
        const double beats = lfoSyncBeats()[(size_t) params.lfoSyncRate];
        lfoPhase = std::fmod (ppq / beats, 1.0);
        if (lfoPhase < 0.0) lfoPhase += 1.0;
    }

    int pos = 0;
    for (const auto meta : midi)
    {
        const int t = std::clamp (meta.samplePosition, 0, n);
        if (t > pos)
        {
            renderChunk (L, R, pos, t - pos);
            pos = t;
        }
        handleMidi (meta.getMessage());
    }
    if (pos < n)
        renderChunk (L, R, pos, n - pos);
}

void SynthEngine::renderChunk (float* L, float* R, int start, int num)
{
    const float bendSemis = bend * params.bendRange;

    while (num > 0)
    {
        const int len = std::min (num, kChunk);
        computeLfo (len);

        float* l = L + start;
        float* r = R != nullptr ? R + start : nullptr;

        for (auto& v : voices)
        {
            if (! v.isActive()) continue;
            if (r != nullptr)
                v.render (l, r, len, params, lfoBuffer.data(), bendSemis, modWheel);
            else
            {
                float tmp[kChunk] {};
                v.render (l, tmp, len, params, lfoBuffer.data(), bendSemis, modWheel);
            }
        }

        start += len;
        num -= len;
    }
}

void SynthEngine::computeLfo (int num)
{
    double inc;
    if (params.lfoSync)
        inc = (bpm / 60.0) / lfoSyncBeats()[(size_t) params.lfoSyncRate] / sr;
    else
        inc = params.lfoRate / sr;

    for (int i = 0; i < num; ++i)
    {
        const float ph = (float) lfoPhase;
        float v;
        switch (params.lfoWave)
        {
            case 0:  v = std::sin (kTwoPi * ph); break;
            case 1:  v = 1.0f - 4.0f * std::abs (ph - 0.5f); break;
            case 2:  v = 1.0f - 2.0f * ph; break;
            case 3:  v = 2.0f * ph - 1.0f; break;
            case 4:  v = ph < 0.5f ? 1.0f : -1.0f; break;
            default: v = lfoHeld; break;
        }
        lfoBuffer[(size_t) i] = v;

        lfoPhase += inc;
        if (lfoPhase >= 1.0)
        {
            lfoPhase -= 1.0;
            lfoHeld = lfoRandom.nextFloat() * 2.0f - 1.0f;
        }
    }
}

void SynthEngine::handleMidi (const juce::MidiMessage& m)
{
    if (m.isNoteOn())
        noteOn (m.getNoteNumber(), m.getFloatVelocity());
    else if (m.isNoteOff())
        noteOff (m.getNoteNumber());
    else if (m.isPitchWheel())
        bend = (float) (m.getPitchWheelValue() - 8192) / 8192.0f;
    else if (m.isControllerOfType (1))
        modWheel = (float) m.getControllerValue() / 127.0f;
    else if (m.isSustainPedalOn())
        sustainPedal = true;
    else if (m.isSustainPedalOff())
    {
        sustainPedal = false;
        for (auto& v : voices)
            if (v.sustained && ! v.keyDown)
                v.release();
    }
    else if (m.isAllNotesOff() || m.isAllSoundOff())
        allNotesOff();
}

Voice* SynthEngine::findVoiceFor (int note)
{
    const int poly = std::clamp (params.polyphony, 1, kMaxVoices);

    for (int i = 0; i < poly; ++i)
        if (voices[(size_t) i].isActive() && voices[(size_t) i].note == note)
            return &voices[(size_t) i];

    for (int i = 0; i < poly; ++i)
        if (! voices[(size_t) i].isActive())
            return &voices[(size_t) i];

    // Steal: the quietest releasing voice, otherwise the oldest held one.
    Voice* best = nullptr;
    for (int i = 0; i < poly; ++i)
    {
        auto& v = voices[(size_t) i];
        if (v.isReleasing() && (best == nullptr || v.level() < best->level()))
            best = &v;
    }
    if (best != nullptr)
        return best;

    for (int i = 0; i < poly; ++i)
        if (best == nullptr || voices[(size_t) i].age < best->age)
            best = &voices[(size_t) i];
    return best;
}

void SynthEngine::noteOn (int note, float velocity)
{
    bool anyHeld = false;
    for (auto& v : voices)
        anyHeld = anyHeld || (v.isActive() && v.keyDown);

    if (params.lfoRetrig && ! anyHeld)
        lfoPhase = 0.0;

    if (params.voiceMode == 0)
    {
        if (auto* v = findVoiceFor (note))
        {
            v->start (note, velocity, true, params.glide > 0.0005f, params);
            v->age = ++ageCounter;
        }
        return;
    }

    // Mono / Legato: one voice with last-note priority.
    const bool wasHeld = ! monoStack.empty();
    monoStack.erase (std::remove (monoStack.begin(), monoStack.end(), note), monoStack.end());
    monoStack.push_back (note);

    const bool legato = params.voiceMode == 2;
    const bool retrigger = ! (legato && wasHeld);
    const bool glide = params.glide > 0.0005f && (! legato || wasHeld);

    for (size_t i = 1; i < voices.size(); ++i)
        if (voices[i].isActive()) voices[i].release();

    voices[0].start (note, velocity, retrigger, glide, params);
}

void SynthEngine::noteOff (int note)
{
    if (params.voiceMode == 0 || monoStack.empty())
    {
        for (auto& v : voices)
        {
            if (v.isActive() && v.keyDown && v.note == note)
            {
                if (sustainPedal)
                {
                    v.keyDown = false;
                    v.sustained = true;
                }
                else
                    v.release();
            }
        }
        monoStack.erase (std::remove (monoStack.begin(), monoStack.end(), note), monoStack.end());
        return;
    }

    monoStack.erase (std::remove (monoStack.begin(), monoStack.end(), note), monoStack.end());
    auto& v = voices[0];
    if (v.note != note)
        return;

    if (! monoStack.empty())
        v.start (monoStack.back(), v.getVelocity(), false, params.glide > 0.0005f, params);
    else
        v.release();
}
} // namespace m84
