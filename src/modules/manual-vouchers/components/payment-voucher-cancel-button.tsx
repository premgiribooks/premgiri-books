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
import { cancelPaymentVoucherAction } from "@/modules/manual-vouchers/actions/payment-voucher-actions";

interface PaymentVoucherCancelButtonProps {
  id: string;
  voucherNumber: string;
}

/** Cancel action for a posted Payment Voucher — gated on `approve` server-side (permission-checked purely inside the action; this button itself is only rendered when the caller already has that permission, mirroring every other module's status-action convention). */
export function PaymentVoucherCancelButton({ id, voucherNumber }: PaymentVoucherCancelButtonProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = React.useState(false);

  async function handleCancel() {
    setIsCancelling(true);
    try {
      const result = await cancelPaymentVoucherAction(id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to cancel payment voucher.");
        return;
      }
      toast.success("Payment voucher cancelled.");
      router.refresh();
    } catch {
      toast.error("Failed to cancel payment voucher.");
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
          <AlertDialogTitle>Cancel payment voucher {voucherNumber}?</AlertDialogTitle>
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
