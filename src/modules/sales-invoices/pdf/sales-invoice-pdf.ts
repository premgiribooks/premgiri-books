import { GST_STATE_CODES } from "@/engines/gst/state-codes";
import { escapeHtml } from "@/lib/html-escape";
import { amountToWords } from "@/lib/number-to-words";
import { PRINT_STYLESHEET } from "@/lib/pdf-templates/print-stylesheet";
import { formatSalesInvoiceDate } from "@/modules/sales-invoices/utils/format-sales-invoice-date";
import { customerDisplayName } from "@/modules/sales-invoices/utils/sales-invoice-display";
import type { BankAccountWithLedger } from "@/types/bank-account";
import type { CompanyWithSettings } from "@/types/company";
import type {
  SalesInvoiceDetail,
  SalesInvoiceItemDetail,
} from "@/types/sales-invoice";

/**
 * Everything `buildSalesInvoiceHtml` needs beyond the invoice itself — all
 * already-loaded by the Route Handler's own three read calls
 * (`salesInvoiceService.getSalesInvoice`, `companyService.getCompany`,
 * `bankAccountService.listBankAccounts`) before this function ever runs. No
 * field here is fetched or computed by this file — it only formats
 * already-resolved data (78-pdf-generation.md's Document PDFs rule).
 */
export interface SalesInvoicePdfData {
  salesInvoice: SalesInvoiceDetail;
  /** Null only if the invoice's own company somehow fails to resolve —
   * degrades to a blank seller block rather than throwing, since a missing
   * company record here would be a data-integrity bug elsewhere, not a
   * reason to block a legitimately-authorized PDF download. */
  company: CompanyWithSettings | null;
  /** The company's first active bank account, or null if none is
   * configured (or the caller lacks `accounting`/`view` permission — see
   * the Route Handler's own comment: a sales-only user can still download
   * their own invoice, the bank-details block is optional polish, not
   * gating). This module has no concept of "the primary account" (no such
   * flag exists on the schema) — the caller's own choice of which account
   * to pass is out of this file's scope. */
  bankAccount: BankAccountWithLedger | null;
  /** A base64 data URI, or null if the company has no logo / it couldn't be
   * read — never a `<img src>` URL, so the render stays fully
   * self-contained (78-pdf-generation.md's Assets rule). */
  logoDataUri: string | null;
}

/**
 * This document's own richer layout (seller block, buyer block, HSN/unit
 * columns, bank details, signature area) goes well beyond the simple
 * header/items/totals shape every other document PDF shares — rather than
 * bloat the shared `PRINT_STYLESHEET` with box-grid rules no other document
 * uses, this is a second, local stylesheet layered on top of it. Every
 * other document PDF (`buildQuotationHtml` etc.) is unaffected by anything
 * in this file.
 */
const INVOICE_STYLES = `
  .invoice {
    max-width: 100%;
    /* A4 is 297mm tall; renderHtmlToPdf's DEFAULT_MARGIN reserves 10mm top +
       10mm bottom (see pdf-generation.ts), leaving 277mm of page content
       height; PRINT_STYLESHEET's own body { padding: 16px } consumes a
       further 32px (top+bottom) inside that. Giving .invoice a flex column
       layout at least that tall lets .invoice-footer's margin-top: auto push
       the totals-onward block to the bottom of a short invoice's single
       page. On a genuinely multi-page invoice (enough items to already
       exceed this height) the auto margin simply collapses to 0 — the
       footer falls back to following the content immediately, exactly as
       before this rule existed, never forcing an unnatural page break. */
    min-height: calc(277mm - 32px);
    display: flex;
    flex-direction: column;
  }
  .invoice-footer {
    margin-top: auto;
  }
  .invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #1f2937;
  }
  .company-block {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .company-logo {
    max-width: 64px;
    max-height: 64px;
    object-fit: contain;
  }
  .company-name {
    font-size: 15px;
    font-weight: 700;
    color: #111111;
  }
  .company-meta {
    margin-top: 2px;
    color: #555555;
    line-height: 1.5;
  }
  .invoice-title-block {
    text-align: right;
  }
  .invoice-title {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #1f2937;
  }
  .invoice-meta {
    margin-top: 6px;
    line-height: 1.6;
  }
  .invoice-meta .label {
    color: #555555;
    margin-right: 6px;
  }
  .parties {
    margin-top: 14px;
    display: flex;
  }
  .party-block {
    flex: 1;
    background: #f7f7f8;
    border-radius: 6px;
    padding: 8px 10px;
  }
  .party-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #777777;
    text-transform: uppercase;
  }
  .party-name {
    margin-top: 3px;
    font-weight: 600;
  }
  .party-line {
    margin-top: 1px;
    color: #333333;
  }
  .invoice-items {
    margin-top: 14px;
  }
  .invoice-items th {
    background: #f7f7f8;
    font-weight: 600;
  }
  .text-center {
    text-align: center;
  }
  .qty-total-row td {
    padding-top: 4px;
    font-weight: 600;
    border-top: 1px solid #cccccc;
  }
  .amount-words {
    margin-top: 10px;
    padding: 8px 0;
    border-top: 1px solid #cccccc;
    border-bottom: 1px solid #cccccc;
  }
  .amount-words .label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #777777;
    text-transform: uppercase;
  }
  .amount-words .value {
    margin-top: 2px;
    font-style: italic;
  }
  .footer-grid {
    margin-top: 14px;
    display: flex;
    gap: 16px;
  }
  .footer-block {
    flex: 1;
  }
  .footer-heading {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #777777;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .signature-area {
    margin-top: 34px;
    text-align: right;
  }
  .terms-text {
    /* Preserves the line breaks the company entered in its own Terms &
       Conditions textarea — plain HTML would otherwise collapse them. */
    white-space: pre-line;
  }
  .signature-line {
    display: inline-block;
    width: 160px;
    margin-top: 30px;
    padding-top: 4px;
    border-top: 1px solid #999999;
    color: #555555;
  }
`;

