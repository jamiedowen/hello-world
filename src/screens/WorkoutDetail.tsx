import { useMemo, useState } from 'react';
import { BodyMap, intensityFromSplit } from '../components/BodyMap';
import { Icon } from '../components/Icon';
import { describeSet, setLabels } from '../components/SetTable';
import { BackButton, Confirm, ExerciseIcon, ExerciseThumb, Sheet, SheetItem, Stat, TopBar } from '../components/ui';
import { MUSCLE_LABELS } from '../data/meta';
import { fmtDate, fmtDistance, fmtDuration, fmtNumber, fmtPace, fmtTime, fmtWeight, fromLocalInput, toLocalInput } from '../lib/format';
import { pop, push } from '../lib/nav';
import { getExercise, useStore } from '../lib/store';
import { cardioTotals, comparisonFor, completedSets, exerciseVolume, muscleSplit, recordsIn, totalReps, workoutVolume } from '../lib/stats';
import { deleteWorkout, routineFromWorkout, saveRoutine, saveWorkout } from '../lib/workout';
import type { Workout } from '../types';

export function WorkoutDetailScreen({ id, fresh }: { id: string; fresh?: boolean }) {
  const workouts = useStore((s) => s.workouts);
  const settings = useStore((s) => s.settings);
  const w = workouts.find((x) => x.id === id);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const records = useMemo(() => (w ? recordsIn(w, workouts) : []), [w, workouts]);
  const split = useMemo(() => (w ? muscleSplit([w]) : []), [w]);

  if (!w) return null;

  const volume = workoutVolume(w);
  const cmp = comparisonFor(volume);
  const cardio = cardioTotals(w);
  const number = workouts.length - workouts.findIndex((x) => x.id === w.id);
  const topSplit = split.filter((s) => s.muscle !== 'cardio').slice(0, 8);
  const maxSplit = Math.max(1, ...topSplit.map((s) => s.pct));

  return (
    <div className="screen">
      <TopBar
        left={<BackButton onClick={pop} icon={fresh ? 'close' : 'back'} />}
        title={fresh ? 'Workout Complete' : 'Workout Detail'}
        right={
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Workout options">
            <Icon name="more" />
          </button>
        }
      />
      <div className="content">
        {fresh && (
          <div className="hero">
            <div className="trophy">🏆</div>
            <h2>Great work!</h2>
            <div className="muted">
              This was your {ordinal(number)} workout{settings.name ? `, ${settings.name}` : ''}.
            </div>
          </div>
        )}

        <div className="card">
          <div className="row">
            <ExerciseThumb name={settings.name || 'Me'} />
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 18 }}>{w.title}</div>
              <div className="small muted">
                {fmtDate(w.startedAt)} · {fmtTime(w.startedAt)}
              </div>
            </div>
          </div>
          {w.notes && <p style={{ margin: '12px 0 0', lineHeight: 1.45 }}>{w.notes}</p>}
          <div className="stats-row" style={{ marginTop: 14, marginBottom: 0, flexWrap: 'wrap' }}>
            <Stat label="Duration" value={fmtDuration((w.endedAt - w.startedAt) / 1000)} />
            <Stat label="Volume" value={fmtWeight(volume, settings, 0)} />
            <Stat label="Sets" value={completedSets(w)} />
            {records.length > 0 && (
              <Stat
                label="Records"
                value={
                  <span style={{ color: 'var(--yellow)' }}>
                    🏅 {records.length}
                  </span>
                }
              />
            )}
          </div>
        </div>

        {cmp && (
          <div className="card compare">
            <div className="emoji">{cmp.emoji}</div>
            <div>
              <div className="small muted">You lifted a total of {fmtWeight(volume, settings, 0)}. That's like lifting</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 2 }}>
                {cmp.count >= 1.95 ? `${cmp.count.toFixed(1).replace(/\.0$/, '')} ${cmp.plural}` : `a ${cmp.name}`}!
              </div>
            </div>
          </div>
        )}

        {cardio.distance > 0 && (
          <div className="card compare">
            <div className="emoji">🏃</div>
            <div className="grow">
              <div className="small muted">Cardio</div>
              <div className="stats-row" style={{ margin: '4px 0 0' }}>
                <Stat label="Distance" value={fmtDistance(cardio.distance, settings)} />
                <Stat label="Time" value={fmtDuration(cardio.duration)} />
                <Stat label="Avg Pace" value={fmtPace(cardio.duration, cardio.distance, settings)} />
              </div>
            </div>
          </div>
        )}

        {records.length > 0 && (
          <>
            <div className="section-title">Personal Records</div>
            <div className="card">
              {records.map((r, i) => (
                <div key={i} className="row between" style={{ padding: '6px 0' }}>
                  <span className="ellipsis">{r.exercise.name}</span>
                  <span className="pr-badge">🏅 {r.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {topSplit.length > 0 && (
          <>
            <div className="section-title">Muscles Worked</div>
            <div className="card">
              <BodyMap intensity={intensityFromSplit(split)} />
              <div style={{ marginTop: 16 }}>
                {topSplit.map((s) => (
                  <div key={s.muscle} style={{ marginBottom: 10 }}>
                    <div className="row between small">
                      <span>{MUSCLE_LABELS[s.muscle]}</span>
                      <span className="muted">{Math.round(s.pct)}%</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(s.pct / maxSplit) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="section-title">Workout</div>
        {w.exercises.map((we) => {
          const ex = getExercise(we.exerciseId);
          if (!ex) return null;
          const labels = setLabels(we.sets);
          const vol = exerciseVolume(we);
          return (
            <div key={we.id} className="card tappable" onClick={() => push({ name: 'exercise', id: ex.id })}>
              <div className="row" style={{ marginBottom: 6 }}>
                <ExerciseIcon ex={ex} />
                <div className="grow">
                  <div className="link ellipsis">{ex.name}</div>
                  <div className="small muted">
                    {we.sets.length} sets{vol ? ` · ${fmtWeight(vol, settings, 0)}` : ''}
                  </div>
                </div>
              </div>
              {we.notes && <div className="small muted" style={{ marginBottom: 6 }}>{we.notes}</div>}
              {we.sets.map((s, i) => (
                <div key={s.id} className="set-line">
                  <span className={`idx set-num ${s.kind}`} style={{ height: 'auto', textAlign: 'left' }}>
                    {labels[i]}
                  </span>
                  <span>{describeSet(s, ex.type, settings)}</span>
                  {ex.type === 'distance_duration' && s.distance && s.duration ? (
                    <span className="muted">{fmtPace(s.duration, s.distance, settings)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
        <div className="small muted" style={{ textAlign: 'center', marginTop: 8 }}>
          {fmtNumber(totalReps(w))} total reps
        </div>
      </div>

      {menu && (
        <Sheet onClose={() => setMenu(false)}>
          <SheetItem icon="edit" label="Edit Workout" onClick={() => (setEditing(true), setMenu(false))} />
          <SheetItem
            icon="copy"
            label="Save as Routine"
            onClick={() => {
              saveRoutine(routineFromWorkout(w));
              setMenu(false);
              setToast('Saved as routine');
              setTimeout(() => setToast(null), 2000);
            }}
          />
          <SheetItem icon="trash" label="Delete Workout" danger onClick={() => (setConfirmDelete(true), setMenu(false))} />
        </Sheet>
      )}
      {editing && <EditWorkoutSheet w={w} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <Confirm
          title="Delete workout?"
          message="This can't be undone."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            pop();
            deleteWorkout(w.id);
          }}
        />
      )}
      {toast && (
        <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, textAlign: 'center' }}>
          <span className="tag accent" style={{ padding: '10px 16px', fontSize: 14 }}>
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}

function EditWorkoutSheet({ w, onClose }: { w: Workout; onClose: () => void }) {
  const [title, setTitle] = useState(w.title);
  const [notes, setNotes] = useState(w.notes ?? '');
  const [start, setStart] = useState(toLocalInput(w.startedAt));
  const [dur, setDur] = useState(String(Math.round((w.endedAt - w.startedAt) / 60000)));
  return (
    <Sheet title="Edit Workout" onClose={onClose}>
      <div style={{ padding: '0 16px' }}>
        <label className="field">
          <span>Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>When</span>
          <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>Duration (minutes)</span>
          <input className="input" inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button
          className="btn primary block"
          onClick={() => {
            const startedAt = fromLocalInput(start, w.startedAt);
            saveWorkout({ ...w, title: title.trim() || w.title, notes: notes.trim() || undefined, startedAt, endedAt: startedAt + (Number(dur) || 0) * 60000 });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
