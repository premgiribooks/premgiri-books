// Recreates every legacy SALES/PURCHASE voucher as a real, posted
// SalesInvoice/PurchaseInvoice — GST and round-off are RECOMPUTED via the
// actual gstEngine (never copied from the legacy voucher_items' stored
// cgstAmt/sgstAmt), stock is recorded via inventoryEngine, and the balanced
// accounting entry is posted via voucherEngine — the same engines the real
// sales-invoice-service.ts/purchase-invoice-service.ts call internally.
// Those services themselves require a live Next.js session
// (getCurrentCompanyUser/getCurrentFinancialYear read request cookies) that a
// standalone script cannot provide, so this file drives the session-free
// engine layer directly instead — the layer architecture-context.md
// documents as the actual owner of business rules ("Business rules must
// exist only inside business engines").
import { prisma } from "@/lib/prisma";
import { gstEngine } from "@/engines/gst/gst-engine";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import type { LegacyDb, LegacyVoucher } from "./legacy-db";
import type { MastersResult } from "./masters";
import type { Remarks } from "./remarks";
import { round2, round4, toPaise, computeRoundOff } from "./calc";

interface BuiltLine {
  productId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  ratePercent: number;
  cessPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

interface BuiltHeader {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  roundOff: number;
  grandTotal: number;
}

// Cess never appears anywhere in the legacy data (no cess column/value in
// voucher_items) — verified, so it is a flat 0 rather than read per-line.
const CESS_PERCENT = 0;

function buildLines(
  legacy: LegacyDb,
  voucherId: string,
  masters: MastersResult,
  supplyType: "INTRA_STATE" | "INTER_STATE"
): BuiltLine[] {
  return legacy.voucherItems(voucherId).map((vi) => {
    const product = masters.productIdByLegacyItemId.get(vi.itemId);
    if (!product) {
      throw new Error(`Voucher item references unknown legacy product ${vi.itemId}.`);
    }
    const quantity = round4(vi.qty);
    const rate = round2(vi.rate);
    const gross = round2(quantity * rate);
    // Verified against both the legacy data's own stored cgstAmt/sgstAmt AND
    // the actual legacy voucher_entries postings: `discountPct` is a real
    // price reduction (both the tax base and the amount owed reflect it),
    // but `discountAmt` never was — a handful of purchase lines have
    // discountAmt === gross (recorded as if the item were free), yet the
    // legacy party ledger entry for that voucher was still credited/debited
    // the FULL undiscounted total (cross-checked against
    // PI-2026-27-0031: total owed = sum of every line's full amount + GST,
    // with no reduction for that line's discountAmt). It was vestigial —
    // set but never actually applied — so it is intentionally NOT migrated
    // (kept out of both the tax base and the new discountAmount field, to
    // avoid recording a "discount" that doesn't reduce what was actually
    // owed); see the remark this produces in MIGRATION-REMARKS.md.
    const discountFromPercent = round2((gross * (vi.discountPct ?? 0)) / 100);
    const taxableAmount = round2(gross - discountFromPercent);
    // The historically-recorded rate for THIS line, not the product's
    // current master GstRate — 1764 of 1771 legacy lines are 18% (9+9), but
    // 4 are nil-rated (0%) and 3 are 5% (2.5+2.5), so a single hardcoded
    // rate would misreport those. igstRate is included too even though it is
    // always 0 in this intra-state-only dataset, for correctness if that
    // ever changes.
    const ratePercent = round2(vi.cgstRate + vi.sgstRate + vi.igstRate);

    const line = gstEngine.calculateLine({
      amount: taxableAmount,
      isInclusive: false,
      ratePercent,
      cessPercent: CESS_PERCENT,
      supplyType,
    });

    return {
      productId: product.id,
      quantity,
      rate,
      discountPercent: vi.discountPct ?? 0,
      discountAmount: discountFromPercent,
      ratePercent,
      cessPercent: CESS_PERCENT,
      taxableAmount: line.taxableAmount,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      cess: line.cess,
      totalAmount: line.totalAmount,
    };
  });
}

function buildHeader(lines: BuiltLine[]): BuiltHeader {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.quantity * l.rate, 0));
  const totalDiscount = round2(lines.reduce((sum, l) => sum + l.discountAmount, 0));
  const taxableAmount = round2(lines.reduce((sum, l) => sum + l.taxableAmount, 0));
  const totalCgst = round2(lines.reduce((sum, l) => sum + l.cgst, 0));
  const totalSgst = round2(lines.reduce((sum, l) => sum + l.sgst, 0));
  const totalIgst = round2(lines.reduce((sum, l) => sum + l.igst, 0));
  const totalCess = round2(lines.reduce((sum, l) => sum + l.cess, 0));

  const exactTotalPaise =
    toPaise(taxableAmount) + toPaise(totalCgst) + toPaise(totalSgst) + toPaise(totalIgst) + toPaise(totalCess);
  const { grandTotal, roundOff } = computeRoundOff(exactTotalPaise);

  return { subtotal, totalDiscount, taxableAmount, totalCgst, totalSgst, totalIgst, totalCess, roundOff, grandTotal };
}

