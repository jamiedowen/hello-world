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

// Asymmetric soft clip: even harmonics, like an overdriven op-amp / transistor stage.
inline float asymSat (float x, float bias) noexcept
{
    return fastTanh (x + bias) - fastTanh (bias);
}

// Topology-preserving state-variable filter (Simper / Zavalishin).
struct Svf
{
    float ic1 = 0, ic2 = 0;
    float a1 = 0, a2 = 0, a3 = 0, k = 1.4f;

    void set (float fc, float q, float sampleRate) noexcept
    {
        const float g = std::tan (kPi * std::min (fc, sampleRate * 0.49f) / sampleRate);
        k = 1.0f / q;
        a1 = 1.0f / (1.0f + g * (g + k));
        a2 = g * a1;
        a3 = g * a2;
    }

    void reset() noexcept { ic1 = ic2 = 0.0f; }

    inline void process (float v0, float& lp, float& bp, float& hp) noexcept
    {
        const float v3 = v0 - ic2;
        const float v1 = a1 * ic1 + a2 * v3;
        const float v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2.0f * v1 - ic1;
        ic2 = 2.0f * v2 - ic2;
        lp = v2;
        bp = v1;
        hp = v0 - k * v1 - v2;
    }

    inline float lowpass (float v0) noexcept { float l, b, h; process (v0, l, b, h); return l; }
};

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
        wrapFrac = -1.0f;
        if (phase >= 1.0f)
        {
            phase -= 1.0f;
            wrapFrac = dt > 0.0f ? phase / dt : 0.0f; // how far past the wrap we are, in samples
        }
        return y;
    }

    // Hard sync: restart this oscillator where the master wrapped.
    inline void syncTo (const Oscillator& master, float dt) noexcept
    {
        if (master.wrapFrac >= 0.0f)
            phase = master.wrapFrac * dt;
    }

    float wrapFrac = -1.0f;
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

        // Each transistor stage saturates too, which is where the ladder's growl comes from.
        float v = (u - s[0]) * G;              const float y1 = v + s[0];  s[0] = y1 + v;
        v = (fastTanh (y1) - s[1]) * G;        const float y2 = v + s[1];  s[1] = y2 + v;
        v = (fastTanh (y2) - s[2]) * G;        const float y3 = v + s[2];  s[2] = y3 + v;
        v = (fastTanh (y3) - s[3]) * G;        const float y4 = v + s[3];  s[3] = y4 + v;

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

// Korg MS-20-style 12 dB filter: a state-variable core whose resonant (band-pass) path
// is diode-limited, so high resonance screams and growls instead of whistling clean.
// Past ~95% resonance the damping goes negative and it self-oscillates, held in by the limiter.
struct Ms20Filter
{
    float ic1 = 0, ic2 = 0;

    void reset() noexcept { ic1 = ic2 = 0.0f; }

    // g = tan(pi * fc / fs)
    inline float process (float x, float g, float res, float drive) noexcept
    {
        const float k = 2.0f - 2.1f * res;
        const float a1 = 1.0f / (1.0f + g * (g + k));
        const float a2 = g * a1;
        const float a3 = g * a2;

        const float v0 = fastTanh (x * drive);
        const float v3 = v0 - ic2;
        const float v1 = a1 * ic1 + a2 * v3;
        const float v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2.0f * v1 - ic1;
        ic2 = 2.0f * v2 - ic2;
        ic1 = 1.5f * fastTanh (ic1 * (1.0f / 1.5f)); // the diode limiter
        return v2;
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
