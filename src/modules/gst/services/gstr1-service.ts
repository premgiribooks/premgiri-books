import { gstReportEngine } from "@/engines/gst/gst-engine";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { AppError } from "@/lib/app-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { gstFilingRepository } from "@/modules/gst/repositories/gst-filing-repository";
import type { GstReportFilters } from "@/types/gst-report";
import type {
  GstFilingRecord,
  Gstr1ConsolidatedGroup,
  Gstr1DocumentGroup,
  Gstr1NilRatedGroup,
  Gstr1Return,
  MarkPeriodFiledInput,
} from "@/types/gstr1";

const RETURN_TYPE = "GSTR1";
const B2C_LARGE_THRESHOLD_RUPEES = 250000;
const ALREADY_FILED_MESSAGE = "This period has already been filed. Reopen it first to re-file.";
const FILING_RECORD_NOT_FOUND_MESSAGE = "GST filing record not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before marking a GST return period filed.";

function consolidationKey(placeOfSupplyStateCode: string, ratePercent: number): string {
  return `${placeOfSupplyStateCode}::${ratePercent}`;
}

function toConsolidated(lines: GstSupplyLine[]): Gstr1ConsolidatedGroup[] {
  const groups = new Map<string, Gstr1ConsolidatedGroup>();
  for (const line of lines) {
    const key = consolidationKey(line.placeOfSupplyStateCode, line.ratePercent);
    const existing = groups.get(key);
    if (existing) {
      existing.taxableAmount += line.taxableAmount;
      existing.cgst += line.cgst;
      existing.sgst += line.sgst;
      existing.igst += line.igst;
      existing.cess += line.cess;
      existing.totalAmount += line.totalAmount;
      continue;
    }
    groups.set(key, {
      placeOfSupplyStateCode: line.placeOfSupplyStateCode,
      ratePercent: line.ratePercent,
      taxableAmount: line.taxableAmount,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      cess: line.cess,
      totalAmount: line.totalAmount,
    });
  }
  return [...groups.values()];
}

function toNilRated(lines: GstSupplyLine[]): Gstr1NilRatedGroup[] {
  const groups = new Map<string, Gstr1NilRatedGroup>();
  for (const line of lines) {
    const existing = groups.get(line.placeOfSupplyStateCode);
    if (existing) {
      existing.taxableAmount += line.taxableAmount;
      existing.totalAmount += line.totalAmount;
      continue;
    }
    groups.set(line.placeOfSupplyStateCode, {
      placeOfSupplyStateCode: line.placeOfSupplyStateCode,
      taxableAmount: line.taxableAmount,
      totalAmount: line.totalAmount,
    });
  }
  return [...groups.values()];
}

function toDocumentGroups(lines: GstSupplyLine[]): Gstr1DocumentGroup[] {
  const groups = new Map<string, Gstr1DocumentGroup>();
  for (const line of lines) {
    const breakupEntry = {
      ratePercent: line.ratePercent,
      cessPercent: line.cessPercent,
      taxableAmount: line.taxableAmount,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      cess: line.cess,
      totalAmount: line.totalAmount,
    };
    const existing = groups.get(line.documentId);
    if (existing) {
      existing.breakup.push(breakupEntry);
      existing.taxableAmount += line.taxableAmount;
      existing.totalAmount += line.totalAmount;
      continue;
    }
    groups.set(line.documentId, {
      documentId: line.documentId,
      documentType: line.documentType as Gstr1DocumentGroup["documentType"],
      documentNumber: line.documentNumber,
      documentDate: line.documentDate,
      partyId: line.partyId,
      partyName: line.partyName,
      partyGstin: line.partyGstin,
      placeOfSupplyStateCode: line.placeOfSupplyStateCode,
      breakup: [breakupEntry],
      taxableAmount: line.taxableAmount,
      totalAmount: line.totalAmount,
    });
  }
  return [...groups.values()];
}

interface Gstr1SalesInvoiceClassification {
  b2b: Gstr1DocumentGroup[];
  b2cLarge: Gstr1DocumentGroup[];
  b2cSmall: Gstr1ConsolidatedGroup[];
  nilRated: Gstr1NilRatedGroup[];
}

