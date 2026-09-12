import type { AccountNature } from "@prisma/client";

export interface DefaultLedgerGroupSeed {
  readonly name: string;
  readonly parent: string | null;
  readonly nature: AccountNature;
  readonly affectsGrossProfit: boolean;
}

// Named so other modules that must look up a specific default group by name
// (14-ledger-master.md's "Cash" seeding under Cash-in-Hand, its "Bank
// Accounts" subtree exclusion, 16-expense-heads.md's "Direct Expenses"/
// "Indirect Expenses" subtree scoping, and 17-income-heads.md's "Direct
// Incomes"/"Indirect Incomes" subtree scoping) reference one shared constant
// instead of re-typing the literal — a typo or rename here now fails those
// lookups loudly rather than silently.
export const CASH_IN_HAND_GROUP_NAME = "Cash-in-Hand";
export const BANK_ACCOUNTS_GROUP_NAME = "Bank Accounts";
export const SUNDRY_DEBTORS_GROUP_NAME = "Sundry Debtors";
export const SUNDRY_CREDITORS_GROUP_NAME = "Sundry Creditors";
export const DIRECT_EXPENSES_GROUP_NAME = "Direct Expenses";
export const INDIRECT_EXPENSES_GROUP_NAME = "Indirect Expenses";
export const DIRECT_INCOMES_GROUP_NAME = "Direct Incomes";
export const INDIRECT_INCOMES_GROUP_NAME = "Indirect Incomes";
// Purchase Invoice's ledger-mapping group requirements
// (44-purchase-invoice.md's Ledger Mapping Validation): purchaseLedgerId must
// be under "Purchase Accounts" (or a descendant), the four input-tax
// mappings under "Duties & Taxes" (or a descendant) — the same subtree this
// group already seeds SUNDRY_CREDITORS_GROUP_NAME under.
export const PURCHASE_ACCOUNTS_GROUP_NAME = "Purchase Accounts";
export const DUTIES_AND_TAXES_GROUP_NAME = "Duties & Taxes";
// Payroll's ledger-mapping group requirement (63-payroll.md's Ledger Mapping
// Validation): salaryPayableLedgerId must be under "Current Liabilities" (or
// a descendant, e.g. a company's own "Provisions"/"Salary Payable" sub-group).
export const CURRENT_LIABILITIES_GROUP_NAME = "Current Liabilities";

// The three ledger groups a Ledger may only be created under through its
// owning module's paired transaction (Bank Management, Customer Management,
// Supplier Management) — never through the generic Create Ledger screen.
// Single shared list so the generic screen's exclusion and each module's own
// "is this the right subtree" check all read the same source of truth,
// per 27-supplier-management.md's instruction to consolidate once a third
// reserved group existed.
export const RESERVED_LEDGER_GROUP_NAMES = [
  BANK_ACCOUNTS_GROUP_NAME,
  SUNDRY_DEBTORS_GROUP_NAME,
  SUNDRY_CREDITORS_GROUP_NAME,
] as const;

// The standard Tally-class Indian-accounting chart-of-accounts skeleton every
// company is seeded with — see 13-ledger-groups.md's Default Group Seeding
// table. Every `parent` here references a top-level (parent: null) group's
// `name`, so a single two-pass insert (parents, then children) is always
// enough — never a deeper hierarchy.
export const DEFAULT_LEDGER_GROUPS: readonly DefaultLedgerGroupSeed[] = [
  { name: "Capital Account", parent: null, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Reserves & Surplus", parent: null, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Loans (Liability)", parent: null, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Secured Loans", parent: "Loans (Liability)", nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Unsecured Loans", parent: "Loans (Liability)", nature: "LIABILITY", affectsGrossProfit: false },
  { name: CURRENT_LIABILITIES_GROUP_NAME, parent: null, nature: "LIABILITY", affectsGrossProfit: false },
  { name: SUNDRY_CREDITORS_GROUP_NAME, parent: CURRENT_LIABILITIES_GROUP_NAME, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Duties & Taxes", parent: CURRENT_LIABILITIES_GROUP_NAME, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Provisions", parent: CURRENT_LIABILITIES_GROUP_NAME, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Fixed Assets", parent: null, nature: "ASSET", affectsGrossProfit: false },
  { name: "Investments", parent: null, nature: "ASSET", affectsGrossProfit: false },
  { name: "Current Assets", parent: null, nature: "ASSET", affectsGrossProfit: false },
  { name: BANK_ACCOUNTS_GROUP_NAME, parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: CASH_IN_HAND_GROUP_NAME, parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: SUNDRY_DEBTORS_GROUP_NAME, parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: "Loans & Advances (Asset)", parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: "Misc. Expenses (Asset)", parent: null, nature: "ASSET", affectsGrossProfit: false },
  { name: "Sales Accounts", parent: null, nature: "INCOME", affectsGrossProfit: true },
  { name: DIRECT_INCOMES_GROUP_NAME, parent: null, nature: "INCOME", affectsGrossProfit: true },
  { name: INDIRECT_INCOMES_GROUP_NAME, parent: null, nature: "INCOME", affectsGrossProfit: false },
  { name: "Purchase Accounts", parent: null, nature: "EXPENSE", affectsGrossProfit: true },
  { name: DIRECT_EXPENSES_GROUP_NAME, parent: null, nature: "EXPENSE", affectsGrossProfit: true },
  { name: INDIRECT_EXPENSES_GROUP_NAME, parent: null, nature: "EXPENSE", affectsGrossProfit: false },
];
