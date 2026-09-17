# 130 - Electron Cloud Sync Bridge

> Feature-spec file number 130. Milestone v4, Phase 4, tracker **#121**.
> Depends On: spec 128 (Cloud Frontend); cloud backend running.

## Goal

Allow the Electron desktop app to optionally connect to the cloud backend when online,
sync local changes up, and receive remote changes. When offline, the desktop app
continues to work identically to v3.

---

## Three Operating Modes

| Mode | Behavior |
|---|---|
| **Offline** | No cloud config. Works exactly as v3. Default. |
| **Cloud-native** | No local DB. Every operation goes directly to cloud API. |
| **Hybrid** | Local DB for offline use. Syncs with cloud when connected. |

---

## Hybrid Mode Sync Architecture

```
Local Postgres (Electron)
    ↓ changes captured via DB triggers / Prisma middleware
    ↓
SyncQueue (local SQLite — lightweight, never loses changes)
    ↓ when network available
    ↓
Cloud API (/api/v1/sync/push)
    ↓
Cloud services process and respond with any remote changes
    ↓
Electron receives and applies remote changes to local DB
```

---

## Conflict Resolution Policy

v4 uses **last-write-wins with server priority**:
- If the same record was changed locally and on cloud, cloud version wins
- The local version is saved to a `conflict_log` table for user review
- Business-critical records (posted vouchers, posted invoices) are immutable —
  no conflicts possible once posted

---

## Sync Status Indicator

Status bar in Electron (bottom right):
- 🟢 Synced — all changes pushed, no pending
- 🟡 Syncing — N changes queued, uploading
- 🔴 Offline — not connected to cloud
- ⚠️ Conflict — N records have conflicts (click to review)

---

## Testing Requirements

- Offline mode: no cloud API calls made when cloud config is absent
- Hybrid mode: a sale made offline is pushed to cloud on reconnect
- Conflict: same invoice edited locally and remotely → cloud version wins, conflict logged
- Electron app version and cloud API version mismatch → graceful degradation + upgrade prompt
