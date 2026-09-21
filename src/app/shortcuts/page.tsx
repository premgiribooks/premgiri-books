import { AppShell } from "@/components/layout/app-shell";
import { PlatformShell } from "@/components/layout/platform-shell";
import { getCurrentUser } from "@/lib/current-user";
import { ShortcutsSettingsTable } from "@/modules/shortcuts/components/shortcuts-settings-table";

function ShortcutsContent() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Keyboard Shortcuts</h1>
        <p className="text-sm text-muted-foreground">
          Customize the keyboard shortcuts used throughout the app. Changes are saved to this
          browser only.
        </p>
      </div>
      <ShortcutsSettingsTable />
    </div>
  );
}

// Personal, browser-local preferences (localStorage, never company data) —
// reachable by both PLATFORM and COMPANY users, mirroring /profile's own
// dual-shell pattern (Permanent Architecture Principle 8) and needing no
// permission gate, exactly like /profile's own Account tab.
export default async function ShortcutsPage() {
  const currentUser = await getCurrentUser();

  if (currentUser.userType === "PLATFORM") {
    return (
      <PlatformShell>
        <ShortcutsContent />
      </PlatformShell>
    );
  }

  return (
    <AppShell>
      <ShortcutsContent />
    </AppShell>
  );
}
