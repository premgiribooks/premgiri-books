import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { StockAdjustmentForm } from "@/modules/stock-adjustments/components/stock-adjustment-form";
import { stockAdjustmentService } from "@/modules/stock-adjustments/services/stock-adjustment-service";

interface EditStockAdjustmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStockAdjustmentPage({ params }: EditStockAdjustmentPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "inventory", "edit");
  if (!canEdit) {
    redirect(`/inventory/adjustments/${id}`);
  }

  const stockAdjustment = await stockAdjustmentService.getStockAdjustment(id);
  if (!stockAdjustment) {
    notFound();
  }

  // Only reachable while DRAFT (47-stock-adjustment.md: "Editable while
  // DRAFT") — the service itself also rejects a non-DRAFT update, this just
  // avoids offering a doomed form.
  if (stockAdjustment.status !== "DRAFT") {
    redirect(`/inventory/adjustments/${id}`);
  }

  const [isAdmin, options] = await Promise.all([isCurrentUserCompanyAdmin(), stockAdjustmentService.listFormOptions()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Stock Adjustment</h1>
          <p className="text-sm text-muted-foreground">Update the reason, date, and lines.</p>
        </div>

        <StockAdjustmentForm options={options} stockAdjustment={stockAdjustment} />
      </div>
    </AppShell>
  );
}
