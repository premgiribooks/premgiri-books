"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SerialNumberForm } from "@/modules/serial-numbers/components/serial-number-form";
import { SerialNumberTable } from "@/modules/serial-numbers/components/serial-number-table";
import type { SerialNumberWithStatus } from "@/types/serial-number";

interface ProductSerialNumbersPanelProps {
  productId: string;
  serialNumbers: SerialNumberWithStatus[];
  canCreate: boolean;
  canEdit: boolean;
}

/**
 * Serial Numbers tab content (51-serial-number-tracking.md, landing on the
 * Product detail page feature-spec 56 built) — composes the serial-numbers
 * module's `SerialNumberTable`/`SerialNumberForm` with the dialog state
 * neither of those components owns itself. Lives under `products/`, not
 * `serial-numbers/`, mirroring `ProductBatchesPanel`'s identical placement
 * reasoning.
 */
export function ProductSerialNumbersPanel({
  productId,
  serialNumbers,
  canCreate,
  canEdit,
}: ProductSerialNumbersPanelProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  function handleSaved() {
    setIsDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus size={16} />
            Register Serial(s)
          </Button>
        </div>
      ) : null}

      <SerialNumberTable serialNumbers={serialNumbers} canManage={canEdit} />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Serial Number(s)</DialogTitle>
          </DialogHeader>
          <SerialNumberForm productId={productId} onSaved={handleSaved} onCancel={() => setIsDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