function formatAddressLines(parts: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
}): string[] {
  const lines: string[] = [];
  if (parts.addressLine1) {
    lines.push(parts.addressLine1);
  }
  if (parts.addressLine2) {
    lines.push(parts.addressLine2);
  }
  const cityState = [parts.city, parts.state]
    .filter((value): value is string => Boolean(value))
    .join(", ");
  const cityStateLine = parts.pinCode
    ? [cityState, parts.pinCode].filter(Boolean).join(" - ")
    : cityState;
  if (cityStateLine) {
    lines.push(cityStateLine);
  }
  return lines;
}

function addressLinesHtml(lines: string[]): string {
  return lines
    .map((line) => `<p class="party-line">${escapeHtml(line)}</p>`)
    .join("");
}

/** Resolves a GST state code (e.g. "29") to its statutory name (e.g.
 * "Karnataka") for display — falls back to the raw code itself if it isn't
 * one of the statutory GST_STATE_CODES (defensive only; every value stored
 * on a posted invoice was validated against this same list at creation
 * time). */
function placeOfSupplyDisplay(stateCode: string): string {
  return (
    GST_STATE_CODES.find((entry) => entry.code === stateCode)?.name ?? stateCode
  );
}

function itemRow(item: SalesInvoiceItemDetail, srNo: number): string {
  const discountDisplay =
    item.discountAmount > 0
      ? item.discountAmount.toFixed(2)
      : item.discountPercent > 0
        ? `${item.discountPercent}%`
        : "-";

  return `
    <tr>
      <td class="text-center">${srNo}</td>
      <td>${escapeHtml(item.product.name)} (${escapeHtml(item.product.productCode)})</td>
      <td class="text-center">${item.product.hsnCode ? escapeHtml(item.product.hsnCode) : "-"}</td>
      <td class="text-center">${escapeHtml(item.product.unitSymbol)}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${item.rate.toFixed(2)}</td>
      <td class="text-right">${discountDisplay}</td>
      <td class="text-right">${item.taxableAmount.toFixed(2)}</td>
    </tr>`;
}

function totalsRow(label: string, amount: number, extraClass = ""): string {
  if (amount === 0 && extraClass === "") {
    return "";
  }
  return `<div class="totals-row ${extraClass}"><span>${label}</span><span>${amount.toFixed(2)}</span></div>`;
}

/**
 * Renders a Sales Invoice's already-posted data, plus the seller (Company),
 * bank, and logo context the Route Handler already resolved, into a
 * self-contained standard GST tax invoice HTML string — every figure shown
 * is read verbatim from the document, no new business computation
 * (78-pdf-generation.md's Document PDFs rule); the only display-only
 * aggregation here is a plain sum of already-computed line quantities for
 * the "Total Qty" row, not a tax/pricing calculation.
 *
 * This is now also the on-screen "Print" button's output: rather than
 * maintaining a second, simpler print stylesheet that could drift out of
 * sync with this template (as `SalesInvoicePrintView` once did — removed;
 * see progress-tracker.md's dated entry for the full rationale), Print
 * fetches this same PDF and opens the browser's native print dialog on it.
 *
 * Also deliberately DROPS the prior template's "Paid" totals row and its
 * "Payments" section (ledger/mode/reference/amount per payment) — a legal
 * Tax Invoice is not a payment receipt; Indian GST invoices conventionally
 * carry no payment-collection detail (that belongs on a receipt/statement).
 * `salesInvoice.payments`/`amountPaid` are intentionally never read here.
 *
 * The "Terms & Conditions" section renders `company.termsAndConditions` — a
 * company-wide setting (Company creation/edit) — rather than the invoice's
 * own `narration` field. `narration` is intentionally never read here.
 */
