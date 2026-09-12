# 84 - Navigation & Information Architecture Overhaul

> Feature-spec file number 84 (spec-file numbers are sequential and never reused — the
> highest prior file was `83-itc-register.md`). **Retrospective spec, written after
> implementation**, not before — unlike most specs in this directory. Requested directly
> by the user as a cross-cutting UX/architecture change, not drawn from
> `context/Phases/phase-tracker.md`'s own `#00-83` sequence (it touches every existing
> module's navigation rather than adding one new business feature, so it carries no
> `#` item there) and not scoped to a single `phases.md` business-domain phase. Implemented
> across two conversation turns on branch `feature/navigation-ia-overhaul`
> (`d9ac101` implementation, `8e253f5` code-review/security-review fixes, `ca2a73e`
> tracker docs, plus a same-day follow-up UI-polish commit — see `progress-tracker.md`'s
> Current Phase entries, same dates, for the turn-by-turn narrative this spec
> summarizes). **Not yet pushed or merged into `main`** as of this writing — see that
> tracker for current status. Partially overlaps and substantially (not formally)
> implements **spec 75, Global Search** — see the note at the end of this spec.

## Goal

Convert Premgiri Books ERP's sidebar from a flat, non-expandable list that forced every
module through a two-step detour (Sidebar → a card-grid "hub" page, e.g. `/masters` →
click a card → the actual destination) into a real, hierarchical, permission-aware
parent/child menu — so every existing page is reachable in at most two or three clicks,
built only from routes that already exist. Alongside the sidebar rework: a global Ctrl/Cmd+K
quick-navigation palette, favorites, recently-visited pages, a mobile drawer, and (added in
a same-day follow-up round) a scrollable-but-visually-clean rail, tooltip consistency for
every collapsed icon (not just leaves), and a third navigation level for the one place in
the app where a hub page's own children are themselves further nested (Reports' six
sub-report hubs). None of this changes business logic, permission-check code, the database
schema, or any existing URL — every hub page (`/masters`, `/sales`, `/reports/sales`, etc.)
stays live and directly reachable, just no longer the forced path.

---

# Project Context

Before touching this area, review

- `03-Application-Shell.md` — the original flat 10-item Sidebar (`sidebar.tsx` +
  `sidebar-item.tsx`) and disabled Top Navbar search placeholder this spec replaces/wires
  up (the Top Navbar's search field is the same reserved slot spec 75/Global Search
  describes — this spec is what actually turns it into a working overlay, in the PAGES +
  a 3-entity DATA tier shape described below).
- Each existing hub page's own `page.tsx` (`masters/page.tsx`, `sales/page.tsx`,
  `purchase/page.tsx`, `inventory/page.tsx`, `accounting/page.tsx`, `gst/page.tsx`,
  `reports/page.tsx` plus its six sub-hubs, `employees/page.tsx`, `settings/page.tsx`) —
  each already had a typed `..._MODULES`/`..._VIEWS` const array of
  `{href, icon, title, description}`; this spec's nav tree is built by transcribing those
  arrays verbatim, not inventing new routes or labels.
- `src/lib/permissions.ts` (`hasPermission`, `assertPermission`,
  `isCurrentUserCompanyAdmin`) and `src/constants/permissions.ts`
  (`PERMISSION_MODULES`/`DEFAULT_ROLE_PERMISSIONS`) — the existing RBAC system this spec
  reads from but never modifies.
- `src/hooks/use-breadcrumb-label.ts` — the existing hand-rolled
  `useSyncExternalStore` + module-level-store pattern this spec's new client-preference
  hooks (sidebar state, favorites, recent pages, command-palette open state) all copy.
- `src/components/providers/auth-provider.tsx` — the existing "compute once server-side
  in the root layout, hand to a client provider as `initialX`" pattern this spec's new
  `NavPermissionsProvider` copies.
- `src/constants/breadcrumbs.ts` / `src/components/layout/breadcrumb-bar.tsx` — already
  covered every route this spec touches, including the new third-level Reports routes;
  verified, not modified.

