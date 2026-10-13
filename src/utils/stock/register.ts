/**
 * The scheduled-medicine register: for one item marked scheduled, every receipt and issue in a period with the
 * running balance, opening from what was on hand before the period. Built from the stock ledger, so it cannot
 * differ from the stock figures.
 */
import { withRunningBalance, type LedgerEntry } from './ledger';

export interface RegisterEntry extends LedgerEntry {
  documentRef: string | null;
  /** The patient it was given to, or the supplier it came from or went back to */
  party: string | null;
  /** The prescriber or the person who recorded it */
  by: string | null;
  note: string | null;
}

/** A register line: the entry (with whatever else the caller keeps on it) and the balance after it */
export type RegisterRow<T extends RegisterEntry = RegisterEntry> = T & {
  received: number;
  issued: number;
  balance: number;
};

export interface Register<T extends RegisterEntry = RegisterEntry> {
  opening: number;
  rows: RegisterRow<T>[];
  received: number;
  issued: number;
  closing: number;
}

/** The register from `fromKey` to `toKey` (both included) */
export function buildRegister<T extends RegisterEntry = RegisterEntry>(entries: readonly T[], fromKey: string, toKey: string): Register<T> {
  const opening = entries.filter(entry => entry.occurredOn < fromKey).reduce((sum, entry) => sum + entry.quantity, 0);
  const inPeriod = entries.filter(entry => entry.occurredOn >= fromKey && entry.occurredOn <= toKey);
  const rows = withRunningBalance(inPeriod, opening).map(entry => ({
    ...entry,
    received: Math.max(entry.quantity, 0),
    issued: Math.max(-entry.quantity, 0)
  }));
  const received = rows.reduce((sum, row) => sum + row.received, 0);
  const issued = rows.reduce((sum, row) => sum + row.issued, 0);
  return { opening, rows, received, issued, closing: opening + received - issued };
}
