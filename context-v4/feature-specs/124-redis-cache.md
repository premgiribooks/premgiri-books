# 124 - Redis Caching Layer (Super Admin Toggle)

> Feature-spec file number 124. Milestone v4, Phase 3, tracker **#115**.
> Depends On: Phase 2 services.

## Goal

Deploy Redis Cluster and implement the `CacheService` abstraction with a Super Admin
enable/disable toggle. When disabled, all code paths fall back to PostgreSQL.

---

## Redis Deployment (K8s StatefulSet)

```yaml
Redis Cluster: 3 primary + 3 replica nodes
  Namespace: premgiri-data
  PVC: 10Gi per node (gp3 StorageClass)
  Image: redis:7-alpine
  Persistence: AOF + RDB
```

---

## CacheService Abstraction

```typescript
interface CacheService {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  delPattern(pattern: string): Promise<void>  // e.g. "premgiri:abc:reports:*"
}

// Redis-enabled implementation
class RedisCacheService implements CacheService { ... }

// No-op implementation (Redis disabled)
class NullCacheService implements CacheService {
  async get() { return null }
  async set() { }
  async del() { }
  async delPattern() { }
}
```

The correct implementation is injected via DI based on the Super Admin setting.

---

## Super Admin Toggle

`/administration/infrastructure` panel (Super Admin only):
- Redis Enabled/Disabled toggle
- Current Redis status (ping latency, memory usage, hit rate)
- "Flush Cache" button (invalidates all keys for all companies)

Toggle persists in Platform DB `infrastructure_settings` table.
Services poll this setting every 60 seconds (or via a Kafka event on change).

---

## Key Namespacing

All keys follow: `premgiri:{companyId}:{service}:{entity}:{id}`

Example: `premgiri:abc123:masters:product:xyz789`

---

## Cache Warming

On service startup (readiness probe passes), warm the most-accessed keys:
- Company settings (all companies this pod serves)
- GST rates (rarely change)
- Product catalog top 100 by transaction frequency

---

## Testing Requirements

- `NullCacheService` makes all code paths work with zero Redis dependency
- Redis toggle: disabling mid-request → next request uses NullCacheService
- Cache invalidation: updating a product removes both the product cache and the list cache
- Cache key collision: two companies' keys never return each other's data
- Redis cluster failover: primary node failure → replica promoted, < 1s downtime
