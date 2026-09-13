import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser, type CompanyCurrentUser } from "@/lib/current-user";
import { getCashAndBankLedgerIds } from "@/lib/ledger-class";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import { bucketByMonth, topN, type MonthBucket } from "@/engines/reporting/dashboard-summary";
import { customerReportService } from "@/modules/reports/customers/services/customer-report-service";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import { salesReportService } from "@/modules/reports/sales/services/sales-report-service";
import { gstReportsService } from "@/modules/reports/services/gst-reports-service";
import { profitAndLossService } from "@/modules/reports/services/profit-and-loss-service";
import { supplierReportService } from "@/modules/reports/suppliers/services/supplier-report-service";
import { resolveDefaultAsOfDate, toCalendarDateString, toUtcDate } from "@/modules/reports/validation/financial-report-filters-schema";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";
import type { FinancialYear } from "@/types/financial-year";
import type {
  AlertItem,
  CashAndBankData,
  DashboardData,
  DashboardWidget,
  GstSummaryData,
  LowStockData,
  MonthlyProfitData,
  OutstandingData,
  PendingDocumentsData,
  QuickAction,
  RecentActivityItem,
  SalesPurchaseKpiData,
  TopPerformerRow,
} from "@/types/dashboard";
import type { PurchaseInvoiceListRow } from "@/types/purchase-invoice";
import type { SalesInvoiceListRow } from "@/types/sales-invoice";

const TOP_N_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 10;
const RECENT_ACTIVITY_PER_SOURCE_LIMIT = 5;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ok<T>(data: T): DashboardWidgetResult<T> {
  return { state: "ok", data };
}

function empty<T>(message: string): DashboardWidgetResult<T> {
  return { state: "empty", message };
}

function noPermission<T>(): DashboardWidgetResult<T> {
  return { state: "no-permission" };
}

function unavailable<T>(message = "This widget could not be loaded."): DashboardWidgetResult<T> {
  return { state: "unavailable", message };
}

// Re-exported shape alias purely for local readability — identical to
// DashboardWidget<T>.
type DashboardWidgetResult<T> = DashboardWidget<T>;

/**
 * Runs `fetch()` only if `permitted`; any thrown error becomes an
 * `unavailable` slot instead of failing the whole dashboard
 * (Promise.allSettled semantics per 85-dashboard.md's Architecture section —
 * one widget's failure must never block the rest of the page).
 */
async function settle<T>(permitted: boolean, fetch: () => Promise<DashboardWidgetResult<T>>): Promise<DashboardWidgetResult<T>> {
  if (!permitted) {
    return noPermission<T>();
  }
  try {
    return await fetch();
  } catch (error) {
    logger.error({ err: error }, "dashboard widget fetch failed");
    return unavailable<T>();
  }
}

interface Permissions {
  sales: boolean;
  purchase: boolean;
  inventory: boolean;
  accounting: boolean;
  gst: boolean;
  reports: boolean;
}

async function resolvePermissions(user: CompanyCurrentUser): Promise<Permissions> {
  const [sales, purchase, inventory, accounting, gst, reports] = await Promise.all([
    hasPermission(user, "sales", "view"),
    hasPermission(user, "purchase", "view"),
    hasPermission(user, "inventory", "view"),
    hasPermission(user, "accounting", "view"),
    hasPermission(user, "gst", "view"),
    hasPermission(user, "reports", "view"),
  ]);
  return { sales, purchase, inventory, accounting, gst, reports };
}

