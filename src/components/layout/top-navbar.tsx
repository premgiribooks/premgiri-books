"use client";

import Link from "next/link";
import { BookOpen, Search, Bell, Menu, Settings, User, UserCog, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { MarginOverrideBadge } from "@/components/margin-override/margin-override-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { logoutAction } from "@/lib/auth-actions";
import { openCommandPalette } from "@/hooks/use-command-palette";
import { SHORTCUT_CATEGORY_LABELS, SHORTCUT_DEFINITIONS, type ShortcutCategory } from "@/config/shortcuts";
import { useResolvedShortcuts } from "@/hooks/use-shortcuts";
import { formatShortcutCombo } from "@/lib/shortcut-keys";

const SHORTCUT_CATEGORIES: ShortcutCategory[] = ["global", "billing"];

async function handleLogout() {
  try {
    await logoutAction();
  } catch {
    toast.error("Failed to log out. Please try again.");
  }
}

interface TopNavbarProps {
  onOpenMobileNav?: () => void;
}

export function TopNavbar({ onOpenMobileNav }: TopNavbarProps) {
  const { user } = useAuth();
  const resolvedShortcuts = useResolvedShortcuts();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-navbar px-4 text-navbar-foreground">
      {onOpenMobileNav && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          className="md:hidden"
          onClick={onOpenMobileNav}
        >
          <Menu size={18} />
        </Button>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <BookOpen size={22} className="text-primary" />
        <span className="text-sm font-semibold tracking-tight">
          Premgiri Books
        </span>
      </div>

      <div className="flex flex-1 justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            readOnly
            onClick={() => openCommandPalette()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCommandPalette();
              }
            }}
            placeholder="Search pages, products, customers, invoices... (Ctrl+K)"
            className="cursor-pointer pl-9"
            aria-label="Global search — opens quick navigation"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <MarginOverrideBadge />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts">
                <Settings size={18} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-72">
            {SHORTCUT_CATEGORIES.map((category) => (
              <DropdownMenuGroup key={category}>
                <DropdownMenuLabel>{SHORTCUT_CATEGORY_LABELS[category]}</DropdownMenuLabel>
                {SHORTCUT_DEFINITIONS.filter((shortcut) => shortcut.category === category).map((shortcut) => (
                  <DropdownMenuItem key={shortcut.id} closeOnClick={false} className="cursor-default">
                    {shortcut.label}
                    <DropdownMenuShortcut>{formatShortcutCombo(resolvedShortcuts.get(shortcut.id) ?? shortcut.defaultKeys)}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/shortcuts">Customize Shortcuts&hellip;</Link>} />
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" aria-label="Notifications" disabled>
          <Bell size={18} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="User menu">
                <User size={18} />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {user && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{user.fullName}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user.userType === "PLATFORM" ? "Super Admin" : user.role}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              render={
                <Link href="/profile">
                  <UserCog size={16} />
                  My Profile
                </Link>
              }
            />
            <DropdownMenuItem onClick={() => void handleLogout()}>
              <LogOut size={16} />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
