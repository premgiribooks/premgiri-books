# Premgiri Books ERP — Milestone v3 Progress Tracker

> This file tracks the running implementation log for Milestone v3.
>
> Add a dated entry after every meaningful implementation session.
>
> For the phase/feature status table, see `context-v3/Phases/phase-tracker.md`.
>
> Do NOT add v3 entries to `context/progress-tracker.md` — that file is read-only for v3.

---

## Current Phase

Phase 1 — Carry-Over Completions

---

## Current Goal

Implement Serial Number Tracking (spec 91, v3 tracker #82).
This is the first item in Phase 1 and was the last unimplemented item from v2's Phase 5.

---

## Completed

*(Nothing completed yet — v3 work has not started.)*

---

## In Progress

*(Nothing in progress — v3 work has not started.)*

---

## Next Up

1. Serial Number Tracking (spec 91, tracker #82)
2. Payroll (spec 92, tracker #83)
3. Universal Audit Trail (spec 93, tracker #84)
4. E-Invoice (spec 94, tracker #85)
5. E-Way Bill (spec 95, tracker #86)

---

## On Hold

*(None.)*

---

## Open Questions

1. **Offline Sync (v2 spec 89)**: v2 spec 89 was documentation-only. v3 does not
   implement it — spec 109 (Cloud Sync Foundation) replaces it with a more focused
   PostgreSQL logical replication approach. Confirm with the user before starting spec 109
   whether the original SQLite cache concept from spec 89 should be revisited.

2. **E-Invoice turnover threshold**: The ₹5Cr mandatory threshold may be lowered further.
   spec 94 must be designed so the threshold is configurable in `CompanySettings`, not
   hardcoded.

3. **AI provider choice** (spec 107): Ollama (local, free, privacy-preserving) vs.
   OpenAI API (cloud, paid, higher quality). Requires explicit user decision before
   spec 107 implementation begins.

---

## Architecture Decisions

*(None yet — decisions will be recorded here as v3 features are implemented.)*

---

## Session Notes

*(Empty — no sessions yet.)*

---

## Environment Configuration

See `context/progress-tracker.md` → Environment Configuration section for the existing
local PostgreSQL, seed credentials, and Electron dev setup.

v3 additions:
- NIC/IRP sandbox credentials: TBD (user must obtain from GST portal)
- NIC EWB sandbox credentials: TBD
- Thermal printer test setup: USB or network ESC/POS printer, or use the
  `escpos-simulator` npm package for testing without hardware
