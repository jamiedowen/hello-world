import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}

/**
 * Renders a long list in chunks: the first `step` items immediately, more as the user scrolls
 * near the bottom. Attach the returned handler to the scroll container's onScroll.
 */
export function useProgressiveList<T>(list: T[], step = 50) {
  const [limit, setLimit] = useState(step);
  useEffect(() => setLimit(step), [list, step]);
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (limit < list.length && el.scrollTop + el.clientHeight > el.scrollHeight - 1200) setLimit((l) => l + step);
  };
  return { visible: list.slice(0, limit), onScroll };
}
