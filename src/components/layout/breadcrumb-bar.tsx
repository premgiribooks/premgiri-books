"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BREADCRUMB_ID_PATTERN, BREADCRUMB_LABELS } from "@/constants/breadcrumbs";
import { useBreadcrumbLabels } from "@/hooks/use-breadcrumb-label";
import { cn } from "@/lib/utils";

interface Crumb {
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

function buildTrail(pathname: string, dynamicLabels: ReadonlyMap<string, string>): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
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

export function BreadcrumbBar() {
  const pathname = usePathname();
  const router = useRouter();
  const dynamicLabels = useBreadcrumbLabels();
  const crumbs = buildTrail(pathname, dynamicLabels);

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-4 text-sm">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Go back"
        onClick={() => router.back()}
      >
        <ArrowLeft size={16} />
      </Button>

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 overflow-x-auto">
        <Link
          href="/"
          className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dashboard"
        >
          <Home size={14} />
        </Link>

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.href}>
              <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
              {isLast ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className={cn("text-muted-foreground transition-colors hover:text-foreground")}
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
}
