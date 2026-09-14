/**
 * The shared print stylesheet 78-pdf-generation.md names as
 * `src/styles/print.css` — kept here as a TypeScript string constant
 * (rather than a literal `.css` file) because its only current consumer is
 * a server-rendered PDF template running in the Node route-handler process,
 * outside the Next.js CSS pipeline, and Electron's standalone build does
 * not reliably ship raw `src/` sources for a runtime file read. Recorded as
 * a deliberate deviation in progress-tracker.md. Domain-agnostic — no
 * imports from `src/modules/**` or `@prisma/client`; embedded inline via a
 * `<style>` tag by every document's own `build*Html` template so a
 * generated PDF has no external resource to resolve.
 */
export const PRINT_STYLESHEET = `
  @page {
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 16px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111111;
  }
  h1 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    padding: 4px 6px;
    text-align: left;
  }
  .text-right {
    text-align: right;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #cccccc;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }
  .section {
    margin-top: 12px;
  }
  .items-table thead tr {
    border-bottom: 1px solid #cccccc;
  }
  .items-table tbody tr {
    border-bottom: 1px solid #eeeeee;
  }
  .totals {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
  }
  .totals-box {
    width: 260px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
  }
  .totals-row.grand-total {
    border-top: 1px solid #111111;
    font-weight: 600;
    margin-top: 4px;
    padding-top: 4px;
  }
  .muted {
    color: #555555;
  }
`;
