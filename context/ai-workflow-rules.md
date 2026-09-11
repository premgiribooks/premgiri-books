# AI Development Workflow

## Approach

Build Premgiri Books ERP using a **Specification-Driven Development**
workflow.

Every implementation must follow the project documentation instead of
making assumptions.

The documentation hierarchy is:

    PRD.md
            ↓
    project-overview.md
            ↓
    architecture-context.md
            ↓
    business-rules.md
            ↓
    database-schema.md
            ↓
    api-contracts.md
            ↓
    code-standards.md
            ↓
    progress-tracker.md
            ↓
    context/Phases/phase-tracker.md

AI agents must always use these documents as the single source of truth.

`context/Phases/phase-tracker.md` is the granular, day-to-day live status board
(per-item `#` numbering, its own Progress Legend); `progress-tracker.md` is the
sequential-implementation-order log (Current Phase / Next Up / Open Questions).
They are two different trackers, not duplicates of each other — both must stay
current at all times (see Tracker Update Rule below).

Never invent business behavior.

------------------------------------------------------------------------

# Development Principles

The project follows

-   Offline First
-   Modular Architecture
-   Domain Driven Design (DDD)
-   Voucher Driven Accounting
-   Document Driven Workflow
-   Engine Based Business Logic

Every implementation must preserve these principles.

------------------------------------------------------------------------

# Implementation Workflow

Every feature must follow this sequence.

    Requirement

    ↓

    Analysis

    ↓

    Business Rules

    ↓

    Database

    ↓

    Backend

    ↓

    Repository

    ↓

    Service

    ↓

    Business Engine

    ↓

    API

    ↓

    UI

    ↓

    Testing

    ↓

    Documentation

    ↓

    Progress Update

Never skip steps.

------------------------------------------------------------------------

# Development Scope

Work on only one feature or subsystem at a time.

Examples

Good

-   Customer Module
-   Supplier Module
-   Product Module
-   Sales Invoice
-   Voucher Engine

Bad

-   Sales + Purchase + Reports
-   Customer + Inventory + Accounting

Small, testable changes are preferred.

------------------------------------------------------------------------

# Feature Development Order

New features must follow this order, matching the canonical
Implementation Workflow sequence above.

1.  Requirement
2.  Analysis
3.  Business Rules
4.  Database
5.  Backend
6.  Repository
7.  Service
8.  Business Engine
9.  API
10. UI
11. Testing
12. Documentation
13. Progress Update

Never start from the UI.

------------------------------------------------------------------------

# Business Rule Priority

Business Rules always override UI requirements.

Example

Wrong

    Sales Screen calculates GST

Correct

    Sales Screen

    ↓

    GST Engine

    ↓

    GST Calculation

The same applies to

-   Pricing
-   Inventory
-   Voucher Posting

------------------------------------------------------------------------

# Engine Usage Rules

Business calculations must always go through shared engines.

Pricing

↓

Pricing Engine

Inventory

↓

Inventory Engine

Accounting

↓

Voucher Engine

GST

↓

GST Engine

Reports

↓

Reporting Engine

Business logic must never be duplicated.

------------------------------------------------------------------------

# Module Boundaries

Every module owns its own responsibilities.

Customer Module

Responsible for

-   Customer Master
-   Customer Validation

Not responsible for

-   GST
-   Ledger Posting

Sales Module

Responsible for

-   Invoice Creation

Not responsible for

-   Inventory Calculation
-   Accounting
-   Pricing

Those belong to their respective engines.

------------------------------------------------------------------------

# Database Workflow

Before creating tables

AI must verify

-   Entity already exists?
-   Relationship already exists?
-   Can existing models be reused?

Avoid duplicate tables.

Prefer extending existing entities.

------------------------------------------------------------------------

# API Workflow

Every API must

1.  Validate Input
2.  Authenticate User
3.  Check Permissions
4.  Call Business Engine
5.  Save Transaction (write/mutation operations only; read-only list,
    search, and detail APIs may omit this step)
6.  Return Response
7.  Log Errors

Never place business calculations inside APIs.

------------------------------------------------------------------------

# UI Workflow

Every screen must

-   Display Data
-   Validate Forms
-   Call an approved application boundary (Server Actions or APIs)
-   Handle User Interaction

UI must never

-   Calculate GST
-   Calculate Margin
-   Calculate Stock
-   Create Ledger Entries

------------------------------------------------------------------------

# File Creation Rules

Create files only when needed.

Preferred structure

    modules/

    customers/

    suppliers/

    products/

    sales/

    purchase/

    inventory/

    accounting/

    gst/

    reports/

    settings/

Shared logic

    engines/

    voucher/

    pricing/

    inventory/

    gst/

    reporting/

Utilities

    lib/

    utils/

    hooks/

    types/

    repositories/

    services/

------------------------------------------------------------------------

# Refactoring Rules

When modifying existing code

AI must

-   Reuse existing modules
-   Remove duplicate logic
-   Improve readability
-   Preserve business behavior
-   Update tests if required

Avoid unnecessary rewrites.

