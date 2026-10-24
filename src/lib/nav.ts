import { useEffect, useRef, useSyncExternalStore } from 'react';

export type Tab = 'home' | 'workout' | 'exercises' | 'profile';

export type Route =
  | { name: 'exercise'; id: string }
  | { name: 'workout'; id: string; fresh?: boolean }
  | { name: 'routine'; id?: string; fromWorkoutId?: string }
  | { name: 'active' }
  | { name: 'finish' }
  | { name: 'settings' }
  | { name: 'createExercise' };

interface NavState {
  tab: Tab;
  stack: Route[];
}

let nav: NavState = { tab: 'home', stack: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useNav(): NavState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => nav,
  );
}

export function setTab(tab: Tab) {
  nav = { tab, stack: [] };
  emit();
}
export function push(r: Route) {
  nav = { ...nav, stack: [...nav.stack, r] };
  emit();
}
export function replace(r: Route) {
  nav = { ...nav, stack: [...nav.stack.slice(0, -1), r] };
  emit();
}
export function pop() {
  nav = { ...nav, stack: nav.stack.slice(0, -1) };
  emit();
}
/** Remove every route matching the predicate (e.g. close the active workout + finish screens). */
export function removeRoutes(pred: (r: Route) => boolean) {
  nav = { ...nav, stack: nav.stack.filter((r) => !pred(r)) };
  emit();
}

// Hardware back-button handling: overlays (sheets/dialogs/pickers) register a closer.
const backHandlers: { fn: () => void; depth: number }[] = [];

export function useBackHandler(handler: () => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const h = { fn: () => ref.current(), depth: nav.stack.length };
    backHandlers.push(h);
    return () => {
      const i = backHandlers.indexOf(h);
      if (i >= 0) backHandlers.splice(i, 1);
    };
  }, [enabled]);
}

/** Returns true if the back press was consumed. */
export function handleBack(): boolean {
  const h = backHandlers[backHandlers.length - 1];
  // An overlay only handles back if no screen has been pushed on top of it since.
  if (h && h.depth >= nav.stack.length) {
    h.fn();
    return true;
  }
  if (nav.stack.length) {
    pop();
    return true;
  }
  if (nav.tab !== 'home') {
    setTab('home');
    return true;
  }
  return false;
}
