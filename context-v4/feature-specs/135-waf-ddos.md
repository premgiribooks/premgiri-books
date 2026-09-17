# 135 - WAF + DDoS Protection

> Feature-spec file number 135. Milestone v4, Phase 5, tracker **#126**.
> Depends On: spec 114 (API Gateway); CDN in place (spec 131).

## Goal

Deploy a Web Application Firewall and DDoS protection layer in front of the
Kubernetes cluster to block OWASP Top 10 attacks, SQL injection, XSS, and
volumetric DDoS before they reach the application.

---

## Cloudflare WAF Configuration

```
Cloudflare (Free/Pro/Business):
  ├── DDoS Protection: auto (always on)
  ├── WAF Rules:
  │   ├── OWASP Core Rule Set (managed rules)
  │   ├── Custom rule: Block requests with SQL injection patterns in query params
  │   ├── Custom rule: Block requests with XSS patterns
  │   ├── Custom rule: Rate limit /api/v1/auth/login to 5 req/min/IP
  │   └── Custom rule: Block requests from Tor exit nodes (optional, configurable)
  ├── Bot Management: challenge known bad bots
  └── Page Shield: detect client-side script injection
```

---

## WAF Rules for Indian ERP Context

```
Custom Rules:
  - Block requests where URI contains: '../', '%2F', 'etc/passwd', 'cmd.exe'
  - Block requests where User-Agent contains known scanner signatures
  - Block requests from IPs with > 1000 requests/minute (volumetric)
  - Challenge (CAPTCHA) requests from IPs with > 100 failed auth attempts/hour
```

---

## AWS WAF Alternative

If Cloudflare is not used, configure AWS WAF in front of ALB:
```
AWS WAF:
  - AWSManagedRulesCommonRuleSet (OWASP Top 10)
  - AWSManagedRulesKnownBadInputsRuleSet (log4j, Spring4Shell)
  - AWSManagedRulesSQLiRuleSet
  - Rate-based rule: 100 requests/5min/IP → BLOCK
```

---

## Response Headers (Security)

Every API response includes:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<random>'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Testing Requirements

- SQL injection in query param: Cloudflare WAF blocks with 403
- XSS payload in request body: blocked before reaching the API
- DDoS simulation (wrk/k6): 10,000 req/sec → Cloudflare absorbs, origin pod stays healthy
- HSTS header present on all HTTPS responses
- CSP header blocks inline scripts
