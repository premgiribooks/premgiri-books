"use client";

import { X } from "lucide-react";

import { usePageTabs } from "@/hooks/use-page-tabs";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";

/** The tab strip itself — one chip per open page, below the breadcrumb bar
 * (spec 94). Reads only `PageTabsContext` (labels/active href), never the
 * per-tab cached content, so it doesn't re-render when a backgrounded tab's
 * content changes. Each tab's own right-click menu (Close/Close Others/
 * Close All/Close to the Right/Close to the Left) mirrors the browser-tab
 * convention this in-app strip is standing in for. */
export function PageTabsBar() {
  const { tabs, activeHref, activate, close, closeOthers, closeAll, closeToRight, closeToLeft } = usePageTabs();

  return (
    <div
      role="tablist"
      aria-label="Open pages"
      className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.href === activeHref;
        return (
          <ContextMenu key={tab.href}>
            <ContextMenuTrigger>
              <div
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
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => close(tab.href)}>Close</ContextMenuItem>
              <ContextMenuItem disabled={tabs.length < 2} onClick={() => closeOthers(tab.href)}>
                Close Others
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem disabled={index === 0} onClick={() => closeToLeft(tab.href)}>
                Close Tabs to the Left
              </ContextMenuItem>
              <ContextMenuItem disabled={index === tabs.length - 1} onClick={() => closeToRight(tab.href)}>
                Close Tabs to the Right
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => closeAll()}>Close All</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
