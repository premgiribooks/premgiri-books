import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { SalesInvoiceDetail } from "@/types/sales-invoice";

import { GET } from "./route";

const { getSalesInvoiceMock, buildSalesInvoiceHtmlMock, renderHtmlToPdfMock, errorMock } = vi.hoisted(() => ({
  getSalesInvoiceMock: vi.fn(),
  buildSalesInvoiceHtmlMock: vi.fn(),
  renderHtmlToPdfMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock("@/modules/sales-invoices/services/sales-invoice-service", () => ({
  salesInvoiceService: { getSalesInvoice: getSalesInvoiceMock },
}));
vi.mock("@/modules/sales-invoices/pdf/sales-invoice-pdf", () => ({
  buildSalesInvoiceHtml: buildSalesInvoiceHtmlMock,
}));
vi.mock("@/lib/pdf-generation", () => ({
  renderHtmlToPdf: renderHtmlToPdfMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function baseInvoice(overrides: Partial<SalesInvoiceDetail> = {}): SalesInvoiceDetail {
  return {
    id: "inv-1",
    invoiceNumber: "INV/2026/0001",
    status: "POSTED",
    ...overrides,
  } as SalesInvoiceDetail;
}

describe("GET /sales/invoices/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the invoice doesn't exist (or belongs to another company)", async () => {
    getSalesInvoiceMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Sales invoice not found." });
  });

  it("rejects a DRAFT invoice — the download URL is directly hittable regardless of the UI's own status gate", async () => {
    getSalesInvoiceMock.mockResolvedValue(baseInvoice({ status: "DRAFT" }));

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(400);
    expect(renderHtmlToPdfMock).not.toHaveBeenCalled();
  });

  it("maps AuthenticationError to 401", async () => {
    getSalesInvoiceMock.mockRejectedValue(new AuthenticationError());

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(401);
  });

  it("maps AuthorizationError to 403", async () => {
    getSalesInvoiceMock.mockRejectedValue(new AuthorizationError());

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(403);
  });

  it("maps a plain AppError to 400", async () => {
    getSalesInvoiceMock.mockRejectedValue(new AppError("Something about the invoice is invalid."));

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something about the invoice is invalid." });
  });

  it("returns a generic 500 and logs a render failure — not just a getSalesInvoice failure", async () => {
    getSalesInvoiceMock.mockResolvedValue(baseInvoice());
    buildSalesInvoiceHtmlMock.mockReturnValue("<html></html>");
    renderHtmlToPdfMock.mockRejectedValue(new Error("Chromium launch failed"));

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong. Please try again." });
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("returns the PDF with the correct headers on success", async () => {
    getSalesInvoiceMock.mockResolvedValue(baseInvoice({ invoiceNumber: "INV/2026/0001" }));
    buildSalesInvoiceHtmlMock.mockReturnValue("<html></html>");
    renderHtmlToPdfMock.mockResolvedValue(Buffer.from("%PDF-fake"));

    const response = await GET(new Request("http://localhost/sales/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="INV_2026_0001.pdf"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("%PDF-fake");
  });
});
