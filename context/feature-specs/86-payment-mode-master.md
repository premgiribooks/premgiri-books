# 86 - Payment Mode Master

> Feature-spec file number 86 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s **Phase 11 — Payment & Collections
> Management** item **#83 Payment Mode Master** — the first item of that newly-inserted
> phase, and the foundation specs 88–90 (#84–#86, Payment Mode Integration into Sales/
> Purchase/Manual-Voucher documents, not yet drafted) will build on. Depends on Ledger
> Master (feature-spec 14, implemented) and Bank Management (feature-spec 15,
> implemented) only for its *concepts* (Cash-in-Hand ledger, `BankAccount`-linked
> ledger) — no change to either module. **Read `52-payment-voucher.md`'s Project Context
> first** for the existing Cash-in-Hand-or-`BankAccount`-linked ledger-class
> classification (`src/lib/ledger-class.ts`) this spec's own `ledgerClass` field is
> designed to be checked against later, by specs 88–90 — **not by this spec itself** (see
> Goal and Do Not).

## Goal

Implement a **Payment Mode master** for **Premgiri Books ERP** — Cash, Bank Transfer,
UPI, Card, Cheque, and any other company-defined mode — so that every "pick a ledger +
type a free-text reference" payment line already in this app (Sales Invoice's
`payments[]`, Purchase Invoice's `payments[]`, Sales/Purchase Return's refund line,
Receipt/Payment/Contra Voucher's Cash/Bank-restricted side) can, in later specs, require
an explicit, structured mode selection instead of trusting an unvalidated string.

**Why this is needed, in one line**: today, `SalesInvoicePaymentLedgerOption`
(`38-sales-invoice.md`) explicitly documents "any active ledger, per this spec's 'no new
mapping needed for cash/bank' decision" — there is no way to know, report on, or
validate *how* a payment was received/paid (cash in hand vs. a specific bank transfer
type vs. a cheque) anywhere in this codebase.