------------------------------------------------------------------------

# Documentation Rules

Whenever architecture changes

Update

-   architecture-context.md

Whenever business behavior changes

Update

-   business-rules.md

Whenever feature scope changes

Update

-   PRD.md
-   project-overview.md

Whenever coding conventions change

Update

-   code-standards.md

Whenever implementation status changes

Update

-   progress-tracker.md
-   context/Phases/phase-tracker.md

Documentation must always match implementation.

------------------------------------------------------------------------

# Tracker Update Rule (Always Required)

ALWAYS update BOTH trackers — `progress-tracker.md` AND
`context/Phases/phase-tracker.md` — as the final step of every feature,
fix, or task, whether or not the user explicitly asks for it. This is not
optional and never waits for a separate request.

Update them:

-   The moment a feature/task is implemented (not only once fully shipped) —
    status, what changed, deviations, and open questions.
-   Again after code review / security review findings come back — record
    the verdict and the disposition of every finding (fixed / accepted /
    deferred), not just "review passed."
-   Again after any merge to `main` — record what was merged and the
    resulting branch/commit state.
-   Before pointing at what comes "next" — the Next Up / Current Feature
    section must name the actual next item per the phase order, not a
    stale pointer from a prior session.

A task is not complete until both trackers reflect it. Treat a tracker
update as part of the deliverable itself, the same as passing
tsc/ESLint/tests/build — never a follow-up someone has to ask for
separately.

------------------------------------------------------------------------

# Handling Missing Requirements

AI must never invent requirements.

If information is missing

1.  Search existing documentation.
2.  Search business rules.
3.  Search architecture.
4.  If still missing

Add an open question to

    progress-tracker.md

Stop implementation until clarified.

------------------------------------------------------------------------

# Protected Components

Never modify

-   shadcn/ui components
-   Prisma generated files
-   Third-party libraries

Instead

Wrap

Extend

Compose

Never edit vendor code.

------------------------------------------------------------------------

# ERP Business Rules

The following rules are mandatory.

-   Every financial transaction generates vouchers.
-   Every stock movement creates inventory transactions.
-   Every invoice follows the document lifecycle.
-   Posted documents cannot be edited.
-   Reports are generated from vouchers.
-   Inventory quantities are never updated directly.
-   Pricing is calculated only by the Pricing Engine.
-   GST is calculated only by the GST Engine.
-   Accounting entries are created only by the Voucher Engine.

These rules are non-negotiable.

------------------------------------------------------------------------

# Offline First Rules

The application must work completely offline.

AI must never introduce dependencies that require internet connectivity
for

-   Login
-   Sales
-   Purchase
-   Inventory
-   Accounting
-   GST
-   Reports
-   Printing

Cloud services must remain optional.

------------------------------------------------------------------------

------------------------------------------------------------------------

# Git Workflow

Every implementation task must follow the Git workflow below before
making any code changes.

## Repository Synchronization

Before starting any implementation:

1.  Switch to the `main` branch.
2.  Pull the latest changes from GitHub.
3.  Ensure the local repository is up to date.
4.  Resolve any merge conflicts before proceeding.
5.  Confirm no other feature branch is still open/unmerged for
    unrelated work (see Merge to Main Before Starting the Next Branch
    below) — `main` should already contain everything from the last
    completed feature before this step runs.

    git checkout main
    git pull origin main

------------------------------------------------------------------------

## Create Feature Branch

Create a dedicated branch for the feature being implemented.

Branch naming convention:

    feature/<feature-name>

Examples

    feature/ledger-groups
    feature/product-management
    feature/pricing-engine
    feature/customer-management

Never implement directly on the `main` branch.

    git checkout -b feature/<feature-name>

------------------------------------------------------------------------

## Development

Implement only the current feature specification.

-   Keep changes limited to the current feature.
-   Follow the project architecture and coding standards.
-   Do not mix unrelated changes.
-   Ensure TypeScript, ESLint, and build checks pass.

------------------------------------------------------------------------

## Commit Changes

After implementation:

1.  Review the changes.
2.  Create a meaningful Conventional Commit.

Format

    type(scope): short summary

Example

    feat(ledger): implement ledger group management

------------------------------------------------------------------------

## Push to GitHub

Push the feature branch.

    git push -u origin feature/<feature-name>

Never push directly to `main`.

------------------------------------------------------------------------

## Pull Request Description

Prepare a Pull Request containing:

-   Summary
-   Features implemented
-   Files/modules affected
-   Database changes (if any)
-   Testing performed
-   Notes / follow-up work

------------------------------------------------------------------------

## Merge to Main Before Starting the Next Branch (Centralized Codebase Rule)

**One branch is worked on, merged, and closed out before the next branch
is created.** This keeps `main` the single, continuously up-to-date
source of truth and prevents parallel branches from silently drifting
apart (e.g. two branches independently adding the same schema column or
duplicating the same helper, discovered only much later at merge time).

The full lifecycle for every feature branch:

1.  Branch from an up-to-date `main` (Repository Synchronization above).
2.  Implement, commit, and push the feature branch (Development /
    Commit Changes / Push to GitHub above).