export function buildSalesInvoiceHtml({
  salesInvoice,
  company,
  bankAccount,
  logoDataUri,
}: SalesInvoicePdfData): string {
  const partyName = escapeHtml(customerDisplayName(salesInvoice));
  const totalQty = salesInvoice.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const buyerLines = salesInvoice.customer
    ? formatAddressLines(salesInvoice.customer)
    : salesInvoice.quickCustomerAddress
      ? [salesInvoice.quickCustomerAddress]
      : [];
  const buyerGstin = salesInvoice.customer
    ? salesInvoice.customer.gstin
    : salesInvoice.quickCustomerGstin;
  const buyerMobile = salesInvoice.customer
    ? null
    : salesInvoice.quickCustomerMobile;

  const companyLines = company
    ? formatAddressLines({
        addressLine1: company.addressLine1,
        addressLine2: company.addressLine2,
        city: company.city,
        state: company.state,
        pinCode: company.pinCode,
      })
    : [];

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${PRINT_STYLESHEET}${INVOICE_STYLES}</style>
  </head>
  <body>
    <div class="invoice">
      <div class="invoice-header">
        <div class="company-block">
          ${logoDataUri ? `<img class="company-logo" src="${logoDataUri}" alt="" />` : ""}
          <div>
            <div class="company-name">${company ? escapeHtml(company.companyName) : ""}</div>
            <div class="company-meta">
              ${companyLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
              ${company?.gstin ? `<div>GSTIN: ${escapeHtml(company.gstin)}</div>` : ""}
            </div>
          </div>
        </div>
        <div class="invoice-title-block">
          <div class="invoice-title">Tax Invoice</div>
          <div class="invoice-meta">
            <div><span class="label">Invoice No.</span>${escapeHtml(salesInvoice.invoiceNumber)}</div>
            <div><span class="label">Date</span>${formatSalesInvoiceDate(salesInvoice.invoiceDate)}</div>
            <div><span class="label">Place of Supply</span>${escapeHtml(placeOfSupplyDisplay(salesInvoice.placeOfSupplyStateCode))}</div>
          </div>
        </div>
      </div>

      <div class="parties">
        <div class="party-block">
          <div class="party-label">Bill To</div>
          <div class="party-name">${partyName}</div>
          ${addressLinesHtml(buyerLines)}
          ${buyerMobile ? `<p class="party-line">${escapeHtml(buyerMobile)}</p>` : ""}
          ${buyerGstin ? `<p class="party-line">GSTIN: ${escapeHtml(buyerGstin)}</p>` : ""}
        </div>
      </div>

      <table class="items-table invoice-items">
        <thead>
          <tr>
            <th class="text-center">Sr.</th>
            <th>Description</th>
            <th class="text-center">HSN/SAC</th>
            <th class="text-center">Unit</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Discount</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${salesInvoice.items.map((item, index) => itemRow(item, index + 1)).join("")}
          <tr class="qty-total-row">
            <td colspan="4"></td>
            <td class="text-right">${totalQty}</td>
            <td colspan="3"></td>
          </tr>
        </tbody>
      </table>

      <div class="invoice-footer">
        <div class="totals">
          <div class="totals-box">
            ${totalsRow("Subtotal", salesInvoice.subtotal, "always")}
            ${totalsRow("Discount", salesInvoice.totalDiscount, "always")}
            ${totalsRow("Taxable Amount", salesInvoice.taxableAmount, "always")}
            ${totalsRow("CGST", salesInvoice.totalCgst)}
            ${totalsRow("SGST", salesInvoice.totalSgst)}
            ${totalsRow("IGST", salesInvoice.totalIgst)}
            ${totalsRow("Cess", salesInvoice.totalCess)}
            ${totalsRow("Round Off", salesInvoice.roundOff, "always")}
            ${totalsRow("Grand Total", salesInvoice.grandTotal, "grand-total")}
          </div>
        </div>

        <div class="amount-words">
          <div class="label">Amount in Words</div>
          <div class="value">${escapeHtml(amountToWords(salesInvoice.grandTotal))}</div>
        </div>

        <div class="footer-grid">
          <div class="footer-block">
            ${
              bankAccount
                ? `<div class="footer-heading">Bank Details</div>
            <p class="party-line">Bank Name: ${escapeHtml(bankAccount.bankName)}</p>
            <p class="party-line">A/C No.: ${escapeHtml(bankAccount.accountNumber)}</p>
            <p class="party-line">IFSC: ${escapeHtml(bankAccount.ifscCode)}</p>
            <p class="party-line">Branch: ${escapeHtml(bankAccount.branchName)}</p>`
                : ""
            }
            ${
              company?.termsAndConditions
                ? `<div class="footer-heading" style="margin-top: 10px;">Terms &amp; Conditions</div>
            <p class="party-line terms-text">${escapeHtml(company.termsAndConditions)}</p>`
                : ""
            }
          </div>
          <div class="footer-block signature-area">
            ${company ? `<div>for ${escapeHtml(company.companyName)}</div>` : ""}
            <div class="signature-line">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
