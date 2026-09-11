"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cancelReceiptVoucherAction } from "@/modules/manual-vouchers/actions/receipt-voucher-actions";

interface ReceiptVoucherCancelButtonProps {
  id: string;
  voucherNumber: string;
}

/** Cancel action for a posted Receipt Voucher — gated on `approve` server-side (permission-checked purely inside the action; this button itself is only rendered when the caller already has that permission, mirroring every other module's status-action convention). */
export function ReceiptVoucherCancelButton({ id, voucherNumber }: ReceiptVoucherCancelButtonProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = React.useState(false);

  async function handleCancel() {
    setIsCancelling(true);
    try {
      const result = await cancelReceiptVoucherAction(id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to cancel receipt voucher.");
        return;
      }
      toast.success("Receipt voucher cancelled.");
      router.refresh();
    } catch {
      toast.error("Failed to cancel receipt voucher.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" disabled={isCancelling}>
            {isCancelling ? "Cancelling…" : "Cancel Voucher"}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel receipt voucher {voucherNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This creates a mirrored reversal voucher and marks this voucher as cancelled. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancel}>Confirm Cancel</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
