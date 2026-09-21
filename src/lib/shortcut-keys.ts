/**
 * Pure, framework-free key-combo normalization shared by ShortcutListener
 * (matching a live keydown against a configured combo) and the `/shortcuts`
 * customization page (recording a new combo and displaying it). Kept
 * dependency-free so it's unit-testable per this project's own convention
 * (vitest.config.ts — node environment, no DOM).
 *
 * A combo is stored/compared as a canonical string: modifiers first, always
 * in the order "mod" (Ctrl on Windows/Linux, Cmd on Mac), "alt", "shift",
 * joined with "+", followed by the plain key. "mod" intentionally collapses
 * ctrlKey/metaKey into one concept — this app has no shortcut that needs
 * them to mean different things, and it lets one stored combo work
 * correctly on both platforms.
 */

const MODIFIER_KEYS = new Set(["control", "meta", "alt", "shift"]);

const KEY_ALIASES: Record<string, string> = {
  " ": "space",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  escape: "esc",
};

function normalizeKeyToken(key: string): string {
  const lower = key.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

/** Builds the canonical combo string for a live `keydown` event — `undefined`
 * while only modifier keys are held (nothing to compare yet), and also for a
 * synthetic event with no `key` at all (e.g. some browsers'
 * autofill-triggered keydown events on a form field). */
export function comboFromKeyboardEvent(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | undefined {
  if (!event.key) {
    return undefined;
  }

  const key = normalizeKeyToken(event.key);
  if (MODIFIER_KEYS.has(key)) {
    return undefined;
  }

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push("mod");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  if (event.shiftKey) {
    parts.push("shift");
  }
  parts.push(key);
  return parts.join("+");
}

const DISPLAY_LABELS: Record<string, string> = {
  mod: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  space: "Space",
  esc: "Esc",
  enter: "Enter",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

/** Renders a stored combo string for display — e.g. "mod+shift+s" ->
 * "Ctrl+Shift+S". A single printable-character key is upper-cased; a named
 * key (space, enter, arrows, ...) uses its own display label. */
export function formatShortcutCombo(combo: string): string {
  return combo
    .split("+")
    .map((token) => DISPLAY_LABELS[token] ?? (token.length === 1 ? token.toUpperCase() : token))
    .join("+");
}