function allUnavailableDueToNoFinancialYear(): DashboardData {
  const message = "Select a Financial Year to see Dashboard figures.";
  return {
    salesKpi: unavailable(message),
    purchaseKpi: unavailable(message),
    cashAndBank: unavailable(message),
    receivables: unavailable(message),
    payables: unavailable(message),
    lowStock: unavailable(message),
    salesTrend: unavailable(message),
    purchaseTrend: unavailable(message),
    monthlyProfit: unavailable(message),
    gstSummary: unavailable(message),
    topCustomers: unavailable(message),
    topProducts: unavailable(message),
    topSuppliers: unavailable(message),
    pendingDocuments: unavailable(message),
    overdueReceivables: unavailable(message),
    gstFilingDue: unavailable(message),
    negativeStockRisk: unavailable(message),
    recentActivity: unavailable(message),
    quickActions: [],
  };
}

function invoiceTotal(rows: readonly { grandTotal: number }[]): number {
  return round2(rows.reduce((sum, row) => sum + row.grandTotal, 0));
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
  );
}

function buildSalesPurchaseKpi(rows: readonly { grandTotal: number; invoiceDate: Date }[], today: Date): DashboardWidgetResult<SalesPurchaseKpiData> {
  if (rows.length === 0) {
    return empty("No invoices recorded yet this financial year.");
  }
  const todaysRows = rows.filter((row) => isSameUtcDay(row.invoiceDate, today));
  return ok({
    today: invoiceTotal(todaysRows),
    monthToDate: invoiceTotal(rows.filter((row) => row.invoiceDate.getUTCMonth() === today.getUTCMonth() && row.invoiceDate.getUTCFullYear() === today.getUTCFullYear())),
    invoiceCountMonthToDate: rows.filter((row) => row.invoiceDate.getUTCMonth() === today.getUTCMonth() && row.invoiceDate.getUTCFullYear() === today.getUTCFullYear()).length,
  });
}

async function fetchCashAndBank(companyId: string, asOfDate: Date): Promise<DashboardWidgetResult<CashAndBankData>> {
  const ledgerIds = [...(await getCashAndBankLedgerIds(companyId))];
  if (ledgerIds.length === 0) {
    return empty("No Cash-in-Hand or bank-linked ledgers are configured yet.");
  }
  const balances = await Promise.all(ledgerIds.map((ledgerId) => voucherQueries.getLedgerBalance(companyId, ledgerId, asOfDate)));
  const balance = round2(balances.reduce((sum, result) => sum + result.closingBalance, 0));
  return ok({ balance });
}

async function fetchOutstanding<Row extends { outstandingBalance: number }>(
  rows: readonly Row[],
  getId: (row: Row) => string,
  getName: (row: Row) => string,
  getHref: (row: Row) => string | null,
  emptyMessage: string,
  signFlip: boolean
): Promise<DashboardWidgetResult<OutstandingData>> {
  if (rows.length === 0) {
    return empty(emptyMessage);
  }
  const signed = rows.map((row) => (signFlip ? -row.outstandingBalance : row.outstandingBalance));
  const total = round2(signed.reduce((sum, value) => sum + value, 0));
  const top = topN(
    rows.map((row, index) => ({ row, amount: signed[index] })),
    (entry) => entry.amount,
    TOP_N_LIMIT
  ).map((entry) => ({ id: getId(entry.row), name: getName(entry.row), amount: entry.amount, href: getHref(entry.row) }));
  return ok({ total, top });
}

async function fetchLowStock(): Promise<DashboardWidgetResult<LowStockData>> {
  const report = await inventoryReportService.getLowStockReport({});
  if (report.rows.length === 0) {
    return empty("No products are below their minimum stock level.");
  }
  const top = topN(report.rows, (row) => row.shortfall, TOP_N_LIMIT).map((row) => ({
    productId: row.productId,
    productName: row.productName,
    warehouseName: row.warehouseName,
    shortfall: row.shortfall,
    href: `/reports/inventory/low-stock`,
  }));
  return ok({ count: report.rows.length, top });
}

async function fetchMonthlyProfit(financialYearId: string, from: string, to: string): Promise<DashboardWidgetResult<MonthlyProfitData>> {
  const report = await profitAndLossService.getProfitAndLoss({ financialYearId, from, to });
  return ok({ netProfit: round2(report.netProfit) });
}

