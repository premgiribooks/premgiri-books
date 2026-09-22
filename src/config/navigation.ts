import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BookOpenText,
  BookText,
  BookUser,
  Boxes,
  Building,
  Building2,
  Calculator,
  CalendarCheck,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileClock,
  FileMinus,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FolderTree,
  HandCoins,
  Hash,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  ListOrdered,
  ListTree,
  NotebookPen,
  Package,
  PackageCheck,
  PackagePlus,
  Percent,
  PiggyBank,
  Receipt,
  ReceiptText,
  RotateCcw,
  Ruler,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  Truck,
  UserSquare2,
  Users,
  Wallet,
  Warehouse,
  Waves,
} from "lucide-react";

import type { PermissionModule } from "@/constants/permissions";

/**
 * Central navigation tree — the single source of truth for the sidebar and
 * the command palette. Built only from routes that already exist as real
 * `page.tsx` files (see each hub page's own `..._MODULES`/`..._VIEWS` const,
 * which this mirrors exactly). Three levels deep where the underlying pages
 * actually nest that way: a top-level NavGroup's children are usually
 * leaves, but a child may itself carry `children` (a third level) when its
 * own hub page has further real sub-pages — today that's only Reports' six
 * sub-hubs (Sales/Purchase/Inventory/Customer/Supplier/Employee Reports),
 * each listing its own report types. A third-level leaf never carries its
 * own `children` — this tree goes exactly one level deeper than before, not
 * arbitrarily deep.
 */
export interface NavLeaf {
  type: "leaf";
  label: string;
  href: string;
  icon: LucideIcon;
  /** Overrides the parent group's permissionModule for this leaf only. Used
   * for Company Management / Financial Year / Branch Management under
   * Masters, which are gated by their own modules ("company",
   * "financial-year"), not "masters"; and for Employees under Masters
   * (gated on "employees", not "masters" — a genuinely different module
   * from the top-level Employees group). An array means the destination
   * page checks more than one module (e.g. GST Reports requires both
   * "reports:view" and "gst:view") — every module in the array must grant
   * "view" for the leaf to render. */
  permissionModule?: PermissionModule | readonly PermissionModule[];
  /** Third-level children — present only where this leaf's own destination
   * is itself a hub page with further real sub-pages (Reports' six
   * sub-hubs). When set, the Sidebar renders this leaf as an expandable
   * sub-group instead of a directly clickable link (mirroring how a
   * top-level NavGroup's own header only toggles, never navigates); its
   * `href` stays valid for direct URL access and the Command Palette still
   * lists it as its own searchable page. */
  children?: readonly NavLeaf[];
}

