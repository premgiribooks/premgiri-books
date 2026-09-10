import * as React from "react";

type FormSectionColumns = 1 | 2 | 3 | 4;

interface FormSectionProps {
  title: string;
  description?: string;
  columns?: FormSectionColumns;
  children: React.ReactNode;
}

// Tailwind needs statically-analyzable class names, so column counts map to
// full class strings instead of being interpolated.
const GRID_COLUMN_CLASSES: Record<FormSectionColumns, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

// Shared multi-section form layout used by every form that groups fields
// under labeled sections (Company creation/edit, Company profile) — extracted
// from what were three near-identical local definitions. `columns` defaults
// to 2 (the original fixed layout); pass 1 for sections holding a single
// full-width child such as a line-item editor.
export function FormSection({ title, description, columns = 2, children }: FormSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className={`grid gap-4 ${GRID_COLUMN_CLASSES[columns]}`}>{children}</div>
    </div>
  );
}
