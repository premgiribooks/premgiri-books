// Shared cell-parsing helpers for *-import-target.ts's own resolveRow
// implementations — spreadsheet cells are always strings; these convert them
// into the plain scalar/number/boolean shapes each target's own Zod schema
// expects, accumulating a human-readable error into the caller-supplied
// `errors` array on failure rather than throwing (every row's errors are
// collected and reported together, never fail-fast on the first bad cell).

const TRUE_VALUES = new Set(["true", "yes", "y", "1"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0", ""]);

export function getCell(row: Record<string, string>, key: string): string {
  return (row[key] ?? "").trim();
}

export function getOptionalCell(row: Record<string, string>, key: string): string | undefined {
  const value = getCell(row, key);
  return value === "" ? undefined : value;
}

export function parseOptionalNumber(raw: string | undefined, label: string, errors: string[]): number | undefined {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    errors.push(`${label} must be a number.`);
    return undefined;
  }
  return value;
}

export function parseRequiredNumber(raw: string, label: string, errors: string[]): number | undefined {
  if (raw === "") {
    errors.push(`${label} is required.`);
    return undefined;
  }
  return parseOptionalNumber(raw, label, errors);
}

/** Accepts TRUE/FALSE, YES/NO, Y/N, 1/0 (case-insensitive); blank defaults to `false`. */
export function parseBoolean(raw: string | undefined, label: string, errors: string[]): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  errors.push(`${label} must be Yes/No (or True/False).`);
  return false;
}
