import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompany } from "@/lib/current-company";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentBranch } from "@/lib/current-branch";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { branchService } from "@/modules/branch/services/branch-service";
import { AlertList } from "@/modules/dashboard/components/alert-list";
import { dashboardService } from "@/modules/dashboard/services/dashboard-service";
import { DashboardEmptyState } from "@/modules/dashboard/components/dashboard-empty-state";
import { GstSummaryTile } from "@/modules/dashboard/components/gst-summary-tile";
import { KpiTile } from "@/modules/dashboard/components/kpi-tile";
import { OutstandingTile } from "@/modules/dashboard/components/outstanding-tile";
import { PendingDocumentsTile } from "@/modules/dashboard/components/pending-documents-tile";
import { QuickActionsGrid } from "@/modules/dashboard/components/quick-actions-grid";
import { RecentActivityFeed } from "@/modules/dashboard/components/recent-activity-feed";
import { SalesPurchaseTrendTable } from "@/modules/dashboard/components/sales-purchase-trend-table";
import { TopPerformersTable } from "@/modules/dashboard/components/top-performers-table";
import type { AlertItem, DashboardWidget, LowStockData } from "@/types/dashboard";

/** AlertList renders a uniform `AlertItem[]`, but Low Stock's own widget
 * carries richer data (shortfall, warehouse) for its own KPI-style use
 * elsewhere — this maps its top rows into the shared alert shape for
 * display here, without changing the underlying widget's own type. */
function toLowStockAlerts(widget: DashboardWidget<LowStockData>): DashboardWidget<AlertItem[]> {
  if (widget.state !== "ok") {
    return widget;
  }
  return {
    state: "ok",
    data: widget.data.top.map((row) => ({
      id: row.productId,
      message: `${row.productName}${row.warehouseName ? ` (${row.warehouseName})` : ""} — short by ${row.shortfall}`,
      href: row.href,
    })),
  };
}

export default async function Home() {
  const company = await getCurrentCompany();

  if (!company) {
    redirect("/company/select");
  }

  const financialYear = await getCurrentFinancialYear();

  if (!financialYear) {
    redirect("/financial-year/select");
  }

  // Unlike Company/Financial Year, a null branch is only a redirect when the
  // company actually has selectable branches — a company with zero active
  // branches is a fully-supported state and must render normally
  // (12-branch-management.md's Branch Selection rules).
  const branch = await getCurrentBranch();
  if (!branch) {
    const selectableBranches = await branchService.listSelectableBranches();
    if (selectableBranches.length > 0) {
      redirect("/branch/select");
    }
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  const user = await getCurrentCompanyUser();
  const canViewDashboard = await hasPermission(user, "dashboard", "view");
  if (!canViewDashboard) {
    // Every other permission-gated page redirects to "/" on failure — this
    // *is* "/", so there is nowhere safe to bounce to. Render an in-page
    // message instead (this only happens for a custom role that removed
    // dashboard:view, which every default role is seeded with).
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="p-6">
          <DashboardEmptyState message="You do not have permission to view the Dashboard. Contact your Company Admin." />
        </div>
      </AppShell>
    );
  }

  const dashboard = await dashboardService.getDashboard();

  // Every widget the page can render, not just the ones shown in the "hasAnyData"
  // grid section below — omitting pendingDocuments/negativeStockRisk/
  // overdueReceivables/gstFilingDue here would suppress those independently-gated
  // widgets for a custom role permitted on only one of them (e.g. inventory:view
  // without reports:view) even though they're the only widgets it can see.
  const allWidgets = [
    dashboard.salesKpi,
    dashboard.purchaseKpi,
    dashboard.cashAndBank,
    dashboard.receivables,
    dashboard.payables,
    dashboard.lowStock,
    dashboard.monthlyProfit,
    dashboard.gstSummary,
    dashboard.topCustomers,
    dashboard.topProducts,
    dashboard.topSuppliers,
    dashboard.pendingDocuments,
    dashboard.overdueReceivables,
    dashboard.gstFilingDue,
    dashboard.negativeStockRisk,
    dashboard.recentActivity,
  ];

  const hasAnyData = allWidgets.some((widget) => widget.state === "ok");
  const hasAnyPermittedWidget = allWidgets.some((widget) => widget.state !== "no-permission");

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your business at a glance.</p>
        </div>

        {!hasAnyPermittedWidget && dashboard.quickActions.length === 0 ? (
          <DashboardEmptyState message="Your role doesn't include access to any dashboard widgets yet — contact your Company Admin if you believe this is a mistake." />
        ) : null}

        {hasAnyPermittedWidget ? (
          <>
            {!hasAnyData ? (
              <DashboardEmptyState message="No transactions recorded yet — start with a Sales Invoice or a Purchase Invoice from Quick Actions below." />
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <KpiTile
                title="Sales"
                href="/reports/sales/register"
                widget={dashboard.salesKpi}
                primaryField="today"
                primaryLabel="Today"
                secondary={{ field: "monthToDate", label: "MTD" }}
              />
              <KpiTile
                title="Purchase"
                href="/reports/purchase/register"
                widget={dashboard.purchaseKpi}
                primaryField="today"
                primaryLabel="Today"
                secondary={{ field: "monthToDate", label: "MTD" }}
              />
              <KpiTile
                title="Cash & Bank Balance"
                href="/reports/cash-flow"
                widget={dashboard.cashAndBank}
                primaryField="balance"
                primaryLabel="Current balance"
              />
              <OutstandingTile title="Receivables" href="/reports/customers/outstanding" widget={dashboard.receivables} />
              <OutstandingTile title="Payables" href="/reports/suppliers/outstanding" widget={dashboard.payables} />
            </div>

            <AlertList
              sections={[
                { label: "Low Stock", widget: toLowStockAlerts(dashboard.lowStock) },
                { label: "Overdue Receivables", widget: dashboard.overdueReceivables },
                { label: "GST Filing Due", widget: dashboard.gstFilingDue },
                { label: "Negative Stock Risk", widget: dashboard.negativeStockRisk },
              ]}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h2 className="mb-2 text-lg font-semibold text-foreground">Monthly Sales &amp; Purchase Trend</h2>
                <SalesPurchaseTrendTable sales={dashboard.salesTrend} purchase={dashboard.purchaseTrend} />
              </div>
              <KpiTile
                title="Monthly Profit (FY-to-date)"
                href="/reports/profit-and-loss"
                widget={dashboard.monthlyProfit}
                primaryField="netProfit"
                primaryLabel="Net profit"
              />
            </div>

            <GstSummaryTile widget={dashboard.gstSummary} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TopPerformersTable title="Top Customers" valueLabel="Sales Value" widget={dashboard.topCustomers} />
              <TopPerformersTable title="Top Products" valueLabel="Sales Value" widget={dashboard.topProducts} />
              <TopPerformersTable title="Top Suppliers" valueLabel="Purchase Value" widget={dashboard.topSuppliers} />
            </div>

            <PendingDocumentsTile widget={dashboard.pendingDocuments} />
          </>
        ) : null}

        {dashboard.quickActions.length > 0 ? (
          <div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Quick Actions</h2>
            <QuickActionsGrid actions={dashboard.quickActions} />
          </div>
        ) : null}

        {dashboard.recentActivity.state !== "no-permission" ? (
          <div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Recent Documents</h2>
            <RecentActivityFeed widget={dashboard.recentActivity} />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
