# 127 - Per-Tenant Migration Automation

> Feature-spec file number 127. Milestone v4, Phase 3, tracker **#118**.
> Depends On: spec 126 (Prisma Multi-Tenant Client Factory).

## Goal

Automatically run Prisma migrations on every company database when a new migration
is deployed, without manual intervention and without downtime.

---

## Problem

Standard `prisma migrate deploy` runs against a single database URL. With N company
databases, we need to run migrations against all N databases on every deployment.

---

## Migration Runner Job

A Kubernetes Job (not a long-running pod) runs after each deployment:

```typescript
// scripts/run-tenant-migrations.ts
async function runAllTenantMigrations() {
  const companies = await platformPrisma.company.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  const results = await Promise.allSettled(
    companies.map(async (company) => {
      const dbUrl = await tenantClientFactory.getDatabaseUrl(company.id)
      await execAsync(`prisma migrate deploy --schema=prisma/schema.prisma`, {
        env: { ...process.env, DATABASE_URL: dbUrl }
      })
      return company.id
    })
  )

  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    logger.error({ failed }, 'Some tenant migrations failed')
    process.exit(1)
  }

  logger.info({ count: companies.length }, 'All tenant migrations applied')
}
```

---

## ArgoCD PostSync Hook

The migration Job runs as an ArgoCD PostSync hook:
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: run-tenant-migrations
  annotations:
    argocd.argoproj.io/hook: PostSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
        - name: migrator
          image: ghcr.io/premgiri/app:$IMAGE_TAG
          command: ["node", "scripts/run-tenant-migrations.js"]
```

---

## Migration Safety Rules

1. Every migration must be **backward compatible** — the old code must work with
   the new schema while migrations run.
2. Destructive changes (column drops) require a two-phase approach:
   - Phase A: add new column + code supports both old/new schema
   - Phase B (next release): drop old column
3. Migration failures on individual companies are logged but don't block other companies.
4. A failed migration sends an alert to the Super Admin via notification (Prometheus alert).

---

## Testing Requirements

- Migration job runs successfully against all active company databases
- A new company database created after deployment already has the latest schema
- A failing migration for one company doesn't prevent other companies from migrating
- Post-migration validation: `prisma migrate status` shows `Database schema is up to date`
