import type { NavGroup, NavItem, NavLeaf } from "@/config/navigation";
import type { PermissionModule } from "@/constants/permissions";

export type NavPermissions = Record<PermissionModule, boolean>;

// A leaf's `permissionModule` may be a single module (the common case) or an
// array when its destination page checks more than one — e.g. GST Reports
// (src/app/reports/gst/page.tsx) requires both "reports:view" AND
// "gst:view". An unset `permissionModule` falls back to the parent group's
// module for a group child, or is treated as ungated for a top-level leaf
// (Dashboard).
function toModuleArray(value: PermissionModule | readonly PermissionModule[]): PermissionModule[] {
  // `typeof` rather than `Array.isArray` — TS's `arg is any[]` predicate
  // doesn't narrow a `readonly T[]` union member correctly in the
  // non-array branch (a readonly array isn't a subtype of mutable `any[]`),
  // but every `PermissionModule` is always a string, so this is unambiguous.
  return typeof value === "string" ? [value] : [...value];
}

function requiredModules(item: NavLeaf, parentModule?: PermissionModule): PermissionModule[] {
  if (item.permissionModule) {
    return toModuleArray(item.permissionModule);
  }
  return parentModule ? [parentModule] : [];
}

function isVisible(modules: PermissionModule[], permissions: NavPermissions): boolean {
  if (modules.length === 0) {
    return true;
  }
  return modules.every((module) => permissions[module] === true);
}

/**
 * Filters a leaf's optional third-level children the same way a group
 * filters its own children — falling back to `parentModule` (the enclosing
 * NavGroup's module) for a grandchild with no override of its own. Every
 * current third-level leaf (the Reports sub-hubs' report types) only ever
 * needs the top-level group's module ("reports"), so this never needs the
 * intermediate leaf's own module specifically.
 */
function filterLeafChildren(item: NavLeaf, parentModule: PermissionModule | undefined, permissions: NavPermissions): NavLeaf {
  if (!item.children || item.children.length === 0) {
    return item;
  }
  const visibleGrandchildren = item.children.filter((grandchild) =>
    isVisible(requiredModules(grandchild, parentModule), permissions)
  );
  return { ...item, children: visibleGrandchildren };
}

/**
 * Filters the navigation tree down to what the current user is allowed to
 * see, at the same granularity the app already enforces per-page: a leaf is
 * visible only if every one of its required permission modules grants
 * "view" (matching whatever its destination page actually checks — some
 * pages, like GST Reports, require more than one), and a group is visible
 * only if at least one of its children is. A leaf's own third-level
 * children (if any) are filtered the same way. Shared by the Sidebar and
 * the Command Palette so the visibility rule lives in one place.
 */
export function filterNavigation(tree: NavItem[], permissions: NavPermissions): NavItem[] {
  const result: NavItem[] = [];

  for (const item of tree) {
    if (item.type === "leaf") {
      if (isVisible(requiredModules(item), permissions)) {
        result.push(filterLeafChildren(item, undefined, permissions));
      }
      continue;
    }

    const visibleChildren = item.children
      .filter((child) => isVisible(requiredModules(child, item.permissionModule), permissions))
      .map((child) => filterLeafChildren(child, item.permissionModule, permissions));
    if (visibleChildren.length > 0) {
      result.push({ ...item, children: visibleChildren } satisfies NavGroup);
    }
  }

  return result;
}
