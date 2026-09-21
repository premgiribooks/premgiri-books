import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PhysicalVerificationStatusActions } from "@/modules/physical-verifications/components/physical-verification-status-actions";
import { PhysicalVerificationStatusBadge } from "@/modules/physical-verifications/components/physical-verification-status-badge";
import { formatPhysicalVerificationDate } from "@/modules/physical-verifications/utils/format-physical-verification-date";
import { physicalVerificationService } from "@/modules/physical-verifications/services/physical-verification-service";

interface PhysicalVerificationDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatQuantity(value: number, decimalPlaces: number): string {
  return value.toFixed(decimalPlaces);
}

export default async function PhysicalVerificationDetailPage({ params }: PhysicalVerificationDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "inventory", "view");
  if (!canView) {
    redirect("/");
  }

  const physicalVerification = await physicalVerificationService.getPhysicalVerification(id);
  if (!physicalVerification) {
    notFound();
  }

  const [isAdmin, canEdit, canApprove] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "inventory", "edit"),
    hasPermission(user, "inventory", "approve"),
  ]);

  const isEditable = physicalVerification.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">
                {physicalVerification.verificationNumber ?? "Draft Physical Verification"}
              </h1>
              <PhysicalVerificationStatusBadge status={physicalVerification.status} />
            </div>
            <p className="text-sm text-muted-foreground">{formatPhysicalVerificationDate(physicalVerification.verificationDate)}</p>
          </div>

          <div className="flex items-center gap-2">
            {isEditable && canEdit ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/inventory/verifications/${physicalVerification.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <PhysicalVerificationStatusActions
              physicalVerification={physicalVerification}
              canComplete={canApprove}
              canCancel={canApprove}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Warehouse</p>
            <p className="text-sm text-foreground">{physicalVerification.warehouseName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Narration</p>
            <p className="text-sm text-foreground">{physicalVerification.narration ?? "—"}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">System Qty</TableHead>
                <TableHead className="text-right">Counted Qty</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {physicalVerification.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.productName}
                    {item.productCode ? ` (${item.productCode})` : ""}
                  </TableCell>
                  <TableCell className="text-right font-financial">
                    {formatQuantity(item.systemQuantity, item.unitDecimalPlaces)} {item.unitSymbol}
                  </TableCell>
                  <TableCell className="text-right font-financial">
                    {formatQuantity(item.countedQuantity, item.unitDecimalPlaces)} {item.unitSymbol}
                  </TableCell>
                  <TableCell className="text-right font-financial">
                    {formatQuantity(item.varianceQuantity, item.unitDecimalPlaces)} {item.unitSymbol}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