function balancingEntry(roundOff: number, forSales: boolean): { entryType: "DEBIT" | "CREDIT"; amount: number } | null {
  if (roundOff === 0) return null;
  // Sales: customer DEBIT grandTotal must equal CREDIT(sales+taxes)+roundOffEntry.
  // Purchase: supplier CREDIT grandTotal must equal DEBIT(purchase+taxes)+roundOffEntry.
  const positiveMeans = forSales ? "CREDIT" : "DEBIT";
  const negativeMeans = forSales ? "DEBIT" : "CREDIT";
  return { entryType: roundOff > 0 ? positiveMeans : negativeMeans, amount: round2(Math.abs(roundOff)) };
}

export async function migrateSalesInvoices(legacy: LegacyDb, masters: MastersResult, remarks: Remarks): Promise<number> {
  await documentNumberEngine.ensureSequence(masters.companyId, masters.financialYearId, "SALES_INVOICE");
  await documentNumberEngine.ensureSequence(masters.companyId, masters.financialYearId, "SALES_VOUCHER");

  const vouchers = legacy.vouchers("SALES");
  let count = 0;
  let interStateSkipped = 0;

  for (const voucher of vouchers) {
    const customerId = masters.customerIdByLegacyLedgerId.get(voucher.partyLedgerId);
    if (!customerId) {
      remarks.add(`Sales voucher ${voucher.voucherNo} references an unknown party ledger and was skipped.`);
      continue;
    }

    const supplyType = gstEngine.determineSupplyType(masters.companyStateCode, masters.companyStateCode);
    if (supplyType !== "INTRA_STATE") {
      interStateSkipped += 1;
    }

    const lines = buildLines(legacy, voucher.id, masters, supplyType);
    if (lines.length === 0) {
      remarks.add(`Sales voucher ${voucher.voucherNo} had no line items in the legacy data and was skipped.`);
      continue;
    }
    const header = buildHeader(lines);
    const voucherDate = voucher.date.slice(0, 10);

    await prisma.$transaction(
      async (tx) => {
        const invoiceNumber = await documentNumberEngine.generateNumber(tx, {
          companyId: masters.companyId,
          financialYearId: masters.financialYearId,
          documentType: "SALES_INVOICE",
        });

        await inventoryEngine.recordMovements(
          masters.companyId,
          lines.map((l) => ({
            productId: l.productId,
            warehouseId: masters.defaultWarehouseId,
            transactionType: "SALES" as const,
            direction: "OUT" as const,
            quantity: l.quantity,
            transactionDate: voucherDate,
          })),
          tx
        );

        // Customer ledger id resolves to a Customer row's *own* ledgerId, not
        // customerId itself — fetched once here since VoucherEntry posts
        // against Ledger rows, not Customer rows.
        const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
        const entries: { ledgerId: string; entryType: "DEBIT" | "CREDIT"; amount: number }[] = [];
        entries.push({ ledgerId: customer.ledgerId, entryType: "DEBIT", amount: header.grandTotal });
        entries.push({ ledgerId: masters.salesLedgerId, entryType: "CREDIT", amount: header.taxableAmount });
        if (header.totalCgst > 0) entries.push({ ledgerId: masters.outputCgstLedgerId, entryType: "CREDIT", amount: header.totalCgst });
        if (header.totalSgst > 0) entries.push({ ledgerId: masters.outputSgstLedgerId, entryType: "CREDIT", amount: header.totalSgst });
        if (header.totalIgst > 0) entries.push({ ledgerId: masters.outputIgstLedgerId, entryType: "CREDIT", amount: header.totalIgst });
        if (header.totalCess > 0) entries.push({ ledgerId: masters.outputCessLedgerId, entryType: "CREDIT", amount: header.totalCess });
        const balancing = balancingEntry(header.roundOff, true);
        if (balancing) entries.push({ ledgerId: masters.roundOffLedgerId, ...balancing });

        const posted = await voucherEngine.postVoucher(
          masters.companyId,
          {
            financialYearId: masters.financialYearId,
            voucherType: "SALES",
            voucherDate,
            narration: voucher.narration ?? undefined,
            entries,
          },
          tx
        );

        const invoice = await tx.salesInvoice.create({
          data: {
            companyId: masters.companyId,
            financialYearId: masters.financialYearId,
            invoiceNumber: invoiceNumber.formatted,
            invoiceDate: new Date(voucherDate),
            customerMode: "PERMANENT",
            customerId,
            placeOfSupplyStateCode: masters.companyStateCode,
            status: "POSTED",
            narration: `Migrated from legacy voucher ${voucher.voucherNo}` + (voucher.narration ? ` — ${voucher.narration}` : ""),
            subtotal: header.subtotal,
            totalDiscount: header.totalDiscount,
            taxableAmount: header.taxableAmount,
            totalCgst: header.totalCgst,
            totalSgst: header.totalSgst,
            totalIgst: header.totalIgst,
            totalCess: header.totalCess,
            roundOff: header.roundOff,
            grandTotal: header.grandTotal,
            voucherId: posted.id,
            items: {
              create: lines.map((l, i) => ({
                lineNumber: i + 1,
                productId: l.productId,
                warehouseId: masters.defaultWarehouseId,
                quantity: l.quantity,
                rate: l.rate,
                discountPercent: l.discountPercent,
                discountAmount: l.discountAmount,
                ratePercent: l.ratePercent,
                cessPercent: l.cessPercent,
                taxableAmount: l.taxableAmount,
                cgst: l.cgst,
                sgst: l.sgst,
                igst: l.igst,
                cess: l.cess,
                totalAmount: l.totalAmount,
              })),
            },
          },
        });

        // Preserve the legacy creation timestamp — Prisma's @default(now())/
        // @updatedAt cannot be set through a nested create, only via a
        // direct update afterward.
        await tx.salesInvoice.update({
          where: { id: invoice.id },
          data: { createdAt: new Date(voucher.createdAt), updatedAt: new Date(voucher.createdAt) },
        });

        if (voucher.status === "CANCELLED") {
          await inventoryEngine.recordMovements(
            masters.companyId,
            lines.map((l) => ({
              productId: l.productId,
              warehouseId: masters.defaultWarehouseId,
              transactionType: "SALES_RETURN" as const,
              direction: "IN" as const,
              quantity: l.quantity,
              transactionDate: voucherDate,
            })),
            tx
          );
          await voucherEngine.cancelVoucher(masters.companyId, posted.id, tx);
          await tx.salesInvoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
        }
      },
      { isolationLevel: "Serializable", timeout: 60_000 }
    );

    count += 1;
  }

  if (interStateSkipped > 0) {
    remarks.add(
      `${interStateSkipped} sales invoice(s) were computed as INTER_STATE even though the legacy data recorded only CGST+SGST — review placeOfSupplyStateCode assumptions.`
    );
  }

  return count;
}

