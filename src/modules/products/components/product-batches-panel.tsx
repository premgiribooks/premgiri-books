"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductBatchForm } from "@/modules/product-batches/components/product-batch-form";
import { ProductBatchTable } from "@/modules/product-batches/components/product-batch-table";
import type { ProductBatchWithStock } from "@/types/product-batch";

type DialogState = { mode: "create" } | { mode: "edit"; batch: ProductBatchWithStock } | null;

interface ProductBatchesPanelProps {
  productId: string;
  batches: ProductBatchWithStock[];
  canCreate: boolean;
  canEdit: boolean;
}

/**
 * Batches tab content (56-product-detail-page.md) — composes spec 50's
 * unmodified `ProductBatchTable`/`ProductBatchForm` with the dialog state
 * neither of those components owns itself. Lives under `products/`, not
 * `product-batches/`, since that module's own spec deliberately reserves no
 * new components (its UI surface is only those two, consumed as-is here).
 */
export function ProductBatchesPanel({ productId, batches, canCreate, canEdit }: ProductBatchesPanelProps) {
  const router = useRouter();
  const [dialogState, setDialogState] = React.useState<DialogState>(null);

  function handleSaved() {
    setDialogState(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setDialogState({ mode: "create" })}>
            <Plus size={16} />
            New Batch
          </Button>
        </div>
      ) : null}

      <ProductBatchTable
        batches={batches}
        canEdit={canEdit}
        canManage={canEdit}
        onEdit={(batch) => setDialogState({ mode: "edit", batch })}
      />

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogState?.mode === "edit" ? "Edit Batch" : "New Batch"}</DialogTitle>
          </DialogHeader>
          {dialogState ? (
            <ProductBatchForm
              productId={productId}
              batch={dialogState.mode === "edit" ? dialogState.batch : undefined}
              onSaved={handleSaved}
              onCancel={() => setDialogState(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
