import { useMemo, useRef, useState } from 'react';
import { BodyMap, intensityFromSplit } from '../components/BodyMap';
import { BarChart } from '../components/Charts';
import { Icon } from '../components/Icon';
import { BackButton, Confirm, ExerciseIcon, ExerciseThumb, Segmented, Stat, Toggle, TopBar } from '../components/ui';
import { MUSCLE_LABELS } from '../data/meta';
import { fmtDistance, fmtDuration, fmtShortDate, fmtWeight, fromDisplayWeight, toDisplayWeight } from '../lib/format';
import { pop, push } from '../lib/nav';
import { RECORD_LABELS, fmtRecord, recentPrs, recordIndex, recordKeysFor } from '../lib/records';
import { exportData, getExercise, importData, setState, useStore } from '../lib/store';
import { cardioTotals, muscleSplit, totalReps, weekStart, workoutVolume } from '../lib/stats';
import { NumInput } from '../components/NumInput';
import { REST_OPTIONS } from '../components/SetTable';
import type { Workout } from '../types';

type Metric = 'duration' | 'volume' | 'reps' | 'distance';

export function ProfileScreen() {
  const workouts = useStore((s) => s.workouts);
  const settings = useStore((s) => s.settings);
  const [metric, setMetric] = useState<Metric>('duration');
  const [range, setRange] = useState<'30' | '90' | 'all'>('30');

  const weeks = useMemo(() => {
    const out: { start: number; list: Workout[] }[] = [];
    let cur = weekStart(Date.now());
    for (let i = 0; i < 12; i++) {
      out.unshift({ start: cur, list: [] });
      cur = weekStart(cur - 3 * 86400000);
    }
    for (const w of workouts) {
      const b = out.find((x) => x.start === weekStart(w.startedAt));
      if (b) b.list.push(w);
    }
    return out;
  }, [workouts]);

  const value = (list: Workout[]) => {
    switch (metric) {
      case 'duration':
        return list.reduce((a, w) => a + (w.endedAt - w.startedAt) / 1000, 0);
      case 'volume':
        return list.reduce((a, w) => a + workoutVolume(w), 0);
      case 'reps':
        return list.reduce((a, w) => a + totalReps(w), 0);
      case 'distance':
        return list.reduce((a, w) => a + cardioTotals(w).distance, 0);
    }
  };
  const format = (v: number) => {
    switch (metric) {
      case 'duration':
        return fmtDuration(v);
      case 'volume':
        return fmtWeight(v, settings, 0);
      case 'reps':
        return `${Math.round(v)} reps`;
      case 'distance':
        return fmtDistance(v, settings);
    }
  };

  const split = useMemo(() => {
    const since = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    return muscleSplit(workouts.filter((w) => w.startedAt >= since)).filter((s) => s.muscle !== 'cardio');
  }, [workouts, range]);
  const maxSplit = Math.max(1, ...split.map((s) => s.pct));

  const prCount = useMemo(() => [...recordIndex(workouts).byWorkout.values()].reduce((a, e) => a + e.length, 0), [workouts]);
  const totalTime = workouts.reduce((a, w) => a + (w.endedAt - w.startedAt) / 1000, 0);
  const totalVol = workouts.reduce((a, w) => a + workoutVolume(w), 0);

  return (
    <div className="screen">
      <TopBar
        title="Profile"
        right={
          <button className="icon-btn" onClick={() => push({ name: 'settings' })} aria-label="Settings">
            <Icon name="settings" />
          </button>
        }
      />
      <div className="content">
        <div className="row" style={{ marginBottom: 16 }}>
          <ExerciseThumb name={settings.name || 'Me'} large />
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 20 }}>{settings.name || 'Athlete'}</div>
            <div className="stats-row" style={{ margin: '6px 0 0' }}>
              <Stat label="Workouts" value={workouts.length} />
              <Stat label="Total time" value={fmtDuration(totalTime)} />
              <Stat label="Volume" value={fmtWeight(totalVol, settings, 0)} />
            </div>
          </div>
        </div>

        <button className="card tappable row" style={{ width: '100%', textAlign: 'left' }} onClick={() => push({ name: 'records' })}>
          <span className="pr-icon">🏆</span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Personal Records</div>
            <div className="small muted">{prCount} PRs across {recordIndex(workouts).byExercise.size} exercises</div>
          </div>
          <Icon name="right" />
        </button>

        <div className="card">
          <div className="small muted" style={{ marginBottom: 8 }}>
            Last 12 weeks
          </div>
          <BarChart key={metric} data={weeks.map((w) => ({ label: fmtShortDate(w.start), value: value(w.list) }))} format={format} />
          <div style={{ marginTop: 12 }}>
            <Segmented<Metric>
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'duration', label: 'Duration' },
                { value: 'volume', label: 'Volume' },
                { value: 'reps', label: 'Reps' },
                { value: 'distance', label: 'Distance' },
              ]}
            />
          </div>
        </div>

        <div className="section-title">Calendar</div>
        <div className="card">
          <Calendar workouts={workouts} />
        </div>

        <div className="section-title">Muscle Distribution</div>
        <div className="card">
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: '30 days' },
              { value: '90', label: '3 months' },
              { value: 'all', label: 'All time' },
            ]}
          />
          {split.length === 0 ? (
            <div className="muted small" style={{ textAlign: 'center', padding: 24 }}>
              No strength workouts in this period.
            </div>
          ) : (
            <>
              <div style={{ margin: '16px 0' }}>
                <BodyMap intensity={intensityFromSplit(split)} />
              </div>
              {split.slice(0, 10).map((s) => (
                <div key={s.muscle} style={{ marginBottom: 10 }}>
                  <div className="row between small">
                    <span>{MUSCLE_LABELS[s.muscle]}</span>
                    <span className="muted">{Math.round(s.sets)} sets</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(s.pct / maxSplit) * 100}%` }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Calendar({ workouts }: { workouts: Workout[] }) {
  const [offset, setOffset] = useState(0);
  const base = new Date();
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  base.setMonth(base.getMonth() + offset);
  const month = base.getMonth();
  const year = base.getFullYear();
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (base.getDay() + 6) % 7;
  const trained = new Set(
    workouts
      .filter((w) => {
        const d = new Date(w.startedAt);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .map((w) => new Date(w.startedAt).getDate()),
  );
  const today = new Date();
  const isThisMonth = today.getMonth() === month && today.getFullYear() === year;
  return (
    <>
      <div className="row between" style={{ marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="Previous month">
          <Icon name="back" />
        </button>
        <div style={{ fontWeight: 600 }}>
          {base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          <span className="muted small"> · {trained.size} day{trained.size === 1 ? '' : 's'}</span>
        </div>
        <button className="icon-btn" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next month" style={{ opacity: offset >= 0 ? 0.3 : 1 }}>
          <Icon name="right" />
        </button>
      </div>
      <div className="calendar">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="dow">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`l${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => (
          <div key={i} className={`day ${trained.has(i + 1) ? 'trained' : ''} ${isThisMonth && today.getDate() === i + 1 ? 'today' : ''}`}>
            {i + 1}
          </div>
        ))}
      </div>
    </>
  );
}

export function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const set = (patch: Partial<typeof settings>) => setState((s) => ({ settings: { ...s.settings, ...patch } }));
  const [backup, setBackup] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = (text: string) => {
    try {
      importData(text);
      setMsg('Backup restored ✔');
      setImportText('');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="screen">
      <TopBar left={<BackButton onClick={pop} />} title="Settings" />
      <div className="content">
        <label className="field">
          <span>Your name</span>
          <input className="input" value={settings.name} onChange={(e) => set({ name: e.target.value })} />
        </label>

        <div className="section-title">Units</div>
        <div className="field">
          <span>Weight</span>
          <Segmented value={settings.unit} onChange={(unit) => set({ unit })} options={[{ value: 'kg', label: 'kg' }, { value: 'lbs', label: 'lbs' }]} />
        </div>
        <div className="field">
          <span>Distance</span>
          <Segmented
            value={settings.distanceUnit}
            onChange={(distanceUnit) => set({ distanceUnit })}
            options={[
              { value: 'km', label: 'Kilometres' },
              { value: 'mi', label: 'Miles' },
            ]}
          />
        </div>
        <label className="field">
          <span>Bodyweight ({settings.unit})</span>
          <NumInput
            className="input"
            value={settings.bodyweight === undefined ? undefined : Number(toDisplayWeight(settings.bodyweight, settings).toFixed(1))}
            onChange={(v) => set({ bodyweight: v === undefined ? undefined : fromDisplayWeight(v, settings) })}
            placeholder="Optional"
          />
        </label>

        <div className="section-title">Rest Timer</div>
        <label className="field">
          <span>Default rest time for new exercises</span>
          <select className="select" value={settings.defaultRest} onChange={(e) => set({ defaultRest: Number(e.target.value) })}>
            {REST_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s ? fmtDuration(s) : 'Off'}
              </option>
            ))}
          </select>
        </label>
        <div className="card row between">
          <span>Sound when rest ends</span>
          <Toggle on={settings.restSound} onChange={(restSound) => set({ restSound })} />
        </div>
        <div className="card row between">
          <span>Vibrate when rest ends</span>
          <Toggle on={settings.restVibrate} onChange={(restVibrate) => set({ restVibrate })} />
        </div>

        <div className="section-title">Your Data</div>
        <p className="small muted" style={{ marginTop: 0 }}>
          All data is stored on this device only. Export a backup regularly so you never lose your history.
        </p>
        <button className="btn block" onClick={() => setBackup(exportData())} style={{ marginBottom: 10 }}>
          Export backup
        </button>
        {backup && (
          <div className="card">
            <textarea className="textarea" readOnly rows={6} value={backup} onFocus={(e) => e.target.select()} />
            <button
              className="btn primary block"
              style={{ marginTop: 10 }}
              onClick={() => {
                navigator.clipboard
                  ?.writeText(backup)
                  .then(() => setMsg('Backup copied to clipboard – paste it somewhere safe (e.g. an email or note).'))
                  .catch(() => setMsg('Copy failed – select the text above and copy it manually.'));
              }}
            >
              Copy to clipboard
            </button>
          </div>
        )}
        <div className="card">
          <div className="small muted" style={{ marginBottom: 8 }}>
            Restore from a backup (this replaces current data)
          </div>
          <textarea className="textarea" rows={3} placeholder="Paste backup JSON here" value={importText} onChange={(e) => setImportText(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn grow" onClick={() => fileRef.current?.click()}>
              Choose file
            </button>
            <button className="btn primary grow" disabled={!importText.trim()} onClick={() => doImport(importText)}>
              Restore
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,text/plain"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) doImport(await f.text());
              e.target.value = '';
            }}
          />
        </div>
        {msg && <div className="card small">{msg}</div>}
        <button className="btn block danger" style={{ marginTop: 12 }} onClick={() => setConfirmWipe(true)}>
          Delete all data
        </button>
        <p className="tiny muted" style={{ textAlign: 'center', marginTop: 24 }}>
          RepCount v1.0 · free & offline
        </p>
      </div>
      {confirmWipe && (
        <Confirm
          title="Delete all data?"
          message="All workouts, routines and custom exercises will be permanently deleted."
          confirmLabel="Delete Everything"
          danger
          onCancel={() => setConfirmWipe(false)}
          onConfirm={() => {
            setState({ workouts: [], routines: [], customExercises: [], active: null, rest: null });
            setConfirmWipe(false);
          }}
        />
      )}
    </div>
  );
}

