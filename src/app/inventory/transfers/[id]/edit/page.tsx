import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { StockTransferForm } from "@/modules/stock-transfers/components/stock-transfer-form";
import { stockTransferService } from "@/modules/stock-transfers/services/stock-transfer-service";

interface EditStockTransferPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStockTransferPage({ params }: EditStockTransferPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "inventory", "edit");
  if (!canEdit) {
    redirect(`/inventory/transfers/${id}`);
  }

  const stockTransfer = await stockTransferService.getStockTransfer(id);
  if (!stockTransfer) {
    notFound();
  }

  // Only reachable while DRAFT (48-stock-transfer.md: "Editable while
  // DRAFT") — the service itself also rejects a non-DRAFT update, this just
  // avoids offering a doomed form.
  if (stockTransfer.status !== "DRAFT") {
    redirect(`/inventory/transfers/${id}`);
  }

  const [isAdmin, options] = await Promise.all([isCurrentUserCompanyAdmin(), stockTransferService.listFormOptions()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Stock Transfer</h1>
          <p className="text-sm text-muted-foreground">Update the warehouses, date, and lines.</p>
        </div>

        <StockTransferForm options={options} stockTransfer={stockTransfer} />
      </div>
    </AppShell>
  );
}
