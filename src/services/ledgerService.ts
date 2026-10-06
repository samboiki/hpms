/**
 * Ledger math for the Finance page. Pure functions only (no Supabase), so every business rule is
 * covered by unit tests (src/services/__tests__/ledgerService.test.ts):
 * - money is summed in integer cents, so totals and splits are exact
 * - a cancelled invoice is void: never revenue, never owed
 * - a paid invoice is never outstanding; anything else (pending, overdue, missing or unknown
 *   status) is still owed
 * - the patient is liable for whatever the medical aid does not cover, so the funder split
 *   always adds up to the invoice total
 * - all period bounds are local calendar dates (yyyy-MM-dd), never UTC
 *
 * The implementation is split by domain under ./ledger; import from this module.
 */
export * from './ledger/money';
export * from './ledger/dates';
export * from './ledger/invoices';
export * from './ledger/receivables';
export * from './ledger/lineItems';
export * from './ledger/payroll';
export * from './ledger/expenses';
export * from './ledger/inventory';
export * from './ledger/summary';
export * from './ledger/takings';
export * from './ledger/visits';
export * from './ledger/doctors';
export * from './ledger/statutory';
