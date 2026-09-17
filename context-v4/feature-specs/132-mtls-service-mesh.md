# 132 - mTLS Service Mesh

> Feature-spec file number 132. Milestone v4, Phase 5, tracker **#123**.
> Depends On: Phase 2 services all running.

## Goal

Enable mutual TLS (mTLS) for all inter-service communication inside the cluster
using Istio or Linkerd. No plain-text traffic between pods.

---

## mTLS Model

Every pod gets a certificate automatically (from the mesh's built-in CA). When
service A calls service B:
1. A presents its cert (proves it is `sales-service` in `premgiri-business`)
2. B presents its cert (proves it is `inventory-service` in `premgiri-business`)
3. Both verify the other's cert is signed by the cluster CA
4. All traffic is TLS-encrypted

---

## Istio Configuration

```yaml
# Enforce STRICT mTLS cluster-wide (no plain-text allowed)
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT

# AuthorizationPolicy: sales-service can ONLY call masters-service and engine-service
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: sales-service-egress
  namespace: premgiri-business
spec:
  selector:
    matchLabels:
      app: sales-service
  action: ALLOW
  rules:
    - to:
        - operation:
            hosts: ["masters-service.premgiri-business.svc.cluster.local"]
            hosts: ["engine-service.premgiri-business.svc.cluster.local"]
```

---

## Service-to-Service Authorization

| Caller | Can Call |
|---|---|
| API Gateway | All services |
| sales-service | masters-service, engine-service |
| purchase-service | masters-service, engine-service |
| inventory-service | masters-service, engine-service |
| accounting-service | engine-service |
| gst-service | masters-service, engine-service, reporting-service |
| reporting-service | All services (read-only gRPC) |
| Any service | auth-service (JWT validation), company-service (settings) |

---

## Testing Requirements

- A pod outside the mesh cannot connect to any pod inside the mesh
- Plain-text HTTP between services returns a TLS error
- AuthorizationPolicy: sales-service cannot call accounting-service directly
- Certificate rotation (cert expires): traffic continues without service restart