async function fetchGstSummary(from: string, to: string): Promise<DashboardWidgetResult<GstSummaryData>> {
  const report = await gstReportsService.getGstDashboard({ from, to });
  if (report.months.length === 0) {
    return empty("No GST-relevant supplies recorded yet in this period.");
  }
  const latest = report.months[report.months.length - 1];
  return ok({
    outputTax: report.totals.outputTax,
    inputTax: report.totals.inputTax,
    netLiability: report.totals.netLiability,
    latestMonthStatus: latest.status,
  });
}

async function fetchTopCustomers(dateFrom: string, dateTo: string): Promise<DashboardWidgetResult<TopPerformerRow[]>> {
  const report = await customerReportService.getCustomerSalesSummary({ dateFrom, dateTo });
  if (report.rows.length === 0) {
    return empty("No sales recorded yet this financial year.");
  }
  const top = topN(report.rows, (row) => row.grandTotal, TOP_N_LIMIT).map((row) => ({
    id: row.customerId,
    name: row.customerName,
    value: row.grandTotal,
    // Walk-in/Quick-customer synthetic buckets carry no customerId, hence no
    // detail page to link to — rendered unlinked (TopPerformersTable's own
    // convention), never a dead link.
    href: row.customerId ? `/reports/customers/statement?customerId=${row.customerId}` : null,
  }));
  return ok(top);
}

async function fetchTopProducts(dateFrom: string, dateTo: string): Promise<DashboardWidgetResult<TopPerformerRow[]>> {
  const report = await salesReportService.getItemWiseSalesReport({ dateFrom, dateTo });
  if (report.rows.length === 0) {
    return empty("No sales recorded yet this financial year.");
  }
  const top = topN(report.rows, (row) => row.totalValue, TOP_N_LIMIT).map((row) => ({
    id: row.productId,
    name: row.productName,
    value: row.totalValue,
    href: `/masters/products/${row.productId}`,
  }));
  return ok(top);
}

async function fetchTopSuppliers(dateFrom: string, dateTo: string): Promise<DashboardWidgetResult<TopPerformerRow[]>> {
  const report = await supplierReportService.getSupplierPurchaseSummary({ dateFrom, dateTo });
  if (report.rows.length === 0) {
    return empty("No purchases recorded yet this financial year.");
  }
  const top = topN(report.rows, (row) => row.grandTotal, TOP_N_LIMIT).map((row) => ({
    id: row.supplierId,
    name: row.supplierName,
    value: row.grandTotal,
    href: `/reports/suppliers/statement?supplierId=${row.supplierId}`,
  }));
  return ok(top);
}

async function fetchPendingDocuments(permissions: Permissions, companyId: string): Promise<DashboardWidgetResult<PendingDocumentsData>> {
  // Dedicated DRAFT-only count queries, gated purely on each module's own
  // `view` permission — deliberately NOT derived from the KPI/trend row
  // fetches above (those are additionally gated on `reports:view`, so a
  // sales:view-only role with no reports:view would otherwise see a false
  // "0 pending" instead of its real draft count). Voucher (and every
  // manual-voucher screen built on it — Payment/Receipt/Contra/Journal) has
  // no DRAFT status at all (VoucherStatus is POSTED | CANCELLED only), so
  // there is no "pending accounting document" concept to count — deliberately
  // not modeled here (85-dashboard.md spec-vs-code drift note D3).
  const [salesDraftCount, purchaseDraftCount, inventoryDraftCount] = await Promise.all([
    permissions.sales ? prisma.salesInvoice.count({ where: { companyId, status: "DRAFT" } }) : Promise.resolve(0),
    permissions.purchase ? prisma.purchaseInvoice.count({ where: { companyId, status: "DRAFT" } }) : Promise.resolve(0),
    permissions.inventory
      ? Promise.all([
          prisma.stockAdjustment.count({ where: { companyId, status: "DRAFT" } }),
          prisma.stockTransfer.count({ where: { companyId, status: "DRAFT" } }),
        ]).then(([adjustments, transfers]) => adjustments + transfers)
      : Promise.resolve(0),
  ]);

  const data: PendingDocumentsData = { sales: salesDraftCount, purchase: purchaseDraftCount, inventory: inventoryDraftCount };

  if (data.sales === 0 && data.purchase === 0 && data.inventory === 0) {
    return empty("No documents are currently in draft.");
  }
  return ok(data);
}

