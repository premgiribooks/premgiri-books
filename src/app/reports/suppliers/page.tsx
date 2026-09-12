import Link from "next/link";
import { redirect } from "next/navigation";
import { BookUser, FileClock, ShoppingBag, Wallet } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const SUPPLIER_REPORT_VIEWS = [
  { href: "/reports/suppliers/outstanding", icon: Wallet, title: "Outstanding", description: "Balance owed to each supplier as of a chosen date." },
  { href: "/reports/suppliers/statement", icon: FileClock, title: "Statement", description: "Dated ledger entries with running balance for one supplier." },
  { href: "/reports/suppliers/purchase-summary", icon: ShoppingBag, title: "Purchase Summary", description: "Purchase value grouped by supplier, for a chosen period." },
  { href: "/reports/suppliers/directory", icon: BookUser, title: "Directory", description: "Every supplier's contact and GST details." },
] as const;

export default async function SupplierReportsHubPage() {
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
          <h1 className="text-xl font-semibold text-foreground">Supplier Reports</h1>
          <p className="text-sm text-muted-foreground">
            Read-only presentation over Supplier master data, the Voucher Engine, and Purchase Reports.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUPPLIER_REPORT_VIEWS.map((view) => (
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
