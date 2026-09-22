"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { LoadingBar } from "@/components/common/loading-bar";
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
import { createBranchAction, updateBranchAction } from "@/modules/branch/actions/branch-actions";
import {
  createBranchSchema,
  type CreateBranchInput,
} from "@/modules/branch/validation/branch-schema";
import type { Branch } from "@/types/branch";

const LIST_PATH = "/branch";

interface BranchFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set, so one component serves both screens,
   * mirroring warehouse-form.tsx. */
  branch?: Branch;
}

export function BranchForm({ branch }: BranchFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = branch !== undefined;

  const form = useForm<CreateBranchInput>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: {
      branchName: branch?.branchName ?? "",
      branchCode: branch?.branchCode ?? "",
      address: branch?.address ?? "",
      contactNumber: branch?.contactNumber ?? "",
      gstRegistration: branch?.gstRegistration ?? "",
    },
  });

  async function handleSubmit(data: CreateBranchInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateBranchAction(branch.id, data)
        : await createBranchAction(data);

      if (result.success) {
        toast.success(isEdit ? "Branch saved successfully." : "Branch created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(result.error ?? (isEdit ? "Failed to save branch." : "Failed to create branch."));
    } catch {
      // A Server Action can reject outright (network drop, server crash) —
      // surface it instead of silently re-enabling the button (the
      // warehouse-form.tsx defensive convention).
      toast.error(isEdit ? "Failed to save branch." : "Failed to create branch.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-xl flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="branchName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. Pune Branch" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="branchCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Code *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. PUNE" />
                </FormControl>
                <p className="text-xs text-muted-foreground">Unique per company.</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Number</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gstRegistration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GST Registration</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="15-character GSTIN" />
              </FormControl>
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
            {isSubmitting ? <LoadingBar className="w-8" label="Saving" data-icon="inline-start" /> : null}
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Branch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
