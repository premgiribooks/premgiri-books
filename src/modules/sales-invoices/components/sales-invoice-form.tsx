"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { LedgerOutstandingBalance } from "@/components/common/ledger-outstanding-balance";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { GST_STATE_CODES } from "@/engines/gst/state-codes";
import {
  createDraftAction,
  getLedgerOutstandingBalanceAction,
  previewSalesInvoiceAction,
  updateDraftAction,
} from "@/modules/sales-invoices/actions/sales-invoice-actions";
import { SalesInvoiceLineEditor } from "@/modules/sales-invoices/components/sales-invoice-line-editor";
import { SalesInvoicePaymentEditor } from "@/modules/sales-invoices/components/sales-invoice-payment-editor";
import {
  createSalesInvoiceSchema,
  type CreateSalesInvoiceInput,
} from "@/modules/sales-invoices/validation/sales-invoice-schema";
import type {
  DeliveryChallanPrefill,
  SalesInvoiceDetail,
  SalesInvoiceFormOptions,
  SalesInvoicePreview,
} from "@/types/sales-invoice";

const LIST_PATH = "/sales/invoices";
const PREVIEW_DEBOUNCE_MS = 300;
const NONE_VALUE = "__none__";

const CUSTOMER_MODES = [
  { value: "PERMANENT", label: "Permanent Customer" },
  { value: "QUICK", label: "Quick Customer" },
  { value: "WALK_IN", label: "Walk-in" },
] as const;

