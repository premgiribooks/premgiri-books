# 131 - CDN + Static Asset Optimization

> Feature-spec file number 131. Milestone v4, Phase 4, tracker **#122**.
> Depends On: spec 128 (Cloud Frontend).

## Goal

Serve all static assets (JS, CSS, images, fonts) from a CDN edge network so that
the first meaningful paint for cloud users anywhere in the world is < 1 second.

---

## CDN Configuration (Cloudflare)

```
Origin: Next.js container (K8s service)
CDN: Cloudflare (Workers + Cache Rules)

Cache Rules:
  /_next/static/**  → Cache-Control: public, max-age=31536000, immutable
  /images/**        → Cache-Control: public, max-age=86400
  /fonts/**         → Cache-Control: public, max-age=31536000, immutable
  /api/**           → Cache-Control: no-store (never cache API responses)
```

---

## Next.js Output Optimization

```typescript
// next.config.ts
export default {
  output: 'standalone',
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },
  experimental: {
    optimizeCss: true,
  },
}
```

---

## Bundle Size Targets

| Asset | Target |
|---|---|
| First page JS (gzipped) | < 150KB |
| Total JS on dashboard | < 400KB |
| Largest Contentful Paint (LCP) | < 2.5s |
| Cumulative Layout Shift (CLS) | < 0.1 |
| Time to First Byte (TTFB) | < 100ms (CDN hit) |

---

## Testing Requirements

- Lighthouse performance score ≥ 85 on cloud web
- TTFB < 100ms for CDN-cached assets (measured from 3 geographic regions)
- `/_next/static/**` assets have `max-age=31536000` in response headers
- `/api/**` responses have `no-store` in Cache-Control headers
