# 114 - API Gateway + Service Mesh

> Feature-spec file number 114. Milestone v4, Phase 2, tracker **#105**.
> Depends On: Phase 1 (K8s cluster running).

## Goal

Deploy the API Gateway as the single external entry point for all client traffic,
and configure the service mesh for encrypted internal service communication.

---

## API Gateway (Kong / NGINX Ingress)

The API Gateway handles:
- TLS termination (cert-manager provides certificates)
- JWT validation (verify token signature before routing)
- Rate limiting (per-IP and per-user-ID sliding window)
- Request routing to the correct microservice
- Request/response logging (with traceId injection)
- CORS policy enforcement

### Route Table

| Path Prefix | Target Service | Auth Required |
|---|---|---|
| `/api/v1/auth/**` | auth-service | No (login/register) |
| `/api/v1/companies/**` | company-service | Yes |
| `/api/v1/masters/**` | masters-service | Yes |
| `/api/v1/sales/**` | sales-service | Yes |
| `/api/v1/purchase/**` | purchase-service | Yes |
| `/api/v1/inventory/**` | inventory-service | Yes |
| `/api/v1/accounting/**` | accounting-service | Yes |
| `/api/v1/gst/**` | gst-service | Yes |
| `/api/v1/reports/**` | reporting-service | Yes |
| `/health` | Local (gateway) | No |

### Rate Limits (via Kong plugin or NGINX annotation)
- `/api/v1/auth/login`: 5 requests/minute/IP
- `/api/v1/reports/**`: 10 requests/minute/user
- All other routes: 100 requests/minute/user

---

## Service Mesh (Istio or Linkerd)

The service mesh provides:
- **mTLS** between all pods in the cluster (no plain-text inter-service traffic)
- **Traffic observability** (request rates, error rates, latency per service pair)
- **Circuit breaking** (stop sending to a service that is failing)
- **Retry policies** (auto-retry idempotent requests on 503/504)

Installation: `istioctl install --set profile=minimal` or Linkerd CLI.

### Istio PeerAuthentication (enforce mTLS cluster-wide)
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
```

---

## Request Tracing

Every request that enters the API Gateway gets a `X-Request-Id` header (UUID) and
a `X-B3-TraceId` header (OpenTelemetry trace ID). These are forwarded to all
downstream services and appear in every log line and every Jaeger trace.

---

## Testing Requirements

- A request without a valid JWT to a protected route returns 401
- A request exceeding the rate limit returns 429 with `Retry-After` header
- mTLS: a pod outside the mesh cannot connect to a pod inside the mesh
- `X-Request-Id` propagated end-to-end and visible in Jaeger
- Circuit breaker: when auth-service returns 500 on 50% of requests, the gateway
  returns 503 to the client instead of waiting
