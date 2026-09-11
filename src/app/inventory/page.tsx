import Link from "next/link";
import { redirect } from "next/navigation";
import { PackagePlus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

// Mirrors /purchase's hub (src/app/purchase/page.tsx) — the first card of
// the Inventory hub (46-opening-stock.md's UI: "the first feature to
// establish it"). Stock Adjustment, Stock Transfer, and Physical
// Verification will each add their own card here as they land.
const INVENTORY_MODULES = [
  {
    href: "/inventory/opening-stock",
    icon: PackagePlus,
    title: "Opening Stock",
    description: "One-time entry of a product/warehouse's starting stock quantity and cost.",
  },
] as const;

export default async function InventoryHubPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "inventory", "view");
  if (!canView) {
    redirect("/");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage stock movement across products and warehouses.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INVENTORY_MODULES.map((module) => (
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
