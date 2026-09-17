# 113 - CI/CD Pipeline

> Feature-spec file number 113. Milestone v4, Phase 1, tracker **#104**.
> Depends On: spec 112 (Helm + ArgoCD).

## Goal

Implement a complete CI/CD pipeline using GitHub Actions that: runs tests, builds
Docker images, pushes to a container registry, and triggers ArgoCD to deploy.

---

## Pipeline Stages

```
push / PR
    │
    ▼
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌────────────┐
│  Lint   │────▶│  Test    │────▶│  Build   │────▶│  Deploy    │
│ (ESLint │     │ (Vitest) │     │ (Docker) │     │ (ArgoCD)   │
│  tsc)   │     │          │     │          │     │            │
└─────────┘     └──────────┘     └──────────┘     └────────────┘
```

---

## GitHub Actions Workflows

### `ci.yml` (runs on every PR and push to main)
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env: { POSTGRES_PASSWORD: test }
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --run
```

### `build-push.yml` (runs on push to main only)
```yaml
name: Build and Push
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/premgiri/app:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Update image tag in k8s values
        run: |
          sed -i "s/tag: .*/tag: ${{ github.sha }}/" \
            k8s/environments/production/values.yaml
          git config user.email "ci@premgiri.com"
          git config user.name "CI Bot"
          git add k8s/environments/production/values.yaml
          git commit -m "ci: update image tag to ${{ github.sha }}"
          git push
```

---

## Branch Protection Rules

- `main` branch requires: CI passing, 1 approving review
- No direct pushes to `main` — all changes via PR
- ArgoCD only watches `main` branch

---

## Testing Requirements

- CI workflow completes in < 10 minutes on a standard PR
- Build + push workflow completes in < 15 minutes
- A broken test blocks the PR from merging
- A failing Docker build blocks deployment
- Image digest is pinned in the commit message for audit trail
