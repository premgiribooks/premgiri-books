import { gstReportEngine } from "@/engines/gst/gst-engine";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { buildDocumentSeriesRows } from "@/engines/gst/gstr1-offline/documents-issued";
import { buildB2csRows, buildHsnB2cRows, type Gstr1OfflineData } from "@/engines/gst/gstr1-offline/build-gstr1-rows";
import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { classifyNoteLines, classifySalesInvoiceLines } from "@/modules/gst/services/gstr1-service";
import { loadProductInfo } from "@/modules/gst/services/hsn-summary-service";
import type { GstReportFilters } from "@/types/gst-report";

/** A GSTR-1 filing period is a month or a quarter; nothing longer is a valid export. */
const MAX_PERIOD_DAYS = 93;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** How many offending document/product names an error message lists before "and N more". */
const MAX_LISTED_NAMES = 10;

function describeNames(names: readonly string[]): string {
  const listed = names.slice(0, MAX_LISTED_NAMES).join(", ");
  const remaining = names.length - MAX_LISTED_NAMES;
  return remaining > 0 ? `${listed} and ${remaining} more` : listed;
}

function assertPeriodLength(from: Date, to: Date): void {
  const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
  if (days > MAX_PERIOD_DAYS) {
    throw new AppError("Select a single GSTR-1 filing period (a month or a quarter) to export.");
  }
}

function isUnregisteredSale(line: GstSupplyLine): boolean {
  return line.partyGstin === null || line.partyGstin === "";
}

async function assertNoDraftInvoices(companyId: string, from: Date, to: Date): Promise<void> {
  const drafts = await gstReportEngine.getDraftSalesInvoiceNumbers(companyId, from, to);
  if (drafts.length > 0) {
    throw new AppError(
      `${drafts.length} draft sales invoice(s) are dated in this period (${describeNames(drafts)}). Post or cancel them before exporting, so the documents-issued sheet has no unexplained gaps.`
    );
  }
}

async function failForProductsWithoutHsn(companyId: string, productIds: readonly string[]): Promise<never> {
  const products = await prisma.product.findMany({
    where: { companyId, id: { in: [...productIds] } },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  throw new AppError(
    `${products.length} product(s) sold in this period have no HSN/SAC code (${describeNames(products.map((product) => product.name))}). Assign an HSN code before exporting.`
  );
}

/**
 * Assembles the three GSTR-1 sheets the business files through the portal's
 * offline-tool Excel import: Table 7 (b2cs), Table 12 B2C (hsn(b2c)) and
 * Table 13 (docs). Classification is delegated to the shared GSTR-1 service so
 * this export and the on-screen GSTR-1 never disagree on what is B2C small.
 */
export const gstr1OfflineExportService = {
  async getOfflineExport(filters: Pick<GstReportFilters, "from" | "to">): Promise<Gstr1OfflineData> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");
    assertPeriodLength(filters.from, filters.to);

    await assertNoDraftInvoices(user.companyId, filters.from, filters.to);

    const [lines, issuedDocuments] = await Promise.all([
      gstReportEngine.getOutwardSupplyLines(user.companyId, filters.from, filters.to),
      gstReportEngine.getIssuedOutwardDocuments(user.companyId, filters.from, filters.to),
    ]);

    const invoiceAndReturnLines = lines.filter((line) => line.documentType === "SALES_INVOICE" || line.documentType === "SALES_RETURN");
    const noteLines = lines.filter((line) => line.documentType === "CREDIT_NOTE" || line.documentType === "DEBIT_NOTE");

    // Table 7: small-B2C supplies, with unregistered credit/debit notes netted in.
    const { b2cSmall } = classifySalesInvoiceLines(invoiceAndReturnLines);
    const { unregistered: unregisteredNotes } = classifyNoteLines(noteLines);
    const b2cs = buildB2csRows([...b2cSmall, ...unregisteredNotes]);

    // Table 12 (B2C): every unregistered, product-bearing sale and return. Notes carry no HSN or quantity.
    const b2cLines = invoiceAndReturnLines.filter(isUnregisteredSale);
    const productIds = [...new Set(b2cLines.map((line) => line.productId).filter((id): id is string => id !== null))];
    const productInfoById = await loadProductInfo(user.companyId, productIds);
    const { rows: hsnB2c, productIdsWithoutHsn } = buildHsnB2cRows(b2cLines, productInfoById);
    if (productIdsWithoutHsn.length > 0) {
      await failForProductsWithoutHsn(user.companyId, productIdsWithoutHsn);
    }

    return { b2cs, hsnB2c, docs: buildDocumentSeriesRows(issuedDocuments) };
  },
};
