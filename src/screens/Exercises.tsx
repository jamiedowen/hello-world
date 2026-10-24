import { Fragment, useMemo, useState } from 'react';
import { BodyMap } from '../components/BodyMap';
import { LineChart } from '../components/Charts';
import { ExerciseFilters, ExerciseRow, useExerciseFilter } from '../components/ExercisePicker';
import { Icon } from '../components/Icon';
import { describeSet, setLabels } from '../components/SetTable';
import { BackButton, Confirm, ExerciseDemo, ExerciseIcon, Segmented, TopBar } from '../components/ui';
import { EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS, TYPE_LABELS } from '../data/meta';
import { fmtClock, fmtDate, fmtDistance, fmtDuration, fmtShortDate, fmtWeight, toDisplayDistance, toDisplayWeight, uid } from '../lib/format';
import { pop, push } from '../lib/nav';
import { getExercise, setState, useStore } from '../lib/store';
import { bestOf, exerciseHistory, exerciseVolume, oneRepMax, usesDistance, usesReps, usesWeight } from '../lib/stats';
import type { Equipment, Exercise, ExerciseType, Muscle, Settings, WorkoutExercise } from '../types';

export function ExercisesTab() {
  const f = useExerciseFilter();
  let lastLetter = '';
  return (
    <div className="screen">
      <TopBar
        title="Exercises"
        right={
          <button className="text-btn" onClick={() => push({ name: 'createExercise' })}>
            + Custom
          </button>
        }
      />
      <ExerciseFilters {...f} />
      <div className="content flush" style={{ paddingTop: 0 }}>
        {f.list.map((ex) => {
          const letter = ex.name[0].toUpperCase();
          const head = !f.query && letter !== lastLetter;
          lastLetter = letter;
          return (
            <Fragment key={ex.id}>
              {head && <div className="letter-head">{letter}</div>}
              <ExerciseRow ex={ex} onClick={() => push({ name: 'exercise', id: ex.id })} />
            </Fragment>
          );
        })}
        {f.list.length === 0 && <div className="empty">No exercises found.</div>}
      </div>
    </div>
  );
}

type Metric = { key: string; label: string; value: (we: WorkoutExercise, ex: Exercise) => number; format: (v: number) => string };

function metricsFor(ex: Exercise, s: Settings): Metric[] {
  const w = (v: number) => `${Number(toDisplayWeight(v, s).toFixed(1))} ${s.unit}`;
  const best = (we: WorkoutExercise) => bestOf(we.sets, ex.type);
  if (usesWeight(ex.type) && usesReps(ex.type))
    return [
      { key: 'weight', label: 'Heaviest', value: (we) => best(we).weight, format: w },
      { key: '1rm', label: '1RM', value: (we) => best(we).oneRm, format: w },
      { key: 'vol', label: 'Volume', value: (we) => exerciseVolume(we), format: w },
      { key: 'reps', label: 'Reps', value: (we) => we.sets.reduce((a, x) => a + (x.reps ?? 0), 0), format: (v) => `${v} reps` },
    ];
  if (ex.type === 'bodyweight_reps')
    return [
      { key: 'reps', label: 'Most Reps', value: (we) => best(we).reps, format: (v) => `${v} reps` },
      { key: 'total', label: 'Total Reps', value: (we) => we.sets.reduce((a, x) => a + (x.reps ?? 0), 0), format: (v) => `${v} reps` },
    ];
  if (ex.type === 'duration') return [{ key: 'dur', label: 'Best Time', value: (we) => best(we).duration, format: fmtClock }];
  if (ex.type === 'distance_duration')
    return [
      { key: 'dist', label: 'Distance', value: (we) => we.sets.reduce((a, x) => a + (x.distance ?? 0), 0), format: (v) => `${Number(toDisplayDistance(v, s).toFixed(2))} ${s.distanceUnit}` },
      { key: 'time', label: 'Time', value: (we) => we.sets.reduce((a, x) => a + (x.duration ?? 0), 0), format: fmtDuration },
      {
        key: 'pace',
        label: 'Pace',
        value: (we) => {
          const d = toDisplayDistance(we.sets.reduce((a, x) => a + (x.distance ?? 0), 0), s);
          const t = we.sets.reduce((a, x) => a + (x.duration ?? 0), 0);
          return d ? t / d : 0;
        },
        format: (v) => `${fmtClock(v)} /${s.distanceUnit}`,
      },
    ];
  return [
    { key: 'weight', label: 'Heaviest', value: (we) => best(we).weight, format: w },
    { key: 'dist', label: 'Distance', value: (we) => best(we).distance * 1000, format: (v) => `${Math.round(v)} m` },
  ];
}

