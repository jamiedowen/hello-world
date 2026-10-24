import { useState } from 'react';
import { SET_KIND_LABELS } from '../data/meta';
import { fmtClock, fromDisplayDistance, fromDisplayWeight, parseClock, toDisplayDistance, toDisplayWeight } from '../lib/format';
import type { ExerciseType, SetKind, Settings, WorkoutSet } from '../types';
import { Icon } from './Icon';
import { NumInput } from './NumInput';
import { Sheet, SheetItem } from './ui';

type Field = 'weight' | 'reps' | 'distance' | 'duration';

interface Column {
  field: Field;
  label: string;
  toDisplay: (v: number) => number;
  fromDisplay: (v: number) => number;
  format: (v: number) => string;
  parse?: (t: string) => number | undefined;
  mode: 'decimal' | 'numeric' | 'text';
}

const round = (n: number, dp: number) => String(Number(n.toFixed(dp)));

export function columnsFor(type: ExerciseType, s: Settings): Column[] {
  const id = (v: number) => v;
  const weight = (prefix = ''): Column => ({
    field: 'weight',
    label: prefix + s.unit.toUpperCase(),
    toDisplay: (v) => toDisplayWeight(v, s),
    fromDisplay: (v) => fromDisplayWeight(v, s),
    format: (v) => round(v, 2),
    mode: 'decimal',
  });
  const reps: Column = { field: 'reps', label: 'REPS', toDisplay: id, fromDisplay: id, format: (v) => String(v), mode: 'numeric' };
  const time: Column = { field: 'duration', label: 'TIME', toDisplay: id, fromDisplay: id, format: fmtClock, parse: parseClock, mode: 'text' };
  switch (type) {
    case 'weight_reps':
      return [weight(), reps];
    case 'bodyweight_reps':
      return [reps];
    case 'weighted_bodyweight':
      return [weight('+'), reps];
    case 'assisted_bodyweight':
      return [weight('-'), reps];
    case 'duration':
      return [time];
    case 'distance_duration':
      return [
        {
          field: 'distance',
          label: s.distanceUnit.toUpperCase(),
          toDisplay: (v) => toDisplayDistance(v, s),
          fromDisplay: (v) => fromDisplayDistance(v, s),
          format: (v) => round(v, 2),
          mode: 'decimal',
        },
        time,
      ];
    case 'weight_distance':
      return [weight(), { field: 'distance', label: 'M', toDisplay: (v) => v * 1000, fromDisplay: (v) => v / 1000, format: (v) => round(v, 0), mode: 'numeric' }];
  }
}

export function describeSet(set: Partial<WorkoutSet>, type: ExerciseType, s: Settings): string {
  const cols = columnsFor(type, s);
  const parts = cols
    .filter((c) => set[c.field] !== undefined)
    .map((c) => {
      const v = c.format(c.toDisplay(set[c.field]!));
      if (c.field === 'weight') return `${c.label.startsWith('-') ? '-' : c.label.startsWith('+') ? '+' : ''}${v}${s.unit}`;
      if (c.field === 'reps') return `${v}`;
      if (c.field === 'distance') return `${v}${c.label.toLowerCase()}`;
      return v;
    });
  if (cols.length === 2 && cols[1].field === 'reps' && parts.length === 2) return `${parts[0]} × ${parts[1]}`;
  if (cols.length === 1 && cols[0].field === 'reps' && parts.length) return `${parts[0]} reps`;
  return parts.join(' · ');
}

const KIND_BADGE: Record<SetKind, string> = { normal: '', warmup: 'W', failure: 'F', drop: 'D' };

export function setLabels(sets: { kind: SetKind }[]): string[] {
  let n = 0;
  return sets.map((s) => (s.kind === 'normal' ? String(++n) : KIND_BADGE[s.kind]));
}

export function SetTable({
  type,
  sets,
  settings,
  previous,
  plan,
  onChange,
  onToggle,
  onRemove,
}: {
  type: ExerciseType;
  sets: WorkoutSet[];
  settings: Settings;
  previous?: WorkoutSet[];
  plan?: boolean; // routine editor: no "done" column
  onChange: (index: number, patch: Partial<WorkoutSet>) => void;
  onToggle?: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const cols = columnsFor(type, settings);
  const labels = setLabels(sets);
  const [kindFor, setKindFor] = useState<number | null>(null);
  const three = cols.length === 1;
  const gridStyle = plan ? { gridTemplateColumns: three ? '40px minmax(0, 1fr) 72px' : '40px minmax(0, 1fr) 64px 64px' } : undefined;

  return (
    <div className="set-table">
      <div className={`set-head ${three ? 'three' : ''}`} style={gridStyle}>
        <span>Set</span>
        <span>Previous</span>
        {cols.map((c) => (
          <span key={c.field}>{c.label}</span>
        ))}
        {!plan && (
          <span>
            <Icon name="check" size={16} />
          </span>
        )}
      </div>
      {sets.map((set, i) => {
        const prev = previous?.[i];
        return (
          <div key={set.id} className={`set-row ${three ? 'three' : ''} ${set.done ? 'done' : ''}`} style={gridStyle}>
            <button className={`set-num ${set.kind}`} onClick={() => setKindFor(i)} aria-label="Set type">
              {labels[i]}
            </button>
            <button
              className="prev"
              onClick={() => prev && onChange(i, { weight: prev.weight, reps: prev.reps, distance: prev.distance, duration: prev.duration })}
            >
              {prev ? describeSet(prev, type, settings) : '-'}
            </button>
            {cols.map((c) => (
              <NumInput
                key={c.field}
                ariaLabel={c.label}
                value={set[c.field] === undefined ? undefined : c.toDisplay(set[c.field]!)}
                placeholder={prev?.[c.field] !== undefined ? c.format(c.toDisplay(prev[c.field]!)) : c.field === 'duration' ? '0:00' : '-'}
                format={c.format}
                parse={c.parse}
                mode={c.mode}
                onChange={(v) => onChange(i, { [c.field]: v === undefined ? undefined : c.fromDisplay(v) })}
              />
            ))}
            {!plan && (
              <button className={`check ${set.done ? 'on' : ''}`} onClick={() => onToggle?.(i)} aria-label="Complete set">
                <Icon name="check" size={18} stroke={3} />
              </button>
            )}
          </div>
        );
      })}
      {kindFor !== null && (
        <Sheet title="Select Set Type" onClose={() => setKindFor(null)}>
          {(['warmup', 'normal', 'failure', 'drop'] as SetKind[]).map((k) => (
            <SheetItem
              key={k}
              badge={<span className={`set-num ${k}`}>{k === 'normal' ? '1' : KIND_BADGE[k]}</span>}
              label={SET_KIND_LABELS[k]}
              onClick={() => {
                onChange(kindFor, { kind: k });
                setKindFor(null);
              }}
            />
          ))}
          <SheetItem
            icon="trash"
            label="Remove Set"
            danger
            onClick={() => {
              onRemove(kindFor);
              setKindFor(null);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

/** Copy any blank fields from the previous performance (used when ticking a set with placeholders). */
export function fillFromPrevious(set: WorkoutSet, prev: WorkoutSet | undefined, type: ExerciseType, s: Settings): Partial<WorkoutSet> {
  const patch: Partial<WorkoutSet> = {};
  for (const c of columnsFor(type, s)) {
    if (set[c.field] === undefined && prev?.[c.field] !== undefined) patch[c.field] = prev[c.field];
  }
  return patch;
}

export const REST_OPTIONS = [0, 15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
