# 90 - Quick-Create Shortcuts & Type-Anywhere Item/Party Search

> Feature-spec file number 90 (spec-file numbers are sequential and never reused — the
> highest prior file was `89-offline-sqlite-sync.md`). Requested directly by the user as a
> cross-cutting daily-usability improvement, not drawn from `context/Phases/phase-tracker.md`'s
> own numbered item sequence — like `84-navigation-ia-overhaul.md`, it touches Sidebar/
> Command-Palette infrastructure and two existing transaction forms rather than adding one
> new business domain, so it carries no phase-tracker `#` item. **Documentation only, drafted
> 2026-09-14 — nothing in this spec is implemented yet.**
>
> **Correction to spec 84's own header note:** that spec's intro claims it was "not yet
> pushed or merged into `main`" as of its writing. Verified during this spec's research
> (`git show main:src/components/layout/command-palette.tsx` etc.) — spec 84's Sidebar
> rewrite, Command Palette, Favorites, and Recent Pages are **already live on `main`**, fully
> wired into `AppShell`/`TopNavbar`. Everything below builds on that real, merged
> implementation, not a pending one.

## Goal

Three related, additive improvements to how a daily user gets in and out of the app's
busiest screens and busiest forms — none of them change business logic, permissions
enforcement, the database schema, or any existing route:

1. **Type-anywhere item/party search in Sales Invoice and Purchase Invoice line entry.**
   Today the Product field on an invoice line, and the Customer/Supplier field on the
   invoice header, are plain native-style dropdowns (`ProductOptionSelector`, and two raw
   `Select`s) with no search box at all — the only "filtering" a user gets is Base UI
   Select's built-in jump-to-first-letter typeahead. A user with 300 products has to
   remember (or scroll to) the exact name; typing "shirt" to find "Men's Cotton Shirt"
   does nothing. This spec replaces those three pickers with a real combobox that matches
   on **any substring**, anywhere in the name (or code/barcode/mobile/GSTIN), the same
   `contains`-based match every list-page filter bar and the Ctrl+K Command Palette
   already use elsewhere in this codebase.
2. **A quick-create "+" button on Sidebar items that lead to a list page with a "New X"
   action** (Sales Invoices → New Sales Invoice, Purchase Invoices → New Purchase Invoice,
   Products → New Product, Payment/Receipt Vouchers → New Payment/Receipt Voucher, and
   every other Sales/Purchase leaf that already has a confirmed `/new` route) — so a user
   who wants to start a new sale doesn't have to open the Sales Invoices list page first
   and then hunt for its own "+ New" button. The icon sits immediately to the left of the
   existing favorite-star icon on that Sidebar row, using the identical hover-reveal
   treatment.
3. **The 4 highest-traffic pages (Sales Invoices, Purchase Invoices, Products, Payment
   Vouchers) show up by default in Favorites** — closing the "every day use page" gap in
   spec 84's already-shipped Favorites/Recent mechanism, which today starts genuinely
   empty for a brand-new browser until the user manually stars something. No new
   mechanism: this is a smarter default value for the exact same `localStorage`-backed
   favorites store spec 84 already built, fully overridable by the user afterward (they can
   un-star any of the four, or star others).

None of these three touch `Prisma`, add a Server Action, or introduce a new permission
module — see Do Not.

---

# Project Context

Before implementation, review

- `84-navigation-ia-overhaul.md` — the Sidebar, Command Palette, `use-favorites.ts`,
  `use-recent-pages.ts`, and `src/config/navigation.ts`'s `NavItem`/`NavLeaf`/`NavGroup`
  tree this spec extends. Confirmed merged to `main` (see header note above) — treat its
  "Architecture / Implementation" file table as the current, live state of these files, not
  a pending change.
