# 126 - Prisma Multi-Tenant Client Factory

> Feature-spec file number 126. Milestone v4, Phase 3, tracker **#117**.
> Depends On: spec 123 (Per-Tenant Database Provisioning).

## Goal

Implement a `TenantClientFactory` that resolves the correct Prisma Client for any
company on any request, with connection pooling and cache-aware TTL management.

---

## Architecture

```typescript
class TenantClientFactory {
  private clients = new Map<string, PrismaClient>()
  private clientTTL = new Map<string, number>()  // created timestamp

  async getClient(companyId: string): Promise<PrismaClient> {
    const cached = this.clients.get(companyId)
    if (cached && !this.isExpired(companyId)) return cached

    const dbUrl = await this.companyGrpcClient.getActiveDatabaseUrl({ companyId })
    if (!dbUrl) throw new TenantNotFoundError(companyId)

    const client = new PrismaClient({
      datasourceUrl: dbUrl,
      log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    })

    await client.$connect()
    this.clients.set(companyId, client)
    this.clientTTL.set(companyId, Date.now())
    return client
  }

  private isExpired(companyId: string): boolean {
    const created = this.clientTTL.get(companyId) ?? 0
    return Date.now() - created > 3_600_000  // 1 hour TTL
  }

  async disconnect(companyId: string): Promise<void> {
    const client = this.clients.get(companyId)
    if (client) {
      await client.$disconnect()
      this.clients.delete(companyId)
      this.clientTTL.delete(companyId)
    }
  }
}
```

---

## Usage in Services

```typescript
// In any service method:
async function postSalesInvoice(companyId: string, input: PostInvoiceInput) {
  const prisma = await tenantClientFactory.getClient(companyId)
  return prisma.$transaction(async (tx) => {
    // ... use tx exactly as before
  })
}
```

---

## Connection Pool Management

- Maximum 5 active Prisma clients per pod (prevent connection explosion)
- LRU eviction: when limit reached, disconnect the least-recently-used company's client
- PgBouncer handles actual DB connections — Prisma connects to PgBouncer

---

## Testing Requirements

- `getClient` for a new company creates and caches a client
- `getClient` for the same company within TTL returns the cached client
- LRU eviction: 6th company request evicts the least-recently-used
- A deprovisioned company's `getClient` throws `TenantNotFoundError`
- Connection leak test: no open connections after `disconnect` is called
