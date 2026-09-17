# 106 - Global Error Boundaries

> Feature-spec file number 106 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 4 — Code Quality**,
> tracker item **#97 Global Error Boundaries**.
>
> Depends On: Next.js App Router.
> Can be worked concurrently with Phase 3 items.

## Goal

Add Next.js `error.tsx` boundaries to every App Router route segment so that
unhandled errors (Prisma exceptions, service errors, unexpected nulls) render a
user-friendly error page instead of a raw 500 or a blank white screen.

---

## Project Context

Read before implementation:

1. `src/app/` — the App Router directory tree. Map every route segment that currently
   lacks an `error.tsx`.
2. Next.js 15 App Router docs (`node_modules/next/dist/docs/`) — error boundaries,
   `error.tsx`, `global-error.tsx`.
3. The Attendance history page bug (from `context/progress-tracker.md` 2026-09-12
   session) — an invalid date reaching Prisma caused a crash because no boundary
   existed. This spec prevents that class of bug system-wide.

---

## Module Responsibilities

- `src/app/error.tsx` — top-level root error boundary (catches anything not caught
  by a segment-level boundary)
- `src/app/global-error.tsx` — catches errors in the root layout itself
- Segment-level `error.tsx` files for every major section:
  - `src/app/(app)/error.tsx` — all authenticated app routes
  - `src/app/(app)/sales/error.tsx`
  - `src/app/(app)/purchase/error.tsx`
  - `src/app/(app)/inventory/error.tsx`
  - `src/app/(app)/accounting/error.tsx`
  - `src/app/(app)/gst/error.tsx`
  - `src/app/(app)/reports/error.tsx`
  - `src/app/(app)/employees/error.tsx`
  - `src/app/(app)/masters/error.tsx`
  - `src/app/(app)/settings/error.tsx`
  - `src/app/administration/error.tsx`

---

## Error Boundary Component

```tsx
"use client";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  // Log to Pino via a server action (never expose raw error to client)
  return (
    <div className="error-container">
      <h2>Something went wrong</h2>
      <p>An unexpected error occurred. Please try again.</p>
      {process.env.NODE_ENV === "development" && (
        <pre>{error.message}</pre>
      )}
      <button onClick={reset}>Try Again</button>
    </div>
  );
}
```

Rules:
- Error message is never shown in production (only in development).
- A "Try Again" button calls `reset()` to re-render the segment.
- A "Go to Dashboard" link is present as a fallback navigation.
- The component uses the existing design tokens (not hardcoded colors).
- The component is a client component (`"use client"`) — required by Next.js.

---

## Business Rules

1. Error boundaries must not expose raw Prisma errors, stack traces, or internal
   identifiers in production.
2. In development mode, the raw `error.message` may be shown to aid debugging.
3. Every error caught by a boundary is logged server-side via Pino (not client-side
   `console.error`).

---

## Validation Rules

- The `digest` field on the error (Next.js's server error identifier) is logged server-
  side so the error can be correlated between the user report ("error code") and the
  server log.

---

## Testing Requirements

- Smoke test per major segment: a Server Component that throws renders the error
  boundary instead of a 500.
- Reset test: clicking "Try Again" clears the boundary and re-renders the segment.
- Production mode test: raw error message is NOT present in the rendered HTML.