async function fetchOverdueReceivables(
  companyId: string,
  salesRows: readonly SalesInvoiceListRow[]
): Promise<DashboardWidgetResult<AlertItem[]>> {
  const postedWithCustomer = salesRows.filter((row) => row.status === "POSTED" && row.customer !== null);
  if (postedWithCustomer.length === 0) {
    return empty("No overdue receivables.");
  }

  const customers = await prisma.customer.findMany({
    where: { companyId },
    select: { id: true, creditDays: true },
  });
  const creditDaysByCustomerId = new Map(customers.map((customer) => [customer.id, customer.creditDays]));

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const alerts: AlertItem[] = [];
  for (const row of postedWithCustomer) {
    const outstanding = round2(row.grandTotal - row.amountPaid);
    if (outstanding <= 0) {
      continue;
    }
    const creditDays = row.customer ? creditDaysByCustomerId.get(row.customer.id) : null;
    if (creditDays === null || creditDays === undefined) {
      continue;
    }
    const dueDate = new Date(row.invoiceDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + creditDays);
    if (dueDate.getTime() >= today.getTime()) {
      continue;
    }
    alerts.push({
      id: row.id,
      message: `${row.customer?.name ?? "Customer"} — ${row.invoiceNumber ?? "invoice"} overdue since ${dueDate.toISOString().slice(0, 10)}`,
      href: `/sales/invoices/${row.id}`,
    });
  }

  if (alerts.length === 0) {
    return empty("No overdue receivables.");
  }
  return ok(alerts.slice(0, TOP_N_LIMIT * 2));
}

function fetchGstFilingDueAlert(gstSummaryState: DashboardWidgetResult<GstSummaryData>): DashboardWidgetResult<AlertItem[]> {
  if (gstSummaryState.state !== "ok") {
    return empty("Not available.");
  }
  if (gstSummaryState.data.latestMonthStatus !== "OPEN") {
    return empty("No GST filing currently due.");
  }
  return ok([{ id: "gst-filing-due", message: "The current GST period is still open for filing.", href: "/gst" }]);
}

async function fetchNegativeStockRisk(companyId: string): Promise<DashboardWidgetResult<AlertItem[]>> {
  const settings = await prisma.companySettings.findUnique({ where: { companyId }, select: { allowNegativeStock: true } });
  if (!settings?.allowNegativeStock) {
    return empty("Negative stock is not permitted for this company.");
  }
  // Reuses the Inventory Engine's own current-stock aggregation (already
  // IN-OUT netted, decimal->number normalized) rather than re-deriving net
  // quantity from raw StockTransaction rows — no new aggregation query, per
  // 85-dashboard.md's Widget mapping table.
  const currentStock = await inventoryEngine.getCurrentStock(companyId, {});
  const negativeRows = currentStock.filter((row) => row.quantity < 0);
  if (negativeRows.length === 0) {
    return empty("No products currently at negative stock.");
  }
  return ok([
    {
      id: "negative-stock",
      message: `${negativeRows.length} product/warehouse combination(s) are at negative stock.`,
      href: "/reports/inventory/current-stock",
    },
  ]);
}

interface RecentActivitySource {
  label: string;
  hrefPrefix: string;
  permitted: boolean;
  fetch: () => Promise<
    { id: string; documentNumber: string | null; partyName: string | null; createdAt: Date; label?: string; hrefPrefix?: string }[]
  >;
}

