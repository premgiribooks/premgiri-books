import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesInvoiceForm } from "@/modules/sales-invoices/components/sales-invoice-form";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";

interface NewSalesInvoicePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewSalesInvoicePage({ searchParams }: NewSalesInvoicePageProps) {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "sales", "create");
  if (!canCreate) {
    redirect("/sales/invoices");
  }

  const deliveryChallanId = firstValue((await searchParams).deliveryChallanId);

  const [isAdmin, options, deliveryChallanPrefill] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    salesInvoiceService.listSalesInvoiceFormOptions(),
    deliveryChallanId ? salesInvoiceService.getDeliveryChallanPrefill(deliveryChallanId) : Promise.resolve(null),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Sales Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Record a GST tax invoice — posting moves stock and creates accounting entries.
          </p>
        </div>

        <SalesInvoiceForm options={options} deliveryChallanPrefill={deliveryChallanPrefill} />
      </div>
    </AppShell>
  );
}
