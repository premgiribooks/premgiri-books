# 128 - Cloud-Hosted Next.js Frontend

> Feature-spec file number 128. Milestone v4, Phase 4, tracker **#119**.
> Depends On: spec 114 (API Gateway); Phase 2 services.

## Goal

Deploy the Next.js frontend as a containerized service behind the API Gateway,
accessible from any browser globally over HTTPS.

---

## Deployment Architecture

```
Browser → Cloudflare (WAF + CDN) → ALB → NGINX Ingress → next-frontend pod
```

The Next.js app in cloud mode makes API calls to `/api/v1/**` which the Ingress
routes to the correct microservice. The frontend is stateless — multiple replicas
can run in parallel.

---

## Environment Modes

`NEXT_PUBLIC_DEPLOYMENT_MODE` determines behavior:
- `DESKTOP`: Electron mode (existing behavior, unchanged)
- `CLOUD`: Cloud web mode — uses JWT-based auth, API calls to cloud backend
- `PWA`: Same as CLOUD but with bottom tab navigation for mobile

---

## JWT Auth Integration (Cloud Mode)

In cloud mode, the existing session-cookie auth is replaced with JWT:
```typescript
// Existing (local mode): cookie-based session
// Cloud mode: JWT in httpOnly cookie

// On login:
const { accessToken, refreshToken } = await authClient.login(credentials)
// Store in httpOnly cookie (set by auth-service response header)

// On every API call:
// JWT is sent automatically via cookie header
// API Gateway validates JWT before routing

// Token refresh:
// Interceptor in the HTTP client auto-refreshes expired tokens
```

---

## Multi-Company Switcher (Cloud Mode)

When a user belongs to multiple companies (`CompanyUser` join table), a company
switcher appears in the navbar. Switching company:
1. Calls `POST /api/v1/auth/switch-company` with the target `companyId`
2. Auth service issues a new JWT with the new `companyId` in the `cid` claim
3. Frontend reloads the current page

---

## K8s Deployment

```yaml
Replicas: 3 (production) / 2 (staging)
Resources:
  requests: { cpu: 200m, memory: 512Mi }
  limits: { cpu: 1000m, memory: 1024Mi }
HPA: min 2, max 10, target CPU 70%
```

---

## Testing Requirements

- Cloud web app loads in < 800ms TTFB on a warm CDN hit
- Company switcher: switching company issues a new JWT with the correct `cid`
- Electron desktop app still works identically (DESKTOP mode unaffected)
- A/B deploy: blue/green rollout via ArgoCD, zero downtime