const EMPTY_PREVIEW: SalesInvoicePreview = {
  lines: [],
  totals: {
    subtotal: 0,
    totalDiscount: 0,
    taxableAmount: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalCess: 0,
    roundOff: 0,
    grandTotal: 0,
  },
  groups: [],
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

interface SalesInvoiceFormProps {
  options: SalesInvoiceFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  salesInvoice?: SalesInvoiceDetail;
  /** When present (and not editing), pre-fills the header/lines from a
   * Delivery Challan's remaining lines — see
   * sales-invoice-service.ts's getDeliveryChallanPrefill. */
  deliveryChallanPrefill?: DeliveryChallanPrefill | null;
}

export function SalesInvoiceForm({ options, salesInvoice, deliveryChallanPrefill }: SalesInvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [preview, setPreview] = React.useState<SalesInvoicePreview>(EMPTY_PREVIEW);
  const isEdit = salesInvoice !== undefined;
  const isLockedToChallan = !isEdit && Boolean(deliveryChallanPrefill);

  const form = useForm<CreateSalesInvoiceInput>({
    resolver: zodResolver(createSalesInvoiceSchema),
    defaultValues: {
      customerMode: salesInvoice?.customerMode ?? (deliveryChallanPrefill ? "PERMANENT" : "PERMANENT"),
      customerId: salesInvoice?.customerId ?? deliveryChallanPrefill?.customerId ?? "",
      quickCustomerName: salesInvoice?.quickCustomerName ?? "",
      quickCustomerMobile: salesInvoice?.quickCustomerMobile ?? "",
      quickCustomerGstin: salesInvoice?.quickCustomerGstin ?? "",
      quickCustomerAddress: salesInvoice?.quickCustomerAddress ?? "",
      invoiceDate: salesInvoice ? toDateInputValue(salesInvoice.invoiceDate) : todayDateInputValue(),
      placeOfSupplyStateCode: salesInvoice?.placeOfSupplyStateCode ?? options.companyStateCode ?? "",
      narration: salesInvoice?.narration ?? "",
      salesOrderId: salesInvoice?.salesOrderId ?? deliveryChallanPrefill?.salesOrderId ?? undefined,
      deliveryChallanId: salesInvoice?.deliveryChallanId ?? deliveryChallanPrefill?.deliveryChallanId ?? undefined,
      lines: salesInvoice
        ? salesInvoice.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
            rate: item.rate,
            discountPercent: item.discountPercent || undefined,
            discountAmount: item.discountAmount || undefined,
            isTaxOverridden: item.isTaxOverridden,
            overriddenCgst: item.overriddenCgst ?? undefined,
            overriddenSgst: item.overriddenSgst ?? undefined,
            overriddenIgst: item.overriddenIgst ?? undefined,
            overriddenCess: item.overriddenCess ?? undefined,
            overrideReason: item.overrideReason ?? undefined,
          }))
        : deliveryChallanPrefill
          ? deliveryChallanPrefill.lines.map((line) => ({
              productId: line.productId,
              warehouseId: line.warehouseId,
              quantity: line.quantity,
              rate: 0,
              discountPercent: undefined,
              discountAmount: undefined,
              isTaxOverridden: false,
            }))
          : [{ productId: "", warehouseId: "", quantity: 1, rate: 0, isTaxOverridden: false }],
      payments: salesInvoice
        ? salesInvoice.payments.map((payment) => ({
            ledgerId: payment.ledgerId,
            paymentModeId: payment.paymentModeId,
            amount: payment.amount,
            reference: payment.reference ?? undefined,
          }))
        : [],
    },
  });

  const customerMode = useWatch({ control: form.control, name: "customerMode" });
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const invoiceDate = useWatch({ control: form.control, name: "invoiceDate" });
  const placeOfSupplyStateCode = useWatch({ control: form.control, name: "placeOfSupplyStateCode" });
  const lines = useWatch({ control: form.control, name: "lines" });
  const payments = useWatch({ control: form.control, name: "payments" });

  const isIntraState = Boolean(options.companyStateCode && placeOfSupplyStateCode === options.companyStateCode);
  const selectedCustomerLedgerId = React.useMemo(
    () => options.customers.find((customer) => customer.id === customerId)?.ledgerId,
    [options.customers, customerId]
  );

  React.useEffect(() => {
    const validLines = (lines ?? []).filter(
      (line): line is NonNullable<typeof line> =>
        Boolean(line?.productId) && Boolean(line?.warehouseId) && (line?.quantity ?? 0) > 0 && (line?.rate ?? -1) >= 0
    );

    const handle = setTimeout(() => {
      if (validLines.length === 0 || !placeOfSupplyStateCode) {
        setPreview(EMPTY_PREVIEW);
        return;
      }

      void previewSalesInvoiceAction({
        customerMode: customerMode ?? "WALK_IN",
        customerId: customerId || undefined,
        invoiceDate: invoiceDate || todayDateInputValue(),
        placeOfSupplyStateCode,
        lines: validLines,
        payments: payments ?? [],
      }).then((result) => {
        if (result.success && result.data) {
          setPreview(result.data);
        }
      });
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [customerMode, customerId, invoiceDate, placeOfSupplyStateCode, lines, payments]);

  async function handleSubmit(data: CreateSalesInvoiceInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit ? await updateDraftAction(salesInvoice.id, data) : await createDraftAction(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save sales invoice." : "Failed to create sales invoice."));
        return;
      }

      toast.success(isEdit ? "Sales invoice saved successfully." : "Sales invoice draft created.");
      router.push(`${LIST_PATH}/${isEdit ? salesInvoice.id : result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save sales invoice." : "Failed to create sales invoice.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number: <span className="font-financial">{options.nextInvoiceNumber}</span>
          </p>
        ) : null}

        {deliveryChallanPrefill ? (
          <p className="text-xs text-muted-foreground">
            Linked to Delivery Challan <span className="font-financial">{deliveryChallanPrefill.challanNumber}</span>
          </p>
        ) : null}

        {!options.isLedgerMappingComplete ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            Configure{" "}
            <Link href="/settings/sales-ledgers" className="underline">
              Settings &gt; Sales &amp; GST Ledgers
            </Link>{" "}
            before you can post this invoice. You can still save it as a draft.
          </div>
        ) : null}

        <FormSection title="Customer">
          <div className="flex gap-2 sm:col-span-2">
            {CUSTOMER_MODES.map((mode) => (
              <Button
                key={mode.value}
                type="button"
                size="sm"
                variant={customerMode === mode.value ? "default" : "outline"}
                disabled={isLockedToChallan}
                onClick={() => form.setValue("customerMode", mode.value, { shouldValidate: true })}
              >
                {mode.label}
              </Button>
            ))}
          </div>

          {customerMode === "PERMANENT" ? (
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer *</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={options.customers}
                      value={field.value || undefined}
                      onChange={(next) => field.onChange(next ?? "")}
                      getOptionId={(customer) => customer.id}
                      getOptionLabel={(customer) => customer.name}
                      allowNone={false}
                      disabled={isLockedToChallan}
                      placeholder="Select a customer"
                    />
                  </FormControl>
                  <LedgerOutstandingBalance
                    ledgerId={selectedCustomerLedgerId}
                    fetchBalance={getLedgerOutstandingBalanceAction}
                    label="Outstanding Receivable"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {customerMode === "QUICK" ? (
            <>
              <FormField
                control={form.control}
                name="quickCustomerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quickCustomerMobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quickCustomerGstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quickCustomerAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground sm:col-span-2">
                If this invoice is left with an unpaid balance, this customer is automatically converted to a
                Permanent Customer when posted.
              </p>
            </>
          ) : null}

          {customerMode === "WALK_IN" ? (
            <FormField
              control={form.control}
              name="quickCustomerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
          ) : null}
        </FormSection>

        <FormSection title="Details">
          <FormField
            control={form.control}
            name="invoiceDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="placeOfSupplyStateCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Place of Supply *</FormLabel>
                <FormControl>
                  <Select value={field.value || NONE_VALUE} onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? "" : next)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a state">
                        {(current: string | null) => {
                          if (!current || current === NONE_VALUE) {
                            return "Select a state";
                          }
                          return GST_STATE_CODES.find((entry) => entry.code === current)?.name ?? "Select a state";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {GST_STATE_CODES.map((entry) => (
                        <SelectItem key={entry.code} value={entry.code}>
                          {entry.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="narration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Narration</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Lines" columns={1}>
          <SalesInvoiceLineEditor
            products={options.products}
            warehouses={options.warehouses}
            computations={preview.lines}
            customerId={customerMode === "PERMANENT" ? customerId || undefined : undefined}
            invoiceDate={invoiceDate || todayDateInputValue()}
            isIntraState={isIntraState}
            locked={isLockedToChallan}
          />
        </FormSection>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border p-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Taxable</p>
            <p className="font-financial">{preview.totals.taxableAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tax</p>
            <p className="font-financial">
              {(preview.totals.totalCgst + preview.totals.totalSgst + preview.totals.totalIgst + preview.totals.totalCess).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Round Off</p>
            <p className="font-financial">{preview.totals.roundOff.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="font-financial text-base font-semibold">{preview.totals.grandTotal.toFixed(2)}</p>
          </div>
        </div>

        <FormSection title="Payments" columns={1}>
          <SalesInvoicePaymentEditor
            paymentLedgers={options.paymentLedgers}
            paymentModes={options.paymentModes}
            grandTotal={preview.totals.grandTotal}
            customerLedgerId={selectedCustomerLedgerId}
          />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save Draft"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
