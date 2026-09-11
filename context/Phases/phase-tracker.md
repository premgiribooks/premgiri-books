# Premgiri Books ERP

# Implementation Phase Tracker

> This document tracks the implementation progress of Premgiri Books ERP.
>
> Each feature should only begin after all of its dependencies are completed.
>
> Update this file whenever a feature is completed or its implementation changes.

---

# Progress Legend

| Status | Meaning     |
| ------ | ----------- |
| ⬜     | Not Started |
| 🟨     | In Progress |
| ✅     | Completed   |
| ⛔     | Blocked     |
| 🔄     | Refactoring |

---

# Phase 1 — Platform Foundation

Goal

Build the reusable ERP platform before implementing business modules.

| #   | Feature                            | Status |
| --- | ---------------------------------- | ------ |
| 00  | Project Setup                      | ✅     |
| 01  | Design System                      | ✅     |
| 02  | Application Shell                  | ✅     |
| 03  | Local Storage & Desktop Foundation | ✅     |
| 04  | Prisma Setup                       | ✅     |
| 05  | Database Foundation                | ✅     |
| 06  | Authentication                     | ✅     |
| 07  | Company Management                 | ✅     |
| 08  | Financial Year Management          | ✅     |
| 09  | User Management                    | ✅     |
| 10  | Role & Permission Management       | ✅     |
| 11  | Branch Management                  | ✅     |

> ✅ **Status discrepancy resolved 2026-09-10:** #11 Branch Management's ✅ above was
> premature when first recorded (2026-07-14) — `context/feature-specs/12-branch-management.md`
> was drafted 2026-07-12 but not implemented until now. `src/modules/branch/` (Master
> CRUD: Create/Edit/View/Activate/Deactivate — no delete), `src/app/branch/**` (list, new,
> edit, and the optional `/branch/select` picker), and `src/lib/current-branch.ts` (the
> context helper) are implemented, code-reviewed, and security-reviewed with zero findings.
> The ✅ is now accurate. See `context/progress-tracker.md`'s Completed entry for the full
> implementation record.

Phase Status

✅ Completed

---

# Phase 2 — Core Business Foundation

Goal

Implement all master data and shared business engines required by transactional modules.

Phase Status

