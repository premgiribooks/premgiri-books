# Premgiri Books ERP — Milestone v3 Roadmap

This roadmap defines the complete implementation order for Milestone v3.

v3 is a **catch-up + improvement milestone** built on top of a complete v1/v2
foundation. Every phase below assumes v2's Phases 1–11 are fully implemented and merged
into `main`.

Each feature must be completed end-to-end — database migration, repository, service,
validation, Server Actions, UI, tests, and documentation — before the next begins.

---

# Phase 1 — Carry-Over Completions ⬜

Purpose

Complete the two features that were fully spec-drafted in v2 but never implemented.
Both have all their upstream dependencies satisfied.

Features

| Tracker # | Feature                | Spec                                                  | Depends On                              |
| --------- | ---------------------- | ----------------------------------------------------- | --------------------------------------- |
| 82        | Serial Number Tracking | `context-v3/feature-specs/91-serial-number-tracking.md` | Product Management (v2 #23); Batch Tracking (v2 #48) |
| 83        | Payroll                | `context-v3/feature-specs/92-payroll.md`              | Attendance (v2 #60)                     |

Deliverable

The last two v2 carry-overs are merged, tested, and running. Serial-tracked products
can be received, sold, transferred, and their individual serial history viewed.
Employees with attendance records receive a monthly payroll run with a posted voucher.

---

# Phase 2 — Compliance & Commercial ⬜

Purpose

Deliver the five features required for legal compliance and retail counter adoption.
These are the highest-ROI items for bringing the product to market.

Features

| Tracker # | Feature                | Spec                                               | Depends On                               |
| --------- | ---------------------- | -------------------------------------------------- | ---------------------------------------- |
| 84        | Universal Audit Trail  | `context-v3/feature-specs/93-universal-audit-trail.md` | All v2 business modules                  |
| 85        | E-Invoice              | `context-v3/feature-specs/94-e-invoice.md`         | Sales Invoice (v2 #36); GST Engine       |
| 86        | E-Way Bill             | `context-v3/feature-specs/95-e-way-bill.md`        | E-Invoice (#85); Delivery Challan (v2 #35) |
| 87        | Thermal Printing       | `context-v3/feature-specs/96-thermal-printing.md`  | Sales Invoice (v2 #36); Electron IPC     |
| 88        | Barcode Billing        | `context-v3/feature-specs/97-barcode-billing.md`   | Sales Invoice (v2 #36); Products (v2 #23) |

Notes

- Universal Audit Trail (#84) must be implemented first in this phase — its
  `createdBy`/`updatedBy` migration touches every table that subsequent features extend.
- E-Way Bill (#86) depends on E-Invoice (#85) because the IRN is required as an
  E-Way Bill input for invoices above ₹50,000.
- Thermal Printing (#87) and Barcode Billing (#88) are independent of #84–#86 and
  may be implemented in any order relative to each other.

Deliverable

A business above ₹5 Cr turnover can post a Sales Invoice and receive an IRN + QR code.
A retail counter can scan a barcode to add a line and print an 80mm receipt.
Every business-model write is recorded in the audit trail.

---

# Phase 3 — Architecture Hardening ⬜

Purpose

Resolve the seven structural gaps that limit correctness, security, and scalability.
These are internal changes — no new user-facing screens except where noted.

Features

| Tracker # | Feature                         | Spec                                                   | Depends On                              |
| --------- | ------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| 89        | FIFO / Weighted Average Costing | `context-v3/feature-specs/98-fifo-costing.md`          | Inventory Engine (v2 #30); Purchase Invoice (v2 #42) |
| 90        | CompanyUser Join Table          | `context-v3/feature-specs/99-company-user-join-table.md` | Auth (v2 #6); Users (v2 #9)             |
| 91        | Rate Limiting                   | `context-v3/feature-specs/100-rate-limiting.md`        | Proxy/Middleware (src/proxy.ts)          |
| 92        | Database Encryption             | `context-v3/feature-specs/101-database-encryption.md`  | PostgreSQL setup                         |
| 93        | Backup Verification             | `context-v3/feature-specs/102-backup-verification.md`  | Backup & Restore (v2 spec 81)            |
| 94        | PDF Engine Migration            | `context-v3/feature-specs/103-pdf-engine-migration.md` | PDF Generation (v2 spec 78)              |
| 95        | Default Voucher Types Seeder    | `context-v3/feature-specs/104-default-voucher-types.md` | TenantBootstrapService                   |

Notes

- FIFO Costing (#89) extends the Inventory Engine — implement before any new modules
  that depend on cost-layered stock values.
- CompanyUser Join Table (#90) is a cross-cutting data migration — implement on a
  dedicated branch, never alongside another feature.
- PDF Engine Migration (#94) removes Puppeteer — implement before any new PDF templates
  are added.
- Default Voucher Types Seeder (#95) should be implemented before any new company is
  created in the test environment for v3.

Deliverable

Pharmaceutical companies can use FIFO costing. Consultants can manage multiple companies.
Login is brute-force protected. The installer is ~200MB smaller. New companies are
seeded with default voucher types. Backups are verified after every run.

---

# Phase 4 — Code Quality ⬜

Purpose

Reduce technical debt introduced by the v2 migration period. Both items are purely
internal refactors with no new user-visible functionality.

Features

| Tracker # | Feature                    | Spec                                                    | Depends On                                |
| --------- | -------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| 96        | SystemContext Retrofit      | `context-v3/feature-specs/105-system-context-retrofit.md` | All ~15 pre-migration services            |
| 97        | Global Error Boundaries     | `context-v3/feature-specs/106-global-error-boundaries.md` | Next.js App Router                        |

Notes

- These two items are independent of each other and may be worked in parallel.
- Neither requires a database migration.
- Both may be worked concurrently with Phase 3 items (no dependency between them).

Deliverable

Every service in the codebase uses `SystemContext`. Every Next.js route segment has an
`error.tsx` boundary. Zero unhandled Prisma errors reach the user as raw 500 pages.

---

# Phase 5 — Growth Features ⬜

Purpose

Add the three capabilities that differentiate Premgiri Books from all Indian SMB ERP
competitors.

Features

| Tracker # | Feature                | Spec                                                | Depends On                              |
| --------- | ---------------------- | --------------------------------------------------- | --------------------------------------- |
| 98        | AI Insights Engine     | `context-v3/feature-specs/107-ai-insights-engine.md` | Reporting Engine; Dashboard             |
| 99        | Mobile PWA             | `context-v3/feature-specs/108-mobile-pwa.md`        | Dashboard; Reports; Next.js PWA         |
| 100       | Cloud Sync Foundation  | `context-v3/feature-specs/109-cloud-sync-foundation.md` | PostgreSQL; CompanyUser (#90)           |

Notes

- AI Insights Engine (#98) requires a user decision on AI provider (Ollama vs. OpenAI)
  before implementation. See `context-v3/progress-tracker.md` Open Questions.
- Mobile PWA (#99) and Cloud Sync Foundation (#100) are independent of each other.
- Cloud Sync (#100) must be opt-in — the application must pass all existing tests with
  sync fully disabled (no config set).

Deliverable

A business owner can open a phone browser and see today's sales, outstanding balances,
and an AI-generated weekly summary. The system can optionally replicate data to a cloud
Postgres instance for backup and multi-device access.

---

# Milestone v3 Complete ⬜

All 19 features (tracker #82–#100) implemented, reviewed, tested, and merged.
`context-v3/Phases/phase-tracker.md` shows all ✅.
