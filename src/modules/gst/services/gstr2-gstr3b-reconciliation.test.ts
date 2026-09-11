import { beforeEach, describe, expect, it, vi } from "vitest";

// A dedicated cross-service test file (rather than folding this into
// gstr2-service.test.ts) since exercising gstr3bService requires mocking its
// own additional dependencies (current-financial-year, prisma, gst-filing-
// repository) that gstr2Service itself never touches — mirrors
// gstr3b-service.test.ts's own cross-check against gstr1Service (82-gstr-2.md
// Code Standards: "an explicit cross-check test against spec 59's own
// service output, not just an independently-asserted number").
const {
  getInwardSupplyLinesMock,
  getOutwardSupplyLinesMock,
  determineSupplyTypeMock,
  isValidGstStateCodeMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  companyFindUniqueMock,
} = vi.hoisted(() => ({
  getInwardSupplyLinesMock: vi.fn(),
  getOutwardSupplyLinesMock: vi.fn(),
  determineSupplyTypeMock: vi.fn(),
  isValidGstStateCodeMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  companyFindUniqueMock: vi.fn(),
}));

vi.mock("@/engines/gst/gst-engine", () => ({
  gstReportEngine: { getInwardSupplyLines: getInwardSupplyLinesMock, getOutwardSupplyLines: getOutwardSupplyLinesMock },
  determineSupplyType: determineSupplyTypeMock,
  isValidGstStateCode: isValidGstStateCodeMock,
}));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({ prisma: { company: { findUnique: companyFindUniqueMock } } }));
vi.mock("@/modules/gst/repositories/gst-filing-repository", () => ({
  gstFilingRepository: { findOne: vi.fn(), findById: vi.fn(), upsert: vi.fn() },
}));

import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { gstr2Service } from "@/modules/gst/services/gstr2-service";
import { gstr3bService } from "@/modules/gst/services/gstr3b-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FROM = new Date("2026-04-01T00:00:00.000Z");
const TO = new Date("2026-04-30T00:00:00.000Z");

function registeredPurchaseInvoiceLine(overrides: Partial<GstSupplyLine>): GstSupplyLine {
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
  getOutwardSupplyLinesMock.mockReset().mockResolvedValue([]);
  determineSupplyTypeMock.mockReset();
  isValidGstStateCodeMock.mockReset();
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Company Admin" });
  getCurrentFinancialYearMock.mockReset().mockResolvedValue({ id: "fy-1" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
  companyFindUniqueMock.mockReset().mockResolvedValue(null);
});

describe("gstr2Service.getGstr2Return — Table 3 reconciles with gstr3bService's Table 4(A)(5)", () => {
  it("sums to the same cgst/sgst/igst/cess totals as GSTR-3B's (A)(5) all-other-ITC row, for a period whose every inward line is from a registered supplier", async () => {
    // Precondition (spec's own Success Criteria scope): every posted inward
    // line here has partyGstin present, so Table 7 is empty and Table 3
    // alone captures the full getInwardSupplyLines total — the same total
    // gstr3bService's (A)(5) sums unconditionally over all inward lines.
    const lines = [
      registeredPurchaseInvoiceLine({}),
      registeredPurchaseInvoiceLine({
        documentId: "pinv-2",
        taxableAmount: 500,
        cgst: 45,
        sgst: 45,
        totalAmount: 590,
      }),
      registeredPurchaseInvoiceLine({
        documentType: "PURCHASE_RETURN",
        documentId: "pret-1",
        documentNumber: "PRET-0001",
        cgst: -90,
        sgst: -90,
        taxableAmount: -1000,
        totalAmount: -1180,
      }),
    ];
    getInwardSupplyLinesMock.mockResolvedValue(lines);

    const [gstr2Result, gstr3bResult] = await Promise.all([
      gstr2Service.getGstr2Return({ from: FROM, to: TO }),
      gstr3bService.getGstr3BReturn({ from: FROM, to: TO }),
    ]);

    // Sanity: Table 7 is empty (no unregistered/nil-rated lines in this fixture).
    expect(gstr2Result.compositionAndExemptSupplies).toHaveLength(0);

    const table3Totals = gstr2Result.registeredSupplies.reduce(
      (totals, group) => ({
        cgst: totals.cgst + group.cgst,
        sgst: totals.sgst + group.sgst,
        igst: totals.igst + group.igst,
        cess: totals.cess + group.cess,
      }),
      { cgst: 0, sgst: 0, igst: 0, cess: 0 }
    );

    expect(table3Totals).toEqual({
      cgst: gstr3bResult.eligibleItc.allOtherItc.cgst,
      sgst: gstr3bResult.eligibleItc.allOtherItc.sgst,
      igst: gstr3bResult.eligibleItc.allOtherItc.igst,
      cess: gstr3bResult.eligibleItc.allOtherItc.cess,
    });
    expect(table3Totals.cgst).toBe(45);
    expect(table3Totals.sgst).toBe(45);
  });
});
