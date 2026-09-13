"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPaymentModeAction, updatePaymentModeAction } from "@/modules/payment-modes/actions/payment-mode-actions";
import {
  PAYMENT_MODE_LEDGER_CLASSES,
  PAYMENT_MODE_LEDGER_CLASS_LABELS,
  createPaymentModeSchema,
  type CreatePaymentModeInput,
} from "@/modules/payment-modes/validation/payment-mode-schema";
import type { PaymentMode } from "@/types/payment-mode";

const LIST_PATH = "/accounting/payment-modes";

interface PaymentModeFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set — name/ledgerClass remain editable on
   * every Payment Mode, including seeded ones (86-payment-mode-master.md) —
   * so one component serves both screens. */
  paymentMode?: PaymentMode;
}

export function PaymentModeForm({ paymentMode }: PaymentModeFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = paymentMode !== undefined;

  const form = useForm<CreatePaymentModeInput>({
    resolver: zodResolver(createPaymentModeSchema),
    defaultValues: {
      name: paymentMode?.name ?? "",
      ledgerClass: paymentMode?.ledgerClass ?? "CASH",
    },
  });

  async function handleSubmit(data: CreatePaymentModeInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updatePaymentModeAction(paymentMode.id, data)
        : await createPaymentModeAction(data);

      if (result.success) {
        toast.success(isEdit ? "Payment mode saved successfully." : "Payment mode created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(result.error ?? (isEdit ? "Failed to save payment mode." : "Failed to create payment mode."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-xl flex-col gap-6">
        {paymentMode?.isSystemDefined ? (
          <div>
            <Badge variant="secondary">System-defined</Badge>
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. NEFT" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ledgerClass"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ledger Class *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PAYMENT_MODE_LEDGER_CLASSES.map((ledgerClass) => (
                    <SelectItem key={ledgerClass} value={ledgerClass}>
                      {PAYMENT_MODE_LEDGER_CLASS_LABELS[ledgerClass]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Which kind of ledger this mode may be used against, once a later module wires that
                check in — Cash, Bank, or Any (no enforcement).
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(LIST_PATH)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Payment Mode"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
