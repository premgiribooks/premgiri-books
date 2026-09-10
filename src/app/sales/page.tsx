import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, FileMinus, FilePlus, FileText, Receipt, RotateCcw, Truck } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const SALES_MODULES = [
  {
    href: "/sales/quotations",
    icon: FileText,
    title: "Quotations",
    description: "Create and track priced offers to customers, from draft through acceptance.",
  },
  {
    href: "/sales/orders",
    icon: ClipboardCheck,
    title: "Sales Orders",
    description: "Confirmed customer commitments, tracked through to delivery.",
  },
  {
    href: "/sales/challans",
    icon: Truck,
    title: "Delivery Challans",
    description: "Dispatch/goods-movement records between a Sales Order and the Sales Invoice.",
  },
  {
    href: "/sales/invoices",
    icon: Receipt,
    title: "Sales Invoices",
    description: "GST-compliant tax invoices — posts accounting entries and stock movement.",
  },
  {
    href: "/sales/returns",
    icon: RotateCcw,
    title: "Sales Returns",
    description: "Physical, quantity-based reversals of posted invoices — stock back in, liability reduced.",
  },
  {
    href: "/sales/credit-notes",
    icon: FileMinus,
    title: "Credit Notes",
    description: "Pure financial adjustments reducing what a customer owes — no stock movement.",
  },
  {
    href: "/sales/debit-notes",
    icon: FilePlus,
    title: "Debit Notes",
    description: "Pure financial adjustments increasing what a customer owes — no stock movement.",
  },
] as const;

export default async function SalesHubPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales</h1>
          <p className="text-sm text-muted-foreground">
            Manage the Sales document chain — Quotation, Sales Order, Delivery Challan, and Sales
            Invoice.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SALES_MODULES.map((module) => (
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
