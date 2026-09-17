# 99 - CompanyUser Join Table Migration

> Feature-spec file number 99 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 3 — Architecture
> Hardening**, tracker item **#90 CompanyUser Join Table**.
>
> Depends On: Authentication (v2 #6, spec 7); User Management (v2 #9, spec 10).
> This is a cross-cutting data migration — implement on a dedicated branch, never
> alongside another feature.

## Goal

Migrate `User.companyId` (a direct nullable FK) to a `CompanyUser` join table. This
enables a single user account (a CA, auditor, or consultant) to belong to multiple
companies without creating duplicate login accounts.

After this migration:
- `User.companyId` and `User.roleId` are deprecated but remain as nullable columns
  for backward compatibility during the transition.
- All company-context resolution uses the `CompanyUser` join table.
- `getCurrentCompanyUser()` reads from `CompanyUser`, not directly from `User`.

---

## Project Context

Read before implementation:

1. `context/architecture-context.md` (v2) — Known Implementation Gap #1 (User↔Company
   mapping); the migration path is described there.
2. `context-v3/architecture-context.md` — Decision 2 (CompanyUser Join Table).
3. `context/feature-specs/07-authentication.md` — session handling.
4. `context/feature-specs/10-user-management.md` — User CRUD; the service layer is
   amended here.
5. `src/lib/current-user.ts` and `src/lib/system-context.ts` — these are the primary
   files that read user/company context and must be updated.

---

## Module Responsibilities

- `CompanyUser` Prisma model — join table with `userId`, `companyId`, `roleId`,
  `isActive`, `createdAt`
- Data migration — backfill `CompanyUser` rows from every existing `User.companyId` /
  `User.roleId` pair
- Update `getCurrentCompanyUser()` to read from `CompanyUser`
- Update `UserService.createUser()` to create a `CompanyUser` row instead of setting
  `User.companyId`
- Update User Management UI — "Assign to Company" / "Remove from Company" actions
- Update the Company Selection flow — list companies from `CompanyUser` for the current user

---

## Data Model

```prisma
model CompanyUser {
  id         String   @id @default(uuid())
  userId     String
  companyId  String
  roleId     String
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id])
  company Company @relation(fields: [companyId], references: [id])
  role    Role    @relation(fields: [roleId], references: [id])

  @@unique([userId, companyId])   // one record per user-company pair
  @@index([companyId])
  @@index([userId])
}
```

Deprecate but keep for now on `User`:
```prisma
  companyId String?  // DEPRECATED — use CompanyUser; kept for zero-downtime migration
  roleId    String?  // DEPRECATED — use CompanyUser; kept for zero-downtime migration
```

---

## Migration Steps

1. Create `CompanyUser` table (new migration).
2. Backfill `CompanyUser` rows from existing `User.companyId`/`roleId` values (data
   migration SQL inside the same Prisma migration file).
3. Update `getCurrentCompanyUser()` to read from `CompanyUser` (application code change).
4. Update all services that write `User.companyId`/`User.roleId` to write to
   `CompanyUser` instead.
5. Verify: all existing tests pass; session flow works end-to-end.
6. In a follow-up migration (separate PR): drop the deprecated columns from `User`.

---

## Business Rules

1. A user can belong to multiple companies — each `CompanyUser` row is one membership.
2. A user's role may differ per company (CompanyUser.roleId — not User.roleId).
3. A `PLATFORM` user (Super Admin) has no `CompanyUser` rows — this is unchanged.
4. When a user logs in and selects a company, the session uses that `CompanyUser`'s
   `roleId` for permission checks.
5. Deactivating a `CompanyUser` row revokes access without deleting the user account.

---

## Validation Rules

- A user cannot be added to the same company twice (`@@unique([userId, companyId])`).
- The `role` in `CompanyUser` must belong to the same `companyId` (company-scoped roles).
- Super Admin cannot be assigned to a company.

---

## API / Server Actions

- `userActions.assignToCompany(userId, companyId, roleId)` — creates `CompanyUser`
- `userActions.removeFromCompany(userId, companyId)` — deactivates `CompanyUser`
- `userActions.listCompanyUsers(companyId)` — replaces direct `User` query by companyId

---

## UI

### User Management Amendment (`/users`)
- Add "Assign to Company" action for Platform Admin view
- Show all company memberships for a user in their detail page
- "Remove from Company" action (soft-deactivate the CompanyUser row)

### Company Selection (`/company/select`)
- List now reads from `CompanyUser` for the current logged-in user — no change to the
  UI; only the data source changes

---

## Security Considerations

- The tenant isolation rule is unchanged: every query still filters by `companyId` from
  the authenticated session — the source of `companyId` changes from `User.companyId`
  to `CompanyUser.companyId`, but the enforcement point does not move.
- Cross-company access requires an explicit `CompanyUser` row — never inferred.

---

## Testing Requirements

- Backfill test: after migration, every existing user has a matching `CompanyUser` row
- Multi-company user test: user can switch between two companies without losing session
- Role isolation: user has different role in different companies
- Deprecated column sunset: all existing tests continue to pass after the code switch

---

## JWT-Readiness Note

In v4, the cookie/session auth mechanism is replaced by JWT + OIDC (spec 133 —
JWT/OIDC Auth). The `CompanyUser` join table introduced here is directly compatible with
JWT claims: the JWT payload in v4 will carry `companyId` and `roleId` from the
`CompanyUser` row for the selected company.

To remain JWT-ready, this implementation must:

1. **Expose `CompanyUser.roleId` and `CompanyUser.companyId` as first-class fields**
   on whatever session/context object is produced after login — these fields become the
   source of the v4 JWT claims `x-company-id` and `x-role-id`.

2. **Not embed role permissions in the session cookie** — permissions are always
   re-derived from `roleId` at query time, so that changing a role's permissions takes
   effect immediately without requiring a session refresh. In v4, permissions are
   embedded in a separate short-lived permissions claim, not in the primary JWT.

3. **Ensure the company-select step produces a deterministic `CompanyUser` lookup** —
   in v4 this lookup is the token issuance step; the shape must be stable.

No code changes are required beyond the above — this note documents the design
constraints to preserve for smooth v4 migration.
