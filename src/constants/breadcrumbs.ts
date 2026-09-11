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
  accounting: "Accounting",
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
  "margin-profiles": "Margin Profiles",
  "price-lists": "Price Lists",
  customers: "Customers",
  suppliers: "Suppliers",
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
};

export const BREADCRUMB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
