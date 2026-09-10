import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesReturnForm } from "@/modules/sales-returns/components/sales-return-form";
import { SalesReturnInvoicePicker } from "@/modules/sales-returns/components/sales-return-invoice-picker";
import { salesReturnService } from "@/modules/sales-returns/services/sales-return-service";

interface NewSalesReturnPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewSalesReturnPage({ searchParams }: NewSalesReturnPageProps) {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "sales", "create");
  if (!canCreate) {
    redirect("/sales/returns");
  }

  const salesInvoiceId = firstValue((await searchParams).salesInvoiceId);
  const isAdmin = await isCurrentUserCompanyAdmin();

  // Step 1: no invoice picked yet — show the POSTED-invoice search/select
  // (39-sales-return.md's UI: "starts from an invoice search/select").
  if (!salesInvoiceId) {
    const invoices = await salesReturnService.listReturnableInvoices();
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">New Sales Return</h1>
            <p className="text-sm text-muted-foreground">Select the posted sales invoice to return goods against.</p>
          </div>
          <SalesReturnInvoicePicker initialInvoices={invoices} />
        </div>
      </AppShell>
    );
  }

  // Step 2: an invoice was picked — show only its lines with their
  // remaining returnable quantity.
  const [invoice, options] = await Promise.all([
    salesReturnService.getReturnableInvoice(salesInvoiceId),
    salesReturnService.listSalesReturnFormOptions(),
  ]);

  if (!invoice) {
    redirect("/sales/returns/new");
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Sales Return</h1>
          <p className="text-sm text-muted-foreground">
            Record returned quantities — posting moves stock back in and reduces the customer&apos;s liability.
          </p>
        </div>

        <SalesReturnForm invoice={invoice} options={options} />
      </div>
    </AppShell>
  );
}
