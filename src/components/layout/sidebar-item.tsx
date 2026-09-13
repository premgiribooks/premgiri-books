"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  href?: string;
  active?: boolean;
  /** Indent depth: 0/undefined = top-level, 1 = a group's direct child, 2 =
   * a third-level grandchild (nested under a leaf that itself has
   * children, e.g. a Reports sub-hub's report types). */
  indent?: 0 | 1 | 2;
  onClick?: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}

export function SidebarItem({
  icon: Icon,
  label,
  collapsed,
  href,
  active = false,
  indent = 0,
  onClick,
  favorite,
  onToggleFavorite,
}: SidebarItemProps) {
  const itemClassName = cn(
    "group/sidebar-item flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-primary-dim font-medium text-primary"
      : "text-sidebar-foreground/80 hover:bg-muted hover:text-sidebar-foreground",
    collapsed && "justify-center px-0",
    !collapsed && indent === 1 && "pl-9",
    !collapsed && indent === 2 && "pl-14"
  );

  const content = (
    <>
      <Icon size={collapsed ? 20 : 16} className="shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!collapsed && onToggleFavorite && (
        <button
          type="button"
          className={cn(
            "shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-warning group-hover/sidebar-item:opacity-100 focus-visible:opacity-100",
            favorite && "text-warning opacity-100"
          )}
          aria-label={favorite ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
          aria-pressed={favorite}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Star size={14} fill={favorite ? "currentColor" : "none"} />
        </button>
      )}
    </>
  );

  const accessibleLabel = collapsed ? label : undefined;

  const button = href ? (
    <Link
      href={href}
      className={itemClassName}
      aria-label={accessibleLabel}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {content}
    </Link>
  ) : (
    <button type="button" className={itemClassName} aria-label={accessibleLabel} onClick={onClick}>
      {content}
    </button>
  );

  if (!collapsed) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
