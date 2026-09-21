import { describe, expect, it } from "vitest";

import { comboFromKeyboardEvent, formatShortcutCombo } from "@/lib/shortcut-keys";

function keyEvent(overrides: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }>) {
  return { key: "a", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...overrides };
}

describe("comboFromKeyboardEvent", () => {
  it("returns undefined for a bare modifier key press", () => {
    expect(comboFromKeyboardEvent(keyEvent({ key: "Control" }))).toBeUndefined();
    expect(comboFromKeyboardEvent(keyEvent({ key: "Shift" }))).toBeUndefined();
    expect(comboFromKeyboardEvent(keyEvent({ key: "Alt" }))).toBeUndefined();
    expect(comboFromKeyboardEvent(keyEvent({ key: "Meta" }))).toBeUndefined();
  });

  it("builds a plain key combo with no modifiers", () => {
    expect(comboFromKeyboardEvent(keyEvent({ key: "k" }))).toBe("k");
  });

  it("collapses ctrlKey and metaKey into the same 'mod' token", () => {
    expect(comboFromKeyboardEvent(keyEvent({ key: "k", ctrlKey: true }))).toBe("mod+k");
    expect(comboFromKeyboardEvent(keyEvent({ key: "k", metaKey: true }))).toBe("mod+k");
  });

  it("orders modifiers mod, alt, shift regardless of press order", () => {
    expect(comboFromKeyboardEvent(keyEvent({ key: "s", shiftKey: true, altKey: true }))).toBe("alt+shift+s");
    expect(comboFromKeyboardEvent(keyEvent({ key: "s", ctrlKey: true, shiftKey: true, altKey: true }))).toBe(
      "mod+alt+shift+s"
    );
  });

  it("normalizes case and known key aliases", () => {
    expect(comboFromKeyboardEvent(keyEvent({ key: "K", ctrlKey: true }))).toBe("mod+k");
    expect(comboFromKeyboardEvent(keyEvent({ key: " " }))).toBe("space");
    expect(comboFromKeyboardEvent(keyEvent({ key: "Escape" }))).toBe("esc");
    expect(comboFromKeyboardEvent(keyEvent({ key: "ArrowUp" }))).toBe("up");
  });

  it("returns undefined instead of throwing for a synthetic event with no key (e.g. an autofill-triggered keydown)", () => {
    expect(comboFromKeyboardEvent(keyEvent({ key: undefined as unknown as string }))).toBeUndefined();
    expect(comboFromKeyboardEvent(keyEvent({ key: "" }))).toBeUndefined();
  });
});

describe("formatShortcutCombo", () => {
  it("renders modifier tokens and a single letter", () => {
    expect(formatShortcutCombo("mod+shift+s")).toBe("Ctrl+Shift+S");
    expect(formatShortcutCombo("alt+shift+i")).toBe("Alt+Shift+I");
  });

  it("renders named keys with their own display label", () => {
    expect(formatShortcutCombo("mod+enter")).toBe("Ctrl+Enter");
    expect(formatShortcutCombo("esc")).toBe("Esc");
  });
});
