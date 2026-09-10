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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDeliveryChallanAction,
  updateDeliveryChallanAction,
} from "@/modules/delivery-challans/actions/delivery-challan-actions";
import { DeliveryChallanLineEditor } from "@/modules/delivery-challans/components/delivery-challan-line-editor";
import {
  createDeliveryChallanSchema,
  type CreateDeliveryChallanInput,
} from "@/modules/delivery-challans/validation/delivery-challan-schema";
import type {
  DeliveryChallanDetail,
  DeliveryChallanFormOptions,
  OpenSalesOrderLineOption,
  SalesOrderPrefill,
} from "@/types/delivery-challan";

const LIST_PATH = "/sales/challans";

// Base UI's Select decides controlled-vs-uncontrolled on the first render by
// checking whether `value` is `undefined` — mirrors sales-order-form.tsx's
// NONE_VALUE fix exactly (commit f45f7c1).
const NONE_VALUE = "__none__";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

interface DeliveryChallanFormProps {
  options: DeliveryChallanFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  deliveryChallan?: DeliveryChallanDetail;
  /** When present (and not editing), pre-fills the header/lines from a Sales
   * Order's remaining quantities — see delivery-challan-service.ts's file
   * comment for why this replaces a dedicated createFromSalesOrder persist
   * path. */
  salesOrderPrefill?: SalesOrderPrefill | null;
}

export function DeliveryChallanForm({ options, deliveryChallan, salesOrderPrefill }: DeliveryChallanFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = deliveryChallan !== undefined;

  const linkedSalesOrderId = deliveryChallan?.salesOrderId ?? salesOrderPrefill?.salesOrderId ?? undefined;
  const linkedOrderNumber = deliveryChallan?.salesOrder?.orderNumber ?? salesOrderPrefill?.orderNumber;

  // A challan linked to a Sales Order locks its lines to that order's own
  // items — new lines can't be added and the product can't change (a line
  // cannot reference an order item the header itself doesn't link to, per
  // 37-delivery-challans.md's Data Model). True on create (from
  // salesOrderPrefill) and when editing a DRAFT that was itself linked.
  const linkedLines: OpenSalesOrderLineOption[] | undefined = !isEdit
    ? (salesOrderPrefill?.lines ?? undefined)
    : deliveryChallan.salesOrderId
      ? deliveryChallan.items.map((item) => ({
          salesOrderItemId: item.salesOrderItemId ?? "",
          productId: item.productId,
          productName: item.product.name,
          productCode: item.product.productCode,
          unitSymbol: "",
          unitDecimalPlaces: 4,
          orderedQuantity: item.quantity,
          deliveredQuantity: 0,
          remainingQuantity: item.quantity,
        }))
      : undefined;

  const form = useForm<CreateDeliveryChallanInput>({
    resolver: zodResolver(createDeliveryChallanSchema),
    defaultValues: {
      customerId: deliveryChallan?.customerId ?? salesOrderPrefill?.customerId ?? "",
      salesOrderId: linkedSalesOrderId,
      challanDate: deliveryChallan ? toDateInputValue(deliveryChallan.challanDate) : todayDateInputValue(),
      narration: deliveryChallan?.narration ?? "",
      lines: deliveryChallan
        ? deliveryChallan.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
            salesOrderItemId: item.salesOrderItemId ?? undefined,
          }))
        : salesOrderPrefill
          ? salesOrderPrefill.lines.map((line) => ({
              productId: line.productId,
              warehouseId: "",
              quantity: line.remainingQuantity,
              salesOrderItemId: line.salesOrderItemId,
            }))
          : [{ productId: "", warehouseId: "", quantity: 1, salesOrderItemId: undefined }],
    },
  });

  async function handleSubmit(data: CreateDeliveryChallanInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateDeliveryChallanAction(deliveryChallan.id, data)
        : await createDeliveryChallanAction(data);

      if (!result.success || !result.data) {
        toast.error(
          result.error ?? (isEdit ? "Failed to save delivery challan." : "Failed to create delivery challan.")
        );
        return;
      }

      toast.success(isEdit ? "Delivery challan saved successfully." : "Delivery challan created successfully.");
      router.push(isEdit ? `${LIST_PATH}/${deliveryChallan.id}` : `${LIST_PATH}/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save delivery challan." : "Failed to create delivery challan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCustomerLocked = linkedSalesOrderId !== undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number: <span className="font-financial">{options.nextChallanNumber}</span>
          </p>
        ) : null}

        {linkedOrderNumber ? (
          <p className="text-xs text-muted-foreground">
            Linked to Sales Order <span className="font-financial">{linkedOrderNumber}</span>
          </p>
        ) : null}

        <FormSection title="Details">
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer *</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(next) => field.onChange(!next || next === NONE_VALUE ? "" : next)}
                    disabled={isCustomerLocked}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a customer">
                        {(current: string | null) => {
                          if (!current || current === NONE_VALUE) {
                            return "Select a customer";
                          }
                          return (
                            options.customers.find((customer) => customer.id === current)?.name ??
                            "Select a customer"
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {options.customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                {isCustomerLocked ? (
                  <p className="text-xs text-muted-foreground">Locked to the linked sales order&apos;s customer.</p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="challanDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Challan Date *</FormLabel>
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
          <DeliveryChallanLineEditor
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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Delivery Challan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
