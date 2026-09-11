import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PhysicalVerificationStatusBadge } from "@/modules/physical-verifications/components/physical-verification-status-badge";
import { formatPhysicalVerificationDate } from "@/modules/physical-verifications/utils/format-physical-verification-date";
import type { PhysicalVerificationListRow } from "@/types/physical-verification";

interface PhysicalVerificationTableProps {
  physicalVerifications: PhysicalVerificationListRow[];
}

export function PhysicalVerificationTable({ physicalVerifications }: PhysicalVerificationTableProps) {
  if (physicalVerifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No physical verifications found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Warehouse</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Lines</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {physicalVerifications.map((verification) => (
          <TableRow key={verification.id}>
            <TableCell>
              <Link href={`/inventory/verifications/${verification.id}`} className="font-medium text-foreground hover:underline">
                {verification.verificationNumber ?? "Draft"}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{verification.warehouseName}</TableCell>
            <TableCell className="font-financial">{formatPhysicalVerificationDate(verification.verificationDate)}</TableCell>
            <TableCell className="text-right font-financial">{verification.lineCount}</TableCell>
            <TableCell>
              <PhysicalVerificationStatusBadge status={verification.status} />
            </TableCell>
            <TableCell className="text-right">
              <Link href={`/inventory/verifications/${verification.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
