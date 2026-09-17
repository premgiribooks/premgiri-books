"use client";

import { Activity } from "react";

import { usePageTabsContent } from "@/hooks/use-page-tabs";

/**
 * Renders every open tab's last-known content simultaneously, wrapped in
 * React's `<Activity>` (React 19.2+, bundled with this project's own React
 * version — see spec 94's Architecture Decision for why this was chosen
 * over a plain CSS-hidden `<div>`): the inactive tabs' component trees stay
 * mounted with `display: none` rather than being torn down, but their
 * effects/timers/subscriptions are cleaned up while hidden and re-run when
 * the tab becomes visible again, exactly like an unmount/remount would —
 * without actually losing `useState`/DOM state (in-progress form input,
 * scroll position) in between.
 */
export function PageTabsOutlet() {
  const { entries, activeHref } = usePageTabsContent();

  return (
    <>
      {[...entries.entries()].map(([href, entry]) => (
        <Activity key={href} mode={href === activeHref ? "visible" : "hidden"}>
          {entry.node}
        </Activity>
      ))}
    </>
  );
}
