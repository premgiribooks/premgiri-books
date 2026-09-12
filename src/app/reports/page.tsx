import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  Landmark,
  Package,
  Receipt,
  Scale,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserSquare2,
  Users,
  Waves,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

// Trial Balance (64-trial-balance.md) is the first tenant of this hub — the
// other three financial reports (65-67) and the seven Reporting-phase
// screens (tracker #66-72, spec files 68-74) all reserve their own card here
// as an unavailable placeholder, matching 57-gst-registers.md's own "hub
// exists before every sibling screen does" precedent.
const REPORT_MODULES = [
  {
    href: "/reports/trial-balance",
    icon: Scale,
    title: "Trial Balance",
    description: "Every ledger's closing balance as of a chosen date, grouped under its Ledger Group hierarchy.",
    available: true,
  },
  {
    href: "/reports/profit-and-loss",
    icon: TrendingUp,
    title: "Profit & Loss",
    description: "Income and expenses for a chosen period.",
    available: false,
  },
  {
    href: "/reports/balance-sheet",
    icon: Landmark,
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity as of a chosen date.",
    available: false,
  },
  {
    href: "/reports/cash-flow",
    icon: Waves,
    title: "Cash Flow",
    description: "Cash and bank movement for a chosen period.",
    available: false,
  },
  {
    href: "/reports/sales",
    icon: ShoppingCart,
    title: "Sales Reports",
    description: "Sales register, item-wise, party-wise, and return summary.",
    available: false,
  },
  {
    href: "/reports/purchase",
    icon: Truck,
    title: "Purchase Reports",
    description: "Purchase register, item-wise, party-wise, and return summary.",
    available: false,
  },
  {
    href: "/reports/inventory",
    icon: Package,
    title: "Inventory Reports",
    description: "Current stock, stock ledger, and stock valuation.",
    available: false,
  },
  {
    href: "/reports/customers",
    icon: Users,
    title: "Customer Reports",
    description: "Outstanding and transaction summaries by customer.",
    available: false,
  },
  {
    href: "/reports/suppliers",
    icon: Building2,
    title: "Supplier Reports",
    description: "Outstanding and transaction summaries by supplier.",
    available: false,
  },
  {
    href: "/reports/employees",
    icon: UserSquare2,
    title: "Employee Reports",
    description: "Attendance and payroll summaries by employee.",
    available: false,
  },
  {
    href: "/reports/gst",
    icon: Receipt,
    title: "GST Reports",
    description: "Analytical dashboard over the GST Registers and HSN Summary.",
    available: false,
  },
] as const;

export default async function ReportsHubPage() {
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
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Financial statements and operational reports.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_MODULES.map((module) =>
            module.available ? (
              <Link key={module.title} href={module.href}>
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
            ) : (
              <Card key={module.title} className="opacity-60">
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
                  <p className="mt-2 text-xs font-medium text-muted-foreground">Coming soon</p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </AppShell>
  );
}
