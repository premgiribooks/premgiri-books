import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText, FileSpreadsheet, FileText, ListChecks, ReceiptText, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const GST_MODULES = [
  {
    href: "/gst/registers",
    icon: BookOpenText,
    title: "GST Registers",
    description: "Transaction-level outward and inward supply registers for every posted GST document.",
    available: true,
  },
  {
    href: "/gst/gstr-1",
    icon: FileText,
    title: "GSTR-1",
    description: "Statutory outward-supply return, derived from the GST Registers.",
    available: true,
  },
  {
    href: "/gst/gstr-3b",
    icon: FileSpreadsheet,
    title: "GSTR-3B",
    description: "Summary liability and input tax credit return.",
    available: true,
  },
  {
    href: "/gst/hsn-summary",
    icon: ListChecks,
    title: "HSN Summary",
    description: "HSN-wise grouped outward turnover, the same data GSTR-1's Table 12 embeds.",
    available: true,
  },
  {
    href: "/gst/gstr-2",
    icon: ReceiptText,
    title: "GSTR-2",
    description: "Read-only inward-supply reporting view, in the original (suspended) GSTR-2 return's table shape.",
    available: true,
  },
  {
    href: "/gst/itc-register",
    icon: ShieldCheck,
    title: "ITC Register",
    description: "Rate-wise, party-wise, and HSN-wise breakdown of GSTR-3B's Table 4(A)(5) lump ITC figure.",
    available: true,
  },
] as const;

export default async function GstHubPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "gst", "view");
  if (!canView) {
    redirect("/");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">GST</h1>
          <p className="text-sm text-muted-foreground">Registers, statutory returns, and HSN-wise summaries.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GST_MODULES.map((module) =>
            module.available ? (
              <Link key={module.title} href={module.href}>
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
            ) : (
              <Card key={module.title} className="opacity-60">
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
                  <p className="mt-2 text-xs font-medium text-muted-foreground">Coming soon</p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </AppShell>
  );
}
