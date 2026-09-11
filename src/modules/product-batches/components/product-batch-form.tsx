"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  createProductBatchAction,
  updateProductBatchAction,
} from "@/modules/product-batches/actions/product-batch-actions";
import {
  createProductBatchSchema,
  type CreateProductBatchInput,
} from "@/modules/product-batches/validation/product-batch-schema";
import type { ProductBatchWithStock } from "@/types/product-batch";

interface ProductBatchFormProps {
  productId: string;
  /** When present the form saves via update; otherwise it creates. */
  batch?: ProductBatchWithStock;
  onSaved?: () => void;
  onCancel?: () => void;
}

/**
 * Create/edit form for one ProductBatch (50-batch-tracking.md) — batchNumber
 * and both dates are disabled once the batch has any recorded
 * StockTransaction ("never renamed or removed" once moved; the server is the
 * real authority, this only avoids submitting a doomed edit). No status quo
 * page route consumes this yet — it is composed directly by whatever screen
 * needs it (a dialog, a future Batches tab) once wired.
 */
export function ProductBatchForm({ productId, batch, onSaved, onCancel }: ProductBatchFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = batch !== undefined;
  const disabled = batch?.hasMovements ?? false;

  const form = useForm<CreateProductBatchInput>({
    resolver: zodResolver(createProductBatchSchema),
    defaultValues: {
      productId,
      batchNumber: batch?.batchNumber ?? "",
      manufactureDate: batch?.manufactureDate ? batch.manufactureDate.toISOString().slice(0, 10) : undefined,
      expiryDate: batch?.expiryDate ? batch.expiryDate.toISOString().slice(0, 10) : undefined,
    },
  });

  async function handleSubmit(data: CreateProductBatchInput) {
    setIsSubmitting(true);
    try {
      const result =
        isEdit && batch
          ? await updateProductBatchAction(batch.id, productId, data)
          : await createProductBatchAction(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save batch." : "Failed to create batch."));
        return;
      }

      if (isEdit && "status" in result.data) {
        if (result.data.status === "has_movements") {
          toast.error("This batch has recorded stock movements and can no longer be edited.");
          return;
        }
        if (result.data.status === "not_found") {
          toast.error("Batch not found.");
          return;
        }
      }

      toast.success(isEdit ? "Batch saved successfully." : "Batch created successfully.");
      onSaved?.();
    } catch {
      toast.error(isEdit ? "Failed to save batch." : "Failed to create batch.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-md flex-col gap-6">
        <FormField
          control={form.control}
          name="batchNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Batch Number *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. B-2026-001" disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="manufactureDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Manufacture Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expiryDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expiry Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {disabled ? (
          <p className="text-xs text-muted-foreground">
            This batch has recorded stock movements — its number and dates can no longer be changed.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || disabled}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
