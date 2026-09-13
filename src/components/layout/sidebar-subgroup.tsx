"use client";

import { ChevronRight } from "lucide-react";

import type { NavLeaf } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { SidebarItem } from "@/components/layout/sidebar-item";

interface SidebarSubGroupProps {
  /** A NavLeaf that carries its own `children` (third level) — e.g. "Sales
   * Reports" under Reports. */
  item: NavLeaf;
  expanded: boolean;
  onToggleExpand: () => void;
  /** True when any grandchild route is active. */
  active: boolean;
  isLeafActive: (href: string) => boolean;
  favorites: string[];
  onToggleFavorite: (href: string) => void;
  onNavigate?: () => void;
}

/**
 * Expanded-rail rendering of a third-level branch: a nested, indented
 * header (icon + label + chevron) that only toggles — mirroring how a
 * top-level NavGroup's own header never navigates — followed by its
 * grandchildren as further-indented SidebarItems when expanded. Not used in
 * collapsed (icon-only) rail mode — there, SidebarGroup renders the whole
 * subtree inline inside its own flyout instead (see sidebar-group.tsx).
 */
export function SidebarSubGroup({
  item,
  expanded,
  onToggleExpand,
  active,
  isLeafActive,
  favorites,
  onToggleFavorite,
  onNavigate,
}: SidebarSubGroupProps) {
  const Icon = item.icon;
  const children = item.children ?? [];

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className={cn(
          "flex h-9 w-full items-center gap-3 rounded-lg py-2 pr-3 pl-9 text-sm outline-none transition-colors hover:bg-muted hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active ? "font-medium text-primary" : "text-sidebar-foreground/80"
        )}
      >
        <Icon size={16} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        <ChevronRight
          size={14}
          className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")}
        />
      </button>

      {expanded && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {children.map((grandchild) => (
            <SidebarItem
              key={grandchild.href}
              icon={grandchild.icon}
              label={grandchild.label}
              collapsed={false}
              href={grandchild.href}
              active={isLeafActive(grandchild.href)}
              indent={2}
              onClick={onNavigate}
              favorite={favorites.includes(grandchild.href)}
              onToggleFavorite={() => onToggleFavorite(grandchild.href)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
