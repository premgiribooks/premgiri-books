/**
 * Pure state transitions for the multi-tab page navigation shell (spec 94).
 * Framework-free by design — `use-page-tabs.tsx` is the thin React/Next.js
 * router glue around this, itself not unit-tested per this project's
 * existing convention (`vitest.config.ts` only collects `*.test.ts`, node
 * environment, no DOM — every other UI feature in this codebase is verified
 * by live manual/browser testing, not component tests). Keeping the actual
 * open/close/evict decisions here, as plain data in/data out, is what makes
 * them testable at all under that convention.
 */

export const MAX_OPEN_TABS = 12;

/** Where a tab strip falls back to once its last tab is closed. */
export const HOME_HREF = "/";

export interface PageTabsState {
  /** Open tabs, oldest first — a tab's position is its open order, not its
   * last-visited order (revisiting an already-open tab never reorders it). */
  order: string[];
  titles: Record<string, string>;
  activeHref: string;
}

export const INITIAL_PAGE_TABS_STATE: PageTabsState = {
  order: [],
  titles: {},
  activeHref: HOME_HREF,
};

export interface VisitResult {
  state: PageTabsState;
  /** True the first time `href` is seen — the caller uses this to decide
   * whether to snapshot fresh content into its own render cache or to leave
   * an existing (possibly kept-alive) entry untouched. */
  isNewTab: boolean;
  /** Set when opening this tab pushed the open-tab count past
   * `MAX_OPEN_TABS` — the caller must drop this href from its own content
   * cache too (an open tab keeps its full component tree, and any timers/
   * effects it owns, mounted in the background, so an unbounded tab count
   * means unbounded background work). */
  evictedHref?: string;
}

/** An EXPLICIT "open in new tab" request (today: only the sidebar's own
 * right-click "Open in new tab" — see sidebar-item.tsx) — opens `href` as a
 * genuinely new tab, or just activates it if it's already open. Never called
 * for an ordinary navigation any more (per a 2026-09-20 user-reported bug:
 * every plain click used to open a new tab here, which is exactly what this
 * function did under its old name `visitPage` — see `navigateInPlace` below,
 * which ordinary navigation now goes through instead). */
export function openTab(state: PageTabsState, href: string, title: string): VisitResult {
  const isNewTab = !state.order.includes(href);
  let order = isNewTab ? [...state.order, href] : state.order;
  const titles = { ...state.titles, [href]: title };

  let evictedHref: string | undefined;
  if (order.length > MAX_OPEN_TABS) {
    // Evict the oldest tab that isn't the one just visited — never the tab
    // the user is actively looking at, regardless of how it ranks by age.
    const evictIndex = order.findIndex((existingHref) => existingHref !== href);
    if (evictIndex !== -1) {
      evictedHref = order[evictIndex];
      order = order.filter((_, index) => index !== evictIndex);
      delete titles[evictedHref];
    }
  }

  return { state: { order, titles, activeHref: href }, isNewTab, evictedHref };
}

export interface NavigateResult {
  state: PageTabsState;
  /** The href that this navigation replaced in the active tab's own slot —
   * the caller drops it from its content cache (it's no longer an open tab).
   * Undefined when this activated an already-open tab (nothing replaced) or
   * bootstrapped the very first tab of the session (nothing to replace). */
  replacedHref?: string;
}

/** An ORDINARY navigation (sidebar left-click, a table-row link, a form-save
 * redirect, breadcrumb, global search, browser back/forward, ...) landed on
 * `href`. Unlike `openTab`, this never grows the tab strip: it renames the
 * CURRENTLY ACTIVE tab in place (same position in `order`) to `href`, or —
 * if `href` is already one of the other open tabs — simply switches to it,
 * exactly like clicking that tab. A new tab is only ever created via the
 * explicit `openTab` path above. */
