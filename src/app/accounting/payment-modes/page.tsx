import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMorePaymentModesAction } from "@/modules/payment-modes/actions/payment-mode-actions";
import { paymentModeService } from "@/modules/payment-modes/services/payment-mode-service";
import { PaymentModeTable } from "@/modules/payment-modes/components/payment-mode-table";

export default async function PaymentModeListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [{ items: paymentModes, hasMore }, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    paymentModeService.listPaymentModesPage({}, { skip: 0, take: DEFAULT_PAGE_SIZE }),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "accounting", "create"),
    hasPermission(user, "accounting", "edit"),
    hasPermission(user, "accounting", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Payment Modes</h1>
            <p className="text-sm text-muted-foreground">
              Manage the Cash/Bank/UPI/Card/Cheque modes used by payment lines across the app.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/accounting/payment-modes/new">
                  <Plus size={18} />
                  New Payment Mode
                </Link>
              }
            />
          ) : null}
        </div>

        <PaymentModeTable
          paymentModes={paymentModes}
          initialHasMore={hasMore}
          loadMore={loadMorePaymentModesAction.bind(null, {})}
          canEdit={canEdit}
          canManage={canManage}
        />
      </div>
    </AppShell>
  );
}
