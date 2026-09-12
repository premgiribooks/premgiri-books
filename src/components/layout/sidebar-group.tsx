"use client";

import { ChevronRight } from "lucide-react";

import type { NavGroup } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { SidebarItem } from "@/components/layout/sidebar-item";
import { SidebarSubGroup } from "@/components/layout/sidebar-subgroup";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarGroupProps {
  group: NavGroup;
  collapsed: boolean;
  /** Keyed by group label for a top-level group, or `"<group label>>" +
   * "<child label>"` for a third-level branch nested under this group —
   * lets one flat expanded-state store (use-sidebar-state.ts) track both
   * levels without collisions. */
  isExpanded: (key: string) => boolean;
  onToggleExpand: (key: string) => void;
  active: boolean;
  isLeafActive: (href: string) => boolean;
  favorites: string[];
  onToggleFavorite: (href: string) => void;
  onNavigate?: () => void;
}

export function SidebarGroup({
  group,
  collapsed,
  isExpanded,
  onToggleExpand,
  active,
  isLeafActive,
  favorites,
  onToggleFavorite,
  onNavigate,
}: SidebarGroupProps) {
  const Icon = group.icon;
  const expanded = isExpanded(group.label);

  // Collapsed (icon-only) rail: children stay reachable via a click-to-open
  // flyout instead of an inline expand, since there's no room to render a
  // label + chevron + indented rows in a 16px-wide rail. A child that
  // itself has third-level children (a Reports sub-hub) is shown as a
  // small inline header followed by its own rows, inside this same
  // flyout, rather than a further nested popover.
  if (collapsed) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label={group.label}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-lg outline-none transition-colors hover:bg-muted hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-primary-dim text-primary" : "text-sidebar-foreground/80"
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                  </button>
                }
              />
            }
          />
          <TooltipContent side="right">{group.label}</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" align="start" className="w-64 p-1.5">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{group.label}</div>
          <div className="flex flex-col gap-0.5">
            {group.children.map((child) =>
              child.children && child.children.length > 0 ? (
                <div key={child.href} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2.5 px-3 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground">
                    <child.icon size={14} className="shrink-0" />
                    <span className="truncate">{child.label}</span>
                  </div>
                  {child.children.map((grandchild) => (
                    <SidebarItem
                      key={grandchild.href}
                      icon={grandchild.icon}
                      label={grandchild.label}
                      collapsed={false}
                      href={grandchild.href}
                      active={isLeafActive(grandchild.href)}
                      indent={1}
                      onClick={onNavigate}
                      favorite={favorites.includes(grandchild.href)}
                      onToggleFavorite={() => onToggleFavorite(grandchild.href)}
                    />
                  ))}
                </div>
              ) : (
                <SidebarItem
                  key={child.href}
                  icon={child.icon}
                  label={child.label}
                  collapsed={false}
                  href={child.href}
                  active={isLeafActive(child.href)}
                  onClick={onNavigate}
                  favorite={favorites.includes(child.href)}
                  onToggleFavorite={() => onToggleFavorite(child.href)}
                />
              )
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => onToggleExpand(group.label)}
        aria-expanded={expanded}
        className={cn(
          "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm outline-none transition-colors hover:bg-muted hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active ? "font-medium text-primary" : "text-sidebar-foreground/80"
        )}
      >
        <Icon size={20} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        <ChevronRight
          size={16}
          className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")}
        />
      </button>

      {expanded && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {group.children.map((child) =>
            child.children && child.children.length > 0 ? (
              <SidebarSubGroup
                key={child.href}
                item={child}
                expanded={isExpanded(`${group.label}>${child.label}`)}
                onToggleExpand={() => onToggleExpand(`${group.label}>${child.label}`)}
                active={child.children.some((grandchild) => isLeafActive(grandchild.href))}
                isLeafActive={isLeafActive}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                onNavigate={onNavigate}
              />
            ) : (
              <SidebarItem
                key={child.href}
                icon={child.icon}
                label={child.label}
                collapsed={false}
                href={child.href}
                active={isLeafActive(child.href)}
                indent={1}
                onClick={onNavigate}
                favorite={favorites.includes(child.href)}
                onToggleFavorite={() => onToggleFavorite(child.href)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
