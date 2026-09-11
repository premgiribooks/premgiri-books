"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ProductOptionSelector, type ProductOptionItem } from "@/modules/products/components/product-option-selector";
import {
  createPhysicalVerificationDraftAction,
  updatePhysicalVerificationDraftAction,
} from "@/modules/physical-verifications/actions/physical-verification-actions";
import { PhysicalVerificationLineEditor } from "@/modules/physical-verifications/components/physical-verification-line-editor";
import {
  createPhysicalVerificationSchema,
  type CreatePhysicalVerificationInput,
} from "@/modules/physical-verifications/validation/physical-verification-schema";
import type {
  PhysicalVerificationDetail,
  PhysicalVerificationFormOptions,
  PhysicalVerificationWarehouseOption,
} from "@/types/physical-verification";

const LIST_PATH = "/inventory/verifications";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

function warehouseLabel(warehouse: PhysicalVerificationWarehouseOption): string {
  return `${warehouse.name} (${warehouse.code})`;
}

interface PhysicalVerificationFormProps {
  options: PhysicalVerificationFormOptions;
  /** When present the form saves via update; otherwise it creates. */
  physicalVerification?: PhysicalVerificationDetail;
}

export function PhysicalVerificationForm({ options, physicalVerification }: PhysicalVerificationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = physicalVerification !== undefined;

  const warehouseOptions: ProductOptionItem[] = React.useMemo(
    () => options.warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouseLabel(warehouse), isActive: warehouse.isActive })),
    [options.warehouses]
  );

  const form = useForm<CreatePhysicalVerificationInput>({
    resolver: zodResolver(createPhysicalVerificationSchema),
    defaultValues: {
      verificationDate: physicalVerification ? toDateInputValue(physicalVerification.verificationDate) : todayDateInputValue(),
      warehouseId: physicalVerification?.warehouseId ?? "",
      narration: physicalVerification?.narration ?? undefined,
      lines: physicalVerification
        ? physicalVerification.items.map((item) => ({ productId: item.productId, countedQuantity: item.countedQuantity }))
        : [{ productId: "", countedQuantity: 0 }],
    },
  });

  async function handleSubmit(data: CreatePhysicalVerificationInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updatePhysicalVerificationDraftAction(physicalVerification.id, data)
        : await createPhysicalVerificationDraftAction(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? (isEdit ? "Failed to save physical verification." : "Failed to create physical verification."));
        return;
      }

      toast.success(isEdit ? "Physical verification saved successfully." : "Physical verification draft created.");
      router.push(`${LIST_PATH}/${isEdit ? physicalVerification.id : result.data.id}`);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to save physical verification." : "Failed to create physical verification.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {!isEdit ? (
          <p className="text-xs text-muted-foreground">
            Next number (assigned on completion): <span className="font-financial">{options.nextVerificationNumber}</span>
          </p>
        ) : null}

        <FormSection title="Details">
          <FormField
            control={form.control}
            name="verificationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verification Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="warehouseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warehouse *</FormLabel>
                <FormControl>
                  <ProductOptionSelector
                    options={warehouseOptions}
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? "")}
                    allowNone={false}
                    placeholder="Select warehouse"
                  />
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
                  <Input {...field} value={field.value ?? ""} placeholder="Optional" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection title="Lines" columns={1}>
          <PhysicalVerificationLineEditor products={options.products} />
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
