# 116 - Company & Admin Service

> Feature-spec file number 116. Milestone v4, Phase 2, tracker **#107**.
> Depends On: spec 115 (Auth Service).

## Goal

Extract Company management, Branch, Financial Year, Company Settings, Administration
(Super Admin functions), and Tenant Bootstrap into a standalone `company-service`.

---

## Owns

- `Company` (in Platform DB)
- `Branch`
- `FinancialYear`
- `CompanySettings`
- `AuditLog` (platform-level)
- `TenantBootstrapService` — provisions new company database

---

## Key Responsibilities

1. **Company lifecycle** (Super Admin only): create, activate, deactivate
2. **Company Settings**: configure ledger mappings, costing method, e-invoice settings
3. **Branch management**: CRUD, activate/deactivate
4. **Financial year management**: create, open, close
5. **Tenant Bootstrap**: when a company is created, provision its per-company DB,
   run migrations, seed default data (roles, ledger groups, voucher types)
6. **Platform Administration panel** data: list companies, create company admins,
   reset passwords

---

## Tenant Bootstrap Flow (critical path)

```
POST /api/v1/companies (Super Admin)
    → create Company row in Platform DB
    → TenantBootstrapService.bootstrap(companyId):
        → CREATE DATABASE premgiri_company_<uuid>
        → run Prisma migrations on new DB
        → seed: roles, permissions, ledger groups, Cash ledger, voucher types
        → create CompanyAdmin user in Platform DB
    → return { companyId, adminUserId }
```

This entire flow runs atomically where possible. If the DB create fails, the Company
row is rolled back from Platform DB.

---

## gRPC Interface (for other services)

```protobuf
service CompanyService {
  rpc GetCompany(GetCompanyRequest) returns (CompanyResponse);
  rpc GetBranch(GetBranchRequest) returns (BranchResponse);
  rpc GetFinancialYear(GetFinancialYearRequest) returns (FinancialYearResponse);
  rpc GetCompanySettings(GetCompanySettingsRequest) returns (CompanySettingsResponse);
  rpc GetActiveDatabaseUrl(GetCompanyRequest) returns (DatabaseUrlResponse);
}
```

`GetActiveDatabaseUrl` is called by the Prisma TenantClientFactory (spec 126) to
get the connection string for a company's database.

---

## Testing Requirements

- Company creation provisions a new database and seeds default data
- Financial year close blocks new vouchers in that year
- Company deactivation blocks all Company-side logins for that company
- `GetActiveDatabaseUrl` returns a valid connection string for an existing company
- Atomic rollback: simulated DB provision failure → Company row not created