export function navigateInPlace(state: PageTabsState, href: string, title: string): NavigateResult {
  if (state.order.includes(href)) {
    return { state: activateTab(state, href) };
  }

  const activeIndex = state.order.indexOf(state.activeHref);
  if (activeIndex === -1) {
    // Bootstrap — no tab open yet (the very first navigation of the
    // session): nothing to replace, so this one just becomes the first tab.
    const titles = { ...state.titles, [href]: title };
    return { state: { order: [...state.order, href], titles, activeHref: href } };
  }

  const order = [...state.order];
  order[activeIndex] = href;
  const titles = { ...state.titles, [href]: title };
  delete titles[state.activeHref];

  return { state: { order, titles, activeHref: href }, replacedHref: state.activeHref };
}

/** Switch the visible tab to an already-open `href` — a no-op (same state
 * reference, so a caller can skip re-rendering) for an unknown href or the
 * href that's already active. */
export function activateTab(state: PageTabsState, href: string): PageTabsState {
  if (state.activeHref === href || !state.order.includes(href)) {
    return state;
  }
  return { ...state, activeHref: href };
}

export interface CloseResult {
  state: PageTabsState;
  /** Only set when the closed tab was the active one — the caller must
   * re-sync Next's router to this href so the rest of the app (sidebar
   * highlighting, breadcrumb, `usePathname()` generally) agrees with what's
   * now visible. */
  fallbackHref?: string;
}

/** Close `href` — falls back to the most recently opened remaining tab, or
 * `HOME_HREF` once none are left, only when the closed tab was the active
 * one (closing a background tab never changes what's currently shown). */
export function closeTab(state: PageTabsState, href: string): CloseResult {
  const order = state.order.filter((existingHref) => existingHref !== href);
  const titles = { ...state.titles };
  delete titles[href];

  const wasActive = state.activeHref === href;
  const activeHref = wasActive ? (order[order.length - 1] ?? HOME_HREF) : state.activeHref;

  return {
    state: { order, titles, activeHref },
    fallbackHref: wasActive ? activeHref : undefined,
  };
}

export interface BulkCloseResult {
  state: PageTabsState;
  /** Every href actually closed — the caller drops each from its own
   * content cache, same as `closeTab`'s single `href`. */
  closedHrefs: string[];
  /** Set when the previously active tab was among those closed — mirrors
   * `closeTab`'s own `fallbackHref` (the caller must re-sync Next's router
   * to it). */
  fallbackHref?: string;
}

function closeMany(state: PageTabsState, hrefsToClose: ReadonlySet<string>): BulkCloseResult {
  if (hrefsToClose.size === 0) {
    return { state, closedHrefs: [] };
  }

  const order = state.order.filter((href) => !hrefsToClose.has(href));
  const titles = { ...state.titles };
  for (const href of hrefsToClose) {
    delete titles[href];
  }

  const wasActiveClosed = hrefsToClose.has(state.activeHref);
  const activeHref = wasActiveClosed ? (order[order.length - 1] ?? HOME_HREF) : state.activeHref;

  return {
    state: { order, titles, activeHref },
    closedHrefs: [...hrefsToClose],
    fallbackHref: wasActiveClosed ? activeHref : undefined,
  };
}

/** "Close Other Tabs" — closes every open tab except `keepHref`. */
export function closeOtherTabs(state: PageTabsState, keepHref: string): BulkCloseResult {
  return closeMany(state, new Set(state.order.filter((href) => href !== keepHref)));
}

/** "Close Tabs to the Right" — closes every tab positioned after `href` in
 * open order. A no-op (nothing closed) for an unknown href or the
 * last-positioned tab. */
export function closeTabsToTheRight(state: PageTabsState, href: string): BulkCloseResult {
  const index = state.order.indexOf(href);
  if (index === -1) {
    return { state, closedHrefs: [] };
  }
  return closeMany(state, new Set(state.order.slice(index + 1)));
}

/** "Close Tabs to the Left" — closes every tab positioned before `href` in
 * open order. A no-op (nothing closed) for an unknown href or the
 * first-positioned tab. */
export function closeTabsToTheLeft(state: PageTabsState, href: string): BulkCloseResult {
  const index = state.order.indexOf(href);
  if (index === -1) {
    return { state, closedHrefs: [] };
  }
  return closeMany(state, new Set(state.order.slice(0, index)));
}

/** "Close All Tabs" — closes every open tab. */
export function closeAllTabs(state: PageTabsState): BulkCloseResult {
  return closeMany(state, new Set(state.order));
}
