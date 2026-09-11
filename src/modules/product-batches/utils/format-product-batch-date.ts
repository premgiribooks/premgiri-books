// Mirrors format-physical-verification-date.ts / format-stock-transfer-date.ts
// exactly — duplicated per module rather than cross-imported, this
// codebase's established convention for small date formatting helpers.
export function formatProductBatchDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
