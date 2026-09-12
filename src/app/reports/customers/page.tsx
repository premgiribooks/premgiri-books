import Link from "next/link";
import { redirect } from "next/navigation";
import { BookUser, FileClock, ShoppingBag, Wallet } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const CUSTOMER_REPORT_VIEWS = [
  { href: "/reports/customers/outstanding", icon: Wallet, title: "Outstanding", description: "Balance owed by each customer, compared against their credit limit." },
  { href: "/reports/customers/statement", icon: FileClock, title: "Statement", description: "Dated ledger entries with running balance for one customer." },
  { href: "/reports/customers/sales-summary", icon: ShoppingBag, title: "Sales Summary", description: "Sales value grouped by customer, for a chosen period." },
  { href: "/reports/customers/directory", icon: BookUser, title: "Directory", description: "Every customer's contact and GST details." },
] as const;

export default async function CustomerReportsHubPage() {
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
          <h1 className="text-xl font-semibold text-foreground">Customer Reports</h1>
          <p className="text-sm text-muted-foreground">
            Read-only presentation over Customer master data, the Voucher Engine, and Sales Reports.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CUSTOMER_REPORT_VIEWS.map((view) => (
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