/** Voucher has four distinct detail routes by `voucherType` (Payment/Receipt/
 * Contra/Journal) — a single static `hrefPrefix` would send every non-Payment
 * voucher to a 404 (`paymentVoucherService.getPaymentVoucher` rejects any
 * `voucherType !== "PAYMENT"`), so each row overrides both `label` and
 * `hrefPrefix` from its own `voucherType`. */
const VOUCHER_TYPE_ROUTE: Record<string, { label: string; hrefPrefix: string }> = {
  PAYMENT: { label: "Payment Voucher", hrefPrefix: "/accounting/payment-vouchers" },
  RECEIPT: { label: "Receipt Voucher", hrefPrefix: "/accounting/receipt-vouchers" },
  CONTRA: { label: "Contra Voucher", hrefPrefix: "/accounting/contra-vouchers" },
  JOURNAL: { label: "Journal Voucher", hrefPrefix: "/accounting/journal-vouchers" },
};

async function fetchRecentActivity(companyId: string, permissions: Permissions): Promise<DashboardWidgetResult<RecentActivityItem[]>> {
  const sources: RecentActivitySource[] = [
    {
      label: "Sales Invoice",
      hrefPrefix: "/sales/invoices",
      permitted: permissions.sales,
      fetch: () =>
        prisma.salesInvoice
          .findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: RECENT_ACTIVITY_PER_SOURCE_LIMIT,
            select: { id: true, invoiceNumber: true, createdAt: true, customer: { select: { ledger: { select: { name: true } } } } },
          })
          .then((rows) => rows.map((row) => ({ id: row.id, documentNumber: row.invoiceNumber, partyName: row.customer?.ledger.name ?? null, createdAt: row.createdAt }))),
    },
    {
      label: "Purchase Invoice",
      hrefPrefix: "/purchase/invoices",
      permitted: permissions.purchase,
      fetch: () =>
        prisma.purchaseInvoice
          .findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: RECENT_ACTIVITY_PER_SOURCE_LIMIT,
            select: { id: true, invoiceNumber: true, createdAt: true, supplier: { select: { ledger: { select: { name: true } } } } },
          })
          .then((rows) => rows.map((row) => ({ id: row.id, documentNumber: row.invoiceNumber, partyName: row.supplier?.ledger.name ?? null, createdAt: row.createdAt }))),
    },
    {
      label: "Voucher",
      hrefPrefix: "/accounting/payment-vouchers",
      permitted: permissions.accounting,
      // Manual voucher types only (Payment/Receipt/Contra/Journal) — every
      // other VoucherType (SALES, PURCHASE, SALES_RETURN, PURCHASE_RETURN,
      // CREDIT_NOTE, DEBIT_NOTE, SALARY) is the auto-posted accounting
      // artifact of a document already listed under its own source below
      // (e.g. a SALES voucher is the same real-world event as its Sales
      // Invoice row), and has no dedicated detail page of its own to link to.
      fetch: () =>
        prisma.voucher
          .findMany({
            where: { companyId, voucherType: { in: ["PAYMENT", "RECEIPT", "CONTRA", "JOURNAL"] } },
            orderBy: { createdAt: "desc" },
            take: RECENT_ACTIVITY_PER_SOURCE_LIMIT,
            select: { id: true, voucherNumber: true, voucherType: true, createdAt: true },
          })
          .then((rows) =>
            rows.map((row) => {
              const route = VOUCHER_TYPE_ROUTE[row.voucherType];
              return {
                id: row.id,
                documentNumber: row.voucherNumber,
                partyName: null,
                createdAt: row.createdAt,
                label: route?.label,
                hrefPrefix: route?.hrefPrefix,
              };
            })
          ),
    },
    {
      label: "Sales Return",
      hrefPrefix: "/sales/returns",
      permitted: permissions.sales,
      fetch: () =>
        prisma.salesReturn
          .findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: RECENT_ACTIVITY_PER_SOURCE_LIMIT,
            select: { id: true, returnNumber: true, createdAt: true, salesInvoice: { select: { customer: { select: { ledger: { select: { name: true } } } } } } },
          })
          .then((rows) => rows.map((row) => ({ id: row.id, documentNumber: row.returnNumber, partyName: row.salesInvoice.customer?.ledger.name ?? null, createdAt: row.createdAt }))),
    },
    {
      label: "Purchase Return",
      hrefPrefix: "/purchase/returns",
      permitted: permissions.purchase,
      fetch: () =>
        prisma.purchaseReturn
          .findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: RECENT_ACTIVITY_PER_SOURCE_LIMIT,
            select: { id: true, returnNumber: true, createdAt: true, purchaseInvoice: { select: { supplier: { select: { ledger: { select: { name: true } } } } } } },
          })
          .then((rows) => rows.map((row) => ({ id: row.id, documentNumber: row.returnNumber, partyName: row.purchaseInvoice.supplier.ledger.name, createdAt: row.createdAt }))),
    },
    {
      label: "Credit Note",
      hrefPrefix: "/sales/credit-notes",
      permitted: permissions.sales,
      fetch: () =>
        prisma.creditNote
          .findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: RECENT_ACTIVITY_PER_SOURCE_LIMIT,
            select: { id: true, noteNumber: true, createdAt: true, customer: { select: { ledger: { select: { name: true } } } } },
          })
          .then((rows) => rows.map((row) => ({ id: row.id, documentNumber: row.noteNumber, partyName: row.customer.ledger.name, createdAt: row.createdAt }))),
    },
    {
      label: "Debit Note",
      hrefPrefix: "/sales/debit-notes",
      permitted: permissions.sales,
      fetch: () =>
        prisma.debitNote
          .findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: RECENT_ACTIVITY_PER_SOURCE_LIMIT,
            select: { id: true, noteNumber: true, createdAt: true, customer: { select: { ledger: { select: { name: true } } } } },
          })
          .then((rows) => rows.map((row) => ({ id: row.id, documentNumber: row.noteNumber, partyName: row.customer.ledger.name, createdAt: row.createdAt }))),
    },
  ];

  const permittedSources = sources.filter((source) => source.permitted);
  if (permittedSources.length === 0) {
    return noPermission<RecentActivityItem[]>();
  }

  const results = await Promise.all(
    permittedSources.map(async (source) => {
      const rows = await source.fetch();
      return rows.map((row) => ({
        id: `${source.label}:${row.id}`,
        label: row.label ?? source.label,
        documentNumber: row.documentNumber ?? "Draft",
        partyName: row.partyName,
        createdAt: row.createdAt,
        href: `${row.hrefPrefix ?? source.hrefPrefix}/${row.id}`,
      }));
    })
  );

  const merged = results
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, RECENT_ACTIVITY_LIMIT);

  if (merged.length === 0) {
    return empty("No recent documents yet.");
  }
  return ok(merged);
}

