import { determineSupplyType, gstReportEngine, isValidGstStateCode } from "@/engines/gst/gst-engine";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { AppError } from "@/lib/app-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { gstFilingRepository } from "@/modules/gst/repositories/gst-filing-repository";
import type { GstReportFilters } from "@/types/gst-report";
import type { GstFilingRecord, MarkPeriodFiledInput } from "@/types/gstr1";
import type {
  Gstr3bAmountRow,
  Gstr3bEligibleItc,
  Gstr3bExemptInwardSupplies,
  Gstr3bInterStateSupplies,
  Gstr3bInterStateUnregisteredGroup,
  Gstr3bInterestLateFee,
  Gstr3bItcRow,
  Gstr3bOutwardSupplies,
  Gstr3bReturn,
  Gstr3bTaxRow,
} from "@/types/gstr3b";

const RETURN_TYPE = "GSTR3B";
const ALREADY_FILED_MESSAGE = "This period has already been filed. Reopen it first to re-file.";
const FILING_RECORD_NOT_FOUND_MESSAGE = "GST filing record not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before marking a GST return period filed.";

// Every "not computed" reason string below names the exact structural gap
// (Business Rules) — never a generic "not supported" — so the UI tooltip
// tells a filer precisely what to check manually.
const NOT_TRACKED_ZERO_RATED =
  "Zero-rated (export/SEZ) outward supplies are not tracked — no export/SEZ document flow exists in this codebase.";
const NOT_TRACKED_REVERSE_CHARGE_OUTWARD =
  "Reverse-charge liability is not tracked — no invoice line persists an isReverseCharge flag. Enter manually if applicable.";
const NOT_TRACKED_NON_GST_OUTWARD =
  "Non-GST outward supplies are not tracked — no product or document is flagged as outside GST scope.";
const NOT_TRACKED_COMPOSITION_TAXPAYERS =
  "Composition taxpayer recipients are not tracked — Customer has no composition-scheme flag.";
const NOT_TRACKED_UIN_HOLDERS = "UIN holder recipients are not tracked — Customer has no UIN-holder flag.";
const NOT_TRACKED_IMPORT_GOODS = "Import of goods is not tracked — no import document flow exists in this codebase.";
const NOT_TRACKED_IMPORT_SERVICES = "Import of services is not tracked — no import document flow exists in this codebase.";
const NOT_TRACKED_REVERSE_CHARGE_ITC =
  "Inward reverse-charge ITC is not tracked — no purchase invoice line persists an isReverseCharge flag.";
const NOT_TRACKED_ISD_CREDIT = "ISD credit is not tracked — no Input Service Distributor document flow exists in this codebase.";
const NOT_TRACKED_ITC_REVERSED =
  "ITC reversal is not tracked separately — a Purchase Return already reduces (A)(5) directly, the correct treatment for goods returned to a supplier.";
const NET_ITC_CAVEAT =
  "Equal to (A)(5) because (B) ITC reversed is not tracked — not a claim that no reversal was ever actually required.";
const NOT_TRACKED_INELIGIBLE_ITC =
  "Ineligible ITC (Section 17(5)) is not tracked — no document records a credit's eligibility category. Review manually before filing.";
const NOT_TRACKED_NON_GST_INWARD =
  "Non-GST inward supplies are not tracked — no product or document is flagged as outside GST scope.";
const NOT_TRACKED_STATE_CODE_MISSING =
  "Company GST state code is not configured — intra-state/inter-state cannot be determined for inward supplies.";
const NOT_TRACKED_INVALID_STATE_CODE =
  "One or more nil-rated inward supply lines carry an unrecognized GST state code — intra-state/inter-state cannot be determined safely. Review manually.";
const INTEREST_LATE_FEE_NOTE =
  "Interest and late fee depend on the actual GST portal filing date versus the statutory due date, neither of which this offline system tracks. Compute this at actual filing time.";

function sumTaxFields(lines: GstSupplyLine[]): { taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number } {
  return lines.reduce(
    (totals, line) => ({
      taxableAmount: totals.taxableAmount + line.taxableAmount,
      cgst: totals.cgst + line.cgst,
      sgst: totals.sgst + line.sgst,
      igst: totals.igst + line.igst,
      cess: totals.cess + line.cess,
    }),
    { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 }
  );
}

function computedTaxRow(lines: GstSupplyLine[]): Gstr3bTaxRow {
  return { computed: true, reason: "", ...sumTaxFields(lines) };
}