---

# Module Responsibilities

This feature is responsible for

- The Sidebar's structure, active/expanded state, and permission-based visibility
- A global Ctrl/Cmd+K Command Palette (page search across the same tree, plus a small
  DATA-search tier over Products/Customers/Suppliers)
- Client-only preference state: sidebar collapsed/expanded, favorited pages, recently
  visited pages
- The mobile drawer (a `Sheet`-based rendering of the same Sidebar tree)

This feature is **not** responsible for, and does not change

- Any page's own authorization gate (`assertPermission`/`hasPermission` calls inside
  Server Actions/Services/Pages) — the nav-visibility layer added here is a rendering
  filter only, never a substitute enforcement boundary
- The database schema, any Prisma model, or any migration
- Any existing route, hub page, or breadcrumb label
- Full-text/fuzzy search infrastructure — the palette's PAGES tier is a plain substring
  match over static labels; its DATA tier reuses each target module's existing
  `contains`-based `search` filter exactly as spec 75 describes for the same three
  entities

---

# Data Model

**No new Prisma model, enum, or migration.** This feature reads existing
`RolePermission`/`Permission` rows (via one new additive query, see Business Rules) and
existing masters (Products/Customers/Suppliers, via each module's own service) — it
introduces no table of its own. Client-side preference state (sidebar collapsed/expanded,
favorites, recent pages) lives in `localStorage`, not the database — pure per-browser UI
preference, not business data, matching the "avoid unnecessary backend complexity" default.

---

# Business Rules

- **The nav tree is a data structure, not a component tree.** `src/config/navigation.ts`
  exports `NAVIGATION: NavItem[]`, the single source of truth for both the Sidebar and the
  Command Palette. A `NavItem` is either a `NavLeaf` (label/href/icon, optionally its own
  `permissionModule` override and, since the follow-up round, an optional third-level
  `children: NavLeaf[]`) or a `NavGroup` (label/icon/`permissionModule`/`children:
  NavLeaf[]`). Three levels deep, and no deeper: a `NavGroup`'s children are `NavLeaf`s,
  and a `NavLeaf` may itself carry `children` (also `NavLeaf`s, never carrying further
  `children` in practice) — this is one level deeper than the tree's first cut, added
  specifically where a hub page's own children are themselves further nested. Today that
  is **only** Reports' six sub-report hubs (Sales/Purchase/Inventory/Customer/Supplier/
  Employee Reports), each listing 4 report types; every other module's children are
  terminal leaves.
