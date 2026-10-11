#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

// Small, allocation-free DSP building blocks used by the voices.
namespace m84
{
constexpr float kPi = 3.14159265358979f;
constexpr float kTwoPi = 2.0f * kPi;

inline float fastTanh (float x) noexcept
{
    // Pade approximation, accurate enough for saturation and cheap per sample.
    x = std::clamp (x, -3.0f, 3.0f);
    const float x2 = x * x;
    return x * (27.0f + x2) / (27.0f + 9.0f * x2);
}

inline float semitonesToRatio (float st) noexcept { return std::exp2 (st * (1.0f / 12.0f)); }

// Band-limited step correction for saw / pulse discontinuities.
inline float polyBlep (float t, float dt) noexcept
{
    if (t < dt)
    {
        t /= dt;
        return t + t - t * t - 1.0f;
    }
    if (t > 1.0f - dt)
    {
        t = (t - 1.0f) / dt;
        return t * t + t + t + 1.0f;
    }
    return 0.0f;
}

enum OscWave { waveSine = 0, waveTriangle, waveSaw, waveSquare };

struct Oscillator
{
    float phase = 0.0f;

    inline float process (int wave, float dt, float pw) noexcept
    {
        float y;
        switch (wave)
        {
            case waveSine:     y = std::sin (kTwoPi * phase); break;
            case waveTriangle: y = 1.0f - 4.0f * std::abs (phase - 0.5f); break;
            case waveSaw:      y = 2.0f * phase - 1.0f - polyBlep (phase, dt); break;
            default:
            {
                y = phase < pw ? 1.0f : -1.0f;
                y += polyBlep (phase, dt);
                float t2 = phase - pw;
                if (t2 < 0.0f) t2 += 1.0f;
                y -= polyBlep (t2, dt);
                break;
            }
        }

        phase += dt;
        if (phase >= 1.0f) phase -= 1.0f;
        return y;
    }
};

struct Noise
{
    uint32_t state = 0x9E3779B9u;

    inline float next() noexcept
    {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        return (float) (int32_t) state * (1.0f / 2147483648.0f);
    }
};

// Zero-delay-feedback 4-pole transistor ladder (Moog / Poly D style) with
// input saturation. Mode: 0 LP24, 1 LP12, 2 BP, 3 HP24.
struct LadderFilter
{
    float s[4] {};

    void reset() noexcept { s[0] = s[1] = s[2] = s[3] = 0.0f; }

    // G = g / (1 + g) with g = tan(pi * fc / fs). k = resonance feedback 0..~4.
    inline float process (float x, float G, float k, float drive, int mode) noexcept
    {
        const float oneMinusG = 1.0f - G;
        const float G2 = G * G;
        const float G4 = G2 * G2;

        const float sigma = G2 * G * s[0] * oneMinusG + G2 * s[1] * oneMinusG + G * s[2] * oneMinusG + s[3] * oneMinusG;
        const float in = x * drive * (mode <= 1 ? (1.0f + 0.5f * k) : 1.0f);
        const float y4est = (G4 * in + sigma) / (1.0f + k * G4);
        const float u = fastTanh (in - k * y4est);

        float v = (u - s[0]) * G;  const float y1 = v + s[0];  s[0] = y1 + v;
        v = (y1 - s[1]) * G;       const float y2 = v + s[1];  s[1] = y2 + v;
        v = (y2 - s[2]) * G;       const float y3 = v + s[2];  s[2] = y3 + v;
        v = (y3 - s[3]) * G;       const float y4 = v + s[3];  s[3] = y4 + v;

        float out;
        switch (mode)
        {
            case 0:  out = y4; break;
            case 1:  out = y2; break;
            case 2:  out = 4.0f * y2 - 8.0f * y3 + 4.0f * y4; break;
            default: out = u - 4.0f * y1 + 6.0f * y2 - 4.0f * y3 + y4; break;
        }
        return out;
    }
};

// Analog-style ADSR: exponential segments that overshoot their targets.
struct Envelope
{
    enum Stage { idle, attack, decay, sustain, release };
    Stage stage = idle;
    float out = 0.0f;

    void setParameters (float a, float d, float s, float r, float sampleRate) noexcept
    {
        constexpr float attackRatio = 0.3f;
        constexpr float decayRatio = 0.0001f;

        attackCoef = coef (a * sampleRate, attackRatio);
        attackBase = (1.0f + attackRatio) * (1.0f - attackCoef);
        decayCoef = coef (d * sampleRate, decayRatio);
        decayBase = (s - decayRatio) * (1.0f - decayCoef);
        releaseCoef = coef (r * sampleRate, decayRatio);
        releaseBase = -decayRatio * (1.0f - releaseCoef);
        sustainLevel = s;
    }

    void noteOn() noexcept  { stage = attack; }
    void noteOff() noexcept { if (stage != idle) stage = release; }
    void reset() noexcept   { stage = idle; out = 0.0f; }
    bool isActive() const noexcept { return stage != idle; }

    inline float next() noexcept
    {
        switch (stage)
        {
            case attack:
                out = attackBase + out * attackCoef;
                if (out >= 1.0f) { out = 1.0f; stage = decay; }
                break;
            case decay:
                out = decayBase + out * decayCoef;
                if (out <= sustainLevel) { out = sustainLevel; stage = sustain; }
                break;
            case sustain:
                out = sustainLevel;
                break;
            case release:
                out = releaseBase + out * releaseCoef;
                if (out <= 0.0f) { out = 0.0f; stage = idle; }
                break;
            case idle:
                break;
        }
        return out;
    }

private:
    static float coef (float samples, float ratio) noexcept
    {
        samples = std::max (samples, 1.0f);
        return std::exp (-std::log ((1.0f + ratio) / ratio) / samples);
    }

    float attackCoef = 0, attackBase = 0, decayCoef = 0, decayBase = 0;
    float releaseCoef = 0, releaseBase = 0, sustainLevel = 1.0f;
};
} // namespace m84
