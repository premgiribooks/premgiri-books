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
| 44  | Opening Stock          | Products           | ⬜     |
| 45  | Stock Adjustment       | Inventory Engine   | ⬜     |
| 46  | Stock Transfer         | Warehouse          | ⬜     |
| 47  | Physical Verification  | Inventory Engine   | ⬜     |
| 48  | Batch Tracking         | Product Management | ⬜     |
| 49  | Serial Number Tracking | Product Management | ⬜     |

---

# Phase 6 — Accounting

Feature-specs for all four items were drafted 2026-09-11 (documentation only, not
implemented), on the same `docs/phase-5-6-feature-specs` branch:

| Tracker # | Feature         | Spec file                                     |
| --------- | --------------- | ---------------------------------------------- |
| 50        | Payment Voucher | `context/feature-specs/52-payment-voucher.md`  |
| 51        | Receipt Voucher | `context/feature-specs/53-receipt-voucher.md`  |
| 52        | Contra Voucher  | `context/feature-specs/54-contra-voucher.md`   |
| 53        | Journal Voucher | `context/feature-specs/55-journal-voucher.md`  |

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
| 50  | Payment Voucher | Voucher Engine | ⬜     |
| 51  | Receipt Voucher | Voucher Engine | ⬜     |
| 52  | Contra Voucher  | Voucher Engine | ⬜     |
| 53  | Journal Voucher | Voucher Engine | ⬜     |

---

# Phase 7 — GST

| #   | Feature       | Depends On | Status |
| --- | ------------- | ---------- | ------ |
| 54  | GST Registers | GST Engine | ⬜     |
| 55  | GSTR-1        | GST Engine | ⬜     |
| 56  | GSTR-3B       | GST Engine | ⬜     |
| 57  | HSN Summary   | GST Engine | ⬜     |

---

# Phase 8 — Employee Management

| #   | Feature         | Depends On | Status |
| --- | --------------- | ---------- | ------ |
| 58  | Employee Master | Company    | ⬜     |
| 59  | Attendance      | Employee   | ⬜     |
| 60  | Payroll         | Attendance | ⬜     |

---

# Phase 9 — Reporting

| #   | Feature           | Depends On     | Status |
| --- | ----------------- | -------------- | ------ |
| 61  | Trial Balance     | Voucher Engine | ⬜     |
| 62  | Profit & Loss     | Accounting     | ⬜     |
| 63  | Balance Sheet     | Accounting     | ⬜     |
| 64  | Cash Flow         | Accounting     | ⬜     |
| 65  | Sales Reports     | Sales          | ⬜     |
| 66  | Purchase Reports  | Purchase       | ⬜     |
| 67  | Inventory Reports | Inventory      | ⬜     |
| 68  | Customer Reports  | Customers      | ⬜     |
| 69  | Supplier Reports  | Suppliers      | ⬜     |
| 70  | Employee Reports  | Employees      | ⬜     |
| 71  | GST Reports       | GST            | ⬜     |

---

# Phase 10 — Productivity Features

| #   | Feature          | Depends On | Status |
| --- | ---------------- | ---------- | ------ |
| 72  | Global Search    | Masters    | ⬜     |
| 73  | Excel Import     | Masters    | ⬜     |
| 74  | Excel Export     | Reports    | ⬜     |
| 75  | PDF Generation   | Reports    | ⬜     |
| 76  | Barcode Billing  | Sales      | ⬜     |
| 77  | Audit Logs       | Platform   | ⬜     |
| 78  | Backup & Restore | Database   | ⬜     |

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

➡ **Phase 5 — Inventory** (Opening Stock #44, Stock Adjustment #45, Stock Transfer #46,
Physical Verification #47, Batch Tracking #48, Serial Number Tracking #49). Phases 1–4
are now all fully complete: Phase 3 — Sales Management (#33–#39, all seven documents)
and Phase 4 — Purchase Management (#40–#43, all four documents, the last being Purchase
Return implemented 2026-09-11) — see each phase's own status paragraph above and
`context/progress-tracker.md`'s Completed entries for the full record. Feature-specs
for Phase 5 (Inventory, tracker #44–#49) and Phase 6 (Accounting — the four manual
voucher screens, tracker #50–#53) are being drafted per explicit user request,
following the same batch-drafting-without-implementation precedent as the Phase 3/4
spec batches (drafted 2026-07-18/19, implemented much later, one at a time). Per
`ai-workflow-rules.md` only one feature is *implemented* at a time; drafting multiple
specs together is the established documentation-only exception, and the next feature
to actually build still awaits explicit user direction.

---

# Notes

- Complete one feature at a time.
- Never skip dependencies.
- Each completed feature should update this tracker.
- Every feature must pass TypeScript, ESLint, and build verification before being marked complete.
