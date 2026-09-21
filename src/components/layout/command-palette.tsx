"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { flattenNavItems, NAVIGATION, type NavLeaf } from "@/config/navigation";
import { filterNavigation } from "@/lib/navigation-filter";
import { useNavPermissions } from "@/components/providers/nav-permissions-provider";
import { useFavorites } from "@/hooks/use-favorites";
import { recordRecentPage, useRecentPages } from "@/hooks/use-recent-pages";
import { setCommandPaletteOpen, useCommandPaletteOpen } from "@/hooks/use-command-palette";
import type { GlobalSearchGroup, GlobalSearchGroupKey } from "@/types/global-search";

const EMPTY_DATA_RESULTS: GlobalSearchGroup[] = [];
const MIN_DATA_QUERY_LENGTH = 2;
// A full second, not a hair-trigger 200-300ms — see the debounce effect's
// own comment below for why this fan-out specifically needs to wait for a
// real pause in typing.
const SEARCH_DEBOUNCE_MS = 1000;
const SECTION_ORDER = ["Favorites", "Recent", "Pages", "Products", "Customers", "Suppliers", "Ledgers"] as const;

// Each in-scope master's own existing filtered list screen, deep-linked from
// this group's "See all N results" row with the query pre-filled into its
// own URL-state `search` param (75-global-search.md's UI section) — never a
// new query-string contract.
const GROUP_LIST_PATH: Record<GlobalSearchGroupKey, string> = {
  products: "/masters/products",
  customers: "/masters/customers",
  suppliers: "/masters/suppliers",
  ledgers: "/accounting/ledgers",
};

const GROUP_SECTION: Record<GlobalSearchGroupKey, (typeof SECTION_ORDER)[number]> = {
  products: "Products",
  customers: "Customers",
  suppliers: "Suppliers",
  ledgers: "Ledgers",
};

interface PaletteRow {
  key: string;
  label: string;
  sublabel?: string;
  href: string;
  icon?: LucideIcon;
  section: (typeof SECTION_ORDER)[number];
}

/** Global Ctrl/Cmd+K quick navigation. Mounted once in AppShell so it works
 * from any authenticated page. "PAGES" results come from the same
 * permission-filtered nav tree the Sidebar uses (navigation-filter.ts);
 * "DATA" results (Products/Customers/Suppliers/Ledgers) come from
 * /api/search (75-global-search.md), which reuses each module's own service
 * and is already gated per group by masters:view/accounting:view. */
