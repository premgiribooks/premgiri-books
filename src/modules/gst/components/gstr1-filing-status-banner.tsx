"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/api";
import type { GstFilingRecord } from "@/types/gstr1";

interface Gstr1FilingStatusBannerProps {
  periodStart: string;
  periodEnd: string;
  filingRecord: GstFilingRecord | null;
  canApprove: boolean;
  /** Shared by every GstFilingRecord-backed return (58-gstr-1.md's own,
   * reused unmodified by 59-gstr-3b.md) — the caller supplies its own
   * returnType-scoped Server Actions so this component stays independent of
   * any one return's action module. */
  onMarkFiled: (input: { periodStart: string; periodEnd: string; arn?: string }) => Promise<ActionResult<GstFilingRecord>>;
  onReopen: (id: string) => Promise<ActionResult<GstFilingRecord>>;
}

/** Open/Filed status + Mark as Filed (with optional ARN) / Reopen Period —
 * advisory only (58-gstr-1.md Business Rules): never blocks a new posting
 * into this period, it only records the fact that it was filed. */
export function Gstr1FilingStatusBanner({
  periodStart,
  periodEnd,
  filingRecord,
  canApprove,
  onMarkFiled,
  onReopen,
}: Gstr1FilingStatusBannerProps) {
  const router = useRouter();
  const [isMarkDialogOpen, setIsMarkDialogOpen] = React.useState(false);
  const [arn, setArn] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isFiled = filingRecord?.status === "FILED";

  async function handleMarkFiled() {
    setIsSubmitting(true);
    const result = await onMarkFiled({ periodStart, periodEnd, arn: arn || undefined });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to mark this period as filed.");
      return;
    }
    toast.success("Period marked as filed.");
    setIsMarkDialogOpen(false);
    setArn("");
    router.refresh();
  }

  async function handleReopen() {
    if (!filingRecord) {
      return;
    }
    setIsSubmitting(true);
    const result = await onReopen(filingRecord.id);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to reopen this period.");
      return;
    }
    toast.success("Period reopened.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-3">
        <Badge variant={isFiled ? "default" : "secondary"}>{isFiled ? "Filed" : "Open"}</Badge>
        {isFiled ? (
          <p className="text-sm text-muted-foreground">
            {filingRecord?.arn ? `ARN: ${filingRecord.arn} — ` : ""}
            filed {filingRecord?.filedAt ? new Date(filingRecord.filedAt).toLocaleDateString("en-IN") : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">This period has not been marked as filed yet.</p>
        )}
      </div>

      {canApprove ? (
        isFiled ? (
          <Button variant="outline" onClick={handleReopen} disabled={isSubmitting}>
            Reopen Period
          </Button>
        ) : (
          <Dialog open={isMarkDialogOpen} onOpenChange={setIsMarkDialogOpen}>
            <Button onClick={() => setIsMarkDialogOpen(true)}>Mark as Filed</Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark period as filed</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gstr1-arn">ARN (optional)</Label>
                <Input
                  id="gstr1-arn"
                  value={arn}
                  onChange={(event) => setArn(event.target.value)}
                  placeholder="Application Reference Number"
                  maxLength={50}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsMarkDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleMarkFiled} disabled={isSubmitting}>
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      ) : null}
    </div>
  );
}
