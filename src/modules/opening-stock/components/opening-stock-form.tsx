"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/common/form-section";
import { LoadingBar } from "@/components/common/loading-bar";
import { Form } from "@/components/ui/form";
import { recordOpeningStockAction } from "@/modules/opening-stock/actions/opening-stock-actions";
import { OpeningStockLineEditor } from "@/modules/opening-stock/components/opening-stock-line-editor";
import { recordOpeningStockSchema, type RecordOpeningStockInput } from "@/modules/opening-stock/validation/opening-stock-schema";
import type { OpeningStockFormOptions } from "@/types/opening-stock";

const LIST_PATH = "/inventory/opening-stock";

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

interface OpeningStockFormProps {
  options: OpeningStockFormOptions;
}

export function OpeningStockForm({ options }: OpeningStockFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<RecordOpeningStockInput>({
    resolver: zodResolver(recordOpeningStockSchema),
    defaultValues: {
      lines: [
        {
          productId: "",
          warehouseId: "",
          quantity: 1,
          unitCost: undefined,
          transactionDate: todayDateInputValue(),
          narration: undefined,
        },
      ],
    },
  });

  async function handleSubmit(data: RecordOpeningStockInput) {
    setIsSubmitting(true);
    try {
      const result = await recordOpeningStockAction(data);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to record opening stock.");
        return;
      }

      toast.success("Opening stock recorded successfully.");
      router.push(LIST_PATH);
      router.refresh();
    } catch {
      toast.error("Failed to record opening stock.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        <FormSection title="Lines" columns={1}>
          <OpeningStockLineEditor products={options.products} warehouses={options.warehouses} />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingBar className="w-8" label="Saving" data-icon="inline-start" /> : null}
            {isSubmitting ? "Saving…" : "Record Opening Stock"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