3.  Open a Pull Request into `main` (Pull Request Description above).
4.  Get the PR merged into `main` — via GitHub's PR merge when a
    reviewer/CI gate is available, or (only when no such gate exists,
    e.g. solo/offline work) directly:

        git checkout main
        git pull origin main
        git merge --no-ff <branch-name>

    Re-run TypeScript, ESLint, tests, and build against the merged
    result before pushing `main` — a clean merge with no textual
    conflicts can still be behaviorally wrong (see the Merge Conflict
    Handling section below).

        git push origin main

5.  Delete or archive the merged feature branch once `main` has it.
6.  Only now create the next feature branch — always from the
    just-updated `main`, never stacked on top of the branch that was
    just merged and never branched from another still-open feature
    branch.

Never have two feature branches open and unmerged against `main` at the
same time for unrelated features. If a second branch is unavoidable
(e.g. urgent hotfix while a feature branch is mid-review), merge
whichever finishes first before starting or continuing the other, and
rebase/merge `main` into the other before it also merges.

------------------------------------------------------------------------

## Merge Conflict Handling

When merging a feature branch into `main` (or merging an updated `main`
into a feature branch) surfaces conflicts:

1.  Resolve every conflict marker (`<<<<<<<`/`=======`/`>>>>>>>`)
    deliberately — never accept "ours"/"theirs" blindly without reading
    both sides, and never leave a marker in committed code.
2.  Treat `prisma/schema.prisma` conflicts with special care: merge
    every model/enum/back-relation addition from both sides rather than
    picking one side wholesale, since two branches adding unrelated
    models almost always both need to survive. If both branches
    independently added the **same** field/column (e.g. two branches
    each adding `Company.stateCode` because neither had the other's
    work yet), keep only one copy and delete the other branch's now-
    redundant migration file entirely — never leave two migrations that
    add the same column.
3.  After a schema resolution, always re-run `npx prisma format`,
    `npx prisma validate`, and `npx prisma generate` before re-running
    TypeScript/tests/build.
4.  Watch for **silent duplicate declarations** git's line-based merge
    will not flag as a conflict: if both branches independently added
    the same top-level constant, type, or function in the same file but
    at different line ranges, a plain merge keeps both copies without
    ever raising a conflict. Grep for the symbol name after any merge
    that touches a shared file both branches modified, and collapse
    duplicates by hand.
5.  Re-run the full Completion Checklist below against the merged
    result — a clean `git merge` exit code only means no textual
    conflict remained, not that the result is correct.
6.  Record what was merged and how conflicts were resolved in
    `progress-tracker.md` (see Documentation Rules) so a later merge
    involving the same branches has context.

------------------------------------------------------------------------

## Completion Checklist

Before marking the feature complete, verify:

-   Latest `main` was pulled before starting.
-   Dedicated feature branch was created.
-   Feature implemented successfully.
-   TypeScript passes.
-   ESLint passes.
-   Build succeeds.
-   Changes committed with a meaningful commit message.
-   Feature branch pushed to GitHub.
-   Pull Request title and description prepared.
-   Pull Request merged into `main` (Merge to Main Before Starting the
    Next Branch above) before any new branch is created.
-   `progress-tracker.md` AND `context/Phases/phase-tracker.md` both
    updated (see Tracker Update Rule).

# Code Quality Checklist

Before completing any feature

Verify

-   TypeScript strict mode passes.
-   No `any` types.
-   No duplicated business logic.
-   Module boundaries respected.
-   Engines reused.
-   Tests updated.
-   Documentation updated.

------------------------------------------------------------------------

# Before Moving To The Next Feature

Verify

1.  Feature works end-to-end.
2.  No architecture rules are violated.
3.  Business rules are followed.
4.  Documentation is updated.
5.  progress-tracker.md AND context/Phases/phase-tracker.md both reflect
    the current implementation state (see Tracker Update Rule).
6.  No duplicated code has been introduced.

Only then begin the next feature.

------------------------------------------------------------------------

# AI Decision Priority

Whenever AI encounters conflicting information, follow this order of
precedence.

    1. User Instructions
            ↓
    2. PRD.md
            ↓
    3. project-overview.md
            ↓
    4. architecture-context.md
            ↓
    5. business-rules.md
            ↓
    6. database-schema.md
            ↓
    7. api-contracts.md
            ↓
    8. code-standards.md
            ↓
    9. progress-tracker.md
            ↓
    10. Existing Code

If existing code conflicts with the documentation, prefer the documented
architecture and record the discrepancy in `progress-tracker.md` before
making changes.

------------------------------------------------------------------------

# Future Modules

The following modules are planned but must not be implemented until
explicitly scheduled.

-   Formula Management
-   Production Engine
-   Automotive Paint Mixing
-   Manufacturing
-   Cloud Synchronization
-   Mobile Application
-   GST Portal Integration
-   E-Invoice
-   E-Way Bill
-   AI Business Assistant

These modules should remain architecturally compatible but out of scope
for the MVP.
