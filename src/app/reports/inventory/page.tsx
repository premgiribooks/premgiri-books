import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, History, Package, Wallet } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const INVENTORY_REPORT_VIEWS = [
  { href: "/reports/inventory/current-stock", icon: Package, title: "Current Stock", description: "Stock on hand by product and warehouse." },
  { href: "/reports/inventory/ledger", icon: History, title: "Stock Ledger", description: "Dated movement history for one product, with running balance." },
  { href: "/reports/inventory/valuation", icon: Wallet, title: "Stock Valuation", description: "Stock valued at Latest Purchase Cost." },
  { href: "/reports/inventory/low-stock", icon: AlertTriangle, title: "Low Stock / Reorder", description: "Products below their configured minimum stock level." },
] as const;

export default async function InventoryReportsHubPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Inventory Reports</h1>
          <p className="text-sm text-muted-foreground">
            Read-only presentation over the Inventory Engine&apos;s stock-query primitives.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INVENTORY_REPORT_VIEWS.map((view) => (
            <Link key={view.href} href={view.href}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      <view.icon size={20} />
                    </div>
                    <CardTitle>{view.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{view.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
