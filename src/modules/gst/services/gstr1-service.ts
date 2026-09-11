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
 * Table 8 (Nil-rated/Exempt) takes every ratePercent === 0 line first,
 * regardless of GSTIN — real-world GSTR-1 reports nil-rated/exempt supplies
 * separately from B2B/B2C entirely, not merged into either. Every remaining
 * line then splits on GSTIN presence (Business Rules: "classification is
 * driven by GSTIN presence, not customerMode").
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

  // Group unregistered lines by invoice first, to test each invoice's own
  // value against the B2C Large threshold (Business Rules: "that invoice's
  // grandTotal (not just this one line)"). The sum of an invoice's own
  // already-fetched line totalAmounts stands in for the stored
  // SalesInvoice.grandTotal column — off by at most that invoice's roundOff
  // paisa, immaterial to a ₹2,50,000 statutory threshold — since reading the
  // raw invoice would mean a second query outside getOutwardSupplyLines,
  // which this module's Code Standards forbids ("no GST arithmetic invented
  // here; this module only classifies/groups").
  const byInvoice = new Map<string, GstSupplyLine[]>();
  for (const line of unregisteredLines) {
    const existing = byInvoice.get(line.documentId);
    if (existing) {
      existing.push(line);
    } else {
      byInvoice.set(line.documentId, [line]);
    }
  }

  const b2cLargeLines: GstSupplyLine[] = [];
  const b2cSmallLines: GstSupplyLine[] = [];
  for (const invoiceLines of byInvoice.values()) {
    const isInterState = invoiceLines.some((line) => line.igst > 0);
    const invoiceTotal = invoiceLines.reduce((sum, line) => sum + line.totalAmount, 0);
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

    const salesInvoiceLines = lines.filter((line) => line.documentType === "SALES_INVOICE");
    // Debit Notes are reported only under Table 9C (registered) / 9B
    // (unregistered), never under Table 4 — mirrors real GSTR-1's own table
    // structure. Sales Return lines are deliberately excluded from every
    // table — 58-gstr-1.md's Project Context: a Sales Return carries no
    // statutory GST-document label of its own, only Credit/Debit Note does;
    // its financial effect is only ever visible via the source invoice's
    // own posted figures, not re-shown as a separate GSTR-1 row.
    const noteLines = lines.filter((line) => line.documentType === "CREDIT_NOTE" || line.documentType === "DEBIT_NOTE");

    const { b2b, b2cLarge, b2cSmall, nilRated } = classifySalesInvoiceLines(salesInvoiceLines);
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
