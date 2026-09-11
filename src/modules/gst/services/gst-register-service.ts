import { getInwardSupplyLines, getOutwardSupplyLines } from "@/engines/gst/gst-report-queries";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { GST_REPORT_DEFAULT_PAGE_SIZE } from "@/modules/gst/validation/gst-report-filters-schema";
import type { GstRegisterResult, GstRegisterTotals, GstReportFilters } from "@/types/gst-report";

const DEFAULT_PAGE = 1;

const ZERO_TOTALS: GstRegisterTotals = { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 };

function matchesOptionalFilters(line: GstSupplyLine, filters: GstReportFilters): boolean {
  if (filters.partyId && line.partyId !== filters.partyId) {
    return false;
  }
  if (filters.hsnCode && line.hsnCode !== filters.hsnCode) {
    return false;
  }
  if (filters.ratePercent !== undefined && line.ratePercent !== filters.ratePercent) {
    return false;
  }
  return true;
}

function sumTotals(lines: GstSupplyLine[]): GstRegisterTotals {
  return lines.reduce<GstRegisterTotals>(
    (totals, line) => ({
      taxableAmount: totals.taxableAmount + line.taxableAmount,
      cgst: totals.cgst + line.cgst,
      sgst: totals.sgst + line.sgst,
      igst: totals.igst + line.igst,
      cess: totals.cess + line.cess,
      totalAmount: totals.totalAmount + line.totalAmount,
    }),
    ZERO_TOTALS
  );
}

async function buildRegister(
  getLines: typeof getOutwardSupplyLines,
  companyId: string,
  filters: GstReportFilters
): Promise<GstRegisterResult> {
  const allLines = await getLines(companyId, filters.from, filters.to);
  const filtered = allLines.filter((line) => matchesOptionalFilters(line, filters));
  const totals = sumTotals(filtered);

  const page = filters.page ?? DEFAULT_PAGE;
  const pageSize = filters.pageSize ?? GST_REPORT_DEFAULT_PAGE_SIZE;
  const start = (page - 1) * pageSize;
  const pageLines = filtered.slice(start, start + pageSize);

  return { lines: pageLines, totals, page, pageSize, totalCount: filtered.length };
}

/**
 * Thin wrappers around the shared getOutwardSupplyLines/getInwardSupplyLines
 * engine primitives (57-gst-registers.md) — applies the optional
 * party/HSN/rate filters and pagination on top, plus the `gst`/`view`
 * permission gate every screen in this module requires. No Server Action or
 * component calls the engine functions directly.
 */
export const gstRegisterService = {
  async getOutwardRegister(filters: GstReportFilters): Promise<GstRegisterResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");
    return buildRegister(getOutwardSupplyLines, user.companyId, filters);
  },

  async getInwardRegister(filters: GstReportFilters): Promise<GstRegisterResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");
    return buildRegister(getInwardSupplyLines, user.companyId, filters);
  },
};
