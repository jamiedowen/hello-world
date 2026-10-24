import { useEffect, useState } from 'react';

/**
 * Numeric text input that keeps a local draft while typing (so "12." or "1:3" survive)
 * and commits a parsed value on every change.
 */
export function NumInput({
  value,
  onChange,
  placeholder,
  format = (v) => String(v),
  parse = (t) => {
    const n = Number(t.replace(',', '.'));
    return t.trim() === '' || Number.isNaN(n) ? undefined : n;
  },
  mode = 'decimal',
  className = 'set-input',
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  format?: (v: number) => string;
  parse?: (t: string) => number | undefined;
  mode?: 'decimal' | 'numeric' | 'text';
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value === undefined ? '' : format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value === undefined ? '' : format(value));
  }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      className={className}
      inputMode={mode}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}
