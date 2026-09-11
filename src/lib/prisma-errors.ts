import { Prisma } from "@prisma/client";

const RECORD_NOT_FOUND_ERROR_CODE = "P2025";
const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";
const WRITE_CONFLICT_ERROR_CODE = "P2034";

/**
 * Shared Prisma error classifiers, extracted from the identical per-module
 * copies the units/ledgers/ledger-groups modules each carried (the same
 * promotion pattern as src/lib/run-action.ts).
 *
 * Deliberately NOT adopted (yet) by the modules whose local helpers differ
 * in shape or semantics: financial-year (its isRetryableTransactionError
 * treats P2002 as retryable because of its hand-written partial unique
 * index), users/bank-accounts (they expose their own meta.target extraction
 * helpers), company and roles (untouched to keep the extraction scoped) —
 * consolidate those only when a change touches them anyway.
 */

export function isRecordNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === RECORD_NOT_FOUND_ERROR_CODE
  );
}

/**
 * The violated constraint's column names, however this Prisma client/driver
 * reports them. Historically (and still true for some providers) that was a
 * plain `meta.target` string array. The Postgres driver adapter this project
 * runs on (`@prisma/client` 7.8.0) instead nests it under
 * `meta.driverAdapterError.cause.constraint.fields`, with each entry
 * Postgres-quoted (e.g. `"companyId"`, quote characters included) — found by
 * inspecting a real P2002 thrown against a live database, since neither
 * shape is documented against this exact version. Checking both keeps this
 * helper correct regardless of which shape a given error arrives in.
 */
function violatedConstraintColumns(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta as
    | { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } }
    | undefined;

  if (Array.isArray(meta?.target)) {
    return meta.target as string[];
  }

  const fields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields)) {
    return fields.map((field) => String(field).replace(/^"|"$/g, ""));
  }

  return [];
}

/**
 * Optionally narrowed to a specific column for models with more than one
 * unique constraint (e.g. Unit's per-company name and symbol), so callers
 * can produce a field-specific friendly message.
 */
export function isUniqueConstraintError(error: unknown, column?: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_CONSTRAINT_ERROR_CODE
  ) {
    return false;
  }
  if (!column) {
    return true;
  }
  return violatedConstraintColumns(error).includes(column);
}

/**
 * True only for a Serializable write conflict (P2034) — deliberately does
 * NOT treat P2002 as retryable, since P2002 means a genuine uniqueness
 * violation (a real business error to surface immediately, not a transient
 * concurrency conflict to silently retry past). A module whose unique
 * constraints CAN surface transiently under concurrency (financial-year's
 * hand-written partial unique index on isCurrent) keeps its own wider
 * helper instead of using this one.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === WRITE_CONFLICT_ERROR_CODE
  );
}
