// 85-dashboard.md — pure month-bucketing/ranking helpers for the ERP
// Dashboard. Deliberately NOT a refactor of gst-dashboard.ts's own
// module-private monthKey/bucketByMonth (74-gst-reports.md): that file is
// shipped and tested, and its bucketing is hard-typed to GstSupplyLine's own
// sumTax accessor — generalizing it would touch a shipped, unrelated module
// for zero behavioral gain. financial-report-filters-schema.ts's own
// isValidCalendarDate/toUtcDate duplication (documented there) is this
// codebase's own precedent for small duplication over centralization. No
// I/O, no permission checks (Reporting Engine convention, 64-trial-balance.md).

export interface MonthBucket {
  /** `YYYY-MM`, the UTC calendar month of the bucketed items' date. */
  month: string;
  total: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Buckets `items` by the UTC calendar month of `getDate(item)`, summing
 * `getValue(item)` per month. A month with no items is omitted, not
 * zero-filled (matching gst-dashboard.ts's documented behavior exactly) —
 * sorted chronologically.
 */
export function bucketByMonth<T>(
  items: readonly T[],
  getDate: (item: T) => Date,
  getValue: (item: T) => number
): MonthBucket[] {
  const byMonth = new Map<string, number>();
  for (const item of items) {
    const key = monthKey(getDate(item));
    byMonth.set(key, (byMonth.get(key) ?? 0) + getValue(item));
  }

  return [...byMonth.entries()]
    .map(([month, total]) => ({ month, total: round2(total) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Sorts `rows` by `getValue` descending and truncates to `limit` — the
 * Dashboard's own "Top N" addition on top of an existing grouped report
 * output (no new grouping, per 85-dashboard.md's Widget mapping table).
 * Non-mutating; `limit` beyond `rows.length` is simply the whole array.
 */
export function topN<T>(rows: readonly T[], getValue: (row: T) => number, limit: number): T[] {
  return [...rows].sort((a, b) => getValue(b) - getValue(a)).slice(0, limit);
}
