import { useMemo, useState } from 'react';
import { EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS } from '../data/meta';
import { push, useBackHandler } from '../lib/nav';
import { allExercises, useStore } from '../lib/store';
import type { Equipment, Exercise, Muscle } from '../types';
import { Icon } from './Icon';
import { ExerciseThumb, Sheet, SheetItem, TopBar } from './ui';

export function useExerciseFilter() {
  const custom = useStore((s) => s.customExercises);
  const all = useMemo(() => allExercises(), [custom]); // eslint-disable-line react-hooks/exhaustive-deps
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter(
      (e) =>
        words.every((w) => e.name.toLowerCase().includes(w)) &&
        (!muscle || e.primary === muscle || e.secondary.includes(muscle)) &&
        (!equipment || e.equipment === equipment),
    );
  }, [all, query, muscle, equipment]);
  return { list, query, setQuery, muscle, setMuscle, equipment, setEquipment };
}

export function ExerciseFilters(f: ReturnType<typeof useExerciseFilter>) {
  const [sheet, setSheet] = useState<'muscle' | 'equipment' | null>(null);
  return (
    <>
      <div style={{ padding: '12px 16px 0' }}>
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder="Search exercise" value={f.query} onChange={(e) => f.setQuery(e.target.value)} />
          {f.query && (
            <button onClick={() => f.setQuery('')} aria-label="Clear">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="chips">
        <button className={`chip ${f.equipment ? 'active' : ''}`} onClick={() => setSheet('equipment')}>
          {f.equipment ? EQUIPMENT_LABELS[f.equipment] : 'All Equipment'} ▾
        </button>
        <button className={`chip ${f.muscle ? 'active' : ''}`} onClick={() => setSheet('muscle')}>
          {f.muscle ? MUSCLE_LABELS[f.muscle] : 'All Muscles'} ▾
        </button>
      </div>
      {sheet === 'muscle' && (
        <Sheet title="Muscle Group" onClose={() => setSheet(null)}>
          <SheetItem label="All Muscles" onClick={() => (f.setMuscle(null), setSheet(null))} />
          {MUSCLE_GROUPS.map((m) => (
            <SheetItem key={m} label={MUSCLE_LABELS[m]} onClick={() => (f.setMuscle(m), setSheet(null))} />
          ))}
        </Sheet>
      )}
      {sheet === 'equipment' && (
        <Sheet title="Equipment" onClose={() => setSheet(null)}>
          <SheetItem label="All Equipment" onClick={() => (f.setEquipment(null), setSheet(null))} />
          {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => (
            <SheetItem key={k} label={EQUIPMENT_LABELS[k]} onClick={() => (f.setEquipment(k), setSheet(null))} />
          ))}
        </Sheet>
      )}
    </>
  );
}

export function ExerciseRow({ ex, selected, onClick, onInfo }: { ex: Exercise; selected?: boolean; onClick: () => void; onInfo?: () => void }) {
  return (
    <div className={`list-item ${selected ? 'selected' : ''}`} onClick={onClick} role="button">
      {selected ? (
        <div className="thumb accent">
          <Icon name="check" />
        </div>
      ) : (
        <ExerciseThumb name={ex.name} />
      )}
      <div className="grow">
        <div className="ellipsis" style={{ fontWeight: 600 }}>
          {ex.name}
        </div>
        <div className="small muted">
          {MUSCLE_LABELS[ex.primary]}
          {ex.custom ? ' · Custom' : ''}
        </div>
      </div>
      {onInfo && (
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          aria-label="Exercise info"
        >
          <Icon name="info" size={20} />
        </button>
      )}
    </div>
  );
}

export function ExercisePicker({
  onClose,
  onSelect,
  single,
  title = 'Add Exercise',
}: {
  onClose: () => void;
  onSelect: (ids: string[]) => void;
  single?: boolean;
  title?: string;
}) {
  useBackHandler(onClose);
  const f = useExerciseFilter();
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => {
    if (single) return onSelect([id]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  return (
    <div className="screen modal">
      <TopBar
        title={title}
        left={
          <button className="text-btn" onClick={onClose}>
            Cancel
          </button>
        }
        right={
          <button className="text-btn" onClick={() => push({ name: 'createExercise' })}>
            Create
          </button>
        }
        center
      />
      <ExerciseFilters {...f} />
      <div className="content flush" style={{ paddingTop: 0 }}>
        {f.list.map((ex) => (
          <ExerciseRow
            key={ex.id}
            ex={ex}
            selected={selected.includes(ex.id)}
            onClick={() => toggle(ex.id)}
            onInfo={() => push({ name: 'exercise', id: ex.id })}
          />
        ))}
        {f.list.length === 0 && <div className="empty">No exercises found.</div>}
      </div>
      {!single && selected.length > 0 && (
        <div className="fab-bottom">
          <button className="btn primary block" onClick={() => onSelect(selected)}>
            Add {selected.length} exercise{selected.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
