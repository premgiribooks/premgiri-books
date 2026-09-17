# 133 - JWT + OIDC Auth Layer

> Feature-spec file number 133. Milestone v4, Phase 5, tracker **#124**.
> Depends On: spec 115 (Auth Service).

## Goal

Harden the authentication layer with proper OIDC-compliant JWT handling. The auth-service
implements OIDC discovery, JWKS endpoint, and token introspection so any service
can independently verify tokens without calling auth-service on every request.

---

## OIDC Discovery Endpoint

```
GET /.well-known/openid-configuration
→ {
    "issuer": "https://app.premgiri.com",
    "jwks_uri": "https://app.premgiri.com/.well-known/jwks.json",
    "token_endpoint": "https://app.premgiri.com/api/v1/auth/login",
    "userinfo_endpoint": "https://app.premgiri.com/api/v1/auth/me"
  }

GET /.well-known/jwks.json
→ { "keys": [ { "kty": "RSA", "kid": "...", "n": "...", "e": "AQAB" } ] }
```

---

## JWT Signing

- Algorithm: RS256 (asymmetric — public key for verify, private key for sign)
- Private key: stored in Vault (spec 134), injected at startup
- Public key: served via JWKS endpoint
- Any service can verify a token locally using the cached JWKS — no auth-service call needed

---

## API Gateway JWT Validation

The API Gateway (Kong/NGINX) validates the JWT on every request:
1. Extract `Authorization: Bearer <token>` or cookie
2. Fetch JWKS (cached, refreshed every hour)
3. Verify signature, `iss`, `exp`, `aud`
4. Pass `x-user-id`, `x-company-id`, `x-user-type` headers to the upstream service
5. If invalid: return 401 before the request reaches any service

---

## Session vs. Stateless

- Access token: stateless JWT (15 min) — no server-side state needed
- Refresh token: stored in Redis / DB — validated on use
- Super Admin sessions: separate `PLATFORM` token type with no `cid` claim
- Company switching: issues a new access token with the new `cid`

---

## Testing Requirements

- JWKS endpoint serves the correct public key
- A token signed with a rotated key is rejected
- A token with `exp` in the past returns 401
- `x-company-id` header forwarded correctly to upstream services
- Token with `userType: PLATFORM` cannot access company-scoped endpoints
