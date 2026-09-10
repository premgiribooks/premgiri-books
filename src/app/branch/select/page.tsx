import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCurrentCompany } from "@/lib/current-company";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { branchService } from "@/modules/branch/services/branch-service";
import { BranchSelector } from "@/modules/branch/components/branch-selector";

export default async function BranchSelectPage() {
  const company = await getCurrentCompany();
  if (!company) {
    redirect("/company/select");
  }

  const [branches, isAdmin] = await Promise.all([
    branchService.listSelectableBranches(),
    isCurrentUserCompanyAdmin(),
  ]);

  // Unlike Company/Financial Year Selection, a company with zero branches is
  // a valid, fully-supported state (12-branch-management.md) — this page
  // must never redirect back to "/", or a 0-branch company could loop.
  if (branches.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">No branches yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This company has no active branches — you can continue without selecting one.
        </p>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href="/">Continue</Link>} />
          {isAdmin ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/branch/new">Create Branch</Link>}
            />
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-background p-6 py-16">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">Select a Branch</h1>
        <p className="text-sm text-muted-foreground">Choose the branch you want to work in.</p>
      </div>
      <div className="w-full max-w-4xl">
        <BranchSelector branches={branches} />
      </div>
    </main>
  );
}
