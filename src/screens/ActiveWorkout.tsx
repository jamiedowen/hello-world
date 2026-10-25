import { memo, useMemo, useState } from 'react';
import { BackButton, Confirm, ExerciseIcon, Sheet, SheetItem, TopBar } from '../components/ui';
import { Icon } from '../components/Icon';
import { ExercisePicker } from '../components/ExercisePicker';
import { REST_OPTIONS, SetTable, fillFromPrevious } from '../components/SetTable';
import { fmtClock, fmtDuration, fmtWeight } from '../lib/format';
import { tap } from '../lib/native';
import { pop, push, removeRoutes } from '../lib/nav';
import { getExercise, useStore } from '../lib/store';
import { livePrSets, recordIndex } from '../lib/records';
import { completedSets, workoutVolume } from '../lib/stats';
import { useNow } from '../lib/useNow';
import {
  addExercisesToActive,
  adjustRest,
  discardWorkout,
  lastPerformance,
  makeWorkoutExercise,
  newSet,
  startRest,
  stopRest,
  updateActive,
} from '../lib/workout';
import type { Settings, WorkoutExercise, WorkoutSet } from '../types';

// Store updates for the in-progress workout. Module-level so they're stable between renders.
const updateExercise = (id: string, fn: (we: WorkoutExercise) => WorkoutExercise) =>
  updateActive((a) => ({ ...a, exercises: a.exercises.map((we) => (we.id === id ? fn(we) : we)) }));

