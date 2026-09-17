"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SearchableSelect } from "@/components/common/searchable-select";
import {
  createGoodsReceiptNoteAction,
  updateGoodsReceiptNoteAction,
} from "@/modules/goods-receipt-notes/actions/goods-receipt-note-actions";
import { GoodsReceiptNoteLineEditor } from "@/modules/goods-receipt-notes/components/goods-receipt-note-line-editor";
import {
  createGoodsReceiptNoteSchema,
  type CreateGoodsReceiptNoteInput,
} from "@/modules/goods-receipt-notes/validation/goods-receipt-note-schema";
import type {
  GoodsReceiptNoteDetail,
  GoodsReceiptNoteFormOptions,
  OpenPurchaseOrderLineOption,
  PurchaseOrderPrefill,
} from "@/types/goods-receipt-note";

const LIST_PATH = "/purchase/receipts";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

interface GoodsReceiptNoteFormProps {
  options: GoodsReceiptNoteFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  goodsReceiptNote?: GoodsReceiptNoteDetail;
  /** When present (and not editing), pre-fills the header/lines from a
   * Purchase Order's remaining quantities — see
   * goods-receipt-note-service.ts's file comment for why this replaces a
   * dedicated createFromPurchaseOrder persist path. */
  purchaseOrderPrefill?: PurchaseOrderPrefill | null;
}

export function GoodsReceiptNoteForm({ options, goodsReceiptNote, purchaseOrderPrefill }: GoodsReceiptNoteFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = goodsReceiptNote !== undefined;

  const linkedPurchaseOrderId = goodsReceiptNote?.purchaseOrderId ?? purchaseOrderPrefill?.purchaseOrderId ?? undefined;
  const linkedOrderNumber = goodsReceiptNote?.purchaseOrder?.orderNumber ?? purchaseOrderPrefill?.orderNumber;

  // A GRN linked to a Purchase Order locks its lines to that order's own
  // items — new lines can't be added and the product can't change (a line
  // cannot reference an order item the header itself doesn't link to, per
  // 43-goods-receipt-note.md's Data Model). True on create (from
  // purchaseOrderPrefill) and when editing a DRAFT that was itself linked.
  const linkedLines: OpenPurchaseOrderLineOption[] | undefined = !isEdit
    ? (purchaseOrderPrefill?.lines ?? undefined)
    : goodsReceiptNote.purchaseOrderId
      ? goodsReceiptNote.items.map((item) => ({
          purchaseOrderItemId: item.purchaseOrderItemId ?? "",
          productId: item.productId,
          productName: item.product.name,
          productCode: item.product.productCode,
          unitSymbol: "",
          unitDecimalPlaces: 4,
          orderedQuantity: item.quantity,
          receivedQuantity: 0,
          remainingQuantity: item.quantity,
        }))
      : undefined;

  const form = useForm<CreateGoodsReceiptNoteInput>({
    resolver: zodResolver(createGoodsReceiptNoteSchema),
    defaultValues: {
      supplierId: goodsReceiptNote?.supplierId ?? purchaseOrderPrefill?.supplierId ?? "",
      purchaseOrderId: linkedPurchaseOrderId,
      grnDate: goodsReceiptNote ? toDateInputValue(goodsReceiptNote.grnDate) : todayDateInputValue(),
      narration: goodsReceiptNote?.narration ?? "",
      lines: goodsReceiptNote
        ? goodsReceiptNote.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
            rejectedQuantity: item.rejectedQuantity,
            purchaseOrderItemId: item.purchaseOrderItemId ?? undefined,
          }))
        : purchaseOrderPrefill
          ? purchaseOrderPrefill.lines.map((line) => ({
              productId: line.productId,
              warehouseId: "",
              quantity: line.remainingQuantity,
              rejectedQuantity: 0,
              purchaseOrderItemId: line.purchaseOrderItemId,
            }))
          : [{ productId: "", warehouseId: "", quantity: 1, rejectedQuantity: 0, purchaseOrderItemId: undefined }],
    },
  });

  async function handleSubmit(data: CreateGoodsReceiptNoteInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateGoodsReceiptNoteAction(goodsReceiptNote.id, data)
        : await createGoodsReceiptNoteAction(data);

      if (!result.success || !result.data) {
        toast.error(
          result.error ?? (isEdit ? "Failed to save goods receipt note." : "Failed to create goods receipt note.")
        );
        return;
      }

      toast.success(isEdit ? "Goods receipt note saved successfully." : "Goods receipt note created successfully.");
      router.push(isEdit ? `${LIST_PATH}/${goodsReceiptNote.id}` : `${LIST_PATH}/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save goods receipt note." : "Failed to create goods receipt note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSupplierLocked = linkedPurchaseOrderId !== undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number: <span className="font-financial">{options.nextGrnNumber}</span>
          </p>
        ) : null}

        {linkedOrderNumber ? (
          <p className="text-xs text-muted-foreground">
            Linked to Purchase Order <span className="font-financial">{linkedOrderNumber}</span>
          </p>
        ) : null}

        <FormSection title="Details">
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
                    disabled={isSupplierLocked}
                  />
                </FormControl>
                {isSupplierLocked ? (
                  <p className="text-xs text-muted-foreground">Locked to the linked purchase order&apos;s supplier.</p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="grnDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GRN Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
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
          <GoodsReceiptNoteLineEditor
            products={options.products}
            warehouses={options.warehouses}
            linkedLines={linkedLines}
          />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Goods Receipt Note"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
