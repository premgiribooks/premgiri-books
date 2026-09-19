import { describe, expect, it } from "vitest";

import type { BankAccountWithLedger } from "@/types/bank-account";
import type { CompanyWithSettings } from "@/types/company";
import type { SalesInvoiceDetail } from "@/types/sales-invoice";
import { buildSalesInvoiceHtml, type SalesInvoicePdfData } from "@/modules/sales-invoices/pdf/sales-invoice-pdf";

function buildInvoiceFixture(overrides: Partial<SalesInvoiceDetail> = {}): SalesInvoiceDetail {
  return {
    id: "inv-1",
    companyId: "company-1",
    financialYearId: "fy-1",
    invoiceNumber: "INV/2026/0001",
    invoiceDate: new Date("2026-09-10T00:00:00.000Z"),
    customerMode: "PERMANENT",
    customerId: "cust-1",
    quickCustomerName: null,
    quickCustomerMobile: null,
    quickCustomerGstin: null,
    quickCustomerAddress: null,
    placeOfSupplyStateCode: "27",
    salesOrderId: null,
    deliveryChallanId: null,
    status: "POSTED",
    narration: null,
    subtotal: 1000,
    totalDiscount: 0,
    taxableAmount: 1000,
    totalCgst: 90,
    totalSgst: 90,
    totalIgst: 0,
    totalCess: 0,
    roundOff: 0,
    grandTotal: 1180,
    amountPaid: 1180,
    voucherId: "voucher-1",
    createdByUserId: "user-1",
    createdAt: new Date("2026-09-10T00:00:00.000Z"),
    updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    customer: {
      id: "cust-1",
      name: "Acme Traders",
      isActive: true,
      creditLimit: null,
      ledgerId: "ledger-1",
      gstin: "27AACCT3705E1Z0",
      addressLine1: "HSR Layout",
      addressLine2: null,
      city: "Bangalore",
      state: "Karnataka",
      pinCode: "560102",
    },
    salesOrder: null,
    deliveryChallan: null,
    items: [
      {
        id: "item-1",
        salesInvoiceId: "inv-1",
        lineNumber: 1,
        productId: "prod-1",
        warehouseId: "wh-1",
        quantity: 2,
        rate: 500,
        discountPercent: 0,
        discountAmount: 0,
        ratePercent: 18,
        cessPercent: 0,
        taxableAmount: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        cess: 0,
        totalAmount: 1180,
        isTaxOverridden: false,
        overriddenCgst: null,
        overriddenSgst: null,
        overriddenIgst: null,
        overriddenCess: null,
        overrideReason: null,
        overriddenByUserId: null,
        product: {
          id: "prod-1",
          name: "Widget",
          productCode: "WID-001",
          isActive: true,
          hsnCode: "8471",
          unitSymbol: "Nos",
        },
        warehouse: { id: "wh-1", name: "Main Warehouse", code: "MAIN", isActive: true },
      },
    ],
    payments: [
      {
        id: "pay-1",
        salesInvoiceId: "inv-1",
        ledgerId: "ledger-cash",
        paymentModeId: "mode-cash",
        amount: 1180,
        reference: null,
        ledger: { id: "ledger-cash", name: "Cash-in-Hand" },
        paymentMode: { id: "mode-cash", name: "Cash" },
      },
    ],
    ...overrides,
  };
}

function buildCompanyFixture(overrides: Partial<CompanyWithSettings> = {}): CompanyWithSettings {
  return {
    id: "company-1",
    companyName: "Surabhi Hardware Pvt Ltd",
    legalName: "Surabhi Hardware Private Limited",
    displayName: null,
    businessType: null,
    gstin: "29AACCT3705E1ZQ",
    pan: null,
    tan: null,
    cin: null,
    mobileNumber: null,
    alternateMobile: null,
    email: null,
    website: null,
    addressLine1: "HSR Layout",
    addressLine2: null,
    city: "Bangalore",
    state: "Karnataka",
    stateCode: "29",
    district: null,
    country: "India",
    pinCode: "560102",
    currency: "INR",
    currencySymbol: "₹",
    decimalPlaces: 2,
    logo: null,
    termsAndConditions: null,
    timeZone: "Asia/Kolkata",
    isActive: true,
    bootstrapVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    settings: null,
    ...overrides,
  } as CompanyWithSettings;
}

function buildBankAccountFixture(overrides: Partial<BankAccountWithLedger> = {}): BankAccountWithLedger {
  return {
    id: "bank-1",
    companyId: "company-1",
    ledgerId: "ledger-bank",
    bankName: "Axis Bank Ltd",
    accountNumber: "452414541254",
    ifscCode: "AXIS0125452",
    branchName: "Bhopal Main Branch",
    accountHolderName: "Surabhi Hardware Pvt Ltd",
    accountType: "CURRENT",
    upiId: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ledger: {
      id: "ledger-bank",
      name: "Axis Bank Ltd",
    } as BankAccountWithLedger["ledger"],
    ...overrides,
  } as BankAccountWithLedger;
}

function buildFixture(overrides: {
  salesInvoice?: Partial<SalesInvoiceDetail>;
  company?: Partial<CompanyWithSettings> | null;
  bankAccount?: Partial<BankAccountWithLedger> | null;
  logoDataUri?: string | null;
} = {}): SalesInvoicePdfData {
  return {
    salesInvoice: buildInvoiceFixture(overrides.salesInvoice),
    company: overrides.company === null ? null : buildCompanyFixture(overrides.company),
    bankAccount: overrides.bankAccount === null ? null : buildBankAccountFixture(overrides.bankAccount),
    logoDataUri: overrides.logoDataUri ?? null,
  };
}

