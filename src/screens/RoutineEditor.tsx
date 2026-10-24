import { useState } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { Icon } from '../components/Icon';
import { REST_OPTIONS, SetTable } from '../components/SetTable';
import { Sheet, SheetItem, TopBar } from '../components/ui';
import { fmtDuration, uid } from '../lib/format';
import { pop, push } from '../lib/nav';
import { getExercise, getState, useStore } from '../lib/store';
import { lastPerformance, makeWorkoutExercise, newSet, saveRoutine } from '../lib/workout';
import type { Routine, WorkoutExercise, WorkoutSet } from '../types';

export function RoutineEditorScreen({ id }: { id?: string }) {
  const settings = useStore((s) => s.settings);
  const [draft] = useState(() => {
    const existing = id ? getState().routines.find((r) => r.id === id) : undefined;
    return {
      id: existing?.id ?? uid(),
      createdAt: existing?.createdAt ?? Date.now(),
      title: existing?.title ?? '',
      notes: existing?.notes ?? '',
      exercises: (existing?.exercises ?? []).map(
        (re): WorkoutExercise => ({
          id: re.id,
          exerciseId: re.exerciseId,
          restSeconds: re.restSeconds,
          notes: re.notes,
          sets: re.sets.map((s) => ({ ...s, id: uid(), done: false })),
        }),
      ),
    };
  });
  const [title, setTitle] = useState(draft.title);
  const [exercises, setExercises] = useState<WorkoutExercise[]>(draft.exercises);
  const [picker, setPicker] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);

  const update = (weId: string, fn: (we: WorkoutExercise) => WorkoutExercise) => setExercises((list) => list.map((we) => (we.id === weId ? fn(we) : we)));
  const updateSet = (weId: string, i: number, patch: Partial<WorkoutSet>) => update(weId, (we) => ({ ...we, sets: we.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const save = () => {
    const r: Routine = {
      id: draft.id,
      createdAt: draft.createdAt,
      title: title.trim() || 'My Routine',
      notes: draft.notes,
      exercises: exercises.map((we) => ({
        id: we.id,
        exerciseId: we.exerciseId,
        restSeconds: we.restSeconds,
        notes: we.notes,
        sets: we.sets.map(({ kind, weight, reps, distance, duration }) => ({ kind, weight, reps, distance, duration })),
      })),
    };
    saveRoutine(r);
    pop();
  };

  return (
    <div className="screen">
      <TopBar
        left={
          <button className="text-btn" onClick={pop}>
            Cancel
          </button>
        }
        title={id ? 'Edit Routine' : 'Create Routine'}
        center
        right={
          <button className="text-btn" onClick={save} disabled={exercises.length === 0}>
            Save
          </button>
        }
      />
      <div className="content flush" style={{ paddingTop: 0 }}>
        <div style={{ padding: '8px 16px' }}>
          <input className="input title" placeholder="Routine title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {exercises.length === 0 && (
          <div className="empty">
            <div className="big">📋</div>
            Get started by adding an exercise to your routine.
          </div>
        )}
        {exercises.map((we) => {
          const ex = getExercise(we.exerciseId);
          if (!ex) return null;
          return (
            <section key={we.id} className="wo-exercise">
              <div className="head">
                <button className="name" onClick={() => push({ name: 'exercise', id: ex.id })}>
                  {ex.name}
                </button>
                <button className="icon-btn" onClick={() => setMenuFor(we.id)} aria-label="Exercise options">
                  <Icon name="more" />
                </button>
              </div>
              <input className="wo-notes" placeholder="Add routine notes here" value={we.notes ?? ''} onChange={(e) => update(we.id, (x) => ({ ...x, notes: e.target.value }))} />
              <button className="rest-chip" onClick={() => setRestFor(we.id)}>
                <Icon name="timer" size={16} /> Rest Timer: {we.restSeconds ? fmtDuration(we.restSeconds) : 'OFF'}
              </button>
              <SetTable
                plan
                type={ex.type}
                sets={we.sets}
                settings={settings}
                previous={lastPerformance(we.exerciseId)?.sets}
                onChange={(i, p) => updateSet(we.id, i, p)}
                onRemove={(i) => update(we.id, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }))}
              />
              <button
                className="btn block add-set"
                onClick={() =>
                  update(we.id, (x) => {
                    const last = x.sets[x.sets.length - 1];
                    return { ...x, sets: [...x.sets, newSet(last)] };
                  })
                }
              >
                <Icon name="plus" size={18} /> Add Set
              </button>
            </section>
          );
        })}
        <div style={{ padding: 16 }}>
          <button className="btn primary block" onClick={() => setPicker(true)}>
            <Icon name="plus" size={18} /> Add Exercise
          </button>
        </div>
      </div>

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onSelect={(ids) => {
            setExercises((list) => [...list, ...ids.map(makeWorkoutExercise)]);
            setPicker(false);
          }}
        />
      )}
      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)}>
          <SheetItem
            icon="up"
            label="Move Up"
            onClick={() => {
              setExercises((l) => moveItem(l, menuFor, -1));
              setMenuFor(null);
            }}
          />
          <SheetItem
            icon="down"
            label="Move Down"
            onClick={() => {
              setExercises((l) => moveItem(l, menuFor, 1));
              setMenuFor(null);
            }}
          />
          <SheetItem
            icon="trash"
            label="Remove Exercise"
            danger
            onClick={() => {
              setExercises((l) => l.filter((x) => x.id !== menuFor));
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
                update(restFor, (x) => ({ ...x, restSeconds: sec }));
                setRestFor(null);
              }}
            />
          ))}
        </Sheet>
      )}
    </div>
  );
}

function moveItem<T extends { id: string }>(list: T[], id: string, dir: -1 | 1): T[] {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
