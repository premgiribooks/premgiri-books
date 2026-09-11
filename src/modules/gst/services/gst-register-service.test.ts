import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOutwardSupplyLinesMock, getInwardSupplyLinesMock, getCurrentCompanyUserMock, assertPermissionMock } = vi.hoisted(
  () => ({
    getOutwardSupplyLinesMock: vi.fn(),
    getInwardSupplyLinesMock: vi.fn(),
    getCurrentCompanyUserMock: vi.fn(),
    assertPermissionMock: vi.fn(),
  })
);

vi.mock("@/engines/gst/gst-report-queries", () => ({
  getOutwardSupplyLines: getOutwardSupplyLinesMock,
  getInwardSupplyLines: getInwardSupplyLinesMock,
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));

import { gstRegisterService } from "@/modules/gst/services/gst-register-service";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FROM = new Date("2026-04-01T00:00:00.000Z");
const TO = new Date("2026-04-30T00:00:00.000Z");

function line(overrides: Partial<GstSupplyLine>): GstSupplyLine {
  return {
    documentType: "SALES_INVOICE",
    documentId: "doc-1",
    documentNumber: "INV-0001",
    documentDate: new Date("2026-04-05T00:00:00.000Z"),
    partyId: "party-1",
    partyName: "Acme",
    partyGstin: "27AAAAA0000A1Z5",
    placeOfSupplyStateCode: "27",
    hsnCode: "3208",
    productId: "prod-1",
    quantity: 1,
    ratePercent: 18,
    cessPercent: 0,
    taxableAmount: 100,
    cgst: 9,
    sgst: 9,
    igst: 0,
    cess: 0,
    totalAmount: 118,
    ...overrides,
  };
}

beforeEach(() => {
  getOutwardSupplyLinesMock.mockReset();
  getInwardSupplyLinesMock.mockReset();
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Accountant" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
});

describe("gstRegisterService.getOutwardRegister", () => {
  it("gates on the gst/view permission before returning data", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([]);

    await gstRegisterService.getOutwardRegister({ from: FROM, to: TO });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_ID }), "gst", "view");
    expect(getOutwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
  });

  it("sums taxable/tax/total across every filtered line for the running period total", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ taxableAmount: 100, cgst: 9, sgst: 9, totalAmount: 118 }),
      line({ taxableAmount: -40, cgst: -3.6, sgst: -3.6, totalAmount: -47.2 }),
    ]);

    const result = await gstRegisterService.getOutwardRegister({ from: FROM, to: TO });

    expect(result.totals.taxableAmount).toBe(60);
    expect(result.totals.cgst).toBeCloseTo(5.4);
    expect(result.totals.totalAmount).toBeCloseTo(70.8);
    expect(result.totalCount).toBe(2);
  });

  it("filters by partyId, hsnCode, and ratePercent independently", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "a", partyId: "party-1", hsnCode: "3208", ratePercent: 18 }),
      line({ documentId: "b", partyId: "party-2", hsnCode: "3208", ratePercent: 18 }),
      line({ documentId: "c", partyId: "party-1", hsnCode: "9999", ratePercent: 18 }),
      line({ documentId: "d", partyId: "party-1", hsnCode: "3208", ratePercent: 5 }),
    ]);

    const byParty = await gstRegisterService.getOutwardRegister({ from: FROM, to: TO, partyId: "party-1" });
    expect(byParty.lines.map((l) => l.documentId).sort()).toEqual(["a", "c", "d"]);

    const byHsn = await gstRegisterService.getOutwardRegister({ from: FROM, to: TO, hsnCode: "3208" });
    expect(byHsn.lines.map((l) => l.documentId).sort()).toEqual(["a", "b", "d"]);

    const byRate = await gstRegisterService.getOutwardRegister({ from: FROM, to: TO, ratePercent: 5 });
    expect(byRate.lines.map((l) => l.documentId)).toEqual(["d"]);
  });

  it("totals reflect the full filtered set, independent of the current page", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "1", taxableAmount: 10, totalAmount: 10 }),
      line({ documentId: "2", taxableAmount: 20, totalAmount: 20 }),
      line({ documentId: "3", taxableAmount: 30, totalAmount: 30 }),
    ]);

    const result = await gstRegisterService.getOutwardRegister({ from: FROM, to: TO, page: 1, pageSize: 2 });

    expect(result.lines).toHaveLength(2);
    expect(result.totalCount).toBe(3);
    expect(result.totals.taxableAmount).toBe(60);
  });

  it("paginates using the requested page and pageSize", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "1" }),
      line({ documentId: "2" }),
      line({ documentId: "3" }),
    ]);

    const result = await gstRegisterService.getOutwardRegister({ from: FROM, to: TO, page: 2, pageSize: 2 });

    expect(result.lines.map((l) => l.documentId)).toEqual(["3"]);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
  });
});

describe("gstRegisterService.getInwardRegister", () => {
  it("delegates to getInwardSupplyLines, gated on gst/view", async () => {
    getInwardSupplyLinesMock.mockResolvedValue([line({ documentType: "PURCHASE_INVOICE" })]);

    const result = await gstRegisterService.getInwardRegister({ from: FROM, to: TO });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "gst", "view");
    expect(getInwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
    expect(result.lines).toHaveLength(1);
  });
});
