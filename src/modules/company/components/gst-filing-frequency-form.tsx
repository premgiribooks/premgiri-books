"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateGstFilingFrequencyAction } from "@/modules/company/actions/company-actions";
import type { GstFilingFrequencyInput } from "@/modules/company/validation/company-schema";

type GstFilingFrequency = GstFilingFrequencyInput["gstFilingFrequency"];

const FREQUENCY_LABELS: Record<GstFilingFrequency, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
};

interface GstFilingFrequencyFormProps {
  companyId: string;
  defaultValue: GstFilingFrequency;
  disabled: boolean;
}

/** GSTR-1/GSTR-3B period-selector granularity (58-gstr-1.md) — drives only
 * the UI's month-vs-quarter picker; no query-layer logic branches on it. */
export function GstFilingFrequencyForm({ companyId, defaultValue, disabled }: GstFilingFrequencyFormProps) {
  const [value, setValue] = React.useState<GstFilingFrequency>(defaultValue);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSave() {
    setIsSubmitting(true);
    const result = await updateGstFilingFrequencyAction(companyId, { gstFilingFrequency: value });
    setIsSubmitting(false);

    if (result.success) {
      toast.success("GST filing frequency saved.");
      return;
    }
    toast.error(result.error ?? "Failed to save the GST filing frequency.");
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select value={value} onValueChange={(next) => setValue(next as GstFilingFrequency)} disabled={disabled}>
        <SelectTrigger className="w-full sm:w-48" aria-label="GST filing frequency">
          <SelectValue>{(current: string | null) => FREQUENCY_LABELS[current as GstFilingFrequency] ?? "Select"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MONTHLY">Monthly</SelectItem>
          <SelectItem value="QUARTERLY">Quarterly</SelectItem>
        </SelectContent>
      </Select>
      {!disabled ? (
        <Button onClick={handleSave} disabled={isSubmitting || value === defaultValue}>
          Save
        </Button>
      ) : null}
    </div>
  );
}