export interface NavGroup {
  type: "group";
  label: string;
  icon: LucideIcon;
  permissionModule: PermissionModule;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavGroup;

function leaf(
  label: string,
  href: string,
  icon: LucideIcon,
  permissionModule?: PermissionModule | readonly PermissionModule[],
  children?: readonly NavLeaf[]
): NavLeaf {
  return { type: "leaf", label, href, icon, permissionModule, children };
}

function group(label: string, icon: LucideIcon, permissionModule: PermissionModule, children: NavLeaf[]): NavGroup {
  return { type: "group", label, icon, permissionModule, children };
}

export const DASHBOARD_ITEM: NavLeaf = leaf("Dashboard", "/", LayoutDashboard, "dashboard");

export const NAVIGATION: NavItem[] = [
  DASHBOARD_ITEM,
  group("Masters", Boxes, "masters", [
    leaf("Company Management", "/company", Building2, "company"),
    leaf("Financial Year", "/financial-year", CalendarRange, "financial-year"),
    leaf("Branch Management", "/branch", Building, "company"),
    leaf("Units", "/masters/units", Ruler),
    leaf("Categories", "/masters/categories", FolderTree),
    leaf("Brands", "/masters/brands", Tag),
    leaf("HSN Codes", "/masters/hsn-codes", Hash),
    leaf("GST Rates", "/masters/gst-rates", Percent),
    leaf("Warehouses", "/masters/warehouses", Warehouse),
    leaf("Products", "/masters/products", Package),
    leaf("Margin Profiles", "/masters/margin-profiles", TrendingUp),
    leaf("Price Lists", "/masters/price-lists", ListOrdered),
    leaf("Customers", "/masters/customers", Users),
    leaf("Suppliers", "/masters/suppliers", Truck),
    leaf("Employees", "/masters/employees", Users, "employees"),
  ]),
  group("Sales", ShoppingCart, "sales", [
    leaf("Quotations", "/sales/quotations", FileText),
    leaf("Sales Orders", "/sales/orders", ClipboardCheck),
    leaf("Delivery Challans", "/sales/challans", Truck),
    leaf("Sales Invoices", "/sales/invoices", Receipt),
    leaf("Sales Returns", "/sales/returns", RotateCcw),
    leaf("Credit Notes", "/sales/credit-notes", FileMinus),
    leaf("Debit Notes", "/sales/debit-notes", FilePlus),
  ]),
  group("Purchase", Truck, "purchase", [
    leaf("Purchase Orders", "/purchase/orders", ClipboardList),
    leaf("Goods Receipt Notes", "/purchase/receipts", PackageCheck),
    leaf("Purchase Invoices", "/purchase/invoices", ReceiptText),
    leaf("Purchase Returns", "/purchase/returns", RotateCcw),
    leaf("Credit Notes", "/purchase/credit-notes", FileMinus),
  ]),
  group("Inventory", Package, "inventory", [
    leaf("Opening Stock", "/inventory/opening-stock", PackagePlus),
    leaf("Stock Adjustment", "/inventory/adjustments", SlidersHorizontal),
    leaf("Stock Transfer", "/inventory/transfers", ArrowLeftRight),
    leaf("Physical Verification", "/inventory/verifications", ClipboardCheck),
  ]),
  group("Accounting", Calculator, "accounting", [
    leaf("Ledger Groups", "/accounting/ledger-groups", ListTree),
    leaf("Ledger Master", "/accounting/ledgers", BookText),
    leaf("Bank Management", "/accounting/banks", Landmark),
    leaf("Expense Heads", "/accounting/expense-heads", Receipt),
    leaf("Income Heads", "/accounting/income-heads", HandCoins),
    leaf("Payment Modes", "/accounting/payment-modes", CreditCard),
    leaf("Payment Vouchers", "/accounting/payment-vouchers", Wallet),
    leaf("Receipt Vouchers", "/accounting/receipt-vouchers", PiggyBank),
    leaf("Contra Vouchers", "/accounting/contra-vouchers", ArrowLeftRight),
    leaf("Journal Vouchers", "/accounting/journal-vouchers", NotebookPen),
    leaf("Liability Settlement", "/accounting/liability-settlement", Banknote),
  ]),
  group("GST", Receipt, "gst", [
    leaf("GST Registers", "/gst/registers", BookOpenText),
    leaf("GSTR-1", "/gst/gstr-1", FileText),
    leaf("GSTR-3B", "/gst/gstr-3b", FileSpreadsheet),
    leaf("HSN Summary", "/gst/hsn-summary", ListChecks),
    leaf("GSTR-2", "/gst/gstr-2", ReceiptText),
    leaf("ITC Register", "/gst/itc-register", ShieldCheck),
  ]),
  group("Reports", BarChart3, "reports", [
    leaf("Trial Balance", "/reports/trial-balance", Scale),
    leaf("Profit & Loss", "/reports/profit-and-loss", TrendingUp),
    leaf("Balance Sheet", "/reports/balance-sheet", Landmark),
    leaf("Cash Flow", "/reports/cash-flow", Waves),
    leaf("Sales Reports", "/reports/sales", ShoppingCart, undefined, [
      leaf("Sales Register", "/reports/sales/register", ListOrdered),
      leaf("Item-wise Sales", "/reports/sales/item-wise", Package),
      leaf("Party-wise Sales", "/reports/sales/party-wise", Users),
      leaf("Sales Return Summary", "/reports/sales/returns", RotateCcw),
    ]),
    leaf("Purchase Reports", "/reports/purchase", Truck, undefined, [
      leaf("Purchase Register", "/reports/purchase/register", ListOrdered),
      leaf("Item-wise Purchases", "/reports/purchase/item-wise", Package),
      leaf("Party-wise Purchases", "/reports/purchase/party-wise", Users),
      leaf("Purchase Return Summary", "/reports/purchase/returns", RotateCcw),
    ]),
    leaf("Inventory Reports", "/reports/inventory", Package, undefined, [
      leaf("Current Stock", "/reports/inventory/current-stock", Package),
      leaf("Stock Ledger", "/reports/inventory/ledger", History),
      leaf("Stock Valuation", "/reports/inventory/valuation", Wallet),
      leaf("Low Stock / Reorder", "/reports/inventory/low-stock", AlertTriangle),
    ]),
    leaf("Customer Reports", "/reports/customers", Users, undefined, [
      leaf("Outstanding", "/reports/customers/outstanding", Wallet),
      leaf("Statement", "/reports/customers/statement", FileClock),
      leaf("Sales Summary", "/reports/customers/sales-summary", ShoppingBag),
      leaf("Directory", "/reports/customers/directory", BookUser),
    ]),
    leaf("Supplier Reports", "/reports/suppliers", Building2, undefined, [
      leaf("Outstanding", "/reports/suppliers/outstanding", Wallet),
      leaf("Statement", "/reports/suppliers/statement", FileClock),
      leaf("Purchase Summary", "/reports/suppliers/purchase-summary", ShoppingBag),
      leaf("Directory", "/reports/suppliers/directory", BookUser),
    ]),
    leaf("Employee Reports", "/reports/employees", UserSquare2, undefined, [
      leaf("Attendance Summary", "/reports/employees/attendance-summary", CalendarCheck),
      leaf("Payroll Register", "/reports/employees/payroll-register", ClipboardList),
      leaf("Salary Register", "/reports/employees/salary-register", Wallet),
      leaf("Directory", "/reports/employees/directory", BookUser),
    ]),
    leaf("GST Reports", "/reports/gst", Receipt, ["reports", "gst"]),
  ]),
  group("Employees", Users, "employees", [
    leaf("Attendance", "/employees/attendance", CalendarCheck),
    leaf("Payroll", "/employees/payroll", Wallet),
  ]),
  group("Settings", Settings, "settings", [
    leaf("User Management", "/settings/users", Users),
    leaf("Roles & Permissions", "/settings/roles", ShieldCheck),
    leaf("Document Numbering", "/settings/document-numbering", Hash),
    leaf("Sales & GST Ledgers", "/settings/sales-ledgers", Receipt),
  ]),
];

/** Flattens a nav tree (any depth up to the three this app uses) into a flat
 * list of every leaf, at every level, in tree order — the level-2 "hub"
 * leaves (e.g. "Sales Reports") are included alongside their level-3
 * children, since both are real, independently searchable/linkable pages.
 * Shared by `ALL_NAV_LEAVES` below (the unfiltered tree) and by the Sidebar/
 * Command Palette (a permission-filtered tree), so the flattening logic
 * lives in exactly one place. */
export function flattenNavItems(tree: readonly NavItem[]): NavLeaf[] {
  const leaves: NavLeaf[] = [];
  for (const item of tree) {
    const children = item.type === "leaf" ? [item] : item.children;
    for (const child of children) {
      leaves.push(child);
      if (child.children) {
        leaves.push(...child.children);
      }
    }
  }
  return leaves;
}

/** Every leaf in the tree, flattened, in tree order — used by the command
 * palette and by favorites/recents to resolve a bare href to its label/icon. */
export const ALL_NAV_LEAVES: NavLeaf[] = flattenNavItems(NAVIGATION);