- **Permission gating matches what each destination page actually enforces — the real
  granularity the app supports today, no more.** A leaf without its own
  `permissionModule` inherits its parent group's module (e.g. every plain Masters child
  inherits `"masters"`). A leaf may override with a single module (Company
  Management/Branch Management → `"company"`, Financial Year → `"financial-year"`,
  Employees under Masters → `"employees"`, not `"masters"` — these were real page-vs-hub
  gate mismatches found and fixed during code review, see below) or, since a leaf may
  check more than one permission (GST Reports requires **both** `"reports:view"` and
  `"gst:view"`), an array of modules — every module in the array must grant `"view"` for
  the leaf (and, transitively, its parent group) to render. A third-level leaf's own
  required module(s) fall back to the enclosing top-level group's module when unset,
  since every current third-level leaf (the Reports sub-hubs' report types) only ever
  needs `"reports"`.
- **The visibility filter and the Sidebar/Palette rendering are two separate concerns.**
  `src/lib/navigation-filter.ts`'s `filterNavigation(tree, permissions)` is a pure
  function: a leaf renders only if every required module is granted; a group (or a
  third-level-bearing leaf) renders only if at least one child (or grandchild) does. It is
  called by both the Sidebar and the Command Palette so the rule lives in exactly one
  place, never duplicated.
- **One new, additive, batched permission read — no existing check touched.**
  `getNavPermissions(user)` (`src/lib/permissions.ts`) issues one
  `prisma.rolePermission.findMany` (filtered to `action: "view"`) per request,
  `cache()`-wrapped like the existing `hasPermission`, returning
  `Record<PermissionModule, boolean>`. A `PLATFORM` (Super Admin) or unauthenticated user
  gets an all-`false` map rather than throwing. This feeds only what the Sidebar/Palette
  *render* — every page's own `assertPermission`/`hasPermission` call is untouched and
  remains the real enforcement boundary.
- **A real, pre-existing permission-visibility gap this closes, without changing any
  permission-check code:** the `/masters` (and `/settings`) hub pages gate on the coarser
  `isCurrentUserCompanyAdmin()` (`settings:view`), while their own individual child pages
  gate on the finer `masters:view` — so a non-admin role holding `masters:view` (Sales,
  Purchase, Store Manager, per `DEFAULT_ROLE_PERMISSIONS`) could already open
  `/masters/products` directly by URL but got redirected away clicking through the
  `/masters` hub first. The new Sidebar gates the Masters *group* on `masters:view`
  (matching what its children actually enforce), correctly exposing those 9 master-data
  items to those roles without exposing Company Management/Financial Year/Branch
  Management (still individually gated on `company`/`financial-year`, which those roles do
  not hold).
- **Recent pages always canonicalize to the nearest real nav leaf, never a raw pathname or
  a bare entity id.** `AppShell` resolves the current pathname to the *most specific*
  (longest-href) matching `NAVIGATION` leaf — not just the first match in tree order,
  which matters now that a leaf can have its own third-level children with longer, more
  specific hrefs (e.g. `/reports/sales/register` must resolve to "Sales Register," not the
  broader "Sales Reports"). The Command Palette's own DATA-tier rows (an entity-specific
  href like `/masters/customers/{id}/edit`) are deliberately **not** recorded into recent
  pages at all, since they never resolve against a `NAVIGATION` leaf and would otherwise
  leave an inert entity id sitting in `localStorage` for no benefit.
