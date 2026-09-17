# Premgiri Books ERP — Milestone v3 Context Plan

## Goal

Create a complete `context-v3/` directory that mirrors the structure of the existing
`context/` directory and defines the full **Milestone v3** development scope.

Milestone v3 is a **catch-up + improvement** milestone covering:

1. Items from v2 that were drafted but never implemented (Serial Number Tracking,
   Payroll, Offline Sync foundation)
2. Critical compliance gaps identified in the architecture analysis (E-Invoice,
   E-Way Bill, Thermal Printing, FIFO Costing)
3. Architecture hardening gaps (Universal Audit Trail, CompanyUser join table,
   Default Voucher Types, Rate Limiting, Database Encryption)
4. Code quality / developer experience improvements (SystemContext retrofit, Error
   Boundaries, PDF engine migration)
5. Future growth features (AI Insights Engine, Mobile PWA, Cloud Sync Foundation)

---

## Directory Structure to Create

```
context-v3/
├── project-overview.md          (v3 scope addendum — goals, in-scope, out-of-scope)
├── architecture-context.md      (architecture decisions specific to v3 changes)
├── ui-context.md                (UI/UX additions for v3 — thermal print, mobile, AI)
├── code-standards.md            (any new code standards introduced in v3)
├── ai-workflow-rules.md         (same workflow rules, updated for v3 phase numbers)
├── progress-tracker.md          (running session log for v3, starts empty)
├── Phases/
│   ├── phases.md                (v3 roadmap — 5 phases across 19 features)
│   ├── phase-tracker.md         (status table for all v3 features, all ⬜ initially)
│   └── milestone-v3-overview.md (one-page milestone summary for stakeholders)
└── feature-specs/
    ├── 91-serial-number-tracking.md
    ├── 92-payroll.md
    ├── 93-universal-audit-trail.md
    ├── 94-e-invoice.md
    ├── 95-e-way-bill.md
    ├── 96-thermal-printing.md
    ├── 97-barcode-billing.md
    ├── 98-fifo-costing.md
    ├── 99-company-user-join-table.md
    ├── 100-rate-limiting.md
    ├── 101-database-encryption.md
    ├── 102-backup-verification.md
    ├── 103-pdf-engine-migration.md
    ├── 104-default-voucher-types.md
    ├── 105-system-context-retrofit.md
    ├── 106-global-error-boundaries.md
    ├── 107-ai-insights-engine.md
    ├── 108-mobile-pwa.md
    └── 109-cloud-sync-foundation.md
```

---

## Sub-Tasks

### Task 1 — Create context-v3 top-level context files

**Intent**: Create the five core context files mirroring `context/` for the v3 milestone.

**Expected Outcomes**:
- `context-v3/project-overview.md` exists with v3 goals and scope
- `context-v3/architecture-context.md` exists with v3 architectural decisions
- `context-v3/ui-context.md` exists with v3 UI additions (thermal, mobile PWA, AI accent)
- `context-v3/code-standards.md` exists with new v3 standards (audit trail, encryption)
- `context-v3/ai-workflow-rules.md` exists referencing v3 phase numbers
- `context-v3/progress-tracker.md` exists as an empty running log template

**Status**: [ ] pending

---

### Task 2 — Create Phases directory files

**Intent**: Define the v3 milestone roadmap, phase structure, and an empty tracker with
all 19 features pre-populated at ⬜ (not started).

**Expected Outcomes**:
- `context-v3/Phases/phases.md` — 5 phases with all 19 features assigned
- `context-v3/Phases/phase-tracker.md` — full feature table, all ⬜
- `context-v3/Phases/milestone-v3-overview.md` — one-page stakeholder summary

**Phase Structure**:
- Phase 1 — Carry-Over Completions (specs 91, 92 — carry from v2)
- Phase 2 — Compliance & Legal (specs 93, 94, 95, 96, 97)
- Phase 3 — Architecture Hardening (specs 98, 99, 100, 101, 102, 103, 104)
- Phase 4 — Code Quality & DX (specs 105, 106)
- Phase 5 — Growth Features (specs 107, 108, 109)

**Status**: [ ] pending

---

### Task 3 — Create Phase 1 feature-specs (Carry-Overs)

**Intent**: Write specs 91 and 92 — these carry context from the existing v2 specs
(51-serial-number-tracking.md and 63-payroll.md) and must reference them.

**Specs**:
- `91-serial-number-tracking.md` — wraps v2 spec 51, adds carry-over context
- `92-payroll.md` — wraps v2 spec 63, marks Payroll as the v3 entry point for it

**Status**: [ ] pending

---

### Task 4 — Create Phase 2 feature-specs (Compliance)

**Intent**: Write specs 93–97 covering the five compliance/commercial gaps.

**Specs**:
- `93-universal-audit-trail.md` — createdBy/updatedBy + full AuditLog retrofit
- `94-e-invoice.md` — IRN/QR generation on Sales Invoice posting
- `95-e-way-bill.md` — E-Way Bill generation on Sales Invoice/Delivery Challan
- `96-thermal-printing.md` — ESC/POS 80mm via Electron IPC
- `97-barcode-billing.md` — completes v2 spec 79 (barcode scan in billing screen)

**Status**: [ ] pending

---

### Task 5 — Create Phase 3 feature-specs (Architecture Hardening)

**Intent**: Write specs 98–104 covering the seven architecture gaps.

**Specs**:
- `98-fifo-costing.md` — FIFO / Weighted Average as costing method option
- `99-company-user-join-table.md` — CompanyUser join table migration
- `100-rate-limiting.md` — per-route rate limiting + brute-force protection
- `101-database-encryption.md` — pgcrypto / filesystem encryption documentation + setup
- `102-backup-verification.md` — automated restore-and-verify script
- `103-pdf-engine-migration.md` — replace Puppeteer with @react-pdf/renderer
- `104-default-voucher-types.md` — seed default voucher types in TenantBootstrapService

**Status**: [ ] pending

---

### Task 6 — Create Phase 4 feature-specs (Code Quality)

**Intent**: Write specs 105–106 covering the two DX cleanup items.

**Specs**:
- `105-system-context-retrofit.md` — migrate ~15 pre-migration services to SystemContext
- `106-global-error-boundaries.md` — add Next.js error.tsx boundaries to all route segments

**Status**: [ ] pending

---

### Task 7 — Create Phase 5 feature-specs (Growth Features)

**Intent**: Write specs 107–109 covering the three growth/future features.

**Specs**:
- `107-ai-insights-engine.md` — local LLM / cloud AI over reporting data
- `108-mobile-pwa.md` — Next.js PWA for read-only dashboard + reports
- `109-cloud-sync-foundation.md` — optional PostgreSQL logical replication to cloud

**Status**: [ ] pending

---

## Conventions to Follow

All feature-spec files must follow the existing spec format:
1. Numbered header with context block (> quoted) referencing phase, tracker #, dependencies
2. Goal section
3. Project Context section (prerequisite specs to read first)
4. Module Responsibilities
5. Data Model (schema additions)
6. Business Rules
7. Validation Rules
8. API / Server Actions
9. UI sections
10. Security Considerations
11. Testing Requirements
12. Known Deviations / Decisions

---

## Implementation Notes

- context-v3/ is a **new directory** — nothing in context/ is modified
- Feature-spec numbers continue sequentially from 90 (highest existing is 90)
- Phase tracker numbers continue from the current v2 max (#81 was the last used)
- The new tracker #s for v3 start at #82 (Serial Number Tracking) through #100
- All new specs explicitly reference their v2 prerequisites using the existing
  `context/feature-specs/` paths
