#include "Effects.h"
#include "Parameters.h"

namespace m84
{
//==============================================================================
void Drive::prepare (double sampleRate, int maxBlock)
{
    sr = sampleRate;
    oversampler.initProcessing ((size_t) maxBlock);
    dry.setSize (2, maxBlock);
    reset();
}

void Drive::reset()
{
    oversampler.reset();
    toneState[0] = toneState[1] = 0.0f;
    crushHold[0] = crushHold[1] = 0.0f;
    crushCounter[0] = crushCounter[1] = 0;
}

void Drive::process (juce::AudioBuffer<float>& buffer, const FxParams& p)
{
    if (p.drvAmt < 0.001f || p.drvMix < 0.001f)
        return;

    const int channels = std::min (2, buffer.getNumChannels());
    const int maxBlock = dry.getNumSamples();
    const float gain = juce::Decibels::decibelsToGain (p.drvAmt * 36.0f);
    const float comp = 1.0f / (1.0f + p.drvAmt * 2.0f);
    const float toneHz = 200.0f * std::exp2 (p.drvTone * 6.6f);
    const float toneA = 1.0f - std::exp (-kTwoPi * toneHz / (float) sr);

    // Crusher settings (applied at the oversampled rate).
    const float steps = std::exp2 (12.0f - p.drvAmt * 9.0f);
    const int holdLen = 1 + (int) (p.drvAmt * 24.0f);

    juce::dsp::AudioBlock<float> whole (buffer);
    whole = whole.getSubsetChannelBlock (0, (size_t) channels);

    for (int offset = 0; offset < buffer.getNumSamples(); offset += maxBlock)
    {
        const int n = std::min (maxBlock, buffer.getNumSamples() - offset);
        for (int ch = 0; ch < channels; ++ch)
            dry.copyFrom (ch, 0, buffer, ch, offset, n);

        auto block = whole.getSubBlock ((size_t) offset, (size_t) n);
        auto up = oversampler.processSamplesUp (block);

        for (size_t ch = 0; ch < up.getNumChannels(); ++ch)
        {
            float* d = up.getChannelPointer (ch);
            for (size_t i = 0; i < up.getNumSamples(); ++i)
            {
                const float x = d[i];
                float y;
                switch (p.drvType)
                {
                    case 0:  y = (std::tanh (gain * x + 0.3f) - 0.2913126f) * comp; break;
                    case 1:  y = std::clamp (gain * x, -1.0f, 1.0f) * comp; break;
                    case 2:  y = std::sin (gain * x * 1.3f) * comp; break;
                    default:
                    {
                        if (--crushCounter[ch] <= 0)
                        {
                            crushCounter[ch] = holdLen;
                            crushHold[ch] = std::round (x * steps) / steps;
                        }
                        y = crushHold[ch];
                        break;
                    }
                }
                d[i] = y;
            }
        }

        oversampler.processSamplesDown (block);

        for (int ch = 0; ch < channels; ++ch)
        {
            float* w = buffer.getWritePointer (ch, offset);
            const float* dr = dry.getReadPointer (ch);
            float& st = toneState[ch];
            for (int i = 0; i < n; ++i)
            {
                st += (w[i] - st) * toneA;
                w[i] = dr[i] + (st - dr[i]) * p.drvMix;
            }
        }
    }
}

//==============================================================================
void PingPongDelay::prepare (double sampleRate)
{
    sr = sampleRate;
    const auto size = (size_t) (sampleRate * 4.0) + 4;
    lineL.assign (size, 0.0f);
    lineR.assign (size, 0.0f);
    reset();
}

void PingPongDelay::reset()
{
    std::fill (lineL.begin(), lineL.end(), 0.0f);
    std::fill (lineR.begin(), lineR.end(), 0.0f);
    writePos = 0;
    smoothedDelay = -1.0f;
    lpL = lpR = 0.0f;
}

float PingPongDelay::read (const std::vector<float>& line, float delay) const noexcept
{
    const int size = (int) line.size();
    float pos = (float) writePos - delay;
    while (pos < 0.0f) pos += (float) size;
    const int i0 = (int) pos;
    const int i1 = (i0 + 1) % size;
    const float frac = pos - (float) i0;
    return line[(size_t) i0] + (line[(size_t) i1] - line[(size_t) i0]) * frac;
}

void PingPongDelay::process (juce::AudioBuffer<float>& buffer, const FxParams& p, const Transport& t)
{
    if (p.dlyMix < 0.001f)
    {
        if (smoothedDelay >= 0.0f)
            reset();
        return;
    }

    const int size = (int) lineL.size();
    const double beats = delayTimeBeats()[(size_t) p.dlyTime];
    const float target = (float) std::clamp (beats * 60.0 / t.bpm * sr, 1.0, (double) size - 2.0);
    if (smoothedDelay < 0.0f)
        smoothedDelay = target;

    const float toneHz = 400.0f * std::exp2 (p.dlyTone * 5.0f);
    const float a = 1.0f - std::exp (-kTwoPi * toneHz / (float) sr);

    float* L = buffer.getWritePointer (0);
    float* R = buffer.getWritePointer (buffer.getNumChannels() > 1 ? 1 : 0);

    for (int i = 0; i < buffer.getNumSamples(); ++i)
    {
        smoothedDelay += (target - smoothedDelay) * 0.0005f;
        const float rl = read (lineL, smoothedDelay);
        const float rr = read (lineR, smoothedDelay);
        lpL += (rl - lpL) * a;
        lpR += (rr - lpR) * a;

        const float in = (L[i] + R[i]) * 0.5f;
        lineL[(size_t) writePos] = in + lpR * p.dlyFb;
        lineR[(size_t) writePos] = lpL * p.dlyFb;
        if (++writePos >= size) writePos = 0;

        L[i] += rl * p.dlyMix;
        if (R != L) R[i] += rr * p.dlyMix;
    }
}

//==============================================================================
void Pump::process (juce::AudioBuffer<float>& buffer, const FxParams& p, const Transport& t)
{
    const double beats = pumpRateBeats()[(size_t) p.pumpRate];
    const double inc = (t.bpm / 60.0) / beats / sr;

    if (t.playing)
    {
        phase = std::fmod (t.ppq / beats, 1.0);
        if (phase < 0.0) phase += 1.0;
    }

    const int n = buffer.getNumSamples();
    if (p.pumpAmt < 0.001f)
    {
        phase = std::fmod (phase + inc * n, 1.0);
        return;
    }

    for (int i = 0; i < n; ++i)
    {
        const float ph = (float) phase;
        const float duck = std::min (1.0f, ph / 0.02f) * std::exp (-ph * 5.0f);
        const float g = 1.0f - p.pumpAmt * duck;
        for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
            buffer.getWritePointer (ch)[i] *= g;

        phase += inc;
        if (phase >= 1.0) phase -= 1.0;
    }
}

//==============================================================================
void FxChain::prepare (double sampleRate, int maxBlock)
{
    drive.prepare (sampleRate, maxBlock);
    chorus.prepare ({ sampleRate, (juce::uint32) maxBlock, 2 });
    chorus.setCentreDelay (7.0f);
    chorus.setFeedback (0.0f);
    delay.prepare (sampleRate);
    reverb.setSampleRate (sampleRate);
    pump.prepare (sampleRate);
    masterGain.reset (sampleRate, 0.03);
    dcCoef = 1.0f - kTwoPi * 10.0f / (float) sampleRate;
    reset();
}

void FxChain::reset()
{
    drive.reset();
    chorus.reset();
    delay.reset();
    reverb.reset();
    dcX[0] = dcX[1] = dcY[0] = dcY[1] = 0.0f;
}

void FxChain::process (juce::AudioBuffer<float>& buffer, const FxParams& p, const Transport& t)
{
    drive.process (buffer, p);

    if (p.chMix > 0.001f && buffer.getNumChannels() >= 2)
    {
        chorus.setRate (p.chRate);
        chorus.setDepth (p.chDepth);
        chorus.setMix (p.chMix * 0.5f);
        auto block = juce::dsp::AudioBlock<float> (buffer).getSubsetChannelBlock (0, 2);
        chorus.process (juce::dsp::ProcessContextReplacing<float> (block));
    }

    delay.process (buffer, p, t);

    if (p.revMix > 0.001f && buffer.getNumChannels() >= 2)
    {
        juce::Reverb::Parameters rp;
        rp.roomSize = 0.3f + p.revSize * 0.69f;
        rp.damping = p.revDamp;
        rp.wetLevel = p.revMix * 0.45f;
        rp.dryLevel = 0.5f * (1.0f - 0.4f * p.revMix);
        rp.width = 1.0f;
        reverb.setParameters (rp);
        reverb.processStereo (buffer.getWritePointer (0), buffer.getWritePointer (1), buffer.getNumSamples());
    }

    pump.process (buffer, p, t);

    masterGain.setTargetValue (juce::Decibels::decibelsToGain (p.masterDb, -60.0f));
    const int channels = std::min (2, buffer.getNumChannels());
    for (int i = 0; i < buffer.getNumSamples(); ++i)
    {
        const float g = masterGain.getNextValue();
        for (int ch = 0; ch < channels; ++ch)
        {
            float& s = buffer.getWritePointer (ch)[i];
            const float y = s - dcX[ch] + dcCoef * dcY[ch];
            dcX[ch] = s;
            dcY[ch] = y;
            s = y * g;
        }
    }
}
} // namespace m84
