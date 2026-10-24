import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { ExerciseIcon, ExerciseThumb, Stat, TopBar } from '../components/ui';
import { fmtDistance, fmtDuration, fmtWeight, timeAgo } from '../lib/format';
import { push, setTab } from '../lib/nav';
import { getExercise, useStore } from '../lib/store';
import { cardioTotals, recordsIn, streakWeeks, workoutVolume } from '../lib/stats';
import type { Settings, Workout } from '../types';

export function HomeScreen() {
  const workouts = useStore((s) => s.workouts);
  const settings = useStore((s) => s.settings);
  const streak = useMemo(() => streakWeeks(workouts), [workouts]);

  return (
    <div className="screen">
      <TopBar
        title="Home"
        right={
          <button className="icon-btn" onClick={() => push({ name: 'settings' })} aria-label="Settings">
            <Icon name="settings" />
          </button>
        }
      />
      <div className="content">
        {workouts.length > 0 && (
          <div className="card row" style={{ gap: 20 }}>
            <Stat big label="Workouts" value={workouts.length} />
            <Stat big label="Week streak" value={`🔥 ${streak}`} />
          </div>
        )}
        {workouts.length === 0 && (
          <div className="empty">
            <div className="big">💪</div>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 18, marginBottom: 6 }}>No workouts yet</div>
            <p>Log your first workout and it will show up here.</p>
            <button className="btn primary" onClick={() => setTab('workout')}>
              Start a workout
            </button>
          </div>
        )}
        {workouts.map((w) => (
          <WorkoutCard key={w.id} w={w} all={workouts} settings={settings} />
        ))}
      </div>
    </div>
  );
}

function WorkoutCard({ w, all, settings }: { w: Workout; all: Workout[]; settings: Settings }) {
  const records = useMemo(() => recordsIn(w, all).length, [w, all]);
  const cardio = cardioTotals(w);
  const volume = workoutVolume(w);
  return (
    <div className="card tappable" onClick={() => push({ name: 'workout', id: w.id })}>
      <div className="row">
        <ExerciseThumb name={settings.name || 'Me'} />
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{settings.name}</div>
          <div className="small muted">{timeAgo(w.startedAt)}</div>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 17, marginTop: 12 }}>{w.title}</div>
      <div className="stats-row">
        <Stat label="Time" value={fmtDuration((w.endedAt - w.startedAt) / 1000)} />
        {volume > 0 && <Stat label="Volume" value={fmtWeight(volume, settings, 0)} />}
        {cardio.distance > 0 && <Stat label="Distance" value={fmtDistance(cardio.distance, settings)} />}
        {records > 0 && <Stat label="Records" value={<span style={{ color: 'var(--yellow)' }}>🏅 {records}</span>} />}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        {w.exercises.slice(0, 3).map((we) => {
          const ex = getExercise(we.exerciseId);
          return (
            <div key={we.id} className="row small" style={{ padding: '5px 0', gap: 10 }}>
              {ex && <ExerciseIcon ex={ex} size={30} />}
              <span className="muted" style={{ width: 44, flexShrink: 0 }}>
                {we.sets.length} set{we.sets.length > 1 ? 's' : ''}
              </span>
              <span className="ellipsis grow">{ex?.name ?? 'Unknown exercise'}</span>
            </div>
          );
        })}
        {w.exercises.length > 3 && <div className="small muted" style={{ paddingTop: 4 }}>See {w.exercises.length - 3} more exercises</div>}
      </div>
    </div>
  );
}