export async function migratePurchaseInvoices(
  legacy: LegacyDb,
  masters: MastersResult,
  remarks: Remarks
): Promise<number> {
  await documentNumberEngine.ensureSequence(masters.companyId, masters.financialYearId, "PURCHASE_INVOICE");
  await documentNumberEngine.ensureSequence(masters.companyId, masters.financialYearId, "PURCHASE_VOUCHER");

  remarks.add(
    "8 purchase invoice line(s) in the legacy data had a `discountAmt` equal to the full line value (recorded as if the item were free) — cross-checked against the legacy ledger entries and confirmed it never actually reduced the amount owed to the supplier, so it was dropped rather than migrated (GST was, and still is, computed on the full line value for these). Review purchase invoices dated 2026-06-07, 2026-07-18, 2026-07-26, 2026-08-04, 2026-08-21, and 2026-09-07 if this needs a different treatment."
  );

  const vouchers = legacy.vouchers("PURCHASE");
  let count = 0;

  for (const voucher of vouchers) {
    const supplierId = masters.supplierIdByLegacyLedgerId.get(voucher.partyLedgerId);
    if (!supplierId) {
      remarks.add(`Purchase voucher ${voucher.voucherNo} references an unknown party ledger and was skipped.`);
      continue;
    }

    const supplyType = gstEngine.determineSupplyType(masters.companyStateCode, masters.companyStateCode);
    const lines = buildLines(legacy, voucher.id, masters, supplyType);
    if (lines.length === 0) {
      remarks.add(`Purchase voucher ${voucher.voucherNo} had no line items in the legacy data and was skipped.`);
      continue;
    }
    const header = buildHeader(lines);
    const voucherDate = voucher.date.slice(0, 10);
    const supplierInvoiceNumber = voucher.supplierInvoiceNo?.trim() || voucher.voucherNo;

    await prisma.$transaction(
      async (tx) => {
        const invoiceNumber = await documentNumberEngine.generateNumber(tx, {
          companyId: masters.companyId,
          financialYearId: masters.financialYearId,
          documentType: "PURCHASE_INVOICE",
        });

        await inventoryEngine.recordMovements(
          masters.companyId,
          lines.map((l) => ({
            productId: l.productId,
            warehouseId: masters.defaultWarehouseId,
            transactionType: "PURCHASE" as const,
            direction: "IN" as const,
            quantity: l.quantity,
            unitCost: l.rate,
            transactionDate: voucherDate,
          })),
          tx
        );

        const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });
        const entries: { ledgerId: string; entryType: "DEBIT" | "CREDIT"; amount: number }[] = [];
        entries.push({ ledgerId: masters.purchaseLedgerId, entryType: "DEBIT", amount: header.taxableAmount });
        if (header.totalCgst > 0) entries.push({ ledgerId: masters.inputCgstLedgerId, entryType: "DEBIT", amount: header.totalCgst });
        if (header.totalSgst > 0) entries.push({ ledgerId: masters.inputSgstLedgerId, entryType: "DEBIT", amount: header.totalSgst });
        if (header.totalIgst > 0) entries.push({ ledgerId: masters.inputIgstLedgerId, entryType: "DEBIT", amount: header.totalIgst });
        if (header.totalCess > 0) entries.push({ ledgerId: masters.inputCessLedgerId, entryType: "DEBIT", amount: header.totalCess });
        const balancing = balancingEntry(header.roundOff, false);
        if (balancing) entries.push({ ledgerId: masters.roundOffLedgerId, ...balancing });
        entries.push({ ledgerId: supplier.ledgerId, entryType: "CREDIT", amount: header.grandTotal });

        const posted = await voucherEngine.postVoucher(
          masters.companyId,
          {
            financialYearId: masters.financialYearId,
            voucherType: "PURCHASE",
            voucherDate,
            narration: voucher.narration ?? undefined,
            entries,
          },
          tx
        );

        const invoice = await tx.purchaseInvoice.create({
          data: {
            companyId: masters.companyId,
            financialYearId: masters.financialYearId,
            invoiceNumber: invoiceNumber.formatted,
            supplierInvoiceNumber,
            invoiceDate: new Date(voucherDate),
            supplierId,
            placeOfSupplyStateCode: masters.companyStateCode,
            status: "POSTED",
            narration: `Migrated from legacy voucher ${voucher.voucherNo}` + (voucher.narration ? ` — ${voucher.narration}` : ""),
            subtotal: header.subtotal,
            totalDiscount: header.totalDiscount,
            taxableAmount: header.taxableAmount,
            totalCgst: header.totalCgst,
            totalSgst: header.totalSgst,
            totalIgst: header.totalIgst,
            totalCess: header.totalCess,
            roundOff: header.roundOff,
            grandTotal: header.grandTotal,
            voucherId: posted.id,
            items: {
              create: lines.map((l, i) => ({
                lineNumber: i + 1,
                productId: l.productId,
                warehouseId: masters.defaultWarehouseId,
                quantity: l.quantity,
                rate: l.rate,
                discountPercent: l.discountPercent,
                discountAmount: l.discountAmount,
                ratePercent: l.ratePercent,
                cessPercent: l.cessPercent,
                taxableAmount: l.taxableAmount,
                cgst: l.cgst,
                sgst: l.sgst,
                igst: l.igst,
                cess: l.cess,
                totalAmount: l.totalAmount,
              })),
            },
          },
        });

        await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: { createdAt: new Date(voucher.createdAt), updatedAt: new Date(voucher.createdAt) },
        });

        if (voucher.status === "CANCELLED") {
          await inventoryEngine.recordMovements(
            masters.companyId,
            lines.map((l) => ({
              productId: l.productId,
              warehouseId: masters.defaultWarehouseId,
              transactionType: "PURCHASE_RETURN" as const,
              direction: "OUT" as const,
              quantity: l.quantity,
              transactionDate: voucherDate,
            })),
            tx
          );
          await voucherEngine.cancelVoucher(masters.companyId, posted.id, tx);
          await tx.purchaseInvoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
        }
      },
      { isolationLevel: "Serializable", timeout: 60_000 }
    );

    count += 1;
  }

  return count;
}
