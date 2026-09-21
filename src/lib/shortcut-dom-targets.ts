/**
 * Shared `data-*` markers a "billing" shortcut's DOM-query handler looks
 * for, so the marker and the query stay in exactly one place each rather
 * than a magic string duplicated between Sales Invoice's and Purchase
 * Invoice's own line/payment editors.
 */

/** Wraps the Product cell's `ProductOptionSelector` in a line row
 * (sales-invoice-line-row.tsx / purchase-invoice-line-row.tsx) — the
 * "focus-item-search" shortcut focuses the LAST matching row's own
 * `[data-slot="combobox-input"]` inside this wrapper. */
export const ITEM_SEARCH_SHORTCUT_ATTRIBUTE = "data-shortcut-item-search";

/** Wraps the Ledger cell's `ProductOptionSelector` in a payment-lines row
 * (sales-invoice-payment-editor.tsx / purchase-invoice-payment-editor.tsx)
 * — the "focus-payment" shortcut scrolls to and focuses the FIRST matching
 * row's own `[data-slot="combobox-input"]` inside this wrapper. */
export const PAYMENT_LEDGER_SHORTCUT_ATTRIBUTE = "data-shortcut-payment-ledger";

const COMBOBOX_INPUT_SELECTOR = '[data-slot="combobox-input"]';

/** Focuses the last element matching `markerAttribute` inside `container` —
 * "last" so adding a new blank line and immediately jumping into its own
 * item search box (the newest row) works, not the first/oldest row. */
export function focusLastMarkedComboboxInput(container: HTMLElement, markerAttribute: string): void {
  const markers = container.querySelectorAll<HTMLElement>(`[${markerAttribute}]`);
  const last = markers[markers.length - 1];
  const input = last?.querySelector<HTMLInputElement>(COMBOBOX_INPUT_SELECTOR);
  input?.focus();
}

/** Scrolls to and focuses the first element matching `markerAttribute`
 * inside `container`. */
export function focusFirstMarkedComboboxInput(container: HTMLElement, markerAttribute: string): void {
  const first = container.querySelector<HTMLElement>(`[${markerAttribute}]`);
  const input = first?.querySelector<HTMLInputElement>(COMBOBOX_INPUT_SELECTOR);
  if (input) {
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus();
  }
}
