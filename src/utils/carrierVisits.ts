/**
 * Visit rows that only carry invoices are not visits. Every invoice needs a visit (invoices_enhanced.visit_id is required),
 * so a payment plan instalment, a prepaid package sale (parity D16, D17) and an opening balance brought over from Eminance
 * hang on a row the system makes: cancelled, not scheduled, noted "Not a consultation", automation_source 'system'.
 *
 * That marker is the one rule: every place that counts visits, or asks whether a patient was seen, leaves these rows out.
 * Its twin in the database is public.visit_is_carrier (proposals/2026-10-13-billing-extras-followup.sql), used by the
 * dashboard, the visit numbers, the patient app and the Encounters list; src/utils/__tests__/carrierVisits.test.ts keeps
 * the two the same.
 */

/** The automation_source of a row that only carries invoices */
export const CARRIER_VISIT_SOURCE = 'system';

/**
 * `.or(EXCLUDE_CARRIER_VISITS)` on a visits query keeps every visit except carriers: automation_source empty or anything
 * else (a second .or on the same query is combined with AND).
 */
export const EXCLUDE_CARRIER_VISITS = `automation_source.is.null,automation_source.neq.${CARRIER_VISIT_SOURCE}`;

/** For visit rows already loaded with their automation_source (select('*') has it) */
export function isCarrierVisit(visit: { automation_source?: string | null }): boolean {
  return visit.automation_source === CARRIER_VISIT_SOURCE;
}
