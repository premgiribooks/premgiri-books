"use client";

import * as React from "react";
import type { ReactNode } from "react";

import { TopNavbar } from "@/components/layout/top-navbar";
import { PlatformSidebar } from "@/components/layout/platform-sidebar";
import { Content } from "@/components/layout/content";
import { StatusBar } from "@/components/layout/status-bar";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";
import { PageTabsBar } from "@/components/layout/page-tabs-bar";
import { PageTabsOutlet } from "@/components/layout/page-tabs-outlet";
import { ShortcutListener } from "@/components/layout/shortcut-listener";
import { MarginOverrideDialog } from "@/components/margin-override/margin-override-dialog";
import { useRecordPageVisit } from "@/hooks/use-page-tabs";

interface PlatformShellProps {
  children: ReactNode;
}

// A separate shell from AppShell/Sidebar (not a `mode` prop on them) — a
// Super Admin has no "current company" and the Platform nav is
// structurally different from the ERP nav, per Permanent Architecture
// Principle 8 (Platform/ERP modules stay completely separated). TopNavbar/
// BreadcrumbBar/PageTabs*/Content/StatusBar are generic chrome, reused
// unchanged.
export function PlatformShell({ children }: PlatformShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  // Every page.tsx wraps its own content in <PlatformShell> directly (no
  // shared layout.tsx above them), so this shell fully remounts on every
  // navigation — see AppShell's identical note and use-page-tabs.tsx's own
  // module-level store, which is what survives that remount instead.
  useRecordPageVisit(children);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <TopNavbar />
      <BreadcrumbBar />
      <PageTabsBar />
      <div className="flex flex-1 overflow-hidden">
        <PlatformSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        <Content>
          <PageTabsOutlet />
        </Content>
      </div>
      <StatusBar />
      <ShortcutListener />
      <MarginOverrideDialog />
    </div>
  );
}
