"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { payrollRunService } from "@/modules/payroll/services/payroll-run-service";
import type { CreatePayrollRunInput, PayrollRunListFiltersInput } from "@/modules/payroll/validation/payroll-run-schema";
import type { ActionResult } from "@/types/api";
import type { PayrollRunDetail, PayrollRunListRow, PayrollRunPreview } from "@/types/payroll-run";

const LIST_PATH = "/employees/payroll";

function detailPath(id: string): string {
  return `${LIST_PATH}/${id}`;
}

/** Infinite-scroll "load more" for the Payroll Runs list — a pure read, so
 * no paths are revalidated. */
export async function loadMorePayrollRunsAction(
  filters: PayrollRunListFiltersInput,
  skip: number,
  take: number
): Promise<ActionResult<Page<PayrollRunListRow>>> {
  return runAction(() => payrollRunService.listPayrollRunsPage(filters, { skip, take }), []);
}

// Read-only — no revalidation. The Create Payroll Run screen's live preview.
export async function previewPayrollRunAction(input: CreatePayrollRunInput): Promise<ActionResult<PayrollRunPreview>> {
  return runAction(() => payrollRunService.previewPayrollRun(input), []);
}

export async function createPayrollRunDraftAction(input: CreatePayrollRunInput): Promise<ActionResult<PayrollRunDetail>> {
  return runAction(() => payrollRunService.createDraft(input), [LIST_PATH]);
}

export async function refreshPayrollRunDraftAction(id: string): Promise<ActionResult<PayrollRunDetail>> {
  return runAction(() => payrollRunService.refreshDraft(id), [LIST_PATH, detailPath(id)]);
}

export async function postPayrollRunAction(id: string): Promise<ActionResult<PayrollRunDetail>> {
  return runAction(() => payrollRunService.postPayrollRun(id), [LIST_PATH, detailPath(id)]);
}

export async function cancelPayrollRunAction(id: string): Promise<ActionResult<PayrollRunDetail>> {
  return runAction(() => payrollRunService.cancelPayrollRun(id), [LIST_PATH, detailPath(id)]);
}