export function CommandPalette() {
  const open = useCommandPaletteOpen();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [dataResults, setDataResults] = React.useState<GlobalSearchGroup[]>(EMPTY_DATA_RESULTS);
  const router = useRouter();
  const permissions = useNavPermissions();
  const favorites = useFavorites();
  const recent = useRecentPages();

  // Permission-filtered, not the raw ALL_NAV_LEAVES — a stale favorite/
  // recent the user no longer has access to silently drops out instead of
  // resolving to a shortcut that would just redirect them away.
  // flattenNavItems also pulls in third-level leaves (e.g. a Reports
  // sub-hub's own report types), not just its direct children.
  const visibleLeaves = React.useMemo(
    () => flattenNavItems(filterNavigation(NAVIGATION, permissions)),
    [permissions]
  );
  const leafByHref = React.useMemo(() => new Map(visibleLeaves.map((item) => [item.href, item])), [visibleLeaves]);

  // The Ctrl/Cmd+K keydown listener used to live here — moved to
  // ShortcutListener (src/components/layout/shortcut-listener.tsx), which
  // resolves it against the "search" entry in src/config/shortcuts.ts
  // instead of a hardcoded combo, so it's rebindable from the `/shortcuts`
  // customization page like every other shortcut.

  // Reset transient state when the palette opens — adjusted during render
  // (React's "adjusting state when a prop changes" pattern) rather than in
  // an effect, so it doesn't trigger an extra commit-then-effect cascade.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setDataResults(EMPTY_DATA_RESULTS);
    }
  }

  const trimmedQuery = query.trim();

  // Debounced DATA-tier fetch — a real effect (subscribes to an external
  // system via /api/search); the too-short-query/closed case is handled by
  // `effectiveDataResults` below instead of synchronously clearing state
  // here. A full second, not a hair-trigger 200-300ms: this call fans out to
  // four services, so it must wait for the user to actually pause typing
  // rather than firing (and hitting the DB) on every keystroke. Uses a real
  // `fetch()` against a Route Handler rather than a Server Action — this
  // Next.js version's own docs warn Server Actions "are queued... using them
  // for data fetching introduces sequential execution," which is exactly
  // wrong for search-as-you-type (see route.ts's own comment for the full
  // story) — and an AbortController cancels a still-in-flight request the
  // moment a newer keystroke supersedes it, instead of leaving it to
  // complete and land out of order.
  React.useEffect(() => {
    if (!open || trimmedQuery.length < MIN_DATA_QUERY_LENGTH) {
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal })
        .then((response) => response.json() as Promise<{ success: boolean; data?: GlobalSearchGroup[] }>)
        .then((result) => {
          if (result.success && result.data) {
            setDataResults(result.data);
          }
        })
        .catch(() => {
          // Aborted (a newer keystroke superseded this request) or a
          // transient network failure — either way, leave the last-known
          // results in place rather than surfacing an error for what's just
          // a best-effort, debounced background fetch.
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [trimmedQuery, open]);

  const effectiveDataResults = trimmedQuery.length >= MIN_DATA_QUERY_LENGTH ? dataResults : EMPTY_DATA_RESULTS;
  const hasAnyDataPermission = permissions.masters || permissions.accounting;

  const rows: PaletteRow[] = React.useMemo(() => {
    if (!trimmedQuery) {
      const favoriteRows = favorites
        .map((href) => leafByHref.get(href))
        .filter((item): item is NavLeaf => Boolean(item))
        .map((item) => ({ key: `favorite-${item.href}`, label: item.label, href: item.href, icon: item.icon, section: "Favorites" as const }));

      const recentRows = recent
        .map((href) => leafByHref.get(href))
        .filter((item): item is NavLeaf => Boolean(item))
        .map((item) => ({ key: `recent-${item.href}`, label: item.label, href: item.href, icon: item.icon, section: "Recent" as const }));

      return [...favoriteRows, ...recentRows];
    }

    const lowerQuery = trimmedQuery.toLowerCase();
    const pageRows = visibleLeaves
      .filter((item) => item.label.toLowerCase().includes(lowerQuery))
      .map((item) => ({ key: `page-${item.href}`, label: item.label, href: item.href, icon: item.icon, section: "Pages" as const }));

    const dataRows: PaletteRow[] = effectiveDataResults.flatMap((group) => {
      const section = GROUP_SECTION[group.groupKey];
      const itemRows = group.items.map((item) => ({
        key: `${group.groupKey}-${item.id}`,
        label: item.title,
        sublabel: item.subtitle,
        href: item.href,
        section,
      }));

      // "See all N results in {group}" — only when the group is non-empty
      // and capped (75-global-search.md's UI section); deep-links to that
      // master's own existing list screen with the query pre-filled.
      if (group.totalMatches > group.items.length) {
        itemRows.push({
          key: `${group.groupKey}-see-all`,
          label: `See all ${group.totalMatches} results in ${group.groupLabel}`,
          sublabel: undefined,
          href: `${GROUP_LIST_PATH[group.groupKey]}?search=${encodeURIComponent(trimmedQuery)}`,
          section,
        });
      }

      return itemRows;
    });

    return [...pageRows, ...dataRows];
  }, [trimmedQuery, favorites, recent, leafByHref, visibleLeaves, effectiveDataResults]);

  // Keep the highlighted row in range as the result set changes — same
  // render-time adjustment pattern used above for the open-reset.
  const [prevRowsLength, setPrevRowsLength] = React.useState(rows.length);
  if (rows.length !== prevRowsLength) {
    setPrevRowsLength(rows.length);
    setSelectedIndex(0);
  }

  const navigateTo = React.useCallback(
    (href: string) => {
      // Only record hrefs that resolve to a real nav leaf — a DATA-tier row
      // (Products/Customers/Suppliers) carries an entity-specific href that
      // would never surface in "Recent" anyway (leafByHref.get() only ever
      // matches NAVIGATION-tree hrefs), so recording it would just leave an
      // inert entity id sitting in localStorage for no benefit.
      if (leafByHref.has(href)) {
        recordRecentPage(href);
      }
      setCommandPaletteOpen(false);
      router.push(href);
    },
    [router, leafByHref]
  );

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[selectedIndex];
      if (row) {
        navigateTo(row.href);
      }
    }
  }

  const sections = SECTION_ORDER.map((name) => ({ name, rows: rows.filter((row) => row.section === name) })).filter(
    (section) => section.rows.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={setCommandPaletteOpen}>
      <DialogContent showCloseButton={false} className="top-[15%] max-w-lg translate-y-0 gap-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Quick navigation</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, products, customers, suppliers, and ledgers
        </DialogDescription>

        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages, products, customers, suppliers, ledgers..."
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {!trimmedQuery
                ? "Start typing to search pages, products, customers, suppliers, or ledgers."
                : hasAnyDataPermission
                  ? "No matches found."
                  : "No matching pages found. You don't have access to search products, customers, suppliers, or ledgers yet."}
            </p>
          )}

          {sections.map((section) => (
            <div key={section.name} className="mb-1 last:mb-0">
              <div className="px-2.5 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {section.name}
              </div>
              {section.rows.map((row) => {
                const globalIndex = rows.indexOf(row);
                const Icon = row.icon;
                return (
                  <button
                    key={row.key}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
                      globalIndex === selectedIndex ? "bg-primary-dim text-primary" : "text-foreground hover:bg-muted"
                    )}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    onClick={() => navigateTo(row.href)}
                  >
                    {Icon ? <Icon size={16} className="shrink-0 text-muted-foreground" /> : <span className="size-4 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    {row.sublabel && <span className="shrink-0 text-xs text-muted-foreground">{row.sublabel}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
