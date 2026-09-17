# 94 - Multi-Tab Page Navigation

> Feature-spec file number 94 (sequential, highest prior file was
> `93-payment-mode-integration-manual-vouchers.md`). Not tied to a Phase-tracker
> business-feature item — this is shell/UI infrastructure (App Router navigation
> chrome), requested directly by the user mid-session: "whenever i open a new page
> open it in new tab a[nd] new section below breadcrumb," clarified via
> `AskUserQuestion` into three concrete decisions recorded below. Drafted and
> implemented same-session, 2026-09-17.

## Goal

Every internal navigation (sidebar, breadcrumb, table-row links, global search
results, a form's post-save redirect — anything that changes the route) opens or
reuses an **in-app tab** in a new tab strip rendered below the Breadcrumb Bar,
instead of the current single-route-at-a-time behavior where navigating away
silently discards whatever the previous page was doing. Switching back to an
already-open tab must restore it exactly as left — same scroll position, same
unsaved filter/form input, same expanded panel state — not a fresh reload.

## Scope Decisions (from `AskUserQuestion`)

1. **True keep-alive, not a history shortcut.** A background tab's full
   component tree stays mounted; switching tabs never re-fetches or remounts it.
2. **In-app tab strip**, not literal browser tabs (`target="_blank"`) — a new UI
   row inside the shell, below `BreadcrumbBar`.
3. **Applies to every internal navigation**, not a narrower "master detail pages
   only" scope — wired once at the shell level (`AppShell`/`PlatformShell`), not
   per-page, so this is true for free everywhere including the ~40 existing
   filter-bar components already reading `usePathname()`/`useSearchParams()`.

## Architecture Decision — why not `cacheComponents`

Next.js 16 (this project's version) ships a native answer to almost this exact
problem: enabling `cacheComponents: true` makes the App Router preserve up to 3
previously visited routes via React's `<Activity>`, entirely automatically (see
`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`). This spec
**deliberately does not enable that flag** — it is a project-wide rendering/
caching model migration (the bundled `migrating-to-cache-components.md` guide
describes it as exactly that), requiring every Server Component's data-fetching
to be audited for correctness under the new model. That is out of proportion to
one navigation-chrome feature and violates `ai-workflow-rules.md`'s "work on only
one feature or subsystem at a time" / small-testable-changes rule.

Instead, this spec uses **React's `<Activity>` primitive directly** (bundled with
this project's own React 19.2, no new dependency — see
`node_modules/next/dist/docs/.../use-router.md` era React docs' own "Using
Activity in your components... useful for tabs" guidance) inside a
purpose-built outlet, combined with a **hand-rolled `href -> last rendered
content` cache** in `PageTabsProvider`, because:

- Next.js's App Router only ever hands a layout **one** route's rendered
  `children` at a time — there is no framework-level "keep N routes mounted"
  outside the `cacheComponents` migration this spec avoids. The provider's own
  cache is what makes background tabs possible at all.
- `<Activity mode="hidden">` gives real hide/show semantics — effects, timers,
  and subscriptions in a backgrounded tab clean up while hidden and re-run when
  shown again, exactly like an unmount/remount, but `useState`/DOM state (scroll
  position, uncommitted form input) survives in between. A plain CSS
  `display:none` div would *not* pause a backgrounded tab's timers/polling,
  risking unbounded background work as more tabs open — `<Activity>` avoids that
  for free.

**The router-sync problem this creates, and its fix.** Switching to an
already-open tab must not touch the provider's own content cache (that would
throw away the very state we're preserving), but ~40 existing components across
this codebase (`usePathname()`, `useSearchParams()` in every module's own
`*-filter-bar.tsx`, plus `Sidebar`/`BreadcrumbBar`) read Next's *own* router
state directly and would otherwise silently disagree with which tab is visually
active. The fix: a tab switch (`activate`/`close` in
`src/hooks/use-page-tabs.tsx`) always calls `router.replace(href, { scroll:
false })` to keep Next's router state truthful for the rest of the app, while a
`skipCacheUpdate` flag tells the provider's own sync logic to ignore whatever
Next re-renders for that route and keep the already-mounted, already-`Activity`-
wrapped instance visible instead. The accepted cost: switching back to an
already-open tab causes a background Next.js navigation (a real `router.replace`
round-trip, occasionally re-fetching server data depending on Next's own Router
Cache staleness window) even though the visible content doesn't change — this is
the "heavier, bigger change" trade-off explicitly chosen over the lighter
history-shortcut alternative in the `AskUserQuestion` answers.

**Tab cap.** `MAX_OPEN_TABS = 12` (`src/lib/page-tabs-reducer.ts`) — opening a
13th tab evicts the oldest *other* tab (never the one just opened) from both the
tab strip and the content cache, bounding how much background-mounted state (and
`<Activity>`-paused-but-still-allocated component trees) can accumulate in one
session.

## What This Spec Does Not Touch

- No business rule, database, repository, service, or engine — this is pure
  navigation/presentation chrome, wired once in `AppShell`/`PlatformShell`.
- No change to any of the ~40 existing filter-bar components, the Sidebar, or
  the Breadcrumb Bar's own rendering logic (`buildBreadcrumbTrail` was only
  *extracted*, not changed, into `src/lib/breadcrumb-trail.ts` so
  `resolvePageTitle` — the tab title source — can share it).
