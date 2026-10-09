// GSTR-1 offline-tool rows for Table 7 (b2cs) and Table 12 (hsn(b2c)).
// Pure: no I/O, no permission checks — the calling service supplies
// already-classified lines (B2C only) and the product lookup.

import type { GstSupplyLine } from "@/engines/gst/gst-report-types";

import type { DocumentSeriesRow } from "./documents-issued";
import { assertPortalRate, toPosLabel, toUqcLabel } from "./portal-masters";

/** Money/quantity precision the GST import accepts. */
const DECIMAL_PLACES_FACTOR = 100;
/** HSN/SAC prefix that marks a service (UQC and quantity are blank for these). */
const SERVICE_HSN_PREFIX = "99";

export interface B2csRow {
  /** `OE` = other than e-commerce. E-commerce sales are not tracked by this app. */
  type: "OE";
  placeOfSupply: string;
  ratePercent: number;
  taxableValue: number;
  cessAmount: number;
}

export interface HsnB2cRow {
  hsnCode: string;
  description: string;
  /** null for services (HSN starting 99), which the portal allows blank. */
  uqc: string | null;
  totalQuantity: number | null;
  totalValue: number;
  ratePercent: number;
  taxableValue: number;
  integratedTax: number;
  centralTax: number;
  stateTax: number;
  cess: number;
}

export interface Gstr1OfflineData {
  b2cs: B2csRow[];
  hsnB2c: HsnB2cRow[];
  docs: DocumentSeriesRow[];
}

/** The part of a consolidated (place-of-supply, rate) GSTR-1 group that Table 7 needs. */
export interface ConsolidatedSupply {
  placeOfSupplyStateCode: string;
  ratePercent: number;
  taxableAmount: number;
  cess: number;
}

/** The part of a product lookup row that Table 12 needs. */
export interface HsnProductInfo {
  hsnCode: string | null;
  codeType: string | null;
  description: string | null;
  /** UQC code, or the unit symbol when no UQC code is configured. */
  unitLabel: string;
}

export function roundMoney(value: number): number {
  // Round the magnitude so a negative (return/credit) value rounds exactly like its positive twin;
  // Number.EPSILON nudges half-cent binary artefacts (1.005) upward first.
  const rounded = Math.round((Math.abs(value) + Number.EPSILON) * DECIMAL_PLACES_FACTOR) / DECIMAL_PLACES_FACTOR;
  return value < 0 ? -rounded : rounded;
}

/**
 * Table 7 rows: one per (place of supply, rate), summed across every group
 * passed in (small-B2C invoices/returns plus unregistered credit/debit notes,
 * so notes net against the supplies they correct). Rate-0 groups are skipped —
 * nil-rated supplies belong to Table 8, not Table 7. Rows that net to zero are
 * dropped.
 */
export function buildB2csRows(groups: readonly ConsolidatedSupply[]): B2csRow[] {
  const byKey = new Map<string, ConsolidatedSupply>();
  for (const group of groups) {
    if (group.ratePercent === 0) continue;
    const key = `${group.placeOfSupplyStateCode}|${group.ratePercent}`;
    const existing = byKey.get(key);
    byKey.set(key, {
      placeOfSupplyStateCode: group.placeOfSupplyStateCode,
      ratePercent: group.ratePercent,
      taxableAmount: (existing?.taxableAmount ?? 0) + group.taxableAmount,
      cess: (existing?.cess ?? 0) + group.cess,
    });
  }

  return [...byKey.values()]
    .map((group) => ({
      type: "OE" as const,
      placeOfSupply: toPosLabel(group.placeOfSupplyStateCode),
      ratePercent: assertPortalRate(group.ratePercent),
      taxableValue: roundMoney(group.taxableAmount),
      cessAmount: roundMoney(group.cess),
    }))
    .filter((row) => row.taxableValue !== 0 || row.cessAmount !== 0)
    .sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply) || a.ratePercent - b.ratePercent);
}

interface HsnAccumulator {
  hsnCode: string;
  description: string;
  uqc: string | null;
  isService: boolean;
  ratePercent: number;
  quantity: number;
  totalValue: number;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface HsnB2cBuildResult {
  rows: HsnB2cRow[];
  /** Products on the supplied lines that have no HSN/SAC code — the portal rejects those rows. */
  productIdsWithoutHsn: string[];
}

function isServiceCode(hsnCode: string, codeType: string | null): boolean {
  return codeType === "SAC" || hsnCode.startsWith(SERVICE_HSN_PREFIX);
}

/**
 * Table 12 (B2C) rows: product-bearing lines grouped by (HSN, rate, UQC).
 * Returns net against sales in the same group (their lines are negative).
 * Products with no HSN are reported back rather than silently bucketed.
 */
export function buildHsnB2cRows(lines: readonly GstSupplyLine[], productInfoById: ReadonlyMap<string, HsnProductInfo>): HsnB2cBuildResult {
  const groups = new Map<string, HsnAccumulator>();
  const withoutHsn = new Set<string>();

  for (const line of lines) {
    if (line.productId === null || line.quantity === null) continue;

    const info = productInfoById.get(line.productId);
    if (!info?.hsnCode) {
      withoutHsn.add(line.productId);
      continue;
    }

    const isService = isServiceCode(info.hsnCode, info.codeType);
    const uqc = isService ? null : toUqcLabel(info.unitLabel);
    const key = `${info.hsnCode}|${line.ratePercent}|${uqc ?? ""}`;
    const existing = groups.get(key);

    groups.set(key, {
      hsnCode: info.hsnCode,
      description: info.description ?? "",
      uqc,
      isService,
      ratePercent: line.ratePercent,
      quantity: (existing?.quantity ?? 0) + line.quantity,
      totalValue: (existing?.totalValue ?? 0) + line.totalAmount,
      taxable: (existing?.taxable ?? 0) + line.taxableAmount,
      igst: (existing?.igst ?? 0) + line.igst,
      cgst: (existing?.cgst ?? 0) + line.cgst,
      sgst: (existing?.sgst ?? 0) + line.sgst,
      cess: (existing?.cess ?? 0) + line.cess,
    });
  }

  const rows = [...groups.values()]
    .map<HsnB2cRow>((group) => ({
      hsnCode: group.hsnCode,
      description: group.description,
      uqc: group.uqc,
      totalQuantity: group.isService ? null : roundMoney(group.quantity),
      totalValue: roundMoney(group.totalValue),
      ratePercent: assertPortalRate(group.ratePercent),
      taxableValue: roundMoney(group.taxable),
      integratedTax: roundMoney(group.igst),
      centralTax: roundMoney(group.cgst),
      stateTax: roundMoney(group.sgst),
      cess: roundMoney(group.cess),
    }))
    .filter((row) => row.taxableValue !== 0 || row.totalValue !== 0 || (row.totalQuantity ?? 0) !== 0)
    .sort((a, b) => a.hsnCode.localeCompare(b.hsnCode) || a.ratePercent - b.ratePercent);

  return { rows, productIdsWithoutHsn: [...withoutHsn] };
}
