import * as React from "react";

// Recently-visited nav pages — pure client preference data persisted to
// localStorage (same rationale/pattern as use-sidebar-state.ts and
// use-favorites.ts). Recorded automatically on navigation (AppShell calls
// recordRecentPage on pathname change); most-recent-first, deduplicated,
// capped so it stays a quick shortcut list rather than a full history.
const STORAGE_KEY = "premgiri.recentPages.v1";
const MAX_RECENT = 8;

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
    // Storage unavailable — recents stay in-memory for this session.
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

export function recordRecentPage(href: string): void {
  ensureHydrated();
  const next = [href, ...snapshot.filter((existing) => existing !== href)].slice(0, MAX_RECENT);
  snapshot = next;
  persist();
  emitChange();
}

/** Read side — recently visited hrefs, most-recent first. */
export function useRecentPages(): string[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
