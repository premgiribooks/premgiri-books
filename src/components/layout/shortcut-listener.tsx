"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { comboFromKeyboardEvent } from "@/lib/shortcut-keys";
import { dispatchShortcut } from "@/lib/shortcut-events";
import { useResolvedShortcuts } from "@/hooks/use-shortcuts";
import { toggleCommandPalette } from "@/hooks/use-command-palette";

/**
 * The single global keydown listener for every registered shortcut
 * (src/config/shortcuts.ts) — mounted once in AppShell/PlatformShell so it
 * works from any page, mirroring CommandPalette's own former inline Ctrl+K
 * listener (now removed from there in favor of this one shared place, so
 * "Search" is rebindable exactly like every other shortcut).
 *
 * A "global" shortcut's action runs directly here. A "billing" shortcut
 * (Add Line, Focus Item Search, Jump to Payment, Save/Post) has no fixed
 * action — it's only meaningful while a specific form is mounted — so this
 * only dispatches the underlying window CustomEvent (shortcut-events.ts);
 * the Sales/Purchase Invoice components subscribe to it themselves and it's
 * a harmless no-op everywhere else.
 *
 * Never fires for a combo typed into a text field with no modifier (every
 * registered default combo carries at least one of mod/alt — see
 * shortcuts.ts's own note), so this never steals a plain keystroke out of an
 * <input>/<textarea>.
 */
export function ShortcutListener() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const resolved = useResolvedShortcuts();

  const resolvedRef = React.useRef(resolved);
  const themeRef = React.useRef(resolvedTheme);
  React.useEffect(() => {
    resolvedRef.current = resolved;
    themeRef.current = resolvedTheme;
  }, [resolved, resolvedTheme]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const combo = comboFromKeyboardEvent(event);
      if (!combo) {
        return;
      }

      let matchedId: string | undefined;
      for (const [id, boundCombo] of resolvedRef.current) {
        if (boundCombo === combo) {
          matchedId = id;
          break;
        }
      }
      if (!matchedId) {
        return;
      }

      switch (matchedId) {
        case "search":
          event.preventDefault();
          toggleCommandPalette();
          return;
        case "new-sales-invoice":
          event.preventDefault();
          router.push("/sales/invoices/new");
          return;
        case "new-purchase-invoice":
          event.preventDefault();
          router.push("/purchase/invoices/new");
          return;
        case "dashboard":
          event.preventDefault();
          router.push("/");
          return;
        case "toggle-theme":
          event.preventDefault();
          setTheme(themeRef.current === "dark" ? "light" : "dark");
          return;
        case "show-shortcuts":
          event.preventDefault();
          router.push("/shortcuts");
          return;
        default:
          // Every other id is a "billing" shortcut — see the file comment.
          event.preventDefault();
          dispatchShortcut(matchedId);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, setTheme]);

  return null;
}
