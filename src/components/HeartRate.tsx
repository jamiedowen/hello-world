import { useState } from 'react';
import { fmtDuration } from '../lib/format';
import { ZONES, connect, disconnect, downsample, hrSummary, pairDevice, useHeartRate } from '../lib/heartRate';
import { push } from '../lib/nav';
import { getState, setState, useStore } from '../lib/store';
import { startHeartRate } from '../lib/workout';
import type { Workout } from '../types';
import { LineChart } from './Charts';
import { NumInput } from './NumInput';
import { Stat } from './ui';

/** Live BPM in the workout header. Tapping it connects, or opens Settings if nothing is paired. */
export function HrChip() {
  const hr = useHeartRate();
  const device = useStore((s) => s.settings.hrDevice);
  if (!device) return null;
  const live = hr.status === 'connected' && hr.bpm;
  return (
    <button className="stat" style={{ textAlign: 'left' }} onClick={() => hr.status !== 'connected' && startHeartRate()} aria-label="Heart rate">
      <div className="label">Heart Rate</div>
      <div className="value">
        <span className={`hr-chip ${live ? 'live' : ''}`}>
          <span className="heart">❤</span>
          {live ? hr.bpm : hr.status === 'connecting' || hr.status === 'reconnecting' ? '…' : '--'}
        </span>
      </div>
    </button>
  );
}

export function HeartRateSettings() {
  const settings = useStore((s) => s.settings);
  const hr = useHeartRate();
  const [busy, setBusy] = useState(false);
  const device = settings.hrDevice;

  const pair = async (showAll: boolean) => {
    setBusy(true);
    const d = await pairDevice(showAll);
    setBusy(false);
    if (!d) return;
    setState((s) => ({ settings: { ...s.settings, hrDevice: d } }));
    connect(d);
  };

  return (
    <>
      <div className="card">
        {device ? (
          <>
            <div className="row">
              <span className={`hr-chip ${hr.status === 'connected' ? 'live' : ''}`}>
                <span className="heart">❤</span>
                {hr.status === 'connected' && hr.bpm ? hr.bpm : '--'}
              </span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{device.name}</div>
                <div className="small muted">
                  {{ idle: 'Not connected', connecting: 'Connecting…', connected: 'Connected', reconnecting: 'Searching… is broadcast on?', error: 'Error' }[hr.status]}
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12, gap: 10 }}>
              {hr.status === 'connected' || hr.status === 'connecting' || hr.status === 'reconnecting' ? (
                <button className="btn grow" onClick={() => disconnect()}>
                  Disconnect
                </button>
              ) : (
                <button className="btn primary grow" onClick={() => connect(device)}>
                  Test connection
                </button>
              )}
              <button
                className="btn grow danger"
                onClick={() => {
                  disconnect();
                  const { hrDevice: _, ...rest } = getState().settings;
                  setState({ settings: rest });
                }}
              >
                Forget
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Show live heart rate during workouts, with average, max and heart-rate zones in your summary.
            </p>
            <button className="btn primary block" disabled={busy} onClick={() => pair(false)}>
              Pair heart rate monitor
            </button>
            <button className="text-btn" style={{ marginTop: 6 }} disabled={busy} onClick={() => pair(true)}>
              Can't see your device? Show all Bluetooth devices
            </button>
          </>
        )}
        {hr.status === 'error' && hr.error && <div className="small danger" style={{ marginTop: 8 }}>{hr.error}</div>}
      </div>
      <details className="card small">
        <summary style={{ fontWeight: 600 }}>Using a Garmin watch (e.g. Instinct 3)</summary>
        <ol style={{ paddingLeft: 18, lineHeight: 1.6, marginBottom: 0 }}>
          <li>On the watch, open the controls menu (hold the light button) and select <b>Broadcast Heart Rate</b>. If it's not in your controls, add it under Settings → Controls.</li>
          <li>While the watch shows it's broadcasting, tap <b>Pair heart rate monitor</b> above and pick your watch.</li>
          <li>Before each workout, turn on broadcast again. RepCount connects automatically when you start a workout and reconnects if the signal drops.</li>
        </ol>
        <p className="muted" style={{ marginBottom: 0 }}>Broadcasting uses extra watch battery, so turn it off after your session.</p>
      </details>
      <label className="field">
        <span>Max heart rate (for zones) – roughly 220 minus your age</span>
        <NumInput className="input" mode="numeric" value={settings.maxHr} onChange={(v) => v && setState((s) => ({ settings: { ...s.settings, maxHr: v } }))} />
      </label>
    </>
  );
}

/** Heart-rate card for the workout summary. */
export function HeartRateCard({ w }: { w: Workout }) {
  const maxHr = useStore((s) => s.settings.maxHr);
  if (!w.hr || w.hr.length < 3) return null;
  const sum = hrSummary(w.hr, maxHr);
  const total = sum.zones.reduce((a, b) => a + b, 0) || 1;
  return (
    <>
      <div className="section-title">Heart Rate</div>
      <div className="card">
        <div className="stats-row" style={{ marginTop: 0 }}>
          <Stat label="Average" value={`${sum.avg} bpm`} />
          <Stat label="Max" value={`${sum.max} bpm`} />
        </div>
        <LineChart
          dots={false}
          color="#e5392f"
          data={downsample(w.hr).map(([t, bpm]) => ({ label: `${Math.round(t / 60)} min`, value: bpm }))}
          format={(v) => `${Math.round(v)} bpm`}
        />
        <div style={{ marginTop: 14 }}>
          {ZONES.map((z, i) => (
            <div key={z.name} className="row small" style={{ marginBottom: 8 }}>
              <span style={{ width: 92 }}>
                <b style={{ color: z.color }}>Z{i + 1}</b> {z.name}
              </span>
              <div className="bar-track grow" style={{ marginTop: 0 }}>
                <div className="bar-fill" style={{ width: `${(sum.zones[i] / total) * 100}%`, background: z.color }} />
              </div>
              <span className="muted" style={{ width: 52, textAlign: 'right' }}>
                {fmtDuration(sum.zones[i])}
              </span>
            </div>
          ))}
        </div>
        <button className="text-btn small" style={{ paddingLeft: 0 }} onClick={() => push({ name: 'settings' })}>
          Zones use a max heart rate of {maxHr} bpm · change
        </button>
      </div>
    </>
  );
}