describe("buildSalesInvoiceHtml", () => {
  it("renders the invoice number, seller, buyer, line item, and grand total", () => {
    const html = buildSalesInvoiceHtml(buildFixture());

    expect(html).toContain("INV/2026/0001");
    expect(html).toContain("Surabhi Hardware Pvt Ltd");
    expect(html).toContain("29AACCT3705E1ZQ");
    expect(html).toContain("Acme Traders");
    expect(html).toContain("27AACCT3705E1Z0");
    expect(html).toContain("Widget");
    expect(html).toContain("WID-001");
    expect(html).toContain("8471");
    expect(html).toContain("Nos");
    expect(html).toContain("1180.00");
  });

  it("renders the total quantity as the sum of the line items' own quantities", () => {
    const html = buildSalesInvoiceHtml(
      buildFixture({
        salesInvoice: {
          items: [
            { ...buildInvoiceFixture().items[0], quantity: 2 },
            { ...buildInvoiceFixture().items[0], id: "item-2", lineNumber: 2, quantity: 3 },
          ],
        },
      })
    );

    expect(html).toMatch(/qty-total-row[\s\S]*?5/);
  });

  it("renders the grand total in words", () => {
    const html = buildSalesInvoiceHtml(buildFixture());

    expect(html).toContain("Indian Rupee One Thousand One Hundred Eighty Only");
  });

  it("deliberately omits the Paid total row and Payments section — a Tax Invoice is not a payment receipt", () => {
    const html = buildSalesInvoiceHtml(buildFixture());

    expect(html).not.toContain("Paid");
    expect(html).not.toContain("Payments");
    expect(html).not.toContain("Cash-in-Hand");
  });

  it("falls back to the quick customer's own name/GSTIN/address when there is no linked customer", () => {
    const html = buildSalesInvoiceHtml(
      buildFixture({
        salesInvoice: {
          customer: null,
          customerMode: "QUICK",
          quickCustomerName: "Walk-in Buyer",
          quickCustomerGstin: "27AAAAA0000A1Z5",
          quickCustomerAddress: "MG Road, Pune",
        },
      })
    );

    expect(html).toContain("Walk-in Buyer");
    expect(html).toContain("27AAAAA0000A1Z5");
    expect(html).toContain("MG Road, Pune");
  });

  it("renders the bank details block when a bank account is given, and omits it when null", () => {
    const withBank = buildSalesInvoiceHtml(buildFixture());
    expect(withBank).toContain("Axis Bank Ltd");
    expect(withBank).toContain("452414541254");
    expect(withBank).toContain("AXIS0125452");

    const withoutBank = buildSalesInvoiceHtml(buildFixture({ bankAccount: null }));
    expect(withoutBank).not.toContain("Bank Details");
  });

  it("embeds the given logo data URI in an <img> tag when present, and omits the tag when null", () => {
    const withLogo = buildSalesInvoiceHtml(buildFixture({ logoDataUri: "data:image/png;base64,ZmFrZQ==" }));
    expect(withLogo).toContain('src="data:image/png;base64,ZmFrZQ=="');

    const withoutLogo = buildSalesInvoiceHtml(buildFixture({ logoDataUri: null }));
    expect(withoutLogo).not.toContain("<img");
  });

  it("degrades gracefully to a blank seller block when company is null, without throwing", () => {
    expect(() => buildSalesInvoiceHtml(buildFixture({ company: null }))).not.toThrow();
  });

  it("renders the company's own Terms & Conditions only when set, and never reads the invoice's own narration", () => {
    const withTerms = buildSalesInvoiceHtml(
      buildFixture({ company: { termsAndConditions: "Goods once sold will not be taken back." } })
    );
    expect(withTerms).toContain("Terms &amp; Conditions");
    expect(withTerms).toContain("Goods once sold will not be taken back.");

    const withoutTerms = buildSalesInvoiceHtml(buildFixture({ company: { termsAndConditions: null } }));
    expect(withoutTerms).not.toContain("Terms &amp; Conditions");

    // Setting narration but leaving termsAndConditions unset must render
    // nothing — narration is intentionally never read by this template.
    const narrationOnly = buildSalesInvoiceHtml(
      buildFixture({ salesInvoice: { narration: "Handle with care" }, company: { termsAndConditions: null } })
    );
    expect(narrationOnly).not.toContain("Handle with care");
  });

  it("sticks the totals-onward footer to the bottom of the page via a flex wrapper, and keeps the computer-generated-invoice footer note", () => {
    const html = buildSalesInvoiceHtml(buildFixture());

    expect(html).toContain('<div class="invoice-footer">');
    expect(html).toContain("This is a computer generated invoice.");
  });

  it("escapes user-entered text before embedding it in the HTML", () => {
    const html = buildSalesInvoiceHtml(
      buildFixture({ company: { termsAndConditions: "<script>alert('x')</script>" } })
    );

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("embeds the shared print stylesheet inline", () => {
    const html = buildSalesInvoiceHtml(buildFixture());

    expect(html).toContain("<style>");
  });
});
