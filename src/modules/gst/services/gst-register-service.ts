import { gstReportEngine } from "@/engines/gst/gst-engine";
import type { getOutwardSupplyLines } from "@/engines/gst/gst-report-queries";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { matchesOptionalGstReportFilters } from "@/modules/gst/services/gst-supply-line-filters";
import { GST_REPORT_DEFAULT_PAGE_SIZE } from "@/modules/gst/validation/gst-report-filters-schema";
import type { GstPartyOption, GstRegisterResult, GstRegisterTotals, GstRegisterType, GstReportFilters } from "@/types/gst-report";
import { ZERO_GST_REGISTER_TOTALS } from "@/types/gst-report";

const DEFAULT_PAGE = 1;

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
    ZERO_GST_REGISTER_TOTALS
  );
}

async function buildRegister(
  getLines: typeof getOutwardSupplyLines,
  companyId: string,
  filters: GstReportFilters
): Promise<GstRegisterResult> {
  const allLines = await getLines(companyId, filters.from, filters.to);
  const filtered = allLines.filter((line) => matchesOptionalGstReportFilters(line, filters));
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
    return buildRegister(gstReportEngine.getOutwardSupplyLines, user.companyId, filters);
  },

  async getInwardRegister(filters: GstReportFilters): Promise<GstRegisterResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");
    return buildRegister(gstReportEngine.getInwardSupplyLines, user.companyId, filters);
  },

  /**
   * The party filter dropdown's options for the given register type —
   * Customers for Outward, Suppliers for Inward. Deliberately queries
   * Prisma directly rather than calling customerService.listSelectableCustomers()/
   * supplierService.listSelectableSuppliers() (both gated on the `masters`
   * permission module, per physical-verification-service.ts's own
   * listFormOptions() precedent of querying via its own module rather than
   * a sibling module's service) — an Accountant role has `gst:view` but not
   * necessarily `masters:view` (see DEFAULT_ROLE_PERMISSIONS), so routing
   * through those services would 403 this module's primary user.
   */
  async listPartyOptions(registerType: GstRegisterType): Promise<GstPartyOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");

    if (registerType === "OUTWARD") {
      const customers = await prisma.customer.findMany({
        where: { companyId: user.companyId, isActive: true },
        select: { id: true, gstin: true, ledger: { select: { name: true } } },
        orderBy: { ledger: { name: "asc" } },
      });
      return customers.map((customer) => ({ id: customer.id, name: customer.ledger.name, gstin: customer.gstin }));
    }

    const suppliers = await prisma.supplier.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, gstin: true, ledger: { select: { name: true } } },
      orderBy: { ledger: { name: "asc" } },
    });
    return suppliers.map((supplier) => ({ id: supplier.id, name: supplier.ledger.name, gstin: supplier.gstin }));
  },
};
