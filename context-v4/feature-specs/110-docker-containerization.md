# 110 - Docker Containerization

> Feature-spec file number 110 (v4 sequence). Milestone v4, Phase 1 — Infrastructure
> Foundation, tracker item **#101 Docker Containerization**.
>
> Depends On: Existing monolith codebase. This is the first v4 spec — nothing in Phase 2+
> can proceed until the app runs successfully in a container.

## Goal

Containerize every component of Premgiri Books ERP so each service can be deployed,
scaled, and updated independently in Kubernetes.

---

## Dockerfiles to Create

### 1. `Dockerfile` (Next.js web + API — cloud deployment)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### 2. `Dockerfile.engine` (Engine service — gRPC internal)

Separate image for the Engine service (Voucher, Pricing, Inventory, GST engines)
that is called internally over gRPC. No external ports exposed.

### 3. `docker-compose.dev.yml` (Local development)

Full local stack for development:
- `app` — Next.js on port 3000
- `postgres` — PostgreSQL 15 on port 5432
- `redis` — Redis 7 on port 6379
- `kafka` — Kafka KRaft on port 9092
- `kafka-ui` — Kafka UI on port 8080
- `vault-dev` — HashiCorp Vault dev mode on port 8200

### 4. `.dockerignore`

```
node_modules
.next
.git
dist-electron
*.log
.env*
coverage
```

---

## Image Registry

Images are pushed to:
- Production: AWS ECR (`<account>.dkr.ecr.<region>.amazonaws.com/premgiri/<service>`)
- Development/staging: GitHub Container Registry (`ghcr.io/premgiri/<service>`)

Image tags: `<service>:<git-sha>` for immutable tags; `:latest` only for dev.

---

## Multi-Stage Build Requirements

1. Build stage installs all dependencies (including devDependencies)
2. Production stage copies only the built output
3. Production stage runs as a non-root user (`nextjs:nodejs`, uid 1001)
4. No `.env` files in any image layer — secrets injected at runtime
5. Image size target: < 300MB for the Next.js image

---

## Health Checks in Dockerfile

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1
```

---

## Testing Requirements

- `docker build` succeeds with zero errors
- `docker run` starts the container and responds to `GET /health/live` with 200
- Image does not contain `node_modules` from the build stage (size check)
- No root user: `docker inspect` shows `User: 1001`
- `docker-compose.dev.yml up` brings up all services, all health-checks pass
