import * as React from "react";

// User-starred page shortcuts — pure client preference data persisted to
// localStorage (same rationale/pattern as use-sidebar-state.ts). Stores only
// the href; the Sidebar/Command Palette resolve label+icon from
// ALL_NAV_LEAVES (src/config/navigation.ts) so a renamed nav label never
// goes stale in storage.
const STORAGE_KEY = "premgiri.favorites.v1";

let snapshot: string[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((href): href is string => typeof href === "string") : [];
  } catch {
    return [];
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
    // Storage unavailable — favorites stay in-memory for this session.
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

function getSnapshot(): string[] {
  ensureHydrated();
  return snapshot;
}

const SERVER_SNAPSHOT: string[] = [];

function getServerSnapshot(): string[] {
  return SERVER_SNAPSHOT;
}

export function toggleFavorite(href: string): void {
  ensureHydrated();
  snapshot = snapshot.includes(href) ? snapshot.filter((existing) => existing !== href) : [...snapshot, href];
  persist();
  emitChange();
}

/** Read side — the list of favorited hrefs, in the order they were added. */
export function useFavorites(): string[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
