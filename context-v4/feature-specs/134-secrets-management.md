# 134 - Secrets Management (HashiCorp Vault)

> Feature-spec file number 134. Milestone v4, Phase 5, tracker **#125**.
> Depends On: Phase 1 (K8s cluster running).

## Goal

Deploy HashiCorp Vault and migrate all secrets (DB passwords, JWT signing keys,
API credentials, encryption keys) from environment variables / plain-text config
into Vault with dynamic secret rotation.

---

## Vault Deployment (K8s)

```yaml
HashiCorp Vault: HA cluster (3 nodes)
  Namespace: premgiri-infra
  Storage backend: integrated Raft (no Consul dependency)
  Auto-unseal: AWS KMS or Transit Secrets Engine
  UI: enabled (Super Admin only, not externally accessible)
```

---

## Secret Paths

```
secret/premgiri/platform/
  ├── database/         # Platform DB credentials
  ├── jwt/signing-key   # RS256 private key for JWT
  └── admin/master-key  # Vault master recovery key

secret/premgiri/services/
  ├── auth-service/
  ├── company-service/
  ├── sales-service/
  └── ...

secret/premgiri/company/<uuid>/
  ├── database/         # Per-company DB credentials
  ├── einvoice/         # NIRP credentials
  └── ewb/              # E-Way Bill credentials
```

---

## Secret Injection (Vault Agent Sidecar)

Every pod gets a Vault Agent sidecar that:
1. Authenticates to Vault using the pod's Kubernetes ServiceAccount
2. Fetches the pod's secrets at startup
3. Writes them to a shared volume (`/vault/secrets/`)
4. Monitors for rotation and updates files automatically

```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/agent-inject-secret-db: "secret/premgiri/services/auth-service/database"
  vault.hashicorp.com/agent-inject-template-db: |
    {{- with secret "secret/premgiri/services/auth-service/database" -}}
    DATABASE_URL=postgresql://{{ .Data.data.username }}:{{ .Data.data.password }}@...
    {{- end }}
```

---

## Dynamic Database Credentials

Vault's Database Secrets Engine creates time-limited PostgreSQL credentials:
- Lease: 1 hour
- Auto-rotation: Vault rotates the password before the lease expires
- No hardcoded DB passwords anywhere in the codebase

---

## Testing Requirements

- Vault agent injects secrets into a pod's file system on startup
- A pod cannot read another service's secrets (RBAC policy test)
- Secret rotation: when Vault rotates the DB password, the service reconnects within 30 seconds
- Vault seal/unseal: cluster recovers from a single node failure
