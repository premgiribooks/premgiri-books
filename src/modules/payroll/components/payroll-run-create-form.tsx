"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPayrollRunDraftAction, previewPayrollRunAction } from "@/modules/payroll/actions/payroll-run-actions";
import { PayrollRunLineTable } from "@/modules/payroll/components/payroll-run-line-table";
import type { CreatePayrollRunInput } from "@/modules/payroll/validation/payroll-run-schema";
import type { PayrollRunPreview } from "@/types/payroll-run";

interface PayrollRunCreateFormProps {
  isLedgerMappingComplete: boolean;
}

/** Create Payroll Run — period picker -> live preview (refreshable) ->
 * "Create Draft" persists it (63-payroll.md's UI section). The preview
 * itself is never persisted; only the explicit save button calls
 * `createDraft`. */
export function PayrollRunCreateForm({ isLedgerMappingComplete }: PayrollRunCreateFormProps) {
  const router = useRouter();
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [narration, setNarration] = React.useState("");
  const [preview, setPreview] = React.useState<PayrollRunPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canPreview = periodStart !== "" && periodEnd !== "";

  async function handlePreview() {
    if (!canPreview) {
      return;
    }
    setIsPreviewing(true);
    setError(null);
    const input: CreatePayrollRunInput = { periodStart, periodEnd, narration: narration || undefined };
    const result = await previewPayrollRunAction(input);
    setIsPreviewing(false);

    if (!result.success || !result.data) {
      setError(result.error ?? "Failed to compute the preview.");
      setPreview(null);
      return;
    }
    setPreview(result.data);
  }

  async function handleSaveDraft() {
    if (!preview) {
      return;
    }
    setIsSaving(true);
    const input: CreatePayrollRunInput = { periodStart, periodEnd, narration: narration || undefined };
    const result = await createPayrollRunDraftAction(input);
    setIsSaving(false);

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Failed to create the payroll run.");
      return;
    }
    toast.success("Payroll run created as draft.");
    router.push(`/employees/payroll/${result.data.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {!isLedgerMappingComplete ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Configure the Salary Expense and Salary Payable ledgers in Settings &gt; Sales &amp; Purchase GST Ledgers before
          posting a payroll run. Drafts can still be created and previewed.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodStart">Period Start</Label>
          <Input id="periodStart" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodEnd">Period End</Label>
          <Input id="periodEnd" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-1">
          <Label htmlFor="narration">Narration (optional)</Label>
          <Textarea id="narration" value={narration} onChange={(event) => setNarration(event.target.value)} rows={1} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={!canPreview || isPreviewing} onClick={handlePreview}>
          {isPreviewing ? "Computing…" : preview ? "Refresh Preview" : "Preview"}
        </Button>
        {preview ? (
          <Button type="button" disabled={isSaving} onClick={handleSaveDraft}>
            {isSaving ? "Saving…" : "Create Draft"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {preview ? (
        <div className="flex flex-col gap-3">
          {preview.excludedEmployees.length > 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              {preview.excludedEmployees.length} employee(s) excluded (no basic salary set):{" "}
              {preview.excludedEmployees.map((employee) => employee.fullName).join(", ")}
            </div>
          ) : null}
          <PayrollRunLineTable lines={preview.lines} totalNetSalary={preview.totalNetSalary} />
        </div>
      ) : null}
    </div>
  );
}