- `75-global-search.md` — the `contains`/`mode: "insensitive"` substring-search convention
  (`productService.listProducts({ search })`, `customerService.listCustomers({ search })`,
  `supplierService.listSuppliers({ search })`) this spec's combobox reuses for its
  server-search fallback path (see Business Rules) and that `src/lib/global-search.ts`
  already consumes for the Ctrl+K palette's DATA tier.
- `38-sales-invoice.md` / `44-purchase-invoice.md` — the existing Sales/Purchase Invoice
  forms this spec's combobox slots into. Read alongside the actual current files:
  - `src/modules/products/components/product-option-selector.tsx` (108 lines) — a thin
    wrapper around the Base UI `Select` primitive (`src/components/ui/select.tsx`). Takes
    `options: ProductOptionItem[]` (`{id, label, isActive}`) and renders every option as a
    `<SelectItem>`. **There is no text input inside it at all** — whatever "filtering" it
    has is Base UI Select's own built-in first-letter-jump typeahead, not substring
    matching. Consumed by `src/modules/sales-invoices/components/sales-invoice-line-row.tsx`
    (line 13, 96-103) and `src/modules/purchase-invoices/components/purchase-invoice-line-row.tsx`
    (line 12, 87-93).
  - `src/modules/sales-invoices/components/sales-invoice-form.tsx` (lines 244-266) and
    `src/modules/purchase-invoices/components/purchase-invoice-form.tsx` (lines 214-240) —
    the Customer/Supplier header fields, each a raw `<Select>`/`<SelectContent>` mapping
    over `options.customers`/`options.suppliers` with the same no-search-input limitation.
  - `src/modules/sales-invoices/services/sales-invoice-service.ts`,
    `listSalesInvoiceFormOptions()` (lines 774-809) — confirms **every** active
    product/customer for the company is fetched once, in full, with no `search` parameter
    at all, when the invoice form's page loads. There is no per-keystroke backend call in
    this flow today because there is no backend call in this flow at all past the initial
    page load.
  - `context/code-standards.md`'s Naming Conventions section (lines 278-286) already lists
    aspirational names `ProductSearch.tsx`/`CustomerSelector.tsx` that **do not exist** —
    the actual implementation, `ProductOptionSelector`, is a plain `Select`, not a search
    component. This spec is what finally builds the search behavior that document always
    assumed existed.
