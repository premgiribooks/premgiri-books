import { BREADCRUMB_ID_PATTERN, BREADCRUMB_LABELS } from "@/constants/breadcrumbs";

export interface BreadcrumbCrumb {
  label: string;
  href: string;
}

// `previousSegment` lets a "parent/segment" composite key
// (BREADCRUMB_LABELS's own doc comment) disambiguate a segment reused by
// more than one section — checked before the bare segment, which stays the
// fallback for every segment that is not ambiguous.
function toLabel(segment: string, previousSegment: string | undefined): string {
  const composite = previousSegment ? BREADCRUMB_LABELS[`${previousSegment}/${segment}`] : undefined;
  const known = composite ?? BREADCRUMB_LABELS[segment];
  if (known) {
    return known;
  }
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Shared by `BreadcrumbBar` (renders the full trail) and the page-tabs
 * shell (`use-page-tabs.tsx`, wants only the last crumb as a tab title) —
 * a single source of truth for turning a pathname into human labels. */
export function buildBreadcrumbTrail(
  pathname: string,
  dynamicLabels: ReadonlyMap<string, string>
): BreadcrumbCrumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbCrumb[] = [];
  let href = "";
  let previousSegment: string | undefined;

  for (const segment of segments) {
    href += `/${segment}`;
    // A resource id (uuid) isn't meaningful on its own without fetching the
    // entity it points at, so it's dropped from the visible trail by
    // default — its parent href still carries it forward so the *next*
    // segment (e.g. "edit") links correctly. A page that has already
    // fetched its own entity can opt in to a real label via
    // useBreadcrumbLabel (see use-breadcrumb-label.ts); everything else
    // keeps the original drop-the-id behavior.
    if (BREADCRUMB_ID_PATTERN.test(segment)) {
      const dynamicLabel = dynamicLabels.get(href);
      if (dynamicLabel) {
        crumbs.push({ label: dynamicLabel, href });
        previousSegment = segment;
      }
      continue;
    }
    crumbs.push({ label: toLabel(segment, previousSegment), href });
    previousSegment = segment;
  }

  return crumbs;
}

const DASHBOARD_TITLE = "Dashboard";

/** The page/tab title for a route — the last breadcrumb crumb's label
 * (already resolving dynamic per-entity names via useBreadcrumbLabel, e.g. a
 * product's own name instead of its raw id), or "Dashboard" for the root
 * route, which has no crumbs of its own. */
export function resolvePageTitle(pathname: string, dynamicLabels: ReadonlyMap<string, string>): string {
  const trail = buildBreadcrumbTrail(pathname, dynamicLabels);
  return trail[trail.length - 1]?.label ?? DASHBOARD_TITLE;
}
