# FX-01 — Global Prisma Singleton

**Severity:** BLOCKER  
**Found in:** `src/lib/prisma.ts`  
**Resolving spec:** v3 Bridge Decision A (`context-v3/architecture-context.md`) / v4 spec 126 (Prisma Multitenant)

---

## What Was Found

```typescript
// src/lib/prisma.ts (current state)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

A single global `PrismaClient` instance is created once at module load time and shared
across all requests and all company tenants. In v3 (single-company Electron app) this
works — there is only one company and one database.

---

## Why It Is a Problem

**v4 blocker:** In v4, each company has its own PostgreSQL database (spec 123 —
Per-Tenant Database). The Prisma client for each request must be scoped to the tenant's
database connection string, not a global singleton.

If services import `prisma` directly from this file, every service must be modified in
v4 to accept an injected client instead — a blast-radius change that touches every
module.

**v3 rule violation:** Bridge Decision A in `context-v3/architecture-context.md`
requires that new services introduced in v3 receive `PrismaClient` as a constructor
parameter, not import it from this file.

---

## What Must Change

### Phase 1 (v3 — new services only)

All new service classes introduced in v3 must accept `PrismaClient` (or `PrismaPg`) as
a constructor parameter:

```typescript
// ✅ v3-correct new service class:
export class PayrollService {
  constructor(private readonly db: PrismaClient) {}
}
```

The call site (Server Action) passes `prisma` from `src/lib/prisma.ts`:

```typescript
// Server Action (call site):
import { prisma } from "@/lib/prisma";
import { PayrollService } from "./payroll-service";

const service = new PayrollService(prisma);
```

The singleton file itself is **not changed** in v3.

### Phase 2 (v4 — spec 126)

In v4, `src/lib/prisma.ts` is replaced by a `PrismaClientFactory` that creates a
tenant-scoped client per request using the `companyId` from the JWT claim to look up
the connection string:

```typescript
// v4 replacement:
export function getPrismaForTenant(connectionUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(connectionUrl) });
}
```

All existing services that already accept `db: PrismaClient` as a constructor parameter
require no changes — only the call site switches.

---

## Files Affected

- `src/lib/prisma.ts` — unchanged in v3; replaced in v4
- All new v3 service files — must use constructor injection (not direct import)
- Existing v3 services being retrofitted in spec 105 — Pattern B preferred (constructor injection)

---

## Acceptance Criteria

- [ ] No new v3 service class imports `prisma` directly from `@/lib/prisma`
- [ ] Existing services being retrofitted in spec 105 use constructor injection where practical
- [ ] `src/lib/prisma.ts` continues to export the singleton for use at Server Action call sites only
