import { beforeEach, describe, expect, it, vi } from "vitest";

// A dedicated cross-service test file (rather than folding this into
// itc-register-service.test.ts), mirroring gstr2-gstr3b-reconciliation.test.ts's
// own precedent — exercising gstr3bService requires mocking its own additional
// dependencies (current-financial-year, prisma, gst-filing-repository) that
// itcRegisterService itself never touches (83-itc-register.md Code Standards:
// "an explicit cross-check test against spec 59's own service output, not
// just an independently-asserted number").
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
import { gstr3bService } from "@/modules/gst/services/gstr3b-service";
import { itcRegisterService } from "@/modules/gst/services/itc-register-service";

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
  getOutwardSupplyLinesMock.mockReset().mockResolvedValue([]);
  determineSupplyTypeMock.mockReset();
  isValidGstStateCodeMock.mockReset();
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Company Admin" });
  getCurrentFinancialYearMock.mockReset().mockResolvedValue({ id: "fy-1" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
  companyFindUniqueMock.mockReset().mockResolvedValue(null);
});

describe("itcRegisterService.getItcRegister — reconciles with gstr3bService's Table 4(A)(5)", () => {
  it("sums to the same cgst/sgst/igst/cess totals as GSTR-3B's (A)(5) all-other-ITC row, across multiple suppliers/rates/HSN codes and a Purchase Return", async () => {
    const lines = [
      purchaseInvoiceLine({}),
      purchaseInvoiceLine({
        documentId: "pinv-2",
        partyId: "supplier-2",
        partyName: "Beta Supplies",
        hsnCode: "7318",
        ratePercent: 5,
        taxableAmount: 500,
        cgst: 12.5,
        sgst: 12.5,
        totalAmount: 525,
      }),
      purchaseInvoiceLine({
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

    const [itcRegisterResult, gstr3bResult] = await Promise.all([
      itcRegisterService.getItcRegister({ from: FROM, to: TO }),
      gstr3bService.getGstr3BReturn({ from: FROM, to: TO }),
    ]);

    expect(itcRegisterResult.totals.cgst).toBe(gstr3bResult.eligibleItc.allOtherItc.cgst);
    expect(itcRegisterResult.totals.sgst).toBe(gstr3bResult.eligibleItc.allOtherItc.sgst);
    expect(itcRegisterResult.totals.igst).toBe(gstr3bResult.eligibleItc.allOtherItc.igst);
    expect(itcRegisterResult.totals.cess).toBe(gstr3bResult.eligibleItc.allOtherItc.cess);
    expect(itcRegisterResult.totals.cgst).toBe(12.5);
    expect(itcRegisterResult.totals.sgst).toBe(12.5);

    // The rate-wise summary's own sum must equal the same figure, not just the top-level totals field.
    const rateWiseSum = itcRegisterResult.rateWise.reduce(
      (sum, group) => ({ cgst: sum.cgst + group.cgst, sgst: sum.sgst + group.sgst, igst: sum.igst + group.igst, cess: sum.cess + group.cess }),
      { cgst: 0, sgst: 0, igst: 0, cess: 0 }
    );
    expect(rateWiseSum.cgst).toBe(gstr3bResult.eligibleItc.allOtherItc.cgst);
  });
});
