// Pure worked-day/net-salary arithmetic (63-payroll.md's Business Rules) — no
// I/O, no engine calls, no Prisma import. Every money figure is computed in
// integer paise to avoid float drift, mirroring
// purchase-invoice-calculations.ts's own convention.

/** Inclusive calendar-day count between two UTC-midnight dates. */
export function totalDaysInPeriod(periodStart: Date, periodEnd: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((periodEnd.getTime() - periodStart.getTime()) / msPerDay) + 1;
}

/**
 * `presentDays + 0.5 x halfDays` — `ABSENT`/`ON_LEAVE`/unmarked days
 * contribute zero (63-payroll.md's own documented MVP formula).
 */
export function computeWorkedDays(presentDays: number, halfDays: number): number {
  return presentDays + 0.5 * halfDays;
}

/**
 * `round(basicSalary x workedDays / totalDaysInPeriod, 2)`, half-up to
 * paise — the same rounding convention as every other money computation in
 * this codebase (`Math.round` on an integer-paise value).
 */
export function computeNetSalary(basicSalary: number, workedDays: number, totalDays: number): number {
  if (totalDays <= 0) {
    return 0;
  }
  const exactPaise = (basicSalary * workedDays * 100) / totalDays;
  return Math.round(exactPaise) / 100;
}

export function sumNetSalaryPaise(lines: readonly { netSalary: number }[]): number {
  return lines.reduce((paise, line) => paise + Math.round(line.netSalary * 100), 0);
}
