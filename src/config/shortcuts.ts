export type ShortcutCategory = "global" | "billing";

export interface ShortcutDefinition {
  id: string;
  label: string;
  description: string;
  category: ShortcutCategory;
  /** Normalized combo string (see shortcut-keys.ts) — the factory default,
   * restored by "Reset to default" on the customization page. */
  defaultKeys: string;
}

/**
 * The gear-icon dropdown (top-navbar.tsx) and the `/shortcuts` customization
 * page both render from this one list — adding a shortcut anywhere in the
 * app means adding one entry here, never a second hardcoded list.
 *
 * "global" shortcuts fire from anywhere in the app (ShortcutListener,
 * mounted once in AppShell/PlatformShell, runs their action directly).
 * "billing" shortcuts only do something while a Sales/Purchase Invoice
 * form is actually mounted and listening for them — ShortcutListener still
 * dispatches the underlying window CustomEvent from anywhere (see
 * shortcut-events.ts), it's just a no-op with nothing listening.
 *
 * Every default combo here deliberately avoids the well-known browser/OS
 * reservations (Ctrl+T/N/W, Ctrl+Shift+N/P/I/J/C, Ctrl+D/F/H/L/U, F12, ...)
 * so `preventDefault()` in ShortcutListener actually has something to
 * prevent — a page's `keydown` handler never even sees a truly
 * browser-reserved combo. Users can still rebind anything that happens to
 * collide with their own browser/OS/extension setup from the customization
 * page.
 */
export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    id: "search",
    label: "Search / Quick Navigation",
    description: "Open the global search and quick-navigation palette.",
    category: "global",
    defaultKeys: "mod+k",
  },
  {
    id: "new-sales-invoice",
    label: "New Sales Invoice",
    description: "Jump straight to creating a new Sales Invoice.",
    category: "global",
    defaultKeys: "alt+shift+s",
  },
  {
    id: "new-purchase-invoice",
    label: "New Purchase Invoice",
    description: "Jump straight to creating a new Purchase Invoice.",
    category: "global",
    defaultKeys: "alt+shift+p",
  },
  {
    id: "dashboard",
    label: "Go to Dashboard",
    description: "Return to the dashboard.",
    category: "global",
    defaultKeys: "alt+shift+h",
  },
  {
    id: "toggle-theme",
    label: "Toggle Theme",
    description: "Switch between light and dark theme.",
    category: "global",
    defaultKeys: "alt+shift+l",
  },
  {
    id: "show-shortcuts",
    label: "Show Keyboard Shortcuts",
    description: "Open this shortcuts reference.",
    category: "global",
    defaultKeys: "alt+shift+k",
  },
  {
    id: "save",
    label: "Save / Post",
    description: "Save or post the Sales/Purchase Invoice currently being edited.",
    category: "billing",
    defaultKeys: "mod+s",
  },
  {
    id: "add-line",
    label: "Add Line",
    description: "Add a new item line to the invoice being edited.",
    category: "billing",
    defaultKeys: "mod+enter",
  },
  {
    id: "focus-item-search",
    label: "Focus Item Search",
    description: "Jump to the item/product search box on the invoice being edited.",
    category: "billing",
    defaultKeys: "alt+shift+i",
  },
  {
    id: "focus-payment",
    label: "Jump to Payment",
    description: "Scroll to and focus the payment section of the invoice being edited.",
    category: "billing",
    defaultKeys: "alt+shift+m",
  },
] as const;

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  global: "Global",
  billing: "Sales / Purchase Invoice",
};
