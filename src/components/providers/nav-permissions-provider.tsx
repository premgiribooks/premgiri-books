"use client";

import * as React from "react";

import type { PermissionModule } from "@/constants/permissions";

type NavPermissions = Record<PermissionModule, boolean>;

const NavPermissionsContext = React.createContext<NavPermissions | undefined>(undefined);

interface NavPermissionsProviderProps {
  initialPermissions: NavPermissions;
  children: React.ReactNode;
}

export function NavPermissionsProvider({ initialPermissions, children }: NavPermissionsProviderProps) {
  return (
    <NavPermissionsContext.Provider value={initialPermissions}>{children}</NavPermissionsContext.Provider>
  );
}

/** The per-module "view" visibility map computed once in RootLayout — the
 * Sidebar and Command Palette both read this instead of re-deriving
 * permission from a per-page `isAdmin` prop. */
export function useNavPermissions(): NavPermissions {
  const context = React.useContext(NavPermissionsContext);
  if (!context) {
    throw new Error("useNavPermissions must be used within a NavPermissionsProvider");
  }

  return context;
}
