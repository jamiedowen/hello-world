import { useState } from 'react';
import { BackButton, Confirm, TopBar } from '../components/ui';
import { fmtDuration, fmtWeight, fromLocalInput, toLocalInput } from '../lib/format';
import { pop, push, setTab } from '../lib/nav';
import { useStore } from '../lib/store';
import { completedSets, workoutVolume } from '../lib/stats';
import { finishWorkout } from '../lib/workout';

export function FinishWorkoutScreen() {
  const active = useStore((s) => s.active);
  const settings = useStore((s) => s.settings);
  const [now] = useState(Date.now());
  const [title, setTitle] = useState(active?.title ?? '');
  const [notes, setNotes] = useState(active?.notes ?? '');
  const [start, setStart] = useState(toLocalInput(active?.startedAt ?? now));
  const [durationMin, setDurationMin] = useState(String(Math.max(1, Math.round((now - (active?.startedAt ?? now)) / 60000))));
  const [warn, setWarn] = useState<string | null>(null);

  if (!active) return null;
  const sets = completedSets(active);
  const startedAt = fromLocalInput(start, active.startedAt);
  const endedAt = startedAt + Math.max(0, Number(durationMin) || 0) * 60000;
  const incomplete = active.exercises.reduce((n, we) => n + we.sets.filter((s) => !s.done).length, 0);

  const save = () => {
    const id = finishWorkout({ title, notes, startedAt, endedAt });
    setTab('home');
    if (id) push({ name: 'workout', id, fresh: true });
  };

  return (
    <div className="screen">
      <TopBar
        left={<BackButton onClick={pop} />}
        title="Save Workout"
        right={
          <button
            className="btn primary small"
            onClick={() => {
              if (sets === 0) return setWarn('empty');
              if (incomplete) return setWarn('incomplete');
              save();
            }}
          >
            Save
          </button>
        }
      />
      <div className="content">
        <input className="input title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Workout title" />
        <div className="stats-row" style={{ margin: '16px 0 20px' }}>
          <div className="stat">
            <div className="label">Duration</div>
            <div className="value" style={{ color: 'var(--accent)' }}>
              {fmtDuration((endedAt - startedAt) / 1000)}
            </div>
          </div>
          <div className="stat">
            <div className="label">Volume</div>
            <div className="value">{fmtWeight(workoutVolume(active), settings, 0)}</div>
          </div>
          <div className="stat">
            <div className="label">Sets</div>
            <div className="value">{sets}</div>
          </div>
        </div>
        <label className="field">
          <span>When</span>
          <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>Duration (minutes)</span>
          <input className="input" inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did your workout go? Leave some notes here..." />
        </label>
      </div>
      {warn === 'empty' && (
        <Confirm title="No completed sets" message="Tick off at least one set before saving your workout." confirmLabel="OK" onConfirm={() => setWarn(null)} onCancel={() => setWarn(null)} />
      )}
      {warn === 'incomplete' && (
        <Confirm
          title="Unfinished sets"
          message={`You have ${incomplete} set${incomplete > 1 ? 's' : ''} that ${incomplete > 1 ? "aren't" : "isn't"} ticked off. They will be discarded.`}
          confirmLabel="Save Anyway"
          onConfirm={save}
          onCancel={() => setWarn(null)}
        />
      )}
    </div>
  );
}
