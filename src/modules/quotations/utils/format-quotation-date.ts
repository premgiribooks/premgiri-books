// Mirrors financial-year's formatFinancialYearDate exactly — a small,
// generic formatter duplicated per module rather than cross-imported, the
// established convention for this codebase's date/percent tolerance helpers.
export function formatQuotationDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
