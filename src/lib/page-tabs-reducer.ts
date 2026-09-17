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

/** A real navigation landed on `href` (any cause — sidebar, a table row
 * link, a form-save redirect, breadcrumb, global search, or an already-known
 * tab whose router-sync round-trip just completed). Records it as the
 * active tab, opening a new one if `href` wasn't already open. */
export function visitPage(state: PageTabsState, href: string, title: string): VisitResult {
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
