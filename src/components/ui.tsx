import { useEffect, useState, type ReactNode } from 'react';
import type { Exercise } from '../types';
import { useBackHandler } from '../lib/nav';
import { Icon } from './Icon';

export function TopBar({ title, left, right, center }: { title?: ReactNode; left?: ReactNode; right?: ReactNode; center?: boolean }) {
  return (
    <header className="topbar">
      {(left || center) && <div className="side">{left}</div>}
      <h1 className={center ? 'center' : undefined}>{title}</h1>
      {(right || center) && <div className="side right">{right}</div>}
    </header>
  );
}

export function BackButton({ onClick, icon = 'back' }: { onClick: () => void; icon?: string }) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label="Back">
      <Icon name={icon} />
    </button>
  );
}

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  useBackHandler(onClose);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {title && <div className="sheet-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function SheetItem({ icon, badge, label, danger, onClick }: { icon?: string; badge?: ReactNode; label: ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button className={`sheet-item ${danger ? 'danger' : ''}`} onClick={onClick}>
      {icon && <Icon name={icon} />}
      {badge !== undefined && <span className="badge">{badge}</span>}
      <span>{label}</span>
    </button>
  );
}

export function Confirm({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useBackHandler(onCancel);
  return (
    <div className="backdrop center" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        <div className="actions">
          <button className={`btn block ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="btn block" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, big }: { label: string; value: ReactNode; big?: boolean }) {
  return (
    <div className={`stat ${big ? 'big' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

/** Initials avatar (used for the user's profile). */
export function ExerciseThumb({ name, large }: { name: string; large?: boolean }) {
  return <div className={`thumb ${large ? 'lg' : ''}`}>{initials(name)}</div>;
}

/** Round photo thumbnail for an exercise; falls back to an emoji or initials. */
export function ExerciseIcon({ ex, size = 44 }: { ex: Exercise; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (ex.image && !failed)
    return (
      <div className="thumb photo" style={style}>
        <img src={`ex/${ex.image}/t.webp`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      </div>
    );
  if (ex.emoji)
    return (
      <div className="thumb" style={{ ...style, fontSize: size * 0.5 }}>
        {ex.emoji}
      </div>
    );
  return (
    <div className="thumb" style={{ ...style, fontSize: size * 0.32 }}>
      {initials(ex.name)}
    </div>
  );
}

/** Start/end position photos that alternate, like a looping demo. */
export function ExerciseDemo({ ex }: { ex: Exercise }) {
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => 1 - f), 1100);
    return () => clearInterval(t);
  }, []);
  if (!ex.image || failed) return null;
  return (
    <div className="demo">
      {[0, 1].map((i) => (
        <img
          key={i}
          src={`ex/${ex.image}/${i}.webp`}
          alt={i ? 'End position' : 'Start position'}
          style={{ opacity: frame === i ? 1 : 0 }}
          onError={() => i === 0 && setFailed(true)}
        />
      ))}
    </div>
  );
}
