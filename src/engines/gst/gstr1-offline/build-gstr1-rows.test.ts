import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/app-error";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";

import { buildB2csRows, buildHsnB2cRows, roundMoney, type HsnProductInfo } from "./build-gstr1-rows";

function line(overrides: Partial<GstSupplyLine>): GstSupplyLine {
  return {
    documentType: "SALES_INVOICE",
    documentId: "inv-1",
    documentNumber: "INV-001",
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

const BOOK: HsnProductInfo = { hsnCode: "4901", codeType: "HSN", description: "Printed books", unitLabel: "NOS" };

describe("roundMoney", () => {
  it("rounds half-cent binary artefacts up to two decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.004)).toBe(10);
  });

  it("rounds a negative value symmetrically with its positive twin", () => {
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(-10.004)).toBe(-10);
    expect(roundMoney(0)).toBe(0);
  });
});

describe("buildB2csRows", () => {
  it("sums groups sharing a place of supply and rate into one OE row with the portal's state label", () => {
    const rows = buildB2csRows([
      { placeOfSupplyStateCode: "27", ratePercent: 5, taxableAmount: 100, cess: 1 },
      { placeOfSupplyStateCode: "27", ratePercent: 5, taxableAmount: 50.5, cess: 0.5 },
    ]);

    expect(rows).toEqual([{ type: "OE", placeOfSupply: "27-Maharashtra", ratePercent: 5, taxableValue: 150.5, cessAmount: 1.5 }]);
  });

  it("nets an unregistered credit note (negative group) against sales in the same state and rate", () => {
    const rows = buildB2csRows([
      { placeOfSupplyStateCode: "27", ratePercent: 12, taxableAmount: 1000, cess: 0 },
      { placeOfSupplyStateCode: "27", ratePercent: 12, taxableAmount: -200, cess: 0 },
    ]);

    expect(rows[0].taxableValue).toBe(800);
  });

  it("drops a row that nets to zero", () => {
    const rows = buildB2csRows([
      { placeOfSupplyStateCode: "27", ratePercent: 5, taxableAmount: 100, cess: 0 },
      { placeOfSupplyStateCode: "27", ratePercent: 5, taxableAmount: -100, cess: 0 },
    ]);

    expect(rows).toEqual([]);
  });

  it("skips rate-0 groups, which belong to the nil-rated table rather than Table 7", () => {
    const rows = buildB2csRows([{ placeOfSupplyStateCode: "27", ratePercent: 0, taxableAmount: 500, cess: 0 }]);

    expect(rows).toEqual([]);
  });

  it("keeps different states and rates as separate rows, sorted by state then rate", () => {
    const rows = buildB2csRows([
      { placeOfSupplyStateCode: "29", ratePercent: 5, taxableAmount: 10, cess: 0 },
      { placeOfSupplyStateCode: "27", ratePercent: 18, taxableAmount: 20, cess: 0 },
      { placeOfSupplyStateCode: "27", ratePercent: 5, taxableAmount: 30, cess: 0 },
    ]);

    expect(rows.map((row) => `${row.placeOfSupply}@${row.ratePercent}`)).toEqual(["27-Maharashtra@5", "27-Maharashtra@18", "29-Karnataka@5"]);
  });

  it("throws an AppError for a rate the portal does not list", () => {
    expect(() => buildB2csRows([{ placeOfSupplyStateCode: "27", ratePercent: 14, taxableAmount: 100, cess: 0 }])).toThrow(AppError);
  });

  it("throws an AppError for a state the portal does not list", () => {
    expect(() => buildB2csRows([{ placeOfSupplyStateCode: "99", ratePercent: 5, taxableAmount: 100, cess: 0 }])).toThrow(AppError);
  });
});

describe("buildHsnB2cRows", () => {
  const infoById = new Map<string, HsnProductInfo>([["prod-book", BOOK]]);

  it("groups lines by HSN and rate, summing quantity, values and tax, with the portal UQC label", () => {
    const { rows, productIdsWithoutHsn } = buildHsnB2cRows(
      [line({ quantity: 2 }), line({ documentId: "inv-2", quantity: 3, taxableAmount: 200, cgst: 5, sgst: 5, totalAmount: 210 })],
      infoById
    );

    expect(productIdsWithoutHsn).toEqual([]);
    expect(rows).toEqual([
      {
        hsnCode: "4901",
        description: "Printed books",
        uqc: "NOS-NUMBERS",
        totalQuantity: 5,
        totalValue: 315,
        ratePercent: 5,
        taxableValue: 300,
        integratedTax: 0,
        centralTax: 7.5,
        stateTax: 7.5,
        cess: 0,
      },
    ]);
  });

  it("nets a sales return (negative line) against sales of the same HSN and rate", () => {
    const { rows } = buildHsnB2cRows(
      [
        line({}),
        line({ documentType: "SALES_RETURN", documentId: "ret-1", quantity: -1, taxableAmount: -50, cgst: -1.25, sgst: -1.25, totalAmount: -52.5 }),
      ],
      infoById
    );

    expect(rows[0]).toMatchObject({ totalQuantity: 1, taxableValue: 50, totalValue: 52.5 });
  });

  it("splits the same HSN across rates into separate rows", () => {
    const { rows } = buildHsnB2cRows([line({ ratePercent: 5 }), line({ documentId: "inv-2", ratePercent: 12 })], infoById);

    expect(rows.map((row) => row.ratePercent)).toEqual([5, 12]);
  });

  it("leaves UQC and quantity blank for a service (SAC / HSN starting 99)", () => {
    const service: HsnProductInfo = { hsnCode: "998314", codeType: "SAC", description: "Consulting", unitLabel: "NOS" };
    const { rows } = buildHsnB2cRows([line({ productId: "prod-svc", quantity: 1 })], new Map([["prod-svc", service]]));

    expect(rows[0]).toMatchObject({ hsnCode: "998314", uqc: null, totalQuantity: null });
  });

  it("falls back to OTH-OTHERS when the unit has no recognised UQC code", () => {
    const odd: HsnProductInfo = { ...BOOK, unitLabel: "cartonish" };
    const { rows } = buildHsnB2cRows([line({})], new Map([["prod-book", odd]]));

    expect(rows[0].uqc).toBe("OTH-OTHERS");
  });

  it("reports products with no HSN instead of dropping or bucketing them", () => {
    const noHsn: HsnProductInfo = { hsnCode: null, codeType: null, description: null, unitLabel: "NOS" };
    const { rows, productIdsWithoutHsn } = buildHsnB2cRows([line({ productId: "prod-x" })], new Map([["prod-x", noHsn]]));

    expect(rows).toEqual([]);
    expect(productIdsWithoutHsn).toEqual(["prod-x"]);
  });

  it("ignores freeform note lines that carry no product or quantity", () => {
    const { rows, productIdsWithoutHsn } = buildHsnB2cRows([line({ documentType: "CREDIT_NOTE", productId: null, quantity: null })], infoById);

    expect(rows).toEqual([]);
    expect(productIdsWithoutHsn).toEqual([]);
  });

  it("drops a group that a return nets fully to zero", () => {
    const { rows } = buildHsnB2cRows(
      [
        line({}),
        line({ documentType: "SALES_RETURN", documentId: "ret-1", quantity: -2, taxableAmount: -100, cgst: -2.5, sgst: -2.5, totalAmount: -105 }),
      ],
      infoById
    );

    expect(rows).toEqual([]);
  });

  it("throws an AppError for a rate the portal does not list", () => {
    expect(() => buildHsnB2cRows([line({ ratePercent: 14 })], infoById)).toThrow(AppError);
  });
});