const updateSet = (weId: string, i: number, patch: Partial<WorkoutSet>) =>
  updateExercise(weId, (we) => ({ ...we, sets: we.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

function toggleSet(we: WorkoutExercise, i: number, prev: WorkoutSet | undefined, settings: Settings) {
  const ex = getExercise(we.exerciseId);
  const set = we.sets[i];
  if (!ex) return;
  tap();
  if (set.done) return updateSet(we.id, i, { done: false });
  updateSet(we.id, i, { ...fillFromPrevious(set, prev, ex.type, settings), done: true });
  if (we.restSeconds > 0) startRest(we.restSeconds, we.exerciseId);
}

function addSet(weId: string) {
  updateExercise(weId, (x) => {
    const last = x.sets[x.sets.length - 1];
    return { ...x, sets: [...x.sets, newSet(last && { weight: last.weight, reps: last.reps, distance: last.distance, duration: last.duration })] };
  });
}

/** Ticks every second on its own so the rest of the screen doesn't re-render with the clock. */
function Elapsed({ since }: { since: number }) {
  const now = useNow();
  return <>{fmtClock((now - since) / 1000)}</>;
}

function RestBar() {
  const rest = useStore((s) => s.rest);
  const now = useNow(250, !!rest);
  if (!rest) return null;
  const left = Math.max(0, (rest.endsAt - now) / 1000);
  return (
    <div className="rest-bar">
      <div className="progress" style={{ width: `${(left / rest.total) * 100}%` }} />
      <button className="btn small" onClick={() => adjustRest(-15)}>
        -15
      </button>
      <div className="rest-time">{fmtClock(left)}</div>
      <button className="btn small" onClick={() => adjustRest(15)}>
        +15
      </button>
      <button className="btn small primary" onClick={stopRest}>
        Skip
      </button>
    </div>
  );
}

/** One exercise in the log. Memoised so editing one exercise doesn't re-render the others. */
const ExerciseBlock = memo(function ExerciseBlock({
  we,
  settings,
  previous,
  prIds,
  onMenu,
  onRest,
}: {
  we: WorkoutExercise;
  settings: Settings;
  previous?: WorkoutSet[];
  prIds: string; // comma-joined ids of this exercise's record-breaking sets (a string keeps memo cheap)
  onMenu: (id: string) => void;
  onRest: (id: string) => void;
}) {
  const ex = getExercise(we.exerciseId);
  const prSets = useMemo(() => new Set(prIds.split(',')), [prIds]);
  if (!ex) return null;
  return (
    <section className="wo-exercise">
      <div className="head">
        <ExerciseIcon ex={ex} size={36} />
        <button className="name" onClick={() => push({ name: 'exercise', id: ex.id })}>
          {ex.name}
        </button>
        <button className="icon-btn" onClick={() => onMenu(we.id)} aria-label="Exercise options">
          <Icon name="more" />
        </button>
      </div>
      <textarea
        rows={1}
        className="wo-notes"
        placeholder="Add notes here..."
        value={we.notes ?? ''}
        onChange={(e) => updateExercise(we.id, (x) => ({ ...x, notes: e.target.value }))}
      />
      <button className="rest-chip" onClick={() => onRest(we.id)}>
        <Icon name="timer" size={16} /> Rest Timer: {we.restSeconds ? fmtDuration(we.restSeconds) : 'OFF'}
      </button>
      <SetTable
        type={ex.type}
        sets={we.sets}
        settings={settings}
        previous={previous}
        prSets={prSets}
        onChange={(i, patch) => updateSet(we.id, i, patch)}
        onToggle={(i) => toggleSet(we, i, previous?.[i], settings)}
        onRemove={(i) => updateExercise(we.id, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }))}
      />
      <button className="btn block add-set" onClick={() => addSet(we.id)}>
        <Icon name="plus" size={18} /> Add Set
      </button>
    </section>
  );
});

export function ActiveWorkoutScreen() {
  const active = useStore((s) => s.active);
  const settings = useStore((s) => s.settings);
  const workouts = useStore((s) => s.workouts);
  const [picker, setPicker] = useState<null | { replace?: string }>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [manualRest, setManualRest] = useState(false);

  // "Previous" values and record checks only depend on history, not on what you're typing.
  const previous = useMemo(() => {
    const map = new Map<string, WorkoutSet[] | undefined>();
    for (const we of active?.exercises ?? []) if (!map.has(we.exerciseId)) map.set(we.exerciseId, lastPerformance(we.exerciseId)?.sets);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, active?.exercises.map((we) => we.exerciseId).join()]);
  const prSets = useMemo(() => (active ? livePrSets(active, recordIndex(workouts)) : new Set<string>()), [active, workouts]);

  if (!active) return null;

  const move = (id: string, dir: -1 | 1) =>
    updateActive((a) => {
      const i = a.exercises.findIndex((e) => e.id === id);
      const j = i + dir;
      if (j < 0 || j >= a.exercises.length) return a;
      const list = [...a.exercises];
      [list[i], list[j]] = [list[j], list[i]];
      return { ...a, exercises: list };
    });

  return (
    <div className="screen">
      <TopBar
        left={<BackButton icon="down" onClick={pop} />}
        title="Log Workout"
        right={
          <>
            <button className="icon-btn" onClick={() => setManualRest(true)} aria-label="Rest timer">
              <Icon name="timer" />
            </button>
            <button className="btn primary small" onClick={() => push({ name: 'finish' })}>
              Finish
            </button>
          </>
        }
      />
      <div className="wo-stats">
        <div className="stat">
          <div className="label">Duration</div>
          <div className="value" style={{ color: 'var(--accent)' }}>
            <Elapsed since={active.startedAt} />
          </div>
        </div>
        <div className="stat">
          <div className="label">Volume</div>
          <div className="value">{fmtWeight(workoutVolume(active), settings, 0)}</div>
        </div>
        <div className="stat">
          <div className="label">Sets</div>
          <div className="value">{completedSets(active)}</div>
        </div>
      </div>

      <div className="content flush" style={{ paddingTop: 0 }}>
        {active.exercises.length === 0 && (
          <div className="empty">
            <div className="big">🏋️</div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Get started</div>
            Add an exercise to start your workout
          </div>
        )}

        {active.exercises.map((we) => (
          <ExerciseBlock
            key={we.id}
            we={we}
            settings={settings}
            previous={previous.get(we.exerciseId)}
            prIds={we.sets.filter((x) => prSets.has(x.id)).map((x) => x.id).join()}
            onMenu={setMenuFor}
            onRest={setRestFor}
          />
        ))}

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn primary block" onClick={() => setPicker({})}>
            <Icon name="plus" size={18} /> Add Exercise
          </button>
          <button className="btn block danger" onClick={() => setConfirmDiscard(true)}>
            Discard Workout
          </button>
        </div>
      </div>

      <RestBar />

      {picker && (
        <ExercisePicker
          single={!!picker.replace}
          title={picker.replace ? 'Replace Exercise' : 'Add Exercise'}
          onClose={() => setPicker(null)}
          onSelect={(ids) => {
            if (picker.replace) {
              const target = picker.replace;
              updateActive((a) => ({ ...a, exercises: a.exercises.map((we) => (we.id === target ? makeWorkoutExercise(ids[0]) : we)) }));
            } else addExercisesToActive(ids);
            setPicker(null);
          }}
        />
      )}

      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <SheetItem icon="swap" label="Replace Exercise" onClick={() => (setPicker({ replace: menuFor }), setMenuFor(null))} />
          <SheetItem icon="up" label="Move Up" onClick={() => (move(menuFor, -1), setMenuFor(null))} />
          <SheetItem icon="down" label="Move Down" onClick={() => (move(menuFor, 1), setMenuFor(null))} />
          <SheetItem
            icon="trash"
            label="Remove Exercise"
            danger
            onClick={() => {
              updateActive((a) => ({ ...a, exercises: a.exercises.filter((e) => e.id !== menuFor) }));
              setMenuFor(null);
            }}
          />
        </Sheet>
      )}

      {restFor && (
        <Sheet title="Rest Timer" onClose={() => setRestFor(null)}>
          {REST_OPTIONS.map((sec) => (
            <SheetItem
              key={sec}
              label={sec ? fmtDuration(sec) : 'Off'}
              onClick={() => {
                updateExercise(restFor, (x) => ({ ...x, restSeconds: sec }));
                setRestFor(null);
              }}
            />
          ))}
        </Sheet>
      )}

      {manualRest && (
        <Sheet title="Start Rest Timer" onClose={() => setManualRest(false)}>
          {REST_OPTIONS.filter(Boolean).map((sec) => (
            <SheetItem
              key={sec}
              icon="timer"
              label={fmtDuration(sec)}
              onClick={() => {
                startRest(sec, active.exercises[active.exercises.length - 1]?.exerciseId ?? '');
                setManualRest(false);
              }}
            />
          ))}
        </Sheet>
      )}

      {confirmDiscard && (
        <Confirm
          title="Discard workout?"
          message="All progress in this workout will be lost."
          confirmLabel="Discard Workout"
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            discardWorkout();
            removeRoutes((r) => r.name === 'active' || r.name === 'finish');
          }}
        />
      )}
    </div>
  );
}
