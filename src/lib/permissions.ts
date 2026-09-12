import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, getCurrentCompanyUser, type CompanyCurrentUser, type CurrentUser } from "@/lib/current-user";
import { PERMISSION_MODULES, type PermissionModule } from "@/constants/permissions";

/**
 * Only ever called for a CompanyCurrentUser — a PLATFORM user (Super Admin)
 * has no Role/company and bypasses this entirely via assertSuperAdmin()
 * (Permanent Architecture Principle 9: no platform.* permission catalog).
 *
 * Filters by companyId as well as role name — Role.name is only unique
 * *per company* now (architecture-Migration-Super-Admin-Administration's
 * per-company role split), so a name-only lookup would ambiguously match
 * another company's identically-named role.
 *
 * Deliberately does NOT additionally filter by role.isActive — a
 * deactivated role's existing users keep functioning under it per
 * 11-role-permissions.md ("those users keep their existing role
 * assignment"), so filtering here would silently revoke a still-assigned
 * user's access the moment a Company Admin hides the role from future
 * selection, which is a different, stronger action than the spec
 * describes. Defaults to deny only for an unknown module/action or a role
 * with no matching RolePermission row.
 *
 * cache()-wrapped so multiple permission checks for the same
 * (user, module, action) within one request/render pass — e.g. a page
 * checking the same permission from a Server Component and a nested one —
 * dedupe to a single query, mirroring current-user.ts's identical use of
 * cache() for getCurrentUser(). Relies on `user` being the same object
 * reference across those calls, which holds here since getCurrentUser()
 * is itself cache()-wrapped per request.
 */
export const hasPermission = cache(
  async (user: CompanyCurrentUser, module: string, action: string): Promise<boolean> => {
    if (!module || !action) {
      return false;
    }

    const match = await prisma.rolePermission.findFirst({
      where: {
        role: { name: user.role, companyId: user.companyId },
        permission: { module, action },
      },
      select: { id: true },
    });

    return match !== null;
  }
);

export async function assertPermission(
  user: CompanyCurrentUser,
  module: string,
  action: string
): Promise<void> {
  const allowed = await hasPermission(user, module, action);
  if (!allowed) {
    throw new AuthorizationError(`You do not have permission to ${action} ${module}.`);
  }
}

/**
 * Coarse nav/page-visibility gate for pages that used to call the removed
 * isCurrentUserAdmin() (Masters/Settings/Company/User/Role Management hub
 * pages and the Sidebar's adminOnly nav filter) — replaced with a real
 * permission check instead of a role-name compare, per Permanent
 * Architecture Principle 1/2. "settings"/"view" is granted to the
 * Company Admin role's full catalog coverage and to no other reserved
 * role's starting permission set, so this preserves today's exact
 * behavior (only a Company Admin sees these) without hardcoding a name.
 * Only ever called on a route already guaranteed to be COMPANY-only by
 * proxy.ts.
 */
export async function isCurrentUserCompanyAdmin(): Promise<boolean> {
  const user = await getCurrentCompanyUser();
  return hasPermission(user, "settings", "view");
}

/**
 * Batched nav-visibility read for the Sidebar/Command Palette (see
 * navigation-filter.ts): one query for every module the user holds "view"
 * on, instead of one hasPermission() round trip per module. Purely additive
 * — no existing page's own hasPermission()/isCurrentUserCompanyAdmin() gate
 * changes; this only feeds what the nav renders, not what a page allows.
 *
 * A PLATFORM user (Super Admin) has no Role/company and uses the separate
 * PlatformSidebar, which doesn't consult this; a null user is the
 * unauthenticated case (public pages render no Sidebar at all). Both get an
 * all-false map rather than throwing, since RootLayout calls this
 * unconditionally for every request.
 */
export const getNavPermissions = cache(
  async (user: CurrentUser | null): Promise<Record<PermissionModule, boolean>> => {
    const allFalse = Object.fromEntries(PERMISSION_MODULES.map((module) => [module, false])) as Record<
      PermissionModule,
      boolean
    >;

    if (!user || user.userType !== "COMPANY") {
      return allFalse;
    }

    const rows = await prisma.rolePermission.findMany({
      where: {
        role: { name: user.role, companyId: user.companyId },
        permission: { action: "view" },
      },
      select: { permission: { select: { module: true } } },
    });

    const granted = new Set(rows.map((row) => row.permission.module));
    return Object.fromEntries(
      PERMISSION_MODULES.map((module) => [module, granted.has(module)])
    ) as Record<PermissionModule, boolean>;
  }
);
