import { gstReportEngine } from "@/engines/gst/gst-engine";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { matchesOptionalGstReportFilters } from "@/modules/gst/services/gst-supply-line-filters";
import type { GstRegisterTotals, GstReportFilters } from "@/types/gst-report";
import { ZERO_GST_REGISTER_TOTALS } from "@/types/gst-report";
import type { ItcRegisterHsnGroup, ItcRegisterPartyGroup, ItcRegisterRateGroup, ItcRegisterResult } from "@/types/itc-register";

/** The single bucket key for every line whose product has no `hsnCodeId` (Business Rules) — mirrors hsn-summary-service.ts's own NO_HSN_BUCKET_KEY convention. */
const NO_HSN_BUCKET_KEY = "__NO_HSN__";

function sumTotals(lines: readonly GstSupplyLine[]): GstRegisterTotals {
  return lines.reduce<GstRegisterTotals>(
    (totals, line) => ({
      taxableAmount: totals.taxableAmount + line.taxableAmount,
      cgst: totals.cgst + line.cgst,
      sgst: totals.sgst + line.sgst,
      igst: totals.igst + line.igst,
      cess: totals.cess + line.cess,
      totalAmount: totals.totalAmount + line.totalAmount,
    }),
    ZERO_GST_REGISTER_TOTALS
  );
}

function addLineToTaxTotals<T extends { taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; totalAmount: number }>(
  group: T,
  line: GstSupplyLine
): T {
  return {
    ...group,
    taxableAmount: group.taxableAmount + line.taxableAmount,
    cgst: group.cgst + line.cgst,
    sgst: group.sgst + line.sgst,
    igst: group.igst + line.igst,
    cess: group.cess + line.cess,
    totalAmount: group.totalAmount + line.totalAmount,
  };
}

/** Rate-wise summary (Business Rules) — grouped by `ratePercent` alone, ascending. */
function buildRateWiseSummary(lines: readonly GstSupplyLine[]): ItcRegisterRateGroup[] {
  const groups = new Map<number, ItcRegisterRateGroup>();

  for (const line of lines) {
    const existing = groups.get(line.ratePercent);
    if (existing) {
      groups.set(line.ratePercent, addLineToTaxTotals(existing, line));
      continue;
    }
    groups.set(line.ratePercent, addLineToTaxTotals({ ratePercent: line.ratePercent, ...ZERO_GST_REGISTER_TOTALS }, line));
  }

  return [...groups.values()].sort((a, b) => a.ratePercent - b.ratePercent);
}

function partyKey(line: GstSupplyLine): string {
  // Falls back to partyName (Business Rules) — never actually hit for inward
  // lines today (spec 57's resolveSupplierParty never produces a null
  // partyId), kept for type-safety against GstSupplyLine.partyId's own
  // nullable type.
  return line.partyId ?? `name:${line.partyName}`;
}

/** Party-wise (supplier-wise) summary (Business Rules) — grouped by `partyId`, sorted by total ITC (cgst+sgst+igst+cess, not the taxable-inclusive totalAmount) descending. */
function buildPartyWiseSummary(lines: readonly GstSupplyLine[]): ItcRegisterPartyGroup[] {
  const groups = new Map<string, ItcRegisterPartyGroup>();

  for (const line of lines) {
    const key = partyKey(line);
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, addLineToTaxTotals(existing, line));
      continue;
    }
    groups.set(key, addLineToTaxTotals({ partyId: line.partyId, partyName: line.partyName, ...ZERO_GST_REGISTER_TOTALS }, line));
  }

  return [...groups.values()].sort((a, b) => b.cgst + b.sgst + b.igst + b.cess - (a.cgst + a.sgst + a.igst + a.cess));
}

function hsnKey(hsnCode: string | null): string {
  return hsnCode ?? NO_HSN_BUCKET_KEY;
}

/** HSN-wise summary (Business Rules) — grouped by `hsnCode` alone, "No HSN Assigned" bucket rendered last. */
function buildHsnWiseSummary(lines: readonly GstSupplyLine[]): ItcRegisterHsnGroup[] {
  const groups = new Map<string, ItcRegisterHsnGroup>();

  for (const line of lines) {
    const key = hsnKey(line.hsnCode);
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, addLineToTaxTotals(existing, line));
      continue;
    }
    groups.set(key, addLineToTaxTotals({ hsnCode: line.hsnCode, ...ZERO_GST_REGISTER_TOTALS }, line));
  }

  const assigned = [...groups.values()]
    .filter((group): group is ItcRegisterHsnGroup & { hsnCode: string } => group.hsnCode !== null)
    .sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
  const unassigned = [...groups.values()].filter((group) => group.hsnCode === null);
  // "No HSN Assigned" always renders last (UI), mirroring hsn-summary-service.ts's own sortRows.
  return [...assigned, ...unassigned];
}

/**
 * itcRegisterService — 83-itc-register.md. Calls `getInwardSupplyLines`
 * (57-gst-registers.md) once, then computes every rate-wise/party-wise/
 * HSN-wise summary purely in-memory over its already-computed output. Every
 * line is treated as fully eligible ITC (Business Rules) — no eligibility
 * categorization exists anywhere in this codebase. This report's `totals`
 * (built from the same unfiltered `getInwardSupplyLines` call `gstr3bService`
 * uses for Table 4(A)(5)) reconciles exactly with that figure whenever no
 * optional party/HSN/rate filter narrows the result.
 */
export const itcRegisterService = {
  async getItcRegister(filters: GstReportFilters): Promise<ItcRegisterResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");

    const allLines = await gstReportEngine.getInwardSupplyLines(user.companyId, filters.from, filters.to);
    const lines = allLines.filter((line) => matchesOptionalGstReportFilters(line, filters));

    return {
      rateWise: buildRateWiseSummary(lines),
      partyWise: buildPartyWiseSummary(lines),
      hsnWise: buildHsnWiseSummary(lines),
      lines,
      totals: sumTotals(lines),
    };
  },
};
