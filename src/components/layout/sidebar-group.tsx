"use client";

import { ChevronRight } from "lucide-react";

import type { NavGroup } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { SidebarItem } from "@/components/layout/sidebar-item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SidebarGroupProps {
  group: NavGroup;
  collapsed: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  active: boolean;
  isLeafActive: (href: string) => boolean;
  favorites: string[];
  onToggleFavorite: (href: string) => void;
  onNavigate?: () => void;
}

export function SidebarGroup({
  group,
  collapsed,
  expanded,
  onToggleExpand,
  active,
  isLeafActive,
  favorites,
  onToggleFavorite,
  onNavigate,
}: SidebarGroupProps) {
  const Icon = group.icon;

  // Collapsed (icon-only) rail: children stay reachable via a click-to-open
  // flyout instead of an inline expand, since there's no room to render a
  // label + chevron + indented rows in a 16px-wide rail.
  if (collapsed) {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              title={group.label}
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
        <PopoverContent side="right" align="start" className="w-60 p-1.5">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{group.label}</div>
          <div className="flex flex-col gap-0.5">
            {group.children.map((child) => (
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
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggleExpand}
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
          {group.children.map((child) => (
            <SidebarItem
              key={child.href}
              icon={child.icon}
              label={child.label}
              collapsed={false}
              href={child.href}
              active={isLeafActive(child.href)}
              indent
              onClick={onNavigate}
              favorite={favorites.includes(child.href)}
              onToggleFavorite={() => onToggleFavorite(child.href)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