export function ExerciseDetailScreen({ id }: { id: string }) {
  const workouts = useStore((s) => s.workouts);
  const settings = useStore((s) => s.settings);
  useStore((s) => s.customExercises);
  const ex = getExercise(id);
  const [tab, setTab] = useState<'about' | 'stats' | 'history'>('about');
  const history = useMemo(() => exerciseHistory(workouts, id), [workouts, id]);
  const metrics = ex ? metricsFor(ex, settings) : [];
  const [metric, setMetric] = useState(metrics[0]?.key ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!ex) return null;
  const m = metrics.find((x) => x.key === metric) ?? metrics[0];
  const allSets = history.flatMap((h) => h.we.sets);
  const best = bestOf(allSets, ex.type);
  const intensity: Partial<Record<Muscle, number>> = { [ex.primary]: 1, ...Object.fromEntries(ex.secondary.map((x) => [x, 0.35])) };

  return (
    <div className="screen">
      <TopBar
        left={<BackButton onClick={pop} />}
        title={ex.name}
        right={
          ex.custom ? (
            <button className="icon-btn" onClick={() => setConfirmDelete(true)} aria-label="Delete exercise">
              <Icon name="trash" />
            </button>
          ) : undefined
        }
      />
      <div className="tabs">
        {(['about', 'stats', 'history'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'about' ? 'How To' : t === 'stats' ? 'Summary' : 'History'}
          </button>
        ))}
      </div>
      <div className="content">
        {tab === 'about' && (
          <>
            <ExerciseDemo ex={ex} />
            <div className="row" style={{ marginBottom: 16 }}>
              {!ex.image && <ExerciseIcon ex={ex} size={64} />}
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: 19 }}>{ex.name}</div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {EQUIPMENT_LABELS[ex.equipment]} · {TYPE_LABELS[ex.type]}
                </div>
              </div>
            </div>
            {ex.description && <p style={{ lineHeight: 1.5, marginTop: 0 }}>{ex.description}</p>}
            <div className="card">
              <div className="small muted" style={{ marginBottom: 6 }}>
                Primary
              </div>
              <span className="tag primary">{MUSCLE_LABELS[ex.primary]}</span>
              {ex.secondary.length > 0 && (
                <>
                  <div className="small muted" style={{ margin: '6px 0' }}>
                    Secondary
                  </div>
                  {ex.secondary.map((x) => (
                    <span key={x} className="tag secondary">
                      {MUSCLE_LABELS[x]}
                    </span>
                  ))}
                </>
              )}
              {ex.primary !== 'cardio' && (
                <div style={{ marginTop: 12 }}>
                  <BodyMap intensity={intensity} height={260} />
                </div>
              )}
            </div>
            {ex.instructions.length > 0 && (
              <>
                <div className="section-title">Instructions</div>
                <ol className="steps">
                  {ex.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </>
            )}
            {ex.tips && ex.tips.length > 0 && (
              <>
                <div className="section-title">Tips</div>
                <div className="card">
                  {ex.tips.map((t, i) => (
                    <div key={i} className="row" style={{ alignItems: 'flex-start', padding: '4px 0' }}>
                      <span>💡</span>
                      <span style={{ lineHeight: 1.45 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'stats' && (
          <>
            {history.length === 0 ? (
              <div className="empty">
                <div className="big">📈</div>
                Log this exercise in a workout to see your progress here.
              </div>
            ) : (
              <>
                <Segmented value={m.key} options={metrics.map((x) => ({ value: x.key, label: x.label }))} onChange={setMetric} />
                <div className="card" style={{ marginTop: 12 }}>
                  <LineChart
                    key={m.key}
                    data={history.slice(-20).map((h) => ({ label: fmtShortDate(h.workout.startedAt), value: m.value(h.we, ex) }))}
                    format={m.format}
                  />
                </div>
                <div className="section-title">Personal Records</div>
                <div className="card">
                  {usesWeight(ex.type) && <RecordRow label="Heaviest Weight" value={fmtWeight(best.weight, settings)} />}
                  {usesWeight(ex.type) && usesReps(ex.type) && <RecordRow label="Best 1RM (est.)" value={fmtWeight(best.oneRm, settings)} />}
                  {usesWeight(ex.type) && usesReps(ex.type) && <RecordRow label="Best Set Volume" value={fmtWeight(best.volume, settings)} />}
                  {usesReps(ex.type) && <RecordRow label="Most Reps" value={`${best.reps}`} />}
                  {usesDistance(ex.type) && (
                    <RecordRow label="Longest Distance" value={ex.type === 'weight_distance' ? `${Math.round(best.distance * 1000)} m` : fmtDistance(best.distance, settings)} />
                  )}
                  {(ex.type === 'duration' || ex.type === 'distance_duration') && <RecordRow label="Longest Time" value={fmtClock(best.duration)} />}
                  <RecordRow label="Times Performed" value={`${history.length}`} />
                </div>
                {usesWeight(ex.type) && usesReps(ex.type) && <RepMaxTable sets={allSets} settings={settings} />}
              </>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            {history.length === 0 && <div className="empty">No history yet.</div>}
            {[...history].reverse().map(({ workout, we }) => {
              const labels = setLabels(we.sets);
              return (
                <div key={we.id} className="card tappable" onClick={() => push({ name: 'workout', id: workout.id })}>
                  <div style={{ fontWeight: 600 }}>{workout.title}</div>
                  <div className="small muted" style={{ marginBottom: 6 }}>
                    {fmtDate(workout.startedAt)}
                  </div>
                  {we.sets.map((s, i) => (
                    <div key={s.id} className="set-line">
                      <span className={`idx set-num ${s.kind}`} style={{ height: 'auto', textAlign: 'left' }}>
                        {labels[i]}
                      </span>
                      <span>{describeSet(s, ex.type, settings)}</span>
                      {usesWeight(ex.type) && usesReps(ex.type) && s.weight && s.reps ? (
                        <span className="muted small">1RM {fmtWeight(oneRepMax(s.weight, s.reps), settings)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
      {confirmDelete && (
        <Confirm
          title="Delete custom exercise?"
          message="It will be removed from the library. Past workouts keep their history but will show it as unknown."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            pop();
            setState((s) => ({ customExercises: s.customExercises.filter((c) => c.id !== ex.id) }));
          }}
        />
      )}
    </div>
  );
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row between" style={{ padding: '7px 0' }}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RepMaxTable({ sets, settings }: { sets: WorkoutExercise['sets']; settings: Settings }) {
  const rows = [1, 2, 3, 5, 8, 10, 12].map((reps) => {
    const w = Math.max(0, ...sets.filter((s) => s.done && (s.reps ?? 0) >= reps).map((s) => s.weight ?? 0));
    return { reps, w };
  });
  if (!rows.some((r) => r.w > 0)) return null;
  return (
    <>
      <div className="section-title">Set Records</div>
      <div className="card">
        {rows.map((r) => (
          <RecordRow key={r.reps} label={`${r.reps} Rep Max`} value={r.w ? fmtWeight(r.w, settings) : '-'} />
        ))}
      </div>
    </>
  );
}

export function CreateExerciseScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState<ExerciseType>('weight_reps');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [primary, setPrimary] = useState<Muscle>('chest');
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');

  const save = () => {
    const ex: Exercise = {
      id: `custom_${uid()}`,
      name: name.trim(),
      type,
      equipment,
      primary,
      secondary: secondary.filter((m) => m !== primary),
      description: description.trim(),
      instructions: instructions
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      custom: true,
    };
    setState((s) => ({ customExercises: [...s.customExercises, ex] }));
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
        title="Create Exercise"
        center
        right={
          <button className="text-btn" onClick={save} disabled={!name.trim()}>
            Save
          </button>
        }
      />
      <div className="content">
        <label className="field">
          <span>Exercise Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine Press" />
        </label>
        <label className="field">
          <span>Exercise Type</span>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as ExerciseType)}>
            {(Object.keys(TYPE_LABELS) as ExerciseType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Equipment</span>
          <select className="select" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((t) => (
              <option key={t} value={t}>
                {EQUIPMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Primary Muscle Group</span>
          <select className="select" value={primary} onChange={(e) => setPrimary(e.target.value as Muscle)}>
            {MUSCLE_GROUPS.map((t) => (
              <option key={t} value={t}>
                {MUSCLE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Other Muscles</span>
          <div>
            {MUSCLE_GROUPS.filter((m) => m !== primary).map((m) => (
              <button
                key={m}
                className={`chip ${secondary.includes(m) ? 'active' : ''}`}
                style={{ margin: '0 6px 6px 0' }}
                onClick={() => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}
              >
                {MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Description (optional)</span>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field">
          <span>Instructions (optional, one step per line)</span>
          <textarea className="textarea" rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </label>
      </div>
    </div>
  );
}
