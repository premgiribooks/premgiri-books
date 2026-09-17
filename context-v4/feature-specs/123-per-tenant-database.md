# 123 - Per-Tenant Database Provisioning

> Feature-spec file number 123. Milestone v4, Phase 3, tracker **#114**.
> Depends On: Phase 1 (K8s + PostgreSQL StatefulSet running).

## Goal

Implement the system that creates a new, isolated PostgreSQL database for every new
company in < 30 seconds, and tears it down (archive mode) when a company is deleted.

---

## Architecture

```
Platform DB (premgiri_platform):
  ├── companies table
  ├── users table
  └── company_database_configs table  ← NEW: stores per-company DB URL

Per-Company DB (premgiri_company_<uuid>):
  ├── [full Prisma schema minus companies/users/roles]
  └── Each provisioned database is fully independent
```

---

## TenantDatabaseProvisioner

```typescript
class TenantDatabaseProvisioner {
  async provision(companyId: string): Promise<string> {
    const dbName = `premgiri_company_${companyId.replace(/-/g, '_')}`
    await this.pgClient.query(`CREATE DATABASE "${dbName}"`)
    const connectionUrl = this.buildConnectionUrl(dbName)
    await this.runMigrations(connectionUrl)
    await this.seedDefaultData(connectionUrl, companyId)
    await this.storeDatabaseConfig(companyId, connectionUrl)
    return connectionUrl
  }

  async deprovision(companyId: string): Promise<void> {
    // Archive: rename database to premgiri_company_<uuid>_archived_<timestamp>
    // Full delete only after 30-day retention period
    const dbName = await this.getDatabaseName(companyId)
    const archiveName = `${dbName}_archived_${Date.now()}`
    await this.pgClient.query(`ALTER DATABASE "${dbName}" RENAME TO "${archiveName}"`)
  }
}
```

---

## PgBouncer Connection Pooling

With N company databases × M service pods, connection count without pooling =
N × M × pool_size (can exceed PostgreSQL's `max_connections`).

PgBouncer (transaction-mode pooling) sits between services and PostgreSQL:
- One PgBouncer instance per PostgreSQL server
- Services connect to PgBouncer port (5432) — PgBouncer routes to the correct DB
- Maximum 5 connections per company DB (sufficient for most company sizes)

---

## Provisioning Time Target

New company database fully ready (created + migrated + seeded) in < 30 seconds.
Monitored via a `company.provisioning.duration` Prometheus metric.

---

## Testing Requirements

- Provisioning creates a new DB with all tables from the Prisma schema
- Seeding populates default roles, ledger groups, voucher types in the new DB
- Two companies' databases are completely isolated (cross-query impossible)
- Deprovisioning renames (not drops) the database
- PgBouncer correctly routes requests to the right DB per connection string
