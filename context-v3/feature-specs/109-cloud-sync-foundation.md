# 109 - Cloud Sync Foundation

> Feature-spec file number 109 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 5 — Growth Features**,
> tracker item **#100 Cloud Sync Foundation**.
>
> Depends On: PostgreSQL; CompanyUser Join Table (spec 99, tracker #90).
>
> This replaces the v2 documentation-only spec 89 (Offline SQLite Sync) with a more
> focused, technically sound approach using PostgreSQL logical replication.

## Goal

Lay the foundation for optional cloud synchronization of company data from a local
Premgiri Books installation to a cloud PostgreSQL instance.

v3 delivers the **foundation only** — not a full cloud product:
1. A replication configuration tool in the Electron app
2. A verified mechanism for syncing to a cloud Postgres endpoint
3. A sync status indicator in the UI

Full mobile read-write access, multi-branch real-time sync, and conflict resolution
are deferred to v4.

---

## Project Context

Read before implementation:

1. `context/feature-specs/89-offline-sqlite-sync.md` — v2 draft (documentation-only);
   this spec supersedes it with a PostgreSQL-native approach.
2. `context-v3/architecture-context.md` — Invariant 18 (Cloud sync must remain optional).
3. `context-v3/feature-specs/99-company-user-join-table.md` — CompanyUser join table;
   required because cloud sync needs a consistent user-company mapping.

---

## Architecture: PostgreSQL Logical Replication

```
Local PostgreSQL (primary)
    → WAL (Write-Ahead Log)
        → pg_logical publication "premgiri_sync"
            → Cloud PostgreSQL (subscriber)
                → read-only replica or async backup
```

The local Postgres instance publishes changes via a named publication. The cloud
instance subscribes and receives a near-real-time stream of all INSERTs, UPDATEs,
and DELETEs. The cloud instance is read-only (no writes from cloud back to local in v3).

---

## Module Responsibilities

- Sync configuration UI in Electron settings (`/settings/cloud-sync`)
- `CloudSyncService` — manages pg_logical publication setup and subscription verification
- `SyncStatusMonitor` — polls the replication lag and surfaces it to the UI
- `CompanySettings` amendment — `cloudSyncEnabled`, `cloudSyncConnectionString` (encrypted)
- Sync status in the top navbar (icon: green = synced, yellow = lagging, red = error)

---

## Data Model

```prisma
// Add to CompanySettings:
  cloudSyncEnabled           Boolean @default(false)
  cloudSyncConnectionString  Bytes?  // encrypted (spec 101) cloud Postgres connection string
  cloudSyncLastSyncAt        DateTime?
  cloudSyncStatus            String?  // "ACTIVE" | "LAGGING" | "ERROR" | "DISABLED"
```

---

## Setup Flow

```
1. User enters cloud Postgres connection string in /settings/cloud-sync.
2. CloudSyncService.testConnection() — verifies connectivity.
3. CloudSyncService.createPublication() — runs:
   CREATE PUBLICATION premgiri_sync FOR ALL TABLES;
4. CloudSyncService.createSubscription() — runs on the cloud instance:
   CREATE SUBSCRIPTION premgiri_sub
     CONNECTION '<local_connection>'
     PUBLICATION premgiri_sync;
5. SyncStatusMonitor starts polling pg_stat_replication for lag.
6. Sync status shown in navbar.
```

---

## Business Rules

1. Cloud sync is entirely optional — all local operations work identically with sync
   disabled or unconfigured.
2. The local database is always the source of truth — the cloud instance is a replica.
3. If replication lag exceeds 5 minutes, show a warning in the navbar.
4. The cloud connection string is stored encrypted (spec 101).
5. Disabling cloud sync drops the publication and subscription cleanly.

---

## Validation Rules

- Cloud Postgres must support logical replication (`wal_level = logical`) — verified
  in `testConnection()`.
- The cloud instance must be running PostgreSQL ≥ 13.
- Connection string format: `postgresql://user:password@host:port/database`.

---

## UI

### Cloud Sync Settings (`/settings/cloud-sync`)
- Enable/Disable toggle
- Connection string input (masked; encrypted on save)
- "Test Connection" button
- Replication status: Last sync time, current lag, subscriber count
- "Disable Sync" action (drops publication and subscription)

### Navbar Sync Status Indicator
- Green dot: syncing normally (lag < 30s)
- Yellow dot: lagging (lag 30s–5min)
- Red dot: error or connection lost
- Tooltip: "Last synced 2 minutes ago"
- Click opens `/settings/cloud-sync`

---

## Security Considerations

- The cloud connection string is encrypted at rest (spec 101).
- The replication user on the cloud instance must have read-only access only.
- No customer PII is filtered out of replication — the cloud instance holds a full copy.
  This must be disclosed in the setup UI.

---

## Testing Requirements

- `testConnection()`: valid connection string succeeds; invalid string returns descriptive error
- `createPublication()`: idempotent (calling twice does not error)
- Lag monitor: lag > 300s → status changes to `LAGGING`
- Disable flow: drops publication cleanly; status returns to `DISABLED`
- No sync when disabled: local writes do not attempt replication connections

---

## v4 Supersession Note

In v4, the PostgreSQL logical replication approach introduced here is **superseded** by
the Kafka event bus (spec 125 — Kafka Event Bus). Rather than replicating at the database
WAL level, v4 services publish typed `DomainEvent` messages to Kafka topics that are
consumed by the cloud frontend, analytics, and multi-branch sync services.

**Migration path (v3 → v4):**
1. v4 spec 125 deploys Kafka and the Kafka `DomainEventBus` implementation.
2. Any company using v3 PostgreSQL logical replication can continue using it as a
   read-only backup mechanism — it is not broken by v4.
3. New multi-branch real-time sync and mobile write-back features in v4 use Kafka, not
   logical replication.
4. After v4 is verified stable, the `CloudSyncService` replication logic is deprecated
   (the UI toggle is hidden; existing publications are left intact but not created for
   new companies).

The v3 `cloudSyncEnabled` / `cloudSyncConnectionString` columns in `CompanySettings`
remain in the schema through v4 for backward compatibility with companies that activated
this feature in v3.
