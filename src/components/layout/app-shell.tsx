"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { TopNavbar } from "@/components/layout/top-navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Content } from "@/components/layout/content";
import { StatusBar } from "@/components/layout/status-bar";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ALL_NAV_LEAVES } from "@/config/navigation";
import { recordRecentPage } from "@/hooks/use-recent-pages";

interface AppShellProps {
  children: ReactNode;
  /** Kept for backward compatibility — every existing page still computes
   * and passes this. Nav visibility now comes from useNavPermissions()
   * (see NavPermissionsProvider in the root layout) instead. */
  isAdmin?: boolean;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Records the closest matching nav leaf (not the raw pathname) so
  // "Recent" only ever lists real navigation destinations — a deep route
  // like /masters/products/<id>/edit records as "Products".
  React.useEffect(() => {
    const match = ALL_NAV_LEAVES.find(
      (leaf) => pathname === leaf.href || (leaf.href !== "/" && pathname.startsWith(`${leaf.href}/`))
    );
    if (match) {
      recordRecentPage(match.href);
    }
  }, [pathname]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <TopNavbar onOpenMobileNav={() => setMobileNavOpen(true)} />
      <BreadcrumbBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex h-full">
          <Sidebar />
        </div>
        <Content>{children}</Content>
      </div>
      <StatusBar />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar variant="drawer" onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandPalette />
    </div>
  );
}
