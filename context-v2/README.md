# context-v2 — Real Codebase Audit

This directory contains the **real codebase audit** for Premgiri Books ERP as of
Milestone v2. It is distinct from `context/` (which contains the original planning
context) and from `context-v3/` (which contains forward-looking feature specs).

`context-v2/` documents:
1. What actually exists in `src/` as of this audit.
2. Gaps and violations found when measured against the v3/v4 standards.
3. Fix specs for each finding.

## Directory Structure

```
context-v2/
├── README.md                         ← this file
├── audit-findings.md                 ← master findings table
├── codebase-map.md                   ← what exists in src/ right now
└── fix-specs/
    ├── FX-01-prisma-singleton.md
    ├── FX-02-system-context-partial.md
    ├── FX-03-proxy-no-rate-limit.md
    ├── FX-04-missing-env-config.md
    ├── FX-05-missing-external-integrations-engine.md
    ├── FX-06-sales-invoice-auth-coupling.md
    ├── FX-07-company-service-auth-coupling.md
    └── FX-08-system-context-function-name.md
```

## How to Use This Directory

Each fix-spec describes:
- What was found in the real code (with file paths and line references)
- Why it is a problem (which standard it violates)
- What must change
- Which v3 or v4 spec the fix is part of (cross-reference)

Fix specs are ordered by severity: **BLOCKER** (prevents v4 migration) →
**HIGH** (violates a v3 standard) → **MEDIUM** (code quality issue) →
**LOW** (documentation gap).

## Audit Date

This audit was performed against the `main` branch as of the Milestone v2 completion
state (all v2 features implemented, no v3 features started).
