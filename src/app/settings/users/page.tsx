import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { loadMoreUsersAction } from "@/modules/users/actions/user-actions";
import { userService } from "@/modules/users/services/user-service";
import { UserSearchForm } from "@/modules/users/components/user-search-form";
import { UserTable } from "@/modules/users/components/user-table";

interface UserListPageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function UserListPage({ searchParams }: UserListPageProps) {
  const isAdmin = await isCurrentUserCompanyAdmin();
  if (!isAdmin) {
    redirect("/");
  }

  const params = await searchParams;
  const search = params.search ?? "";
  const filters = { search: search || undefined };

  const currentUser = await getCurrentUser();
  const { items: users, hasMore } = await userService.listUsersPage(filters, {
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">
              Manage the user accounts for your company.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href="/settings/users/new">
                <Plus size={18} />
                New User
              </Link>
            }
          />
        </div>

        <UserSearchForm initialSearch={search} />

        <UserTable
          key={JSON.stringify(filters)}
          users={users}
          currentUserId={currentUser.id}
          initialHasMore={hasMore}
          loadMore={loadMoreUsersAction.bind(null, filters)}
        />
      </div>
    </AppShell>
  );
}