- **Sidebar UI state is per-browser client preference, not synced or namespaced per
  company/user.** Collapsed/expanded rail state, favorited hrefs, and recent-page hrefs
  are each a small hand-rolled `useSyncExternalStore` + `localStorage` module (mirroring
  `use-breadcrumb-label.ts`'s existing pattern) — accepted, documented limitation: a
  shared/kiosk browser used across multiple company logins would see the previous
  session's favorite/recent *labels* (never entity data), the same posture this
  codebase's pre-existing `use-breadcrumb-label.ts` already has.

---

# Architecture / Implementation

**New files**

| File | Purpose |
| --- | --- |
| `src/config/navigation.ts` | The nav tree (`NavItem`/`NavGroup`/`NavLeaf` types, `NAVIGATION`, `flattenNavItems()`, `ALL_NAV_LEAVES`) |
| `src/lib/navigation-filter.ts` | `filterNavigation()` — the one shared permission-visibility rule |
| `src/lib/global-search.ts` | The Command Palette's DATA tier — a `"use server"` `searchEntities(query)` reusing `productService.listProducts`/`customerService.listCustomers`/`supplierService.listSuppliers` (already company-scoped + permission-checked internally); no direct Prisma access, no query logic duplicated |
| `src/components/providers/nav-permissions-provider.tsx` | `NavPermissionsProvider`/`useNavPermissions()` |
| `src/components/layout/sidebar-group.tsx` | Renders a top-level `NavGroup`: expand/collapse in the full rail; a click-to-open `Popover` flyout (with a real `Tooltip` for the icon, composed together — see UI) in the collapsed icon-only rail |
| `src/components/layout/sidebar-subgroup.tsx` | Renders a third-level branch (a `NavLeaf` with its own `children`, e.g. "Sales Reports") in the expanded rail — a nested, further-indented header that only toggles, mirroring a top-level group header |
| `src/components/layout/command-palette.tsx` | The Ctrl/Cmd+K overlay |
| `src/hooks/use-sidebar-state.ts`, `use-favorites.ts`, `use-recent-pages.ts`, `use-command-palette.ts` | `localStorage`-backed (or, for the palette's open state, pure in-memory) client preference stores |

**Edited files**

| File | Change |
| --- | --- |
| `src/lib/permissions.ts` | + `getNavPermissions()` (additive) |
| `src/app/layout.tsx` | + `NavPermissionsProvider` wiring (a few lines, next to the existing `AuthProvider`) |
| `src/components/layout/sidebar.tsx` | Rewritten: flat list → permission-filtered tree; active-route highlighting (derived from `usePathname()`, not hand-maintained); auto-expand on navigation (top-level **and**, since the follow-up round, third-level); collapsed-state persistence; a scrollable, scrollbar-hidden rail (see UI) |
| `src/components/layout/sidebar-item.tsx` | + `active` prop (didn't exist before at all, even in the original flat list); + inline favorite-star toggle; `indent` generalized from boolean to `0 \| 1 \| 2` for the new third level |
| `src/components/layout/app-shell.tsx` | Mounts `CommandPalette` + the mobile `Sheet` drawer; records recent-page visits via the closest-matching-leaf resolver |
| `src/components/layout/top-navbar.tsx` | The disabled search placeholder now opens the Command Palette; + a `md:hidden` hamburger button |

**Explicitly not touched**: any of the ~198 existing pages' own permission/redirect logic;
`BreadcrumbBar`/`breadcrumbs.ts` (already correct for every route, including the new
third-level ones — verified, not edited); `PlatformSidebar`/`/administration` (Super Admin
module, out of scope); Prisma schema; any existing Server Action/API contract; any
existing URL.

---

# UI

- **Hierarchy.** Two levels everywhere except Reports (three): Dashboard is a top-level
  leaf; every other module is a `NavGroup` whose header toggles expand/collapse (never
  navigates, matching how a group has no `href` of its own); a group's children are
  directly clickable leaves, except Reports' six sub-hubs, which themselves expand a third
  level of report types.
- **Active state.** Derived from the route (`usePathname()`), never hand-maintained: the
  active leaf gets a filled accent background; any ancestor group/sub-group whose subtree
  contains the active route gets bolded accent text. The containing group (and, for a
  third-level route, its sub-group too) auto-expands on navigation and on direct URL
  visit/refresh — guarded to fire once per pathname change so the user can still manually
  collapse a group afterward without the effect immediately re-expanding it.
- **Collapsed (icon-only) rail.** A top-level group's icon shows a real `Tooltip` on hover
  (the exact same `Tooltip`/`TooltipTrigger`/`TooltipContent` component Dashboard's own
  collapsed leaf icon already used) — composed together with a `Popover` on the same
  trigger button (`TooltipTrigger` wrapping a `PopoverTrigger` wrapping the actual
  `<button>`), so hovering shows the label exactly like any other collapsed item, while
  clicking still opens a flyout listing every child (and, for a Reports-style sub-hub
  child, its own grandchildren inline within that same flyout panel, since collapsed mode
  favors one flat overlay over further nested popovers). This replaced an earlier,
  inconsistent version that used the browser's native `title` attribute for group icons
  instead of the shared `Tooltip` component — the specific inconsistency the follow-up
  round's "make all menu tooltips the same component as Dashboard" request called out.
- **Scrollable rail, invisible scrollbar.** The rail's `ScrollArea` now carries `min-h-0`
  (a flex item defaults to `min-height: auto`, which refuses to shrink below its content
  size even inside an otherwise correctly sized flex column — without this fix, expanding
  enough groups simply grew the rail past the viewport instead of scrolling internally,
  which was the actual, verified bug behind "when the menu gets larger, make it
  scrollable") plus a `[&_[data-slot=scroll-area-scrollbar]]:hidden` rule that hides only
  the custom scrollbar thumb/track — the viewport's native overflow scrolling (wheel,
  touch, keyboard) is unaffected, so the rail scrolls with no visible scrollbar clutter.
- **Manually resizable rail.** A thin drag handle on the rail's right edge
  (`role="separator"`, pointer events, `src/components/layout/sidebar.tsx`) lets the user
  widen/narrow the expanded rail between 224px and 420px (default 256px, `src/hooks/
  use-sidebar-state.ts`'s `SIDEBAR_MIN_WIDTH`/`SIDEBAR_MAX_WIDTH`/`SIDEBAR_DEFAULT_WIDTH`),
  persisted the same way collapsed/expanded state is. Added because the third-level
  (grandchild) rows' deeper indent leaves less horizontal room for a label at the default
  width — some third-level labels (e.g. "Party-wise Purchases") were getting tight/
  truncated. Not shown in collapsed or mobile-drawer mode (both have their own fixed
  width). Verified via Playwright: dragging changes the rendered width live, the value
  persists across reload, and dragging past either bound clamps instead of overflowing.
- **Command Palette.** `Ctrl`/`Cmd`+`K` (or clicking the Top Navbar search field) opens an
  overlay built on the existing `Dialog` primitive. Empty query shows Favorites + Recent;
  typing filters the same permission-filtered tree (PAGES, including third-level report
  types) by label substring, plus a DATA tier (Products/Customers/Suppliers, ≥2 characters,
  debounced). Arrow keys move the selection, Enter navigates, Escape closes (native to the
  underlying dialog).
- **Favorites and Recent.** A star toggle appears on hover next to every Sidebar leaf and
  Command Palette page row; a non-empty Favorites section renders above the main tree,
  identically in both the rail and the palette. Recent pages populate automatically as the
  user navigates.
- **Mobile drawer.** Below the `md` breakpoint, the inline rail is replaced by a hamburger
  button in the Top Navbar opening a `Sheet`-based drawer containing the identical
  Sidebar tree in a "drawer" variant (always full width, no collapse control — the Sheet
  already has its own close affordance); it closes automatically on navigation.

---

# Security

No new permission module, and no existing authorization check weakened or removed —
verified independently by a security review (see Code Standards/Testing below).
`getNavPermissions()`/`global-search.ts` take no client-supplied identity or company
parameter (both are session-derived, server-only, mirroring `hasPermission`'s existing
pattern); the DATA-search tier issues no direct Prisma query, only calls to each target
module's own already-permission-checked service. The nav-visibility layer is purely a
rendering filter, not a security boundary — every page's own gate is what actually
enforces access, unchanged by this feature. `localStorage` stores only route hrefs and
label strings, never entity data or PII (one DATA-tier edge case — recording a clicked
search result's entity-specific href into "recent pages" — was found during security
review and fixed to only record hrefs that resolve to a real nav leaf).

---

# Database

No new model, enum, or migration. See Data Model.

---

# Code Standards / Testing

- `npx tsc --noEmit` and `npx eslint src` clean project-wide throughout (only the same 2
  pre-existing, unrelated warnings in an unrelated module).
- **Code review**: 2 HIGH (both permission-gate mismatches — Masters > Employees and
  Reports > GST Reports gated on the wrong module(s) versus their destination pages,
  detailed in Business Rules above) + 1 LOW (the DATA-tier recent-pages edge case), all
  three fixed. Verified with a temporary, uncommitted vitest file exercising
  `filterNavigation()` directly against six permission combinations (including both
  negative cases and the "both required modules granted" positive case for GST Reports) —
  all pass.
- **Security review**: APPROVE, 0 CRITICAL/HIGH/MEDIUM findings; 2 INFO notes (one fixed
  alongside the LOW code-review finding above; one — no explicit rate limiting on the new
  search Server Action beyond client-side debounce — accepted as a documented,
  non-blocking note, since every downstream service it calls already re-validates
  permission and company scope per call, and no broader Server-Action rate-limiting
  convention exists yet in this codebase to align with).
- **Real-browser verification**, both rounds, via a standalone Playwright script installed
  only into the session scratchpad (never added to this project's `package.json`/lockfile),
  logged in as the seeded `admin` user: direct Masters→Products navigation with no hub
  detour; auto-expand-on-active-route (including the new third-level case,
  `/reports/sales/register`) across a full page reload; Ctrl+K search and navigation;
  collapsed-state persistence across reload; the mobile drawer; the sidebar's genuine
  internal scroll (confirmed `scrollHeight > clientHeight` only after the `min-h-0` fix,
  and a real `scrollTop` change on mouse-wheel) with the scrollbar thumb never visible; the
  collapsed rail's Tooltip-then-Popover composition (hovering a group icon shows the same
  `Tooltip` component Dashboard's own icon uses; clicking still opens the flyout).
- One real bug found and fixed during the first round's browser verification (unrelated to
  the permission-gate findings above): `use-favorites.ts`/`use-recent-pages.ts`'s
  `getServerSnapshot()` returned a fresh `[]` array literal on every call instead of a
  stable reference, violating `useSyncExternalStore`'s caching contract (React logged "The
  result of getServerSnapshot should be cached to avoid an infinite loop") — fixed by
  returning a shared module-level constant, matching `use-sidebar-state.ts`'s already-
  correct pattern.

---

# Do Not

Do not

- Change any existing page's own `assertPermission`/`hasPermission` gate — this feature
  only reads permissions to decide what to render
- Add a new Prisma model, enum, or migration
- Rename or remove any existing route or hub page
- Extend the nav tree to a fourth level, or add third-level children anywhere other than
  Reports' six sub-hubs, without first confirming the destination page's own children are
  genuinely nested the same way (this tree is built from real routes only, never invented)
- Reintroduce a native browser `title` attribute (or any tooltip mechanism other than the
  shared `Tooltip` component) for a collapsed sidebar icon
- Sync or namespace the client-preference `localStorage` keys per user/company without a
  new, explicit decision — they are deliberately origin-scoped today, matching
  `use-breadcrumb-label.ts`'s existing precedent

---

# Success Criteria

Verified

- Every existing page is reachable from the Sidebar in at most two clicks (three for a
  Reports sub-report type), with no forced hub-page detour.
- Active parent/child (and, for Reports, grandparent/parent/child) highlighting is always
  correct and route-derived; auto-expands on direct URL visit, refresh, and browser
  back/forward.
- A role with `masters:view` but not `employees:view`/`company:view`/`financial-year:view`
  sees only the master-data items it actually has access to under Masters — not Company
  Management, Financial Year, Branch Management, or Employees.
- A role with `reports:view` but not `gst:view` (or vice versa) never sees GST Reports.
- Ctrl/Cmd+K opens the palette from any authenticated page; typing filters pages
  (including third-level report types) and, for a query of 2+ characters, surfaces
  matching Products/Customers/Suppliers.
- The rail scrolls internally (never grows past the viewport) once expanded content
  overflows, with no visible scrollbar track/thumb; wheel/touch/keyboard scrolling all
  still work.
- Every collapsed sidebar icon — leaf or group — shows the identical `Tooltip` component
  on hover; a group icon's click-to-open flyout still works alongside its tooltip.
- Sidebar collapse/expand state persists across a page reload.
- Mobile viewport (~375px) hides the inline rail and opens a working drawer from a
  hamburger button, closing on navigation.
- `npx tsc --noEmit`, `npx eslint src`, and the existing vitest suite all pass.

---

# Relationship to Spec 75 (Global Search)

This feature independently implements spec 75's Ctrl+K-overlay-over-the-Top-Navbar-search
mechanic and its Products/Customers/Suppliers DATA-search scope, but was not built as
"spec 75" and does not cover that spec's fourth entity (Ledgers) or formally satisfy its
acceptance criteria file. Treat spec 75 as **substantially, not formally, implemented** —
closing it properly would mean adding a Ledgers search call to `src/lib/global-search.ts`
(reusing an existing ledger-search-capable service the same way Products/Customers/
Suppliers already do) and cross-referencing this spec from that one, rather than
re-implementing it from scratch.
