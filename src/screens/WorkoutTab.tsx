import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Confirm, Sheet, SheetItem, TopBar } from '../components/ui';
import { PROGRAMS } from '../data/programs';
import { uid } from '../lib/format';
import { push, setTab } from '../lib/nav';
import { getExercise, useStore } from '../lib/store';
import { deleteRoutine, saveRoutine, startWorkout } from '../lib/workout';
import type { Routine } from '../types';

export function WorkoutTab() {
  const routines = useStore((s) => s.routines);
  const active = useStore((s) => s.active);
  const [menuFor, setMenuFor] = useState<Routine | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Routine | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<Routine | 'empty' | null>(null);

  const begin = (r?: Routine) => {
    if (active) return setConfirmReplace(r ?? 'empty');
    startWorkout(r);
    push({ name: 'active' });
  };

  const copy = (r: Routine, title = r.title): Routine => ({
    id: uid(),
    title,
    notes: r.notes,
    createdAt: Date.now(),
    exercises: r.exercises.map((e) => ({ ...e, id: uid(), sets: e.sets.map((s) => ({ ...s })) })),
  });

  return (
    <div className="screen">
      <TopBar title="Workout" />
      <div className="content">
        <div className="section-title" style={{ marginTop: 0 }}>
          Quick Start
        </div>
        <button className="btn block" style={{ justifyContent: 'flex-start', padding: 14 }} onClick={() => begin()}>
          <Icon name="plus" /> Start Empty Workout
        </button>

        <div className="section-title">My Routines</div>
        <div className="row" style={{ gap: 10, marginBottom: 12 }}>
          <button className="btn grow" onClick={() => push({ name: 'routine' })}>
            <Icon name="list" size={18} /> New Routine
          </button>
          <button className="btn grow" onClick={() => setTab('exercises')}>
            <Icon name="search" size={18} /> Exercises
          </button>
        </div>

        {routines.length === 0 && (
          <div className="card muted small" style={{ textAlign: 'center', padding: 24 }}>
            Routines are workout templates. Create one to start your favourite sessions in a single tap.
          </div>
        )}

        {routines.map((r) => (
          <div key={r.id} className="card">
            <div className="row">
              <div className="grow" onClick={() => push({ name: 'routine', id: r.id })} role="button">
                <div style={{ fontWeight: 700, fontSize: 17 }}>{r.title}</div>
                <div className="small muted ellipsis" style={{ marginTop: 4 }}>
                  {r.exercises.map((e) => getExercise(e.exerciseId)?.name).filter(Boolean).join(', ') || 'No exercises'}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setMenuFor(r)} aria-label="Routine options">
                <Icon name="more" />
              </button>
            </div>
            <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => begin(r)}>
              Start Routine
            </button>
          </div>
        ))}

        <div className="section-title">Premade Routines</div>
        {PROGRAMS.map((p) => {
          const saved = routines.some((r) => r.templateId === p.id);
          return (
            <div key={p.id} className="card">
              <div className="row">
                <div className="thumb" style={{ fontSize: 22 }}>
                  {p.emoji}
                </div>
                <div className="grow">
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{p.title}</div>
                  <div className="small muted">{p.summary}</div>
                </div>
              </div>
              <div className="small muted" style={{ marginTop: 10, lineHeight: 1.45 }}>
                {p.exercises.map((e) => getExercise(e.exerciseId)?.name).filter(Boolean).join(' · ')}
              </div>
              <div className="row" style={{ marginTop: 12, gap: 10 }}>
                <button className="btn grow" disabled={saved} onClick={() => saveRoutine({ ...copy(p), templateId: p.id })}>
                  {saved ? 'Saved ✓' : 'Save'}
                </button>
                <button className="btn primary grow" onClick={() => begin(p)}>
                  Start
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {menuFor && (
        <Sheet title={menuFor.title} onClose={() => setMenuFor(null)}>
          <SheetItem icon="edit" label="Edit Routine" onClick={() => (push({ name: 'routine', id: menuFor.id }), setMenuFor(null))} />
          <SheetItem
            icon="copy"
            label="Duplicate Routine"
            onClick={() => {
              saveRoutine(copy(menuFor, `${menuFor.title} (copy)`));
              setMenuFor(null);
            }}
          />
          <SheetItem icon="trash" label="Delete Routine" danger onClick={() => (setConfirmDelete(menuFor), setMenuFor(null))} />
        </Sheet>
      )}
      {confirmDelete && (
        <Confirm
          title={`Delete "${confirmDelete.title}"?`}
          confirmLabel="Delete Routine"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            deleteRoutine(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
      {confirmReplace && (
        <Confirm
          title="Workout in progress"
          message="You already have a workout in progress. Starting a new one will discard it."
          confirmLabel="Discard & Start New"
          danger
          onCancel={() => setConfirmReplace(null)}
          onConfirm={() => {
            startWorkout(confirmReplace === 'empty' ? undefined : confirmReplace);
            setConfirmReplace(null);
            push({ name: 'active' });
          }}
        />
      )}
    </div>
  );
}
