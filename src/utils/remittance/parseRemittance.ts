/**
 * One entry point for every file staff drop in: recognise the format from the content (never from
 * the file name, which practices rename) and run its parser. Files that are related but not fund
 * responses (the practice's own claim files, Eminance's converted response files) are recognised and
 * explained instead of being misread.
 */
import { isMedschemeAdvice, parseMedschemeAdvice } from './medschemeAdvice';
import { isMethealthStatement, parseMethealthStatement } from './methealthStatement';
import { isNhpAcknowledgement, parseNhpAcknowledgement } from './nhpAcknowledgement';
import { isNmcResponseCsv, parseNmcResponseCsv } from './nmcResponseCsv';
import { documentText, type PdfPageText } from './pdfLayout';
import { isSwitchOnCsv, parseSwitchOnCsv } from './switchOnCsv';
import { textLines } from './text';
import type { ParsedRemittanceFile, ReconciliationCheck, RemittanceDocument } from './types';

export interface UnsupportedFile {
  format: null;
  /** Why it cannot be imported, in words staff understand */
  reason: string;
}

export type ParseOutcome = ParsedRemittanceFile | UnsupportedFile;

export const isParsed = (outcome: ParseOutcome): outcome is ParsedRemittanceFile => outcome.format !== null;

const wrap = (format: ParsedRemittanceFile['format'], documents: RemittanceDocument[]): ParsedRemittanceFile => ({
  format,
  documents,
  warnings: documents.length === 0 ? ['No payment or claim lines were found in this file.'] : []
});

/** A PDF's pages (from pdfExtract) */
export function parseRemittancePages(pages: readonly PdfPageText[]): ParseOutcome {
  const text = documentText(pages);
  if (isMethealthStatement(text)) return wrap('methealth_statement', [parseMethealthStatement(pages)]);
  if (isMedschemeAdvice(text)) {
    const documents = parseMedschemeAdvice(pages);
    return wrap(documents[0]?.format ?? 'medscheme_advice', documents);
  }
  if (isNhpAcknowledgement(text)) return wrap('nhp_acknowledgement', [parseNhpAcknowledgement(pages)]);
  if (!text.trim()) {
    return { format: null, reason: 'This PDF has no text (it is probably a scan or photo). Ask the fund for the electronic copy.' };
  }
  if (/SwitchOn/i.test(text) && /Navigator/i.test(text)) {
    return { format: null, reason: 'This is the SwitchOn Navigator report as a PDF. Export it as CSV from SwitchOn Navigator and import the CSV.' };
  }
  if (/on-?line claims/i.test(text) && /ACCEPTED CLAIMS/i.test(text)) {
    return { format: null, reason: 'This is a PSEMAS on-line claims assessment report. It cannot be imported yet; its lines also appear on the remittance statement.' };
  }
  return { format: null, reason: 'This PDF is not a remittance or response layout this system knows (Methealth statement, Medscheme advice or NHP acknowledgement).' };
}

/** A CSV or text file's content */
export function parseRemittanceText(content: string): ParseOutcome {
  if (isNmcResponseCsv(content)) return wrap('nmc_response_csv', [parseNmcResponseCsv(content)]);
  if (isSwitchOnCsv(content)) return wrap('switchon_status_csv', [parseSwitchOnCsv(content)]);
  const first = textLines(content)[0] ?? '';
  if (/^1,\d+,R,/.test(first) && /^Z,/m.test(content)) {
    return { format: null, reason: "This is Eminance's own response file (MEDRES), made from a fund's CSV. Import the fund's CSV instead." };
  }
  if (/^1,\d+,\d*,D,/.test(first) && /^D,/m.test(content)) {
    return { format: null, reason: 'This is a claim file the practice sends to a fund, not a response from the fund.' };
  }
  if (/EDI BATCH/i.test(content) && /ACCEPTED CLAIMS|REJECTED CLAIMS|PENDED CLAIMS/i.test(content)) {
    return { format: null, reason: 'This is a Methealth batch report (text). It cannot be imported yet; import the CSV or the remittance statement.' };
  }
  return { format: null, reason: 'This file is not a fund response this system knows (NMC claim response CSV or SwitchOn status report).' };
}

export interface ReconciliationStatus {
  ok: boolean;
  failed: ReconciliationCheck[];
  /** Why nothing may be posted (null when the document reconciles) */
  message: string | null;
}

/**
 * Whether the document adds up: lines against subtotals, totals and the payment amount. Nothing is
 * posted from a document that does not add up, or that has no totals to check against, because
 * a misread line would then put money on the wrong account without anyone noticing.
 */
export function reconciliationStatus(doc: RemittanceDocument): ReconciliationStatus {
  const failed = doc.checks.filter(item => !item.ok);
  if (doc.lines.length === 0) return { ok: false, failed, message: 'No lines were read from this document.' };
  if (doc.checks.length === 0) return { ok: false, failed, message: 'This document has no totals to check the lines against.' };
  if (failed.length > 0) {
    return { ok: false, failed, message: `${failed.length} total${failed.length === 1 ? ' does' : 's do'} not match the lines read. Nothing can be posted until it adds up.` };
  }
  return { ok: true, failed, message: null };
}
