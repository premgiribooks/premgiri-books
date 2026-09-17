# AI Development Workflow Rules — Milestone v4

## Base (Unchanged)

All rules from `context/ai-workflow-rules.md`, `context-v3/ai-workflow-rules.md`
remain in force. This file records only v4 amendments.

---

## v4 Spec and Tracker Numbering

- Feature-spec numbers start at **110** (continuing from v3's highest, 109)
- Tracker numbers start at **101** (continuing from v3's highest, 100)

When referencing v4 specs: `context-v4/feature-specs/<number>-<name>.md`
When referencing v3 specs: `context-v3/feature-specs/<number>-<name>.md`

---

## Context Files to Read Before Any v4 Feature

1. `context-v4/project-overview.md`
2. `context-v4/architecture-context.md` — **read fully; the microservice domain map
   and Kafka event table are critical**
3. `context-v4/code-standards.md`
4. `context-v4/Phases/phase-tracker.md`
5. `context-v4/progress-tracker.md`

---

## Phase Ordering (v4)

Phase 1 must complete before Phase 2. Phase 3 runs in parallel with Phase 2 (data
layer can be built while services are being extracted). Phase 4 starts once at least
one service (auth + company) is running in K8s. Phases 5 and 6 run after Phase 4.

```
Phase 1 (Infrastructure) → Phase 2 (Microservices)
                                        ↕ parallel
                           Phase 3 (Data Layer)
                                        ↓
                           Phase 4 (Frontend + Desktop)
                                        ↓
                           Phase 5 (Security + Observability)
                                        ↓
                           Phase 6 (Scaling + Performance)
```

---

## New Rule: Never Break the Desktop App

Every v4 change must be tested against the Electron desktop app. The desktop
app's offline path must work identically before and after every microservice split.
A PR that breaks the Electron build is blocked until fixed.

---

## New Rule: Contract-First Service Development

Before implementing any microservice, write:
1. Its `openapi.yaml` (REST) or `service.proto` (gRPC) first
2. Get the contract reviewed and merged
3. Only then implement the service

No service may call another service's database. If you need data from another domain,
define a gRPC endpoint in that service's proto first.

---

## New Rule: Kafka Event Idempotency

Every Kafka consumer handler must be idempotent before it is merged. The test for
idempotency (process the same event twice — result is identical to once) is a
required part of every consumer's test suite.

---

## New Rule: K8s Manifests in Git

All Kubernetes manifests live in `k8s/` at the repo root. They are declarative —
never applied with `kubectl` by hand in production. ArgoCD applies them from Git.
`kubectl apply` is permitted only in development namespaces.

---

## Tracker Update Rule (v4)

After every v4 feature is merged into `main`, update **both**:
1. `context-v4/Phases/phase-tracker.md`
2. `context-v4/progress-tracker.md`

Neither the v2 nor v3 tracking files are updated for v4 work.
