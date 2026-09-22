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
import { LoadingBar } from "@/components/common/loading-bar";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { GST_STATE_CODES } from "@/engines/gst/state-codes";
import {
  createDraftAction,
  getLedgerOutstandingBalanceAction,
  previewPurchaseInvoiceAction,
  updateDraftAction,
} from "@/modules/purchase-invoices/actions/purchase-invoice-actions";
import { PurchaseInvoiceLineEditor } from "@/modules/purchase-invoices/components/purchase-invoice-line-editor";
import { PurchaseInvoicePaymentEditor } from "@/modules/purchase-invoices/components/purchase-invoice-payment-editor";
import { useShortcutEffect } from "@/lib/shortcut-events";
import {
  createPurchaseInvoiceSchema,
  type CreatePurchaseInvoiceInput,
} from "@/modules/purchase-invoices/validation/purchase-invoice-schema";
import type {
  GoodsReceiptNotePrefill,
  PurchaseInvoiceDetail,
  PurchaseInvoiceFormOptions,
  PurchaseInvoicePreview,
} from "@/types/purchase-invoice";

const LIST_PATH = "/purchase/invoices";
const PREVIEW_DEBOUNCE_MS = 300;
const NONE_VALUE = "__none__";

const EMPTY_PREVIEW: PurchaseInvoicePreview = {
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

interface PurchaseInvoiceFormProps {
  options: PurchaseInvoiceFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  purchaseInvoice?: PurchaseInvoiceDetail;
  /** When present (and not editing), pre-fills the header/lines from a
   * Goods Receipt Note's lines — see
   * purchase-invoice-service.ts's getGoodsReceiptNotePrefill. */
  goodsReceiptNotePrefill?: GoodsReceiptNotePrefill | null;
}

export function PurchaseInvoiceForm({ options, purchaseInvoice, goodsReceiptNotePrefill }: PurchaseInvoiceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [preview, setPreview] = React.useState<PurchaseInvoicePreview>(EMPTY_PREVIEW);
  const isEdit = purchaseInvoice !== undefined;
  const isLockedToGrn = !isEdit && Boolean(goodsReceiptNotePrefill);

  const form = useForm<CreatePurchaseInvoiceInput>({
    resolver: zodResolver(createPurchaseInvoiceSchema),
    defaultValues: {
      supplierId: purchaseInvoice?.supplierId ?? goodsReceiptNotePrefill?.supplierId ?? "",
      supplierInvoiceNumber: purchaseInvoice?.supplierInvoiceNumber ?? "",
      invoiceDate: purchaseInvoice ? toDateInputValue(purchaseInvoice.invoiceDate) : todayDateInputValue(),
      placeOfSupplyStateCode: purchaseInvoice?.placeOfSupplyStateCode ?? options.companyStateCode ?? "",
      narration: purchaseInvoice?.narration ?? "",
      purchaseOrderId: purchaseInvoice?.purchaseOrderId ?? goodsReceiptNotePrefill?.purchaseOrderId ?? undefined,
      goodsReceiptNoteId: purchaseInvoice?.goodsReceiptNoteId ?? goodsReceiptNotePrefill?.goodsReceiptNoteId ?? undefined,
      lines: purchaseInvoice
        ? purchaseInvoice.items.map((item) => ({
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
        : goodsReceiptNotePrefill
          ? goodsReceiptNotePrefill.lines.map((line) => ({
              productId: line.productId,
              warehouseId: line.warehouseId,
              quantity: line.quantity,
              rate: 0,
              discountPercent: undefined,
              discountAmount: undefined,
              isTaxOverridden: false,
            }))
          : [{ productId: "", warehouseId: "", quantity: 1, rate: 0, isTaxOverridden: false }],
      payments: purchaseInvoice
        ? purchaseInvoice.payments.map((payment) => ({
            ledgerId: payment.ledgerId,
            paymentModeId: payment.paymentModeId,
            amount: payment.amount,
            reference: payment.reference ?? undefined,
          }))
        : [],
    },
  });

  const supplierId = useWatch({ control: form.control, name: "supplierId" });
  const invoiceDate = useWatch({ control: form.control, name: "invoiceDate" });
  const placeOfSupplyStateCode = useWatch({ control: form.control, name: "placeOfSupplyStateCode" });
  const lines = useWatch({ control: form.control, name: "lines" });
  const payments = useWatch({ control: form.control, name: "payments" });

  const isIntraState = Boolean(options.companyStateCode && placeOfSupplyStateCode === options.companyStateCode);
  const selectedSupplierLedgerId = React.useMemo(
    () => options.suppliers.find((supplier) => supplier.id === supplierId)?.ledgerId,
    [options.suppliers, supplierId]
  );

  React.useEffect(() => {
    const validLines = (lines ?? []).filter(
      (line): line is NonNullable<typeof line> =>
        Boolean(line?.productId) && Boolean(line?.warehouseId) && (line?.quantity ?? 0) > 0 && (line?.rate ?? -1) >= 0
    );

    const handle = setTimeout(() => {
      if (validLines.length === 0 || !placeOfSupplyStateCode || !supplierId) {
        setPreview(EMPTY_PREVIEW);
        return;
      }

      void previewPurchaseInvoiceAction({
        supplierId,
        supplierInvoiceNumber: form.getValues("supplierInvoiceNumber") || "PREVIEW",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, invoiceDate, placeOfSupplyStateCode, lines, payments]);

  async function handleSubmit(data: CreatePurchaseInvoiceInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit ? await updateDraftAction(purchaseInvoice.id, data) : await createDraftAction(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save purchase invoice." : "Failed to create purchase invoice."));
        return;
      }

      toast.success(isEdit ? "Purchase invoice saved successfully." : "Purchase invoice draft created.");
      router.push(`${LIST_PATH}/${isEdit ? purchaseInvoice.id : result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save purchase invoice." : "Failed to create purchase invoice.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // "Save/Post" keyboard shortcut (src/config/shortcuts.ts) — mirrors
  // sales-invoice-form.tsx's identical wiring.
  useShortcutEffect("save", () => {
    if (!isSubmitting) {
      void form.handleSubmit(handleSubmit)();
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number (assigned on posting):{" "}
            <span className="font-financial">{options.nextInvoiceNumber}</span>
          </p>
        ) : null}

        {goodsReceiptNotePrefill ? (
          <p className="text-xs text-muted-foreground">
            Linked to Goods Receipt Note <span className="font-financial">{goodsReceiptNotePrefill.grnNumber}</span>
          </p>
        ) : null}

        {!options.isLedgerMappingComplete ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            Configure{" "}
            <Link href="/settings/sales-ledgers" className="underline">
              Settings &gt; Sales &amp; Purchase GST Ledgers
            </Link>{" "}
            before you can post this invoice. You can still save it as a draft.
          </div>
        ) : null}

        <FormSection title="Supplier">
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier *</FormLabel>
                <FormControl>
                  <SearchableSelect
                    options={options.suppliers}
                    value={field.value || undefined}
                    onChange={(next) => field.onChange(next ?? "")}
                    getOptionId={(supplier) => supplier.id}
                    getOptionLabel={(supplier) => supplier.name}
                    allowNone={false}
                    placeholder="Select a supplier"
                    disabled={isLockedToGrn}
                  />
                </FormControl>
                <LedgerOutstandingBalance
                  ledgerId={selectedSupplierLedgerId}
                  fetchBalance={getLedgerOutstandingBalanceAction}
                  label="Outstanding Payable"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supplierInvoiceNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Invoice Number *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="The supplier's own bill number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          <PurchaseInvoiceLineEditor
            products={options.products}
            warehouses={options.warehouses}
            computations={preview.lines}
            isIntraState={isIntraState}
            locked={isLockedToGrn}
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
          <PurchaseInvoicePaymentEditor
            paymentLedgers={options.paymentLedgers}
            paymentModes={options.paymentModes}
            grandTotal={preview.totals.grandTotal}
          />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Saving" data-icon="inline-start" /> : null}
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save Draft"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
