// Storage for the hidden "temporary margin override" feature (Ctrl+Shift+M
// — src/config/shortcuts.ts). Per the feature's own requirement it lives in
// a cookie, not localStorage (10-day expiry, auto-clears itself) — a plain,
// non-httpOnly, client-written cookie rather than the Server-Action-set
// pattern current-company.ts uses for companyId/financialYearId/branchId:
// this is a pure per-browser UI preference (which price to *display*),
// never session/auth/tenant data, and AppShell (src/components/layout/
// app-shell.tsx) is itself a client component with no server-cookie prop to
// thread it through — reading/writing it directly here, same spirit as
// local-storage.ts's StorageService, is the simplest thing that works.
//
// The saved/posted price NEVER comes from this cookie — only Server Actions
// that call pricingEngine.resolvePrice (or, for print, the PDF route's own
// explicit, validated query param) ever produce what gets persisted.

const COOKIE_NAME = "premgiri_margin_override";
const MAX_AGE_SECONDS = 10 * 24 * 60 * 60;
const MAX_AGE_MS = MAX_AGE_SECONDS * 1000;

export interface MarginOverride {
  marginPercent: number;
  setAt: string;
}

function readRawCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function readMarginOverrideCookie(): MarginOverride | null {
  const raw = readRawCookie();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as MarginOverride).marginPercent !== "number" ||
      typeof (parsed as MarginOverride).setAt !== "string"
    ) {
      return null;
    }
    const override = parsed as MarginOverride;
    const age = Date.now() - new Date(override.setAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      return null;
    }
    return override;
  } catch {
    return null;
  }
}

export function writeMarginOverrideCookie(marginPercent: number): MarginOverride {
  const override: MarginOverride = { marginPercent, setAt: new Date().toISOString() };
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(override))}; max-age=${MAX_AGE_SECONDS}; path=/; samesite=lax`;
  }
  return override;
}

export function clearMarginOverrideCookie(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; samesite=lax`;
  }
}

export function marginOverrideDaysRemaining(override: MarginOverride): number {
  const elapsedMs = Date.now() - new Date(override.setAt).getTime();
  return Math.max(0, Math.ceil((MAX_AGE_MS - elapsedMs) / (24 * 60 * 60 * 1000)));
}
