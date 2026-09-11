"use client";

import type { Control } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
// Cross-module reuse of the Product form's generic picker — already
// precedented by customer-credit-section.tsx importing it from `products`
// despite living there (30-pricing-engine.md). Used here for both the
// Branch and the optional login-link pickers instead of two near-identical
// bespoke Select wrappers.
import { ProductOptionSelector } from "@/modules/products/components/product-option-selector";
import type { CreateEmployeeInput } from "@/modules/employees/validation/employee-schema";
import type { EmployeeBranchOption, EmployeeUserOption } from "@/types/employee";

interface EmployeeBranchLoginSectionProps {
  control: Control<CreateEmployeeInput>;
  branchOptions: EmployeeBranchOption[];
  userOptions: EmployeeUserOption[];
}

/** Branch & Login Link: both optional references — the employee's branch
 * assignment and an optional link to an existing User login
 * (61-employee-master.md's User ↔ Employee section). This screen never
 * creates a new User — linking is a simple optional-field edit here;
 * provisioning a brand-new login stays User Management's own Create User
 * screen, unmodified. */
export function EmployeeBranchLoginSection({
  control,
  branchOptions,
  userOptions,
}: EmployeeBranchLoginSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Branch &amp; Login Link</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="branchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Branch</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={branchOptions.map((branch) => ({
                    id: branch.id,
                    label: branch.branchName,
                    isActive: branch.isActive,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="No branch"
                  emptyLabel="No branches"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Optional. Ties the employee to a branch for future branch-wise reporting.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Linked Login</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={userOptions.map((user) => ({
                    id: user.id,
                    label: `${user.fullName} (${user.username})`,
                    isActive: user.isActive,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="No login"
                  emptyLabel="No available users"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Optional. Links this employee to an existing user login — most employees have
                none. Create a new login from User Management first if one doesn&apos;t exist yet.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
