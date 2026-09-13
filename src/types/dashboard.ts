import type { MonthBucket } from "@/engines/reporting/dashboard-summary";
import type { GstFilingStatus } from "@prisma/client";

// 85-dashboard.md — the ERP Dashboard's own response shapes. Every widget is
// a discriminated union so "the caller lacks the permission for this widget"
// (omitted key would be indistinguishable from "not yet loaded" in a plain
// object) is a distinct, testable state from "no data exists yet" and from
// "the underlying query failed" — never collapsed into a bare null/0.

export type DashboardWidgetState = "ok" | "empty" | "no-permission" | "unavailable";

export interface DashboardWidgetOk<T> {
  state: "ok";
  data: T;
}

/** No rows exist at all — distinct from `ok` with a zero value (see
 * 85-dashboard.md's "no misleading zeroes" rule). Carries its own
 * module-specific sentence rather than one generic message. */
export interface DashboardWidgetEmpty {
  state: "empty";
  message: string;
}

/** The caller lacks the permission this widget requires — omitted from the
 * rendered page entirely, never rendered greyed-out or erroring. */
export interface DashboardWidgetNoPermission {
  state: "no-permission";
}

/** The underlying query threw — this widget's own failure must never take
 * down the rest of the page (Promise.allSettled semantics). */
export interface DashboardWidgetUnavailable {
  state: "unavailable";
  message: string;
}

export type DashboardWidget<T> =
  | DashboardWidgetOk<T>
  | DashboardWidgetEmpty
  | DashboardWidgetNoPermission
  | DashboardWidgetUnavailable;

export interface SalesPurchaseKpiData {
  today: number;
  monthToDate: number;
  invoiceCountMonthToDate: number;
}

export interface CashAndBankData {
  balance: number;
}

export interface OutstandingPartyRow {
  id: string;
  name: string;
  /** Always rendered positive — direction (owed to us / owed by us) is
   * implied by which widget this row appears in, per the source report's own
   * signed convention (see supplier-report.ts's doc comment). */
  amount: number;
  href: string | null;
}

export interface OutstandingData {
  total: number;
  top: OutstandingPartyRow[];
}

export interface LowStockAlertRow {
  productId: string;
  productName: string;
  warehouseName: string | null;
  shortfall: number;
  href: string;
}

export interface LowStockData {
  count: number;
  top: LowStockAlertRow[];
}

export interface MonthlyProfitData {
  netProfit: number;
}

export interface GstSummaryData {
  outputTax: number;
  inputTax: number;
  netLiability: number;
  /** The most recent bucketed month's Filed/Open status; null when no month
   * was bucketed at all (nothing posted yet) or no GstFilingRecord matches. */
  latestMonthStatus: GstFilingStatus | null;
}

export interface TopPerformerRow {
  id: string | null;
  name: string;
  value: number;
  /** Null for a row with no detail page to link to (e.g. Walk-in/Quick-
   * customer synthetic buckets) — rendered unlinked, never a dead link. */
  href: string | null;
}

export interface PendingDocumentsData {
  sales: number;
  purchase: number;
  /** Draft `StockAdjustment` + `StockTransfer` rows — Voucher (and every
   * manual-voucher screen built on it) has no DRAFT status at all, so
   * "pending" has no meaning on the accounting side (see the dashboard
   * service's own note). */
  inventory: number;
}

export interface AlertItem {
  id: string;
  message: string;
  href: string;
}

export interface RecentActivityItem {
  id: string;
  label: string;
  documentNumber: string;
  partyName: string | null;
  createdAt: Date;
  href: string;
}

export interface QuickAction {
  label: string;
  href: string;
}

export interface DashboardData {
  salesKpi: DashboardWidget<SalesPurchaseKpiData>;
  purchaseKpi: DashboardWidget<SalesPurchaseKpiData>;
  cashAndBank: DashboardWidget<CashAndBankData>;
  receivables: DashboardWidget<OutstandingData>;
  payables: DashboardWidget<OutstandingData>;
  lowStock: DashboardWidget<LowStockData>;
  salesTrend: DashboardWidget<MonthBucket[]>;
  purchaseTrend: DashboardWidget<MonthBucket[]>;
  monthlyProfit: DashboardWidget<MonthlyProfitData>;
  gstSummary: DashboardWidget<GstSummaryData>;
  topCustomers: DashboardWidget<TopPerformerRow[]>;
  topProducts: DashboardWidget<TopPerformerRow[]>;
  topSuppliers: DashboardWidget<TopPerformerRow[]>;
  pendingDocuments: DashboardWidget<PendingDocumentsData>;
  overdueReceivables: DashboardWidget<AlertItem[]>;
  gstFilingDue: DashboardWidget<AlertItem[]>;
  negativeStockRisk: DashboardWidget<AlertItem[]>;
  recentActivity: DashboardWidget<RecentActivityItem[]>;
  quickActions: QuickAction[];
}
