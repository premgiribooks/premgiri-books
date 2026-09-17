# UI Context — Milestone v4

## Base (Unchanged)

All UI tokens, design system, typography, and component conventions from
`context/ui-context.md` and `context-v3/ui-context.md` remain in force.
This file records only v4 UI additions.

---

## Multi-Tier Frontend Architecture (v4)

v4 introduces three distinct frontend delivery modes for the same Next.js codebase:

| Mode | Host | User |
|---|---|---|
| **Electron (Desktop)** | Local machine | Offline / hybrid businesses |
| **Cloud Web** | Next.js containers behind CDN | Cloud subscribers, any browser |
| **Web PWA (Mobile)** | Same as Cloud Web, installed to home screen | Mobile users |

The codebase is one Next.js app. A `NEXT_PUBLIC_DEPLOYMENT_MODE` environment variable
(`DESKTOP` / `CLOUD` / `PWA`) controls which features are exposed in which context.

---

## Cloud Web Additions

### Multi-Company Switcher (Cloud Web Only)
Cloud users (especially CAs / consultants) may belong to multiple companies. A company
switcher appears in the top navbar (replacing the simple company name display).

- Clicking opens a dropdown of the user's companies
- Switching company: replaces the session's company context, redirects to `/dashboard`
- Super Admin: can switch to any company from `/administration`

---

### Subscription / Plan Badge
Cloud deployments show a subscription plan badge in the top navbar
(e.g., "Starter", "Professional", "Enterprise").

---

### Connection Mode Indicator (Hybrid Desktop)
On the Electron app in hybrid mode, a status bar indicator shows:
- 🟢 Cloud Synced — connected and all changes pushed
- 🟡 Syncing — changes pending upload
- 🔴 Offline — working locally, will sync on reconnect

---

## Performance Targets (v4 — Revised)

| Metric | v3 Target | v4 Target |
|---|---|---|
| Dashboard load | < 2s | < 800ms (CDN + Redis) |
| Invoice save | < 1s | < 500ms |
| Product search | < 300ms | < 100ms (Redis cache) |
| Report generation | < 5s | < 2s (async + Redis) |
| API Gateway latency added | N/A | < 5ms overhead |
| Cold start (new pod) | N/A | < 15s to readiness |

---

## Web PWA Additions (v4)

The v3 PWA was read-only. v4 PWA supports write operations for core billing workflows:

| Feature | v3 PWA | v4 PWA |
|---|---|---|
| Dashboard | Read | Read |
| Reports | Read | Read |
| Sales Invoice | — | Create + Post |
| Quick billing | — | Create + Post |
| Customer lookup | — | Read |
| Product search | — | Read |
| Payment recording | — | Create |

Full master data management, settings, and administration remain desktop/web-only.

---

## API Gateway Response Standards

All API responses from the gateway follow a uniform envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "traceId": "otel-trace-id",
    "timestamp": "ISO8601"
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [ ... ]
  },
  "meta": { ... }
}
```

The frontend must handle the `meta.traceId` field — it is displayed in error toasts
as a "Reference ID" so users can report it to support.

---

## Loading + Skeleton States (v4 Cloud)

Cloud responses have network latency. Every data-fetching component must show a
skeleton state while loading — no blank pages or spinners without content structure.

Skeleton rules:
- Use the existing `Skeleton` component from shadcn/ui
- Match the skeleton shape to the real content layout
- Show at most 3 skeleton items in a list; 1 skeleton for detail panels
- Skeleton transitions to real content without layout shift (no CLS)
