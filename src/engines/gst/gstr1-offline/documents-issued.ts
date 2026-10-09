// GSTR-1 Table 13 ("documents issued") — pure series summarisation, no I/O.

import { DOCUMENT_NATURE, type DocumentNature } from "./portal-masters";

export type IssuedDocumentType = "SALES_INVOICE" | "SALES_RETURN" | "CREDIT_NOTE" | "DEBIT_NOTE";

export interface IssuedDocument {
  documentType: IssuedDocumentType;
  documentNumber: string;
  isCancelled: boolean;
}

export interface DocumentSeriesRow {
  nature: DocumentNature;
  srNoFrom: string;
  srNoTo: string;
  totalNumber: number;
  cancelled: number;
}

const DOCUMENT_TYPE_ORDER: readonly IssuedDocumentType[] = ["SALES_INVOICE", "SALES_RETURN", "CREDIT_NOTE", "DEBIT_NOTE"];

const NATURE_BY_DOCUMENT_TYPE: Readonly<Record<IssuedDocumentType, DocumentNature>> = {
  SALES_INVOICE: DOCUMENT_NATURE.INVOICE,
  // A posted Sales Return is reported to GST as a credit document.
  SALES_RETURN: DOCUMENT_NATURE.CREDIT_NOTE,
  CREDIT_NOTE: DOCUMENT_NATURE.CREDIT_NOTE,
  DEBIT_NOTE: DOCUMENT_NATURE.DEBIT_NOTE,
};

const TRAILING_SEQUENCE = /^(.*?)(\d+)$/;

interface ParsedDocument {
  documentType: IssuedDocumentType;
  seriesPrefix: string;
  sequence: number;
  documentNumber: string;
  isCancelled: boolean;
}

function parseDocument(document: IssuedDocument): ParsedDocument {
  const match = TRAILING_SEQUENCE.exec(document.documentNumber);
  // A number with no trailing digits cannot join a serial run — it stands alone.
  const seriesPrefix = match ? match[1] : document.documentNumber;
  const sequence = match ? Number(match[2]) : 0;
  return {
    documentType: document.documentType,
    seriesPrefix,
    sequence,
    documentNumber: document.documentNumber,
    isCancelled: document.isCancelled,
  };
}

function compareParsed(a: ParsedDocument, b: ParsedDocument): number {
  const byType = DOCUMENT_TYPE_ORDER.indexOf(a.documentType) - DOCUMENT_TYPE_ORDER.indexOf(b.documentType);
  if (byType !== 0) return byType;
  if (a.seriesPrefix !== b.seriesPrefix) return a.seriesPrefix < b.seriesPrefix ? -1 : 1;
  return a.sequence - b.sequence;
}

function isSameSeries(a: ParsedDocument, b: ParsedDocument): boolean {
  return a.documentType === b.documentType && a.seriesPrefix === b.seriesPrefix;
}

function toRow(run: readonly ParsedDocument[]): DocumentSeriesRow {
  const first = run[0];
  const last = run[run.length - 1];
  return {
    nature: NATURE_BY_DOCUMENT_TYPE[first.documentType],
    srNoFrom: first.documentNumber,
    srNoTo: last.documentNumber,
    totalNumber: run.length,
    cancelled: run.filter((document) => document.isCancelled).length,
  };
}

/**
 * One row per contiguous run of serial numbers within a document series. A
 * numbering gap (a back-dated invoice, a number issued in another period) ends
 * the run and starts a new row rather than being reported as one wide range,
 * so "Total Number" always equals what the From–To range actually contains.
 */
export function buildDocumentSeriesRows(documents: readonly IssuedDocument[]): DocumentSeriesRow[] {
  const sorted = documents.map(parseDocument).sort(compareParsed);

  const rows: DocumentSeriesRow[] = [];
  let run: ParsedDocument[] = [];

  for (const document of sorted) {
    const previous = run[run.length - 1];
    const continuesRun = previous !== undefined && isSameSeries(previous, document) && document.sequence === previous.sequence + 1;
    if (previous !== undefined && !continuesRun) {
      rows.push(toRow(run));
      run = [];
    }
    run.push(document);
  }
  if (run.length > 0) {
    rows.push(toRow(run));
  }
  return rows;
}
