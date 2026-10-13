import { decodeText, sha256Hex } from '../../../utils/remittance/fileRead';
import { plainWords } from '../../../utils/plainErrors';
import { extractPdfPages, looksLikePdf, PdfPasswordError } from '../../../utils/remittance/pdfExtract';
import { isParsed, parseRemittancePages, parseRemittanceText } from '../../../utils/remittance/parseRemittance';
import type { ParsedRemittanceFile } from '../../../utils/remittance/types';

/**
 * Reading a dropped file in the browser: its fingerprint, then the parsed fund document. Nothing is
 * uploaded; a password for a protected PDF is used for this read only and never kept.
 */

/** Fund documents are small; anything bigger is not one (and would be slow to read) */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type FileState =
  | { status: 'reading' }
  | { status: 'password'; incorrect: boolean }
  | { status: 'parsed'; parsed: ParsedRemittanceFile }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; message: string };

export interface ReadResult {
  sha256: string | null;
  state: FileState;
}

export async function readRemittanceFile(file: Blob, password?: string): Promise<ReadResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { sha256: null, state: { status: 'unsupported', reason: 'This file is too large to be a fund remittance or response.' } };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256Hex(bytes);
  try {
    if (looksLikePdf(bytes)) {
      const outcome = parseRemittancePages(await extractPdfPages(bytes, { password }));
      return { sha256, state: isParsed(outcome) ? { status: 'parsed', parsed: outcome } : { status: 'unsupported', reason: outcome.reason } };
    }
    const outcome = parseRemittanceText(decodeText(bytes));
    return { sha256, state: isParsed(outcome) ? { status: 'parsed', parsed: outcome } : { status: 'unsupported', reason: outcome.reason } };
  } catch (error) {
    if (error instanceof PdfPasswordError) return { sha256, state: { status: 'password', incorrect: error.incorrect } };
    return { sha256, state: { status: 'error', message: error instanceof Error && error.message ? plainWords(error.message) : 'The file could not be read.' } };
  }
}
