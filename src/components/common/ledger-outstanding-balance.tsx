"use client";

import * as React from "react";

import type { LedgerBalanceResult } from "@/engines/voucher/types";
import type { ActionResult } from "@/types/api";

type BalanceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; closingBalance: number }
  | { status: "error" };

interface LedgerOutstandingBalanceProps {
  /** The ledger to show the current balance for; `undefined`/empty renders nothing. */
  ledgerId: string | undefined;
  /** Pass the imported Server Action directly (a stable module-level
   * reference) — never an inline arrow function, or this re-fetches on
   * every render. */
  fetchBalance: (ledgerId: string) => Promise<ActionResult<LedgerBalanceResult>>;
  label?: string;
}

/**
 * Inline "outstanding balance" hint shown next to a ledger/Customer/Supplier
 * picker once a selection is made — the display-only convenience this
 * session's user request asked for on Payment Voucher, Receipt Voucher,
 * Sales Invoice, and Purchase Invoice. Sign convention mirrors every report
 * in this codebase (trial-balance-group-tree.tsx, customer/supplier
 * statement tables): `closingBalance >= 0` is a Debit balance, `< 0` is
 * Credit, always rendered as an absolute value with a "Dr"/"Cr" suffix.
 * Silently renders nothing on error — this is a convenience readout, never
 * a blocking part of the form.
 */
export function LedgerOutstandingBalance({ ledgerId, fetchBalance, label = "Outstanding" }: LedgerOutstandingBalanceProps) {
  const [state, setState] = React.useState<BalanceState>({ status: "idle" });

  React.useEffect(() => {
    // No ledger selected — nothing to fetch. Handled by the `!ledgerId`
    // render-time check below rather than a synchronous setState here
    // (this is derived state, not a subscription to an external system).
    if (!ledgerId) {
      return;
    }

    let cancelled = false;

    // Deferred via setTimeout (batch-selector.tsx's identical convention) so
    // the "loading" flag is set from a callback, not synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    const handle = setTimeout(() => {
      setState({ status: "loading" });

      fetchBalance(ledgerId).then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success && result.data) {
          setState({ status: "ok", closingBalance: result.data.closingBalance });
        } else {
          setState({ status: "error" });
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [ledgerId, fetchBalance]);

  if (!ledgerId || state.status === "idle" || state.status === "error") {
    return null;
  }

  if (state.status === "loading") {
    return <p className="text-xs text-muted-foreground">Loading {label.toLowerCase()}…</p>;
  }

  const amount = Math.abs(state.closingBalance);
  const suffix = state.closingBalance >= 0 ? "Dr" : "Cr";

  return (
    <p className="text-xs text-muted-foreground">
      {label}:{" "}
      <span className="font-financial text-foreground">
        {amount.toFixed(2)} {suffix}
      </span>
    </p>
  );
}