function notComputedTaxRow(reason: string): Gstr3bTaxRow {
  return { computed: false, reason, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
}

function computedItcRow(lines: GstSupplyLine[]): Gstr3bItcRow {
  const { cgst, sgst, igst, cess } = sumTaxFields(lines);
  return { computed: true, reason: "", cgst, sgst, igst, cess };
}

function notComputedItcRow(reason: string): Gstr3bItcRow {
  return { computed: false, reason, cgst: 0, sgst: 0, igst: 0, cess: 0 };
}

function notComputedAmountRow(reason: string): Gstr3bAmountRow {
  return { computed: false, reason, amount: 0 };
}

/** Table 3.1 — (a)/(c) are computed from the full outward-lines set, split on the `ratePercent = 0` boundary; (b)/(d)/(e) are always visible, always not-computed rows. */
function buildOutwardSupplies(outwardLines: GstSupplyLine[]): Gstr3bOutwardSupplies {
  const taxedLines = outwardLines.filter((line) => line.ratePercent > 0);
  const nilRatedLines = outwardLines.filter((line) => line.ratePercent === 0);
  return {
    taxableOutwardSupplies: computedTaxRow(taxedLines),
    zeroRatedOutwardSupplies: notComputedTaxRow(NOT_TRACKED_ZERO_RATED),
    nilRatedExemptOutwardSupplies: computedTaxRow(nilRatedLines),
    inwardReverseChargeSupplies: notComputedTaxRow(NOT_TRACKED_REVERSE_CHARGE_OUTWARD),
    nonGstOutwardSupplies: notComputedTaxRow(NOT_TRACKED_NON_GST_OUTWARD),
  };
}

/**
 * Table 3.2 — state-wise consolidation of inter-state supplies to
 * unregistered recipients. Scoped to Sales Invoice + Sales Return only,
 * mirroring 58-gstr-1.md's own Table 5/7 (Credit/Debit Notes are reported
 * under Table 9 there, out of scope here). `igst !== 0` (not `> 0`) so a
 * Sales Return's negated igst still counts as inter-state — the same
 * convention gstr1-service.ts's classifySalesInvoiceLines uses.
 */
function buildInterStateSupplies(outwardLines: GstSupplyLine[]): Gstr3bInterStateSupplies {
  const eligibleLines = outwardLines.filter(
    (line) => (line.documentType === "SALES_INVOICE" || line.documentType === "SALES_RETURN") && !line.partyGstin && line.igst !== 0
  );

  const groups = new Map<string, Gstr3bInterStateUnregisteredGroup>();
  for (const line of eligibleLines) {
    const existing = groups.get(line.placeOfSupplyStateCode);
    if (existing) {
      existing.taxableAmount += line.taxableAmount;
      existing.igst += line.igst;
      continue;
    }
    groups.set(line.placeOfSupplyStateCode, {
      placeOfSupplyStateCode: line.placeOfSupplyStateCode,
      taxableAmount: line.taxableAmount,
      igst: line.igst,
    });
  }

  return {
    unregisteredRecipients: [...groups.values()],
    compositionTaxpayers: { computed: false, reason: NOT_TRACKED_COMPOSITION_TAXPAYERS },
    uinHolders: { computed: false, reason: NOT_TRACKED_UIN_HOLDERS },
  };
}

/** Table 4 — Eligible ITC. (A)(5) is the only computed sub-row; (C) reuses its figures verbatim with a caveat note. */
function buildEligibleItc(inwardLines: GstSupplyLine[]): Gstr3bEligibleItc {
  const allOtherItc = computedItcRow(inwardLines);
  const netItcAvailable: Gstr3bItcRow = { ...allOtherItc, reason: NET_ITC_CAVEAT };

  return {
    importOfGoods: notComputedItcRow(NOT_TRACKED_IMPORT_GOODS),
    importOfServices: notComputedItcRow(NOT_TRACKED_IMPORT_SERVICES),
    inwardReverseChargeItc: notComputedItcRow(NOT_TRACKED_REVERSE_CHARGE_ITC),
    isdCredit: notComputedItcRow(NOT_TRACKED_ISD_CREDIT),
    allOtherItc,
    itcReversed: notComputedItcRow(NOT_TRACKED_ITC_REVERSED),
    netItcAvailable,
    ineligibleItc: notComputedItcRow(NOT_TRACKED_INELIGIBLE_ITC),
  };
}

async function getCompanyStateCode(companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { stateCode: true } });
  return company?.stateCode ?? null;
}

