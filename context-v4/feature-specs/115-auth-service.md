# 115 - Auth Service

> Feature-spec file number 115. Milestone v4, Phase 2, tracker **#106**.
> Depends On: spec 114 (API Gateway).

## Goal

Extract authentication, session management, roles, permissions, and user management
from the monolith into a standalone `auth-service`. This is the first microservice
to be extracted because every other service depends on it for JWT validation.

---

## Owns

- `User` (in Platform DB)
- `Session`
- `Role` + `Permission` + `RolePermission`
- `CompanyUser` join table
- JWT issuance + verification
- Password hashing + verification

---

## API Endpoints

### Public (no JWT required)
```
POST   /api/v1/auth/login         — issue JWT pair (access + refresh)
POST   /api/v1/auth/refresh       — exchange refresh token for new access token
POST   /api/v1/auth/logout        — invalidate refresh token
```

### Authenticated
```
GET    /api/v1/auth/me            — current user + companies
PUT    /api/v1/auth/password      — change own password
GET    /api/v1/users              — list company users (Company Admin)
POST   /api/v1/users              — create user
PUT    /api/v1/users/:id          — update user
DELETE /api/v1/users/:id          — deactivate user
GET    /api/v1/roles              — list roles
POST   /api/v1/roles              — create role
PUT    /api/v1/roles/:id/permissions — assign permissions to role
```

### Internal gRPC (for other services)
```
ValidateToken(token) → { userId, companyId, userType, permissions[] }
GetUserPermissions(userId, companyId) → permissions[]
AssertPermission(userId, companyId, module, action) → { allowed: bool }
```

---

## JWT Structure

Access token (15-minute expiry):
```json
{
  "sub": "userId",
  "cid": "companyId",
  "typ": "COMPANY",
  "prm": ["sales:create", "sales:view", "reports:view"],
  "iat": 1234567890,
  "exp": 1234568790
}
```

Refresh token: opaque UUID, stored in Redis (or DB when Redis disabled), 7-day expiry.

---

## Redis Usage (Super Admin Toggle)

When Redis is enabled:
- Refresh tokens stored in Redis with TTL = 7 days
- `ValidateToken` result cached for 60 seconds (avoids DB hit on every request)

When Redis is disabled:
- Refresh tokens stored in `Session` table in Platform DB
- `ValidateToken` always queries Platform DB

---

## Security

- Passwords hashed with bcrypt (cost factor 12)
- Access tokens are short-lived (15 minutes) — no revocation list needed
- Refresh token rotation: each use issues a new refresh token and invalidates the old one
- Failed login attempts: tracked in Redis (or in-memory when Redis off); 5 failures → 15-minute lockout
- JWT signing key stored in Vault (spec 134), never in environment variable

---

## Testing Requirements

- Login with correct credentials returns valid JWT pair
- Login with wrong credentials returns 401 (no user-existence leak)
- Expired access token returns 401
- Token refresh rotates the refresh token
- `AssertPermission` returns false for a user missing the permission
- Redis-disabled mode: all paths work correctly with DB fallback
