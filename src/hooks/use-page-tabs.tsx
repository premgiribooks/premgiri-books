"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useBreadcrumbLabels } from "@/hooks/use-breadcrumb-label";
import { resolvePageTitle } from "@/lib/breadcrumb-trail";
import {
  INITIAL_PAGE_TABS_STATE,
  activateTab,
  closeTab,
  visitPage,
  type PageTabsState,
} from "@/lib/page-tabs-reducer";

export interface PageTab {
  href: string;
  title: string;
}

interface ContentEntry {
  title: string;
  node: React.ReactNode;
}

// Module-level store, not React state/Context — deliberately mirrors
// use-breadcrumb-label.ts's own snapshot + listeners pattern. Every
// page.tsx in this app wraps its own content in <AppShell> directly (there
// is only the root layout.tsx; no route-group layout mounts AppShell once),
// so AppShell — and anything held in ITS OWN component state, including a
// React Context provider nested inside it — is fully unmounted and remounted
// on every single navigation. A plain module-level variable is not: it
// survives for the life of the browser tab regardless of which page.tsx is
// currently mounted, which is the only way "open tabs" can persist across a
// route change at all in this architecture (see spec 94's own note recording
// this exact bug and fix).
let tabsSnapshot: PageTabsState = INITIAL_PAGE_TABS_STATE;
let contentSnapshot: ReadonlyMap<string, ContentEntry> = new Map();
let lastVisited: { pathname: string; pageContent: React.ReactNode; title: string } | undefined;
// Set right before a tab-strip-driven `router.replace` — tells the next
// `recordVisit` (which that same navigation triggers, once the target
// page.tsx's own fresh AppShell mounts) to leave the cached, already-
// `Activity`-kept-alive content for that href alone instead of overwriting
// it with the newly (re-)rendered — and reconciliation-reset — payload Next
// just produced for the same route.
let pendingRouterSkip = false;

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
function getTabsSnapshot(): PageTabsState {
  return tabsSnapshot;
}
function getContentSnapshot(): ReadonlyMap<string, ContentEntry> {
  return contentSnapshot;
}

function recordVisit(pathname: string, pageContent: React.ReactNode, title: string): void {
  if (
    lastVisited &&
    lastVisited.pathname === pathname &&
    lastVisited.pageContent === pageContent &&
    lastVisited.title === title
  ) {
    return;
  }
  lastVisited = { pathname, pageContent, title };

  if (pendingRouterSkip && contentSnapshot.has(pathname)) {
    pendingRouterSkip = false;
    const nextTabs = activateTab(tabsSnapshot, pathname);
    if (nextTabs !== tabsSnapshot) {
      tabsSnapshot = nextTabs;
      emitChange();
    }
    return;
  }
  pendingRouterSkip = false;

  const result = visitPage(tabsSnapshot, pathname, title);
  tabsSnapshot = result.state;
  const existing = contentSnapshot.get(pathname);
  if (!existing || existing.node !== pageContent || existing.title !== title) {
    const next = new Map(contentSnapshot);
    if (result.evictedHref) {
      next.delete(result.evictedHref);
    }
    next.set(pathname, { title, node: pageContent });
    contentSnapshot = next;
  }
  emitChange();
}

type ActivateOutcome = "activated" | "needs-navigation";

function activateStoredTab(href: string): ActivateOutcome {
  if (href === tabsSnapshot.activeHref) {
    return "activated";
  }
  if (!contentSnapshot.has(href)) {
    // Not in the cache (shouldn't normally happen — every href in `order`
    // is added to the cache alongside it — but a real navigation is a safe
    // fallback for any drift between the two).
    return "needs-navigation";
  }
  pendingRouterSkip = true;
  tabsSnapshot = activateTab(tabsSnapshot, href);
  emitChange();
  return "activated";
}

interface CloseOutcome {
  /** Only set when the closed tab was the active one. */
  fallbackHref?: string;
  /** True when `fallbackHref` is already cached — the caller should
   * `router.replace` (and the next `recordVisit` will skip the cache
   * update); false means it isn't cached and the caller must `router.push`
   * a real navigation instead. */
  fallbackIsCached: boolean;
}

function closeStoredTab(href: string): CloseOutcome {
  const result = closeTab(tabsSnapshot, href);
  tabsSnapshot = result.state;
  const next = new Map(contentSnapshot);
  next.delete(href);
  contentSnapshot = next;
  emitChange();

  if (!result.fallbackHref) {
    return { fallbackIsCached: false };
  }
  const fallbackIsCached = contentSnapshot.has(result.fallbackHref);
  if (fallbackIsCached) {
    pendingRouterSkip = true;
  }
  return { fallbackHref: result.fallbackHref, fallbackIsCached };
}

/**
 * Feature-spec 94 (Multi-Tab Page Navigation). Call once from `AppShell`/
 * `PlatformShell` with the page's own `children` — records the current
 * route into the module-level tab store (see above) so it survives that
 * shell fully remounting on the next navigation. `useLayoutEffect` (not
 * `useEffect`) so the store — and anything subscribed to it via
 * `usePageTabs`/`usePageTabsContent` — updates before the browser paints,
 * avoiding a flash of the previous tab's content.
 */
export function useRecordPageVisit(pageContent: React.ReactNode): void {
  const pathname = usePathname();
  const dynamicLabels = useBreadcrumbLabels();
  const title = resolvePageTitle(pathname, dynamicLabels);

  React.useLayoutEffect(() => {
    recordVisit(pathname, pageContent, title);
  }, [pathname, pageContent, title]);
}

interface PageTabsContextValue {
  tabs: PageTab[];
  activeHref: string;
  activate: (href: string) => void;
  close: (href: string) => void;
}

/** Read by `PageTabsBar`. */
export function usePageTabs(): PageTabsContextValue {
  const router = useRouter();
  const tabsState = React.useSyncExternalStore(subscribe, getTabsSnapshot, getTabsSnapshot);

  const tabs: PageTab[] = tabsState.order.map((href) => ({ href, title: tabsState.titles[href] ?? href }));

  function activate(href: string): void {
    const outcome = activateStoredTab(href);
    if (outcome === "needs-navigation") {
      router.push(href);
      return;
    }
    router.replace(href, { scroll: false });
  }

  function close(href: string): void {
    const { fallbackHref, fallbackIsCached } = closeStoredTab(href);
    if (!fallbackHref) {
      return;
    }
    if (fallbackIsCached) {
      router.replace(fallbackHref, { scroll: false });
    } else {
      router.push(fallbackHref);
    }
  }

  return { tabs, activeHref: tabsState.activeHref, activate, close };
}

interface PageTabsContentValue {
  entries: ReadonlyMap<string, ContentEntry>;
  activeHref: string;
}

/** Read by `PageTabsOutlet`. Split from `usePageTabs` so the tab strip
 * (labels/active href only) doesn't re-render every time a backgrounded
 * tab's cached content changes. */
export function usePageTabsContent(): PageTabsContentValue {
  const entries = React.useSyncExternalStore(subscribe, getContentSnapshot, getContentSnapshot);
  const tabsState = React.useSyncExternalStore(subscribe, getTabsSnapshot, getTabsSnapshot);
  return { entries, activeHref: tabsState.activeHref };
}
