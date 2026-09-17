# 108 - Mobile PWA (Read-Only Dashboard + Reports)

> Feature-spec file number 108 (v3 sequence).
> This feature is `context-v3/Phases/phase-tracker.md`'s **Phase 5 — Growth Features**,
> tracker item **#99 Mobile PWA**.
>
> Depends On: Dashboard (v2 spec 85); Reports (v2 specs 64–74).

## Goal

Turn the existing Next.js application into a Progressive Web App (PWA) installable on
mobile browsers. On mobile, only the read-only Dashboard and Reports sections are
accessible. The billing, data-entry, and configuration screens remain desktop-only.

A business owner can open the PWA on their phone and see:
- Today's sales and purchases
- Cash and bank balances
- Receivables and payables
- P&L for the current month
- Trial Balance

---

## Project Context

Read before implementation:

1. `context-v3/ui-context.md` — Mobile PWA Additions section.
2. `context/feature-specs/85-dashboard.md` — Dashboard; the primary mobile view.
3. `context/feature-specs/64-trial-balance.md`, `65-profit-and-loss.md` — Financial reports.
4. Next.js PWA plugin options: `next-pwa` (Workbox-based) or `@ducanh2912/next-pwa`.

---

## Module Responsibilities

- `next-pwa` plugin configuration in `next.config.ts`
- Service worker: offline shell caching (app shell only — no financial data cached)
- PWA manifest: `public/manifest.json` with app name, icons, theme color
- Mobile-responsive layout: bottom tab bar for mobile viewports (< 640px)
- Mobile-only route guard: data-entry routes redirect to the dashboard on mobile
- `MobileNav` component: Dashboard, P&L, Receivables/Payables, Reports tabs

---

## PWA Manifest

```json
{
  "name": "Premgiri Books ERP",
  "short_name": "Premgiri",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#080809",
  "background_color": "#080809",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Mobile Layout Rules

- Bottom tab bar replaces the left sidebar on screens < 640px.
- Tabs: Dashboard | P&L | Receivables | Reports
- Table components collapse to a card-list layout on mobile (each row → a card).
- Chart components render in a simplified single-series format on mobile.
- No form elements are visible on mobile — all interactive controls are hidden.
- The top navbar on mobile shows: company name, financial year selector, user avatar.

---

## Offline Behavior

- The PWA caches the application shell (HTML, CSS, JS) for offline access.
- Financial data is NOT cached — stale balance sheets on a phone are dangerous.
- When offline, the app shows: "You're offline — financial data requires a connection."
- No background sync of financial data.

---

## Mobile Route Guard

Routes that are desktop-only redirect to `/dashboard` when accessed on a mobile
viewport:
- `/sales/**`
- `/purchase/**`
- `/inventory/**`
- `/accounting/**`
- `/masters/**`
- `/settings/**`
- `/employees/**`
- `/gst/**`
- `/administration/**`

Detection: `window.innerWidth < 640` or a `mobile` cookie set by the PWA manifest's
`display: standalone` mode.

---

## Business Rules

1. The PWA is an extension of the existing app — no separate build target or
   deployment.
2. Financial data is always fetched fresh on each page load — never served from
   the service worker cache.
3. The PWA must work on Chrome for Android and Safari for iOS.
4. All numbers are right-aligned with monospaced digits on mobile — matching the
   existing desktop design system.

---

## Security Considerations

- The PWA uses the same session cookie as the desktop app — no separate auth.
- Service worker only caches static assets — never API responses.
- `Cache-Control: no-store` headers on all API routes prevent inadvertent caching
  of financial data by the service worker.

---

## Testing Requirements

- Lighthouse PWA audit: score ≥ 90
- Offline test: app shell loads offline; financial data shows "offline" state
- Mobile redirect test: `/sales` on a 375px viewport redirects to `/dashboard`
- iOS Safari install test: PWA installs from Safari's "Add to Home Screen"
