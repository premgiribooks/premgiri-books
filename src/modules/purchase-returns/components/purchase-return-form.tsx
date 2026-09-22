"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSection } from "@/components/common/form-section";
import { LoadingBar } from "@/components/common/loading-bar";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { createPurchaseReturnDraftAction, updatePurchaseReturnDraftAction } from "@/modules/purchase-returns/actions/purchase-return-actions";
import { isValidCalendarDate, REFUND_MODE_VALUES } from "@/modules/purchase-returns/validation/purchase-return-schema";
import type { PurchaseReturnDetail, PurchaseReturnFormOptions, ReturnablePurchaseInvoiceDetail } from "@/types/purchase-return";
import type { PaymentModeOption } from "@/types/payment-mode";

const LIST_PATH = "/purchase/returns";

type RefundMode = (typeof REFUND_MODE_VALUES)[number];

const REFUND_MODE_LABELS: Record<RefundMode, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

// A minimal client-side schema for the header fields only — the line
// selection below is managed as local component state (a fixed, per-invoice
// set of checkbox+quantity rows, not a freely add/removable field array), so
// it is assembled and validated separately on submit. The server's
// `createPurchaseReturnSchema` remains the authoritative validation.
const headerFormSchema = z
  .object({
    returnDate: z.string().refine(isValidCalendarDate, "Enter a valid date"),
    reason: z.string().max(500, "Reason must be at most 500 characters").optional(),
    refundMode: z.enum(REFUND_MODE_VALUES),
    refundLedgerId: z.string().optional(),
    paymentModeId: z.string().optional(),
  })
  .refine((data) => data.refundMode !== "CASH_REFUND" || Boolean(data.refundLedgerId), {
    message: "Select a refund ledger for a cash refund.",
    path: ["refundLedgerId"],
  })
  .refine((data) => data.refundMode !== "CASH_REFUND" || Boolean(data.paymentModeId), {
    message: "Select a payment mode for a cash refund.",
    path: ["paymentModeId"],
  });

function closestMatchingPaymentModeId(
  ledgerClass: "CASH" | "BANK" | "NEITHER",
  paymentModes: readonly PaymentModeOption[]
): string | undefined {
  const exact = paymentModes.find((mode) => mode.ledgerClass === ledgerClass);
  if (exact) {
    return exact.id;
  }
  if (ledgerClass === "NEITHER") {
    return undefined;
  }
  return paymentModes.find((mode) => mode.ledgerClass === "ANY")?.id;
}

type HeaderFormValues = z.infer<typeof headerFormSchema>;