**This spec is deliberately narrow — master data only.** It does **not** touch any
existing payment-capturing screen, and it does **not** build the ledger-class-matching
validator (which ledger a given mode may be used with) that a real consumer would need —
per `code-standards.md`'s YAGNI principle, that cross-module check is built once a real
consumer exists (spec 88, #84, is the first), not speculatively here. This spec only
needs to exist and be seeded before #84–#86 can begin.

---

# Project Context

Before implementation, review

- `13-ledger-groups.md` / `14-ledger-master.md` — the `Ledger`/`LedgerGroup` shape and
  the seeded "Cash-in-Hand"/"Bank Accounts" groups this spec's `ledgerClass` field names
  refer to (conceptually, not by a foreign key — see Data Model)
- `15-bank-management.md` — `BankAccount.upiId` already exists as an optional field on a
  bank account; this spec does **not** duplicate or reference it directly — a UPI
  *payment mode* is a label a user picks on a payment line, independent of whether the
  underlying bank account happens to also record a UPI handle
- `52-payment-voucher.md`'s Project Context — `src/lib/ledger-class.ts`'s
  `assertLedgersAreCashOrBank`/`getCashAndBankLedgerIds`, built around a private
  `isCashOrBankClass(ledgerGroupId, hasBankAccount, cashGroupIds)` helper that currently
  answers only a binary "Cash-or-Bank vs. neither" question. Specs 88–90 will need a more
  granular three-way classification (CASH vs. BANK vs. NEITHER) to check against this
  spec's `ledgerClass` field — **do not build that here**; it is named in this spec's Do
  Not section as explicitly out of scope, left for spec 88 to extract alongside its own
  first real use
- `src/modules/administration/services/tenant-bootstrap-events.ts` — the
  `DOMAIN_EVENTS.COMPANY_BOOTSTRAPPED` side-effect registration list Ledger Groups/
  Ledgers already use to seed their own defaults at company creation; this spec adds one
  more line here, exactly like that file's own header comment invites ("Add a line here
  when a future module ... needs its own defaults seeded on company creation")
- `ai-workflow-rules.md` (Database Workflow: verify no existing entity/relationship can
  be reused before adding a table — confirmed here: no existing model represents "a
  payment mode," `BankAccount.upiId` is a bank-account *attribute*, not a mode a user
  selects on a payment line)

---

# Module Responsibilities

The Payment Mode module is responsible for

- Payment Mode Master (Create/Edit/View/Activate/Deactivate, company-scoped)
- Seeding five defaults (Cash, Bank Transfer, UPI, Card, Cheque) at company creation
- Exposing a `listActivePaymentModes(companyId)`-style read for later specs' dropdowns

The Payment Mode module is **not** responsible for

- Validating any payment line's ledger against a chosen mode's `ledgerClass` — that
  cross-module check is specs 88–90's job (#84–#86), not this one
- Wiring a Payment Mode field into Sales Invoice, Purchase Invoice, Sales/Purchase
  Return, or any manual voucher — see specs 88–90
- Cheque number/bank/due-date/cleared-bounced tracking (a **Cheque Register** — the
  phase's own recorded Do Not; Cheque here is a plain label, nothing more)
- Bank reconciliation, bank statement import, or UPI settlement-status tracking (all
  `phases.md`'s Phase 12 — Future Features)

---

# Data Model

Add to `prisma/schema.prisma`:

```text
enum PaymentModeLedgerClass {
  CASH   // valid only against a Cash-in-Hand-subtree ledger
  BANK   // valid only against a ledger carrying a BankAccount
  ANY    // valid against either CASH or BANK (never a non-cash/bank ledger)
}

model PaymentMode {
  id              String                  @id @default(uuid())
  companyId       String
  company         Company                 @relation(fields: [companyId], references: [id])
  name            String
  ledgerClass     PaymentModeLedgerClass
  isSystemDefined Boolean                 @default(false)
  isActive        Boolean                 @default(true)
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
}
```

`ledgerClass` is **not** a foreign key to `LedgerGroup` — it is a coarse, fixed
three-value classification (matching the existing binary Cash-or-Bank test's own two
non-trivial cases, plus `ANY`), not a ledger-group reference. This mirrors
`architecture-context.md`'s own posture toward `AccountNature`/`BalanceType`: a small
fixed enum describing a *kind*, not a relation into the chart of accounts.

`isSystemDefined` marks the five seeded defaults (see Business Rules) — present for the
same reason `Ledger.isSystemDefined`/`Role.isSystemDefined` exist: so a later spec or UI
can distinguish "came with the company" from "a user added this," without special-casing
by name string.

---

# Business Rules

- **Name unique per company** (`@@unique([companyId, name])`), case-sensitive exact
  match — matching every other master in this codebase's uniqueness convention (Ledger,
  Bank Account, Product).
- **Seeded at company creation**: five `PaymentMode` rows, `isSystemDefined: true`, added
  via a new `src/modules/payment-modes/events/register-bootstrap-handler.ts` registered
  on `DOMAIN_EVENTS.COMPANY_BOOTSTRAPPED` (imported from
  `tenant-bootstrap-events.ts`, one new line — no change to
  `tenant-bootstrap-service.ts` itself, exactly like Ledger Groups/Ledgers' own
  precedent):
  | Name          | `ledgerClass` |
  | ------------- | ------------- |
  | Cash          | `CASH`        |
  | Bank Transfer | `BANK`        |
  | UPI           | `BANK`        |
  | Card          | `BANK`        |
  | Cheque        | `BANK`        |
- **Company-defined modes beyond the five defaults are allowed** (e.g. a company wants
  separate "NEFT"/"RTGS"/"IMPS" rows instead of one "Bank Transfer") — Create is not
  restricted to the seeded set; `ledgerClass` is chosen per new mode by the user
  (`BANK` or `CASH` — `ANY` is available too, for a company that genuinely does not want
  ledger-class enforcement on a particular mode once specs 88–90 wire that check in).
- **No permanent delete** — Activate/Deactivate only, identical posture to every other
  master in this codebase. A seeded (`isSystemDefined: true`) mode can be deactivated
  like any other; deactivating "Cash" does not delete or affect any ledger.
- **Editing** (`name`, `ledgerClass`) is allowed on any Payment Mode, including seeded
  ones — this master carries no downstream foreign key from any existing table yet (see
  Goal), so there is nothing to retroactively invalidate. Once specs 88–90 add a
  `paymentModeId` column to a payment line, changing `ledgerClass` afterwards only
  affects future validation, never re-validates already-posted lines — that spec must
  record this explicitly when it lands.
- **Company-scoped**, identical posture to every spec in this project — never accept a
  company id from the client.

---

# Service / Repository

Create

```text
src/modules/payment-modes/repositories/payment-mode-repository.ts
src/modules/payment-modes/services/payment-mode-service.ts
src/modules/payment-modes/validation/payment-mode-schema.ts
src/modules/payment-modes/actions/payment-mode-actions.ts
src/modules/payment-modes/components/…
src/modules/payment-modes/events/register-bootstrap-handler.ts
```

- `paymentModeRepository`: `findMany(companyId)`, `findActive(companyId)`, `findById`,
  `create`, `update`, `setActive` — the standard master-data repository shape already
  established by `ledgerRepository`/`bankAccountRepository`.
- `paymentModeService`: `listPaymentModes(companyId)`, `listActivePaymentModes(companyId)`
  (the option-list read later specs' dropdowns call), `createPaymentMode`,
  `updatePaymentMode`, `activatePaymentMode`/`deactivatePaymentMode` — name uniqueness
  checked here (`isUniqueConstraintError` pattern already used throughout this codebase),
  each gated by `assertPermission`.
- `register-bootstrap-handler.ts`: registers a `DOMAIN_EVENTS.COMPANY_BOOTSTRAPPED`
  handler that inserts the five seeded rows (via `paymentModeRepository.create`, or a
  small batched insert) inside the same transaction bootstrap already runs in — mirroring
  `src/modules/ledgers/events/register-bootstrap-handler.ts`'s own shape exactly.

---

# Validation

Zod (`payment-mode-schema.ts`): `name` required, trimmed, max 100 characters;
`ledgerClass` required enum (`CASH` | `BANK` | `ANY`). No other fields are user-editable
(`isSystemDefined`/`isActive` are server-controlled).

---

# UI

Pages (under the existing `/accounting` route, alongside Ledger Groups/Ledger Master/
Bank Management)

- `/accounting/payment-modes` — list (Name, Ledger Class badge, Status, Actions) with
  search
- `/accounting/payment-modes/new` — Create
- `/accounting/payment-modes/[id]/edit` — Edit

Components (`src/modules/payment-modes/components/`): Payment Mode Form, Payment Mode
Table, Payment Mode Status Badge, Ledger Class Badge — following this codebase's existing
master-data component conventions exactly (see Bank Management's own component list).

Wire-up

- Add a "Payment Modes" card to the `/accounting` hub page.
- Add `leaf("Payment Modes", "/accounting/payment-modes", <icon>)` to
  `src/config/navigation.ts`'s Accounting group.
- Add `"payment-modes": "Payment Modes"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the existing `accounting` permission module (no new permission catalog entries
needed — matching Ledger Groups/Ledger Master/Bank Management/Payment Voucher, all
already under this module): `view` (list/detail), `create`, `edit` (including Activate/
Deactivate, matching Bank Management's own convention of gating status changes under
`edit`, not a separate action). No `delete` — see Business Rules. Company-scoped
identically to every spec in this project.

---

# Database

New model: `PaymentMode`. New enum: `PaymentModeLedgerClass`. No changes to `Ledger`,
`LedgerGroup`, `BankAccount`, or `Company`.

---

# Code Standards

Strict TypeScript, no `any`, no business logic in components, Repository → Service → UI
layering. Vitest coverage for:

- Name uniqueness per company (rejects a duplicate, allows the same name in a different
  company)
- The five defaults are seeded exactly once per company on bootstrap, with the correct
  `ledgerClass` per row and `isSystemDefined: true`
- Create/Edit accepts any `ledgerClass` value, including on a seeded row
- Activate/Deactivate toggles `isActive` only, never touches any other field
- No permanent delete path exists (no repository/service method to remove a row)
- Cross-company isolation (a payment mode id from another company is treated as not
  found)

---

# Do Not

Do not implement

- Any validation that checks a payment line's ledger against a mode's `ledgerClass` —
  deferred to spec 88 (#84), the first real consumer
- A `paymentModeId` field on `SalesInvoicePayment`, `PurchaseInvoicePayment`, or any
  manual-voucher entry — those are specs 88–90's own schema changes, not this one's
- A Cheque Register (cheque number, bank, due/clearance date, bounced status) — the
  phase's own recorded Do Not
- Any change to `src/lib/ledger-class.ts`, `voucherEngine`, `paymentVoucherService`, or
  any existing Sales/Purchase document's payment handling
- Bank reconciliation, bank statement import, or UPI settlement-status tracking

---

# Success Criteria

Verify

- A brand-new company is seeded with exactly five `PaymentMode` rows (Cash/CASH, Bank
  Transfer/BANK, UPI/BANK, Card/BANK, Cheque/BANK), all `isSystemDefined: true` and
  `isActive: true`.
- A company can create additional Payment Modes with any name/`ledgerClass` combination;
  name is unique per company.
- No Payment Mode can be permanently deleted — only deactivated.
- Payment Modes are scoped to the active company only; an id from another company is
  treated as not found.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/accounting/payment-modes*` appears in the build route table.

Feature-spec 86 (this spec) is `context/Phases/phase-tracker.md`'s Phase 11 item #83.
Feature-spec 87 (Liability Settlement, tracker #87) does not depend on this spec — it
composes existing Trial Balance/Payment Voucher primitives only, and will simply gain a
Payment Mode field on its pre-filled form once a later spec (#84–#86) wires one into
Payment Voucher. The next specs in tracker order (#84–#86, not yet drafted) are the ones
that will actually consume this master's `ledgerClass` field.
