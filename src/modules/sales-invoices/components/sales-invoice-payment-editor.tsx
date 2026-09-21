"use client";

import * as React from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { LedgerOutstandingBalance } from "@/components/common/ledger-outstanding-balance";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { numericFieldWidth } from "@/lib/utils";
import { getLedgerOutstandingBalanceAction } from "@/modules/sales-invoices/actions/sales-invoice-actions";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { CreateSalesInvoiceInput } from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type { SalesInvoicePaymentLedgerOption } from "@/types/sales-invoice";
import type { PaymentModeOption } from "@/types/payment-mode";
import { useShortcutEffect } from "@/lib/shortcut-events";
import { PAYMENT_LEDGER_SHORTCUT_ATTRIBUTE, focusFirstMarkedComboboxInput } from "@/lib/shortcut-dom-targets";

function toNumberOrZero(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

/** The closest-matching active Payment Mode for a given ledger's class
 * (91-payment-mode-integration-sales.md's UI section) — an exact
 * `ledgerClass` match wins over an `ANY` mode, which is the loosest fit.
 * Returns `undefined` when nothing matches (e.g. a NEITHER-classified
 * ledger, or no active modes at all) — the field is simply left for the
 * user to pick manually, re-validated server-side regardless. */
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

interface SalesInvoicePaymentEditorProps {
  paymentLedgers: SalesInvoicePaymentLedgerOption[];
  paymentModes: PaymentModeOption[];
  grandTotal: number;
  /** The selected (PERMANENT-mode) customer's own Ledger id, if any — a new
   * payment line defaults to it so recording that customer's payment
   * against this invoice only requires picking a Payment Mode and amount. */
  customerLedgerId?: string;
}

/** Payment-lines editor with a running "Amount Due" display
 * (38-sales-invoice.md's UI section). WALK_IN requires this to sum exactly
 * to `grandTotal`; every other mode is capped at `<= grandTotal` — both
 * re-validated server-side at draft-save and posting time, this is
 * display-only guidance. Each line also carries a Payment Mode
 * (91-payment-mode-integration-sales.md), auto-selected to the closest match
 * whenever the ledger changes — a UX hint only, independently re-validated
 * server-side. */
export function SalesInvoicePaymentEditor({
  paymentLedgers,
  paymentModes,
  grandTotal,
  customerLedgerId,
}: SalesInvoicePaymentEditorProps) {
  const { control, setValue } = useFormContext<CreateSalesInvoiceInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "payments" });
  const payments = useWatch({ control, name: "payments" });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // "Jump to Payment" keyboard shortcut (src/config/shortcuts.ts).
  useShortcutEffect("focus-payment", () => {
    if (containerRef.current) {
      focusFirstMarkedComboboxInput(containerRef.current, PAYMENT_LEDGER_SHORTCUT_ATTRIBUTE);
    }
  });

  const ledgerOptions: ProductOptionItem[] = React.useMemo(
    () => paymentLedgers.map((ledger) => ({ id: ledger.id, label: `${ledger.name} (${ledger.groupName})`, isActive: true })),
    [paymentLedgers]
  );

  const paymentModeOptions: ProductOptionItem[] = React.useMemo(
    () => paymentModes.map((mode) => ({ id: mode.id, label: mode.name, isActive: true })),
    [paymentModes]
  );

  const ledgersById = React.useMemo(() => new Map(paymentLedgers.map((ledger) => [ledger.id, ledger])), [paymentLedgers]);

  function handleLedgerChange(index: number, ledgerId: string) {
    setValue(`payments.${index}.ledgerId`, ledgerId, { shouldValidate: true });
    const ledgerClass = ledgersById.get(ledgerId)?.ledgerClass ?? "NEITHER";
    const matchedModeId = closestMatchingPaymentModeId(ledgerClass, paymentModes);
    if (matchedModeId) {
      setValue(`payments.${index}.paymentModeId`, matchedModeId, { shouldValidate: true });
    }
  }

  const paidTotal = (payments ?? []).reduce((sum, payment) => sum + (payment?.amount || 0), 0);
  const amountDue = grandTotal - paidTotal;

  return (
    <div className="flex flex-col gap-3" ref={containerRef}>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ledger</TableHead>
              <TableHead>Payment Mode</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell className="min-w-56" {...{ [PAYMENT_LEDGER_SHORTCUT_ATTRIBUTE]: "" }}>
                  <FormField
                    control={control}
                    name={`payments.${index}.ledgerId`}
                    render={({ field: ledgerField }) => (
                      <FormItem>
                        <FormControl>
                          <ProductOptionSelector
                            options={ledgerOptions}
                            value={ledgerField.value || undefined}
                            onChange={(value) => handleLedgerChange(index, value ?? "")}
                            allowNone={false}
                            placeholder="Select a ledger"
                          />
                        </FormControl>
                        <LedgerOutstandingBalance
                          ledgerId={ledgerField.value || undefined}
                          fetchBalance={getLedgerOutstandingBalanceAction}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell className="min-w-40">
                  <FormField
                    control={control}
                    name={`payments.${index}.paymentModeId`}
                    render={({ field: modeField }) => (
                      <FormItem>
                        <FormControl>
                          <ProductOptionSelector
                            options={paymentModeOptions}
                            value={modeField.value || undefined}
                            onChange={(value) => modeField.onChange(value ?? "")}
                            allowNone={false}
                            placeholder="Select a mode"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={control}
                    name={`payments.${index}.amount`}
                    render={({ field: amountField }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            min={0.01}
                            step="0.01"
                            style={{ width: numericFieldWidth(amountField.value) }}
                            {...amountField}
                            onChange={(event) => amountField.onChange(toNumberOrZero(event.target.valueAsNumber))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={control}
                    name={`payments.${index}.reference`}
                    render={({ field: referenceField }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...referenceField} value={referenceField.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove payment" onClick={() => remove(index)}>
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const ledgerId = customerLedgerId && ledgersById.has(customerLedgerId) ? customerLedgerId : "";
            const ledgerClass = ledgerId ? ledgersById.get(ledgerId)?.ledgerClass ?? "NEITHER" : "NEITHER";
            append({
              ledgerId,
              paymentModeId: ledgerId ? closestMatchingPaymentModeId(ledgerClass, paymentModes) ?? "" : "",
              // Defaults a new line to whatever is still unpaid — for a
              // single full payment this already completes the invoice;
              // splitting across modes just means lowering it manually.
              // Never negative (an already-overpaid draft, however that
              // happened, shouldn't default a new line below zero).
              amount: Math.max(0, Math.round(amountDue * 100) / 100),
              reference: undefined,
            });
          }}
        >
          <Plus size={16} />
          Add Payment
        </Button>
        <p className="text-sm text-muted-foreground">
          Amount Due: <span className="font-financial text-foreground">{amountDue.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
