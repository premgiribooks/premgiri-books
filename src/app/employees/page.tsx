import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

// The operational Employee-module hub (62-attendance.md's UI section) —
// distinct from Employee Master, which stays under /masters/employees. Only
// an Attendance card exists for now; a Payroll card is added once
// 63-payroll.md is implemented, mirroring how Purchase Return's own hub grew
// one card at a time.
const EMPLOYEE_MODULES = [
  {
    href: "/employees/attendance",
    icon: CalendarCheck,
    title: "Attendance",
    description: "Mark daily attendance and review each employee's attendance history.",
  },
] as const;

export default async function EmployeesHubPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "employees", "view");
  if (!canView) {
    redirect("/");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Day-to-day operational screens for the company&apos;s staff.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EMPLOYEE_MODULES.map((module) => (
            <Link key={module.href} href={module.href}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      <module.icon size={20} />
                    </div>
                    <CardTitle>{module.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{module.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
