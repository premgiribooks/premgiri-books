interface DashboardEmptyStateProps {
  message: string;
}

/** Shared per-section empty/unavailable renderer — a widget's own message is
 * always module-specific (85-dashboard.md's "no misleading zeroes" rule), so
 * this never hardcodes generic copy of its own. `no-permission` widgets are
 * never rendered at all (omitted entirely), so this component only ever
 * receives `empty`/`unavailable` states. */
export function DashboardEmptyState({ message }: DashboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
