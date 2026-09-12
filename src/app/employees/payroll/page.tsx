import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PayrollRunFilterBar } from "@/modules/payroll/components/payroll-run-filter-bar";
import { PayrollRunTable } from "@/modules/payroll/components/payroll-run-table";
import { payrollRunService } from "@/modules/payroll/services/payroll-run-service";
import { PAYROLL_RUN_STATUS_VALUES } from "@/modules/payroll/validation/payroll-run-schema";
import type { PayrollRunListFiltersInput } from "@/modules/payroll/validation/payroll-run-schema";
import type { PayrollRunStatus } from "@/types/payroll-run";

interface PayrollRunListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): PayrollRunListFiltersInput {
  const filters: PayrollRunListFiltersInput = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status && (PAYROLL_RUN_STATUS_VALUES as readonly string[]).includes(status)) {
    filters.status = status as PayrollRunStatus;
  }

  return filters;
}

export default async function PayrollRunListPage({ searchParams }: PayrollRunListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "employees", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [payrollRuns, isAdmin, canCreate] = await Promise.all([
    payrollRunService.listPayrollRuns(filters),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "employees", "create"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Payroll</h1>
            <p className="text-sm text-muted-foreground">
              Aggregate attendance into each active employee&apos;s net salary and post one balanced voucher per run.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/employees/payroll/new">
                  <Plus size={18} />
                  New Payroll Run
                </Link>
              }
            />
          ) : null}
        </div>

        <PayrollRunFilterBar />

        <PayrollRunTable payrollRuns={payrollRuns} />
      </div>
    </AppShell>
  );
}
