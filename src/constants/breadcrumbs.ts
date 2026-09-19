// Static route-segment -> label lookup for the Breadcrumb Bar. Deliberately
// simple (no per-entity name fetching) — a segment not listed here falls
// back to a capitalized version of the raw segment, and a UUID-shaped
// segment (a resource id) is dropped from the visible trail entirely rather
// than showing a raw id, per BREADCRUMB_ID_PATTERN below.
//
// A key may be either a bare segment ("purchase") or a "parent/segment" pair
// ("purchase/orders") — the latter disambiguates a segment reused by more
// than one section (e.g. Sales' own future "/sales/orders" vs this module's
// "/purchase/orders"), checked first by the Breadcrumb Bar before falling
// back to the bare segment.
export const BREADCRUMB_LABELS: Record<string, string> = {
  masters: "Masters",
  profile: "My Profile",
  company: "Company",
  "financial-year": "Financial Year Management",
  branch: "Branch Management",
  sales: "Sales",
  quotations: "Quotations",
  orders: "Sales Orders",
  challans: "Delivery Challans",
  invoices: "Sales Invoices",
  returns: "Sales Returns",
  "credit-notes": "Credit Notes",
  "debit-notes": "Debit Notes",
  "sales-ledgers": "Sales & GST Ledgers",
  purchase: "Purchase",
  "purchase/orders": "Purchase Orders",
  "purchase/receipts": "Goods Receipt Notes",
  "purchase/invoices": "Purchase Invoices",
  "purchase/returns": "Purchase Returns",
  inventory: "Inventory",
  "opening-stock": "Opening Stock",
  adjustments: "Stock Adjustments",
  transfers: "Stock Transfers",
  verifications: "Physical Verification",
  accounting: "Accounting",
  gst: "GST",
  reports: "Reports",
  "trial-balance": "Trial Balance",
  "profit-and-loss": "Profit & Loss",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow",
  // 68-sales-reports.md: "reports/sales" disambiguates against the bare
  // "sales" key (/sales's own hub). Known, accepted limitation: the
  // composite-key mechanism only looks one segment back, so
  // /reports/sales/returns' own "returns" segment (previousSegment "sales",
  // identical to /sales/returns') falls back to the bare "Sales Returns"
  // label rather than a more specific "Sales Return Summary" — recorded
  // here rather than adding a workaround for a cosmetic-only mismatch.
  "reports/sales": "Sales Reports",
  register: "Sales Register",
  "item-wise": "Item-wise Sales",
  "party-wise": "Party-wise Sales",
  // 69-purchase-reports.md: "reports/purchase" disambiguates against the
  // bare "purchase" key (/purchase's own hub). "purchase/register",
  // "purchase/item-wise", and "purchase/party-wise" disambiguate against
  // the bare "register"/"item-wise"/"party-wise" keys above (Sales Reports'
  // own screens) — the previous path segment before each of those three is
  // "purchase" for every /reports/purchase/* route. "returns" has the same
  // known, accepted limitation 68-sales-reports.md's own comment records:
  // /reports/purchase/returns' "returns" segment falls back to the existing
  // "purchase/returns" composite key ("Purchase Returns", the actual
  // Purchase Returns document list) rather than a more specific "Purchase
  // Return Summary" — a cosmetic-only mismatch, not worth a workaround.
  "reports/purchase": "Purchase Reports",
  "purchase/register": "Purchase Register",
  "purchase/item-wise": "Item-wise Purchases",
  "purchase/party-wise": "Party-wise Purchases",
  // 70-inventory-reports.md: "reports/inventory" disambiguates against the
  // bare "inventory" key (/inventory's own hub, spec 32's Phase 5 screens).
  // "current-stock"/"ledger"/"valuation"/"low-stock" have no existing
  // bare-key collision anywhere else in this table, so they're added
  // unqualified rather than as composite keys.
  "reports/inventory": "Inventory Reports",
  "current-stock": "Current Stock",
  ledger: "Stock Ledger",
  valuation: "Stock Valuation",
  "low-stock": "Low Stock",
  // 71-customer-reports.md: "reports/customers" disambiguates against the
  // bare "customers" key (/masters/customers' own list page). "outstanding",
  // "statement", "sales-summary", and "directory" have no existing bare-key
  // collision anywhere else in this table, so they're added unqualified
  // rather than as composite keys.
  "reports/customers": "Customer Reports",
  outstanding: "Outstanding",
  statement: "Statement",
  "sales-summary": "Sales Summary",
  directory: "Directory",
  // 72-supplier-reports.md: "reports/suppliers" disambiguates against the
  // bare "suppliers" key (/masters/suppliers' own list page). "outstanding"
  // and "statement" reuse the identical bare keys Customer Reports already
  // claims above (both sections' own screens share the same generic label,
  // an accepted cosmetic-only overlap, same posture as 69-purchase-
  // reports.md's own "register"/"item-wise"/"party-wise" note). "directory"
  // is likewise shared. "purchase-summary" has no existing bare-key
  // collision, so it's added unqualified.
  "reports/suppliers": "Supplier Reports",
  "purchase-summary": "Purchase Summary",
  // 73-employee-reports.md: "reports/employees" disambiguates against both
  // the bare "employees" key (/employees' own operational hub) and the
  // composite "employees/payroll" key claimed by Payroll's own segment —
  // this key only ever matches when the previous path segment is literally
  // "reports". "attendance-summary"/"payroll-register"/"salary-register"
  // have no existing bare-key collision, so they're added unqualified;
  // "directory" reuses the identical bare key Customer/Supplier Reports
  // already claim above (an accepted cosmetic-only overlap, same posture as
  // those specs' own shared-key notes).
  "reports/employees": "Employee Reports",
  "attendance-summary": "Attendance Summary",
  "payroll-register": "Payroll Register",
  "salary-register": "Salary Register",
  // 74-gst-reports.md: "reports/gst" disambiguates against the bare "gst"
  // key above, which is already claimed by 57-gst-registers.md's own /gst
  // hub page label ("GST") — this spec's route lives under /reports/gst, a
  // different section, so it uses the "parent/segment" composite-key
  // mechanism rather than colliding with the existing bare key.
  "reports/gst": "GST Reports",
  registers: "GST Registers",
  "gstr-1": "GSTR-1",
  "gstr-3b": "GSTR-3B",
  "hsn-summary": "HSN Summary",
  "gstr-2": "GSTR-2",
  "itc-register": "ITC Register",
  "payment-modes": "Payment Modes",
  "payment-vouchers": "Payment Vouchers",
  "receipt-vouchers": "Receipt Vouchers",
  "contra-vouchers": "Contra Vouchers",
  "journal-vouchers": "Journal Vouchers",
  "liability-settlement": "Liability Settlement",
  "ledger-groups": "Ledger Groups",
  ledgers: "Ledgers",
  banks: "Bank Management",
  "expense-heads": "Expense Heads",
  "income-heads": "Income Heads",
  units: "Units",
  categories: "Categories",
  brands: "Brands",
  "hsn-codes": "HSN Codes",
  "gst-rates": "GST Rates",
  warehouses: "Warehouses",
  products: "Products",
  batches: "Batches",
  "margin-profiles": "Margin Profiles",
  "price-lists": "Price Lists",
  customers: "Customers",
  suppliers: "Suppliers",
  employees: "Employees",
  "employees/attendance": "Attendance",
  "attendance/history": "History",
  // 63-payroll.md: "employees/payroll" disambiguates against a future bare
  // "payroll" key collision the same way "employees/attendance" already
  // does for Attendance.
  "employees/payroll": "Payroll",
  settings: "Settings",
  "document-numbering": "Document Numbering",
  users: "User Management",
  roles: "Roles & Permissions",
  administration: "Administration",
  companies: "Companies",
  "company-admins": "Company Admins",
  licenses: "Licenses",
  audit: "Audit",
  backup: "Backup",
  new: "New",
  edit: "Edit",
  select: "Select",
  import: "Import",
};

export const BREADCRUMB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
