"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useBreadcrumbLabels } from "@/hooks/use-breadcrumb-label";
import { resolvePageTitle } from "@/lib/breadcrumb-trail";
import {
  INITIAL_PAGE_TABS_STATE,
  activateTab,
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  closeTabsToTheLeft,
  closeTabsToTheRight,
  navigateInPlace,
  openTab,
  type BulkCloseResult,
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
// Set right before `useOpenPageInNewTab`'s own `router.push` — tells the
// next `recordVisit` to go through `openTab` (genuinely open a new tab)
// instead of its default `navigateInPlace` (rename the active tab). Every
// OTHER navigation — sidebar left-click, a table-row link, a form-save
// redirect, breadcrumb, global search, browser back/forward — takes the
// default path, per a 2026-09-20 user-reported bug: this store used to open
// a new tab for literally every navigation (see page-tabs-reducer.ts's own
// `openTab` doc comment, formerly `visitPage`).
let pendingOpenAsNewTab = false;

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
    pendingOpenAsNewTab = false;
    const nextTabs = activateTab(tabsSnapshot, pathname);
    if (nextTabs !== tabsSnapshot) {
      tabsSnapshot = nextTabs;
      emitChange();
    }
    return;
  }
  pendingRouterSkip = false;

  if (pendingOpenAsNewTab) {
    pendingOpenAsNewTab = false;
    const result = openTab(tabsSnapshot, pathname, title);
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
    return;
  }

  const result = navigateInPlace(tabsSnapshot, pathname, title);
  tabsSnapshot = result.state;
  const existing = contentSnapshot.get(pathname);
  if (!existing || existing.node !== pageContent || existing.title !== title) {
    const next = new Map(contentSnapshot);
    if (result.replacedHref) {
      next.delete(result.replacedHref);
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

/** Shared plumbing for the tab strip's own right-click "Close Others"/"Close
 * All"/"Close to the Right"/"Close to the Left" — applies a `BulkCloseResult`
 * to the store exactly like `closeStoredTab` does for a single href. */
function applyBulkClose(result: BulkCloseResult): CloseOutcome {
  tabsSnapshot = result.state;
  if (result.closedHrefs.length > 0) {
    const next = new Map(contentSnapshot);
    for (const href of result.closedHrefs) {
      next.delete(href);
    }
    contentSnapshot = next;
  }
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
  /** Right-click tab actions (page-tabs-bar.tsx's own context menu). */
  closeOthers: (href: string) => void;
  closeAll: () => void;
  closeToRight: (href: string) => void;
  closeToLeft: (href: string) => void;
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

  function navigateAfterClose(outcome: CloseOutcome): void {
    if (!outcome.fallbackHref) {
      return;
    }
    if (outcome.fallbackIsCached) {
      router.replace(outcome.fallbackHref, { scroll: false });
    } else {
      router.push(outcome.fallbackHref);
    }
  }

  function close(href: string): void {
    navigateAfterClose(closeStoredTab(href));
  }

  function closeOthers(href: string): void {
    navigateAfterClose(applyBulkClose(closeOtherTabs(tabsSnapshot, href)));
  }

  function closeAll(): void {
    navigateAfterClose(applyBulkClose(closeAllTabs(tabsSnapshot)));
  }

  function closeToRight(href: string): void {
    navigateAfterClose(applyBulkClose(closeTabsToTheRight(tabsSnapshot, href)));
  }

  function closeToLeft(href: string): void {
    navigateAfterClose(applyBulkClose(closeTabsToTheLeft(tabsSnapshot, href)));
  }

  return { tabs, activeHref: tabsState.activeHref, activate, close, closeOthers, closeAll, closeToRight, closeToLeft };
}

/**
 * Backs the sidebar's right-click "Open in new tab" (sidebar-item.tsx) — the
 * one and only way a new tab is created any more (see page-tabs-reducer.ts's
 * `openTab` doc comment). If `href` is already open elsewhere, this just
 * switches to it instead of creating a duplicate entry — tab identity is 1:1
 * with href in this design, so a second tab for the same route isn't
 * representable.
 */
export function useOpenPageInNewTab(): (href: string) => void {
  const router = useRouter();
  return React.useCallback(
    (href: string) => {
      if (href !== tabsSnapshot.activeHref && tabsSnapshot.order.includes(href)) {
        const outcome = activateStoredTab(href);
        if (outcome === "activated") {
          router.replace(href, { scroll: false });
          return;
        }
      }
      pendingOpenAsNewTab = true;
      router.push(href);
    },
    [router]
  );
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
