import type { HsnCodeType } from "@prisma/client";

import { gstReportEngine } from "@/engines/gst/gst-engine";
import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { matchesOptionalGstReportFilters } from "@/modules/gst/services/gst-supply-line-filters";
import type { GstRegisterTotals, GstReportFilters } from "@/types/gst-report";
import type { HsnSummaryResult, HsnSummaryRow } from "@/types/hsn-summary";

const ZERO_TOTALS: GstRegisterTotals = { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 };

/** The single bucket key for every product-bearing line whose product has no `hsnCodeId` (Business Rules). */
const NO_HSN_BUCKET_KEY = "__NO_HSN__";

interface ProductInfo {
  hsnCode: string | null;
  codeType: HsnCodeType | null;
  description: string | null;
  /** `Unit.uqcCode` when set, else `Unit.symbol` — a label always exists, even when the GST-specific UQC code hasn't been configured. */
  unitLabel: string;
}

interface GroupAccumulator {
  hsnCode: string | null;
  codeType: HsnCodeType | null;
  description: string | null;
  ratePercent: number | null;
  quantity: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  /** Insertion-ordered per-line unit labels — resolved to a representative label + mixed-unit flag once grouping completes. */
  unitLabels: string[];
}

/** Batched product -> (HSN/codeType/description, unit label) lookup — one query for every distinct product referenced by the period's lines, never one query per group (Service / Repository). */
async function loadProductInfo(companyId: string, productIds: readonly string[]): Promise<Map<string, ProductInfo>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const products = await prisma.product.findMany({
    where: { companyId, id: { in: [...productIds] } },
    select: {
      id: true,
      unit: { select: { uqcCode: true, symbol: true } },
      hsnCode: { select: { code: true, codeType: true, description: true } },
    },
  });

  return new Map(
    products.map((product) => [
      product.id,
      {
        hsnCode: product.hsnCode?.code ?? null,
        codeType: product.hsnCode?.codeType ?? null,
        description: product.hsnCode?.description ?? null,
        unitLabel: product.unit.uqcCode ?? product.unit.symbol,
      },
    ])
  );
}

function groupKey(hsnCode: string | null, codeType: HsnCodeType | null, ratePercent: number): string {
  return hsnCode === null ? NO_HSN_BUCKET_KEY : `${hsnCode}|${codeType}|${ratePercent}`;
}

/** First-seen tie-break, most-common label otherwise — the "first/most-common unit" convention (Business Rules). */
function resolveRepresentativeUnit(labels: readonly string[]): { uqcCode: string | null; isMixedUnit: boolean } {
  if (labels.length === 0) {
    return { uqcCode: null, isMixedUnit: false };
  }

  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let representative = labels[0];
  let bestCount = 0;
  for (const label of labels) {
    const count = counts.get(label) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      representative = label;
    }
  }

  return { uqcCode: representative, isMixedUnit: counts.size > 1 };
}

function toRow(group: GroupAccumulator): HsnSummaryRow {
  const { uqcCode, isMixedUnit } = resolveRepresentativeUnit(group.unitLabels);
  return {
    hsnCode: group.hsnCode,
    codeType: group.codeType,
    description: group.description,
    ratePercent: group.ratePercent,
    uqcCode,
    isMixedUnit,
    quantity: group.quantity,
    taxableAmount: group.taxableAmount,
    cgst: group.cgst,
    sgst: group.sgst,
    igst: group.igst,
    cess: group.cess,
    totalAmount: group.totalAmount,
  };
}

function sortRows(rows: HsnSummaryRow[]): HsnSummaryRow[] {
  const assigned = rows
    .filter((row) => row.hsnCode !== null)
    .sort((a, b) => {
      const byCode = a.hsnCode!.localeCompare(b.hsnCode!);
      if (byCode !== 0) {
        return byCode;
      }
      return (a.ratePercent ?? 0) - (b.ratePercent ?? 0);
    });
  const unassigned = rows.filter((row) => row.hsnCode === null);
  // "No HSN Assigned" always renders last (UI) — appended after every assigned row regardless of sort order.
  return [...assigned, ...unassigned];
}

/**
 * Groups `getOutwardSupplyLines`' (57-gst-registers.md) product-bearing lines
 * by `(hsnCode, codeType, ratePercent)` for GSTR-1's Table 12
 * (60-hsn-summary.md). Credit Note/Debit Note lines (no `productId`) are
 * excluded entirely; a product-bearing line whose product has no
 * `hsnCodeId` lands in the single "No HSN Assigned" bucket instead of being
 * dropped.
 */
function buildHsnSummaryRows(lines: readonly GstSupplyLine[], productInfoById: Map<string, ProductInfo>): HsnSummaryRow[] {
  const groups = new Map<string, GroupAccumulator>();

  for (const line of lines) {
    if (line.productId === null || line.quantity === null) {
      continue;
    }

    const info = productInfoById.get(line.productId);
    const hsnCode = info?.hsnCode ?? null;
    const key = groupKey(hsnCode, info?.codeType ?? null, line.ratePercent);

    const existing = groups.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      existing.taxableAmount += line.taxableAmount;
      existing.cgst += line.cgst;
      existing.sgst += line.sgst;
      existing.igst += line.igst;
      existing.cess += line.cess;
      existing.totalAmount += line.totalAmount;
      if (info) {
        existing.unitLabels.push(info.unitLabel);
      }
      continue;
    }

    groups.set(key, {
      hsnCode,
      codeType: hsnCode === null ? null : (info?.codeType ?? null),
      description: hsnCode === null ? null : (info?.description ?? null),
      ratePercent: hsnCode === null ? null : line.ratePercent,
      quantity: line.quantity,
      taxableAmount: line.taxableAmount,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      cess: line.cess,
      totalAmount: line.totalAmount,
      unitLabels: info ? [info.unitLabel] : [],
    });
  }

  return sortRows([...groups.values()].map(toRow));
}

function sumTotals(rows: readonly HsnSummaryRow[]): GstRegisterTotals {
  return rows.reduce<GstRegisterTotals>(
    (totals, row) => ({
      taxableAmount: totals.taxableAmount + row.taxableAmount,
      cgst: totals.cgst + row.cgst,
      sgst: totals.sgst + row.sgst,
      igst: totals.igst + row.igst,
      cess: totals.cess + row.cess,
      totalAmount: totals.totalAmount + row.totalAmount,
    }),
    ZERO_TOTALS
  );
}

export const hsnSummaryService = {
  async getHsnSummary(filters: GstReportFilters): Promise<HsnSummaryResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "gst", "view");

    const allLines = await gstReportEngine.getOutwardSupplyLines(user.companyId, filters.from, filters.to);
    const lines = allLines.filter((line) => matchesOptionalGstReportFilters(line, filters));

    const productIds = [...new Set(lines.map((line) => line.productId).filter((id): id is string => id !== null))];
    const productInfoById = await loadProductInfo(user.companyId, productIds);

    const rows = buildHsnSummaryRows(lines, productInfoById);
    return { rows, totals: sumTotals(rows) };
  },
};
