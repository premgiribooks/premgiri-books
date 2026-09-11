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
import { cancelContraVoucherAction } from "@/modules/manual-vouchers/actions/contra-voucher-actions";

interface ContraVoucherCancelButtonProps {
  id: string;
  voucherNumber: string;
}

/** Cancel action for a posted Contra Voucher — gated on `approve` server-side (permission-checked purely inside the action; this button itself is only rendered when the caller already has that permission, mirroring every other module's status-action convention). */
export function ContraVoucherCancelButton({ id, voucherNumber }: ContraVoucherCancelButtonProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = React.useState(false);

  async function handleCancel() {
    setIsCancelling(true);
    try {
      const result = await cancelContraVoucherAction(id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to cancel contra voucher.");
        return;
      }
      toast.success("Contra voucher cancelled.");
      router.refresh();
    } catch {
      toast.error("Failed to cancel contra voucher.");
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
          <AlertDialogTitle>Cancel contra voucher {voucherNumber}?</AlertDialogTitle>
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
