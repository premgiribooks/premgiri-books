/**
 * Permanently-visible eligibility disclaimer (83-itc-register.md Business
 * Rules) — not a one-time dismissible notice, rendered on every page load.
 * Mirrors 59-gstr-3b.md's own Table 4(D) disclosure, surfaced here at the
 * point where a filer is actually looking at the detail rather than only a
 * summary line.
 */
export function ItcRegisterEligibilityDisclaimer() {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
      Every line below is assumed fully eligible for Input Tax Credit. This codebase does not record a
      purchase&apos;s Section 17(5) eligibility category — review ineligible/blocked credits (motor vehicles,
      employee benefits, works contracts for immovable property, etc.) manually against the Act before filing.
    </div>
  );
}
