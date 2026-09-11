import * as React from "react";

type Listener = () => void;

// Module-level, not component state — `BreadcrumbBar` (one instance, in the
// shell) and every page that registers a label both need to see the same
// data. `breadcrumbs.ts`'s BREADCRUMB_LABELS stays the static segment->label
// table; this is the dynamic per-entity overlay it deliberately doesn't do
// (see that file's own "no per-entity name fetching" comment) — a page opts
// in explicitly via useBreadcrumbLabel instead of the bar fetching anything
// itself.
//
// `snapshot` is always replaced with a new Map, never mutated in place —
// useSyncExternalStore bails out of re-rendering when getSnapshot returns a
// reference `Object.is`-equal to the previous one, so mutating one shared
// Map here would fire listeners that then no-op.
let snapshot: ReadonlyMap<string, string> = new Map();
const listeners = new Set<Listener>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setLabel(href: string, label: string): void {
  const next = new Map(snapshot);
  next.set(href, label);
  snapshot = next;
  emitChange();
}

function clearLabel(href: string): void {
  if (!snapshot.has(href)) {
    return;
  }
  const next = new Map(snapshot);
  next.delete(href);
  snapshot = next;
  emitChange();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReadonlyMap<string, string> {
  return snapshot;
}

/** Read side, consumed by `BreadcrumbBar` to resolve a trail segment's href
 * to a registered label instead of dropping it. */
export function useBreadcrumbLabels(): ReadonlyMap<string, string> {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Write side — a page calls this with its own id segment's full href and a
 * human label (e.g. an entity's name) once the data is available. Cleared
 * on unmount/href-or-label change so navigating away never leaves a stale
 * label behind for an unrelated route that happens to reuse the same id. */
export function useBreadcrumbLabel(href: string, label: string | undefined): void {
  React.useEffect(() => {
    if (!label) {
      return;
    }
    setLabel(href, label);
    return () => {
      clearLabel(href);
    };
  }, [href, label]);
}