/**
 * Classifies Sales Invoice lines AND Sales Return lines together — a Sales
 * Return's negative amounts must reduce whichever B2B/B2C/Nil-rated table
 * its own (GSTIN/rate/place-of-supply) properties place it into, per
 * 58-gstr-1.md's Business Rules ("a Sales Return's financial effect is
 * already netted into whichever B2B/B2C table its source invoice's lines
 * fall into, via getOutwardSupplyLines's signed aggregation"). A return has
 * no `sourceDocumentId` on its GstSupplyLine (only its own return id), so it
 * cannot be merged into the exact same row as its source invoice — it lands
 * as its own (negative) row in Table 4/5 when GSTIN is present, or nets
 * directly into the same consolidated (place, rate) bucket in Table 7/8
 * when it isn't. Either way the period's Table 4/5/7/8 TOTALS come out
 * correct — excluding returns entirely (as an earlier version of this
 * function did) systematically overstated every table by the full value of
 * every return in the period.
 *
 * Table 8 (Nil-rated/Exempt) takes every ratePercent === 0 line first,
 * regardless of GSTIN — real-world GSTR-1 reports nil-rated/exempt supplies
 * separately from B2B/B2C entirely, not merged into either. Every remaining
 * line then splits on GSTIN presence (Business Rules: "classification is
 * driven by GSTIN presence, not customerMode"). Sales Return lines are never
 * classified into 9B/9C — only real CreditNote/DebitNote rows are (see
 * classifyNoteLines).
 */
function classifySalesInvoiceLines(lines: GstSupplyLine[]): Gstr1SalesInvoiceClassification {
  const nilRatedLines: GstSupplyLine[] = [];
  const b2bLines: GstSupplyLine[] = [];
  const unregisteredLines: GstSupplyLine[] = [];

  for (const line of lines) {
    if (line.ratePercent === 0) {
      nilRatedLines.push(line);
    } else if (line.partyGstin) {
      b2bLines.push(line);
    } else {
      unregisteredLines.push(line);
    }
  }

  // Group unregistered TAXED lines by invoice, to test each invoice's own
  // value against the B2C Large threshold (Business Rules: "that invoice's
  // grandTotal (not just this one line)"). The threshold decision itself
  // uses that invoice's FULL value including any nil-rated lines it also
  // has (tracked separately below) — carving nil-rated lines out before
  // summing would understate the invoice's real value and could flip a
  // borderline invoice into the wrong bucket; the nil-rated lines
  // themselves still only ever get reported under Table 8, never 5/7.
  // `igst !== 0` (not `> 0`) so a Sales Return's negated igst still counts
  // as inter-state.
  const taxedLinesByInvoice = new Map<string, GstSupplyLine[]>();
  const invoiceTotalByDocumentId = new Map<string, number>();
  for (const line of unregisteredLines) {
    const existingTaxed = taxedLinesByInvoice.get(line.documentId);
    if (existingTaxed) {
      existingTaxed.push(line);
    } else {
      taxedLinesByInvoice.set(line.documentId, [line]);
    }
    invoiceTotalByDocumentId.set(line.documentId, (invoiceTotalByDocumentId.get(line.documentId) ?? 0) + line.totalAmount);
  }
  for (const line of nilRatedLines) {
    if (line.partyGstin) {
      continue;
    }
    invoiceTotalByDocumentId.set(line.documentId, (invoiceTotalByDocumentId.get(line.documentId) ?? 0) + line.totalAmount);
  }

  const b2cLargeLines: GstSupplyLine[] = [];
  const b2cSmallLines: GstSupplyLine[] = [];
  for (const [documentId, invoiceLines] of taxedLinesByInvoice) {
    const isInterState = invoiceLines.some((line) => line.igst !== 0);
    const invoiceTotal = invoiceTotalByDocumentId.get(documentId) ?? 0;
    if (isInterState && invoiceTotal > B2C_LARGE_THRESHOLD_RUPEES) {
      b2cLargeLines.push(...invoiceLines);
    } else {
      b2cSmallLines.push(...invoiceLines);
    }
  }

  return {
    b2b: toDocumentGroups(b2bLines),
    b2cLarge: toDocumentGroups(b2cLargeLines),
    b2cSmall: toConsolidated(b2cSmallLines),
    nilRated: toNilRated(nilRatedLines),
  };
}

