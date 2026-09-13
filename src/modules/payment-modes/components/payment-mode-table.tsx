"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  activatePaymentModeAction,
  deactivatePaymentModeAction,
} from "@/modules/payment-modes/actions/payment-mode-actions";
import { LedgerClassBadge } from "@/modules/payment-modes/components/ledger-class-badge";
import { PaymentModeStatusBadge } from "@/modules/payment-modes/components/payment-mode-status-badge";
import type { PaymentMode } from "@/types/payment-mode";

interface PaymentModeTableProps {
  paymentModes: PaymentMode[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function PaymentModeTable({
  paymentModes,
  canEdit = false,
  canManage = false,
}: PaymentModeTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleActive(paymentMode: PaymentMode) {
    setPendingId(paymentMode.id);
    const action = paymentMode.isActive ? deactivatePaymentModeAction : activatePaymentModeAction;

    try {
      const result = await action(paymentMode.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update payment mode status.");
        return;
      }
      toast.success(paymentMode.isActive ? "Payment mode deactivated." : "Payment mode activated.");
    } catch {
      toast.error("Failed to update payment mode status.");
    } finally {
      setPendingId(null);
    }
  }

  if (paymentModes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No payment modes found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Ledger Class</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paymentModes.map((paymentMode) => (
          <TableRow key={paymentMode.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{paymentMode.name}</span>
                {paymentMode.isSystemDefined ? <Badge variant="secondary">System</Badge> : null}
              </div>
            </TableCell>
            <TableCell>
              <LedgerClassBadge ledgerClass={paymentMode.ledgerClass} />
            </TableCell>
            <TableCell>
              <PaymentModeStatusBadge isActive={paymentMode.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/accounting/payment-modes/${paymentMode.id}/edit`}
                        aria-label="Edit payment mode"
                      >
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === paymentMode.id}
                    onClick={() => handleToggleActive(paymentMode)}
                  >
                    {paymentMode.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
