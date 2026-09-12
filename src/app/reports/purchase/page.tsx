import Link from "next/link";
import { redirect } from "next/navigation";
import { ListOrdered, Package, RotateCcw, Users } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const PURCHASE_REPORT_VIEWS = [
  { href: "/reports/purchase/register", icon: ListOrdered, title: "Purchase Register", description: "Every posted Purchase Invoice within a date range." },
  { href: "/reports/purchase/item-wise", icon: Package, title: "Item-wise Purchases", description: "Quantity and value purchased, grouped by product." },
  { href: "/reports/purchase/party-wise", icon: Users, title: "Party-wise Purchase Summary", description: "Purchase value grouped by supplier." },
  { href: "/reports/purchase/returns", icon: RotateCcw, title: "Purchase Return Summary", description: "Every purchase return within a date range." },
] as const;

export default async function PurchaseReportsHubPage() {
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
          <h1 className="text-xl font-semibold text-foreground">Purchase Reports</h1>
          <p className="text-sm text-muted-foreground">
            Read-only presentation over posted Purchase Invoices and Purchase Returns.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PURCHASE_REPORT_VIEWS.map((view) => (
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