function classifyNoteLines(lines: GstSupplyLine[]): {
  registered: Gstr1DocumentGroup[];
  unregistered: Gstr1ConsolidatedGroup[];
} {
  const registeredLines = lines.filter((line) => line.partyGstin);
  const unregisteredLines = lines.filter((line) => !line.partyGstin);
  return {
    registered: toDocumentGroups(registeredLines),
    unregistered: toConsolidated(unregisteredLines),
  };
}

/**
 * gstr1Service — 58-gstr-1.md. Calls the shared getOutwardSupplyLines
 * primitive (57-gst-registers.md) once, then classifies the result into the
 * in-scope GSTR-1 tables purely in-memory. No Server Action or component
 * classifies lines itself — always through this service.
 */
export const gstr1Service = {
  async getGstr1Return(filters: Pick<GstReportFilters, "from" | "to">): Promise<Gstr1Return> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");

    const lines = await gstReportEngine.getOutwardSupplyLines(user.companyId, filters.from, filters.to);

    // Sales Return lines are classified alongside Sales Invoice lines (see
    // classifySalesInvoiceLines's own doc comment) — their negative amounts
    // net into whichever B2B/B2C/Nil-rated table their own properties place
    // them in. Debit Notes are reported only under Table 9C (registered) /
    // 9B (unregistered), never under Table 4 — mirrors real GSTR-1's own
    // table structure.
    const salesInvoiceAndReturnLines = lines.filter(
      (line) => line.documentType === "SALES_INVOICE" || line.documentType === "SALES_RETURN"
    );
    const noteLines = lines.filter((line) => line.documentType === "CREDIT_NOTE" || line.documentType === "DEBIT_NOTE");

    const { b2b, b2cLarge, b2cSmall, nilRated } = classifySalesInvoiceLines(salesInvoiceAndReturnLines);
    const { registered, unregistered } = classifyNoteLines(noteLines);

    return {
      periodStart: filters.from,
      periodEnd: filters.to,
      b2b,
      b2cLarge,
      b2cSmall,
      nilRated,
      creditDebitNotesRegistered: registered,
      creditDebitNotesUnregistered: unregistered,
    };
  },

  async getFilingRecord(periodStart: Date, periodEnd: Date): Promise<GstFilingRecord | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");
    return gstFilingRepository.findOne(user.companyId, RETURN_TYPE, periodStart, periodEnd);
  },

  // Advisory only (Business Rules) — never touches, locks, or validates
  // against any Sales/Purchase/Return/Note row. A Sales Invoice dated inside
  // an already-filed period can still be posted without rejection.
  async markPeriodFiled(input: MarkPeriodFiledInput): Promise<GstFilingRecord> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "approve");

    const existing = await gstFilingRepository.findOne(user.companyId, RETURN_TYPE, input.periodStart, input.periodEnd);
    if (existing?.status === "FILED") {
      throw new AppError(ALREADY_FILED_MESSAGE);
    }

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
    }

    return gstFilingRepository.upsert(user.companyId, financialYear.id, RETURN_TYPE, input.periodStart, input.periodEnd, {
      status: "FILED",
      arn: input.arn ?? null,
      filedAt: new Date(),
      filedByUserId: user.id,
    });
  },

  async reopenPeriod(id: string): Promise<GstFilingRecord> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "approve");

    const existing = await gstFilingRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(FILING_RECORD_NOT_FOUND_MESSAGE);
    }

    return gstFilingRepository.upsert(
      existing.companyId,
      existing.financialYearId,
      existing.returnType,
      existing.periodStart,
      existing.periodEnd,
      { status: "OPEN", arn: null, filedAt: null, filedByUserId: null }
    );
  },
};
