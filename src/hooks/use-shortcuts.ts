import * as React from "react";

import { SHORTCUT_DEFINITIONS } from "@/config/shortcuts";

const RESERVED_IDS = new Set(
  SHORTCUT_DEFINITIONS.filter((definition) => definition.isReserved).map((definition) => definition.id)
);

// User-customized keybinding overrides — pure client preference data
// persisted to localStorage, same pattern as use-favorites.ts/
// use-sidebar-state.ts. Stores only the ids that have been changed from
// their factory default; SHORTCUT_DEFINITIONS itself is never mutated, so a
// future app update that changes a default only affects users who never
// rebound that particular shortcut.
const STORAGE_KEY = "premgiri.shortcuts.v1";

export type ShortcutOverrides = Record<string, string>;

let snapshot: ShortcutOverrides = {};
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): ShortcutOverrides {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: ShortcutOverrides = {};
    for (const [id, combo] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof combo === "string") {
        result[id] = combo;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") {
    return;
  }
  snapshot = readStorage();
  hydrated = true;
}

function persist(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage unavailable — overrides stay in-memory for this session.
  }
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ShortcutOverrides {
  ensureHydrated();
  return snapshot;
}

const SERVER_SNAPSHOT: ShortcutOverrides = {};

function getServerSnapshot(): ShortcutOverrides {
  return SERVER_SNAPSHOT;
}

export function setShortcutBinding(id: string, combo: string): void {
  if (RESERVED_IDS.has(id)) {
    // Reserved shortcuts can never be rebound — see ShortcutDefinition.isReserved.
    return;
  }
  ensureHydrated();
  snapshot = { ...snapshot, [id]: combo };
  persist();
  emitChange();
}

export function resetShortcutBinding(id: string): void {
  ensureHydrated();
  if (!(id in snapshot)) {
    return;
  }
  const next = { ...snapshot };
  delete next[id];
  snapshot = next;
  persist();
  emitChange();
}

export function resetAllShortcutBindings(): void {
  ensureHydrated();
  snapshot = {};
  persist();
  emitChange();
}

/** Read side — every registered shortcut's currently-effective combo
 * (override if the user has rebound it, otherwise its factory default),
 * keyed by id. */
export function useResolvedShortcuts(): Map<string, string> {
  const overrides = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return React.useMemo(() => {
    const resolved = new Map<string, string>();
    for (const definition of SHORTCUT_DEFINITIONS) {
      resolved.set(definition.id, overrides[definition.id] ?? definition.defaultKeys);
    }
    return resolved;
  }, [overrides]);
}

/** Read side for the customization page — the raw override map, so it can
 * tell "customized" apart from "still the default" per row. */
export function useShortcutOverrides(): ShortcutOverrides {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