✅ Completed — Accounting Foundation group complete (all 5 implemented as of 2026-07-14). Inventory Masters group complete (all 7 implemented as of 2026-07-18): Unit Management (#17, `context/feature-specs/19-unit-management.md`) implemented 2026-07-14; Category Management (#18, `context/feature-specs/20-category-management.md`) implemented 2026-07-15; Brand Management (#19, `context/feature-specs/21-brand-management.md`) implemented 2026-07-15; HSN Management (#20, `context/feature-specs/22-hsn-management.md`) implemented 2026-07-15; GST Rate Management (#21, `context/feature-specs/23-gst-rate-management.md`) implemented 2026-07-15; Warehouse Management (#22, `context/feature-specs/24-warehouse-management.md`) implemented 2026-07-18; Product Management (#23, `context/feature-specs/25-product-management.md`) implemented 2026-07-18. Business Parties group complete (both implemented as of 2026-07-19): Customer Management (#24, `context/feature-specs/26-customer-management.md`) implemented 2026-07-19; Supplier Management (#25, `context/feature-specs/27-supplier-management.md`) implemented 2026-07-19. Pricing group complete (all 3 implemented 2026-07-19): Margin Profiles (#26), Price Lists (#27), Pricing Engine (#28). Shared ERP Engines group complete (all 4 implemented 2026-07-19): Voucher Engine (#29), Inventory Engine (#30), Document Number Engine (#32), and GST Engine (#31) — the last of the four. Phase 2 is now fully complete.

---

## Accounting Foundation

✅ Completed — Ledger Groups (#12, `context/feature-specs/13-ledger-groups.md`) implemented 2026-07-13. Ledger Master (#13, `context/feature-specs/14-ledger-master.md`) implemented 2026-07-13. Bank Management (#14, `context/feature-specs/15-bank-management.md`) implemented 2026-07-13. Expense Heads (#15, `context/feature-specs/16-expense-heads.md`) implemented 2026-07-14. Income Heads (#16, `context/feature-specs/17-income-heads.md`) implemented 2026-07-14.

| #   | Feature         | Depends On          | Status |
| --- | --------------- | ------------------- | ------ |
| 12  | Ledger Groups   | Database Foundation | ✅     |
| 13  | Ledger Master   | Ledger Groups       | ✅     |
| 14  | Bank Management | Ledger Master       | ✅     |
| 15  | Expense Heads   | Ledger Master       | ✅     |
| 16  | Income Heads    | Ledger Master       | ✅     |

---

## Inventory Masters

✅ Completed — Unit Management (#17, `context/feature-specs/19-unit-management.md` — spec file number 19 because 18 was already taken) implemented 2026-07-14. Category Management (#18, `context/feature-specs/20-category-management.md`) implemented 2026-07-15. Brand Management (#19, `context/feature-specs/21-brand-management.md`) implemented 2026-07-15. HSN Management (#20, `context/feature-specs/22-hsn-management.md`) implemented 2026-07-15. GST Rate Management (#21, `context/feature-specs/23-gst-rate-management.md`) implemented 2026-07-15. Warehouse Management (#22, `context/feature-specs/24-warehouse-management.md`) implemented 2026-07-18 — with the optional branch link only, since Branch Management (feature-spec 12) remains unimplemented (see the Phase 1 note). Product Management (#23, `context/feature-specs/25-product-management.md`) implemented 2026-07-18, closing the group.

Feature-specs for the remaining six items were all drafted 2026-07-14 (spec-file numbers are sequential and never reused, so tracker numbers and spec-file numbers diverge from here on — each spec records its own mapping):

| Tracker # | Feature              | Spec file                                         |
| --------- | -------------------- | ------------------------------------------------- |
| 18        | Category Management  | `context/feature-specs/20-category-management.md` |
| 19        | Brand Management     | `context/feature-specs/21-brand-management.md`    |
| 20        | HSN Management       | `context/feature-specs/22-hsn-management.md`      |
| 21        | GST Rate Management  | `context/feature-specs/23-gst-rate-management.md` |
| 22        | Warehouse Management | `context/feature-specs/24-warehouse-management.md` |
| 23        | Product Management   | `context/feature-specs/25-product-management.md`  |

| #   | Feature              | Depends On                                          | Status |
| --- | -------------------- | --------------------------------------------------- | ------ |
| 17  | Unit Management      | Database Foundation                                 | ✅     |
| 18  | Category Management  | Database Foundation                                 | ✅     |
| 19  | Brand Management     | Database Foundation                                 | ✅     |
| 20  | HSN Management       | Database Foundation                                 | ✅     |
| 21  | GST Rate Management  | Database Foundation                                 | ✅     |
| 22  | Warehouse Management | Company + Branch (see the Branch note in spec 24)   | ✅     |
| 23  | Product Management   | Categories + Brands + Units + GST + HSN + Warehouse | ✅     |

---

## Business Parties

Feature-specs for both items were drafted 2026-07-18. Customer Management (#24) was
implemented 2026-07-19 (git branch `new-features`); Supplier Management (#25) was
implemented later the same day (git branch `26-customer-manage`), closing this group.
Spec-file numbers are sequential and never reused, so they diverge from tracker numbers:

| Tracker # | Feature             | Spec file                                          |
| --------- | ------------------- | -------------------------------------------------- |
| 24        | Customer Management | `context/feature-specs/26-customer-management.md`  |
| 25        | Supplier Management | `context/feature-specs/27-supplier-management.md`  |

| #   | Feature             | Depends On    | Status |
| --- | ------------------- | ------------- | ------ |
| 24  | Customer Management | Ledger Master | ✅     |
| 25  | Supplier Management | Ledger Master | ✅     |

---

## Pricing

Feature-specs for all three items were drafted 2026-07-18 (not yet implemented).
Implementation order within the group: #26 → #27 → #28 (each spec depends on the prior;
the Pricing Engine additionally requires Customer Management #24 to be implemented
first, for `Customer.priceListId`):

| Tracker # | Feature         | Spec file                                          |
| --------- | --------------- | -------------------------------------------------- |
| 26        | Margin Profiles | `context/feature-specs/28-margin-profiles.md`      |
| 27        | Price Lists     | `context/feature-specs/29-price-lists.md`          |
| 28        | Pricing Engine  | `context/feature-specs/30-pricing-engine.md`       |

| #   | Feature         | Depends On                         | Status |
| --- | --------------- | ---------------------------------- | ------ |
| 26  | Margin Profiles | Product Management                 | ✅     |
| 27  | Price Lists     | Margin Profiles                    | ✅     |
| 28  | Pricing Engine  | Products + Customers + Price Lists | ✅     |

---

## Shared ERP Engines

Feature-specs for all four items were drafted 2026-07-18. All four are now implemented
(2026-07-19): Document Number Engine (#32), Voucher Engine (#29), Inventory Engine (#30),
and GST Engine (#31) — the last to land, independent of the other three. Specs 31 and 34
deliberately exclude the branch dimension while Branch Management (feature-spec 12)
remains unimplemented — each records a forward-note migration:

| Tracker # | Feature                | Spec file                                              |
| --------- | ---------------------- | ------------------------------------------------------ |
| 29        | Voucher Engine         | `context/feature-specs/31-voucher-engine.md`           |
| 30        | Inventory Engine       | `context/feature-specs/32-inventory-engine.md`         |
| 31        | GST Engine             | `context/feature-specs/33-gst-engine.md`               |
| 32        | Document Number Engine | `context/feature-specs/34-document-number-engine.md`   |

| #   | Feature                | Depends On                                          | Status |
| --- | ---------------------- | --------------------------------------------------- | ------ |
| 29  | Voucher Engine         | Ledger Master                                       | ✅     |
| 30  | Inventory Engine       | Products + Warehouse                                | ✅     |
| 31  | GST Engine             | GST Rates + HSN                                     | ✅     |
| 32  | Document Number Engine | Company + Financial Year (branch dimension deferred — see spec 34) | ✅     |

---

# Phase 3 — Sales Management

| #   | Feature           | Depends On                        | Status |
| --- | ----------------- | --------------------------------- | ------ |
| 33  | Quotations        | Customer + Products + Pricing     | ✅     |
| 34  | Sales Orders      | Quotations                        | ✅     |
| 35  | Delivery Challans | Sales Orders                      | ✅     |
| 36  | Sales Invoice     | Voucher + Inventory + GST Engines | ✅     |
| 37  | Sales Return      | Sales Invoice                     | ✅     |
| 38  | Credit Note       | Sales Invoice                     | ✅     |
| 39  | Debit Note        | Sales Invoice                     | ✅     |

Phase Status

✅ Complete — Quotations (#33, feature-spec 35), Sales Orders (#34, feature-spec 36), Delivery Challans (#35, feature-spec 37), Sales Invoice (#36, feature-spec 38), Sales Return (#37, feature-spec 39), Credit Note (#38, feature-spec 40), and Debit Note (#39, feature-spec 41) all implemented 2026-09-10 — all seven Phase 3 documents. Establishes the `/sales` hub and the shared header/line-item/engine-composition conventions the whole set reuses. "Convert to Sales Order" (Quotation's entry point into #34), "Create Delivery Challan" (Sales Order's entry point into #35), "Create Invoice" (Delivery Challan's entry point into #36), and "Create Return" (Sales Invoice's entry point into #37) are all wired up — see `context/progress-tracker.md`'s Completed entries for the full record. Sales Invoice is the first document in this chain to actually post to the Voucher/Inventory/GST Engines (every document before it is deliberately display-only/non-stock-moving) and closes the conversion chain; Sales Return is the first of three post-invoice adjustment documents, reusing Sales Invoice's Company Settings ledger mapping and posting conventions rather than re-deriving them. Credit Note is the second — a pure financial adjustment with freeform lines and no stock movement, reusing Sales Return's `RefundMode` enum. Debit Note is the third and last — the mirror of Credit Note, ledger direction reversed (Debit customer / Credit sales+tax), no refund-mode concept. Per `phases.md`, Phase 4 — Purchase Management (#40–#43) is next.

---

# Phase 4 — Purchase Management

| #   | Feature            | Depends On                | Status |
| --- | ------------------ | ------------------------- | ------ |
| 40  | Purchase Orders    | Supplier + Products       | ✅     |
| 41  | Goods Receipt Note | Purchase Order            | ✅     |
| 42  | Purchase Invoice   | Voucher + Inventory + GST | ✅     |
| 43  | Purchase Return    | Purchase Invoice          | ✅     |

Phase Status

✅ Complete — Purchase Orders (#40, feature-spec 42) implemented 2026-09-10 on
branch `42-purchase-orders`, the mirror of Sales Order (feature-spec 36) from the
purchase side: no financial/stock effect, `receivedQuantity` maintained exclusively
by `applyReceipt` (forward infrastructure for Goods Receipt Note, feature-spec 43,
which does not exist yet). `rate` prefills from `product.purchasePrice`, never
`resolvePrice` — no Pricing Engine call anywhere in this phase. Goods Receipt Note
(#41, feature-spec 43) implemented 2026-09-10 on branch `feature/goods-receipt-note`,
the mirror of Delivery Challan (feature-spec 37) from the purchase side: no
financial/stock effect, no Inventory Engine call anywhere in this module — Purchase
Invoice (feature-spec 44) remains the sole `StockTransactionType.PURCHASE` writer in
this phase. Receiving a GRN calls `purchaseOrderService.applyReceipt` atomically,
passing each line's combined `quantity + rejectedQuantity` as the fulfillment amount
(both count as "physically arrived" per the spec's Quantity rule, even though only
`quantity` is ever billed). "Create Goods Receipt Note" (Purchase Order's entry point
into #41) is wired up on the Purchase Order detail page. `markInvoiced` and
`listReceivedNotInvoiced` were forward infrastructure for Purchase Invoice, now
consumed. Purchase Invoice (#42, feature-spec 44) implemented 2026-09-10 on branch
`feature/purchase-invoice`, the mirror of Sales Invoice (feature-spec 38) from the
purchase side: the first Purchase document with real financial (`VoucherType.PURCHASE`)
and stock (`StockTransactionType.PURCHASE`/`IN`) consequences. Adds a six-field Company
Settings ledger mapping (five new + shared `roundOffLedgerId`) validated against the
"Purchase Accounts"/"Duties & Taxes" ledger groups on every posting, restricts payment
ledgers to the Cash-in-Hand group or a `BankAccount`-linked ledger, and matches an
optionally-linked Goods Receipt Note's lines via a `(productId, warehouseId, quantity)`
bijection. "Create Invoice" (Goods Receipt Note's entry point into #42) is wired up on
the Goods Receipt Note detail page. Purchase Return (#43, feature-spec 45) implemented
2026-09-11 on branch `feature/purchase-return`, the mirror of Sales Return
(feature-spec 39) from the purchase side, ledger and stock direction reversed — the
sole purchase-side adjustment document in this phase (no Purchase-side Credit
Note/Debit Note pair, unlike Phase 3's three-way split). Reuses Purchase Invoice's
six-field ledger mapping and its deep active/company-owned/correct-group validation
(extracted to `src/modules/company/utils/purchase-ledger-mapping.ts` so both documents
share one implementation instead of two), and restricts its `CASH_REFUND` refund ledger
to the Cash-in-Hand group or a `BankAccount`-linked ledger, mirroring Purchase Invoice's
payment-ledger rule. Posts `StockTransactionType.PURCHASE_RETURN`/`OUT` (goods leaving
the company's warehouse back to the supplier) and `VoucherType.PURCHASE_RETURN`
(Credit Purchase Account + Input Tax, Debit Supplier/refund ledger — the reversal of
Purchase Invoice's own posting). **This closes Phase 4 — Purchase Management in full
(all four documents, tracker #40–#43).**

---

# Phase 5 — Inventory

Feature-specs for all six items were drafted 2026-09-11 (documentation only, not
implemented), on a dedicated `docs/phase-5-6-feature-specs` branch — spec-file numbers
are sequential and diverge from tracker numbers as usual:

| Tracker # | Feature                | Spec file                                              |
| --------- | ----------------------- | ------------------------------------------------------ |
| 44        | Opening Stock          | `context/feature-specs/46-opening-stock.md`             |
| 45        | Stock Adjustment       | `context/feature-specs/47-stock-adjustment.md`          |
| 46        | Stock Transfer         | `context/feature-specs/48-stock-transfer.md`            |
| 47        | Physical Verification  | `context/feature-specs/49-physical-verification.md`     |
| 48        | Batch Tracking         | `context/feature-specs/50-batch-tracking.md`            |
| 49        | Serial Number Tracking | `context/feature-specs/51-serial-number-tracking.md`    |

Items #44–#47 are thin document/UI layers over the already-implemented Inventory Engine
(feature-spec 32) — no engine changes. #48/#49 are the two genuinely new schema
additions the Inventory Engine spec explicitly deferred to this phase (its own Do Not
section excludes batch/serial tracking): both extend only `StockTransaction` with an
optional `batchId`/`serialId` rather than retrofitting every existing document's item
table — a recorded trade-off (see each spec's Retrofit Decision) that leaves wiring a
batch/serial picker into Purchase Invoice, Sales Invoice, Purchase Return, Sales Return,
and #44–#47's own line editors as a named follow-up per document, not automatic. #48/#49
are also mutually exclusive per product (`isBatchTracked` / `isSerialTracked` cannot
both be true). Two open sanity-check flags from the drafting pass, not yet resolved by a
human: (a) whether Physical Verification (#49's spec, item #47) should reserve a new
`DocumentType.PHYSICAL_VERIFICATION` value now versus staying unreserved like Opening
Stock; (b) whether the batch/serial "extend `StockTransaction` only" trade-off is
acceptable given the deferred per-document retrofit cost it implies.

| #   | Feature                | Depends On         | Status |
| --- | ---------------------- | ------------------ | ------ |
| 44  | Opening Stock          | Products           | ✅     |
| 45  | Stock Adjustment       | Inventory Engine   | ✅     |
| 46  | Stock Transfer         | Warehouse          | ✅     |
| 47  | Physical Verification  | Inventory Engine   | ✅     |
| 48  | Batch Tracking         | Product Management | ✅     |
| 49  | Serial Number Tracking | Product Management | ⬜     |

---

# Phase 6 — Product Detail Page

Inserted 2026-09-11, ahead of Phase 5's own last item (#49 Serial Number Tracking), per
explicit user direction: Product Management (feature-spec 25) shipped 2026-07-18 with
only list/new/edit — no detail view. Batch Tracking (#48, feature-spec 50) already
deferred its Batches tab for exactly this reason (see its known-deviation note in
`context/progress-tracker.md`'s Current Phase entry), and Serial Number Tracking's own
spec (`51-serial-number-tracking.md`, #49) assumes "the existing Product detail view" in
its UI section — a page that does not exist yet. Rather than let a second feature defer
the same missing page, this phase builds it once, as a dedicated phase inserted before
the (renumbered) Accounting phase, and is implemented **before** #49 resumes so Serial
Number Tracking's own Serial Numbers tab can be wired straight into it instead of
deferring a second time. This is a deliberate, documented exception to strict phase order
(Phase 5 remains open with #49 outstanding while this phase lands) — normal one-feature-
at-a-time, in-order sequencing resumes immediately after.

Feature-spec for this item was drafted 2026-09-11, spec-file number 56 (sequential,
never reused — diverges from the tracker number as usual):

| Tracker # | Feature              | Spec file                                          |
| --------- | --------------------- | -------------------------------------------------- |
| 50        | Product Detail Page   | `context/feature-specs/56-product-detail-page.md`  |

| #   | Feature            | Depends On          | Status |
| --- | ------------------ | -------------------- | ------ |
| 50  | Product Detail Page | Product Management  | ✅     |

Phase Status

✅ Complete — see `context/progress-tracker.md`'s Current Feature entry for the
implementation record. Phase 5 resumes at #49 (Serial Number Tracking) next.

---

# Phase 7 — Accounting

Feature-specs for all four items were drafted 2026-09-11 (documentation only, not
implemented), on the same `docs/phase-5-6-feature-specs` branch. Renumbered 2026-09-11
(tracker #50–#53 → #51–#54) when Phase 6 — Product Detail Page was inserted ahead of this
phase; this phase itself shifted from Phase 6 to Phase 7. Spec-file numbers (52–55) are
unaffected — only tracker `#` numbers and the phase number moved:

| Tracker # | Feature         | Spec file                                     |
| --------- | --------------- | ---------------------------------------------- |
| 51        | Payment Voucher | `context/feature-specs/52-payment-voucher.md`  |
| 52        | Receipt Voucher | `context/feature-specs/53-receipt-voucher.md`  |
| 53        | Contra Voucher  | `context/feature-specs/54-contra-voucher.md`   |
| 54        | Journal Voucher | `context/feature-specs/55-journal-voucher.md`  |

All four are thin permission-gated UI/validation layers directly over the
already-implemented Voucher Engine (feature-spec 31) — no engine changes, and
deliberately **no new Prisma model for any of the four** (`Voucher`/`VoucherEntry`
already carry everything a manual voucher needs; unlike Sales/Purchase Invoice, none of
these four have document-specific data a generic voucher shape can't hold). All four
share one `src/modules/manual-vouchers/` module and one parameterized `ManualVoucherForm`
rather than four near-duplicate modules/forms. Entry-shape restrictiveness, most to
least: Contra (exactly 1 Debit + 1 Credit, both Cash/Bank-restricted, source ≠
destination) → Payment/Receipt (one side fixed-and-restricted to Cash/Bank, the other
free, 1+ lines) → Journal (fully freeform, balance-only) — and Journal Voucher alone
additionally gates both Post and Cancel behind `approve` (not just Cancel, as the other
three do), since it has no structural safeguard against an arbitrary entry.

| #   | Feature         | Depends On     | Status |
| --- | --------------- | -------------- | ------ |
| 51  | Payment Voucher | Voucher Engine | ✅     |
| 52  | Receipt Voucher | Voucher Engine | ✅     |
| 53  | Contra Voucher  | Voucher Engine | ✅     |
| 54  | Journal Voucher | Voucher Engine | ✅     |

Payment Voucher (#51, `feature/payment-voucher`) implemented 2026-09-11. UI + validation
only, no new Prisma model, per the spec's Goal (a Payment Voucher *is* a `Voucher`). New
`src/modules/manual-vouchers/` (the shared module home this phase's four specs all use,
though only Payment Voucher's own service/validation/actions/components exist so far) —
`paymentVoucherService.postPaymentVoucher` validates exactly one Credit entry restricted
to the Cash-in-Hand-or-BankAccount-linked ledger class and one-or-more Debit entries
against any other active ledger, computes the Credit amount as the sum of the Debit
lines server-side, then calls `voucherEngine.postVoucher` unmodified;
`cancelPaymentVoucher` is a thin pass-through to `voucherEngine.cancelVoucher` rejecting
a non-`PAYMENT` voucher id. Per the spec's explicit instruction, the Cash/Bank
ledger-class check was extracted from `purchase-invoice-service.ts`'s
`assertPaymentLedgersValid` into a new shared `src/lib/ledger-class.ts`
(`assertLedgersAreCashOrBank`, parameterized by a `usageLabel` string) — Purchase Invoice
now delegates to it with its prior behavior/messages unchanged (its own 53-test suite
passes unmodified); `purchase-return-service.ts`'s near-identical
`assertRefundLedgerValid` was deliberately left untouched, per that module's own
pre-existing comment recording a decision to stay uncoupled from Purchase Invoice's code
path — not silently revisited. New `/accounting/payment-vouchers` (list),
`/accounting/payment-vouchers/new` (create), `/accounting/payment-vouchers/[id]`
(read-only detail, Cancel gated on `approve`, no Edit — every voucher in this project is
immutable once posted), a new "Payment Vouchers" card on the `/accounting` hub, and a
`payment-vouchers` breadcrumb label. `npx tsc --noEmit`, `npx eslint src prisma`,
`npx vitest run` (1367/1367), and `next build` all pass; browser-verified end-to-end
(created, posted as `PMT-0001`, viewed, and cancelled a voucher — see
`context/progress-tracker.md`'s Current Phase entry for the full walkthrough). **Code
review: APPROVE, zero findings. Security review: zero CRITICAL/HIGH/MEDIUM findings.
Merged into `main` and pushed 2026-09-11** (commit `923c137`).

Receipt Voucher (#52, `feature/receipt-voucher`, spec file `53-receipt-voucher.md`)
implemented 2026-09-11 — the direct mirror of Payment Voucher with the ledger
direction reversed (one Debit entry restricted to Cash/Bank, one-or-more free Credit
lines). Reuses `paymentVoucherService.listLedgerOptions()` rather than duplicating it.
Committed (`798ebdd`), merged into `main`. See `context/progress-tracker.md`'s Current
Phase entry for the full implementation record and browser-verification walkthrough.

Contra Voucher (#53, `feature/receipt-voucher`, spec file `54-contra-voucher.md`)
implemented 2026-09-11 — the strictest of the four: exactly one Debit + one Credit
entry, both sides restricted to the Cash-in-Hand-or-BankAccount-linked ledger class via
`assertLedgersAreCashOrBank` applied to both ledger ids at once, source ≠ destination
enforced by the Zod schema's object-level `.refine`. No add-line control in the form —
the entry count is fixed. Reuses `paymentVoucherService.listLedgerOptions()`. **Code
review: APPROVE, zero findings. Security review: zero CRITICAL/HIGH/MEDIUM findings.**
`npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run` (1415/1415, +23), and
`next build` all pass; `/accounting/contra-vouchers*` appears in the build route table.
Not yet browser-verified (no browser tool available this session). Committed (`662aed3`)
— see `context/progress-tracker.md`'s Current Phase entry for the full implementation
record.

Journal Voucher (#54, `feature/receipt-voucher`, spec file `55-journal-voucher.md`)
implemented 2026-09-11 — **the fourth and last of the four, closing out Phase 7
(Accounting) in full.** The least restrictive of the four: a fully freeform entry table
(any combination of Debit/Credit lines against any active ledger, including Cash/Bank),
no ledger-class restriction at all — `postJournalVoucher` passes the given `entries`
array straight to `voucherEngine.postVoucher` with no client-amount computation and no
`assertLedgersAreCashOrBank` call. The one deliberate divergence from specs 51–53: both
`postJournalVoucher` and `cancelJournalVoucher` require the `approve` permission action,
not `create` — enforced in the service and at every page-level gate (list "New" button,
`/new` page, detail page's Cancel button), since an unrestricted entry against any ledger
has no structural safeguard otherwise (the same posture Purchase/Sales Invoice takes
toward their own tax-override mechanism). Reuses `paymentVoucherService.listLedgerOptions()`.
**Code review: APPROVE, zero findings. Security review: zero CRITICAL/HIGH/MEDIUM
findings** — both confirmed `approve` actually gates Post and Cancel everywhere it needs
to, no ledger-class restriction was introduced, the shared engine-level
`assertLedgersActiveAndOwned` check still protects this screen regardless, and the
omission of the Cash/Bank check is intentional per spec, not a regression. `npx tsc
--noEmit`, `npx eslint src prisma`, `npx vitest run` (1444/1444, +29), and `next build`
all pass; `/accounting/journal-vouchers*` appears in the build route table. Not yet
browser-verified (no browser tool available this session). Committed (`68042e8`) — see
`context/progress-tracker.md`'s Current Phase entry for the full implementation record.

---

# Phase 8 — GST

Feature-specs for all four items were drafted 2026-09-11 (documentation only, not
implemented), continuing the same batch-drafting-without-implementation precedent as
Phases 5/6/7. Spec 57 (GST Registers) establishes a shared read-only GST aggregation
primitive (`getOutwardSupplyLines`/`getInwardSupplyLines`, extending `src/engines/gst/`
rather than opening a new engine tree) that specs 58–60 and Phase 10's GST Reports (#72)
all reuse — no new Prisma model in any of the four except one shared `GstFilingRecord`
(advisory "mark period filed," no hard lock) introduced by spec 58 and reused by spec 59.
Spec-file numbers are sequential and diverge from tracker numbers as usual:

| Tracker # | Feature       | Spec file                                      |
| --------- | ------------- | ----------------------------------------------- |
| 55        | GST Registers | `context/feature-specs/57-gst-registers.md`     |
| 56        | GSTR-1        | `context/feature-specs/58-gstr-1.md`            |
| 57        | GSTR-3B       | `context/feature-specs/59-gstr-3b.md`           |
| 58        | HSN Summary   | `context/feature-specs/60-hsn-summary.md`       |

**Two more items were added to this phase 2026-09-11**, after the original four-item
batch above was already implemented (items #55–#57) or drafted-but-not-yet-implemented
(#58) — **GSTR-2** and an **ITC Register**. Per this project's own numbering convention
("spec-file numbers are sequential and never reused"), these two continue the sequence
from wherever it currently ends (the highest prior spec file at draft time was
`81-backup-restore.md`) rather than renumbering anything already assigned to Phase 9-11
(tracker #59–#79, specs 61-81) — the same divergence-is-normal pattern spec 57's own
header note already established for tracker-vs-spec-file numbering:

| Tracker # | Feature       | Spec file                                       |
| --------- | ------------- | ------------------------------------------------ |
| 80        | GSTR-2        | `context/feature-specs/82-gstr-2.md`            |
| 81        | ITC Register  | `context/feature-specs/83-itc-register.md`      |

| #   | Feature       | Depends On | Status |
| --- | ------------- | ---------- | ------ |
| 55  | GST Registers | GST Engine | ✅     |
| 56  | GSTR-1        | GST Engine | ✅     |
| 57  | GSTR-3B       | GST Engine | ✅     |
| 58  | HSN Summary   | GST Engine | ⬜     |
| 80  | GSTR-2        | GST Registers (#55) | ⬜     |
| 81  | ITC Register  | GST Registers (#55); GSTR-3B (#57) | ⬜     |

**GST Registers (#55) implemented 2026-09-11** on branch `feature/gst-registers`. Added
`getOutwardSupplyLines`/`getInwardSupplyLines` to `src/engines/gst/` (`gst-report-queries.ts`
+ `gst-report-types.ts`, re-exported from `gst-engine.ts` as `gstReportEngine`) — pure
read-only aggregation over the six already-posted source tables (SalesInvoiceItem,
SalesReturnItem, CreditNoteItem, DebitNoteItem, PurchaseInvoiceItem, PurchaseReturnItem),
`POSTED`-only, company-scoped at the query level, sign-adjusted per document type (Sales
Invoice/Debit Note +, Sales Return/Credit Note −, Purchase Invoice +, Purchase Return −),
preferring overridden tax figures over computed ones, and resolving a Return's place of
supply/party from its parent invoice rather than the company's own state — no new Prisma
model, matching the spec's "no schema" convention. `gstRegisterService`
(`src/modules/gst/services/gst-register-service.ts`) wraps both engine functions with the
optional party/HSN/rate filters and pagination, gated on `assertPermission(user, "gst",
"view")` (no Permission catalog changes needed — the `gst` module/`view`/`export` actions
already existed). New `/gst` hub page (cards for all four Phase 8 items — only GST
Registers linked, the other three left as disabled "Coming soon" placeholders per the
spec's explicit implementer's-call) and `/gst/registers` (Outward/Inward toggle, required
date-range + optional party/HSN/rate filters, paginated table with a running period total
row and a per-row link to the source document's own detail page, and a disabled Export
button stub forward-noted to Excel Export #75). Wired the Sidebar's previously-unlinked
"GST" entry to `/gst` and added `gst`/`registers` breadcrumb labels. 25 new vitest cases
(14 engine aggregation — sign/override/party-resolution/place-of-supply/company-scope/
sort, 8 service — permission gate, totals, filtering, pagination, 7 schema validation) —
1474/1474 total suite passing. `npx tsc --noEmit`, `npx eslint src prisma` (0 errors, the
same 2 pre-existing unrelated warnings), `npx vitest run`, and `next build` all pass;
`/gst` and `/gst/registers` both appear in the build route table.

**Post-implementation code review + security review found 1 HIGH, 1 MEDIUM, 2 LOW
(code) and 1 LOW (security, folded into the same fix) — all fixed**, no CRITICAL: (1)
pagination was computed end-to-end but had no rendered Previous/Next controls, silently
truncating registers past 50 rows — added `GstRegisterPagination`; (2) the party filter
had no Select control despite full schema/service/test support — added one, backed by a
new `gstRegisterService.listPartyOptions()` that deliberately queries Customer/Supplier
directly (gated on `gst`/`view`) rather than the `masters`-gated
`customerService`/`supplierService` methods, since an Accountant role lacks
`masters:view`; (3) `/gst/registers`'s filter parsing now delegates to
`gstReportFiltersSchema` instead of duplicating it; (4) the service now imports the
`gstReportEngine` barrel instead of the raw query file, matching every other
GST-consuming service's convention. Security review otherwise clean (explicit PASS on
cross-tenant isolation, IDOR, authorization, information disclosure). Re-verified:
1477/1477 tests, `tsc`/`eslint`/`build` all pass.

**GSTR-1 (#56) implemented 2026-09-11** on branch `feature/gstr-1`, merged into `main`
(`--no-ff`, no conflicts, checks re-verified green — `6f9274c`).
Classifies `getOutwardSupplyLines` into Table 4 (B2B), 5/7 (B2C Large/Small), 8
(Nil-rated), and 9B/9C (Credit/Debit Notes registered/unregistered) — pure in-memory
grouping, no new GST arithmetic. New `GstFilingRecord` model (shared, unmodified, by the
future GSTR-3B) for an advisory-only mark-filed/reopen workflow gated on `gst`/`approve`;
new `CompanySettings.gstFilingFrequency` drives the period selector, added to
`/settings/sales-ledgers`. New `/gst/gstr-1` screen; wired the hub card. Two recorded
deviations from the spec's literal prose, both reasonable and confirmed by review: Debit
Notes report only under 9B/9C (never Table 4, matching the spec's own scope table and
real GSTR-1 semantics); Sales Return lines are classified alongside Sales Invoice lines
so their negative amounts net into the correct B2B/B2C/Nil-rated table (never merged into
the exact same row as their source invoice — no `sourceDocumentId` exists to do that).

**Post-implementation code review + security review found 1 HIGH, 1 MEDIUM (code) and 0
CRITICAL/HIGH/MEDIUM plus 1 LOW (security) — both real findings fixed**: (1) an earlier
version excluded Sales Return lines entirely instead of netting them, **overstating**
Table 4/5/7/8's totals by the full value of every return in the period — fixed by
classifying returns alongside invoices; (2) the ₹2,50,000 B2C Large threshold summed only
an invoice's non-nil-rated lines, understating mixed-rate invoices — fixed to sum the
invoice's full value for the threshold decision while still routing nil-rated lines to
Table 8 only. The security LOW (a check-then-write race on `markPeriodFiled`) was
accepted as-is — advisory-only, same-tenant, same-permission-level. Re-verified:
1508/1508 tests, `tsc`/`eslint`/`build` all pass; `/gst/gstr-1` in the build route table.

**GSTR-3B (#57) implemented 2026-09-11** on branch `feature/gstr-3b`, later merged into
`main` (`--no-ff`, no conflicts, `77e88f9`) after code + security review.
Computes the statutory Tables 3.1/3.2/4/5/5.1 from the same
`getOutwardSupplyLines`/`getInwardSupplyLines` primitives (spec 57), reusing spec 58's
`GstFilingRecord` model verbatim with `returnType: GSTR3B` — no new Prisma model or
migration, the third spec in this batch to ship no schema of its own. Every row this
codebase's data cannot support (3.1(b)/(d)/(e), 3.2's composition/UIN sub-rows, 4(A)(1)–(4)/
(B)/(D), 5's non-GST row, 5.1 in full) is still present in `gstr3bService.getGstr3BReturn`'s
returned shape with an explicit `computed: false` and a non-empty `reason` string — never
omitted — and rendered by the UI as a visually distinct (muted background + "Not tracked"
tooltip badge) row, never indistinguishable from a genuine ₹0. Table 5's nil-rated inward
intra/inter-state split (the one row needing a decision beyond summing already-signed
lines) reuses `gstEngine.determineSupplyType(companyStateCode, placeOfSupplyStateCode)` —
the same comparison `purchase-invoice-service.ts` used once already to decide the (now-zero,
since these lines are nil-rated) cgst/sgst/igst split at posting time — falling back to a
visible not-computed row on both sides if `Company.stateCode` is unset. New
`src/types/gstr3b.ts`, `gstr3b-service.ts` (+ 12 vitest cases), `gstr3b-actions.ts`, five new
presentational components under `src/modules/gst/components/` (`gstr3b-outward-supplies-table`,
`gstr3b-inter-state-supplies-table`, `gstr3b-eligible-itc-table`, `gstr3b-exempt-inward-table`,
`gstr3b-interest-late-fee-note`, plus a shared `gstr3b-row-note` badge/tooltip), and
`/gst/gstr-3b` (same period selector + filing-status-banner pattern as `/gst/gstr-1`, gated
identically on `gst`/`view`/`approve`). Wired the hub card (now linked, no longer "Coming
soon") and the `gstr-3b` breadcrumb label. New `gstr3b-service.ts` carries 13 vitest cases
(ratePercent boundary, netting across all four outward doc types, 3.2's state consolidation
cross-checked against gstr1's own Table 5/7 scope, 4(A)(5)/(C) net ITC math, Table 5's
state-code-missing fallback, filing round-trip independence from GSTR-1's own record).

**One shared-component refactor, not a spec deviation:** `58-gstr-1.md`'s own
`Gstr1FilingStatusBanner` previously called `markGstr1PeriodFiledAction`/
`reopenGstr1PeriodAction` directly, hardcoding it to GSTR-1 — not actually reusable
"parameterized by returnType" as spec 59 itself calls for. Generalized it to accept
`onMarkFiled`/`onReopen` callback props instead (both pages now pass their own
`returnType`-scoped Server Actions in); `/gst/gstr-1/page.tsx` updated to pass its own
actions explicitly, preserving its exact prior behavior. `Gstr1PeriodSelector` needed no
change — it was already return-type-agnostic (just an `options` list + URL params).

1521/1521 total suite passing (13 new). `npx tsc --noEmit`, `npx eslint src prisma` (0
errors, the same 2 pre-existing unrelated warnings), `npx vitest run`, and `next build` all
pass; `/gst/gstr-3b` appears in the build route table.

**Post-implementation code review + security review** (agents run in parallel) found 0
CRITICAL/HIGH in either pass. Code review: 2 MEDIUM, 2 LOW — **both MEDIUM fixed, one LOW
fixed, one LOW accepted as-is**:
- **MEDIUM, fixed**: `determineSupplyType` (Table 5's intra/inter split) would throw an
  uncaught `AppError` for the whole `getGstr3BReturn` call if a single nil-rated inward
  line carried a stale/legacy GST state code — the one path in this service that didn't
  degrade gracefully to a not-computed row like every other "can't compute" case. Fixed
  by validating both the company's and every line's state code via `isValidGstStateCode`
  before calling `determineSupplyType`, falling back to a visible not-computed Table 5
  row (with a named reason) instead of failing the entire return.
- **MEDIUM, fixed**: the spec's own Code Standards section explicitly required an
  "explicit cross-check test against spec 58's own classification, not just an
  independently-asserted number" for Table 3.2 — the original test suite only asserted
  hand-computed totals. Added a test that runs the same fixture through both
  `gstr3bService` and `gstr1Service` and asserts their state-level totals agree.
- **LOW, fixed**: repeated `row.computed ? "..." : "..."` cell-class ternary (10
  occurrences across two table components) extracted into a shared
  `gstr3bFinancialCellClass` helper in `gstr3b-row-note.tsx`.
- **LOW, accepted as-is**: Table 5's "Non-GST supply" row renders the same (always-₹0)
  amount in both Inter-State/Intra-State columns since `Gstr3bAmountRow` models a single
  `amount` — harmless today since the row is always not-computed; flagged for whichever
  future spec first populates a real non-GST inward figure.
- **Security review: 0 CRITICAL/HIGH/MEDIUM, 1 LOW, accepted as-is** —
  `reopenGstr3BPeriodAction`'s bare un-validated `id` param is pre-existing precedent
  duplicated verbatim from `gstr1-actions.ts`, not a regression; `reopenPeriod` already
  checks company ownership before any mutation and both "not found"/"other company"
  paths return the identical generic message (no cross-tenant existence oracle).
- Re-verified after fixes: `npx tsc --noEmit`, `npx eslint src prisma` (0 errors), `npx
  vitest run` (1523/1523, 2 new regression tests — the state-code-invalid fallback and
  the Table 3.2 cross-check), and `next build` all pass.

**Merged into `main` 2026-09-11** (`--no-ff`, no conflicts, `77e88f9` — `tsc`/`eslint`/
`vitest` (1523/1523)/`next build` all re-verified green against the merged result before
pushing `main`). `feature/gstr-3b` deleted locally now that `main` has it.

**Post-merge runtime bugfix 2026-09-11** on branch `fix/gstr3b-client-boundary`, merged
into `main` (`--no-ff`, no conflicts, `7699db4`). Live use of `/gst/gstr-3b` surfaced:
"Attempted to call `gstr3bFinancialCellClass()` from the server but
`gstr3bFinancialCellClass` is on the client." The shared cell-styling helper had been
placed in `gstr3b-row-note.tsx`, a `"use client"` file (it renders the Tooltip
primitive) — every export of a `"use client"` module becomes an opaque client reference
from a Server Component's perspective, so a plain synchronous helper called directly
(not rendered as JSX) from the three Server Component table files threw at request
time. `next build`/`tsc`/`eslint`/`vitest` all stayed green throughout — none of those
catch this specific RSC-boundary class of error, only a live render does. Fixed by
extracting the helper into a new `src/modules/gst/utils/gstr3b-cell-class.ts` (no
`"use client"` directive) and updating the three table components' imports. Verified
live: started the dev server, logged in as `admin`, navigated to `/gst/gstr-3b` — 200
response, zero console/page errors (Playwright-driven check). `tsc`/`eslint`/`vitest`
(1523/1523)/`next build` all re-verified green against the merged result.

Now that GSTR-3B (#57) is implemented, reviewed, merged, and this runtime bug fixed,
**HSN Summary (#58/spec 60) remains queued next in this phase's original order.**

**GSTR-2 (#80) and ITC Register (#81) feature-specs drafted 2026-09-11** (documentation
only, not implemented — matching this phase's own original batch-drafting precedent),
per explicit user request to add both to the GST phase. See the tracker-numbering note
above the item tables for why they're numbered #80/#81 (specs 82-83) rather than
renumbering anything already assigned to Phase 9-11.

- **GSTR-2** (`context/feature-specs/82-gstr-2.md`) is scoped, per an explicit scoping
  decision confirmed with the user before drafting, as a **read-only inward-supply
  reporting view** in the original (now-suspended) GSTR-2 form's table shape, derived
  entirely from this company's own posted Purchase Invoice/Return data via the existing
  `getInwardSupplyLines` primitive (spec 57) — **not** a GSTR-2A/2B portal
  reconciliation (structurally impossible without GST Portal Integration, which remains
  out of scope per `AGENTS.md`'s Future Modules list) and **not** a return with a
  filing workflow (GSTR-2 has not actually been filed by any taxpayer since 2017;
  adding a `GstFilingRecord` for it would misrepresent it as a live obligation). No new
  Prisma schema — the third Phase 8 spec (after GST Registers and HSN Summary) to add
  none. Every one of the real form's 13 tables this codebase's data cannot support
  (reverse charge, imports/SEZ, amendments, ISD credit, TDS/TCS, advances, ITC
  reversal, portal-mismatch reconciliation, purchase-side HSN summary) is either an
  explicit visible not-computed row or, where even a labeled placeholder would imply a
  workflow that doesn't exist (amendments, advances, portal-mismatch reconciliation),
  omitted from the shape entirely — the spec is explicit about which case applies to
  each table and why.
- **ITC Register** (`context/feature-specs/83-itc-register.md`) is scoped, per the same
  confirmed decision, as a **report only**: rate-wise/party-wise/HSN-wise breakdown of
  the same figure `59-gstr-3b.md`'s Table 4(A)(5) already sums as one lump total — no
  new schema, no ITC-eligibility categorization, and explicitly **not** a full
  Electronic Credit Ledger (availed/utilized/period-to-period running balance), which
  was considered and deliberately rejected as this spec's scope (see its own Do Not) as
  a materially larger, separately-specced undertaking. Carries a permanently-visible
  disclaimer that every line is assumed fully eligible, since no document anywhere in
  this codebase records a Section 17(5) eligibility category — mirroring
  `59-gstr-3b.md`'s own Table 4(D) disclosure at the point where a filer actually sees
  the transaction-level detail, not just a summary line.

**Neither is implemented yet.** Per `ai-workflow-rules.md`'s one-feature-at-a-time rule,
implementation order among HSN Summary (#58, already queued) and these two new items
(#80/#81) is a priority decision for the user, not assumed by this drafting pass — see
progress-tracker.md's Next Up.

---

# Phase 9 — Employee Management

Feature-specs for all three items were drafted 2026-09-11 (documentation only, not
implemented). No `Employee` Prisma model existed before this batch — this is the first
genuinely new domain since Phase 5/6. `User` (login/auth) and `Employee` (HR/payroll
record) are kept as two separate entities linked by an optional, nullable, unique
`Employee.userId` (spec 61), since most employees never log in and not every logged-in
user is a payroll employee. Payroll (spec 63) posts through the Voucher Engine like every
other financial transaction, adding a new `VoucherType.SALARY` (reasoned explicitly
against reusing `JOURNAL`/`PAYMENT` — see the spec's own Business Rules section) — one
aggregate voucher per payroll run, with actual disbursement left to the existing Payment
Voucher screen. Must be implemented in order (#59 → #60 → #61):

| Tracker # | Feature         | Spec file                                     |
| --------- | --------------- | ------------------------------------------------ |
| 59        | Employee Master | `context/feature-specs/61-employee-master.md`    |
| 60        | Attendance      | `context/feature-specs/62-attendance.md`         |
| 61        | Payroll         | `context/feature-specs/63-payroll.md`            |

| #   | Feature         | Depends On | Status |
| --- | --------------- | ---------- | ------ |
| 59  | Employee Master | Company    | ⬜     |
| 60  | Attendance      | Employee   | ⬜     |
| 61  | Payroll         | Attendance | ⬜     |

---

# Phase 10 — Reporting

Feature-specs for all eleven items were drafted 2026-09-11 (documentation only, not
implemented), in two parallel batches (financial: #62–65/72; operational: #66–71) that
converged on the same shared `src/engines/reporting/` module — established by spec 64
(Trial Balance), reused explicitly by specs 65–67/74 and by specs 68–73 (which also
independently arrived at the same location before spec 64 was confirmed to exist, per
each spec's own Project Context note). No new Prisma model in any of the eleven except
Balance Sheet's reuse of the *existing* `LedgerGroup.natureType` field (no schema change
needed after all — see spec 66) and one new read-only `getCashAndBankLedgerIds` helper
(spec 67). Cash Flow (spec 67) uses the direct method (not indirect), justified against
this codebase's already-transaction-level ledger data. A shared `/reports` hub page is
introduced (whichever of these specs lands first wires it up; every other spec adds its
own card). Spec-file numbers are sequential and diverge from tracker numbers as usual:

| Tracker # | Feature           | Spec file                                          |
| --------- | ----------------- | ----------------------------------------------------- |
| 62        | Trial Balance     | `context/feature-specs/64-trial-balance.md`           |
| 63        | Profit & Loss     | `context/feature-specs/65-profit-and-loss.md`         |
| 64        | Balance Sheet     | `context/feature-specs/66-balance-sheet.md`           |
| 65        | Cash Flow         | `context/feature-specs/67-cash-flow.md`               |
| 66        | Sales Reports     | `context/feature-specs/68-sales-reports.md`           |
| 67        | Purchase Reports  | `context/feature-specs/69-purchase-reports.md`        |
| 68        | Inventory Reports | `context/feature-specs/70-inventory-reports.md`       |
| 69        | Customer Reports  | `context/feature-specs/71-customer-reports.md`        |
| 70        | Supplier Reports  | `context/feature-specs/72-supplier-reports.md`        |
| 71        | Employee Reports  | `context/feature-specs/73-employee-reports.md`        |
| 72        | GST Reports       | `context/feature-specs/74-gst-reports.md`             |

| #   | Feature           | Depends On     | Status |
| --- | ----------------- | -------------- | ------ |
| 62  | Trial Balance     | Voucher Engine | ⬜     |
| 63  | Profit & Loss     | Accounting     | ⬜     |
| 64  | Balance Sheet     | Accounting     | ⬜     |
| 65  | Cash Flow         | Accounting     | ⬜     |
| 66  | Sales Reports     | Sales          | ⬜     |
| 67  | Purchase Reports  | Purchase       | ⬜     |
| 68  | Inventory Reports | Inventory      | ⬜     |
| 69  | Customer Reports  | Customers      | ⬜     |
| 70  | Supplier Reports  | Suppliers      | ⬜     |
| 71  | Employee Reports  | Employees      | ⬜     |
| 72  | GST Reports       | GST            | ⬜     |

---

# Phase 11 — Productivity Features

Feature-specs for all seven items were drafted 2026-09-11 (documentation only, not
implemented), in two parallel batches (data/export: #73–76; operational: #77–79). Global
Search, Excel Import, Excel Export, and PDF Generation introduce no new Prisma model —
Excel Export (spec 77) establishes a shared `src/lib/excel-export.ts` utility (`exceljs`,
a new dependency — confirmed absent from `package.json`) around a new `ReportExportTable[]`
contract that PDF Generation (spec 78, Puppeteer-based) and every Phase 10 report screen's
export forward-note both reuse. Barcode Billing (spec 79) is UI-only over the
already-existing `Product.barcode` field. Audit Logs (spec 80) retrofits the existing
generic `AuditLog` model to financial-transaction events only (voucher/document
post-cancel across 10 existing call sites), under a genuinely new `audit` permission
module, at a new company-scoped `/settings/audit-logs` route — explicitly distinct from
the existing Super-Admin `/administration/audit` stub. Backup & Restore (spec 81)
introduces one new `BackupJob` model and a `pg_dump`/`pg_restore`-based mechanism, and
(unlike Audit Logs) reuses the existing `/administration/backup` Super-Admin route rather
than adding a company-level one, since this app runs one shared Postgres installation, not
a per-company database. Spec-file numbers are sequential and diverge from tracker numbers
as usual:

| Tracker # | Feature          | Spec file                                       |
| --------- | ---------------- | -------------------------------------------------- |
| 73        | Global Search    | `context/feature-specs/75-global-search.md`        |
| 74        | Excel Import     | `context/feature-specs/76-excel-import.md`         |
| 75        | Excel Export     | `context/feature-specs/77-excel-export.md`         |
| 76        | PDF Generation   | `context/feature-specs/78-pdf-generation.md`       |
| 77        | Barcode Billing  | `context/feature-specs/79-barcode-billing.md`      |
| 78        | Audit Logs       | `context/feature-specs/80-audit-logs.md`           |
| 79        | Backup & Restore | `context/feature-specs/81-backup-restore.md`       |

| #   | Feature          | Depends On | Status |
| --- | ---------------- | ---------- | ------ |
| 73  | Global Search    | Masters    | ⬜     |
| 74  | Excel Import     | Masters    | ⬜     |
| 75  | Excel Export     | Reports    | ⬜     |
| 76  | PDF Generation   | Reports    | ⬜     |
| 77  | Barcode Billing  | Sales      | ⬜     |
| 78  | Audit Logs       | Platform   | ⬜     |
| 79  | Backup & Restore | Database   | ⬜     |

---

# Future Roadmap

These are intentionally outside the first production release.

- Manufacturing
- Formula Management
- Production Orders
- CRM
- Service Management
- Mobile Application
- E-Invoice
- E-Way Bill
- GST Portal Integration
- Banking API
- AI Assistant
- AI Analytics
- OCR
- Voice Search
- Multi Currency
- Multi Language

---

# Current Feature

**Next Feature to Implement**

➡ **Phase 7 — Accounting is complete.** Payment Voucher (#51), Receipt Voucher (#52),
Contra Voucher (#53), and Journal Voucher (#54) are all implemented (see the Phase 7
section above for each's implementation record), all sharing the
`src/modules/manual-vouchers/` module Payment Voucher established and the
`assertLedgersAreCashOrBank` shared helper (`src/lib/ledger-class.ts`) — Journal Voucher
is the one of the four that deliberately doesn't call it. Serial Number Tracking (#49,
`feature/serial-number-tracking`, implemented 2026-09-11) closed Phase 5 in full — Opening
Stock (#44), Stock Adjustment (#45), Stock Transfer (#46), Physical Verification (#47),
Batch Tracking (#48), Product Detail Page (#50), and Serial Number Tracking (#49) are all
implemented.

**Phases 8–11 (tracker #55–#79, 25 feature-spec files, `57-gst-registers.md` through
`81-backup-restore.md`) were all drafted 2026-09-11** — documentation only, per explicit
user request, following the exact same batch-drafting-without-implementation precedent
as the Phase 3/4/5/6/7 spec batches (drafted well ahead of implementation, one feature
implemented at a time thereafter). See each phase's own section above for its spec-file
mapping table and batch-level scope-decision summary.

➡ **`feature/receipt-voucher` (Receipt/Contra/Journal Voucher, closing Phase 7) was
merged into `main` 2026-09-11** before Phase 8 began, per `ai-workflow-rules.md`'s
one-branch-at-a-time rule — see the Phase 7 pointer above. **GST Registers (#55) is
implemented, reviewed, and merged into `main`** (see the Phase 8 section above for the
full record) — `feature/gst-registers` merged `--no-ff`, no conflicts, checks
re-verified green (`ac10ffa`). **GSTR-1 (#56) is implemented, reviewed, and merged into
`main`** (`feature/gstr-1` merged `--no-ff`, no conflicts, checks re-verified green —
`6f9274c`). **GSTR-3B (#57) is next** to implement, awaiting explicit instruction — HSN
Summary (#58) remains after it.
Phases 9–11 remain entirely undrafted-for-implementation (spec-drafted
only); every status cell there remains ⬜.

Serial Number Tracking (`feature/serial-number-tracking`) — the second of the two
genuinely new engine-adjacent schema additions Phase 5 reserved, the structural mirror of
Batch Tracking (#48) one dimension further: identity-scoped instead of lot-scoped. New
`Product.isSerialTracked` (opt-in, TRADING-only, mutually exclusive with
`isBatchTracked`, immutable once the product has any StockTransaction), new
`SerialNumber` catalog model (`(companyId, productId, serialValue)` unique — two products
may share a serial format), and one additive nullable `StockTransaction.serialId` column
(migration `20260911081719_serial_number_tracking`, which also added the two raw-SQL
CHECK constraints — `product_batch_serial_mutually_exclusive` and
`stock_transaction_batch_xor_serial` — feature-spec 50's own migration had deferred
here). `serialId` was threaded as an optional field through the Inventory Engine's
`stockMovementLineSchema`/`transferStockInputSchema` and a new
`assertSerialRequirement`/`assertSerialQuantity`/`assertUsableSerial` set in
`inventory-engine.ts` — required when `product.isSerialTracked`, forbidden otherwise, and
that line's quantity must equal exactly 1 regardless of the product's unit precision.
`SerialNumber` carries no stored status column — a new pure `deriveSerialStatus`
(`inventory-validation.ts`) derives `IN_STOCK`/`SOLD`/`RETURNED`/`OUT_OF_STOCK`/
`NO_MOVEMENTS` and the current warehouse from the serial's own movement history, with
same-`createdAt` ties (the pair `transferStock` writes in one transaction) resolved in
favor of IN. The "cannot oversell an identity" OUT-availability check is identity- and
warehouse-scoped (an OUT line/transfer may only move a serial from the warehouse it is
currently derived to be IN_STOCK at) and runs unconditionally, independent of
`allowNegativeStock` — a deliberate strengthening beyond the batch/product quantity
checks, since identity correctness isn't a quantity-tolerance setting. A structural guard
in `assertLinesWellFormed` also rejects the same `serialId` appearing as OUT more than
once within a single `recordMovements` call. New `serial-numbers` module (repository/
service/validation/actions/components) plus a `<SerialSelector>` component and an
`isSerialTracked` toggle wired into the existing Product create/edit form, mutually
disabling the batch-tracking toggle and vice versa. `npx tsc --noEmit`, `npx eslint src
prisma`, `npx vitest run` (1333 tests), and `next build` all pass.

**Real bug found and fixed during browser verification, not just automated tests**: a
duplicate-serial-value registration surfaced the generic "Something went wrong" toast
instead of the friendly "A serial number with this value already exists for this
product." message. Root cause, confirmed from the live server log: the shared
`isUniqueConstraintError(error, column)` helper (`src/lib/prisma-errors.ts`) only checked
the legacy `error.meta.target` array shape, but this project's actual `@prisma/client`
7.8.0 Postgres driver adapter reports the violated columns at
`meta.driverAdapterError.cause.constraint.fields` instead (each entry Postgres-quoted,
e.g. `"companyId"`), with no `meta.target` at all — so every consumer of this shared
helper across the whole codebase (products, warehouses, units, ledgers, batches, and now
serial numbers) was silently falling through to the generic error path on a real
uniqueness violation, previously masked because every existing test for it mocks the
legacy shape only. Fixed by checking both shapes (`src/lib/prisma-errors.ts`); added
`src/lib/prisma-errors.test.ts` (new file — none existed before) covering both. This was
a pre-existing, codebase-wide latent defect, not something this feature introduced;
fixing the one shared helper fixes every caller at once.

A live Postgres was available; the migration was applied via `prisma db execute` +
`prisma migrate resolve --applied` rather than `prisma migrate dev`, because the local
dev database's migration history had a pre-existing checksum mismatch on the unrelated,
already-merged `20260911060923_batch_tracking` migration (a line-ending/edit-after-apply
artifact, not something this session caused) that made `migrate dev`'s drift check refuse
to proceed without a full `migrate reset` (rejected as disproportionate and destructive
for a checksum-only discrepancy). **Manually verified end-to-end in a browser** via
Playwright against the dev server (reusing this machine's cached Chromium build): created
a serial-tracked product (confirmed the Batch Tracking toggle auto-disables with an
explanatory message and vice versa) → its Serial Numbers tab appeared (no Batches tab) →
bulk-registered two serials via pasted multi-line input → registered a third mixed with a
duplicate of an already-registered value (duplicate failed with the now-fixed friendly
message, the dialog retained only the failed value for retry, the new value still
succeeded) → deactivated one serial, toggled it back active → deactivated all test
products afterward (this codebase has no hard-delete for masters, matching every other
module's convention).

**Code review: APPROVE, zero findings. Security review: zero CRITICAL/HIGH findings**,
one accepted LOW (see `context/progress-tracker.md`'s Open Questions) plus two
informational notes, both confirmed sound. **Merged into `main` and pushed 2026-09-11**
(`git merge --no-ff feature/serial-number-tracking`, commit `08425e0`; `tsc`/`eslint`/
`vitest`(1333/1333)/`next build` re-verified against the merged result before pushing;
local feature branch deleted). Phase 5 (Inventory) is now closed in full.

Batch Tracking (`feature/batch-tracking`) — the first of the two genuinely new
engine-adjacent schema additions Phase 5 reserved (32-inventory-engine.md's own Do Not
section deferred batch/serial tracking here). New `Product.isBatchTracked` (opt-in,
TRADING-only, immutable once the product has any StockTransaction — the same rule/guard
shape as unitId/productType), new `ProductBatch` catalog model (batch number, optional
manufacture/expiry dates, `(companyId, productId, batchNumber)` unique — two products may
share a lot number), and one additive nullable `StockTransaction.batchId` column
(migration `20260911060923_batch_tracking`). Per the spec's Retrofit Decision, `batchId`
was added ONLY to `StockTransaction` and threaded as an optional field through the
Inventory Engine's existing `stockMovementLineSchema`/`transferStockInputSchema` and a new
`assertBatchRequirement`/`assertUsableBatch` pair in `inventory-engine.ts` — required when
`product.isBatchTracked`, forbidden otherwise, never a silent no-op. Batch-scoped
availability is checked independently of (in addition to) the existing product-level
check via new `sumStockForBatchTriples`/`aggregateBatchOutDemand`, so a business cannot
oversell one batch using a sibling batch's stock even though the product's company-wide
total covers it; batch quantity is never stored, only Sigma IN - Sigma OUT via the new
`getBatchStock`/`getBatchLedger` queries (mirroring `getCurrentStock`/`getStockLedger`
one dimension further). New `product-batches` module (repository/service/validation/
actions/components) plus a `<BatchSelector>` component and an `isBatchTracked` toggle
wired into the existing Product create/edit form. `npx tsc --noEmit`, `npx eslint src
prisma`, `npx vitest run` (1253 tests), and `next build` all pass.

**Known deviations/deferrals from the spec, recorded per `ai-workflow-rules.md`:**

1. ~~The mutual-exclusion CHECK constraint (batch/serial) is deferred to feature-spec
   51's own migration~~ — **resolved 2026-09-11**: added by
   `prisma/migrations/20260911081719_serial_number_tracking/migration.sql` exactly as
   deferred here (`product_batch_serial_mutually_exclusive` and
   `stock_transaction_batch_xor_serial`). The mutual-exclusion test cases (both
   directions) are written in `product-schema.test.ts`.
2. ~~The Batches tab / page route is on hold~~ — **resolved 2026-09-11** by Phase 6 —
   Product Detail Page (#50, `feature/product-detail-page`): `/masters/products/[id]/
   batches` now renders `ProductBatchTable`/`ProductBatchForm` unmodified, gated behind
   `product.isBatchTracked`. See that phase's own paragraph below for the implementation
   record; spec 51's Serial Numbers tab reuses the identical pattern (a new
   `isSerialTracked` gate in `getProductDetailTabs`, a sibling route).
3. **Batch activate/deactivate use the `edit` permission action**, not this codebase's
   usual `LIFECYCLE_ACTION = "delete"` convention every other master's toggle follows —
   a deliberate deviation because the spec's own Security section enumerates only
   view/create/edit for this feature. Flag if this drifts from `LIFECYCLE_ACTION` in a
   future permission-catalog cleanup.
4. **The retrofit list is still fully outstanding**: `<BatchSelector>` exists but is wired
   into NONE of Purchase Invoice, Sales Invoice, Purchase Return, Sales Return, Opening
   Stock, Stock Adjustment, Stock Transfer, or Physical Verification's line editors yet.
   The moment a product is flipped to `isBatchTracked`, every one of those documents will
   reject a movement against it (missing batchId) until its own line editor is retrofitted
   — each is its own follow-up task, not automatic.

Product Detail Page (`feature/product-detail-page`) — a routing/composition-only feature
(feature-spec 56), no new Prisma model or service logic. New `/masters/products/[id]`
(Overview tab, default) and `/masters/products/[id]/batches` (Batches tab, shown only when
`product.isBatchTracked`; redirects to Overview otherwise) routes, reading through the
unchanged `productService.getProduct`/`productBatchService.listBatches`. `ProductDetailTabs`
is a route-based tab shell (plain `Link`s highlighted by the active route, not the stateful
shadcn `Tabs` primitive, since Overview/Batches are separate pages) built on a pure,
unit-tested `getProductDetailTabs(productId, isBatchTracked)` — the one function spec 51
extends with a third `isSerialTracked`-gated tab, not a restructure. `ProductOverviewPanel`
is a read-only display grouped like `ProductForm`'s own sections (Identity, Classification,
Tax, Pricing, Stock). The Batches tab composes spec 50's unmodified `ProductBatchTable`/
`ProductBatchForm` via a new `ProductBatchesPanel` client component (dialog state neither of
those components owns itself) — deliberately placed under `products/`, not
`product-batches/`, since that module's own spec reserves no new components. Added a
dynamic-breadcrumb mechanism (`useBreadcrumbLabel`/`useBreadcrumbLabels`,
`src/hooks/use-breadcrumb-label.ts`, a module-level external store consumed via
`useSyncExternalStore`) so a page can register its own id segment's label (the product's
name) without `BreadcrumbBar` fetching anything itself — every other route keeps the
existing "drop the id segment" behavior unchanged. Also added a "View" row action to the
Product Table (alongside the existing Edit) and widened `product-batch-actions.ts`'s
`revalidatePaths` to include the new Batches route. Browser-verified end-to-end with
Playwright against the dev server (login → product list → View → Overview render →
breadcrumb shows the product's name → Edit link → not-found for a bogus id; a fresh
batch-tracked product → Batches tab → New Batch dialog → create → row appears → toggling
batch tracking back off → `/batches` redirects to Overview) — this caught and fixed one real
bug pre-merge: the breadcrumb store originally mutated one shared `Map` in place, which
`useSyncExternalStore` treats as no change (`Object.is` on the same reference), so the bar
never re-rendered; fixed by replacing the map with a new instance on every write. `npx tsc
--noEmit`, `npx eslint src prisma`, `npx vitest run` (1256 tests), and `next build` all
pass; `/masters/products/[id]` and `/masters/products/[id]/batches` appear in the build
route table.

**Known deviation, recorded per `ai-workflow-rules.md`:** the Code Standards section of
feature-spec 56 calls for Vitest coverage of two page-level behaviors — the Batches route's
redirect-to-Overview for a non-batch-tracked product, and not-found for a cross-company/
non-existent id. This codebase has no Next.js page/component-rendering test infrastructure
at all (zero `.test.tsx` files anywhere; `vitest.config.ts` runs `environment: "node"` and
only collects `*.test.ts`) — no prior feature's page-level behavior has ever been unit
tested, only its underlying service/repository logic. Consistent with that precedent: the
redirect condition (`!product.isBatchTracked`) is a one-line read of an already-tested
`Product` field, and the not-found path is `productService.getProduct`'s existing,
unmodified cross-company-returns-null behavior (feature-spec 25) — neither is new logic this
spec introduces. What *is* new (the tab-list construction, including the batch-tracked-gate
rule) is unit tested in `product-detail-tabs.test.ts`. Both page behaviors were additionally
exercised directly against a live browser (see above) rather than left unverified.

Opening Stock (`feature/opening-stock`, merged into `main`) — the thin UI/service layer
directly over the already-shipped Inventory Engine (feature-spec 32): no new Prisma
model, no document header/numbering, `openingStockService.recordOpeningStock` enforces
"at most one Opening Stock entry ever per (companyId, productId, warehouseId)" via a
Serializable-transaction check-then-insert against `stockTransactionRepository`'s new
`existingTransactionPairs` method (matches on ANY prior transactionType for the pair,
not just OPENING_STOCK), then delegates the actual write to
`inventoryEngine.recordMovements` unchanged. Established the `/inventory` hub and wired
the previously-unlinked sidebar "Inventory" entry to it.

Stock Adjustment (`feature/stock-adjustment`) — unlike Opening Stock, a real numbered
document: new `StockAdjustment`/`StockAdjustmentItem` models + `StockAdjustmentStatus`
enum (migration `20260911043158_stock_adjustment`), numbered via the Document Number
Engine (`DocumentType.STOCK_ADJUSTMENT`, previously reserved with no consumer). Each
line carries its own IN/OUT `direction` — a single document may mix found-stock (IN)
and write-off (OUT) lines; posting hands every line to `inventoryEngine.recordMovements`
unchanged (TRADING-only, active/company-scoped, precision, OUT-availability, and
future-date rejection are all the engine's own re-validation, never duplicated here),
under Serializable isolation with bounded P2034 retry since the batch may contain OUT
lines; cancellation reverses each line with the OPPOSITE of ITS OWN original direction
(not a single document-wide reversal), also Serializable+retry. No GST/Voucher Engine
call anywhere (explicit scope decision). Added the second `/inventory` hub card.
Security review caught one HIGH finding — `createDraft`/`updateDraft` persisted a
client-submitted `productId`/`warehouseId` with only UUID-shape validation, no
company-ownership check, so a cross-tenant id could be saved into a DRAFT and its
name/code would then render on the detail/edit pages (a real multi-tenant data-leak
vector, though never postable — the engine's own company check would reject it at Post
time) — fixed in the same session by adding `assertLineReferencesBelongToCompany`
(mirrors `purchase-invoice-service.ts`'s `loadProductsMap`/`loadWarehousesMap` pattern)
plus two new company-scoped repository methods (`findProductsForLines`/
`findWarehousesForLines`) and 3 new tests. `npx tsc --noEmit`, `npx eslint src prisma`,
`npx vitest run` (1114 tests), and `next build` all pass; `/inventory/adjustments*`
appears in the build route table.

Stock Transfer (`feature/stock-transfer`, merged into `main`) — new `StockTransfer`/
`StockTransferItem` models + `StockTransferStatus` enum (migration
`20260911045614_stock_transfer`), numbered via the Document Number Engine
(`DocumentType.STOCK_TRANSFER`, previously reserved with no consumer). Header-level
`sourceWarehouseId`/`destinationWarehouseId` (two named relations on `Warehouse`, since
both FKs target the same model); `StockTransferItem` carries only `productId`/`quantity`,
unlike Stock Adjustment's per-line warehouse. `postStockTransfer` calls
`inventoryEngine.transferStock` once per line — each call writes its own linked OUT
(source)/IN (destination) row pair — sequentially inside one Serializable transaction;
`cancelStockTransfer` reverses every line with source and destination swapped, also
Serializable+retry. Single `POSTED` state, not an in-transit workflow — a deliberate
simplification recorded in the spec, since the engine's `transferStock` already writes
both rows atomically in one call. No GST/Voucher Engine call (zero net stock change
company-wide). Added the third `/inventory` hub card. `npx tsc --noEmit`,
`npx eslint src prisma`, `npx vitest run` (1146 tests), and `next build` all pass;
`/inventory/transfers*` appears in the build route table.

Physical Verification (`feature/physical-verification`, merged into `main`) — new
`PhysicalVerification`/`PhysicalVerificationItem` models + `PhysicalVerificationStatus`
enum (migration `20260911052817_physical_verification`), numbered via the Document
Number Engine — this spec adds `DocumentType.PHYSICAL_VERIFICATION` as a brand-new enum
value, resolving open sanity-check flag (a) above in favor of reserving it (spec 34's
original list hadn't reserved it, unlike `STOCK_ADJUSTMENT`/`STOCK_TRANSFER`). Header-
level `warehouseId`; each line snapshots `systemQuantity`/`countedQuantity`/
`varianceQuantity`. The Inventory Engine's `getCurrentStock` (spec 32, previously
unconsumed by any module) was extended with an optional transaction-client parameter so
`completePhysicalVerification` can re-derive `systemQuantity` fresh *inside* the
completing transaction rather than trusting the draft-time preview — variance is
computed as `countedQuantity - systemQuantity`, and only non-zero-variance lines post a
`StockTransactionType.PHYSICAL_VERIFICATION` movement (`IN`/`OUT` by sign); zero-variance
lines stay on the record with no movement. Runs at Serializable isolation with bounded
retry, identical contract to Stock Adjustment/Transfer's posting. No cancellation once
`COMPLETED` — only `DRAFT -> CANCELLED`, a plain status flip with no engine call since
nothing was ever posted for a draft; a miscounted completed verification is corrected via
a subsequent Stock Adjustment instead. Added the fourth `/inventory` hub card. Both
code-reviewer and security-reviewer returned zero CRITICAL/HIGH/MEDIUM findings
(APPROVE). `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run` (1184 tests),
and `next build` all pass; `/inventory/verifications*` appears in the build route table.

Phases 1–4 are fully complete: Phase 3 — Sales Management (#33–#39, all seven
documents) and Phase 4 — Purchase Management (#40–#43, all four documents, the last
being Purchase Return implemented 2026-09-11) — see each phase's own status paragraph
above and `context/progress-tracker.md`'s Completed entries for the full record.
Feature-specs for the rest of Phase 5 (tracker #46–#49) and the former Phase 6
(Accounting — the four manual voucher screens, drafted as tracker #50–#53, renumbered to
#51–#54 and Phase 7 when Phase 6 — Product Detail Page was inserted, see below) were
drafted 2026-09-11 per explicit user request, following the same
batch-drafting-without-implementation precedent as the Phase 3/4 spec batches (drafted
2026-07-18/19, implemented much later, one at a time). Per `ai-workflow-rules.md` only
one feature is *implemented* at a time.

**Phase 6 — Product Detail Page inserted 2026-09-11**, per explicit user direction,
before any of its work began: Product Management (feature-spec 25, tracker #23) shipped
list/new/edit only, with no detail view, and two later Phase 5 specs both need one —
Batch Tracking (#48) deferred its Batches tab for exactly this reason (known deviation #2
above), and Serial Number Tracking's own spec (`51-serial-number-tracking.md`, #49)
assumes "the existing Product detail view" in its UI section. Inserting a dedicated phase
for it — rather than building it as a side effect of #49 — keeps the same one-feature
convention this project already follows (a distinct spec file, `56-product-detail-page.md`,
tracker #50) and gives both existing batch UI components and the still-pending serial
UI a single, deliberately-designed page to land in. The insertion pushed every
tracker number and phase number from the old Phase 6 (Accounting) onward up by one: old
#50–#78 are now #51–#79, and old Phase 6–10 are now Phase 7–11. No feature-spec **file**
numbers changed — spec 56 is simply the next sequential file after 55, and specs 52–55
(Payment/Receipt/Contra/Journal Voucher) keep their own file names, only their in-body
tracker-number and phase-number references were updated to match.

---

# Notes

- Complete one feature at a time.
- Never skip dependencies.
- Each completed feature should update this tracker.
- Every feature must pass TypeScript, ESLint, and build verification before being marked complete.
