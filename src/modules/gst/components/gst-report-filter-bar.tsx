"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Shared date-range/party/HSN/rate filter UI for every Phase 8 GST report
 * screen (this spec's Registers, reused by specs 58-60). URL-state pattern —
 * mirrors physical-verification-filter-bar.tsx exactly: every filter lives
 * in the query string, so a full server re-render always has the complete
 * filter state (no client-side data fetching here).
 */
export function GstReportFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [hsnCode, setHsnCode] = React.useState(searchParams.get("hsnCode") ?? "");

  const updateParams = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams]
  );

  React.useEffect(() => {
    const current = searchParams.get("hsnCode") ?? "";
    if (hsnCode === current) {
      return;
    }
    const handle = setTimeout(() => updateParams({ hsnCode: hsnCode || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [hsnCode, searchParams, updateParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        From
        <Input
          type="date"
          value={searchParams.get("from") ?? ""}
          onChange={(event) => updateParams({ from: event.target.value || undefined })}
          className="sm:w-40"
          aria-label="From date"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        To
        <Input
          type="date"
          value={searchParams.get("to") ?? ""}
          onChange={(event) => updateParams({ to: event.target.value || undefined })}
          className="sm:w-40"
          aria-label="To date"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        HSN Code
        <Input
          value={hsnCode}
          onChange={(event) => setHsnCode(event.target.value)}
          placeholder="Filter by HSN…"
          className="sm:w-40"
          aria-label="Filter by HSN code"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Rate %
        <Input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={searchParams.get("ratePercent") ?? ""}
          onChange={(event) => updateParams({ ratePercent: event.target.value || undefined })}
          className="sm:w-28"
          aria-label="Filter by GST rate percent"
        />
      </label>
    </div>
  );
}