interface LineState {
  checked: boolean;
  quantity: number;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

interface PurchaseReturnFormProps {
  /** The picked source invoice's returnable-lines lookup — always the
   * CURRENT state (re-fetched by the page), never stale. */
  invoice: ReturnablePurchaseInvoiceDetail;
  options: PurchaseReturnFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  purchaseReturn?: PurchaseReturnDetail;
}

export function PurchaseReturnForm({ invoice, options, purchaseReturn }: PurchaseReturnFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = purchaseReturn !== undefined;

  const existingByItemId = React.useMemo(() => {
    const map = new Map<string, number>();
    if (purchaseReturn) {
      for (const item of purchaseReturn.items) {
        map.set(item.purchaseInvoiceItem.id, item.quantity);
      }
    }
    return map;
  }, [purchaseReturn]);

  const [lineStates, setLineStates] = React.useState<Record<string, LineState>>(() => {
    const initial: Record<string, LineState> = {};
    for (const line of invoice.lines) {
      const existingQuantity = existingByItemId.get(line.purchaseInvoiceItemId);
      initial[line.purchaseInvoiceItemId] = {
        checked: existingQuantity !== undefined,
        quantity: existingQuantity ?? line.returnableQuantity,
      };
    }
    return initial;
  });

  const form = useForm<HeaderFormValues>({
    resolver: zodResolver(headerFormSchema),
    defaultValues: {
      returnDate: purchaseReturn ? toDateInputValue(purchaseReturn.returnDate) : todayDateInputValue(),
      reason: purchaseReturn?.reason ?? "",
      refundMode: purchaseReturn?.refundMode ?? "LEDGER_ADJUSTMENT",
      refundLedgerId: purchaseReturn?.refundLedgerId ?? undefined,
      paymentModeId: purchaseReturn?.paymentModeId ?? undefined,
    },
  });

  const refundMode = useWatch({ control: form.control, name: "refundMode" });

  const refundLedgersById = React.useMemo(() => new Map(options.refundLedgers.map((ledger) => [ledger.id, ledger])), [options.refundLedgers]);

  function handleRefundLedgerChange(ledgerId: string) {
    form.setValue("refundLedgerId", ledgerId, { shouldValidate: true });
    const ledgerClass = refundLedgersById.get(ledgerId)?.ledgerClass ?? "NEITHER";
    const matchedModeId = closestMatchingPaymentModeId(ledgerClass, options.paymentModes);
    if (matchedModeId) {
      form.setValue("paymentModeId", matchedModeId, { shouldValidate: true });
    }
  }

  function updateLine(id: string, update: Partial<LineState>) {
    setLineStates((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  }

  async function handleSubmit(headerValues: HeaderFormValues) {
    const lines = invoice.lines
      .filter((line) => lineStates[line.purchaseInvoiceItemId]?.checked)
      .map((line) => ({
        purchaseInvoiceItemId: line.purchaseInvoiceItemId,
        quantity: lineStates[line.purchaseInvoiceItemId].quantity,
      }));

    if (lines.length === 0) {
      toast.error("Select at least one line to return.");
      return;
    }

    const payload = {
      purchaseInvoiceId: invoice.purchaseInvoiceId,
      returnDate: headerValues.returnDate,
      reason: headerValues.reason || undefined,
      refundMode: headerValues.refundMode,
      refundLedgerId: headerValues.refundMode === "CASH_REFUND" ? headerValues.refundLedgerId : undefined,
      paymentModeId: headerValues.refundMode === "CASH_REFUND" ? headerValues.paymentModeId : undefined,
      lines,
    };

    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updatePurchaseReturnDraftAction(purchaseReturn.id, payload)
        : await createPurchaseReturnDraftAction(payload);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save purchase return." : "Failed to create purchase return."));
        return;
      }

      toast.success(isEdit ? "Purchase return saved successfully." : "Purchase return created successfully.");
      router.push(isEdit ? `${LIST_PATH}/${purchaseReturn.id}` : `${LIST_PATH}/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save purchase return." : "Failed to create purchase return.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        <p className="text-xs text-muted-foreground">
          Against invoice <span className="font-financial">{invoice.invoiceNumber}</span> — {invoice.supplierName}
        </p>

        {!options.isLedgerMappingComplete ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            The Sales &amp; Purchase GST ledger mapping is incomplete — posting will be blocked until Settings &gt;
            Sales &amp; Purchase GST Ledgers is fully configured.
          </p>
        ) : null}

        <FormSection title="Details">
          <FormField
            control={form.control}
            name="returnDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Return Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="refundMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Refund Mode *</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={(next) => field.onChange(next ?? "LEDGER_ADJUSTMENT")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(current: string | null) => REFUND_MODE_LABELS[current as RefundMode] ?? "Select refund mode"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {REFUND_MODE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {REFUND_MODE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {refundMode === "CASH_REFUND" ? (
            <FormField
              control={form.control}
              name="refundLedgerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refund Ledger *</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={options.refundLedgers}
                      value={field.value || undefined}
                      onChange={(next) => handleRefundLedgerChange(next ?? "")}
                      getOptionId={(ledger) => ledger.id}
                      getOptionLabel={(ledger) => `${ledger.name} (${ledger.groupName})`}
                      placeholder="Select a ledger"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {refundMode === "CASH_REFUND" ? (
            <FormField
              control={form.control}
              name="paymentModeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Mode *</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={options.paymentModes}
                      value={field.value || undefined}
                      onChange={(next) => field.onChange(next ?? "")}
                      getOptionId={(mode) => mode.id}
                      getOptionLabel={(mode) => mode.name}
                      allowNone={false}
                      placeholder="Select a payment mode"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Returnable Lines" columns={1}>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Already Returned</TableHead>
                  <TableHead className="text-right">Return Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => {
                  const state = lineStates[line.purchaseInvoiceItemId];
                  const isReturnable = line.returnableQuantity > 0;
                  return (
                    <TableRow key={line.purchaseInvoiceItemId}>
                      <TableCell>
                        <Checkbox
                          checked={state?.checked ?? false}
                          disabled={!isReturnable}
                          onCheckedChange={(checked) => updateLine(line.purchaseInvoiceItemId, { checked: checked === true })}
                        />
                      </TableCell>
                      <TableCell>
                        {line.productName}
                        {line.productCode ? ` (${line.productCode})` : ""}
                      </TableCell>
                      <TableCell>{line.warehouseName}</TableCell>
                      <TableCell className="text-right font-financial">
                        {line.originalQuantity} {line.unitSymbol}
                      </TableCell>
                      <TableCell className="text-right font-financial">
                        {line.returnedQuantity} {line.unitSymbol}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0.0001}
                          max={line.returnableQuantity}
                          step="0.0001"
                          disabled={!isReturnable || !(state?.checked ?? false)}
                          style={{ width: numericFieldWidth(state?.quantity ?? 0) }}
                          value={state?.quantity ?? 0}
                          onChange={(event) =>
                            updateLine(line.purchaseInvoiceItemId, { quantity: toNumberOrZero(event.target.valueAsNumber) })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Saving" data-icon="inline-start" /> : null}
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Purchase Return"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
