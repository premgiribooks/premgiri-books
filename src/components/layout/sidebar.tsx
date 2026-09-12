"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarItem } from "@/components/layout/sidebar-item";
import { SidebarGroup } from "@/components/layout/sidebar-group";
import { flattenNavItems, NAVIGATION, type NavGroup, type NavLeaf } from "@/config/navigation";
import { filterNavigation } from "@/lib/navigation-filter";
import { useNavPermissions } from "@/components/providers/nav-permissions-provider";
import { setGroupExpanded, setSidebarCollapsed, useSidebarState } from "@/hooks/use-sidebar-state";
import { toggleFavorite, useFavorites } from "@/hooks/use-favorites";

interface SidebarProps {
  /** "rail" (default) is the inline desktop sidebar with a collapse toggle;
   * "drawer" is the mobile Sheet variant — always full-width, no collapse
   * control (the Sheet already has its own close affordance). */
  variant?: "rail" | "drawer";
  onNavigate?: () => void;
}

function isLeafActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function leafOrDescendantActive(pathname: string, leaf: NavLeaf): boolean {
  if (isLeafActive(pathname, leaf.href)) {
    return true;
  }
  return leaf.children?.some((grandchild) => isLeafActive(pathname, grandchild.href)) ?? false;
}

function groupContainsActive(group: NavGroup, pathname: string): boolean {
  return group.children.some((child) => leafOrDescendantActive(pathname, child));
}

export function Sidebar({ variant = "rail", onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const permissions = useNavPermissions();
  const { collapsed: persistedCollapsed, expandedGroups } = useSidebarState();
  const favorites = useFavorites();

  const collapsed = variant === "rail" && persistedCollapsed;

  const visibleNav = React.useMemo(() => filterNavigation(NAVIGATION, permissions), [permissions]);

  const isExpanded = React.useCallback((key: string) => expandedGroups.includes(key), [expandedGroups]);
  const onToggleExpand = React.useCallback(
    (key: string) => setGroupExpanded(key, !expandedGroups.includes(key)),
    [expandedGroups]
  );

  // "The active module should automatically expand when a child route is
  // opened" — including on direct URL visit/refresh, and even if the user
  // had previously collapsed that group. Guarded to fire once per pathname
  // change (not on every expandedGroups change) so a user can still
  // manually collapse the active group afterwards without this effect
  // immediately re-expanding it. A route active on a third-level leaf
  // (e.g. /reports/sales/register) auto-expands both its top-level group
  // ("Reports") and its own second-level branch ("Reports>Sales Reports").
  const lastAutoExpandedPathname = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (lastAutoExpandedPathname.current === pathname) {
      return;
    }
    lastAutoExpandedPathname.current = pathname;
    for (const item of visibleNav) {
      if (item.type !== "group") {
        continue;
      }
      for (const child of item.children) {
        if (!leafOrDescendantActive(pathname, child)) {
          continue;
        }
        setGroupExpanded(item.label, true);
        if (child.children?.some((grandchild) => isLeafActive(pathname, grandchild.href))) {
          setGroupExpanded(`${item.label}>${child.label}`, true);
        }
      }
    }
  }, [pathname, visibleNav]);

  // Resolved against the already permission-filtered tree (not the raw
  // ALL_NAV_LEAVES) — a stale favorite the user no longer has access to
  // (e.g. after a role change) silently drops out instead of showing a
  // shortcut that would just redirect them away.
  const visibleLeavesByHref = React.useMemo(() => {
    const map = new Map<string, NavLeaf>();
    for (const item of flattenNavItems(visibleNav)) {
      map.set(item.href, item);
    }
    return map;
  }, [visibleNav]);

  const favoriteLeaves = React.useMemo(
    () => favorites.map((href) => visibleLeavesByHref.get(href)).filter((item): item is NavLeaf => Boolean(item)),
    [favorites, visibleLeavesByHref]
  );

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-full shrink-0 flex-col bg-sidebar transition-[width] duration-150",
        variant === "rail" && "border-r border-border",
        variant === "drawer" ? "w-full" : collapsed ? "w-16" : "w-64"
      )}
    >
      {variant === "rail" && (
        <div className="flex h-12 shrink-0 items-center justify-end border-b border-border px-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setSidebarCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </Button>
        </div>
      )}

      {/* Scrollable once the menu grows past the viewport, with the custom
          scrollbar thumb hidden — the rail stays scrollable (wheel/touch/
          keyboard all still work via the viewport's native overflow), it
          just never shows a visible track/thumb cluttering a 16-64px rail.
          `min-h-0` is required: a flex item defaults to min-height:auto,
          which refuses to shrink below its content size even inside a
          sized flex column, so without it the item list just grows past
          the rail instead of scrolling internally. */}
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-scrollbar]]:hidden">
        <div className="flex flex-col gap-1 p-2">
          {favoriteLeaves.length > 0 && (
            <>
              <div className="flex flex-col gap-0.5">
                {!collapsed && (
                  <div className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Favorites
                  </div>
                )}
                {favoriteLeaves.map((item) => (
                  <SidebarItem
                    key={`favorite-${item.href}`}
                    icon={item.icon}
                    label={item.label}
                    collapsed={collapsed}
                    href={item.href}
                    active={isLeafActive(pathname, item.href)}
                    onClick={onNavigate}
                    favorite
                    onToggleFavorite={() => toggleFavorite(item.href)}
                  />
                ))}
              </div>
              <Separator className="my-1" />
            </>
          )}

          {visibleNav.map((item) =>
            item.type === "leaf" ? (
              <SidebarItem
                key={item.href}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                href={item.href}
                active={isLeafActive(pathname, item.href)}
                onClick={onNavigate}
              />
            ) : (
              <SidebarGroup
                key={item.label}
                group={item}
                collapsed={collapsed}
                isExpanded={isExpanded}
                onToggleExpand={onToggleExpand}
                active={groupContainsActive(item, pathname)}
                isLeafActive={(href) => isLeafActive(pathname, href)}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onNavigate={onNavigate}
              />
            )
          )}
        </div>
      </ScrollArea>
    </nav>
  );
}
