import * as React from "react";

/**
 * The wiring between ShortcutListener (mounted once, always listening) and
 * whichever "billing" screen happens to be mounted right now (Sales/
 * Purchase Invoice forms) — a plain `window` CustomEvent per shortcut id.
 * Deliberately not React Context: ShortcutListener lives above AppShell,
 * which fully remounts on every navigation (see use-page-tabs.tsx's own
 * note on why this codebase already reaches for module-level/DOM-level
 * mechanisms instead of Context for exactly this "survive a shell remount"
 * problem), and a plain window event needs no provider at all — a listening
 * component simply isn't mounted (and the dispatch is a harmless no-op) on
 * every other screen.
 */
function eventName(shortcutId: string): string {
  return `premgiri:shortcut:${shortcutId}`;
}

export function dispatchShortcut(shortcutId: string): void {
  window.dispatchEvent(new CustomEvent(eventName(shortcutId)));
}

/** Subscribes `handler` to a "billing" shortcut for as long as the calling
 * component is mounted — e.g. the Sales Invoice line editor listening for
 * "add-line" only while that form is on screen. */
export function useShortcutEffect(shortcutId: string, handler: () => void): void {
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  React.useEffect(() => {
    function listener() {
      handlerRef.current();
    }
    window.addEventListener(eventName(shortcutId), listener);
    return () => window.removeEventListener(eventName(shortcutId), listener);
  }, [shortcutId]);
}
