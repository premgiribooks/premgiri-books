import { gstReportEngine } from "@/engines/gst/gst-engine";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import type { GstReportFilters } from "@/types/gst-report";
import type { Gstr2DocumentGroup, Gstr2NotTrackedRow, Gstr2PartyConsolidatedGroup, Gstr2Return } from "@/types/gstr2";

// Every "not computed" reason names the exact structural gap (Business
// Rules), matching 59-gstr-3b.md's own convention — never a generic "not
// supported" string.
const NOT_TRACKED_REVERSE_CHARGE =
  "Reverse-charge liability is not tracked — no purchase invoice line persists an isReverseCharge flag. Enter manually if applicable.";
const NOT_TRACKED_IMPORT_SEZ =
  "Imports from Overseas or SEZ units (Bill of Entry) are not tracked — no import/Bill-of-Entry document flow exists in this codebase.";
const NOT_TRACKED_ISD_CREDIT = "ISD credit is not tracked — no Input Service Distributor document flow exists in this codebase.";
const NOT_TRACKED_TDS_TCS = "TDS and TCS credit is not tracked — no TDS/TCS document flow exists anywhere in this codebase.";
const NOT_TRACKED_ITC_REVERSAL =
  "ITC reversal is not tracked separately — a Purchase Return already reduces Table 3 directly, the correct treatment for goods returned to a supplier.";
const REGISTERED_SUPPLIES_CAVEAT =
  "No isReverseCharge flag exists anywhere in this codebase, so this table cannot actually exclude reverse-charge lines the way the real form's Table 3 does — every registered-supplier line lands here regardless of whether it would, in reality, be reverse-charge.";
const COMPOSITION_EXEMPT_CAVEAT =
  "This codebase has no explicit composition-scheme flag on Supplier, so this table cannot distinguish a composition-scheme supplier from a merely-unregistered one — both simply show as \"no GSTIN on file.\"";

function notTrackedRow(reason: string): Gstr2NotTrackedRow {
  return { computed: false, reason, amount: 0 };
}

/**
 * Table 3 — one row per Purchase Invoice/Purchase Return document (mirrors
 * 58-gstr-1.md's toDocumentGroups), restricted to lines where partyGstin is
 * present. A Purchase Return has its own documentId (its own return, not its
 * parent invoice), so it lands as its own negative row rather than merging
 * into its parent invoice's row — identical posture to how Sales Return
 * lines are handled in GSTR-1's Table 4 (B2B); the period's Table 3 TOTAL
 * still nets correctly across both rows.
 */
function buildRegisteredSupplies(inwardLines: GstSupplyLine[]): Gstr2DocumentGroup[] {
  const registeredLines = inwardLines.filter((line) => line.partyGstin);
  const groups = new Map<string, Gstr2DocumentGroup>();

  for (const line of registeredLines) {
    const existing = groups.get(line.documentId);
    if (existing) {
      existing.taxableAmount += line.taxableAmount;
      existing.cgst += line.cgst;
      existing.sgst += line.sgst;
      existing.igst += line.igst;
      existing.cess += line.cess;
      existing.totalAmount += line.totalAmount;
      continue;
    }
    groups.set(line.documentId, {
      documentType: line.documentType as Gstr2DocumentGroup["documentType"],
      documentId: line.documentId,
      documentNumber: line.documentNumber,
      documentDate: line.documentDate,
      partyId: line.partyId,
      partyName: line.partyName,
      partyGstin: line.partyGstin,
      placeOfSupplyStateCode: line.placeOfSupplyStateCode,
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

/**
 * Table 7 — no-GSTIN-supplier and nil-rated lines, consolidated by
 * `partyId` (Business Rules), not by (place, rate) the way GSTR-1's own
 * Table 7 is. Every inward line always resolves a non-null `partyId` (every
 * Purchase Invoice/Purchase Return requires a real `Supplier`, unlike Sales'
 * Walk-in/Quick-customer paths — 57-gst-registers.md), so grouping by
 * `partyId` alone is safe here.
 */
function buildCompositionAndExemptSupplies(inwardLines: GstSupplyLine[]): Gstr2PartyConsolidatedGroup[] {
  const eligibleLines = inwardLines.filter((line) => !line.partyGstin || line.ratePercent === 0);
  const groups = new Map<string, Gstr2PartyConsolidatedGroup>();

  for (const line of eligibleLines) {
    const key = line.partyId ?? line.partyName;
    const existing = groups.get(key);
    if (existing) {
      existing.taxableAmount += line.taxableAmount;
      existing.totalAmount += line.totalAmount;
      continue;
    }
    groups.set(key, {
      partyId: line.partyId ?? "",
      partyName: line.partyName,
      partyGstin: line.partyGstin,
      taxableAmount: line.taxableAmount,
      totalAmount: line.totalAmount,
    });
  }

  return [...groups.values()];
}

/**
 * gstr2Service — 82-gstr-2.md. Calls the shared getInwardSupplyLines
 * primitive (57-gst-registers.md) once, then computes Tables 3/7 in-memory;
 * Tables 4/5/8/9/11 are always-not-computed placeholders (Business Rules).
 * Tables 6/10/12/13 are not part of this return shape at all. No
 * GstFilingRecord interaction of any kind — this is the first Phase 8 GST
 * return service with no filing concept (see the spec's Filing section).
 */
export const gstr2Service = {
  async getGstr2Return(filters: Pick<GstReportFilters, "from" | "to">): Promise<Gstr2Return> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");

    const inwardLines = await gstReportEngine.getInwardSupplyLines(user.companyId, filters.from, filters.to);

    return {
      periodStart: filters.from,
      periodEnd: filters.to,
      registeredSupplies: buildRegisteredSupplies(inwardLines),
      registeredSuppliesCaveat: REGISTERED_SUPPLIES_CAVEAT,
      reverseChargeSupplies: notTrackedRow(NOT_TRACKED_REVERSE_CHARGE),
      importsOverseasOrSez: notTrackedRow(NOT_TRACKED_IMPORT_SEZ),
      compositionAndExemptSupplies: buildCompositionAndExemptSupplies(inwardLines),
      compositionAndExemptCaveat: COMPOSITION_EXEMPT_CAVEAT,
      isdCredit: notTrackedRow(NOT_TRACKED_ISD_CREDIT),
      tdsTcsCredit: notTrackedRow(NOT_TRACKED_TDS_TCS),
      itcReversal: notTrackedRow(NOT_TRACKED_ITC_REVERSAL),
    };
  },
};
