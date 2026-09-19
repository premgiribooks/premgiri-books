import { describe, expect, it } from "vitest";

import { customerDisplayName } from "@/modules/sales-invoices/utils/sales-invoice-display";
import type { SalesInvoiceDetail } from "@/types/sales-invoice";

describe("customerDisplayName", () => {
  function baseInvoice(
    overrides: Partial<SalesInvoiceDetail> = {},
  ): SalesInvoiceDetail {
    return {
      customer: null,
      customerMode: "WALK_IN",
      quickCustomerName: null,
      ...overrides,
    } as SalesInvoiceDetail;
  }

  it("uses the linked customer's name when present", () => {
    const name = customerDisplayName(
      baseInvoice({
        customer: {
          id: "c1",
          name: "Acme Traders",
          isActive: true,
          creditLimit: null,
          ledgerId: "l1",
          gstin: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          state: null,
          pinCode: null,
        },
      }),
    );
    expect(name).toBe("Acme Traders");
  });

  it("falls back to the quick customer name for QUICK mode", () => {
    const name = customerDisplayName(
      baseInvoice({
        customerMode: "QUICK",
        quickCustomerName: "Walk-in Buyer",
      }),
    );
    expect(name).toBe("Walk-in Buyer");
  });

  it("falls back to 'Quick Customer' for QUICK mode with no captured name", () => {
    const name = customerDisplayName(
      baseInvoice({ customerMode: "QUICK", quickCustomerName: null }),
    );
    expect(name).toBe("Quick Customer");
  });

  it("falls back to 'Walk-in Customer' for WALK_IN mode with no captured name", () => {
    const name = customerDisplayName(
      baseInvoice({ customerMode: "WALK_IN", quickCustomerName: null }),
    );
    expect(name).toBe("Walk-in Customer");
  });
});
