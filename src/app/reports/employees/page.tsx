import Link from "next/link";
import { redirect } from "next/navigation";
import { BookUser, CalendarCheck, ClipboardList, Wallet } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const EMPLOYEE_REPORT_VIEWS = [
  {
    href: "/reports/employees/attendance-summary",
    icon: CalendarCheck,
    title: "Attendance Summary",
    description: "Per-employee present/half-day/absent/on-leave counts for a chosen period.",
  },
  {
    href: "/reports/employees/payroll-register",
    icon: ClipboardList,
    title: "Payroll Register",
    description: "Every payroll run's number, period, total net salary, and status.",
  },
  {
    href: "/reports/employees/salary-register",
    icon: Wallet,
    title: "Salary Register",
    description: "One employee's posted salary history across payroll runs.",
  },
  {
    href: "/reports/employees/directory",
    icon: BookUser,
    title: "Directory",
    description: "Every employee's code, designation, department, branch, and status.",
  },
] as const;

export default async function EmployeeReportsHubPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employee Reports</h1>
          <p className="text-sm text-muted-foreground">
            Read-only presentation over Employee Master, Attendance, and Payroll.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EMPLOYEE_REPORT_VIEWS.map((view) => (
            <Link key={view.href} href={view.href}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      <view.icon size={20} />
                    </div>
                    <CardTitle>{view.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{view.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