export function RecordsScreen() {
  const workouts = useStore((s) => s.workouts);
  const settings = useStore((s) => s.settings);
  const idx = recordIndex(workouts);
  const recent = recentPrs(idx, 15);
  const all = [...idx.byExercise.entries()]
    .map(([id, rec]) => ({ ex: getExercise(id), rec }))
    .filter((x) => x.ex)
    .sort((a, b) => b.rec.sessions - a.rec.sessions || a.ex!.name.localeCompare(b.ex!.name));

  return (
    <div className="screen">
      <TopBar left={<BackButton onClick={pop} />} title="Personal Records" />
      <div className="content">
        {all.length === 0 && (
          <div className="empty">
            <div className="big">🏆</div>
            Your best lifts, longest runs and set records will show up here once you log some workouts.
          </div>
        )}
        {recent.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 0 }}>
              Recent PRs
            </div>
            <div className="card">
              {recent.map((r, i) => (
                <div key={i} className="record-row" role="button" onClick={() => push({ name: 'workout', id: r.workoutId })}>
                  <ExerciseIcon ex={r.exercise} size={34} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="ellipsis">{r.exercise.name}</div>
                    <div className="tiny muted">
                      {RECORD_LABELS[r.key]} · {fmtShortDate(r.date)}
                    </div>
                  </div>
                  <span className="pr-badge">🏆 {fmtRecord(r.key, r.value, r.exercise, settings)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {all.length > 0 && <div className="section-title">All Exercises</div>}
        {all.map(({ ex, rec }) => {
          const keys = recordKeysFor(ex!.type).filter((k) => rec.best[k]).slice(0, 3);
          return (
            <div key={ex!.id} className="card tappable" onClick={() => push({ name: 'exercise', id: ex!.id, tab: 1 })}>
              <div className="row">
                <ExerciseIcon ex={ex!} size={40} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 600 }}>
                    {ex!.name}
                  </div>
                  <div className="tiny muted">
                    {rec.sessions} session{rec.sessions === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div className="stats-row" style={{ marginBottom: 0 }}>
                {keys.map((k) => (
                  <Stat key={k} label={RECORD_LABELS[k]} value={fmtRecord(k, rec.best[k]!.value, ex!, settings)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
