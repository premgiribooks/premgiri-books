import { NextResponse } from "next/server";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { renderHtmlToPdfOrHtml } from "@/lib/pdf-generation";
import { isValidMarginOverridePercent } from "@/engines/pricing/margin-override";
import { bankAccountService } from "@/modules/bank-accounts/services/bank-account-service";
import { companyService } from "@/modules/company/services/company-service";
import { readCompanyLogoAsDataUri } from "@/modules/company/services/company-logo-service";
import { buildSalesInvoiceHtml } from "@/modules/sales-invoices/pdf/sales-invoice-pdf";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";
import type { BankAccountWithLedger } from "@/types/bank-account";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function downloadFilename(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
}

/**
 * The company's own bank account is optional polish on the printed
 * invoice, not core to the document — a user with `sales`/`view` but no
 * `accounting`/`view` permission can still download their own invoice, so
 * a missing-permission or no-accounts-configured outcome just omits that
 * section rather than blocking the whole PDF. This module has no "primary
 * account" flag, so the first active one is used. Only the EXPECTED
 * `AuthorizationError` case is swallowed silently; any other failure (a
 * real DB/infrastructure error) is logged — a code-review finding on this
 * same feature caught the original version silently swallowing every
 * error with no observability at all, matching the exact anti-pattern the
 * route's own outer catch block already documents having fixed once.
 */
async function resolveBankAccountForInvoice(): Promise<BankAccountWithLedger | null> {
  try {
    const bankAccounts = await bankAccountService.listBankAccounts({ status: "active" });
    return bankAccounts[0] ?? null;
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      logger.warn({ err: error }, "Failed to resolve a bank account for a Sales Invoice PDF — omitting the section");
    }
    return null;
  }
}

/**
 * Delivers a Sales Invoice as a downloadable PDF — a thin Route Handler
 * with no business logic of its own (code-standards.md's Business Logic
 * rule): `salesInvoiceService.getSalesInvoice` re-checks its own
 * `sales`/`view` permission and company scoping exactly as the detail page
 * does, `companyService.getCompany` re-checks its own session scoping for
 * the seller block, `buildSalesInvoiceHtml` renders the already-loaded
 * document, and `renderHtmlToPdf` turns it into a buffer
 * (78-pdf-generation.md).
 */
export async function GET(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

  try {
    // Hidden "temporary margin override" feature (Ctrl+Shift+M) — an
    // optional, request-scoped rendering instruction the client appends
    // only when it has an active override cookie (see
    // margin-override-cookie.ts). NEVER written to the DB: an invalid or
    // out-of-range value is silently ignored and the real invoice prints,
    // rather than erroring out a normal print/download.
    const marginOverrideParam = new URL(request.url).searchParams.get("marginOverride");
    const marginOverridePercent = marginOverrideParam === null ? null : Number(marginOverrideParam);
    const hasValidMarginOverride =
      marginOverridePercent !== null && isValidMarginOverridePercent(marginOverridePercent);

    const salesInvoice = hasValidMarginOverride
      ? await salesInvoiceService.previewSalesInvoiceWithMarginOverride(id, marginOverridePercent)
      : await salesInvoiceService.getSalesInvoice(id);
    if (!salesInvoice) {
      return NextResponse.json({ error: "Sales invoice not found." }, { status: 404 });
    }
    // Mirrors the detail page's own SalesInvoiceDownloadPdfButton visibility
    // gate (status !== "DRAFT") — the UI condition alone isn't a real
    // restriction once this route has its own directly-hittable URL, so it
    // must be re-enforced here too (code review finding). A DRAFT invoice
    // is not yet a final document; its invoiceNumber exists but nothing
    // about it should be handed out as a "Tax Invoice" PDF.
    if (salesInvoice.status === "DRAFT") {
      return NextResponse.json({ error: "A draft sales invoice cannot be downloaded as a PDF." }, { status: 400 });
    }

    const [company, bankAccount] = await Promise.all([
      companyService.getCompany(salesInvoice.companyId),
      resolveBankAccountForInvoice(),
    ]);
    const logoDataUri = await readCompanyLogoAsDataUri(company?.logo ?? null);

    const html = buildSalesInvoiceHtml({ salesInvoice, company, bankAccount, logoDataUri });
    const result = await renderHtmlToPdfOrHtml(html, { format: "A4" });

    // See renderHtmlToPdfOrHtml's docstring: when Chromium can't launch on
    // this platform, this is the raw HTML instead of a real PDF, and the
    // client (src/lib/pdf-client.ts) falls back to opening its own print
    // dialog on it rather than downloading it as-is.
    if (result.kind === "html") {
      return new NextResponse(result.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadFilename(salesInvoice.invoiceNumber)}"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Covers both an unexpected getSalesInvoice failure and a
    // buildSalesInvoiceHtml/renderHtmlToPdf failure (e.g. Chromium launch
    // failure) — previously only the first was guarded, so a render
    // failure propagated uncaught into Next's generic error page instead
    // of this route's own JSON envelope and was never logged (code review
    // finding).
    logger.error({ err: error }, "Unhandled error generating sales invoice PDF");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
