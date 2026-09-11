"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSerialNumberAction } from "@/modules/serial-numbers/actions/serial-number-actions";

interface SerialNumberFormProps {
  productId: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

interface LineResult {
  serialValue: string;
  success: boolean;
  error?: string;
}

// One line per serial value — pasting a batch of physically distinct
// received units is the exact scenario 51-serial-number-tracking.md's UI
// section calls out ("often received in batches of individually distinct
// units"). No bulk service/API exists (the spec lists only
// createSerialNumber(input), singular) — this form calls it once per
// non-blank line and reports a per-line result, the simplest shape matching
// the spec's own "one line per serial" stance.
function parseSerialValues(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Register Serial(s) form (51-serial-number-tracking.md's UI section) —
 * supports pasting or typing multiple serial values at once, one per line.
 * No edit path exists for a created serial (see the spec's Decisions — a
 * wrong value is corrected by deactivating it and registering the correct
 * one), so this form only ever creates.
 */
export function SerialNumberForm({ productId, onSaved, onCancel }: SerialNumberFormProps) {
  const [rawValue, setRawValue] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const serialValues = parseSerialValues(rawValue);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (serialValues.length === 0) {
      toast.error("Enter at least one serial value.");
      return;
    }

    setIsSubmitting(true);
    try {
      const results: LineResult[] = await Promise.all(
        serialValues.map(async (serialValue): Promise<LineResult> => {
          const result = await createSerialNumberAction({ productId, serialValue });
          return { serialValue, success: result.success, error: result.error ?? undefined };
        })
      );

      const succeeded = results.filter((result) => result.success);
      const failed = results.filter((result) => !result.success);

      if (succeeded.length > 0) {
        toast.success(
          succeeded.length === 1
            ? "Serial number registered successfully."
            : `${succeeded.length} serial numbers registered successfully.`
        );
      }
      for (const failure of failed) {
        toast.error(`"${failure.serialValue}": ${failure.error ?? "Failed to register."}`);
      }

      if (failed.length === 0) {
        onSaved?.();
      } else {
        // Keep only the failed lines so the user can fix and resubmit
        // without retyping the ones that already succeeded.
        setRawValue(failed.map((failure) => failure.serialValue).join("\n"));
      }
    } catch {
      toast.error("Failed to register serial numbers.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="serial-values" className="text-sm font-medium text-foreground">
          Serial Value(s) *
        </label>
        <Textarea
          id="serial-values"
          value={rawValue}
          onChange={(event) => setRawValue(event.target.value)}
          placeholder={"One serial per line, e.g.\nIMEI-0001\nIMEI-0002"}
          rows={6}
        />
        <p className="text-xs text-muted-foreground">
          {serialValues.length > 0
            ? `${serialValues.length} serial${serialValues.length === 1 ? "" : "s"} ready to register.`
            : "Paste or type one serial value per line."}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || serialValues.length === 0}>
          {isSubmitting ? "Registering…" : "Register"}
        </Button>
      </div>
    </form>
  );
}
