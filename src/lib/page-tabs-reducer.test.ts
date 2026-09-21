import { describe, expect, it } from "vitest";

import {
  HOME_HREF,
  INITIAL_PAGE_TABS_STATE,
  MAX_OPEN_TABS,
  activateTab,
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  closeTabsToTheLeft,
  closeTabsToTheRight,
  navigateInPlace,
  openTab,
  type PageTabsState,
} from "@/lib/page-tabs-reducer";

describe("openTab", () => {
  it("opens a new tab and marks it active", () => {
    const result = openTab(INITIAL_PAGE_TABS_STATE, "/masters/products", "Products");

    expect(result.isNewTab).toBe(true);
    expect(result.state).toEqual({
      order: ["/masters/products"],
      titles: { "/masters/products": "Products" },
      activeHref: "/masters/products",
    });
    expect(result.evictedHref).toBeUndefined();
  });

  it("revisiting an already-open href updates its title without duplicating the tab", () => {
    const opened = openTab(INITIAL_PAGE_TABS_STATE, "/masters/products", "Products").state;
    const revisited = openTab(opened, "/masters/products", "Products (12)");

    expect(revisited.isNewTab).toBe(false);
    expect(revisited.state.order).toEqual(["/masters/products"]);
    expect(revisited.state.titles["/masters/products"]).toBe("Products (12)");
  });

  it("evicts the oldest other tab once past MAX_OPEN_TABS, never the tab just visited", () => {
    let state: PageTabsState = INITIAL_PAGE_TABS_STATE;
    for (let i = 0; i < MAX_OPEN_TABS; i++) {
      state = openTab(state, `/tab-${i}`, `Tab ${i}`).state;
    }
    expect(state.order).toHaveLength(MAX_OPEN_TABS);

    const result = openTab(state, "/tab-new", "Tab New");

    expect(result.state.order).toHaveLength(MAX_OPEN_TABS);
    expect(result.evictedHref).toBe("/tab-0");
    expect(result.state.order).not.toContain("/tab-0");
    expect(result.state.order).toContain("/tab-new");
    expect(result.state.titles).not.toHaveProperty("/tab-0");
  });
});

