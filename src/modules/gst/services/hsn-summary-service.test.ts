import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOutwardSupplyLinesMock, getCurrentCompanyUserMock, assertPermissionMock, productFindManyMock } = vi.hoisted(() => ({
  getOutwardSupplyLinesMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  productFindManyMock: vi.fn(),
}));

vi.mock("@/engines/gst/gst-engine", () => ({
  gstReportEngine: { getOutwardSupplyLines: getOutwardSupplyLinesMock },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { product: { findMany: productFindManyMock } },
}));

import { hsnSummaryService } from "@/modules/gst/services/hsn-summary-service";
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

interface ProductFixture {
  id: string;
  unit: { uqcCode: string | null; symbol: string };
  hsnCode: { code: string; codeType: "HSN" | "SAC"; description: string } | null;
}

function product(overrides: Partial<ProductFixture> & { id: string }): ProductFixture {
  return {
    unit: { uqcCode: "PCS", symbol: "Pcs" },
    hsnCode: { code: "3208", codeType: "HSN", description: "Paints and varnishes" },
    ...overrides,
  };
}

beforeEach(() => {
  getOutwardSupplyLinesMock.mockReset();
  productFindManyMock.mockReset().mockResolvedValue([]);
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: COMPANY_ID, role: "Accountant" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
});

describe("hsnSummaryService.getHsnSummary", () => {
  it("gates on the gst/view permission before returning data", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([]);

    await hsnSummaryService.getHsnSummary({ from: FROM, to: TO });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.objectContaining({ companyId: COMPANY_ID }), "gst", "view");
    expect(getOutwardSupplyLinesMock).toHaveBeenCalledWith(COMPANY_ID, FROM, TO);
  });

  it("groups two products sharing one HSN code and rate into a single row, and the same HSN at a different rate into a separate row", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "a", productId: "prod-1", hsnCode: "3208", ratePercent: 18, quantity: 10, taxableAmount: 1000 }),
      line({ documentId: "b", productId: "prod-2", hsnCode: "3208", ratePercent: 18, quantity: 5, taxableAmount: 500 }),
      line({ documentId: "c", productId: "prod-3", hsnCode: "3208", ratePercent: 5, quantity: 2, taxableAmount: 200 }),
    ]);
    productFindManyMock.mockResolvedValue([
      product({ id: "prod-1" }),
      product({ id: "prod-2" }),
      product({ id: "prod-3", hsnCode: { code: "3208", codeType: "HSN", description: "Paints and varnishes" } }),
    ]);

    const result = await hsnSummaryService.getHsnSummary({ from: FROM, to: TO });

    expect(result.rows).toHaveLength(2);
    const rate18 = result.rows.find((row) => row.ratePercent === 18);
    const rate5 = result.rows.find((row) => row.ratePercent === 5);
    expect(rate18?.quantity).toBe(15);
    expect(rate18?.taxableAmount).toBe(1500);
    expect(rate5?.quantity).toBe(2);
    expect(rate5?.taxableAmount).toBe(200);
  });

  it("nets a Sales Return's signed negative quantity/taxable amount into its HSN group's total", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "inv-1", documentType: "SALES_INVOICE", productId: "prod-1", quantity: 10, taxableAmount: 1000 }),
      line({
        documentId: "ret-1",
        documentType: "SALES_RETURN",
        productId: "prod-1",
        quantity: -4,
        taxableAmount: -400,
        cgst: -36,
        sgst: -36,
        totalAmount: -472,
      }),
    ]);
    productFindManyMock.mockResolvedValue([product({ id: "prod-1" })]);

    const result = await hsnSummaryService.getHsnSummary({ from: FROM, to: TO });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].quantity).toBe(6);
    expect(result.rows[0].taxableAmount).toBe(600);
  });

  it("flags a group as mixed-unit only when it sums quantities from more than one distinct Unit", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "a", productId: "prod-1", ratePercent: 18 }),
      line({ documentId: "b", productId: "prod-2", ratePercent: 18 }),
    ]);

    productFindManyMock.mockResolvedValueOnce([
      product({ id: "prod-1", unit: { uqcCode: "PCS", symbol: "Pcs" } }),
      product({ id: "prod-2", unit: { uqcCode: "KG", symbol: "Kg" } }),
    ]);
    const mixed = await hsnSummaryService.getHsnSummary({ from: FROM, to: TO });
    expect(mixed.rows).toHaveLength(1);
    expect(mixed.rows[0].isMixedUnit).toBe(true);
    expect(mixed.rows[0].uqcCode).toBe("PCS");

    productFindManyMock.mockResolvedValueOnce([
      product({ id: "prod-1", unit: { uqcCode: "PCS", symbol: "Pcs" } }),
      product({ id: "prod-2", unit: { uqcCode: "PCS", symbol: "Pcs" } }),
    ]);
    const uniform = await hsnSummaryService.getHsnSummary({ from: FROM, to: TO });
    expect(uniform.rows).toHaveLength(1);
    expect(uniform.rows[0].isMixedUnit).toBe(false);
  });

  it("buckets a product-bearing line whose product has no hsnCodeId under 'No HSN Assigned', and excludes Credit/Debit Note lines from the grouped output entirely", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([
      line({ documentId: "assigned", productId: "prod-1", hsnCode: "3208", taxableAmount: 1000, quantity: 10 }),
      line({ documentId: "unassigned", productId: "prod-2", hsnCode: null, taxableAmount: 300, quantity: 3 }),
      line({
        documentId: "cn-1",
        documentType: "CREDIT_NOTE",
        productId: null,
        quantity: null,
        hsnCode: null,
        taxableAmount: -999,
        cgst: -90,
        sgst: -90,
        totalAmount: -1179,
      }),
      line({
        documentId: "dn-1",
        documentType: "DEBIT_NOTE",
        productId: null,
        quantity: null,
        hsnCode: null,
        taxableAmount: 500,
        totalAmount: 590,
      }),
    ]);
    productFindManyMock.mockResolvedValue([
      product({ id: "prod-1", hsnCode: { code: "3208", codeType: "HSN", description: "Paints and varnishes" } }),
      product({ id: "prod-2", hsnCode: null }),
    ]);

    const result = await hsnSummaryService.getHsnSummary({ from: FROM, to: TO });

    expect(result.rows).toHaveLength(2);
    const assignedRow = result.rows.find((row) => row.hsnCode === "3208");
    const unassignedRow = result.rows.find((row) => row.hsnCode === null);
    expect(assignedRow?.quantity).toBe(10);
    expect(unassignedRow).toBeDefined();
    expect(unassignedRow?.quantity).toBe(3);
    expect(unassignedRow?.taxableAmount).toBe(300);
    // No third row/leakage for the excluded Credit/Debit Note taxable amounts.
    const totalTaxable = result.rows.reduce((sum, row) => sum + row.taxableAmount, 0);
    expect(totalTaxable).toBe(1300);
    // "No HSN Assigned" always renders last.
    expect(result.rows[result.rows.length - 1].hsnCode).toBeNull();
  });

  it("scopes the batched product lookup to the current company (cross-company isolation)", async () => {
    getOutwardSupplyLinesMock.mockResolvedValue([line({ productId: "prod-1" })]);
    productFindManyMock.mockResolvedValue([product({ id: "prod-1" })]);

    await hsnSummaryService.getHsnSummary({ from: FROM, to: TO });

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_ID }) })
    );
  });
});
