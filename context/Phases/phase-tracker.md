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
| 58  | HSN Summary   | GST Engine | ✅     |
| 80  | GSTR-2        | GST Registers (#55) | ✅     |
| 81  | ITC Register  | GST Registers (#55); GSTR-3B (#57) | ✅     |

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

**HSN Summary (#58) implemented 2026-09-11** on branch `feature/hsn-summary` — the last
item in Phase 8's original four-item batch. New `hsnSummaryService.getHsnSummary()`
(`src/modules/gst/services/hsn-summary-service.ts`) groups `getOutwardSupplyLines`'
(spec 57) product-bearing lines by `(hsnCode, codeType, ratePercent)`, filtered first
through the same optional partyId/hsnCode/ratePercent predicate the Registers screen
uses — extracted to a new shared `matchesOptionalGstReportFilters` helper in
`gst-supply-line-filters.ts` so `gst-register-service.ts` and this service apply
identical filter semantics rather than duplicating the predicate (code-standards.md's
DRY rule). Credit Note/Debit Note lines (no `productId`) are excluded from the grouped
output entirely; a product-bearing line whose product carries no `hsnCodeId` lands in a
single "No HSN Assigned" bucket instead of being dropped, always rendered last. A
group's Quantity column shows a representative Unit (first/most-common by frequency)
plus a "Mixed unit" badge when the group actually summed quantities from more than one
distinct `Unit`. One batched `prisma.product.findMany` resolves every group's HSN
description/codeType and unit label — no N+1, no query inside the grouping loop. No new
Prisma model/migration (pure grouping over spec 57's output, per the spec's own Data
Model section). New `/gst/hsn-summary` page (reusing the Registers screen's
`GstReportFilterBar`/`GstReportExportButton` unmodified, per the spec) and a shared
`HsnSummaryTable` component, embedded verbatim (same props, no second aggregation call)
by `58-gstr-1.md`'s own Table 12 section, replacing its former "not yet available"
placeholder. `/gst` hub card flipped from disabled "Coming soon" to linked. Added the
`hsn-summary` breadcrumb label. 6 new vitest cases (permission gate, same-HSN-same-rate
grouping vs. same-HSN-different-rate split, signed Sales Return netting, mixed-unit
badge on/off, "No HSN Assigned" bucketing + Credit/Debit Note exclusion, cross-company
product-lookup scoping) — 1529/1529 total suite passing. `npx tsc --noEmit`, `npx eslint
src prisma` (0 errors, the same 2 pre-existing unrelated warnings), `npx vitest run`, and
`next build` all pass; `/gst/hsn-summary` appears in the build route table.

**Post-implementation code review + security review found 1 HIGH, 1 LOW (code) — both
fixed; security review 0 findings**, no CRITICAL/MEDIUM: (1) **HIGH, fixed** — the
shared `getOutwardSupplyLines`/`getInwardSupplyLines` primitive's Sales
Return/Purchase Return mappers (`src/engines/gst/gst-report-queries.ts`, spec 57,
already merged — not introduced by this branch) negated every monetary field for a
return line but not `quantity`, breaking `GstSupplyLine`'s documented "already
sign-adjusted" contract and this spec's own Business Rule that a return must reduce
its HSN group's net quantity. Fixed at the root (negated `quantity` alongside the other
fields in both mappers) plus a regression assertion added to
`gst-report-queries.test.ts`, since a pre-existing bug that breaks this spec's stated
business rule is this spec's problem to fix, not defer. (2) **LOW, fixed** — the
GstRegisterTotals zero-value literal was duplicated across five files; extracted to one
exported `ZERO_GST_REGISTER_TOTALS` constant in `src/types/gst-report.ts`. **Security
review: 0 findings**, explicit PASS on cross-tenant isolation (the new batched
`prisma.product.findMany` lookup), authorization ordering, Server Action input
validation, information disclosure, and IDOR. Re-verified: `npx tsc --noEmit`, `npx
eslint src prisma` (0 errors), `npx vitest run` (1529/1529), `next build` all pass.

Committed on branch `feature/hsn-summary`. Not yet browser-verified (no browser tool
available this session), pushed, or merged into `main` — see progress-tracker.md's
Current Phase entry.

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

**Neither GSTR-2 (#80) nor ITC Register (#81) is implemented yet.** HSN Summary (#58,
above) is now implemented, closing out Phase 8's original four-item batch; GSTR-2/ITC
Register are the two remaining Phase 8 items. Per `ai-workflow-rules.md`'s
one-feature-at-a-time rule, which of the two goes next is a priority decision for the
user, not assumed here — see progress-tracker.md's Next Up.

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
| 59  | Employee Master | Company    | ✅     |
| 60  | Attendance      | Employee   | ✅     |
| 61  | Payroll         | Attendance | ✅     |

**Employee Master (#59) implemented 2026-09-11** on branch `feature/employee-master`,
merged into `main` (`--no-ff`, no conflicts, `596d8fe`). Added a new `Employee` Prisma
model — the first genuinely new domain since Phase 5/6 — company-scoped
Create/Edit/Activate/Deactivate master (no delete, no auto-numbering, matching the
Customer/Supplier/Warehouse master shape). `employeeCode` unique per company,
`fullName`/`joiningDate` required, everything else optional. Two deliberate deviations
from the spec's literal (simpler) schema draft, both confirmed by review: `branchId` and
`userId` each use a composite tenant-safe FK — `(companyId, branchId) -> Branch(companyId,
id)` and `(companyId, userId) -> User(companyId, id)` — mirroring Warehouse's own
`branchId` precedent, so the database itself rejects a cross-company link as
defense-in-depth behind `employee-repository.ts`'s `assertAssignableBranch`/
`assertAssignableUser` checks, rather than relying on application-layer validation alone.
`User.companyId` being nullable (PLATFORM users) is unaffected — Postgres treats each
`NULL` as distinct under a unique index. `Employee.userId` stays optional/nullable/unique
(no `User` row is ever created by this module; linking/unlinking never cascades either
entity's `isActive`), per spec's User ↔ Employee decision. No per-employee `Ledger`
(payroll liability is pooled, per spec). New `src/modules/employees/` (repository,
service, Zod schema, Server Actions, five form sections — Identity/Contact/Address/
Branch & Login Link/Salary — reusing `ProductOptionSelector` for both the branch and
user pickers instead of new bespoke Select wrappers) and `/masters/employees` (list with
search + status filter via a new `EmployeeFilterBar`, mirroring `customer-filter-bar.tsx`'s
URL-state pattern; create; edit). Added the "Employees" card to `/masters` and the
`employees` breadcrumb label. Gated on the pre-existing `employees` permission module
(no catalog changes needed). 42 new vitest cases (schema required/optional matrix and
blank→undefined normalization, `employeeCode` uniqueness error translation, `branchId`
cross-company/inactive rejection, `userId` cross-company/inactive/already-linked-to-a-
different-employee rejection including the "same employee" exemption, `basicSalary`
bounds) — 1571/1571 total suite passing. `npx tsc --noEmit`, `npx eslint src prisma` (0
errors, the same 2 pre-existing unrelated warnings), `npx vitest run`, and `next build`
all pass; `/masters/employees` (list/new/edit) appears in the build route table.
Browser-verified end-to-end (Playwright-driven): logged in as `admin`, confirmed the
Employees card on `/masters`, created an employee, edited it (fields prefilled
correctly), exercised the search and status filters, toggled Deactivate/Activate — zero
console errors throughout.

**Post-implementation code review + security review (run in parallel) found 1 HIGH (code),
1 MEDIUM (security), and 2 LOW (code) — all fixed**, no CRITICAL: (1) **HIGH, fixed** —
the spec's explicit "search and status filter" requirement for the list page had no UI:
`employeeService.listEmployees`/`employeeRepository.buildWhere` fully supported
`EmployeeListFilters`, but `EmployeeListPage` called it with no arguments and no filter
component existed. Added `EmployeeFilterBar` (mirroring `customer-filter-bar.tsx`) and
wired `searchParams` parsing into the list page, re-verified live (search-no-match shows
the empty state, search-match shows the row, status=inactive hides an active row). (2)
**MEDIUM, fixed** — security review flagged that `Employee.userId`'s FK was a plain
reference to `User.id` with no tenant-scoping at the DB level, unlike `branchId`'s
already-composite FK; a future write path that forgot to call `assertAssignableUser`
would have no database backstop. Fixed by adding `@@unique([companyId, id])` to `User`
and repointing `Employee.user`'s relation to the composite `(companyId, userId) ->
User(companyId, id)` FK (new migration `20260911170359_employee_user_composite_fk`,
applied via `prisma migrate deploy` after generating its SQL with `prisma migrate diff`,
since `prisma migrate dev` refused to run non-interactively in this session — the
warning it was blocking on was the expected "adds a unique constraint" notice, safe
against this schema's actual data). (3) **LOW, fixed** — a stray uncommitted
`docker-compose.yml` `restart: unless-stopped` → `restart: always` change (unrelated to
this feature, pre-existing in the working tree) was deliberately excluded from the
commit rather than bundled in. (4) **LOW, fixed** — `employee-form.tsx` redundantly
wrapped an already-hydrated `Date` prop in another `new Date(...)`; removed, matching
every sibling form's convention. Re-verified after fixes: `npx tsc --noEmit`, `npx eslint
src prisma` (0 errors), `npx vitest run` (1571/1571), `next build` all pass; filter bar
re-verified live via Playwright (zero console errors).

**One environment fix along the way, unrelated to the feature's own correctness:** the
local dev database's `_prisma_migrations` table had a checksum mismatch against the
already-applied `20260911060923_batch_tracking` migration file (a CRLF/LF drift from this
Windows checkout's `core.autocrlf=true` setting — the file's committed content was
unchanged). Resolved with the user's explicit confirmation by running `npx prisma migrate
reset --force` (which required the user to run it directly, since Prisma's own
AI-agent safety guard blocks a non-interactive consent-flag bypass) before this
feature's own migration could be created; the dev database was then reseeded
(`npx tsx prisma/seed.ts`, since the reset did not auto-run it this time) before browser
verification could log in.

**Attendance (#60) implemented 2026-09-12** on branch `feature/attendance`, merged into
`main` (`--no-ff`, no conflicts, `9e4a407`). Added a new `Attendance` Prisma model +
`AttendanceStatus` enum (`PRESENT`/`ABSENT`/`HALF_DAY`/`ON_LEAVE`) per
`62-attendance.md`'s Granularity Decision: one row per `(employee, date)`, never a
pre-aggregated monthly summary — `getAttendanceSummary` is a live `groupBy`/`count`
query, not a materialized cache. `@@unique([companyId, employeeId, date])` backs
`markAttendance`'s upsert (a corrected day overwrites the existing row; no separate edit
action, no history/audit trail of prior values, no delete). Both `employeeId` and the
optional, denormalized `branchId` use composite tenant-safe FKs — `(companyId,
employeeId) -> Employee(companyId, id)` and `(companyId, branchId) ->
Branch(companyId, id)` — the same defense-in-depth posture `61-employee-master.md`'s own
review established; `Employee` gained a new `@@unique([companyId, id])` to support it
(this feature's own security review caught the spec's literal plain-FK draft on
`employeeId` before it ever reached `main`, so it was fixed pre-merge rather than as a
follow-up, unlike Employee Master's `userId` fix which landed after its first merge).
New `src/modules/attendance/` (repository — `upsertOne`/`upsertMany`/`findMany`/
`getSummary`, with `assertActiveEmployees` batching bulk entries by distinct
`employeeId` instead of one lookup per row; service; Zod schema; Server Actions) and a
new `/employees` hub (distinct from Employee Master's own `/masters/employees`) with
`/employees/attendance` (roster: date picker, per-employee status/remarks, bulk-save)
and `/employees/attendance/history` (read-only, employee + date-range filtered,
defaulting to the current month when no date filter is supplied at all). Wired the
previously-inert "Employees" sidebar entry to `/employees` and added the
`employees/attendance`/`attendance/history` breadcrumb labels. Gated on the existing
`employees` permission module (`view` for reads/history, `create` for marking
attendance — no separate edit action, matching the upsert design); no permission
catalog changes needed. 42 new vitest cases (upsert-overwrite behavior, future-date
rejection, inactive/cross-company employee rejection for both `markAttendance` and
`markAttendanceBulk`, bulk all-or-nothing transactional behavior, and
`getAttendanceSummary`'s per-status counts against a fixture spanning all four statuses
plus unmarked days) — 1604/1604 total suite passing. `npx tsc --noEmit`, `npx eslint src
prisma` (0 errors, the same 2 pre-existing unrelated warnings), `npx vitest run`, and
`next build` all pass; `/employees`, `/employees/attendance`, and
`/employees/attendance/history` appear in the build route table. Browser-verified
end-to-end (Playwright-driven): logged in as `admin`, confirmed the Attendance card on
`/employees`, marked an employee Present on the roster and saved, confirmed it appears
on the History page with the correct status badge — zero console errors throughout.

**Post-implementation code review + security review (run in parallel) found 1 MEDIUM
(security) and 2 MEDIUM + 2 LOW (code) — all fixed**, no CRITICAL/HIGH: (1) **MEDIUM,
security, fixed** — `Attendance.employeeId` was a plain FK with no tenant-scoping at the
DB level, repeating the exact gap `61-employee-master.md`'s review had already fixed
once for `Employee.branchId`/`userId`; fixed by adding `@@unique([companyId, id])` to
`Employee` and repointing `Attendance.employee`'s relation to the composite FK (new
migration `20260912153446_attendance_employee_composite_fk`, applied via `prisma
migrate deploy` after generating its SQL with `prisma migrate diff --from-config-datasource`,
since `prisma migrate dev` again refused to run non-interactively — the same "adds a
unique constraint" warning Employee Master's own `userId` fix hit). (2) **MEDIUM, code,
fixed** — `/employees/attendance/history` had no default date bound, so a bare visit
with no query params queried the company's entire attendance history in one
unfiltered, unpaginated call; fixed by defaulting to the current calendar month only
when the visitor supplies neither `dateFrom` nor `dateTo` at all (an explicit one-sided
range is left exactly as typed). (3) **MEDIUM, code, fixed** — both pages' own
hand-rolled `DATE_REGEX` validated date-param *shape* only, not calendar validity (e.g.
`?date=2026-99-99` passed the regex, then reached `new Date(...)` as `Invalid Date` with
no `error.tsx` boundary anywhere under `src/app/employees/`, crashing the page for any
user who hand-edited the URL); fixed by reusing `attendance-schema.ts`'s
`isValidCalendarDate` in both pages instead, re-verified live (malformed dates on both
pages now return 200, not a crash). (4) **LOW, fixed** — the exported but never-used
`attendanceListFiltersSchema`/`AttendanceListFiltersInput` (dead code duplicating the
now-shared `isValidCalendarDate` logic) and the unused `MarkAttendanceEntry` type were
removed. (5) **LOW, fixed** — `upsertMany`'s per-entry `assertActiveEmployee` call (one
`findUnique` per row, redundant when a "single employee across a date range" batch
repeats the same `employeeId` up to 500 times) was replaced with a new
`assertActiveEmployees` that resolves every distinct `employeeId` in the batch with one
`findMany` call. Re-verified after fixes: `npx tsc --noEmit`, `npx eslint src prisma` (0
errors), `npx vitest run` (1604/1604), `next build` all pass; browser re-verified live
(zero console errors, malformed-date 200 checks passing).

**Payroll (#61, spec 63) — Phase 9's last remaining item — implemented 2026-09-12** on
branch `feature/inventory-reports` (unchanged — this session continued on the same
branch every Phase 10 report so far has used, still not merged into `main`). Deliberately
deferred earlier the same day (below note, now superseded) when the user chose to skip
ahead to Trial Balance instead of finishing Phase 9 in order; picked back up when
Employee Reports (#71, spec 73) turned out to hard-depend on this spec's posted
`PayrollRun`/`PayrollRunItem` data — the user was asked whether to implement Payroll
first, implement Employee Reports partially (Directory + Attendance Summary only), or
stop and record the blocker, and chose to implement Payroll first, restoring normal
in-order sequencing before Phase 10 continues.

Added `PayrollRunStatus` enum, `PayrollRun`/`PayrollRunItem` models, `VoucherType.SALARY`,
`DocumentType.PAYROLL`/`SALARY_VOUCHER`, and two new nullable `CompanySettings` ledger-
mapping columns (`salaryExpenseLedgerId`/`salaryPayableLedgerId`) — one migration
(`20260912143436_add_payroll`). New `src/modules/payroll/` module
(repository/service/validation/actions/components) plus a new
`src/modules/company/utils/payroll-ledger-mapping.ts`/`payroll-ledger-mapping-form.tsx`
pair extending the existing Settings > Sales & Purchase GST Ledgers page with a "Payroll
Ledgers" section (mirrors `purchase-ledger-mapping.ts` exactly — two fields instead of
six, no round-off concept). `createDraft`/`refreshDraft` compute each active employee's
worked-day ratio via `attendanceService.getAttendanceSummary` (never re-implemented) and
net salary (`presentDays + 0.5 x halfDays`, rounded half-up to paise); an employee with no
`basicSalary` is excluded from the draft, not an error. `postPayrollRun` re-validates
every rule against current state inside one Serializable transaction (period-overlap,
ledger-mapping completeness/group/active/company checks), recomputes every line fresh,
posts one aggregate `VoucherType.SALARY` voucher (Debit Salary Expense, Credit Salary
Payable, both equal to `totalNetSalary`), and assigns `payrollNumber` — mirrors
`purchase-invoice-service.ts`'s `postPurchaseInvoice` orchestration shape. Cancellation
mirrors the voucher reversal only, per spec: attendance is never un-marked. New
`/employees/payroll`, `/employees/payroll/new`, `/employees/payroll/[id]` pages; a
"Payroll" card added to the `/employees` hub. 39 new vitest cases (calculations, schema,
repository, service) — 1909/1909 final total suite passing (after the two review-fix
regression tests below); `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`,
and `next build` all pass; `/employees/payroll*` appears in the build route table.

**Code review + security review (run in parallel) both independently caught the same
issue — 1 HIGH (code)/1 MEDIUM (security), 1 LOW (security) — all fixed**:
`attendanceService.getAttendanceSummaryBulk` (added below for Employee Reports) was
gated on `employees`/`view` instead of `reports`/`view`, which would have 403'd the
seeded Accountant role the whole Payroll re-gating effort (`listPayrollRunsForReport`/
`getEmployeeSalaryHistory`) was done to support; re-gated to `reports`/`view`.
`listPayrollRunsForReport`'s `financialYearId` bypassed schema validation before
reaching the repository — added a new `payrollRunReportFiltersSchema` and validated
through it. See `progress-tracker.md`'s Payroll entry for the full writeup.

**Not yet browser-verified this session, not merged into `main`, and not yet marked
done** — same "implement now, mark done/merge only on separate explicit instruction"
posture this branch's prior Reports features already established (see Customer/Supplier
Reports entries in `progress-tracker.md`).

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
| 62  | Trial Balance     | Voucher Engine | ✅     |
| 63  | Profit & Loss     | Accounting     | ✅     |
| 64  | Balance Sheet     | Accounting     | ✅     |
| 65  | Cash Flow         | Accounting     | ✅     |
| 66  | Sales Reports     | Sales          | ✅     |
| 67  | Purchase Reports  | Purchase       | ✅     |
| 68  | Inventory Reports | Inventory      | ✅     |
| 69  | Customer Reports  | Customers      | ✅     |
| 70  | Supplier Reports  | Suppliers      | ✅     |
| 71  | Employee Reports  | Employees      | ✅     |
| 72  | GST Reports       | GST            | ✅     |

**Trial Balance (#62, spec 64) implemented 2026-09-12** on branch `feature/trial-balance`,
per explicit user instruction ("start Trial Balance") ahead of Payroll (#61, Phase 9) —
see the deferral note at the end of Phase 9's section above. The first tenant of the
Reporting Engine and the `/reports` hub, exactly as spec 64 calls for. Pure UI +
presentation layer over the already-implemented `voucherEngine.getTrialBalance`
(feature-spec 31) — no engine changes, no new Prisma model or migration, matching the
spec's Data Model ("Reports are read-only; reports derive data only from vouchers").

New `src/engines/reporting/` (`types.ts`, `ledger-classification.ts` —
`buildLedgerGroupIndex`/`getRootGroup`, `trial-balance.ts` — `buildTrialBalanceReport`),
fully pure: no I/O, no permission checks, no `companyId` parameter anywhere in the
directory, per the spec's own convention (matching `30-pricing-engine.md`/
`33-gst-engine.md`/`57-gst-registers.md`'s aggregation functions). `buildTrialBalanceReport`
walks the `LedgerGroup` hierarchy, attaches each `TrialBalanceRow` to its group, and rolls
subtotals up from leaf to root; a group with zero ledgers anywhere in its own subtree is
omitted entirely, one with at least one (even zero-activity) is included with a correct
subtotal. The report's own `totalDebit`/`totalCredit` are copied straight from
`TrialBalanceResult`, never independently re-summed — a dedicated test asserts this with
deliberately mismatched fixture totals to prove no recomputation happens.

`src/modules/reports/services/trial-balance-report-service.ts`
(`trialBalanceReportService.getTrialBalanceReport`) is the only I/O: resolves the caller's
company from the session (never client-supplied), gates on the `reports`/`view`
permission (module already existed in `PERMISSION_MODULES`, no catalog change needed),
re-verifies the requested Financial Year belongs to the caller's own company, validates
the as-of date against that Financial Year's own `[startDate, endDate]` range, then calls
`voucherQueries.getTrialBalance` and `ledgerGroupRepository.findMany` in parallel before
handing both to `buildTrialBalanceReport`. `src/modules/reports/validation/
financial-report-filters-schema.ts` holds the shared Zod shape (`financialYearId`,
`asOfDate`) plus `resolveDefaultAsOfDate` (today, clamped into the selected Financial
Year's own date range) — written to be reused unmodified by Balance Sheet (spec 66)'s own
as-of-date screen, per spec 64's own note.

New `/reports` hub (Trial Balance linked; ten placeholder cards — Profit & Loss, Balance
Sheet, Cash Flow, and the seven Phase 10 operational reports — all "Coming soon," matching
`57-gst-registers.md`'s "hub exists before every sibling screen does" precedent) and
`/reports/trial-balance` (Financial Year + As-Of-Date filter bar, a nested/expandable
Ledger Group tree with Debit/Credit subtotals, a Grand Total row, an out-of-range as-of
date rendering a friendly inline error instead of crashing). Wired the Sidebar's
previously-inert "Reports" entry to `/reports` and added `reports`/`trial-balance`
breadcrumb labels. A forward-noted, currently-unused `getTrialBalanceReportAction` Server
Action exists alongside the service (the page calls the service directly, matching
`57-gst-registers.md`'s own precedent of pages calling GST services directly rather than
through their sibling Server Action).

26 new vitest cases (engine: parent-subtotal rollup across 3 nested levels, grand total
copied verbatim from a deliberately mismatched fixture, empty-subtree omission,
zero-activity-ledger inclusion, Debit/Credit sign split, `getRootGroup` 3-level resolution;
service: `reports:view` permission gate, cross-company Financial Year rejection, both
as-of-date range boundaries accepted/rejected, grand-total pass-through; schema: calendar
date validation, `resolveDefaultAsOfDate` clamping in both directions) — 1630/1630 total
suite passing. `npx tsc --noEmit`, `npx eslint src prisma` (0 errors, the same 2
pre-existing unrelated warnings), `npx vitest run`, and `next build` all pass; `/reports`
and `/reports/trial-balance` both appear in the build route table. Browser-verified
end-to-end (Playwright-driven): logged in as `admin`, confirmed the Trial Balance card on
`/reports`, viewed the seeded company's Cash-in-Hand ledger correctly grouped and
balancing at 0.00/0.00, collapsed/expanded a group, changed the as-of date, and confirmed
an out-of-range date renders the inline validation error rather than crashing — zero
console errors throughout.

**Code review + security review (run in parallel) both APPROVE, zero CRITICAL/HIGH/
MEDIUM/LOW findings.** Code review confirmed all five spec-critical rules directly against
the diff (no independent arithmetic, correct empty-subtree pruning, sign convention
matching `getTrialBalance` exactly, cross-tenant scoping, and a fully I/O-free engine
layer). Security review gave an explicit PASS on all five requested areas (permission
enforcement on every path, IDOR/cross-tenant isolation on `financialYearId` — three
redundant checks all producing the same generic "not found" message, input validation of
every `searchParams`/`rawFilters` value, no information disclosure via thrown errors, and
no other OWASP-relevant gap for a read-only report); its two LOW/informational notes
(the unused forward-noted Server Action; no endpoint-specific rate limiting, consistent
with every other reporting/list page in this codebase) were accepted as-is, not fixed —
neither is a vulnerability.

**Profit & Loss (#63, spec 65) implemented 2026-09-12** on branch `feature/profit-and-loss`,
per explicit user instruction ("start Profit & Loss"), immediately following Trial Balance
(#62) in the same session. The second tenant of the Reporting Engine and the `/reports`
hub, reusing both exactly as spec 65 calls for — no engine change to `voucherEngine`, no
new Prisma model or migration, no new `voucher-queries.ts` method.

New `src/engines/reporting/profit-and-loss.ts` (`buildProfitAndLossReport`, pure; `dayBefore`,
a small pure calendar-arithmetic helper), reusing `ledger-classification.ts`'s
`buildLedgerGroupIndex` exactly as `trial-balance.ts` does. Splits a company's LedgerGroups
into the four Trading/P&L Account buckets (`directIncome`/`directExpense`/`indirectIncome`/
`indirectExpense`) directly from each group's own `natureType` + `affectsGrossProfit`
columns — no parent-chain walk needed, since every group (root or child) carries both
explicitly at creation (confirmed by code review against `ledger-group-service.ts`'s
inherit-from-parent logic, so a bucket split can never fracture a parent/child chain across
buckets). Within each bucket, the same recursive parent/child rollup shape as Trial Balance
applies, but with a single signed `value` per row (INCOME = periodCredit − periodDebit,
EXPENSE = periodDebit − periodCredit) instead of split Debit/Credit columns — a zero-value
ledger row is filtered out (unlike Trial Balance, which lists every ledger for completeness),
and a group left with no rows and no non-empty child sections is omitted entirely, matching
the spec's "a hundred zero-value expense-head rows is noise" rule. Gross Profit = Direct
Income − Direct Expense; Net Profit = Gross Profit + Indirect Income − Indirect Expense.

`src/modules/reports/services/profit-and-loss-service.ts` (`profitAndLossService.
getProfitAndLoss`) is the only I/O: resolves the caller's company from session, gates on
`reports`/`view` (no permission-catalog change needed), re-verifies the requested Financial
Year belongs to the caller's own company, validates both `from` and `to` against that FY's
own `[startDate, endDate]` range, then calls `voucherQueries.getTrialBalance` **twice** in
parallel (once as-of `to`, once as-of the day immediately before `from`, via `dayBefore`)
plus `ledgerGroupRepository.findMany`, diffs each ledger's `totalDebit`/`totalCredit` between
the two results (never `closingBalance` — it folds in `Ledger.openingBalance`, which this
report must not assume is always zero for an Income/Expense ledger), filters to
INCOME/EXPENSE-nature ledgers, and hands the diffed movements to `buildProfitAndLossReport`.
`financial-report-filters-schema.ts` gained `profitAndLossFiltersSchema` (a `from`/`to`
variant of Trial Balance's shape, `to >= from` enforced by a Zod `refine`) alongside the
existing `trialBalanceFiltersSchema` — no new schema file, per spec 64's own convention note.

New `/reports/profit-and-loss` (Financial Year + from/to Date Range filter bar defaulting to
`[FY.startDate, today-clamped]`; a two-section Trading Account / Profit & Loss Account
layout, each with its own subtotal line down to a visually-distinguished Net Profit/Loss
figure) and a new `financial-year-date-range-filter-bar.tsx` / `profit-and-loss-statement.tsx`
component pair — dedicated rather than genericizing `trial-balance-group-tree.tsx` (single
signed-value column vs. split Debit/Credit), matching this codebase's own established
precedent of small per-report duplication over premature shared abstraction (as
`financial-report-filters-schema.ts`'s own comment already documents for its date helpers).
Wired the `/reports` hub's "Profit & Loss" card (added, unlinked, by spec 64) to
`/reports/profit-and-loss` and added the `profit-and-loss` breadcrumb label. A forward-noted,
currently-unused `getProfitAndLossReportAction` Server Action exists alongside the service,
mirroring Trial Balance's own precedent.

31 new vitest cases (engine: Gross/Net Profit formula against a seeded Direct+Indirect
fixture, return/reversal netting for both Income- and Expense-nature ledgers, negative
Expense-ledger value displayed unclamped, zero-activity group omission without affecting
profit totals, nested-group subtotal rollup within one bucket, ASSET/LIABILITY discard,
`dayBefore` calendar arithmetic across a month boundary; service: `reports:view` permission
gate, cross-company Financial Year rejection, both boundary-date rejections/acceptances, the
two-call diff isolating period-only movement so prior-period activity never leaks in, `from`
equal to the FY's own `startDate` producing the same result as a since-inception P&L — added
after code review flagged it as spec-required but missing — INCOME/EXPENSE-only scoping;
schema: valid/equal/invalid `to`-before-`from` ranges) — 1654/1654 total suite passing.
`npx tsc --noEmit`, `npx eslint src prisma` (0 errors, the same 2 pre-existing unrelated
warnings), `npx vitest run`, and `next build` all pass; `/reports/profit-and-loss` appears in
the build route table.

**Code review + security review (run in parallel) both APPROVE, zero CRITICAL/HIGH findings
from either.** Code review raised one MEDIUM (the spec's Code Standards section explicitly
requires a test for "`from` equal to the FY's own `startDate`", and the only test touching
that boundary asserted `resolves.toBeDefined()` without checking the actual computed figures)
— **fixed** before merge by adding a test that mocks a non-zero as-of-`to` total and a
zero as-of-`dayBefore(from)` total and asserts the reported period value equals the full
since-inception amount; re-verified green afterward. Security review gave an explicit PASS
on all six requested areas (permission enforcement on every path including the page's own
`hasPermission` gate and the service's independent `assertPermission`, IDOR/cross-tenant
isolation on `financialYearId` via two independent checks, input validation of every
`searchParams` value before it reaches Prisma or date arithmetic, no information disclosure
via thrown errors — routed through the same `toActionErrorMessage` helper as Trial Balance,
no raw SQL/eval/XSS surface, no hardcoded secrets) — empty findings list, explicitly stated
as passing.

**Merged into `main` 2026-09-12** — `feature/profit-and-loss` merged `--no-ff` (`0a3ca6f`,
on top of feature commit `94c2ffb`), no conflicts, checks re-verified green against the
merged result (`npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run` 1654/1654,
`next build`). Feature branch deleted post-merge per the one-branch-at-a-time rule.

Manual/browser UI verification (the kind Trial Balance received via Playwright) was **not**
performed this session — no browser-automation tool was available. Confirmed instead via
`curl` that `/reports/profit-and-loss` resolves through the app's auth middleware correctly
(307 redirect to `/login` for an unauthenticated request, matching every other protected
route) rather than crashing. This is a recorded gap, not a silent skip — a follow-up
Playwright-driven click-through (financial year + date range changes, expand/collapse
sections, negative Net Profit color, out-of-range date validation) is still owed before this
can be considered as fully verified as Trial Balance was.

**Balance Sheet (#64, spec 66) implemented 2026-09-12** on branch `feature/balance-sheet`,
per explicit user instruction ("start Balance Sheet"), immediately following Profit & Loss
(#63) in the same session. The third tenant of the Reporting Engine and the `/reports` hub,
reusing both exactly as spec 66 calls for. **No new Prisma model, enum, field, or migration**
— the spec's own research brief resolved the classification gap it raised: `LedgerGroup.
natureType` already provides the statutory Balance-Sheet head classification this report
needs (Capital Account/Reserves & Surplus/Loans/Current Liabilities already seed
`natureType = LIABILITY`; Fixed Assets/Investments/Current Assets/Misc. Expenses already seed
`natureType = ASSET`), so no `groupNature`/`headType` field was added.

New `src/engines/reporting/balance-sheet.ts` (`buildBalanceSheetReport`, pure), reusing
`ledger-classification.ts`'s `buildLedgerGroupIndex` exactly as `trial-balance.ts` and
`profit-and-loss.ts` do. A single `voucherEngine.getTrialBalance(companyId, financialYearId,
asOfDate)` call (a point-in-time snapshot, unlike Profit & Loss's two-call diff) supplies
every figure: Assets side = every `ASSET`-nature ledger's `closingBalance` used directly;
Liabilities side (raw) = every `LIABILITY`-nature ledger's `closingBalance`, sign-flipped
(`-closingBalance`). The Current-Period Profit & Loss plug is **never independently
recomputed** — it is `profitAndLossService.getProfitAndLoss`'s own `netProfit` figure (called
FY-to-date, `financialYear.startDate` through this report's own `asOfDate`), appended to the
Liabilities side as a synthetic "Profit & Loss Account (Current Period)" section (a loss
renders as a negative figure, never hidden). `isBalanced = totalAssets === totalLiabilities`
(both rounded to 2 decimals, `totalLiabilities` inclusive of the plug) is a genuine computed
check, not a hardcoded `true` — a dedicated test supplies a deliberately mismatched plug and
asserts it flags `false`.

`src/modules/reports/services/balance-sheet-service.ts` (`balanceSheetService.
getBalanceSheet`) is the only I/O: resolves the caller's company from session, gates on
`reports`/`view` (no permission-catalog change needed), re-verifies the requested Financial
Year belongs to the caller's own company, validates the as-of date against that FY's own
`[startDate, endDate]` range, then calls `voucherQueries.getTrialBalance`,
`ledgerGroupRepository.findMany`, and `profitAndLossService.getProfitAndLoss` (FY-to-date, in
parallel) before handing the results to `buildBalanceSheetReport`. Reuses
`trialBalanceFiltersSchema` (the as-of-date shape) verbatim — no new schema file, exactly as
spec 64 anticipated when it wrote that schema for Balance Sheet's own future reuse.

New `/reports/balance-sheet` (Financial Year + As-Of-Date filter bar — the same
`financial-year-as-of-date-filter-bar.tsx` Trial Balance already built, reused unmodified; a
two-column Liabilities-left/Assets-right layout per Indian/Tally convention, each grouped by
Ledger Group with subtotals, a visible balanced/unbalanced indicator, and a grand-total row
per side) and a new `balance-sheet-statement.tsx` component — a dedicated per-report renderer
(single signed "value" column) matching `profit-and-loss-statement.tsx`'s own established
precedent over genericizing `trial-balance-group-tree.tsx`. Wired the `/reports` hub's
"Balance Sheet" card (added, unlinked, by spec 64) to `/reports/balance-sheet` and added the
`balance-sheet` breadcrumb label. A forward-noted, currently-unused
`getBalanceSheetReportAction` Server Action exists alongside the service, mirroring Trial
Balance/Profit & Loss's own precedent.

**Known Limitation carried forward from the spec, not fixed here (out of scope):** a Balance
Sheet run for any Financial Year after the company's first will not include prior years'
postings unless `Ledger.openingBalance` was manually re-entered for that later year — no
year-end-closing/opening-balance-carry-forward mechanism exists yet
(`09-financial-year.md`'s own deferred scope). Flagged here again as a follow-up for whichever
future spec finally builds Financial-Year closing.

17 new vitest cases (engine: Assets/Liabilities balanced against both a profitable and a
loss-making Net Profit plug, `LIABILITY`-nature sign-flip, `ASSET`-nature direct value,
synthetic P&L plug section appended under Liabilities, `isBalanced` correctly `false` against
a deliberately mismatched fixture proving the check is real, nested-LIABILITY-group subtotal
rollup, INCOME/EXPENSE-nature discard from both sides; service: `reports:view` permission
gate, cross-company Financial Year rejection, missing-FY rejection, both as-of-date range
boundaries accepted/rejected, `profitAndLossService.getProfitAndLoss` called with the FY's own
`startDate` through `asOfDate` — asserted on the call arguments, not just the resulting
numbers, per the spec's own requirement — company-scoped fetch calls, netProfit passthrough)
— 1671/1671 total suite passing. `npx tsc --noEmit`, `npx eslint src prisma` (0 errors, the
same 2 pre-existing unrelated warnings), `npx vitest run`, and `next build` all pass;
`/reports/balance-sheet` appears in the build route table.

**Code review + security review (run in parallel) both APPROVE, zero CRITICAL/HIGH/MEDIUM/LOW
findings from either.** Code review confirmed all six requested areas directly against the
diff: no independent Net Profit recomputation (asserted via the mocked P&L service's call
arguments, not just matching numbers), correct sign-flip/balancing-identity math, a genuine
computed `isBalanced` (proven by the mismatched-fixture test), cross-company isolation/
permission gating matching the sibling services line-for-line, no `any`/duplicated logic,
and full Code-Standards test coverage per the spec. Security review gave an explicit PASS on
all six requested areas (permission enforcement at both page and service boundary, IDOR/
cross-tenant isolation on `financialYearId` re-verified independently by both this service and
the nested Profit & Loss call, input validation of every `searchParams`/raw-filter value via
the reused Zod schema, no information disclosure via thrown errors, no raw-SQL/eval/XSS
surface, no hardcoded secrets) — empty findings list, explicitly stated as passing.

**Merged into `main` 2026-09-12** — `feature/balance-sheet` merged `--no-ff` (`ef189b0`, on
top of feature commit `efe5ade`), no conflicts, checks re-verified green against the merged
result (`npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run` 1671/1671, `next build`),
then pushed to `origin/main`. Feature branch deleted post-merge per the one-branch-at-a-time
rule.

Manual/browser UI verification was **not** performed this session (no browser-automation tool
was available, same recorded gap as Profit & Loss) — confirmed instead via `curl` that
`/reports/balance-sheet` resolves through the app's auth middleware correctly (307 redirect to
`/login` for an unauthenticated request) rather than crashing. A follow-up Playwright-driven
click-through (financial year + as-of-date changes, expand/collapse sections, the balanced/
unbalanced indicator, out-of-range date validation) is still owed for both this and Profit &
Loss before either can be considered as fully verified as Trial Balance was.

**Cash Flow (#65, spec 67) implemented 2026-09-12** on branch `feature/cash-flow`, per
explicit user instruction ("start Cash Flow"), immediately following Balance Sheet (#64) in
the same session. The fourth and last tenant of the Reporting Engine and the `/reports` hub
— completes Phase 10's four financial reports (#62–65). **No new Prisma model, enum, field,
or migration.** Uses the **direct method** (not indirect), per the spec's own explicit
justification: every rupee of cash movement already exists as a `VoucherEntry` against a
Cash-in-Hand or `BankAccount`-linked `Ledger`, so there is no accrual-basis gap for an
indirect reconciliation to adjust for.

New `src/lib/ledger-class.ts` export `getCashAndBankLedgerIds(companyId)` — the read-only,
plain-id-set equivalent of the existing throwing `assertLedgersAreCashOrBank` (spec
52-payment-voucher.md), sharing a new internal `isCashOrBankClass` classification helper so
the Cash-in-Hand-subtree-or-bank-linked rule lives in exactly one place. Reads
`ledgerGroupRepository.findMany` + `getGroupSubtreeIds([CASH_IN_HAND_GROUP_NAME])` plus a new
`ledgerRepository.findAllForValidation(companyId)` (the company-wide variant of the existing
`findLedgersForValidation`, added after code review flagged the first version's two
sequential round trips to the same `ledger` table as a wasteful duplicate fetch — fixed
before merge). A cross-check test in `ledger-class.test.ts` asserts `getCashAndBankLedgerIds`
agrees with `assertLedgersAreCashOrBank`'s own classification per-ledger, per the spec's own
requirement.

New `src/engines/reporting/cash-flow.ts` (`buildCashFlowReport`, pure) — unlike Trial
Balance/Profit & Loss/Balance Sheet, produces no ledger-level rows: just three category
totals (`operating`/`investing`/`financing`) plus the headline `netChangeInCash` and a
computed `reconciles` flag. Categorizes every non-cash counter-ledger entry of a
cash-touching voucher by its **root group name** via `getRootGroup`/`buildLedgerGroupIndex`
(64-trial-balance.md, reused unmodified): `"Fixed Assets"`/`"Investments"` → Investing;
`"Capital Account"`/`"Reserves & Surplus"`/`"Loans (Liability)"` → Financing; every other root
group → Operating. `CREDIT` contributes `+amount`, `DEBIT` contributes `-amount`. A Contra
Voucher (every entry Cash/Bank-class) has no non-cash entry to categorize and so contributes
to no category and to no net change — the correct treatment for an internal transfer between
cash equivalents, verified by a dedicated test. `reconciles = round2(operating + investing +
financing) === netChangeInCash` is a genuine computed integrity check (a deliberately
corrupted fixture asserts it correctly flags `false`), mirroring Balance Sheet's `isBalanced`.

New `src/modules/vouchers/repositories/voucher-repository.ts` method
`findCashTouchingEntries(companyId, from, to, cashLedgerIds)` — the one genuinely new query
this batch adds (additive only, no change to any existing exported function): every
`VoucherEntry` in `[from, to]` whose own ledger is **not** Cash/Bank-class
(`ledgerId: { notIn: cashLedgerIds }`) but whose `Voucher` has at least one sibling entry that
is (`entries: { some: { ledgerId: { in: cashLedgerIds } } } }`), company-scoped, returned with
`ledgerGroupId` joined through `Ledger`.

`src/modules/reports/services/cash-flow-service.ts` (`cashFlowService.getCashFlow`) is the
only I/O: resolves the caller's company from session, gates on `reports`/`view`, re-verifies
the requested Financial Year belongs to the caller's own company, validates `from`/`to`
against that FY's own `[startDate, endDate]` range, resolves the company's Cash/Bank ledger
id set via `getCashAndBankLedgerIds`, then in parallel calls
`voucherQueries.getLedgerStatement` once per Cash/Bank ledger (each ledger's period movement
is `closingBalance − openingBalance`, never re-summed from raw entries — same discipline as
every sibling report), `voucherRepository.findCashTouchingEntries`, and
`ledgerGroupRepository.findMany`, before handing everything to `buildCashFlowReport`. Reuses
`profitAndLossFiltersSchema` (the `from`/`to` shape) verbatim — no new schema file, exactly as
spec 64/65 anticipated for this reuse.

New `/reports/cash-flow` (the same `financial-year-date-range-filter-bar.tsx` Profit & Loss
already built, reused unmodified) and a new `cash-flow-statement.tsx` component — a flat
three-row Operating/Investing/Financing layout plus a headline Net Increase/Decrease in Cash
figure and a visible `reconciles` indicator, deliberately **not** the nested Ledger Group tree
interaction the other three reports share, since `CashFlowReport` carries no ledger-level rows
to expand. Wired the `/reports` hub's "Cash Flow" card (added, unlinked, by spec 64) to
`/reports/cash-flow` and added the `cash-flow` breadcrumb label. A forward-noted,
currently-unused `getCashFlowReportAction` Server Action exists alongside the service,
mirroring every sibling report's own precedent.

22 new vitest cases (engine: Operating+Investing+Financing summing exactly to
`netChangeInCash` across a fixture spanning a Payment Voucher, a Receipt Voucher, a
self-cancelling Contra Voucher, a Fixed Assets purchase, a Capital introduction, and a Sales
Invoice settled partly by cash; the Contra Voucher contributing to no category/no net change
in isolation; Fixed Assets purchase → Investing; Capital introduction → Financing; a
3+-level-deep counter-ledger (Current Liabilities → Sundry Creditors) resolving to the
correct Operating root; `reconciles` correctly `false` against a deliberately corrupted
fixture; repository: `findCashTouchingEntries` excluding both a fully-non-cash voucher and the
Cash/Bank-side entries themselves; `ledger-class`: `getCashAndBankLedgerIds` cross-checked
against `assertLedgersAreCashOrBank`, inactive-ledger exclusion, empty-company handling;
service: `reports:view` permission gate, cross-company Financial Year rejection, both from/to
range boundaries accepted/rejected, per-ledger `getLedgerStatement` calls scoped to the
caller's own company, `findCashTouchingEntries` receiving the resolved Cash/Bank id list,
company-scoped ledger-group fetch, net-change derived from `closingBalance − openingBalance`
without re-summing) — 1693/1693 total suite passing. `npx tsc --noEmit`, `npx eslint src
prisma` (0 errors, the same 2 pre-existing unrelated warnings), `npx vitest run`, and
`next build` all pass; `/reports/cash-flow` appears in the build route table.

**Code review + security review (run in parallel) both APPROVE.** Code review raised one
MEDIUM (`getCashAndBankLedgerIds`'s first version called `ledgerRepository.findMany` purely
to discover ids, then immediately re-fetched the same rows via `findLedgersForValidation` —
two round trips, one with an unnecessary `ledgerGroup` join, to read the same data once) —
**fixed** before merge by adding `ledgerRepository.findAllForValidation(companyId)` (the
company-wide variant of `findLedgersForValidation`, same select shape) and switching
`getCashAndBankLedgerIds` to call it directly instead of the two-call sequence; re-verified
green (`tsc`/`eslint`/`vitest` 1693/1693/`next build`) afterward. Security review gave an
explicit PASS on all six requested areas (permission enforcement before any data fetch,
IDOR/cross-tenant isolation re-verified independently across `getCashAndBankLedgerIds`,
`findCashTouchingEntries`, and the Financial Year resolution, input validation of `from`/`to`
against both the Zod schema and the resolved FY's own range, no information disclosure via
thrown errors — the "Financial year not found" message is identical whether the FY doesn't
exist or belongs to another tenant, no raw-SQL/injection surface, no hardcoded secrets/new
network dependency, consistent with the project's Offline First rule) — zero CRITICAL/HIGH/
MEDIUM findings, explicitly stated as passing.

**No browser/Playwright click-through was performed this session** (no browser-automation
tool was available, same recorded gap as Profit & Loss and Balance Sheet) — confirmed
instead via `curl` that `/reports/cash-flow` resolves through the app's auth middleware
correctly (307 redirect to `/login`) rather than crashing.

**Merged into `main` 2026-09-12** — `feature/cash-flow` merged `--no-ff`, no conflicts, on
top of feature commit `f4da842`, checks re-verified green against the merged result
(`npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run` 1693/1693, `next build`), then
pushed to `origin/main`. Feature branch deleted both locally and on `origin` post-merge per
the one-branch-at-a-time rule. **This completes Phase 10 — Reporting's four financial
reports (#62–65).**

**Sales Reports (#66, spec 68) implemented 2026-09-12** on branch `feature/sales-reports`,
per explicit user instruction ("start Sales Reports"), immediately following Cash Flow
(#65) in the same session — the first of Phase 10's seven **operational** reports
(#66–72), as opposed to the four financial reports (#62–65) above. **No new Prisma model,
enum, field, or migration** — every figure is read directly from an already-posted
`SalesInvoice`/`SalesInvoiceItem`/`SalesReturn` row or a plain sum/group of those stored
columns, per the spec's own Data Model section.

Four views, all MVP-scoped per the spec's own Goal section: **Sales Register** (every
`SalesInvoice`, POSTED by default with an explicit status override — the one view that
supports one), **Item-wise Sales Report** (grouped by product), **Party-wise Sales
Summary** (grouped by customer, with `WALK_IN`/unconverted-`QUICK` sales bucketed into
their own labeled synthetic rows rather than dropped or merged), and **Sales Return
Summary** (every `SalesReturn`, customer resolved from its parent invoice). Deferred, per
the spec's own explicit scope decision: Quotation/Sales Order/Delivery Challan reporting,
a conversion-funnel report, Credit Note/Debit Note registers, margin/profitability
analysis, and Excel/PDF export mechanics (forward-note only).

**Amended** (not a new repository) `src/modules/sales-invoices/repositories/sales-invoice-
repository.ts` with two new aggregate methods: `aggregateItemWiseSales` (a Prisma
`groupBy` on `SalesInvoiceItem.productId`, joined through `salesInvoice` for the
date/FY/customer/product/warehouse filters, POSTED-only; a product's `invoiceCount` is
the size of a distinct-`salesInvoiceId` `Set` built from a second narrow `findMany` over
the same `where` clause — never a raw row count, which would over-count a product billed
twice on one invoice) and `aggregatePartyWiseSales` (a `groupBy` on `(SalesInvoice.
customerId, customerMode)` — grouping by the pair rather than `customerId` alone still
yields exactly one row per real customer, since a `customerId`-bearing invoice is always
`customerMode: "PERMANENT"` by the time it's ever assigned one, while still separating the
two `customerId: null` synthetic buckets, WALK_IN vs. unconverted QUICK, from each other).
Both resolve their own batched product/customer name lookup (one query each, no N+1).

**Amended** both sibling services with report-scoped read methods, gated on `reports`/
`view` instead of `sales`/`view` — `salesInvoiceService.listSalesInvoicesForReport` /
`getItemWiseSalesReport` / `getPartyWiseSalesReport`, and `salesReturnService.
listSalesReturnsForReport` — so the seeded Accountant role (`reports:view`, no
`sales:view` per `DEFAULT_ROLE_PERMISSIONS`) can reach every Sales Reports view without
also needing Sales module access; the original `sales:view`-gated `listSalesInvoices`/
`listSalesReturns` methods are untouched.

New `src/engines/reporting/sales-reports.ts` (`buildSalesRegister`,
`buildItemWiseSalesReport`, `buildPartyWiseSalesReport`, `buildSalesReturnSummary` — all
pure, no Prisma import, no `gstEngine`/`pricingEngine`/`inventoryEngine` call anywhere),
composing each owning service's read into this spec's view-model types: combining each
row's separate `cgst`/`sgst`/`igst`/`cess` into one presentation `totalTax` figure,
assigning the two synthetic Party-wise buckets their own display labels ("Walk-in Sales" /
"Quick Customer Sales (unconverted)"), and computing every totals footer as a plain sum
(never a business-rule recomputation). New `src/modules/reports/sales/` module
(`validation/sales-report-schema.ts` — a shared `dateFrom`/`dateTo` + `dateFrom <= dateTo`
refine shape across all four views, deliberately with **no** `financialYearId` field
despite the spec's own Business Rules section listing one as optional, since every read
this module calls already scopes to `getCurrentFinancialYear()` internally and has no
caller-selectable financial year anywhere else in the Sales module unlike the
financial-reports batch's ledger data; `services/sales-report-service.ts` — the only
layer every page calls, itself gated on `reports`/`view`, plus three filter-bar option
lookups reading Prisma directly by `companyId`, mirroring `gst-register-service.ts`'s own
`listPartyOptions` precedent for the same Accountant-role reason; `components/` — one
shared `SalesReportFilterBar` plus four dedicated table components, one per view, each
with its own totals footer row).

New `/reports/sales` (a four-card sub-hub) and `/reports/sales/{register,item-wise,
party-wise,returns}`. Flipped the `/reports` hub's "Sales Reports" card from disabled
"Coming soon" to linked — the fifth of the hub's eleven cards to go live, and the first of
Phase 10's seven operational reports. Added `reports/sales` (the composite-key form,
disambiguating against the bare `sales` key already used by `/sales`), `register`,
`item-wise`, and `party-wise` breadcrumb labels (`returns` already existed from
`/sales/returns`, so `/reports/sales/returns` falls back to the bare "Sales Returns" label
rather than a more specific "Sales Return Summary" — a known, accepted, purely-cosmetic
limitation of the breadcrumb mechanism's one-segment-back lookup, recorded in
`breadcrumbs.ts` itself rather than worked around).

29 new vitest cases (engine: totals-footer math for all four `build*` functions including
the totalTax-combination formula, both synthetic Party-wise bucket labels, the
Sales-Return-Summary in-memory customerId filter and its cross-company/no-match
empty-result case; repository — added after code review flagged the initial diff's
coverage gap against this spec's own explicit test requirement: distinct-invoice-count via
`Set` proven against a product billed twice on one invoice, per-group where-clause
scoping, both synthetic Party-wise buckets kept as two distinct null-`customerId` rows,
unresolved-product/customer placeholder fallback; service: `reports:view` (not
`sales:view`) permission gate on every report-scoped method, empty-financial-year
short-circuit without calling the repository; schema: date-range refine, status default,
uuid rejection) — 1744/1744 total suite passing. `npx tsc --noEmit`, `npx eslint src
prisma` (0 errors, the same 2 pre-existing unrelated warnings), `npx vitest run`, and
`next build` all pass; `/reports/sales*` all appear in the build route table.

**Browser-verified end-to-end** (Playwright-driven, this session's dev server): logged in
as `admin`, confirmed the auto-select company/financial-year/branch redirect chain lands
correctly, then visited `/reports/sales` and all four view pages — each renders its full
filter bar (date range plus its own view-specific optional filters), the correct
spec-mandated empty-state message against this dev database's currently-empty Sales data,
and the correct page heading/breadcrumb — with zero console/page errors throughout.
End-to-end verification against real posted-invoice data (multi-invoice/multi-product/
multi-customer, including the `WALK_IN`/unconverted-`QUICK` synthetic-bucket case) was
carried by the new repository/engine vitest fixtures instead, since seeding that much
master + transactional data live was out of proportion to this session's own scope — the
same trade-off Profit & Loss/Balance Sheet/Cash Flow's own entries above recorded for
their lack of a live browser click-through, inverted (this feature got the live click-
through but not live multi-row data; those three got neither).

**Code review + security review (run in parallel, before merge) both APPROVE, zero
CRITICAL/HIGH findings from either.** Code review raised one MEDIUM — the spec's own Code
Standards section explicitly requires vitest coverage for `aggregateItemWiseSales`/
`aggregatePartyWiseSales` "correctness against a seeded multi-invoice, multi-product,
multi-customer fixture," and the tests that existed before this fix only asserted the
service layer forwarded arguments to a *mocked* repository, never exercising the real
`groupBy`/`Set`-based dedup logic — **fixed** before merge by adding a new
`sales-invoice-repository.test.ts` (11 cases, mirroring `attendance-repository.test.ts`'s
convention of mocking the module-level Prisma client's specific model methods directly,
since neither new method takes a `tx` parameter) that proves the distinct-invoice-count
`Set` and the `(customerId, customerMode)` synthetic-bucket split both hold under a
multi-line-per-invoice fixture; re-verified green afterward (1744/1744). Code review's one
LOW (the spec's own file list names a `sales-report-actions.ts` Server Action that was
never created, since all four pages call `salesReportService` directly instead) was
confirmed against the merged sibling financial-reports batch to be consistent with
**already-established practice, not a regression** — `trial-balance-actions.ts`/
`cash-flow-actions.ts`/etc. are equally unused forward-noted files that no page in `main`
actually calls — so left as-is, unfixed, matching precedent. Security review gave an
explicit PASS on all four requested areas (cross-tenant isolation/IDOR — every aggregate
query scoped by `companyId`/`financialYearId` as an explicit repository parameter, never
client input, so a cross-company filter id naturally yields an empty result rather than
leaking data; authorization — every page and every new/changed service method
independently calls `assertPermission`/`hasPermission` before any data work, and the
original `sales:view`-gated methods are unchanged; input validation — every filter value
is Zod-validated server-side before reaching a query; information disclosure — errors
route through the existing `toActionErrorMessage` helper, never revealing cross-tenant
existence) — two LOW/informational notes (the filter-bar option lookups only list active
rows, cosmetic only; `customerId`/`productId`/`warehouseId` aren't page-level pre-checked
the way `dateFrom`/`dateTo`/`status` are, though the shared Zod schema still validates them
server-side before any query runs) accepted as-is, no fix needed.

**Merged into `main` 2026-09-12** — `feature/sales-reports` merged `--no-ff` (`402b37a`,
on top of feature commit `c3fa1be`), no conflicts, checks re-verified green against the
merged result (`npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run` 1744/1744,
`next build`). Feature branch deleted locally per the one-branch-at-a-time rule. Not yet
pushed to `origin/main` this session.

**Purchase Reports (#67, spec 69) implemented 2026-09-12** on branch
`feature/purchase-reports`, per explicit user instruction ("start Purchase Reports"),
immediately following Sales Reports (#66) in the same session — the second of Phase 10's
seven **operational** reports (#66–72), explicitly the purchase-side mirror of spec 68 per
that spec's own Project Context note ("read `68-sales-reports.md` first in full ... only
what differs is elaborated here"). **No new Prisma model, enum, field, or migration** —
every figure is read directly from an already-posted `PurchaseInvoice`/
`PurchaseInvoiceItem`/`PurchaseReturn` row or a plain sum/group of those stored columns.

Four views, all MVP-scoped per the spec's own Goal section: **Purchase Register** (every
`PurchaseInvoice`, POSTED by default with an explicit status override, showing both the
system invoice number and the supplier's own `supplierInvoiceNumber`), **Item-wise
Purchase Report** (grouped by product), **Party-wise Purchase Summary** (grouped by
supplier — **no synthetic-bucket handling needed**, unlike Sales Reports' own
`WALK_IN`/unconverted-`QUICK` bucketing, since every `PurchaseInvoice` has a required,
non-null `supplierId` per spec 44's own Decisions — a genuine structural simplification
recorded explicitly in the types/engine/tests rather than silently assumed symmetric with
spec 68), and **Purchase Return Summary** (every `PurchaseReturn`, resolving its supplier
via the parent invoice since `PurchaseReturn` has no direct `supplierId` column, POSTED by
default with a totals footer).

Amended `purchase-invoice-repository.ts` with two new aggregate methods
(`aggregateItemWisePurchases`, `aggregatePartyWisePurchases`), mirroring
`sales-invoice-repository.ts`'s own `aggregateItemWiseSales`/`aggregatePartyWiseSales`
exactly — distinct-invoice-count via a `Set` (never a raw row count, which would
over-count a product billed twice on one invoice), scoped to `companyId`/
`financialYearId`/`status: "POSTED"`/date range, with the batched `product.findMany`/
`supplier.findMany` name-resolution lookups themselves `companyId`-scoped. New
report-scoped service methods (`listPurchaseInvoicesForReport`,
`getItemWisePurchaseReport`, `getPartyWisePurchaseReport` on `purchase-invoice-service.ts`;
`listPurchaseReturnsForReport` on `purchase-return-service.ts`), all gated on
`reports`/`view` instead of `purchase`/`view` — so the seeded Accountant role
(`reports:view`, no `purchase:view`) can reach every Purchase Reports view without also
needing Purchase module access; the original `purchase:view`-gated `listPurchaseInvoices`/
`listPurchaseReturns` methods are untouched.

New `src/engines/reporting/purchase-reports.ts` (`buildPurchaseRegister`,
`buildItemWisePurchaseReport`, `buildPartyWisePurchaseReport`, `buildPurchaseReturnSummary`
— all pure, no Prisma import, no `gstEngine`/`pricingEngine`/`inventoryEngine` call
anywhere), composing each owning service's read into this spec's view-model types:
combining each row's separate `cgst`/`sgst`/`igst`/`cess` into one presentation `totalTax`
figure, and the Purchase Return Summary's in-memory `supplierId` filter (resolved via each
return's parent invoice, since `PurchaseReturn` has no direct `supplierId` column) against
rows already company-scoped by `listPurchaseReturnsForReport` — a cross-company id
naturally yields an empty result, never a throw.

New `src/modules/reports/purchase/` module (`validation/purchase-report-schema.ts` — same
shared date-range/uuid-filter/status-default shape as `sales-report-schema.ts` with
`supplierId` in place of `customerId` and no `customerMode`-equivalent field;
`services/purchase-report-service.ts` — the layer every page calls, gating all four public
methods plus three filter-bar option lookups (`listSupplierOptions`/`listProductOptions`/
`listWarehouseOptions`) on `reports`/`view`; five components mirroring the Sales Reports
components 1:1, with `PartyWisePurchaseTable` correctly omitting the synthetic-bucket
badge its Sales counterpart has).

New `/reports/purchase` (a four-card sub-hub) and `/reports/purchase/{register,item-wise,
party-wise,returns}`. Flipped the `/reports` hub's "Purchase Reports" card from disabled
"Coming soon" to linked — the sixth of the hub's eleven cards to go live. Added
`reports/purchase` (the composite-key form, disambiguating against the bare `purchase` key
already used by `/purchase`), `purchase/register`, `purchase/item-wise`, and
`purchase/party-wise` composite breadcrumb labels — disambiguating against the bare
`register`/`item-wise`/`party-wise` keys Sales Reports' own screens already claimed, since
the previous path segment before each of those three is `purchase` for every
`/reports/purchase/*` route (`returns` has the identical known, accepted, purely-cosmetic
limitation spec 68's own entry above records: `/reports/purchase/returns`'s `returns`
segment falls back to the existing `purchase/returns` composite key, "Purchase Returns" —
the actual document list's own label — rather than a more specific "Purchase Return
Summary").

48 new vitest cases (engine: totals-footer math for all four `build*` functions including
the totalTax-combination formula, an explicit assertion that `PartyWisePurchaseRow` never
carries a `groupType` property, the Purchase-Return-Summary in-memory supplierId filter
and its cross-company/no-match empty-result case; repository — proactively written
alongside the implementation this time (not added after a code-review fix, unlike Sales
Reports' own history): distinct-invoice-count via `Set` proven against a product billed
twice on one invoice, per-group where-clause scoping, unresolved-product/supplier
placeholder fallback; service: `reports:view` (not `purchase:view`) permission gate on
every report-scoped method, empty-financial-year short-circuit without calling the
repository; schema: date-range refine, status default, uuid rejection) — 1792/1792 total
suite passing. `npx tsc --noEmit`, `npx eslint src prisma` (0 errors, the same 2
pre-existing unrelated warnings), `npx vitest run`, and `next build` all pass;
`/reports/purchase*` all appear in the build route table.

**Not browser-verified end-to-end this session** — unlike Sales Reports' own
Playwright-driven click-through, no browser-automation tooling (`chromium-cli`,
Playwright) was available in this environment, and this app's login form is a Next.js
Server Action, not readily curl-testable without reverse-engineering the action id.
Verified instead via an unauthenticated `curl` smoke test against a locally started
`next dev` server: all five new `/reports/purchase*` routes returned the expected `307`
auth-redirect (not a `500`), confirming the routes resolve and render at the Next.js
routing layer without crashing — a narrower check than Sales Reports' own live,
authenticated filter-bar/empty-state/zero-console-error verification, recorded here
explicitly rather than overclaimed. Business-logic correctness is carried entirely by the
new repository/engine vitest fixtures, the same trade-off Sales Reports' own entry above
made for real posted-invoice data.

**Code review + security review (run in parallel, before merge) both APPROVE/PASS, zero
CRITICAL/HIGH/MEDIUM findings from either.** Unlike Sales Reports' own history, no
post-review fix was needed — the aggregate-repository test coverage code review's earlier
pass flagged as missing on the Sales side was written proactively here from the start.
Security review gave an explicit PASS on all four requested areas (cross-tenant
isolation/IDOR; authorization — every page and every new/changed service method
independently calls `assertPermission`/`hasPermission`; input validation — every filter
value is Zod-validated server-side; information disclosure — errors route through the
existing `toActionErrorMessage` helper) — three LOW/informational notes (the Purchase
Return Summary's in-memory `supplierId` filter fetches more rows than strictly necessary
before filtering, matching Sales Reports' own identical accepted pattern; the same
cosmetic `/reports/purchase/returns` breadcrumb-label collision noted above; `productId`/
`warehouseId` aren't independently re-verified against the caller's company before
entering the `groupBy` where clause, safe today only because Prisma's implicit
AND-combination with the sibling `purchaseInvoice: { companyId }` condition means a
foreign id naturally yields zero rows) accepted as-is, no fix needed.

**Merge into `main` deferred this session** — blocked by this session's auto-mode
classifier ("Merge Without Review"), unlike Sales Reports' own same-session merge.
Implementation sits fully reviewed and committed on `feature/purchase-reports` (commit
`6b8d22e`), awaiting explicit user go-ahead to merge.

**Inventory Reports (#68), Customer Reports (#69), and Supplier Reports (#70) were
implemented after this point** — see `progress-tracker.md` for their full narrative
entries (this file's own entry stream stopped being kept in lockstep after Purchase
Reports; only the status table above was kept current for those three).

**Employee Reports (#71, spec 73) implemented 2026-09-12** on branch
`feature/inventory-reports` (unchanged), immediately after Payroll (#61, Phase 9) was
implemented to unblock it — see Phase 9's own entry above for why Payroll was picked back
up. Depends on Payroll's posted `PayrollRun`/`PayrollRunItem` data and Attendance's
`getAttendanceSummary`. Four views: Attendance Summary, Payroll Register, Salary
Register, Employee Directory. New `src/engines/reporting/employee-reports.ts` (pure
composition); new `src/modules/reports/employees/` module; new `/reports/employees*`
pages; `/reports` hub card flipped from disabled "Coming soon" to linked.

**Amendments this spec required, in the Attendance and Payroll modules it consumes**
(never a second, divergent implementation): `attendanceRepository.
aggregateSummaryForEmployees`/`attendanceService.getAttendanceSummaryBulk` — the same
per-status `groupBy` `getSummary` already performs for one employee, batched across many
via `groupBy(["employeeId", "status"])`, parity-tested against calling `getSummary` once
per employee. `payrollRunService.listPayrollRunsForReport` (new) and `getEmployeeSalaryHistory`
(re-gated) both moved to `reports`/`view` instead of `employees`/`view` — the seeded
Accountant role has `reports`/`view` but no `employees` module access at all, the same
`listPurchaseInvoicesForReport` precedent Customer/Supplier/Purchase Reports already
established for their own masters-gated services. `EmployeeListFilters` gained
`department`/`designation`/`branchId` (Employee Directory's own filters, which spec 73
assumed already existed on `employeeService.listEmployees` but didn't).

**Deliberate deviation from the spec's own literal wording, the same precedent every
report in this batch has established**: every view queries `prisma.employee`/`prisma.
branch` directly in `employee-report-service.ts` (its own `listReportEmployees`) rather
than through `employeeService.listEmployees`/`listSelectableEmployees` (the spec's own
literal suggestion) — that service gates on `employees`/`view`, which would 403 the
seeded Accountant role this module exists to serve.

24 new vitest cases (engine + attendance bulk + service); final suite total 1909/1909
after the two review-fix regression tests recorded in Payroll's own entry above (one of
which — the permission gate on this feature's `getAttendanceSummaryBulk` — belongs to
this feature); `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and
`next build` all pass; `/reports/employees*` appears in the build route table.

**Not yet browser-verified this session, not merged into `main`, and not yet marked
done** — same posture as Payroll above. See Payroll's entry above for the code review +
security review outcome (both findings were on this feature's own
`getAttendanceSummaryBulk` permission gate, fixed).

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
`6f9274c`). **GSTR-3B (#57) is implemented, reviewed, and merged into `main`**
(`77e88f9`, plus a post-merge client-boundary bugfix `7699db4` — see the Phase 8 section
above). **HSN Summary (#58) is implemented, reviewed, and merged into `main`**
(`feature/hsn-summary` `--no-ff` merged `99a25d4`, no conflicts, checks re-verified
green — `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run` 1529/1529, `next
build`), closing Phase 8's original four-item batch. Both code-reviewer and
security-reviewer ran retroactively against the merged commit (review was skipped before
the merge itself — a process slip, corrected by running both immediately after): **APPROVE**,
zero CRITICAL/HIGH findings from either. code-reviewer raised one MEDIUM (an unreachable-
in-practice edge case in `buildHsnSummaryRows` where a `productId` that fails to resolve
via `loadProductInfo` contributes no `unitLabels` entry — financially inert, flagged as a
follow-up test-coverage gap, not fixed) and one LOW (the `sumTotals` reducer is duplicated
verbatim between `hsn-summary-service.ts` and `gst-register-service.ts` — a follow-up
extraction candidate, not fixed). security-reviewer confirmed company-scoping,
authorization, input validation, and error handling are all sound, with one LOW/
informational note (unbounded/unpaginated date range, an existing pattern shared with GST
Registers, not introduced here). Neither MEDIUM/LOW blocks anything — both deferred as
optional follow-ups. **GSTR-2 (#80) is implemented, reviewed (both code-reviewer and
security-reviewer APPROVE, zero CRITICAL/HIGH/MEDIUM), and merged into `main`**
(`feature/gstr-2` `--no-ff` merged `2fdd91f`, no conflicts, checks re-verified green —
see the Phase 8 section above for the full record). ITC Register (#81) is now the
one remaining Phase 8 item — **awaiting explicit instruction to start it.**

**GSTR-2 (#80) implemented 2026-09-11** on branch `feature/gstr-2`, per
`82-gstr-2.md`. Pure read-only aggregation over `getInwardSupplyLines` (spec 57) — no
new Prisma model, enum, or migration, and no `GstFilingRecord` interaction anywhere
(the first Phase 8 return service with no filing concept at all, matching the spec's
Filing section). `gstr2Service.getGstr2Return()` computes:
- **Table 3** (registered supplies) — one row per Purchase Invoice/Purchase Return
  document (`buildRegisteredSupplies`, filtered to `partyGstin` present), carrying the
  spec's explicit reverse-charge caveat (no `isReverseCharge` flag exists anywhere, so
  every registered-supplier line lands here regardless of actual RCM status). A
  Purchase Return keeps its own `documentId` (its own return, not its parent invoice)
  and lands as its own negative row rather than merging into the invoice's row — the
  period's total still nets to zero, verified by a dedicated test.
- **Table 7** (composition/exempt) — consolidated **by party** (`partyId`), not by
  (place, rate) the way GSTR-1's own Table 7 is — a deliberate divergence the spec
  itself calls for. Filtered to `partyGstin` absent **or** `ratePercent = 0`,
  independently of Table 3's own filter — a nil-rated line from a registered supplier
  therefore legitimately appears in **both** Table 3 and Table 7 (unlike GSTR-1, where
  nil-rated routing is mutually exclusive with B2B); a test locks this in explicitly
  so it isn't mistaken for a bug later.
- **Tables 4/5/8/9/11** — always `computed: false`, `amount: 0`, non-empty reason
  (reverse charge, import/SEZ, ISD credit, TDS/TCS credit, ITC reversal — each a
  distinct pre-existing gap named in `57-gst-registers.md`/`59-gstr-3b.md`).
- **Tables 6/10/12/13** — absent from the return shape entirely (not even a labeled
  ₹0 row) — amendments, advances, output-tax mismatch, and purchase-side HSN summary
  all have no data shape to render against, per the spec's own Business Rules.

UI: `/gst/gstr-2` reuses `Gstr1PeriodSelector` (month/quarter, from `CompanySettings.
gstFilingFrequency` + the active Financial Year — no filing-status banner, since
there is nothing to file), a static banner stating the view is derived entirely from
posted purchases and does not reflect GSTR-2A/2B or portal data, then Tables 3/4/5/7/
8/9/11 in statutory order. New components `Gstr2DocumentGroupTable` (Table 3) and
`Gstr2PartyConsolidatedTable` (Table 7) — reimplemented rather than reusing
`Gstr1DocumentGroupTable`/`Gstr1ConsolidatedTable` directly, since both this spec's
document-type/href set (Purchase Invoice/Return) and Table 7's grouping key (party,
not place+rate) differ from GSTR-1's own shapes; `Gstr2NotTrackedSection` covers
Tables 4/5/8/9/11 uniformly. The not-tracked badge itself (`Gstr3bRowNote`) is
imported unmodified from spec 59's own components, per the spec's explicit "no
duplicate badge component" instruction. Wired the `/gst` hub's GSTR-2 card (previously
absent — the hub's original four cards were GST Registers/GSTR-1/GSTR-3B/HSN Summary
only) and added `"gstr-2": "GSTR-2"` to `breadcrumbs.ts`.

Testing: 10 new service tests (`gstr2-service.test.ts` — Table 3 grouping/netting,
Table 7 party consolidation, the Table 3/Table 7 overlap case above, every
not-computed row's shape, company-scoping) plus a dedicated cross-service
reconciliation test (`gstr2-gstr3b-reconciliation.test.ts`) asserting Table 3's
cgst/sgst/igst/cess totals equal `gstr3bService`'s Table 4(A)(5) exactly, for a
fixture scoped to registered-supplier-only lines (the precondition under which the
spec's literal "Table 3's total reconciles exactly with (A)(5)" claim holds — since
GSTR-3B's (A)(5) sums *all* inward lines while GSTR-2's Table 3 only sums
GSTIN-present ones, the two only coincide when no Table 7-eligible line exists in the
period; documented in-line rather than silently assumed). 1539/1539 total suite
passing (90 in `src/modules/gst`). `npx tsc --noEmit`, `npx eslint src prisma` (0
errors, the same 2 pre-existing unrelated warnings), `npx vitest run`, and `next
build` all pass; `/gst/gstr-2` appears in the build route table.

**code-reviewer and security-reviewer both ran on `feature/gstr-2` (commit `d2837a8`)
before merge this time** (learning from the HSN Summary process slip): **both
APPROVE, zero CRITICAL/HIGH/MEDIUM findings.** code-reviewer confirmed Table 3/Table 7
grouping matches the spec's Business Rules exactly (including the deliberate Table
3/Table 7 overlap for a nil-rated registered-supplier line, verified as a defensible
reading of the spec text rather than a bug), confirmed Tables 4/5/8/9/11 are never
partially computed, confirmed Tables 6/10/12/13 are absent from the shape, and
confirmed zero `GstFilingRecord`/filing-repository references anywhere (grep-clean) —
two LOW notes (an unused `gstr2-actions.ts` server action, matching the identical
pre-existing pattern in `gstr1-actions.ts`/`hsn-summary-actions.ts`; an unreachable
defensive fallback in `buildCompositionAndExemptSupplies`), neither a regression.
security-reviewer confirmed company-scoping, permission enforcement (page + service
layer), input validation, and Purchase Invoice/Return document-link IDOR safety (the
linked detail pages independently re-verify `companyId` ownership and their own
`purchase`/`view` permission) — two LOW/informational notes (the page's own
`isValidCalendarDate` check doesn't independently enforce `to >= from`, matching every
sibling GST page's identical pre-existing pattern; harmless since an inverted range
just yields an empty result set). Neither review found anything requiring a fix.

**Merged into `main`** (`feature/gstr-2` `--no-ff` merged `2fdd91f`, no conflicts,
checks re-verified green on the merged result — `npx tsc --noEmit`, `npx eslint src
prisma` (0 errors, same 2 pre-existing unrelated warnings), `npx vitest run`
1539/1539, `next build` with `/gst/gstr-2` confirmed in the route table). Branch
deleted both locally and on origin. **This closes out GSTR-2 (#80) in full** — status
below updated to ✅. ITC Register (#81) is now the one remaining Phase 8 item.

**ITC Register (#81) implemented 2026-09-11** on branch `feature/itc-register`, per
`83-itc-register.md`, per explicit user instruction ("start ITC Register"). Pure
read-only in-memory grouping over `getInwardSupplyLines` (spec 57) — no new Prisma
model, enum, or migration (the fourth Phase 8 spec, after GST Registers/HSN Summary/
GSTR-2, to add none). `itcRegisterService.getItcRegister()` computes:
- **Rate-wise summary** — grouped by `ratePercent` alone (no place-of-supply
  dimension, unlike GSTR-1's Table 7), ascending.
- **Party-wise (supplier-wise) summary** — grouped by `partyId` (falling back to
  `partyName` only in the theoretical null-`partyId` case, never actually hit for
  inward lines), sorted by total ITC (`cgst+sgst+igst+cess`, not the
  taxable-inclusive `totalAmount`) descending so the largest credit sources surface
  first.
- **HSN-wise summary** — grouped by `hsnCode` alone (no rate dimension, unlike
  `60-hsn-summary.md`'s own (hsnCode, ratePercent) grouping), with the "No HSN
  Assigned" bucket always rendered last, mirroring `hsn-summary-service.ts`'s own
  convention.
- **Transaction-level detail** — the underlying `getInwardSupplyLines` lines
  themselves, rendered via `GstRegisterTable` reused unmodified from
  `57-gst-registers.md`'s own Inward Register (no re-implementation).
- Every line is treated as fully eligible ITC (Business Rules) — a
  permanently-visible eligibility disclaimer (`ItcRegisterEligibilityDisclaimer`, no
  dismiss state) renders unconditionally above the filter bar on every page load.

A Purchase Return's already-signed negative line (from `getInwardSupplyLines`) nets
its parent invoice's group down correctly in all three summaries — verified by a
dedicated test — since grouping operates directly on the already-signed tax fields,
never re-deriving them.

**Deviation from the spec's UI section, recorded per this project's own
discrepancy-recording convention**: rather than literally reusing
`Gstr1ConsolidatedTable`'s shape (which hard-codes a Place of Supply column this
report has no equivalent dimension for) or `HsnSummaryTable` (which carries
GSTR-1-Table-12-specific fields — codeType, description, UQC, quantity — that have
no meaning for an inward tax-credit report), three small dedicated components were
built instead (`ItcRegisterRateSummaryTable`, `ItcRegisterPartySummaryTable`,
`ItcRegisterHsnSummaryTable`), each following the same title/table/footer-total
visual shape as their nearest sibling. A new `ItcRegisterReconciliationTotal`
component renders the spec's required "grand-total row visibly labeled as
reconciling with GSTR-3B's Table 4(A)(5)" as a distinct page element (the actual
ITC figure, `cgst+sgst+igst+cess`, not the taxable-inclusive total) rather than
folding it into one of the three summary tables' own footers.

UI: new `/gst/itc-register` page — disclaimer banner, the shared
`GstReportFilterBar` (Supplier party-dropdown via
`gstRegisterService.listPartyOptions("INWARD")`, reused unmodified), the
reconciliation-total banner, the three summary tables, then the transaction detail
table. Wired the `/gst` hub's new ITC Register card (previously absent — the hub's
five existing cards were GST Registers/GSTR-1/GSTR-3B/HSN Summary/GSTR-2) and added
`"itc-register": "ITC Register"` to `breadcrumbs.ts`.

Testing: 7 new service tests (`itc-register-service.test.ts` — permission gate,
multi-supplier/multi-rate/multi-HSN grouping, party-wise descending sort by actual
ITC, Purchase Return netting across all three summaries, "No HSN Assigned" bucket,
optional-filter application, cross-company isolation) plus a dedicated cross-service
reconciliation test (`itc-register-gstr3b-reconciliation.test.ts`) asserting the
report's own totals (and the rate-wise summary's own sum, not just the top-level
totals field) equal `gstr3bService`'s Table 4(A)(5) `allOtherItc` row exactly, across
a fixture spanning multiple suppliers, rates, HSN codes, and a Purchase Return.
1547/1547 total suite passing. `npx tsc --noEmit`, `npx eslint src prisma` (0 errors,
the same 2 pre-existing unrelated warnings), `npx vitest run`, and `next build` all
pass; `/gst/itc-register` appears in the build route table.

**code-reviewer and security-reviewer both ran on `feature/itc-register` before
merge** (continuing the GSTR-2 precedent): **both APPROVE, zero CRITICAL/HIGH/MEDIUM
findings.** code-reviewer confirmed the rate/party/HSN grouping logic is correct
(including Purchase Return netting and the "No HSN Assigned" bucket), confirmed no
GST arithmetic is invented (every figure is summed straight off `GstSupplyLine`'s
already-computed fields), confirmed the disclaimer renders unconditionally, and
confirmed the GSTR-3B reconciliation test is a genuine cross-service check — one LOW
note (no test explicitly titled "cross-company isolation," though the permission/
company-scoping call itself was exercised), addressed by adding that dedicated test
before merge. security-reviewer confirmed company-scoping (companyId derived solely
from the session, never client-supplied), permission enforcement (page + service
layer), input validation via the shared `gstReportFiltersSchema`, no XSS/injection
risk in the new components, and no cross-company leakage through the reused
`listPartyOptions("INWARD")` party dropdown — zero findings of any severity.

**Merged into `main`** (`feature/itc-register` `--no-ff` merged `d1f8129`, no
conflicts, checks re-verified green on the merged result — `npx tsc --noEmit`,
`npx eslint src prisma` (0 errors, same 2 pre-existing unrelated warnings),
`npx vitest run` 1547/1547, `next build` with `/gst/itc-register` confirmed in
the route table). Branch deleted both locally and on origin. **This closes out
ITC Register (#81) in full** — status above updated to ✅, and with it, **Phase
8 — GST is now fully implemented (#55–#58, #80–#81), reviewed, and merged.**

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

**GST Reports (#72, spec 74) implemented 2026-09-12** on branch `feature/gst-reports`,
per explicit user instruction ("start GST Reports") — the last item of Phase 10,
**closing the Reporting phase in full**. An analytical dashboard over already-implemented
GST Engine output — explicitly distinct from Phase 8's statutory filing screens (see the
spec's own Phase-8-vs-Phase-10 comparison table): a month-bucketed Output Tax/Input
Tax/Net Liability trend, summary tiles, an embedded HSN/rate-wise breakdown (`hsnSummaryService.
getHsnSummary`, spec 60, reused unmodified — no independent HSN aggregation anywhere in
this module), and a read-only per-month Filed/Open status overlay resolved from
`GstFilingRecord` (spec 58, read-only here — never calls `markPeriodFiled`/`reopenPeriod`).

Adds **zero new GST aggregation queries** to `src/engines/gst/`, matching the spec's own
Business Rules: the only new logic is pure month-bucketing,
`src/engines/reporting/gst-dashboard.ts` (`buildGstDashboardReport` — buckets
`GstSupplyLine[]` by `documentDate`'s calendar month, sums signed `cgst+sgst+igst+cess`
per month; `resolveMonthlyFilingStatus` — overlays a `GstFilingRecord` whose
`[periodStart, periodEnd]` contains the month, so a quarterly filer's single 3-month
record correctly produces the identical status on all 3 bucketed months, not 3
independent flags). A month with Input Tax exceeding Output Tax shows a negative Net
Liability, never clamped to zero — verified by a dedicated test. One new repository
method, `gstFilingRepository.findMany(companyId, returnType, from, to)` (range-overlap
read) — no new repository file, matching the spec's "every read reuses an existing one."

`src/modules/reports/services/gst-reports-service.ts` (`gstReportsService.getGstDashboard`)
is the only I/O — gated on **both** `reports:view` **and** `gst:view` (Security: the same
tax-liability confidentiality boundary the GST module itself already draws), calling
`getOutwardSupplyLines`/`getInwardSupplyLines` (spec 57), `hsnSummaryService.
getHsnSummary`, and `gstFilingRepository.findMany` in parallel, then composing all three
into one response. No new Prisma model, enum, or migration (Data Model — matching every
spec in this batch).

**Deliberate, documented deviations from the spec's literal wording:**
1. No charting library exists anywhere in this codebase (every other Phase 10 report
   renders as a table) — the "trend chart" renders as `GstTrendTable`, a table with a
   small CSS-only relative bar per month standing in for a full chart, rather than
   introducing a new dependency (`recharts` or similar) for a single widget. Per-month
   Filed/Open status is folded into the same table's own row (one widget, not two
   separate "trend chart" + "status strip" pieces), since every figure a separate status
   strip would show is already keyed by the same month this table renders.
2. The spec's own literal UI note ("reusing ... the shared Date Range Filter Bar
   (65-profit-and-loss.md's from/to variant)") named `FinancialYearDateRangeFilterBar`,
   which requires a `financialYearId` — contradicting this same spec's own Validation
   section ("no `financialYearId` parameter ... date-range-scoped only"). Built a new,
   minimal `GstDashboardFilterBar` (from/to only, no Financial Year selector) instead,
   consistent with the Validation section's explicit instruction and with
   `gst-report-filter-bar.tsx`'s own plain from/to posture.

**Both code-reviewer and security-reviewer ran before the merge: both APPROVE, zero
CRITICAL/HIGH/MEDIUM/LOW findings** (security review noted two purely informational,
non-blocking observations — the page's default-range fallback and the overlay's O(months
× records) lookup, neither a real concern at this report's expected scale). 20 new vitest
cases (11 Reporting Engine + 9 service-layer, covering signed netting, negative Net
Liability, quarterly-record overlay onto all 3 months, dual-permission rejection either
way, cross-company isolation, and embedded-HSN-output-by-reference) — final total
1924/1924; `npx tsc --noEmit`, `npx eslint src prisma` (0 errors, same 2 pre-existing
warnings), and `next build` all pass; `/reports/gst` appears in the build route table.
Wired the Reports hub's GST Reports card (`available: true`) and a `"reports/gst"`
breadcrumb entry.

**`feature/gst-reports` has been merged into `main`** (`--no-ff` merged `f686c74`, no
conflicts, checks re-verified green against the merged result), branch deleted both
locally and on origin. **This closes Phase 10 — Reporting in full** — all eleven items
(#62–#72) are now implemented, reviewed, and merged.

---

**`feature/inventory-reports` merged into `main` 2026-09-12** (`--no-ff`, no conflicts,
`a30f38e`, pushed to `origin/main`), per explicit user instruction ("start GST Reports")
applying `ai-workflow-rules.md`'s one-branch-at-a-time rule before starting the next
feature. This one branch had accumulated six already-implemented-and-reviewed features
stacked on top of each other without an intermediate merge — Purchase Reports (#67),
Inventory Reports (#68), Customer Reports (#69), Supplier Reports (#70), Payroll (#61),
and Employee Reports (#71) — all now reflected as ✅ in this file's Phase 9/Phase 10
status tables above. Re-verified against the merged result: `npx prisma format`/
`validate`/`generate`, `npx tsc --noEmit` (clean), `npx eslint src prisma` (0 errors, 2
pre-existing warnings), `npx vitest run` (1909/1909), and `next build` (all routes,
including every `/reports/*` page, appear in the route table) all pass. Local branch
`feature/inventory-reports` deleted after the merge. **This closes out Phase 9 in full**
(#59–#61) and leaves GST Reports (#72/spec 74) as the sole remaining item of Phase 10 —
see the Phase 10 section above for its dependency chain (specs 57–60, all implemented and
merged) before implementation begins.

---

# Notes

- Complete one feature at a time.
- Never skip dependencies.
- Each completed feature should update this tracker.
- Every feature must pass TypeScript, ESLint, and build verification before being marked complete.
