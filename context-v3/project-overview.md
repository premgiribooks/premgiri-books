# Premgiri Books ERP — Milestone v3

## Overview

Milestone v3 is the **catch-up and improvement milestone** for Premgiri Books ERP.

It builds on a fully working v1/v2 foundation (Phases 1–11 of the original roadmap —
authentication, masters, sales, purchase, inventory, accounting, GST, employee
management, reporting, dashboard, payment modes, and liability settlement) and delivers:

1. **Carry-over completions** — features drafted in v2 but deferred (Serial Number
   Tracking, Payroll, Offline Sync research)
2. **Compliance fixes** — features required by Indian law that block large-business
   adoption (E-Invoice, E-Way Bill)
3. **Architecture hardening** — structural gaps that must be resolved before v3 can
   scale (Universal Audit Trail, FIFO Costing, CompanyUser join table)
4. **Code quality** — developer experience improvements that reduce future regression risk
5. **Growth features** — capabilities that differentiate from competitors (AI Insights,
   Mobile PWA, Cloud Sync)

---

## Goals (Milestone v3)

1. Complete every feature drafted but unimplemented in v2.
2. Achieve E-Invoice + E-Way Bill compliance — unblock businesses above ₹5 Cr turnover.
3. Add thermal printing — unblock retail counter billing.
4. Implement Universal Audit Trail — achieve CA-grade audit readiness.
5. Implement FIFO / Weighted Average costing — unblock pharmaceutical and FMCG customers.
6. Migrate CompanyUser to a proper join table — support multi-company consultants.
7. Harden the security posture — encryption, rate limiting, backup verification.
8. Eliminate the Puppeteer/Chromium PDF dependency.
9. Lay the foundation for AI business insights.
10. Provide a read-only mobile PWA for business owners on the go.

---

## Core User Flow (Unchanged from v1/v2)

The core ERP user flow — sign in, select company/year, manage masters, create
transactions, auto-generate vouchers/inventory/GST entries, review reports — is
unchanged. v3 extends that flow in specific places:

- **Billing screen**: barcode scan → auto-add line; print to thermal on save
- **Sales Invoice posting**: generate IRN/QR for E-Invoice; auto-create E-Way Bill
- **Reports**: AI-powered insights panel alongside existing financial reports
- **Mobile**: read-only PWA showing dashboard, P&L, receivables/payables
- **Admin**: Universal Audit Trail visible in `/administration/audit-logs`

---

## Features Added in v3

### Phase 1 — Carry-Over Completions
- Serial Number Tracking (v2 spec 51, tracker #49)
- Payroll (v2 spec 63, tracker #61)

### Phase 2 — Compliance & Commercial
- Universal Audit Trail
- E-Invoice (IRN + QR Code via NIC/IRP API)
- E-Way Bill (NIC EWB API)
- Thermal / POS Printing (ESC/POS 80mm)
- Barcode Billing (complete v2 spec 79)

### Phase 3 — Architecture Hardening
- FIFO / Weighted Average Costing
- CompanyUser Join Table Migration
- Rate Limiting & Brute-Force Protection
- Database Encryption at Rest
- Backup Verification & Automated Restore Testing
- PDF Engine Migration (replace Puppeteer)
- Default Voucher Types Seeder

### Phase 4 — Code Quality
- SystemContext Adoption Retrofit (~15 pre-migration services)
- Global Error Boundaries (Next.js error.tsx)

### Phase 5 — Growth Features
- AI Business Insights Engine
- Mobile PWA (Read-Only Dashboard + Reports)
- Cloud Sync Foundation

---

## Scope

### In Scope (v3)

- Everything listed under "Features Added in v3" above
- Corresponding database migrations, repositories, services, validation, actions, UI
- Tests for every new engine/service
- Documentation updates in context-v3/

---

### Out Of Scope (v3)

- Manufacturing / BOM / Formula Management (remains Phase 12 / v4)
- Full GST Portal auto-filing (NIC portal submission — E-Invoice IRN only in v3)
- POS hardware integrations beyond 80mm thermal
- Banking API integration
- Multi-currency accounting
- Full mobile application (PWA read-only only in v3)
- CRM / Service Management

---

## Success Criteria (v3)

1. A business posting a Sales Invoice above ₹5 Cr automatically receives an IRN and QR.
2. A retail counter can print an 80mm thermal receipt without a secondary tool.
3. Every Ledger/Voucher/Sales/Purchase/Inventory write records `createdBy` and `updatedBy`.
4. A pharmaceutical company can run FIFO inventory valuation.
5. An accountant managing three companies can log in once and switch companies.
6. The installer size is reduced by ~200MB (Puppeteer removal).
7. The system rejects more than 5 failed login attempts per minute per IP.
8. A business owner can view the P&L on a phone browser.
9. All ~15 pre-migration services use the SystemContext pattern.
10. Every route segment has an error.tsx boundary.