- No literal browser tabs (`target="_blank"`), no manual "new tab" button — tabs
  open implicitly, the same way browser history entries do, by navigating.
- No cross-session persistence of open tabs (a reload starts a single fresh
  tab at the current route) — the state being preserved (in-progress form
  input, scroll position) is inherently in-memory-only regardless.

## Implementation

```text
src/lib/page-tabs-reducer.ts       — pure state transitions (visitPage/activateTab/closeTab), unit-tested
src/lib/page-tabs-reducer.test.ts
src/lib/breadcrumb-trail.ts        — buildBreadcrumbTrail/resolvePageTitle, extracted from breadcrumb-bar.tsx
src/hooks/use-page-tabs.tsx        — PageTabsProvider/usePageTabs/usePageTabsContent (router-sync glue, not unit-tested)
src/components/layout/page-tabs-bar.tsx     — the visible tab strip
src/components/layout/page-tabs-outlet.tsx — <Activity>-based kept-alive content mounter
src/components/layout/app-shell.tsx         — wired: PageTabsProvider wraps the shell, PageTabsBar below BreadcrumbBar, PageTabsOutlet replaces {children}
src/components/layout/platform-shell.tsx    — same wiring for the Super Admin shell
```

Per this project's own testing convention (`vitest.config.ts` — `node`
environment, `*.test.ts` only, no component-rendering tests anywhere in this
codebase), the tab open/close/evict **decisions** are extracted into a
framework-free reducer (`page-tabs-reducer.ts`) and unit-tested; the React/
Next.js-router glue around it (`use-page-tabs.tsx`) is, like every other UI
feature in this codebase, verified by live manual/browser testing instead.

## Success Criteria

- Navigating anywhere (sidebar, breadcrumb, a list row, global search, a
  form's post-save redirect) opens or activates a tab for that route in the
  strip below the breadcrumb.
- Switching to a background tab is instant, shows exactly what was left
  (scroll position, in-progress form/filter input), and does not flash a
  loading state.
- Closing a tab falls back to the most recently opened remaining tab, or the
  dashboard once none remain.
- Opening a 13th tab evicts the oldest other tab, not the one just opened.
- The sidebar's active-item highlighting and the breadcrumb trail always
  match the tab currently showing, including right after a tab-strip switch
  (not just after a real navigation).
- `npx tsc --noEmit`, `npx eslint`, `npx vitest run`, and `next build` all pass.
