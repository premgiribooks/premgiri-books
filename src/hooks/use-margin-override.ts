import * as React from "react";

import {
  clearMarginOverrideCookie,
  readMarginOverrideCookie,
  writeMarginOverrideCookie,
  type MarginOverride,
} from "@/lib/margin-override-cookie";

// useSyncExternalStore over the cookie (see margin-override-cookie.ts),
// mirroring use-shortcuts.ts's own module-level snapshot + listener set —
// same reasoning: a plain module store survives AppShell's full remount on
// every navigation, where React Context would not.

let snapshot: MarginOverride | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") {
    return;
  }
  snapshot = readMarginOverrideCookie();
  hydrated = true;
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

function getSnapshot(): MarginOverride | null {
  ensureHydrated();
  return snapshot;
}

function getServerSnapshot(): MarginOverride | null {
  return null;
}

export function setMarginOverride(marginPercent: number): void {
  snapshot = writeMarginOverrideCookie(marginPercent);
  hydrated = true;
  emitChange();
}

export function clearMarginOverride(): void {
  clearMarginOverrideCookie();
  snapshot = null;
  hydrated = true;
  emitChange();
}

/** The active override, or `null` when none is set / it has expired. */
export function useMarginOverride(): MarginOverride | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
