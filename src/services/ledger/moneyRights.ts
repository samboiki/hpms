// ---------------------------------------------------------------------------------------------
// Who may take money back, and the money actions the practice does not use.
//
// Owner decisions of 13 October 2026:
//   - refunds, payment reversals (a receipt, or a payment taken off an invoice) and credit notes are for practice
//     administrators only; everyone else does not see those actions and the service refuses them;
//   - invoices are never deleted (cancel them, or credit them in full);
//   - no discounts on invoices (discounts already given still show and count as before).
// The database checks the same once proposals/2026-10-13-admin-only-money-corrections.sql is applied.
// ---------------------------------------------------------------------------------------------

/** Roles that may refund, reverse a payment or an entry, and give a credit note */
export const MONEY_CORRECTION_ROLES: readonly string[] = ['admin'];

export const canCorrectMoney = (role: string | null | undefined): boolean => MONEY_CORRECTION_ROLES.includes(role ?? '');

export type MoneyCorrection = 'refund' | 'reverse_receipt' | 'reverse_allocation' | 'reverse_adjustment' | 'credit_note';

const ACTION_WORDS: Record<MoneyCorrection, string> = {
  refund: 'refund money',
  reverse_receipt: 'reverse a receipt',
  reverse_allocation: 'take a payment off an invoice',
  reverse_adjustment: 'reverse an entry on an invoice',
  credit_note: 'give a credit note'
};

/** The plain refusal a non-administrator sees (null: allowed) */
export function moneyCorrectionRefusal(action: MoneyCorrection, role: string | null | undefined): string | null {
  if (canCorrectMoney(role)) return null;
  return `Only a practice administrator can ${ACTION_WORDS[action]}. Ask an administrator to do it.`;
}

/** Adjustment kinds that only an administrator may post */
export const ADMIN_ONLY_ADJUSTMENT_KINDS: readonly string[] = ['credit_note', 'refund'];

export const adjustmentCorrection = (kind: string): MoneyCorrection | null =>
  kind === 'refund' ? 'refund' : kind === 'credit_note' ? 'credit_note' : null;

/** The practice gives no discounts on invoices (owner, 13 Oct 2026) */
export const DISCOUNTS_IN_USE = false;
export const NO_DISCOUNTS_MESSAGE =
  'The practice does not give discounts on invoices. If the patient was charged too much, an administrator can give a credit note.';
