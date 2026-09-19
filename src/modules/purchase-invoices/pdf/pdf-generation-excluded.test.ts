import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// 78-pdf-generation.md's Code Standards: "No buildPurchaseInvoiceHtml
// function or PDF/print UI action exists anywhere for Purchase Invoice" —
// Purchase Invoice's own spec permanently excludes printing (see the
// feature-spec's Goal section), so no src/modules/purchase-invoices/pdf/
// directory should ever be introduced, guarding against a future accidental
// re-introduction. This file itself lives at
// src/modules/purchase-invoices/pdf/ only as a negative-test host — it
// deliberately does not create sibling implementation files, and asserts
// none exist.
describe("Purchase Invoice PDF generation exclusion", () => {
  it("has no buildPurchaseInvoiceHtml template file", () => {
    const templatePath = path.join(process.cwd(), "src/modules/purchase-invoices/pdf/purchase-invoice-pdf.ts");

    expect(existsSync(templatePath)).toBe(false);
  });

  it("has no PDF download Route Handler for Purchase Invoice", () => {
    const routePath = path.join(process.cwd(), "src/app/purchase/invoices/[id]/pdf/route.ts");

    expect(existsSync(routePath)).toBe(false);
  });
});