/**
 * Table 5 — nil-rated/exempt inward supplies, split intra-state vs.
 * inter-state. Every line in this bucket carries zero tax by definition
 * (ratePercent = 0), so — unlike every other computed row in this service —
 * the split cannot be read off the tax columns; it requires the same
 * companyStateCode/placeOfSupplyStateCode comparison
 * purchase-invoice-service.ts already used once to decide the (now-zero)
 * cgst/sgst/igst split at posting time. Both state codes are validated
 * up front (rather than letting `determineSupplyType` throw mid-loop) so a
 * single stale/legacy code on one old posted line degrades this one table
 * to a visible not-computed row instead of failing the entire return —
 * every other "can't compute" case in this service behaves the same way.
 */
async function buildExemptInwardSupplies(companyId: string, inwardLines: GstSupplyLine[]): Promise<Gstr3bExemptInwardSupplies> {
  const nilRatedLines = inwardLines.filter((line) => line.ratePercent === 0);
  const companyStateCode = await getCompanyStateCode(companyId);

  if (!companyStateCode || !isValidGstStateCode(companyStateCode)) {
    return {
      intraState: notComputedAmountRow(NOT_TRACKED_STATE_CODE_MISSING),
      interState: notComputedAmountRow(NOT_TRACKED_STATE_CODE_MISSING),
      nonGst: notComputedAmountRow(NOT_TRACKED_NON_GST_INWARD),
    };
  }

  if (nilRatedLines.some((line) => !isValidGstStateCode(line.placeOfSupplyStateCode))) {
    return {
      intraState: notComputedAmountRow(NOT_TRACKED_INVALID_STATE_CODE),
      interState: notComputedAmountRow(NOT_TRACKED_INVALID_STATE_CODE),
      nonGst: notComputedAmountRow(NOT_TRACKED_NON_GST_INWARD),
    };
  }

  let intraStateAmount = 0;
  let interStateAmount = 0;
  for (const line of nilRatedLines) {
    const supplyType = determineSupplyType(companyStateCode, line.placeOfSupplyStateCode);
    if (supplyType === "INTRA_STATE") {
      intraStateAmount += line.taxableAmount;
    } else {
      interStateAmount += line.taxableAmount;
    }
  }

  return {
    intraState: { computed: true, reason: "", amount: intraStateAmount },
    interState: { computed: true, reason: "", amount: interStateAmount },
    nonGst: notComputedAmountRow(NOT_TRACKED_NON_GST_INWARD),
  };
}

function buildInterestLateFee(): Gstr3bInterestLateFee {
  return { computed: false, reason: INTEREST_LATE_FEE_NOTE };
}

/**
 * gstr3bService — 59-gstr-3b.md. Calls the shared
 * getOutwardSupplyLines/getInwardSupplyLines primitives (57-gst-registers.md)
 * once each, then computes every statutory row purely in-memory. Every row
 * this codebase's data cannot support is still present in the returned
 * shape with `computed: false` and a non-empty `reason` — never omitted.
 */
export const gstr3bService = {
  async getGstr3BReturn(filters: Pick<GstReportFilters, "from" | "to">): Promise<Gstr3bReturn> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");

    const [outwardLines, inwardLines] = await Promise.all([
      gstReportEngine.getOutwardSupplyLines(user.companyId, filters.from, filters.to),
      gstReportEngine.getInwardSupplyLines(user.companyId, filters.from, filters.to),
    ]);

    return {
      periodStart: filters.from,
      periodEnd: filters.to,
      outwardSupplies: buildOutwardSupplies(outwardLines),
      interStateSupplies: buildInterStateSupplies(outwardLines),
      eligibleItc: buildEligibleItc(inwardLines),
      exemptInwardSupplies: await buildExemptInwardSupplies(user.companyId, inwardLines),
      interestLateFee: buildInterestLateFee(),
    };
  },

  async getFilingRecord(periodStart: Date, periodEnd: Date): Promise<GstFilingRecord | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");
    return gstFilingRepository.findOne(user.companyId, RETURN_TYPE, periodStart, periodEnd);
  },

  // Advisory only (Business Rules), identical posture to 58-gstr-1.md's own
  // markPeriodFiled — never touches, locks, or validates against any
  // Sales/Purchase/Return/Note row.
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
