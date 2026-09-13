import { describe, expect, it } from "vitest";

import { bucketByMonth, topN } from "@/engines/reporting/dashboard-summary";

interface Fixture {
  date: Date;
  value: number;
}

function fixture(date: string, value: number): Fixture {
  return { date: new Date(`${date}T00:00:00.000Z`), value };
}

describe("bucketByMonth", () => {
  it("returns an empty array for no items", () => {
    expect(bucketByMonth<Fixture>([], (item) => item.date, (item) => item.value)).toEqual([]);
  });

  it("sums values within the same UTC calendar month", () => {
    const result = bucketByMonth(
      [fixture("2026-04-05", 100), fixture("2026-04-20", 50)],
      (item) => item.date,
      (item) => item.value
    );

    expect(result).toEqual([{ month: "2026-04", total: 150 }]);
  });

  it("omits a month with no items rather than zero-filling it", () => {
    const result = bucketByMonth(
      [fixture("2026-01-01", 10), fixture("2026-03-01", 20)],
      (item) => item.date,
      (item) => item.value
    );

    expect(result).toEqual([
      { month: "2026-01", total: 10 },
      { month: "2026-03", total: 20 },
    ]);
  });

  it("buckets correctly across a UTC year boundary", () => {
    const result = bucketByMonth(
      [fixture("2025-12-31", 5), fixture("2026-01-01", 7)],
      (item) => item.date,
      (item) => item.value
    );

    expect(result).toEqual([
      { month: "2025-12", total: 5 },
      { month: "2026-01", total: 7 },
    ]);
  });

  it("sorts months chronologically regardless of input order", () => {
    const result = bucketByMonth(
      [fixture("2026-06-01", 1), fixture("2026-02-01", 2), fixture("2026-04-01", 3)],
      (item) => item.date,
      (item) => item.value
    );

    expect(result.map((bucket) => bucket.month)).toEqual(["2026-02", "2026-04", "2026-06"]);
  });

  it("rounds to 2 decimal places", () => {
    const result = bucketByMonth(
      [fixture("2026-04-01", 0.1), fixture("2026-04-02", 0.2)],
      (item) => item.date,
      (item) => item.value
    );

    expect(result).toEqual([{ month: "2026-04", total: 0.3 }]);
  });
});

describe("topN", () => {
  const rows = [
    { name: "a", value: 10 },
    { name: "b", value: 30 },
    { name: "c", value: 20 },
  ];

  it("sorts descending by value and truncates to the limit", () => {
    expect(topN(rows, (row) => row.value, 2)).toEqual([
      { name: "b", value: 30 },
      { name: "c", value: 20 },
    ]);
  });

  it("does not mutate the input array", () => {
    const copy = [...rows];
    topN(rows, (row) => row.value, 1);
    expect(rows).toEqual(copy);
  });

  it("returns the whole array when limit exceeds row count", () => {
    expect(topN(rows, (row) => row.value, 10)).toHaveLength(3);
  });

  it("returns an empty array for empty input", () => {
    expect(topN<{ value: number }>([], (row) => row.value, 5)).toEqual([]);
  });
});
