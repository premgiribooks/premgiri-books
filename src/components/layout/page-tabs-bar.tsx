"use client";

import { X } from "lucide-react";

import { usePageTabs } from "@/hooks/use-page-tabs";
import { cn } from "@/lib/utils";

/** The tab strip itself — one chip per open page, below the breadcrumb bar
 * (spec 94). Reads only `PageTabsContext` (labels/active href), never the
 * per-tab cached content, so it doesn't re-render when a backgrounded tab's
 * content changes. */
export function PageTabsBar() {
  const { tabs, activeHref, activate, close } = usePageTabs();

  return (
    <div
      role="tablist"
      aria-label="Open pages"
      className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2"
    >
      {tabs.map((tab) => {
        const isActive = tab.href === activeHref;
        return (
          <div
            key={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "group flex h-7 max-w-48 shrink-0 items-center gap-1 rounded-t-md border border-b-0 px-2.5 text-xs transition-colors",
              isActive
                ? "border-border bg-background text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted"
            )}
          >
            <button
              type="button"
              onClick={() => activate(tab.href)}
              className="min-w-0 flex-1 truncate text-left"
              title={tab.title}
            >
              {tab.title}
            </button>
            <button
              type="button"
              aria-label={`Close ${tab.title} tab`}
              onClick={(event) => {
                event.stopPropagation();
                close(tab.href);
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-border hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
