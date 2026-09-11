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
import { itcRegisterService } from "@/modules/gst/services/itc-register-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FROM = new Date("2026-04-01T00:00:00.000Z");
const TO = new Date("2026-04-30T00:00:00.000Z");

function line(overrides: Partial<GstSupplyLine>): GstSupplyLine {
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
    quantity: 10,
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
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Accountant" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
});

describe("itcRegisterService.getItcRegister", () => {
  it("gates on the gst/view permission before returning data", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([]);

    await itcRegisterService.getItcRegister({ from: FROM, to: TO });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_ID }), "gst", "view");
    expect(getInwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
  });

  it("groups a multi-supplier, multi-rate, multi-HSN fixture correctly across rate-wise/party-wise/HSN-wise summaries", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "a", partyId: "supplier-1", partyName: "Acme Traders", hsnCode: "3208", ratePercent: 18, taxableAmount: 1000, cgst: 90, sgst: 90 }),
      line({
        documentId: "b",
        partyId: "supplier-2",
        partyName: "Beta Supplies",
        hsnCode: "3208",
        ratePercent: 18,
        taxableAmount: 500,
        cgst: 45,
        sgst: 45,
        totalAmount: 590,
      }),
      line({
        documentId: "c",
        partyId: "supplier-1",
        partyName: "Acme Traders",
        hsnCode: "7318",
        ratePercent: 5,
        taxableAmount: 200,
        cgst: 5,
        sgst: 5,
        totalAmount: 210,
      }),
    ]);

    const result = await itcRegisterService.getItcRegister({ from: FROM, to: TO });

    expect(result.rateWise).toHaveLength(2);
    const rate18 = result.rateWise.find((group) => group.ratePercent === 18);
    const rate5 = result.rateWise.find((group) => group.ratePercent === 5);
    expect(rate18?.taxableAmount).toBe(1500);
    expect(rate5?.taxableAmount).toBe(200);

    expect(result.partyWise).toHaveLength(2);
    const acme = result.partyWise.find((group) => group.partyId === "supplier-1");
    const beta = result.partyWise.find((group) => group.partyId === "supplier-2");
    expect(acme?.taxableAmount).toBe(1200);
    expect(acme?.cgst).toBe(95);
    expect(beta?.taxableAmount).toBe(500);

    expect(result.hsnWise).toHaveLength(2);
    const hsn3208 = result.hsnWise.find((group) => group.hsnCode === "3208");
    const hsn7318 = result.hsnWise.find((group) => group.hsnCode === "7318");
    expect(hsn3208?.taxableAmount).toBe(1500);
    expect(hsn7318?.taxableAmount).toBe(200);
  });

  it("sorts party-wise groups by total ITC (cgst+sgst+igst+cess) descending", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "small", partyId: "supplier-small", partyName: "Small Supplier", taxableAmount: 100, cgst: 9, sgst: 9, totalAmount: 118 }),
      line({ documentId: "large", partyId: "supplier-large", partyName: "Large Supplier", taxableAmount: 5000, cgst: 450, sgst: 450, totalAmount: 5900 }),
    ]);

    const result = await itcRegisterService.getItcRegister({ from: FROM, to: TO });

    expect(result.partyWise.map((group) => group.partyId)).toEqual(["supplier-large", "supplier-small"]);
  });

  it("a Purchase Return correctly nets its parent invoice's rate-wise/party-wise/HSN-wise group totals down", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "pinv-1", documentType: "PURCHASE_INVOICE", partyId: "supplier-1", hsnCode: "3208", ratePercent: 18, taxableAmount: 1000, cgst: 90, sgst: 90, totalAmount: 1180 }),
      line({
        documentId: "pret-1",
        documentType: "PURCHASE_RETURN",
        documentNumber: "PRET-0001",
        partyId: "supplier-1",
        hsnCode: "3208",
        ratePercent: 18,
        taxableAmount: -400,
        cgst: -36,
        sgst: -36,
        totalAmount: -472,
      }),
    ]);

    const result = await itcRegisterService.getItcRegister({ from: FROM, to: TO });

    expect(result.rateWise).toHaveLength(1);
    expect(result.rateWise[0].taxableAmount).toBe(600);
    expect(result.partyWise).toHaveLength(1);
    expect(result.partyWise[0].taxableAmount).toBe(600);
    expect(result.hsnWise).toHaveLength(1);
    expect(result.hsnWise[0].taxableAmount).toBe(600);
    expect(result.totals.taxableAmount).toBe(600);
  });

  it("buckets a line whose product has no hsnCodeId under 'No HSN Assigned', rendered last", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "assigned", hsnCode: "3208", taxableAmount: 1000 }),
      line({ documentId: "unassigned", hsnCode: null, taxableAmount: 300 }),
    ]);

    const result = await itcRegisterService.getItcRegister({ from: FROM, to: TO });

    expect(result.hsnWise).toHaveLength(2);
    expect(result.hsnWise[result.hsnWise.length - 1].hsnCode).toBeNull();
    expect(result.hsnWise[result.hsnWise.length - 1].taxableAmount).toBe(300);
  });

  it("applies the optional partyId/hsnCode/ratePercent filters before grouping and totaling", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "match", partyId: "supplier-1", hsnCode: "3208", ratePercent: 18, taxableAmount: 1000 }),
      line({ documentId: "other-supplier", partyId: "supplier-2", partyName: "Other", hsnCode: "3208", ratePercent: 18, taxableAmount: 500 }),
    ]);

    const result = await itcRegisterService.getItcRegister({ from: FROM, to: TO, partyId: "supplier-1" });

    expect(result.lines).toHaveLength(1);
    expect(result.totals.taxableAmount).toBe(1000);
  });

  it("scopes the underlying supply-line query to the current user's own company (cross-company isolation)", async () => {
    const otherCompanyId = "22222222-2222-4222-8222-222222222222";
    getCurrentCompanyUserMock.mockResolvedValueOnce({ id: "u2", companyId: otherCompanyId, role: "Accountant" });
    getInwardSupplyLinesMock.mockResolvedValue([line({})]);

    await itcRegisterService.getItcRegister({ from: FROM, to: TO });

    expect(getInwardSupplyLinesMock).toHaveBeenCalledWith(otherCompanyId, FROM, TO);
    expect(getInwardSupplyLinesMock).not.toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
  });
});
