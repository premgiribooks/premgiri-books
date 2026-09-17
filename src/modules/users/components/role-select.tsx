"use client";

import type { Role } from "@prisma/client";

import { SearchableSelect } from "@/components/common/searchable-select";

interface RoleSelectProps {
  roles: Role[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function RoleSelect({
  roles,
  value,
  onChange,
  disabled,
  ...triggerProps
}: RoleSelectProps) {
  return (
    <SearchableSelect
      options={roles}
      value={value === "" ? undefined : value}
      onChange={(next) => onChange(next ?? "")}
      getOptionId={(role) => role.id}
      getOptionLabel={(role) => role.name}
      allowNone={false}
      placeholder="Select a role"
      disabled={disabled}
      {...triggerProps}
    />
  );
}
