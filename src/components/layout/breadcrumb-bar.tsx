"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBreadcrumbLabels } from "@/hooks/use-breadcrumb-label";
import { buildBreadcrumbTrail } from "@/lib/breadcrumb-trail";
import { cn } from "@/lib/utils";

export function BreadcrumbBar() {
  const pathname = usePathname();
  const router = useRouter();
  const dynamicLabels = useBreadcrumbLabels();
  const crumbs = buildBreadcrumbTrail(pathname, dynamicLabels);

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
