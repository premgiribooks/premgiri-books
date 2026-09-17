import { describe, expect, it } from "vitest";

import {
  HOME_HREF,
  INITIAL_PAGE_TABS_STATE,
  MAX_OPEN_TABS,
  activateTab,
  closeTab,
  visitPage,
  type PageTabsState,
} from "@/lib/page-tabs-reducer";

describe("visitPage", () => {
  it("opens a new tab and marks it active", () => {
    const result = visitPage(INITIAL_PAGE_TABS_STATE, "/masters/products", "Products");

    expect(result.isNewTab).toBe(true);
    expect(result.state).toEqual({
      order: ["/masters/products"],
      titles: { "/masters/products": "Products" },
      activeHref: "/masters/products",
    });
    expect(result.evictedHref).toBeUndefined();
  });

  it("revisiting an already-open href updates its title without duplicating the tab", () => {
    const opened = visitPage(INITIAL_PAGE_TABS_STATE, "/masters/products", "Products").state;
    const revisited = visitPage(opened, "/masters/products", "Products (12)");

    expect(revisited.isNewTab).toBe(false);
    expect(revisited.state.order).toEqual(["/masters/products"]);
    expect(revisited.state.titles["/masters/products"]).toBe("Products (12)");
  });

  it("evicts the oldest other tab once past MAX_OPEN_TABS, never the tab just visited", () => {
    let state: PageTabsState = INITIAL_PAGE_TABS_STATE;
    for (let i = 0; i < MAX_OPEN_TABS; i++) {
      state = visitPage(state, `/tab-${i}`, `Tab ${i}`).state;
    }
    expect(state.order).toHaveLength(MAX_OPEN_TABS);

    const result = visitPage(state, "/tab-new", "Tab New");

    expect(result.state.order).toHaveLength(MAX_OPEN_TABS);
    expect(result.evictedHref).toBe("/tab-0");
    expect(result.state.order).not.toContain("/tab-0");
    expect(result.state.order).toContain("/tab-new");
    expect(result.state.titles).not.toHaveProperty("/tab-0");
  });
});

describe("activateTab", () => {
  it("switches the active href for an already-open tab", () => {
    const opened = visitPage(
      visitPage(INITIAL_PAGE_TABS_STATE, "/a", "A").state,
      "/b",
      "B"
    ).state;

    const result = activateTab(opened, "/a");

    expect(result.activeHref).toBe("/a");
  });

  it("is a no-op (same reference) for an href that isn't open", () => {
    const opened = visitPage(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    expect(activateTab(opened, "/unknown")).toBe(opened);
  });

  it("is a no-op (same reference) when the href is already active", () => {
    const opened = visitPage(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    expect(activateTab(opened, "/a")).toBe(opened);
  });
});

describe("closeTab", () => {
  it("closing a background (non-active) tab leaves the active href untouched and reports no fallback", () => {
    const withTwo = visitPage(
      visitPage(INITIAL_PAGE_TABS_STATE, "/a", "A").state,
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
    const withTwo = visitPage(
      visitPage(INITIAL_PAGE_TABS_STATE, "/a", "A").state,
      "/b",
      "B"
    ).state;

    const result = closeTab(withTwo, "/b");

    expect(result.state.order).toEqual(["/a"]);
    expect(result.state.activeHref).toBe("/a");
    expect(result.fallbackHref).toBe("/a");
  });

  it("closing the last remaining tab falls back to HOME_HREF", () => {
    const single = visitPage(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    const result = closeTab(single, "/a");

    expect(result.state.order).toEqual([]);
    expect(result.state.activeHref).toBe(HOME_HREF);
    expect(result.fallbackHref).toBe(HOME_HREF);
  });

  it("removes the closed tab's title", () => {
    const single = visitPage(INITIAL_PAGE_TABS_STATE, "/a", "A").state;

    const result = closeTab(single, "/a");

    expect(result.state.titles).not.toHaveProperty("/a");
  });
});
