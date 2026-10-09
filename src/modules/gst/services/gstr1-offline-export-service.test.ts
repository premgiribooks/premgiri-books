import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOutwardSupplyLinesMock,
  getIssuedOutwardDocumentsMock,
  getDraftSalesInvoiceNumbersMock,
  getCurrentCompanyUserMock,
  assertPermissionMock,
  loadProductInfoMock,
  productFindManyMock,
} = vi.hoisted(() => ({
  getOutwardSupplyLinesMock: vi.fn(),
  getIssuedOutwardDocumentsMock: vi.fn(),
  getDraftSalesInvoiceNumbersMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  loadProductInfoMock: vi.fn(),
  productFindManyMock: vi.fn(),
}));

vi.mock("@/engines/gst/gst-engine", () => ({
  gstReportEngine: {
    getOutwardSupplyLines: getOutwardSupplyLinesMock,
    getIssuedOutwardDocuments: getIssuedOutwardDocumentsMock,
    getDraftSalesInvoiceNumbers: getDraftSalesInvoiceNumbersMock,
  },
}));
vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({ prisma: { product: { findMany: productFindManyMock } } }));
vi.mock("@/modules/gst/repositories/gst-filing-repository", () => ({ gstFilingRepository: {} }));
vi.mock("@/modules/gst/services/hsn-summary-service", () => ({ loadProductInfo: loadProductInfoMock }));

import { AppError } from "@/lib/app-error";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { gstr1OfflineExportService } from "@/modules/gst/services/gstr1-offline-export-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const FROM = new Date("2026-04-01T00:00:00.000Z");
const TO = new Date("2026-04-30T00:00:00.000Z");

function salesLine(overrides: Partial<GstSupplyLine>): GstSupplyLine {
  return {
    documentType: "SALES_INVOICE",
    documentId: "inv-1",
    documentNumber: "PBD-2627-INV-001",
    documentDate: new Date("2026-04-05T00:00:00.000Z"),
    partyId: null,
    partyName: "Walk-in Customer",
    partyGstin: null,
    placeOfSupplyStateCode: "27",
    hsnCode: "4901",
    productId: "prod-book",
    quantity: 2,
    ratePercent: 5,
    cessPercent: 0,
    taxableAmount: 100,
    cgst: 2.5,
    sgst: 2.5,
    igst: 0,
    cess: 0,
    totalAmount: 105,
    ...overrides,
  };
}

const BOOK_INFO = { hsnCode: "4901", codeType: "HSN", description: "Printed books", unitLabel: "NOS" };

beforeEach(() => {
  getOutwardSupplyLinesMock.mockReset().mockResolvedValue([]);
  getIssuedOutwardDocumentsMock.mockReset().mockResolvedValue([]);
  getDraftSalesInvoiceNumbersMock.mockReset().mockResolvedValue([]);
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
  loadProductInfoMock.mockReset().mockResolvedValue(new Map([["prod-book", BOOK_INFO]]));
  productFindManyMock.mockReset().mockResolvedValue([]);
});

describe("gstr1OfflineExportService.getOfflineExport — access and guards", () => {
  it("requires gst/view for the session user's company", async () => {
    await gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_ID }), "gst", "view");
  });

  it("propagates a permission denial and reads no data", async () => {
    assertPermissionMock.mockRejectedValue(new Error("denied"));

    await expect(gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO })).rejects.toThrow("denied");
    expect(getOutwardSupplyLinesMock).not.toHaveBeenCalled();
  });

  it("only ever queries the session user's company, never a caller-supplied id", async () => {
    await gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO });

    expect(getOutwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
    expect(getIssuedOutwardDocumentsMock).toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
    expect(getDraftSalesInvoiceNumbersMock).toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
  });

  it("rejects a period longer than one quarter", async () => {
    await expect(
      gstr1OfflineExportService.getOfflineExport({ from: new Date("2026-04-01T00:00:00.000Z"), to: new Date("2026-07-31T00:00:00.000Z") })
    ).rejects.toThrow(AppError);
    expect(getOutwardSupplyLinesMock).not.toHaveBeenCalled();
  });

  it("accepts a full quarter", async () => {
    await expect(
      gstr1OfflineExportService.getOfflineExport({ from: new Date("2026-04-01T00:00:00.000Z"), to: new Date("2026-06-30T00:00:00.000Z") })
    ).resolves.toBeDefined();
  });

  it("refuses to export while draft invoices exist in the period, naming them", async () => {
    getDraftSalesInvoiceNumbersMock.mockResolvedValue(["PBD-2627-INV-004", "PBD-2627-INV-007"]);

    await expect(gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO })).rejects.toThrow(/PBD-2627-INV-004, PBD-2627-INV-007/);
    expect(getOutwardSupplyLinesMock).not.toHaveBeenCalled();
  });

  it("summarises a long draft list as 'and N more'", async () => {
    getDraftSalesInvoiceNumbersMock.mockResolvedValue(Array.from({ length: 13 }, (_, i) => `INV-${i + 1}`));

    await expect(gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO })).rejects.toThrow(/and 3 more/);
  });
});

