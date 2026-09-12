import Link from "next/link";
import { redirect } from "next/navigation";
import { ListOrdered, Package, RotateCcw, Users } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const SALES_REPORT_VIEWS = [
  { href: "/reports/sales/register", icon: ListOrdered, title: "Sales Register", description: "Every posted Sales Invoice within a date range." },
  { href: "/reports/sales/item-wise", icon: Package, title: "Item-wise Sales", description: "Quantity and value sold, grouped by product." },
  { href: "/reports/sales/party-wise", icon: Users, title: "Party-wise Sales Summary", description: "Sales value grouped by customer, Walk-in, and Quick Customer." },
  { href: "/reports/sales/returns", icon: RotateCcw, title: "Sales Return Summary", description: "Every sales return within a date range." },
] as const;

export default async function SalesReportsHubPage() {
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
          <h1 className="text-xl font-semibold text-foreground">Sales Reports</h1>
          <p className="text-sm text-muted-foreground">
            Read-only presentation over posted Sales Invoices and Sales Returns.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SALES_REPORT_VIEWS.map((view) => (
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