- `src/components/layout/sidebar-item.tsx` (full file, 103 lines) — the favorite-star
  button this spec's quick-create "+" sits beside. `SidebarItemProps` (lines 14-27):
  `icon`, `label`, `collapsed`, `href?`, `active?`, `indent?`, `onClick?`, `favorite?`,
  `onToggleFavorite?`. The star (lines 54-71) renders only when `!collapsed &&
  onToggleFavorite`, uses `lucide-react`'s `Star`, hover-reveals via `opacity-0
  group-hover/sidebar-item:opacity-100` (the parent link/button carries
  `group/sidebar-item`, line 41), stays opaque when `favorite` is true, and calls
  `event.preventDefault(); event.stopPropagation();` before firing, because it lives inside
  the row's own `<Link>`.
- `src/config/navigation.ts` (full file, 265 lines) — `NavLeaf`/`NavGroup` types (lines
  74-107), neither carries any "create" route field today. Confirmed-existing `/new`
  routes (via `Glob` over `src/app/**`): every Sales leaf (`invoices`, `quotations`,
  `orders`, `challans`, `returns`, `credit-notes`, `debit-notes`) and every Purchase leaf
  (`invoices`, `orders`, `receipts`, `returns`) has its own `.../new/page.tsx`; so do
  `masters/products/new/page.tsx`, `accounting/payment-vouchers/new/page.tsx`, and
  `accounting/receipt-vouchers/new/page.tsx`. In every confirmed case the create route is
  exactly `href + "/new"` — no divergent naming found anywhere in Sales, Purchase, Masters
  → Products, or the two voucher leaves.
- `src/lib/global-search.ts` (77 lines), `src/components/layout/command-palette.tsx` (257
  lines), `src/hooks/use-favorites.ts` (81 lines), `src/hooks/use-recent-pages.ts` (83
  lines) — all real, merged, wired into `AppShell`/`TopNavbar` today. `use-favorites.ts`
  persists an array of hrefs to `localStorage` key `premgiri.favorites.v1` via a
  `useSyncExternalStore` module, starting from an empty array when the key doesn't exist
  yet — the exact default this spec changes for item 3.

---

# Module Responsibilities

This feature is responsible for

- A new, reusable `Combobox` UI primitive and its use inside exactly two existing forms'
  Product/Customer/Supplier fields (Sales Invoice, Purchase Invoice) — nothing else
  changes about those forms
- An additive `createHref` field on `NavLeaf` and the Sidebar/`SidebarItem` rendering that
  turns it into a "+" icon button
- The default (first-run-only) seed value of the existing `use-favorites.ts` store

This feature is **not** responsible for, and does not change

- Any Server Action, service method, or Prisma query's actual filtering logic — the
  substring match this spec surfaces in the invoice forms is the same `contains`/`mode:
  "insensitive"` query `product-repository.ts` (lines 244-252), `customer-repository.ts`
  (lines 126-128), and `supplier-repository.ts` (lines 60-62) already run for every other
  screen; this spec does not add a new query shape, ranking algorithm, or full-text search
  index (same explicit exclusion `75-global-search.md` already made)
- Any page's own create/edit authorization gate — the quick-create "+" only ever links to
  a route that already exists and already enforces its own permission; it introduces one
  new, narrow **visibility** rule (see Business Rules) but never a new enforcement path
- The Command Palette's DATA tier, ranking, or debounce behavior (unchanged) — only its
  Favorites section's default seed value changes, and only because `use-favorites.ts`'s
  default changes underneath it
- Any master/list page beyond Products/Customers/Suppliers, or any form beyond Sales
  Invoice/Purchase Invoice — extending the combobox to Payment Voucher/Receipt Voucher's
  ledger picker, Quotations, Sales Orders, etc. is a natural, cheap follow-up once this
  pattern exists, not built here (YAGNI, matching `75-global-search.md`'s own "a fifth
  entity is a cheap mechanical extension... not built speculatively here" precedent)

---

# Data Model

**No new Prisma model, enum, or migration.** All three sub-features are pure
presentation/composition:

- The combobox reads the exact same already-fetched (or, for the server-search fallback,
  already-existing) product/customer/supplier rows — it introduces no table of its own.
- `createHref` is a plain string literal on each `NavLeaf` entry in `src/config/
  navigation.ts` (a TypeScript config file, not persisted state).
- The Favorites default lives in `use-favorites.ts`'s client-side `localStorage`
  initialization, exactly like every other client preference spec 84 already established
  (sidebar collapsed state, recent pages) — not database state.

---

# Business Rules

## 1. Item/Party search — substring match, existing-options-first

- **Client-side substring filter over the already-loaded option set is the v1
  implementation — not a new debounced server call.** `listSalesInvoiceFormOptions()` (and
  its Purchase equivalent) already fetch every active product/customer/supplier for the
  company once, up front, with no `search` parameter — that data is already sitting in the
  browser. The new `Combobox` filters that same in-memory array by
  `label.toLowerCase().includes(query.toLowerCase())` (matching on name, and for Products
  also `productCode`/`barcode`, and for Customer/Supplier also mobile/GSTIN, mirroring
  exactly which fields each repository's own `contains` query already checks) — this is a
  pure rendering change, it adds no round trip, no debounce, and no new Server Action for
  the common case. This keeps the feature aligned with this codebase's offline-sync
  direction (`89-offline-sqlite-sync.md`): a combobox that depends on a live per-keystroke
  network call would regress worse under sync/offline conditions than one that filters data
  already resident in the browser.
- **A company whose active product count is large enough that the existing full-preload
  itself becomes the bottleneck is an existing, pre-existing condition this spec does not
  change or worsen** — `listSalesInvoiceFormOptions()` already pays that cost today, before
  this spec exists. If/when that preload itself needs to become paginated or
  server-searched, that is a separate, larger change to the invoice-options-loading path,
  not this spec's concern (see Do Not).
- **Matching is case-insensitive substring, not fuzzy/typo-tolerant.** "shirt" matches
  "Men's Cotton Shirt"; "mens shrt" (transposed/misspelled) does not — consistent with
  every other `contains`-based search already in this codebase (list-page filter bars,
  Global Search's DATA tier), so results behave identically everywhere a user already
  searches today. True fuzzy/typo-tolerant matching (e.g. trigram similarity) is out of
  scope (see Do Not, matching `75-global-search.md`'s identical exclusion).
- **Inactive products/customers/suppliers are excluded**, matching the existing behavior of
  `listSalesInvoiceFormOptions()`/its Purchase equivalent today — this spec changes how the
  already-fetched active-only set is searched, never which records are fetched.
- **Keyboard-first, matching this codebase's existing billing-screen convention**
  (`code-standards.md`'s "keyboard-first navigation... minimize mouse dependency" already
  cited by `75-global-search.md`): arrow keys move the highlighted option, Enter selects,
  Escape closes without changing the current value — the same interaction shape the
  Command Palette's own `Command` component already provides, reused here rather than
  hand-rolled a second time.

## 2. Sidebar quick-create "+"

- **`createHref` is populated only for a `NavLeaf` whose target `/new` route is
  independently confirmed to exist** — never derived automatically by string-concatenating
  `href + "/new"` at render time (that would silently produce a dead link for any future
  leaf added without a create page). For this spec's initial rollout, `createHref` is set
  on: every Sales leaf (`/sales/invoices`, `/sales/quotations`, `/sales/orders`,
  `/sales/challans`, `/sales/returns`, `/sales/credit-notes`, `/sales/debit-notes`), every
  Purchase leaf (`/purchase/invoices`, `/purchase/orders`, `/purchase/receipts`,
  `/purchase/returns`), Masters → Products (`/masters/products`), and Accounting → Payment
  Vouchers / Receipt Vouchers (`/accounting/payment-vouchers`, `/accounting/receipt-vouchers`)
  — the exact set this spec's research confirmed has a real `.../new/page.tsx`. Any other
  leaf simply has no `createHref`, and renders no "+" — this is additive metadata, not a
  blanket rule applied to every leaf.
- **Visibility of the "+" requires the leaf's owning permission module's `create` action,
  not merely `view`.** Spec 84's `getNavPermissions()` only ever resolved `view` — enough
  to decide whether a nav row renders at all, but not enough to decide whether that user
  can actually submit the destination `/new` page (a `view`-only role would otherwise see a
  "+" that leads to a page whose own Server Action then rejects the submit — confusing, not
  a security hole, since the destination page's own gate is the real enforcement boundary,
  but bad UX and worth avoiding). This spec adds one small, additive extension:
  `getNavPermissions()` (or a new sibling, `getNavCreatePermissions()`, following the exact
  same `cache()`-wrapped, batched-`rolePermission.findMany` pattern, filtered to `action:
  "create"` instead of `"view"`) returning a second `Record<PermissionModule, boolean>` map
  consumed only by the Sidebar's "+" rendering decision — no existing `view`-gating code
  path changes.
- **The Sidebar resolves the final prop, `SidebarItem` stays permission-agnostic** — exactly
  like `active`/`favorite` today, `SidebarItem` receives an already-resolved
  `quickCreateHref?: string` (present only when both `leaf.createHref` is set **and** the
  current user's create-permission map grants it); the component itself does no permission
  lookup, matching its existing "dumb, fully-controlled" design.
- **Collapsed (icon-only) rail:** the "+" — like the star — renders only in the expanded
  rail (`!collapsed`), matching the star's existing behavior and avoiding cramming a third
  icon into an already single-icon collapsed row.
- **Click semantics mirror the star exactly**: `event.preventDefault();
  event.stopPropagation();` before navigating, since the "+" sits inside the row's own
  `<Link>` to the list page — clicking "+" must navigate to the *create* route, not the
  list route the row itself links to.
- **Command Palette parity is in scope wherever it's a trivial reuse of the same
  `createHref`/create-permission data**, since spec 84's palette already renders a favorite
  star next to each Pages-tier row from the identical `NavLeaf`; a "+" affordance next to
  the same rows (Enter still opens the list page; a distinct action/keybind or icon click
  opens the create route) is a one-line extension of data already resolved for the
  Sidebar — not a second, parallel permission computation.

## 3. Default Favorites

- **First-run default only, never a forced/un-removable pin.** `use-favorites.ts`'s
  `localStorage` initializer changes from an empty array to `["/sales/invoices",
  "/purchase/invoices", "/masters/products", "/accounting/payment-vouchers"]` **only when
  the `premgiri.favorites.v1` key does not exist yet** (a brand-new browser/profile) — any
  existing favorites array, including one a user has already emptied out entirely by
  un-starring everything, is left completely untouched. The four seeded hrefs use
  `toggleFavorite` exactly like a manually-starred page: the user can un-star any of them
  the same way, and the result persists exactly like any other favorite change today.
- **Seeded hrefs must each resolve to a real, currently-visible `NavLeaf` for the viewing
  user**, exactly like every other favorite/recent-page resolution spec 84 already
  performs (`leafByHref` lookup) — a user without `masters:view` (and therefore no visible
  Products leaf) simply sees 3 default favorites, not a broken/blank entry for the fourth.
  This is the existing `filterNavigation`/`leafByHref` behavior, unchanged, simply now also
  applying to the seeded set the same way it already applies to manually-starred ones.

---

# Architecture / Implementation

**New files**

| File | Purpose |
| --- | --- |
| `src/components/ui/combobox.tsx` | Generic, reusable searchable-select primitive (`Popover` + the existing `Command` component already used by `command-palette.tsx` — same dependency, no new library) — accepts `options: {id, label, secondaryLabel?}[]`, `value`, `onChange`, `placeholder`; performs the case-insensitive substring filter described above |

**Edited files**

| File | Change |
| --- | --- |
| `src/modules/products/components/product-option-selector.tsx` | Internals swapped from Base UI `Select` to the new `Combobox` — external props (`options`, `value`, `onChange`) unchanged, so `sales-invoice-line-row.tsx`/`purchase-invoice-line-row.tsx` need no changes at all |
| `src/modules/sales-invoices/components/sales-invoice-form.tsx` | Customer field's raw `Select` replaced with `Combobox` over `options.customers` (name + mobile/GSTIN as `secondaryLabel`) |
| `src/modules/purchase-invoices/components/purchase-invoice-form.tsx` | Supplier field's raw `Select` replaced with `Combobox` over `options.suppliers`, same shape |
| `src/config/navigation.ts` | `NavLeaf` gains optional `createHref?: string`; populated for the leaves listed in Business Rules §2 |
| `src/lib/permissions.ts` | + `getNavCreatePermissions()` (additive, mirrors existing `getNavPermissions()`) |
| `src/components/layout/sidebar-item.tsx` | + `quickCreateHref?: string` prop; renders a `Plus` (lucide-react) icon button immediately before the existing star block, same hover-reveal/`preventDefault`+`stopPropagation` treatment, `!collapsed`-gated |
| `src/components/layout/sidebar.tsx` | Resolves `quickCreateHref` per leaf (`leaf.createHref` gated by `useNavCreatePermissions()`) before passing it to `SidebarItem` |
| `src/components/layout/command-palette.tsx` | (if pursued per Business Rules §2's parity note) Pages-tier rows gain the same resolved "+" affordance |
| `src/hooks/use-favorites.ts` | First-run `localStorage` initializer seeds the 4 default hrefs instead of `[]`; every other read/write path unchanged |

**Explicitly not touched**: `src/modules/sales-invoices/services/sales-invoice-service.ts`
(`listSalesInvoiceFormOptions()` keeps fetching the same full active set, unchanged);
`product-repository.ts`/`customer-repository.ts`/`supplier-repository.ts`'s existing
`contains` queries (reused, not modified); `use-recent-pages.ts`; any existing permission
check; any existing route.

---

# UI

- **Combobox** replaces each of the three plain dropdowns with a text-input-first control:
  clicking (or focusing, or typing directly) opens a popover list filtered live as the user
  types, matching the same visual language as the Command Palette's own result list
  (grouped-list rows, keyboard highlight, `secondaryLabel` shown muted/smaller under the
  primary label — Product's code/barcode, Customer/Supplier's mobile/GSTIN). Empty-query
  state shows the full option list (unchanged behavior from today's plain dropdown); a
  query with no matches shows a "No matches for '…'" row rather than an empty popover.
- **Sidebar "+".** A `Plus` icon (`lucide-react`, `size={14}`, matching the star's own
  sizing) appears to the immediate left of the star, hidden until the row is hovered/
  focused (identical `opacity-0`/`group-hover/sidebar-item:opacity-100`/
  `focus-visible:opacity-100` treatment as the star), with an `aria-label` of `"Create new
  {label}"` (e.g. "Create new Sales Invoices" — reads slightly awkward pluralized;
  acceptable since it mirrors the leaf's own label exactly, matching how the star's own
  `aria-label` already does the same). Clicking navigates straight to the create route
  without ever visiting the list page.
- **Favorites.** No new UI — the existing Favorites section (Sidebar and Command Palette)
  simply starts non-empty for a first-time user, populated with Sales Invoices, Purchase
  Invoices, Products, and Payment Vouchers (each filtered by the existing visibility rule
  above).

---

# Security

- No new permission module. `getNavCreatePermissions()` reads the same `RolePermission`
  table `getNavPermissions()` already reads, filtered to `action: "create"` instead of
  `"view"` — purely additive, no existing check touched, no client-supplied identity or
  company parameter (session-derived, same as its sibling).
- **The Sidebar "+" is a rendering/visibility convenience, never an enforcement
  boundary** — exactly the same posture spec 84 already established for the entire nav
  tree. A user who somehow reaches a `/new` route without holding `create` (a direct URL
  visit, a stale bookmark) is still stopped by that page's own existing
  `assertPermission`/`hasPermission("create")` Server Action gate, completely unchanged by
  this spec. Hiding the "+" for a `view`-only role is a UX improvement (don't dangle an
  affordance that will fail), not the actual security control.
- The combobox introduces no new query, no new Server Action, and no new data exposure — it
  filters exactly the same already-fetched, already-permission-scoped
  (company-scoped, active-only) option set the existing forms already load today.

---

# Database

No new model, enum, or migration. See Data Model.

---

# Code Standards / Testing

- Strict TypeScript, no `any`. `Combobox` is a generic component (`Combobox<T>` or a fixed
  `{id, label, secondaryLabel?}` shape, whichever keeps `ProductOptionSelector`'s existing
  external prop contract unchanged) — no business logic of its own, matching the "compose,
  don't duplicate" posture `75-global-search.md` already set for search-adjacent code.
- Vitest coverage for:
  - The substring filter matches a query appearing anywhere in the label (not just as a
    prefix) — e.g. querying `"shirt"` matches an option labeled `"Men's Cotton Shirt"`.
  - `product-option-selector.tsx`'s external prop contract (`options`/`value`/`onChange`)
    is unchanged pre/post this spec — a regression test using its existing test fixtures,
    if any exist, or the callers' existing tests, continues to pass unmodified.
  - `getNavCreatePermissions()` returns `true` only for a module where a
    `RolePermission` row exists with `action: "create"`, mirroring `getNavPermissions()`'s
    own existing test shape for `"view"`.
  - Sidebar renders the "+" only when both `createHref` is set on the leaf **and** the
    resolved create-permission map grants it — a role with `view` but not `create` on a
    module never sees "+" on that module's leaves, even though it sees the leaf itself.
  - `use-favorites.ts`'s seeded-default behavior: a fresh (no existing key)
    `localStorage` yields the 4 default hrefs; an existing (even empty-array) key is never
    overwritten by the seed.
- `npx tsc --noEmit`, `npx eslint src`, and the existing vitest suite must stay clean,
  matching every prior spec's bar.

---

# Do Not

Do not

- Add a new Prisma model, enum, or migration
- Introduce a debounced per-keystroke Server Action for the invoice-form combobox in v1 —
  the client-side filter over the already-fully-loaded option set is the entire v1 scope;
  revisit only if the existing full-preload itself is separately identified as a
  performance problem (a different spec's concern, not this one's)
- Build full-text/fuzzy/typo-tolerant search (`pg_trgm`, a search index, Levenshtein
  matching) — v1 is the same case-insensitive substring match already used everywhere else
  in this codebase, for consistency, per `75-global-search.md`'s identical prior exclusion
- Derive `createHref` automatically (`href + "/new"`) at render time for every leaf — only
  set it explicitly, per leaf, after confirming the target route exists
- Let the Sidebar "+" (or its Command Palette twin, if built) substitute for, weaken, or
  bypass the destination `/new` page's own `assertPermission`/`hasPermission("create")`
  gate — it is a visibility convenience only
- Extend the combobox to any form beyond Sales Invoice/Purchase Invoice's Product/Customer/
  Supplier fields, or seed any Favorites default beyond the 4 named pages, without a new,
  explicit decision — both are deliberately narrow in this spec
- Force the 4 seeded favorites to be permanent/un-removable — they must remain fully
  user-editable through the exact same `toggleFavorite` mechanism as any other favorite

---

# Success Criteria

Verify

- Typing any substring of a product's name (e.g. `"shirt"` for "Men's Cotton Shirt"), not
  just its first letters, filters the Product field's option list live, in both the Sales
  Invoice and Purchase Invoice line-entry forms.
- The same substring behavior works for the Customer field (Sales Invoice) and Supplier
  field (Purchase Invoice), matching also against mobile/GSTIN.
- `product-option-selector.tsx`'s callers (`sales-invoice-line-row.tsx`,
  `purchase-invoice-line-row.tsx`) require no code changes — the external prop contract is
  unchanged.
- A Sidebar row for Sales Invoices/Purchase Invoices/Products/Payment Vouchers/Receipt
  Vouchers (and every other confirmed Sales/Purchase leaf) shows a "+" icon on hover, to
  the left of the star, that navigates straight to that leaf's `/new` route.
- A role holding `view` but not `create` on a module sees that module's Sidebar leaves
  normally, but never sees "+" on any of them.
- A brand-new browser profile's Favorites section (Sidebar and Command Palette) shows
  Sales Invoices, Purchase Invoices, Products, and Payment Vouchers by default, each
  independently un-starrable; an existing user's current favorites (including a
  deliberately emptied list) are never altered by this change.
- `npx tsc --noEmit`, `npx eslint src`, and the existing vitest suite all pass.

---

# Relationship to Specs 75 and 84

This spec is a direct, additive follow-up to both: it reuses spec 75's `contains`-based
search convention (rather than the un-merged, in-progress full-text-search fallback that
spec explicitly deferred) inside a real form for the first time, and it extends spec 84's
already-merged Sidebar/Favorites/Command-Palette infrastructure with quick-create
affordances and a smarter default rather than introducing a second, parallel navigation
mechanism. No part of spec 75 or 84 is modified in a way that changes its own previously
stated behavior — every change here is additive metadata (`createHref`, a create-permission
map, a seeded default array) layered on top of what already ships on `main`.
