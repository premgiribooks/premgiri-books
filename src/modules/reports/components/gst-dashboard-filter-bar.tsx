"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";

interface GstDashboardFilterBarProps {
  from: string;
  to: string;
}

/**
 * 74-gst-reports.md's own from/to filter bar — deliberately no Financial
 * Year selector (Validation: "a GST dashboard trend is date-range-scoped
 * only," matching `57-gst-registers.md`'s own filter shape rather than
 * `financial-year-date-range-filter-bar.tsx`'s Financial-Year-scoped one).
 * Same URL-state pattern as every other report filter bar in this batch:
 * every filter lives in the query string, so a full server re-render always
 * has the complete filter state.
 */
export function GstDashboardFilterBar({ from, to }: GstDashboardFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        From
        <Input
          type="date"
          value={from}
          onChange={(event) => updateParams({ from: event.target.value || undefined })}
          className="sm:w-40"
          aria-label="From date"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        To
        <Input
          type="date"
          value={to}
          onChange={(event) => updateParams({ to: event.target.value || undefined })}
          className="sm:w-40"
          aria-label="To date"
        />
      </label>
    </div>
  );
}
