import type { NavGroup, NavItem, NavLeaf } from "@/config/navigation";
import type { PermissionModule } from "@/constants/permissions";

export type NavPermissions = Record<PermissionModule, boolean>;

function isLeafVisible(item: NavLeaf, parentModule: PermissionModule, permissions: NavPermissions): boolean {
  const effectiveModule = item.permissionModule ?? parentModule;
  return permissions[effectiveModule] === true;
}

/**
 * Filters the navigation tree down to what the current user is allowed to
 * see, at the same granularity the app already enforces per-page: a leaf is
 * visible only if its effective permission module grants "view", and a
 * group is visible only if at least one of its children is. Shared by the
 * Sidebar and the Command Palette so the visibility rule lives in one place.
 */
export function filterNavigation(tree: NavItem[], permissions: NavPermissions): NavItem[] {
  const result: NavItem[] = [];

  for (const item of tree) {
    if (item.type === "leaf") {
      // Dashboard and any other ungated leaf (no permissionModule set and no
      // parent group) is always visible.
      if (!item.permissionModule || permissions[item.permissionModule] === true) {
        result.push(item);
      }
      continue;
    }

    const visibleChildren = item.children.filter((child) => isLeafVisible(child, item.permissionModule, permissions));
    if (visibleChildren.length > 0) {
      result.push({ ...item, children: visibleChildren } satisfies NavGroup);
    }
  }

  return result;
}