const QUICK_ACTION_DEFINITIONS: (QuickAction & { module: keyof Permissions | "masters" | "accounting-approve" })[] = [
  { label: "New Sales Invoice", href: "/sales/invoices/new", module: "sales" },
  { label: "New Purchase Invoice", href: "/purchase/invoices/new", module: "purchase" },
  { label: "New Customer", href: "/masters/customers/new", module: "masters" },
  { label: "New Supplier", href: "/masters/suppliers/new", module: "masters" },
  { label: "New Product", href: "/masters/products/new", module: "masters" },
  { label: "Stock Adjustment", href: "/inventory/adjustments/new", module: "inventory" },
  { label: "Stock Transfer", href: "/inventory/transfers/new", module: "inventory" },
  { label: "Payment Voucher", href: "/accounting/payment-vouchers/new", module: "accounting" },
  { label: "Receipt Voucher", href: "/accounting/receipt-vouchers/new", module: "accounting" },
  { label: "Journal Voucher", href: "/accounting/journal-vouchers/new", module: "accounting-approve" },
  { label: "Open Reports", href: "/reports", module: "reports" },
  { label: "Open GST", href: "/gst", module: "gst" },
];

async function resolveQuickActions(user: CompanyCurrentUser, permissions: Permissions): Promise<QuickAction[]> {
  const [salesCreate, purchaseCreate, mastersCreate, inventoryCreate, accountingCreate, accountingApprove] = await Promise.all([
    hasPermission(user, "sales", "create"),
    hasPermission(user, "purchase", "create"),
    hasPermission(user, "masters", "create"),
    hasPermission(user, "inventory", "create"),
    hasPermission(user, "accounting", "create"),
    hasPermission(user, "accounting", "approve"),
  ]);

  const grants: Record<string, boolean> = {
    sales: salesCreate,
    purchase: purchaseCreate,
    masters: mastersCreate,
    inventory: inventoryCreate,
    accounting: accountingCreate,
    "accounting-approve": accountingApprove,
    reports: permissions.reports,
    gst: permissions.gst,
  };

  return QUICK_ACTION_DEFINITIONS.filter((action) => grants[action.module]).map(({ label, href }) => ({ label, href }));
}

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const user = await getCurrentCompanyUser();
    const [financialYear, permissions] = await Promise.all([getCurrentFinancialYear(), resolvePermissions(user)]);

    if (!financialYear) {
      return allUnavailableDueToNoFinancialYear();
    }

    return buildDashboard(user, user.companyId, financialYear, permissions);
  },
};

