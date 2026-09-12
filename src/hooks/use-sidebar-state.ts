import * as React from "react";

// localStorage-backed sidebar UI state (rail collapsed/expanded, which
// groups are expanded) — same hand-rolled useSyncExternalStore + module-
// level store shape as use-breadcrumb-label.ts, just persisted to
// localStorage since this needs to survive a refresh. Pure client
// preference data, not business data, so localStorage is the right and
// only persistence mechanism this needs (no DB table).
const STORAGE_KEY = "premgiri.sidebarState.v1";

/** Rail width bounds — the default (256px, Tailwind's `w-64`) comfortably
 * fits a third-level (grandchild) row's indent + label; the drag handle
 * lets a user widen it further for a long third-level label the default
 * width would otherwise truncate. */
export const SIDEBAR_MIN_WIDTH = 224;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_DEFAULT_WIDTH = 256;

interface SidebarState {
  collapsed: boolean;
  expandedGroups: string[];
  /** Expanded-rail width in px, user-adjustable via a drag handle. Not
   * used in collapsed (icon-only) or mobile-drawer mode. */
  width: number;
}

const DEFAULT_STATE: SidebarState = { collapsed: false, expandedGroups: [], width: SIDEBAR_DEFAULT_WIDTH };

function clampWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

let snapshot: SidebarState = DEFAULT_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): SidebarState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<SidebarState>;
    return {
      collapsed: parsed.collapsed === true,
      expandedGroups: Array.isArray(parsed.expandedGroups) ? parsed.expandedGroups.filter((g) => typeof g === "string") : [],
      width: typeof parsed.width === "number" && Number.isFinite(parsed.width) ? clampWidth(parsed.width) : SIDEBAR_DEFAULT_WIDTH,
    };
  } catch {
    return DEFAULT_STATE;
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
    // Storage unavailable (private browsing, quota) — state stays in-memory for this session.
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

function getSnapshot(): SidebarState {
  ensureHydrated();
  return snapshot;
}

function getServerSnapshot(): SidebarState {
  return DEFAULT_STATE;
}

export function setSidebarCollapsed(collapsed: boolean): void {
  ensureHydrated();
  if (snapshot.collapsed === collapsed) {
    return;
  }
  snapshot = { ...snapshot, collapsed };
  persist();
  emitChange();
}

export function setSidebarWidth(width: number): void {
  ensureHydrated();
  const next = clampWidth(width);
  if (snapshot.width === next) {
    return;
  }
  snapshot = { ...snapshot, width: next };
  persist();
  emitChange();
}

export function setGroupExpanded(label: string, expanded: boolean): void {
  ensureHydrated();
  const isExpanded = snapshot.expandedGroups.includes(label);
  if (expanded === isExpanded) {
    return;
  }
  const expandedGroups = expanded
    ? [...snapshot.expandedGroups, label]
    : snapshot.expandedGroups.filter((group) => group !== label);
  snapshot = { ...snapshot, expandedGroups };
  persist();
  emitChange();
}

/** Read side for the Sidebar — `collapsed` (icon-only rail) and which
 * groups the user has expanded, restored from localStorage on mount. */
export function useSidebarState(): SidebarState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
