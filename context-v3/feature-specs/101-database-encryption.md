# 101 - Database Encryption at Rest

> Feature-spec file number 101 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 3 — Architecture
> Hardening**, tracker item **#92 Database Encryption**.
>
> Depends On: PostgreSQL local setup.

## Goal

Document and script the steps required to enable encryption at rest for the local
PostgreSQL instance used by Premgiri Books ERP. Additionally, implement column-level
encryption for the most sensitive fields (NIRP/EWB API credentials, user password
hashes are already bcrypt-hashed — this spec covers configuration secrets).

This spec is **partly documentation + partly implementation**:
- The full-disk / tablespace encryption is a setup/deployment guide (not runtime code)
- Column-level encryption for credential fields is runtime code using `pgcrypto`

---

## Project Context

Read before implementation:

1. `context-v3/architecture-context.md` — Decision 5 (Thermal Printing) mentions
   credential storage; Decision 4 (E-Invoice) mentions credential encryption.
2. `context-v3/feature-specs/94-e-invoice.md` — NIRP credentials stored in
   `CompanySettings`; this spec defines how they are encrypted.
3. `context/architecture-context.md` (v2) — "Future Database Encryption" noted.

---

## Module Responsibilities

### Part A — Deployment Documentation
Create `docs/setup/database-encryption.md` with step-by-step instructions for:
1. Windows: enable BitLocker on the drive containing the PostgreSQL data directory.
2. Linux/macOS: enable LUKS full-disk encryption or use an encrypted home directory.
3. PostgreSQL `pgcrypto` extension: enable with `CREATE EXTENSION pgcrypto`.
4. Backup encryption: pipe `pg_dump` output through `gpg --symmetric`.

### Part B — Runtime Column Encryption

Sensitive `CompanySettings` fields encrypted at rest using `pgcrypto`:

Fields to encrypt:
- `nirpUsername`, `nirpPassword`, `nirpClientId`, `nirpClientSecret` (E-Invoice)
- `eWayBillUsername`, `eWayBillPassword` (E-Way Bill)
- `thermalPrinterConfig` (contains network address — low sensitivity but good practice)

Implementation:
- Encryption/decryption handled in the repository layer using `pgcrypto`'s
  `PGP_SYM_ENCRYPT` / `PGP_SYM_DECRYPT`.
- The encryption key is stored in `ENCRYPTION_KEY` environment variable — documented
  in `.env.example`.
- Prisma stores these fields as `Bytes` (raw encrypted bytea) — the repository layer
  handles encryption/decryption before returning to the service layer.

---

## Data Model

```prisma
// CompanySettings — change credential fields from String? to Bytes?:
  nirpUsernameEncrypted    Bytes?
  nirpPasswordEncrypted    Bytes?
  nirpClientIdEncrypted    Bytes?
  nirpClientSecretEncrypted Bytes?
  eWayBillUsernameEncrypted Bytes?
  eWayBillPasswordEncrypted Bytes?
```

The unencrypted `String?` columns are removed in a migration after backfilling the
encrypted values.

---

## Business Rules

1. Credential fields are never returned as plaintext from any API response.
2. Decryption happens only in the repository layer, immediately before use.
3. If `ENCRYPTION_KEY` is missing from the environment, the application starts but
   credential-reading throws a clear configuration error — never silently returns null.
4. The encryption key must be at least 32 characters.

---

## Validation Rules

- `ENCRYPTION_KEY` length ≥ 32 characters — validated at application startup in
  `src/config/env.ts` (or equivalent startup check).

---

## Testing Requirements

- Repository encrypt-decrypt round-trip: value written and read back is equal to the
  plaintext original.
- Application startup test: missing `ENCRYPTION_KEY` throws a descriptive error.
- API test: credential fields are never present in any JSON response body.