describe("gstr1OfflineExportService.getOfflineExport — sheets", () => {
  it("builds b2cs from unregistered small-B2C sales, excluding registered (B2B) customers", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesLine({}),
      salesLine({ documentId: "inv-b2b", partyGstin: "27AAAAA0000A1Z5", taxableAmount: 9999 }),
    ]);

    const { b2cs } = await gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO });

    expect(b2cs).toEqual([{ type: "OE", placeOfSupply: "27-Maharashtra", ratePercent: 5, taxableValue: 100, cessAmount: 0 }]);
  });

  it("leaves a large inter-state B2C invoice out of b2cs but keeps it in hsn(b2c)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesLine({
        documentId: "inv-large",
        placeOfSupplyStateCode: "29",
        igst: 27000,
        cgst: 0,
        sgst: 0,
        taxableAmount: 150000,
        totalAmount: 177000,
        ratePercent: 18,
      }),
    ]);

    const { b2cs, hsnB2c } = await gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO });

    expect(b2cs).toEqual([]);
    expect(hsnB2c).toHaveLength(1);
    expect(hsnB2c[0]).toMatchObject({ hsnCode: "4901", ratePercent: 18, taxableValue: 150000, integratedTax: 27000 });
  });

  it("nets an unregistered credit note into b2cs but not into hsn(b2c)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      salesLine({}),
      salesLine({
        documentType: "CREDIT_NOTE",
        documentId: "cn-1",
        productId: null,
        quantity: null,
        hsnCode: null,
        taxableAmount: -40,
        cgst: -1,
        sgst: -1,
        totalAmount: -42,
      }),
    ]);

    const { b2cs, hsnB2c } = await gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO });

    expect(b2cs[0].taxableValue).toBe(60);
    expect(hsnB2c[0]).toMatchObject({ taxableValue: 100, totalQuantity: 2 });
  });

  it("excludes registered customers' lines from hsn(b2c)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([salesLine({ partyGstin: "27AAAAA0000A1Z5" })]);

    const { hsnB2c } = await gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO });

    expect(hsnB2c).toEqual([]);
    expect(loadProductInfoMock).toHaveBeenCalledWith(COMPANY_ID, []);
  });

  it("looks up product HSN/UQC once, scoped to the session company", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([salesLine({}), salesLine({ documentId: "inv-2" })]);

    await gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO });

    expect(loadProductInfoMock).toHaveBeenCalledTimes(1);
    expect(loadProductInfoMock).toHaveBeenCalledWith(COMPANY_ID, ["prod-book"]);
  });

  it("fails naming the products when a sold product has no HSN code", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([salesLine({ productId: "prod-x" })]);
    loadProductInfoMock.mockResolvedValue(new Map([["prod-x", { hsnCode: null, codeType: null, description: null, unitLabel: "NOS" }]]));
    productFindManyMock.mockResolvedValue([{ name: "Mystery Item" }]);

    await expect(gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO })).rejects.toThrow(/Mystery Item/);
    expect(productFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: COMPANY_ID, id: { in: ["prod-x"] } } }));
  });

  it("summarises issued documents into docs rows", async () => {
    getIssuedOutwardDocumentsMock.mockResolvedValue([
      { documentType: "SALES_INVOICE", documentNumber: "PBD-2627-INV-001", isCancelled: false },
      { documentType: "SALES_INVOICE", documentNumber: "PBD-2627-INV-002", isCancelled: true },
    ]);

    const { docs } = await gstr1OfflineExportService.getOfflineExport({ from: FROM, to: TO });

    expect(docs).toEqual([
      { nature: "Invoices for outward supply", srNoFrom: "PBD-2627-INV-001", srNoTo: "PBD-2627-INV-002", totalNumber: 2, cancelled: 1 },
    ]);
  });
});
