import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, PackageCheck } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

// Mirrors /sales's hub exactly (src/app/sales/page.tsx) — one card per Phase
// 4 document type; Purchase Orders (42-purchase-orders.md) and Goods Receipt
// Notes (43-goods-receipt-note.md) wired so far.
const PURCHASE_MODULES = [
  {
    href: "/purchase/orders",
    icon: ClipboardList,
    title: "Purchase Orders",
    description: "The company's commitment to buy from a Supplier, tracked through to receipt.",
  },
  {
    href: "/purchase/receipts",
    icon: PackageCheck,
    title: "Goods Receipt Notes",
    description: "The receiving record between a confirmed Purchase Order and the eventual Purchase Invoice.",
  },
] as const;

export default async function PurchaseHubPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Purchase</h1>
          <p className="text-sm text-muted-foreground">
            Manage the Purchase document chain — Purchase Order, Goods Receipt Note, and
            Purchase Invoice.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PURCHASE_MODULES.map((module) => (
            <Link key={module.href} href={module.href}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      <module.icon size={20} />
                    </div>
                    <CardTitle>{module.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{module.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
