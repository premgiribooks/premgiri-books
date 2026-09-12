import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building,
  Building2,
  BookOpenText,
  BookText,
  CalendarCheck,
  CalendarRange,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  FileMinus,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FolderTree,
  HandCoins,
  Hash,
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
 * which this mirrors exactly). Two levels deep everywhere: a top-level
 * NavGroup's children are always leaves, never nested groups — this keeps
 * Reports' 11 categories (each already a useful hub page in its own right,
 * e.g. /reports/sales listing its 4 report types) from exploding into 40+
 * sidebar rows.
 */
export interface NavLeaf {
  type: "leaf";
  label: string;
  href: string;
  icon: LucideIcon;
  /** Overrides the parent group's permissionModule for this leaf only. Used
   * for Company Management / Financial Year / Branch Management under
   * Masters, which are gated by their own modules ("company",
   * "financial-year"), not "masters". */
  permissionModule?: PermissionModule;
}

export interface NavGroup {
  type: "group";
  label: string;
  icon: LucideIcon;
  permissionModule: PermissionModule;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavGroup;

function leaf(label: string, href: string, icon: LucideIcon, permissionModule?: PermissionModule): NavLeaf {
  return { type: "leaf", label, href, icon, permissionModule };
}

function group(label: string, icon: LucideIcon, permissionModule: PermissionModule, children: NavLeaf[]): NavGroup {
  return { type: "group", label, icon, permissionModule, children };
}

export const DASHBOARD_ITEM: NavLeaf = leaf("Dashboard", "/", LayoutDashboard);

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
    leaf("Employees", "/masters/employees", Users),
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
    leaf("Payment Vouchers", "/accounting/payment-vouchers", Wallet),
    leaf("Receipt Vouchers", "/accounting/receipt-vouchers", PiggyBank),
    leaf("Contra Vouchers", "/accounting/contra-vouchers", ArrowLeftRight),
    leaf("Journal Vouchers", "/accounting/journal-vouchers", NotebookPen),
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
    leaf("Sales Reports", "/reports/sales", ShoppingCart),
    leaf("Purchase Reports", "/reports/purchase", Truck),
    leaf("Inventory Reports", "/reports/inventory", Package),
    leaf("Customer Reports", "/reports/customers", Users),
    leaf("Supplier Reports", "/reports/suppliers", Building2),
    leaf("Employee Reports", "/reports/employees", UserSquare2),
    leaf("GST Reports", "/reports/gst", Receipt),
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

/** Every leaf in the tree, flattened, in tree order — used by the command
 * palette and by favorites/recents to resolve a bare href to its label/icon. */
export const ALL_NAV_LEAVES: NavLeaf[] = NAVIGATION.flatMap((item) =>
  item.type === "leaf" ? [item] : item.children
);
