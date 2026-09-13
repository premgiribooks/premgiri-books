import * as React from "react";

// Transient open/closed state for the Command Palette (src/components/layout/
// command-palette.tsx) — not persisted (unlike use-sidebar-state.ts/
// use-favorites.ts/use-recent-pages.ts), since there's nothing to remember
// across reloads. Exists as a shared store, rather than local component
// state, so the TopNavbar's search input (a sibling, not a parent, of
// CommandPalette in AppShell) can open it without prop drilling.
let isOpen = false;
const listeners = new Set<() => void>();

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

function getSnapshot(): boolean {
  return isOpen;
}

function getServerSnapshot(): boolean {
  return false;
}

export function setCommandPaletteOpen(open: boolean): void {
  if (isOpen === open) {
    return;
  }
  isOpen = open;
  emitChange();
}

export function toggleCommandPalette(): void {
  setCommandPaletteOpen(!isOpen);
}

export function openCommandPalette(): void {
  setCommandPaletteOpen(true);
}

export function useCommandPaletteOpen(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
