import { beforeEach, describe, expect, it, vi } from "vitest";

const { getInwardSupplyLinesMock, getCurrentCompanyUserMock, assertPermissionMock } = vi.hoisted(() => ({
  getInwardSupplyLinesMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
}));

vi.mock("@/engines/gst/gst-engine", () => ({
  gstReportEngine: { getInwardSupplyLines: getInwardSupplyLinesMock },
}));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));

import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { gstr2Service } from "@/modules/gst/services/gstr2-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FROM = new Date("2026-04-01T00:00:00.000Z");
const TO = new Date("2026-04-30T00:00:00.000Z");

function purchaseInvoiceLine(overrides: Partial<GstSupplyLine>): GstSupplyLine {
  return {
    documentType: "PURCHASE_INVOICE",
    documentId: "pinv-1",
    documentNumber: "PINV-0001",
    documentDate: new Date("2026-04-05T00:00:00.000Z"),
    partyId: "supplier-1",
    partyName: "Acme Traders",
    partyGstin: "27AAAAA0000A1Z5",
    placeOfSupplyStateCode: "27",
    hsnCode: "3208",
    productId: "prod-1",
    quantity: 1,
    ratePercent: 18,
    cessPercent: 0,
    taxableAmount: 1000,
    cgst: 90,
    sgst: 90,
    igst: 0,
    cess: 0,
    totalAmount: 1180,
    ...overrides,
  };
}

beforeEach(() => {
  getInwardSupplyLinesMock.mockReset();
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Company Admin" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
});

describe("gstr2Service.getGstr2Return — Table 3 (registered supplies)", () => {
  it("groups a registered supplier's Purchase Invoice into its own invoice-wise row", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([purchaseInvoiceLine({})]);

    const result = await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    expect(result.registeredSupplies).toHaveLength(1);
    expect(result.registeredSupplies[0].documentId).toBe("pinv-1");
    expect(result.registeredSupplies[0].taxableAmount).toBe(1000);
    expect(result.registeredSuppliesCaveat).toContain("isReverseCharge");
  });

  it("excludes a no-GSTIN supplier's Purchase Invoice from Table 3 entirely", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([purchaseInvoiceLine({ partyGstin: null })]);

    const result = await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    expect(result.registeredSupplies).toHaveLength(0);
  });

  it("nets a registered Purchase Return's negative amount against Table 3's overall total (own row, own documentId)", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      purchaseInvoiceLine({}),
      purchaseInvoiceLine({
        documentType: "PURCHASE_RETURN",
        documentId: "pret-1",
        documentNumber: "PRET-0001",
        cgst: -90,
        sgst: -90,
        taxableAmount: -1000,
        totalAmount: -1180,
      }),
    ]);

    const result = await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    // A Purchase Return has its own documentId (its own return, not its
    // parent invoice), so it lands as its own row rather than merging into
    // the invoice's row — but the period's Table 3 TOTAL still nets to zero.
    expect(result.registeredSupplies).toHaveLength(2);
    const netTaxable = result.registeredSupplies.reduce((sum, group) => sum + group.taxableAmount, 0);
    const netTotal = result.registeredSupplies.reduce((sum, group) => sum + group.totalAmount, 0);
    expect(netTaxable).toBe(0);
    expect(netTotal).toBe(0);
  });

  it("sums multiple lines of the same document (multi-line invoice) into one Table 3 row", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      purchaseInvoiceLine({ taxableAmount: 1000, cgst: 90, sgst: 90, totalAmount: 1180 }),
      purchaseInvoiceLine({ taxableAmount: 500, cgst: 45, sgst: 45, totalAmount: 590 }),
    ]);

    const result = await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    expect(result.registeredSupplies).toHaveLength(1);
    expect(result.registeredSupplies[0].taxableAmount).toBe(1500);
    expect(result.registeredSupplies[0].totalAmount).toBe(1770);
  });
});

describe("gstr2Service.getGstr2Return — Table 7 (composition/exempt, consolidated by party)", () => {
  it("consolidates a no-GSTIN supplier's lines across multiple documents into one party row", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      purchaseInvoiceLine({ documentId: "pinv-a", partyId: "supplier-2", partyGstin: null, taxableAmount: 1000, totalAmount: 1180 }),
      purchaseInvoiceLine({ documentId: "pinv-b", partyId: "supplier-2", partyGstin: null, taxableAmount: 500, totalAmount: 590 }),
    ]);

    const result = await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    expect(result.compositionAndExemptSupplies).toHaveLength(1);
    expect(result.compositionAndExemptSupplies[0].taxableAmount).toBe(1500);
    expect(result.compositionAndExemptCaveat).toContain("composition");
  });

  it("routes a nil-rated line from a registered supplier into BOTH Table 3 and Table 7 (independent filters, unlike GSTR-1's mutually-exclusive nil-rated routing)", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      purchaseInvoiceLine({ partyGstin: "27AAAAA0000A1Z5", ratePercent: 0, cgst: 0, sgst: 0, taxableAmount: 500, totalAmount: 500 }),
    ]);

    const result = await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    // Business Rules: Table 3's filter is "partyGstin is present" (no rate
    // exclusion); Table 7's filter is "partyGstin is absent OR ratePercent
    // = 0" — applied independently, so a nil-rated registered-supplier line
    // satisfies both and appears in both tables.
    expect(result.compositionAndExemptSupplies).toHaveLength(1);
    expect(result.registeredSupplies).toHaveLength(1);
  });

  it("keeps two distinct no-GSTIN suppliers as two separate Table 7 rows", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      purchaseInvoiceLine({ documentId: "pinv-a", partyId: "supplier-2", partyName: "Small Trader A", partyGstin: null }),
      purchaseInvoiceLine({ documentId: "pinv-b", partyId: "supplier-3", partyName: "Small Trader B", partyGstin: null }),
    ]);

    const result = await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    expect(result.compositionAndExemptSupplies).toHaveLength(2);
  });
});

describe("gstr2Service.getGstr2Return — not-computed rows (Tables 4/5/8/9/11)", () => {
  it("always returns computed: false, amount: 0, and a non-empty reason for every not-tracked table", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([]);

    const result = await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    for (const row of [
      result.reverseChargeSupplies,
      result.importsOverseasOrSez,
      result.isdCredit,
      result.tdsTcsCredit,
      result.itcReversal,
    ]) {
      expect(row.computed).toBe(false);
      expect(row.amount).toBe(0);
      expect(row.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("gstr2Service.getGstr2Return — company scoping", () => {
  it("calls getInwardSupplyLines with the requesting user's own companyId", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([]);

    await gstr2Service.getGstr2Return({ from: FROM, to: TO });

    expect(getInwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "gst", "view");
  });
});

// No GstFilingRecord interaction anywhere in this service (grep-able,
// mirroring 58-gstr-1.md's own "advisory-only is a structural property" test
// convention) — this file's mocks cover every dependency gstr2-service.ts
// actually imports (gst-engine, current-user, permissions); no
// gst-filing-repository mock exists here because the service never imports
// it, and an unmocked import would fail this suite loudly if one were added.
