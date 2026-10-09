import { describe, expect, it } from "vitest";

import { buildDocumentSeriesRows, type IssuedDocument } from "./documents-issued";

function invoice(number: string, isCancelled = false): IssuedDocument {
  return { documentType: "SALES_INVOICE", documentNumber: number, isCancelled };
}

describe("buildDocumentSeriesRows", () => {
  it("returns no rows when no documents were issued", () => {
    expect(buildDocumentSeriesRows([])).toEqual([]);
  });

  it("summarises a contiguous invoice series as one row with its first and last number", () => {
    const rows = buildDocumentSeriesRows([invoice("PBD-2627-INV-002"), invoice("PBD-2627-INV-001"), invoice("PBD-2627-INV-003")]);

    expect(rows).toEqual([
      { nature: "Invoices for outward supply", srNoFrom: "PBD-2627-INV-001", srNoTo: "PBD-2627-INV-003", totalNumber: 3, cancelled: 0 },
    ]);
  });

  it("counts cancelled documents inside the series total", () => {
    const rows = buildDocumentSeriesRows([invoice("PBD-2627-INV-001"), invoice("PBD-2627-INV-002", true), invoice("PBD-2627-INV-003")]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ totalNumber: 3, cancelled: 1 });
  });

  it("splits a numbering gap into separate rows so each range holds exactly its own documents", () => {
    const rows = buildDocumentSeriesRows([invoice("PBD-2627-INV-001"), invoice("PBD-2627-INV-002"), invoice("PBD-2627-INV-005")]);

    expect(rows).toEqual([
      { nature: "Invoices for outward supply", srNoFrom: "PBD-2627-INV-001", srNoTo: "PBD-2627-INV-002", totalNumber: 2, cancelled: 0 },
      { nature: "Invoices for outward supply", srNoFrom: "PBD-2627-INV-005", srNoTo: "PBD-2627-INV-005", totalNumber: 1, cancelled: 0 },
    ]);
  });

  it("orders by numeric sequence so a number that outgrows its padding stays in the same run", () => {
    const rows = buildDocumentSeriesRows([invoice("PBD-2627-INV-1000"), invoice("PBD-2627-INV-999")]);

    expect(rows).toEqual([
      { nature: "Invoices for outward supply", srNoFrom: "PBD-2627-INV-999", srNoTo: "PBD-2627-INV-1000", totalNumber: 2, cancelled: 0 },
    ]);
  });

  it("reports Sales Returns and Credit Notes as separate Credit Note series, and Debit Notes as Debit Note", () => {
    const rows = buildDocumentSeriesRows([
      { documentType: "DEBIT_NOTE", documentNumber: "PBD-2627-DN-001", isCancelled: false },
      { documentType: "CREDIT_NOTE", documentNumber: "PBD-2627-CN-001", isCancelled: false },
      { documentType: "SALES_RETURN", documentNumber: "PBD-2627-SR-001", isCancelled: false },
      invoice("PBD-2627-INV-001"),
    ]);

    expect(rows.map((row) => [row.nature, row.srNoFrom])).toEqual([
      ["Invoices for outward supply", "PBD-2627-INV-001"],
      ["Credit Note", "PBD-2627-SR-001"],
      ["Credit Note", "PBD-2627-CN-001"],
      ["Debit Note", "PBD-2627-DN-001"],
    ]);
  });

  it("never merges two different prefixes of the same document type into one range", () => {
    const rows = buildDocumentSeriesRows([invoice("A-INV-001"), invoice("B-INV-002")]);

    expect(rows).toHaveLength(2);
  });

  it("keeps a number with no trailing digits as its own single-document row", () => {
    const rows = buildDocumentSeriesRows([invoice("MANUAL")]);

    expect(rows).toEqual([{ nature: "Invoices for outward supply", srNoFrom: "MANUAL", srNoTo: "MANUAL", totalNumber: 1, cancelled: 0 }]);
  });
});
