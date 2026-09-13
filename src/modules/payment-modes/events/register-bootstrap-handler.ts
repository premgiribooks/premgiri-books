import { domainEvents } from "@/lib/domain-events";
import { DOMAIN_EVENTS, type CompanyBootstrappedPayload } from "@/constants/domain-events";
import { paymentModeRepository } from "@/modules/payment-modes/repositories/payment-mode-repository";

// Order 30 — no ordering dependency on the ledger-groups (10) / ledgers (20)
// handlers, since ledgerClass is a fixed enum, not a foreign key into the
// chart of accounts (86-payment-mode-master.md). Runs after them anyway,
// simply continuing the existing numbering.
domainEvents.on<CompanyBootstrappedPayload>(
  DOMAIN_EVENTS.COMPANY_BOOTSTRAPPED,
  async ({ companyId }, { tx }) => {
    await paymentModeRepository.seedDefaults(companyId, tx);
  },
  30
);