async function buildDashboard(
  user: CompanyCurrentUser,
  companyId: string,
  financialYear: FinancialYear,
  permissions: Permissions
): Promise<DashboardData> {
  const toDateString = resolveDefaultAsOfDate(financialYear);
  const asOfDate = toUtcDate(toDateString);
  const fromDateString = toCalendarDateString(financialYear.startDate);

  const canSeeSalesKpi = permissions.sales && permissions.reports;
  const canSeePurchaseKpi = permissions.purchase && permissions.reports;

  const [salesRowsResult, purchaseRowsResult] = await Promise.allSettled([
    canSeeSalesKpi
      ? salesInvoiceService.listSalesInvoicesForReport({ fromDate: financialYear.startDate, toDate: asOfDate })
      : Promise.resolve([] as SalesInvoiceListRow[]),
    canSeePurchaseKpi
      ? purchaseInvoiceService.listPurchaseInvoicesForReport({ fromDate: financialYear.startDate, toDate: asOfDate })
      : Promise.resolve([] as PurchaseInvoiceListRow[]),
  ]);

  const salesRows = salesRowsResult.status === "fulfilled" ? salesRowsResult.value : [];
  const purchaseRows = purchaseRowsResult.status === "fulfilled" ? purchaseRowsResult.value : [];
  const postedSalesRows = salesRows.filter((row) => row.status === "POSTED");
  const postedPurchaseRows = purchaseRows.filter((row) => row.status === "POSTED");

  const [
    salesKpi,
    purchaseKpi,
    cashAndBank,
    receivables,
    payables,
    lowStock,
    monthlyProfit,
    gstSummary,
    topCustomers,
    topProducts,
    topSuppliers,
    negativeStockRisk,
  ] = await Promise.all([
    settle(canSeeSalesKpi, async () => buildSalesPurchaseKpi(postedSalesRows, asOfDate)),
    settle(canSeePurchaseKpi, async () => buildSalesPurchaseKpi(postedPurchaseRows, asOfDate)),
    // Paired with reports:view (not accounting:view alone), unlike
    // getCashAndBankLedgerIds/getLedgerBalance's own internal gate — its
    // drill-down link (/reports/cash-flow) itself requires reports:view, so
    // an accounting-only role would otherwise see a tile whose own link 404s.
    settle(permissions.accounting && permissions.reports, () => fetchCashAndBank(companyId, asOfDate)),
    settle(permissions.reports && permissions.sales, async () => {
      const report = await customerReportService.getCustomerOutstandingReport({
        financialYearId: financialYear.id,
        asOfDate: toDateString,
        status: "active",
      });
      return fetchOutstanding(
        report.rows,
        (row) => row.customerId,
        (row) => row.customerName,
        (row) => `/reports/customers/statement?customerId=${row.customerId}`,
        "No outstanding receivables — every customer is settled.",
        false
      );
    }),
    settle(permissions.reports && permissions.purchase, async () => {
      const report = await supplierReportService.getSupplierOutstandingReport({
        financialYearId: financialYear.id,
        asOfDate: toDateString,
        status: "active",
      });
      return fetchOutstanding(
        report.rows,
        (row) => row.supplierId,
        (row) => row.supplierName,
        (row) => `/reports/suppliers/statement?supplierId=${row.supplierId}`,
        "No outstanding payables — every supplier is settled.",
        true
      );
    }),
    settle(permissions.inventory && permissions.reports, () => fetchLowStock()),
    settle(permissions.accounting && permissions.reports, () => fetchMonthlyProfit(financialYear.id, fromDateString, toDateString)),
    settle(permissions.gst && permissions.reports, () => fetchGstSummary(fromDateString, toDateString)),
    settle(permissions.reports && permissions.sales, () => fetchTopCustomers(fromDateString, toDateString)),
    settle(permissions.reports && permissions.sales, () => fetchTopProducts(fromDateString, toDateString)),
    settle(permissions.reports && permissions.purchase, () => fetchTopSuppliers(fromDateString, toDateString)),
    // Paired with reports:view too — its own drill-down link
    // (/reports/inventory/current-stock) requires it, mirroring Cash & Bank's
    // identical fix above and lowStock's own pre-existing double gate.
    settle(permissions.inventory && permissions.reports, () => fetchNegativeStockRisk(companyId)),
  ]);

  const salesTrend = canSeeSalesKpi
    ? postedSalesRows.length === 0
      ? empty<MonthBucket[]>("No sales recorded yet this financial year.")
      : ok(bucketByMonth(postedSalesRows, (row) => row.invoiceDate, (row) => row.grandTotal))
    : noPermission<MonthBucket[]>();

  const purchaseTrend = canSeePurchaseKpi
    ? postedPurchaseRows.length === 0
      ? empty<MonthBucket[]>("No purchases recorded yet this financial year.")
      : ok(bucketByMonth(postedPurchaseRows, (row) => row.invoiceDate, (row) => row.grandTotal))
    : noPermission<MonthBucket[]>();

  const canSeePendingDocuments = permissions.sales || permissions.purchase || permissions.inventory;
  const [pendingDocuments, overdueReceivables, recentActivity] = await Promise.all([
    settle(canSeePendingDocuments, () => fetchPendingDocuments(permissions, companyId)),
    settle(permissions.sales && permissions.reports, () => fetchOverdueReceivables(companyId, postedSalesRows)),
    settle(true, () => fetchRecentActivity(companyId, permissions)),
  ]);

  const gstFilingDue = fetchGstFilingDueAlert(gstSummary);
  const quickActions = await resolveQuickActions(user, permissions);

  return {
    salesKpi,
    purchaseKpi,
    cashAndBank,
    receivables,
    payables,
    lowStock,
    salesTrend,
    purchaseTrend,
    monthlyProfit,
    gstSummary,
    topCustomers,
    topProducts,
    topSuppliers,
    pendingDocuments,
    overdueReceivables,
    gstFilingDue,
    negativeStockRisk,
    recentActivity,
    quickActions,
  };
}
