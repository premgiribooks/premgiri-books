# 129 - Web PWA v4 (Mobile Read + Write)

> Feature-spec file number 129. Milestone v4, Phase 4, tracker **#120**.
> Depends On: spec 128 (Cloud Frontend).

## Goal

Extend the Web PWA from v3 (read-only) to support write operations for the core
billing workflow on mobile. A business owner or counter staff can create and post
sales invoices from a phone browser.

---

## Mobile Write Capabilities (v4 Addition to v3 PWA)

| Feature | v3 | v4 |
|---|---|---|
| Dashboard | Read | Read |
| Sales Invoice | — | Create + Post |
| Quick Customer billing | — | Create + Post |
| Payment recording | — | Create |
| Product search + barcode | — | Read (barcode via camera) |

---

## Camera Barcode Scanning (Mobile)

Mobile PWA adds camera-based barcode scanning (no hardware scanner needed):

```typescript
// Uses the BarcodeDetector Web API (Chrome 83+) or a polyfill (ZXing)
const detector = new BarcodeDetector({ formats: ['ean_13', 'qr_code', 'code_128'] })
const barcodes = await detector.detect(videoFrame)
if (barcodes.length > 0) {
  await resolveBarcode(barcodes[0].rawValue)
}
```

---

## Mobile Sales Invoice Flow

Simplified for mobile (fewer fields than desktop):
1. Tap "New Bill"
2. Scan/search product → auto-add line
3. Add more products
4. Set payment mode (Cash/UPI/Card)
5. Tap "Post Invoice"
6. Option to print via Bluetooth thermal printer (future) or share PDF via WhatsApp

---

## Service Worker Strategy (v4)

- App shell: cache-first (immediate load)
- Financial API responses: network-first, no cache storage
- Static assets: stale-while-revalidate with 1-hour TTL
- Offline state: if the API call fails, show "You're offline" banner but keep the form
  data in IndexedDB for retry when reconnected

---

## Testing Requirements

- Mobile Sales Invoice creates a valid posted invoice end-to-end
- Camera barcode scan resolves product on Chrome for Android
- Offline mode: form data preserved in IndexedDB; sync on reconnect
- Lighthouse PWA score ≥ 90 (v4 with write features)
