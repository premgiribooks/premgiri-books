# 61 - Employee Master

> Feature-spec file number 61 (spec-file numbers are sequential and never reused — the
> highest prior file was `56-product-detail-page.md`). This feature is
> `context/Phases/phase-tracker.md`'s **Phase 9 — Employee Management** item **#59
> Employee Master** — the first of three (#59 Employee Master → #60 Attendance → #61
> Payroll, spec files `61`/`62`/`63`). **This phase must be implemented in this order**:
> Attendance (`62-attendance.md`) depends on the `Employee` row this spec creates, and
> Payroll (`63-payroll.md`) depends on Attendance's records. Depends only on Company
> (implemented). Documentation only, drafted 2026-09-11 per the same
> batch-drafting-without-implementation precedent as specs 46–56 — nothing in this spec
> is implemented yet.

## Goal

Implement **Employee Master** for **Premgiri Books ERP** — the HR/business record for a
company's staff that Attendance (`62-attendance.md`) and Payroll (`63-payroll.md`) will
reference, and that Employee Reports (`73-employee-reports.md`, Phase 10 tracker #71)
will read from once that phase lands.

No `Employee` Prisma model exists anywhere in this codebase today — this is a genuinely
new domain, unlike most specs in this project which extend or wrap an existing table.
`architecture-context.md`'s Module Boundaries already names an **Employee** module
("Employee Master, Attendance, Salary, Payroll") and lists "Employees" under Masters —
this spec is where that module boundary becomes real code for the first time.

This is a **master, not a document**: no Document Number Engine numbering (like
Customer/Supplier/Product — feature-specs 26/27/25), just a company-scoped
Create/Edit/View/Activate-Deactivate master, the same shape as every non-transactional
master in this codebase.

---

# Project Context

Before implementation, review

- `architecture-context.md` (Module Boundaries → Employee: "Employee Master,
  Attendance, Salary, Payroll"; Masters section listing "Employees" alongside
  Customers/Suppliers/Products; Invariant 5 — modules communicate through shared
  services, never by directly modifying another module's data)
- `code-standards.md` (File Organization's `modules/employees/` entry; General
  Business Logic rules)
- `context/Phases/phase-tracker.md` (Phase 9 — Employee Management; the Phase 10
  Employee Reports item, #71, that depends on this data)
- `07-authentication.md` / `10-user-management.md` (**read both in full** — the `User`
  model this spec deliberately does *not* merge with; see the User↔Employee decision
  below)
- `12-branch-management.md` (the optional-branch-link precedent this spec follows,
  mirroring `24-warehouse-management.md`'s identical choice)
- `26-customer-management.md` / `27-supplier-management.md` (the master-module shape
  template this spec follows: Create/Edit/View/Activate-Deactivate, no delete,
  company-scoped, flat address columns, no auto-numbered code)
- `25-product-management.md` (the user-entered `productCode`, no-auto-numbering
  precedent `employeeCode` follows identically)

---

# Module Responsibilities

The Employee module is responsible for

- Employee Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- The minimal salary-structure figure Payroll (`63-payroll.md`) needs to compute a
  first-release salary run: a single `basicSalary` field (see Data Model — this spec
  owns that field; Payroll snapshots it per run rather than referencing it live)
- A reusable, active-only lookup future Attendance and Payroll screens read from

The Employee module is **not** responsible for

- Attendance recording (`62-attendance.md`)
- Payroll computation or posting (`63-payroll.md`)
- Login, sessions, or password management (`07-authentication.md`,
  `10-user-management.md` — a `User` row, when one exists for an employee, is created
  and managed entirely by User Management; this module only stores an optional
  reference to it)
- Role/permission assignment (`11-role-permissions.md` — a linked `User`'s `roleId`
  already governs what that person can do in the system; this module has no opinion on
  it)
- Any accounting entry (Employee Master never touches the Voucher Engine — only
  Payroll does)

---

# User ↔ Employee Relationship — the open decision this spec resolves

**`User` (login account) and `Employee` (HR/payroll record) are modeled as two separate
entities, linked by an optional, nullable, unique `userId` on `Employee` — not merged,
and not one implying the other.** This is a real design decision, recorded with its
reasoning rather than assumed:

- A `User` row (`06-database-foundation.md`, extended by `10-user-management.md`) is an
  **authentication/authorization** record: `username`, `passwordHash`, `roleId` — it
  exists so a person can log in and be permission-gated. Not every person the business
  employs needs this: shop-floor staff, delivery staff, or factory workers who never
  touch the ERP have no reason to hold a `User` row at all — creating one for them
  would be dead data (a login nobody uses, occupying a unique `username` slot for no
  benefit).
- An `Employee` row is a **business/HR record**: designation, department, joining date,
  contact info, branch assignment, and the salary figure Payroll needs — none of this
  has anything to do with whether that person can log in. A shop's owner (a `User` with
  the Company Admin role) is not necessarily an "employee" on the payroll at all, and a
  data-entry clerk who **is** a payroll employee also needs a login to use the system —
  the two concepts overlap for some people and not others, which is exactly the shape a
  1:1-optional link expresses and a merge or one-directional FK would not.
- The link is therefore `Employee.userId String? @unique` — nullable (most employees
  have no login), unique (a `User` can back at most one `Employee` row; the inverse,
  "one `User` can never be linked from two different `Employee`s," is what the DB
  unique constraint enforces directly). There is no FK the other direction
  (`User.employeeId`) — `User` is the authentication module's own table
  (`10-user-management.md`); this spec adds the reference from its own new table
  instead of reaching back to extend `User`, the same "extend the referencing side, not
  the referenced side" posture `27-supplier-management.md` used for `Ledger`.
- **No cascading behavior is implied by the link.** Deactivating a `User` does not
  deactivate the linked `Employee` (a person can be locked out of the system but still
  be on payroll during notice period, for example) and vice versa — the two
  `isActive`/status fields are independent, checked separately by whatever feature
  needs each (login enforcement reads `User.isActive`; Payroll eligibility reads
  `Employee.isActive`).
- **This spec creates no `User` row and offers no "create login" action.** Linking an
  existing `Employee` to an existing `User` (or vice versa) is a simple optional-field
  edit on the Employee form (a searchable User picker, restricted to `User`s not
  already linked to a different `Employee`); provisioning a brand-new login for an
  employee is `10-user-management.md`'s existing Create User screen, unmodified — out
  of scope here (see Do Not).

---

# Data Model

Add to `prisma/schema.prisma` (plus `employees Employee[]` back-relations on `Company`
and `Branch`, and a nullable `employee Employee?` back-relation on `User`):

```text
model Employee {
  id              String   @id @default(uuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  employeeCode    String
  fullName        String
  designation     String?
  department      String?
  joiningDate     DateTime @db.Date
  mobileNumber    String?
  alternateMobile String?
  email           String?
  addressLine1    String?
  addressLine2    String?
  city            String?
  state           String?
  district        String?
  country         String   @default("India")
  pinCode         String?
  branchId        String?
  branch          Branch?  @relation(fields: [branchId], references: [id])
  userId          String?  @unique
  user            User?    @relation(fields: [userId], references: [id])
  basicSalary     Decimal? @db.Decimal(14, 2)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([companyId, employeeCode])
  @@index([companyId])
  @@index([branchId])
}
```

Decisions

- **`employeeCode` is user-entered, not auto-numbered** — identical reasoning to
  `Product.productCode` (`25-product-management.md`): the Document Number Engine
  (`34-document-number-engine.md`) numbers *documents*, not master-data codes.
  `@@unique([companyId, employeeCode])`, matching every other master's per-company code
  uniqueness.
- **`designation`/`department` are plain optional free text, not enums.** A small fixed
  enum (e.g. `SALES | ACCOUNTS | STORE | ADMIN`) was considered and rejected: every
  business that will use this ERP organizes its staff differently, no requirement names
  a fixed taxonomy, and a wrong-shaped enum would need a migration to extend the moment
  a real business's department list didn't fit — a plain text field costs nothing here
  and a structured taxonomy can be added later if a real reporting need (Employee
  Reports, `73-employee-reports.md`) asks for one (YAGNI, `code-standards.md`).
- **`branchId` is optional**, mirroring `24-warehouse-management.md`'s identical
  precedent when Branch Management (`12-branch-management.md`) was itself still
  unimplemented — Branch Management has since shipped, but the *pattern* it set (every
  dependent module treats the branch link as optional forward infrastructure, since a
  single-location company will never create a branch) still applies: not every company
  using this ERP has branches, and an employee not tied to one specific location is a
  normal, fully-supported state.
- **`userId` is optional and unique** — see the User ↔ Employee section above.
- **`basicSalary` is optional (`Decimal?`), owned by this master, not deferred to
  Payroll.** Payroll (`63-payroll.md`) needs *some* persistent per-employee salary
  figure to compute a run from, and a "salary structure" concept only has one number in
  this first release (no allowances/deductions breakup — see that spec's Do Not); this
  is HR-identity-adjacent data ("what is this person's pay"), the same way
  `Product.purchasePrice` is master data the Purchase module later overwrites and
  Sales/Purchase Invoice snapshot into their own line items rather than reading live.
  Payroll snapshots this value onto its own `PayrollRunItem.basicSalary` at run time
  (see that spec) — once a run is posted, a later edit to `Employee.basicSalary` never
  retroactively changes a posted run's stored figure, the same "financial data is
  immutable" posture every posted document in this codebase already follows. Nullable
  because an employee record may exist before their salary is finalized (a new joiner
  during onboarding) — Payroll's own validation (not this spec's) rejects including an
  employee in a run with no `basicSalary` set.
- **No `supplierType`/`customerType`-equivalent classification enum** — nothing in this
  phase needs to tier employees the way Customer/Supplier tier parties for pricing.
- **No `Ledger` row is created for an Employee**, unlike Customer (feature-spec 26) and
  Supplier (feature-spec 27), which each pair with a dedicated `Ledger` under "Sundry
  Debtors"/"Sundry Creditors" because the business tracks a running per-party
  outstanding balance with each. An employee's payroll liability is **pooled**, not
  per-employee: Payroll posts one aggregate "Salary Payable" balance for the whole
  company (see `63-payroll.md`), not N per-employee running ledgers — so no ledger
  pairing belongs on this master. This is a deliberate divergence from the
  Customer/Supplier template noted explicitly, not an oversight.
- Flat, denormalized address columns (`addressLine1/2`, `city`, `state`, `district`,
  `country`, `pinCode`) match the `Customer`/`Supplier`/`Company` shape verbatim — same
  reasoning (no separate `Address` table; nothing in this codebase needs one yet).
- No `isSystemDefined`, no seeding — employees are always user-created, company by
  company, exactly like every other master since Unit Management.
- No `branchId`-style forward-note is needed here (unlike specs written while Branch
  Management was still unimplemented) — Branch Management has shipped, so `branchId` is
  wired in from day one, not deferred.

---

# Business Rules

- `employeeCode` unique per company (DB-enforced), required, non-empty.
- `fullName` and `joiningDate` required; every other field optional.
- **`userId`, when set, must reference an active `User` belonging to the same company**
  (never accept a cross-company `User` id), **and must not already be linked to a
  different `Employee` row** (the `@unique` constraint enforces this at the database
  level; the service re-validates first for a friendly error rather than a raw
  constraint violation).
- **`branchId`, when set, must belong to the active company** (cross-company rejected
  identically to `24-warehouse-management.md`'s own branch-link validation) — `null` is
  always valid (a company with zero branches, or an employee not tied to one, works
  normally, mirroring `12-branch-management.md`'s "zero branches is a fully-supported
  state").
- **`basicSalary`, when set, must be `> 0` with at most 2 decimals.**
- Deactivating an employee does not cascade to their linked `User` (if any) or affect
  any already-posted Payroll run referencing them (posted Payroll data is immutable —
  see `63-payroll.md`) — it only prevents that employee from being *newly added* to a
  future Attendance period or Payroll run (each of those specs' own responsibility to
  enforce, not this one's).
- Company-scoped for every user via `getCurrentCompanyUser()`; cross-company resolves
  as not-found, identical posture to every module in this codebase.
- No delete anywhere — Activate/Deactivate only, matching every master in this project.

---

# Service / Repository

Create

```text
src/modules/employees/repositories/employee-repository.ts
src/modules/employees/services/employee-service.ts
src/modules/employees/validation/employee-schema.ts
src/modules/employees/actions/employee-actions.ts
src/modules/employees/components/…
src/types/employee.ts
```

- `employeeService`: `listEmployees(filters)` (status/search — search covers
  `employeeCode`, `fullName`, `mobileNumber`), `getEmployee(id)`,
  `createEmployee(input)`, `updateEmployee(id, input)`, `activateEmployee(id)`,
  `deactivateEmployee(id)`, and `listSelectableEmployees()` (active only — the lookup
  Attendance and Payroll consume).
- `listAvailableUsersForLinking()` — active `User`s in the company not already linked to
  a different `Employee`, for the Employee Form's optional User picker.
- Server Actions use the shared `runAction` envelope, per every other module.

---

# Validation

Zod (`employee-schema.ts`):

- `employeeCode` — required, trimmed, 1–50 characters (server checks per-company
  uniqueness)
- `fullName` — required, trimmed, 2–100 characters
- `designation` / `department` — optional, ≤ 100 characters each, blank→undefined
  normalization (matching `26-customer-management.md`'s convention)
- `joiningDate` — required calendar date
- `mobileNumber` / `alternateMobile` — optional, 10-digit format (mirrors
  `10-user-management.md`'s mobile validation)
- `email` — optional, valid email format
- Address fields — optional, same shape as `26-customer-management.md`'s
- `branchId` — optional uuid (server re-validates same-company)
- `userId` — optional uuid (server re-validates active, same-company, not already
  linked elsewhere)
- `basicSalary` — optional, `> 0`, ≤ 2 decimals

Create and Update accept the same field set.

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/employees` — Employee list (Code, Name, Designation, Department, Branch,
  Status, Actions) with search and status filter
- `/masters/employees/new` — Create Employee
- `/masters/employees/[id]/edit` — Edit Employee

Components (`src/modules/employees/components/`): Employee Table, Employee Form
(sections: Identity, Contact, Address, Branch & Login Link, Salary), Employee Status
Badge.

Wire-up

- Add an "Employees" card to the `/masters` hub page (lucide `Users` icon).
- Add `employees: "Employees"` to `src/constants/breadcrumbs.ts`.
- No sidebar change (Masters already links to `/masters`).

---

# Security

Gated by the existing `employees` permission module (`src/constants/permissions.ts`'s
`PERMISSION_MODULES` — already present, no catalog changes needed): `view` for reads,
`create`/`edit` for writes, `delete` reused as the lifecycle-toggle action
(`LIFECYCLE_ACTION`, the established convention every other master's Activate/
Deactivate already follows), `export`. All reads/writes scoped to the requesting user's
own company — never accept a company id from the client.

---

# Database

New model `Employee`. New migration. Back-relations on `Company`, `Branch`, `User`. No
seeding.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business
logic in components, Zod validation at the boundary, Pino logging via the shared error
helpers, vitest coverage for:

- the schema (required/optional field matrix, blank→undefined normalization)
- `employeeCode` per-company uniqueness rejection
- `userId` cross-company and already-linked rejection
- `branchId` cross-company rejection
- `basicSalary` bounds rejection (zero, negative, > 2 decimals)

---

# Do Not

Do not implement

- Attendance recording or any period aggregation (`62-attendance.md`)
- Payroll computation, posting, or any Voucher Engine call (`63-payroll.md`)
- Creating a new `User` row from this module, or any password/login management
  (`10-user-management.md` owns Create User unmodified)
- A structured `designation`/`department` taxonomy or enum (see Data Model)
- A per-employee `Ledger` (see Data Model — payroll liability is pooled, not
  per-employee)
- Multiple salary components (allowances, deductions, overtime rate) — a single
  `basicSalary` figure only; deferred to a future payroll-enhancement phase if a real
  requirement arrives
- Delete endpoints

---

# Success Criteria

Verify

- Employees can be created, edited, activated, and deactivated, scoped to the active
  company only; a cross-company id resolves as not-found.
- `employeeCode` is unique per company; a duplicate produces a friendly, field-specific
  error.
- `userId`, when supplied, must reference an active, same-company `User` not already
  linked to a different `Employee`; violating any of the three is rejected with a
  friendly error, not a raw constraint violation.
- `branchId`, when supplied, must belong to the active company; a company with zero
  branches still works normally with no forced selection.
- `basicSalary`, when supplied, is `> 0` with at most 2 decimals; zero, negative, or
  over-precision values are rejected.
- No employee can be permanently deleted.
- `/masters` hub shows the Employees card; breadcrumbs label `/masters/employees` as
  "Employees".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 61 (this spec) is `context/Phases/phase-tracker.md`'s Phase 9 item #59.
Feature-spec 62 (Attendance, tracker #60) depends on it and must be implemented next,
in order — feature-spec 63 (Payroll, tracker #61) follows after that.
