import { describe, expect, it } from "vitest";

import { customerDisplayName, effectiveLineTax } from "@/modules/sales-invoices/utils/sales-invoice-display";
import type { SalesInvoiceDetail, SalesInvoiceItemDetail } from "@/types/sales-invoice";

function baseItem(overrides: Partial<SalesInvoiceItemDetail> = {}): SalesInvoiceItemDetail {
  return {
    id: "item-1",
    salesInvoiceId: "inv-1",
    lineNumber: 1,
    productId: "prod-1",
    warehouseId: "wh-1",
    quantity: 1,
    rate: 100,
    discountPercent: 0,
    discountAmount: 0,
    ratePercent: 18,
    cessPercent: 0,
    taxableAmount: 100,
    cgst: 9,
    sgst: 9,
    igst: 0,
    cess: 0,
    totalAmount: 118,
    isTaxOverridden: false,
    overriddenCgst: null,
    overriddenSgst: null,
    overriddenIgst: null,
    overriddenCess: null,
    overrideReason: null,
    overriddenByUserId: null,
    product: { id: "prod-1", name: "Widget", productCode: "WID-001", isActive: true },
    warehouse: { id: "wh-1", name: "Main Warehouse", code: "MAIN", isActive: true },
    ...overrides,
  };
}

describe("customerDisplayName", () => {
  function baseInvoice(overrides: Partial<SalesInvoiceDetail> = {}): SalesInvoiceDetail {
    return {
      customer: null,
      customerMode: "WALK_IN",
      quickCustomerName: null,
      ...overrides,
    } as SalesInvoiceDetail;
  }

  it("uses the linked customer's name when present", () => {
    const name = customerDisplayName(
      baseInvoice({ customer: { id: "c1", name: "Acme Traders", isActive: true, creditLimit: null, ledgerId: "l1" } })
    );
    expect(name).toBe("Acme Traders");
  });

  it("falls back to the quick customer name for QUICK mode", () => {
    const name = customerDisplayName(baseInvoice({ customerMode: "QUICK", quickCustomerName: "Walk-in Buyer" }));
    expect(name).toBe("Walk-in Buyer");
  });

  it("falls back to 'Quick Customer' for QUICK mode with no captured name", () => {
    const name = customerDisplayName(baseInvoice({ customerMode: "QUICK", quickCustomerName: null }));
    expect(name).toBe("Quick Customer");
  });

  it("falls back to 'Walk-in Customer' for WALK_IN mode with no captured name", () => {
    const name = customerDisplayName(baseInvoice({ customerMode: "WALK_IN", quickCustomerName: null }));
    expect(name).toBe("Walk-in Customer");
  });
});

describe("effectiveLineTax", () => {
  it("sums the system-computed tax fields when not overridden", () => {
    expect(effectiveLineTax(baseItem({ cgst: 9, sgst: 9, igst: 0, cess: 1 }))).toBe(19);
  });

  it("sums the overridden tax fields when isTaxOverridden is true", () => {
    const item = baseItem({
      isTaxOverridden: true,
      cgst: 9,
      sgst: 9,
      overriddenCgst: 5,
      overriddenSgst: 5,
      overriddenIgst: 0,
      overriddenCess: 0,
    });
    expect(effectiveLineTax(item)).toBe(10);
  });
});
