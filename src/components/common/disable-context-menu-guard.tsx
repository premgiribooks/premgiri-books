"use client";

import * as React from "react";

// Best-effort deterrent against casual "right-click -> Inspect" (per
// explicit user request — a POS-style billing screen shouldn't invite a
// cashier to poke around in DevTools). Two things, both admittedly
// bypassable by a determined user and neither presented as a security
// boundary:
//
// 1. The browser's own right-click context menu is suppressed everywhere.
//    Sidebar navigation items (sidebar-item.tsx) render their own custom
//    context menu instead, offering "Open in new tab" as a replacement for
//    the native menu's own equivalent item.
// 2. The most common DevTools-opening key combos (F12, Ctrl/Cmd+Shift+I/J/C,
//    Ctrl/Cmd+U) are intercepted. This cannot stop DevTools opened from the
//    browser's own menu/toolbar, nor a browser extension, nor Electron's own
//    accelerator table unless disabled there too — it only removes the
//    handful of keyboard shortcuts most people reach for first.
const BLOCKED_DEVTOOLS_KEYS = new Set(["i", "j", "c", "u"]);

function isDevToolsShortcut(event: KeyboardEvent): boolean {
  if (event.key === "F12") {
    return true;
  }
  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier) {
    return false;
  }
  const key = event.key.toLowerCase();
  if (key === "u") {
    // Ctrl/Cmd+U (View Source) needs no Shift.
    return true;
  }
  return event.shiftKey && BLOCKED_DEVTOOLS_KEYS.has(key);
}

/** Mounted once in the root layout so it applies to every route, including
 * the login page. */
export function DisableContextMenuGuard() {
  React.useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      event.preventDefault();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (isDevToolsShortcut(event)) {
        event.preventDefault();
      }
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