describe("navigateInPlace", () => {
  it("bootstraps the very first tab of the session", () => {
    const result = navigateInPlace(INITIAL_PAGE_TABS_STATE, "/a", "A");

    expect(result.state).toEqual({ order: ["/a"], titles: { "/a": "A" }, activeHref: "/a" });
    expect(result.replacedHref).toBeUndefined();
  });

  it("renames the currently active tab in place — an ordinary navigation never opens a new tab", () => {
    const first = navigateInPlace(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    const second = navigateInPlace(first, "/b", "B");

    expect(second.state.order).toEqual(["/b"]);
    expect(second.state.activeHref).toBe("/b");
    expect(second.state.titles).toEqual({ "/b": "B" });
    expect(second.replacedHref).toBe("/a");
  });

  it("replaces only the active tab's own slot, leaving other open tabs untouched", () => {
    const withTwo = openTab(openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state, "/b", "B").state;
    expect(withTwo.order).toEqual(["/a", "/b"]);
    expect(withTwo.activeHref).toBe("/b");

    const result = navigateInPlace(withTwo, "/c", "C");

    expect(result.state.order).toEqual(["/a", "/c"]);
    expect(result.state.activeHref).toBe("/c");
    expect(result.replacedHref).toBe("/b");
  });

  it("activates an already-open href instead of duplicating it", () => {
    const withTwo = openTab(openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state, "/b", "B").state;

    const result = navigateInPlace(withTwo, "/a", "A");

    expect(result.state.order).toEqual(["/a", "/b"]);
    expect(result.state.activeHref).toBe("/a");
    expect(result.replacedHref).toBeUndefined();
  });
});

describe("activateTab", () => {
  it("switches the active href for an already-open tab", () => {
    const opened = openTab(
      openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state,
      "/b",
      "B"
    ).state;

    const result = activateTab(opened, "/a");

    expect(result.activeHref).toBe("/a");
  });

  it("is a no-op (same reference) for an href that isn't open", () => {
    const opened = openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    expect(activateTab(opened, "/unknown")).toBe(opened);
  });

  it("is a no-op (same reference) when the href is already active", () => {
    const opened = openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    expect(activateTab(opened, "/a")).toBe(opened);
  });
});

describe("closeTab", () => {
  it("closing a background (non-active) tab leaves the active href untouched and reports no fallback", () => {
    const withTwo = openTab(
      openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state,
      "/b",
      "B"
    ).state;
    expect(withTwo.activeHref).toBe("/b");

    const result = closeTab(withTwo, "/a");

    expect(result.state.order).toEqual(["/b"]);
    expect(result.state.activeHref).toBe("/b");
    expect(result.fallbackHref).toBeUndefined();
  });

  it("closing the active tab falls back to the most recently opened remaining tab", () => {
    const withTwo = openTab(
      openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state,
      "/b",
      "B"
    ).state;

    const result = closeTab(withTwo, "/b");

    expect(result.state.order).toEqual(["/a"]);
    expect(result.state.activeHref).toBe("/a");
    expect(result.fallbackHref).toBe("/a");
  });

  it("closing the last remaining tab falls back to HOME_HREF", () => {
    const single = openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    const result = closeTab(single, "/a");

    expect(result.state.order).toEqual([]);
    expect(result.state.activeHref).toBe(HOME_HREF);
    expect(result.fallbackHref).toBe(HOME_HREF);
  });

  it("removes the closed tab's title", () => {
    const single = openTab(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    const result = closeTab(single, "/a");

    expect(result.state.titles).not.toHaveProperty("/a");
  });
});

function openMany(hrefs: readonly string[]): PageTabsState {
  let state: PageTabsState = INITIAL_PAGE_TABS_STATE;
  for (const href of hrefs) {
    state = openTab(state, href, href.toUpperCase()).state;
  }
  return state;
}

describe("closeOtherTabs", () => {
  it("closes every tab except the one named", () => {
    const state = openMany(["/a", "/b", "/c"]);
    expect(state.activeHref).toBe("/c");

    const result = closeOtherTabs(state, "/b");

    expect(result.state.order).toEqual(["/b"]);
    expect(result.closedHrefs.sort()).toEqual(["/a", "/c"]);
    // "/c" (the active tab) was among those closed, so the caller must
    // re-sync the router to the surviving "/b".
    expect(result.fallbackHref).toBe("/b");
  });

  it("reports no fallback when the previously active tab is the one kept open", () => {
    const state = openMany(["/a", "/b", "/c"]);
    expect(state.activeHref).toBe("/c");

    const result = closeOtherTabs(state, "/c");

    expect(result.state.order).toEqual(["/c"]);
    expect(result.fallbackHref).toBeUndefined();
  });

  it("reports a fallback when the previously active tab was closed", () => {
    const state = openMany(["/a", "/b", "/c"]);
    expect(state.activeHref).toBe("/c");

    const result = closeOtherTabs(state, "/a");

    expect(result.state.activeHref).toBe("/a");
    expect(result.fallbackHref).toBe("/a");
  });
});

describe("closeTabsToTheRight", () => {
  it("closes every tab positioned after the named href", () => {
    const state = openMany(["/a", "/b", "/c", "/d"]);

    const result = closeTabsToTheRight(state, "/b");

    expect(result.state.order).toEqual(["/a", "/b"]);
    expect(result.closedHrefs.sort()).toEqual(["/c", "/d"]);
    expect(result.fallbackHref).toBe("/b");
  });

  it("is a no-op for the last-positioned tab", () => {
    const state = openMany(["/a", "/b"]);

    const result = closeTabsToTheRight(state, "/b");

    expect(result.state).toEqual(state);
    expect(result.closedHrefs).toEqual([]);
  });
});

describe("closeTabsToTheLeft", () => {
  it("closes every tab positioned before the named href", () => {
    const state = openMany(["/a", "/b", "/c", "/d"]);

    const result = closeTabsToTheLeft(state, "/c");

    expect(result.state.order).toEqual(["/c", "/d"]);
    expect(result.closedHrefs.sort()).toEqual(["/a", "/b"]);
  });

  it("is a no-op for the first-positioned tab", () => {
    const state = openMany(["/a", "/b"]);

    const result = closeTabsToTheLeft(state, "/a");

    expect(result.state).toEqual(state);
    expect(result.closedHrefs).toEqual([]);
  });
});

describe("closeAllTabs", () => {
  it("closes every open tab and falls back to HOME_HREF", () => {
    const state = openMany(["/a", "/b", "/c"]);

    const result = closeAllTabs(state);

    expect(result.state).toEqual(INITIAL_PAGE_TABS_STATE);
    expect(result.closedHrefs.sort()).toEqual(["/a", "/b", "/c"]);
    expect(result.fallbackHref).toBe(HOME_HREF);
  });
});
