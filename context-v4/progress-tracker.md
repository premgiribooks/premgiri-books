# Premgiri Books ERP — Milestone v4 Progress Tracker

> Running implementation log for Milestone v4.
> Add a dated entry after every meaningful session.
> For phase/feature status see `context-v4/Phases/phase-tracker.md`.
> Do NOT add v4 entries to v3 or v2 tracking files.

---

## Current Phase

Phase 1 — Infrastructure Foundation

---

## Current Goal

Spec 110 (Docker Containerization) — containerize all existing services.

---

## Completed

*(Nothing completed yet — v4 work has not started.)*

---

## In Progress

*(Nothing in progress — v4 work has not started.)*

---

## Next Up

1. Spec 110: Docker containerization
2. Spec 111: Kubernetes cluster setup
3. Spec 112: Helm charts + ArgoCD
4. Spec 113: CI/CD pipeline
5. Spec 114: API Gateway

---

## Open Questions

1. **Kubernetes provider**: AWS EKS vs. self-hosted K3s on EC2/VPS vs. DigitalOcean
   DOKS. Decision needed before spec 111 implementation. EKS recommended for
   production; K3s recommended for development/staging to minimize cost.

2. **Redis provider**: Self-hosted Redis Cluster in K8s (StatefulSet) vs. AWS ElastiCache
   vs. Upstash. Decision needed before spec 124. Self-hosted recommended for cost
   control; ElastiCache for managed HA.

3. **Kafka provider**: Self-hosted KRaft in K8s vs. Confluent Cloud vs. AWS MSK.
   Decision needed before spec 125. Self-hosted KRaft for cost; MSK for managed ops.

4. **Auth provider**: Self-hosted Keycloak vs. Auth0 vs. Clerk. Decision needed before
   spec 133. Keycloak recommended for full control and OIDC compliance; Auth0 for
   faster dev velocity.

5. **File storage**: AWS S3 vs. MinIO (self-hosted in K8s) vs. DigitalOcean Spaces.
   MinIO recommended for dev/staging; S3 for production.

6. **CDN**: CloudFront vs. Cloudflare. Cloudflare recommended for WAF + CDN in one.

---

## Architecture Decisions (v4)

*(Recorded here as decisions are made during implementation.)*

---

## Session Notes

*(Empty — no sessions yet.)*

---

## Environment Configuration

See `context/progress-tracker.md` for local dev setup (PostgreSQL, Prisma, Electron).

v4 additions needed before first K8s work:
- Docker Desktop (or Rancher Desktop) installed
- `kubectl` + `helm` + `helmfile` CLI tools installed
- `kind` or `k3d` for local K8s cluster during development
- AWS CLI configured (if using EKS)
- ArgoCD CLI installed
