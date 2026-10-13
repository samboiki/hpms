import { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { EMPTY_PRICE_BOOK } from '../../utils/billing/fundPricing';
import { DEFAULT_INFECTION_CONTROL_STAFF } from '../../utils/billing/tariffRules';
import { NO_PRACTITIONER_BILLING, rateOf, type PractitionerBillingMap } from '../../utils/billing/practitionerBilling';
import { loadFundPriceBook, loadInfectionControlStaff, loadPatientFundKey } from '../../services/fundPricingService';
import { loadPractitionerBilling } from '../../services/practitionerBillingService';
import { loadPatientRate } from '../../services/patientRateService';
import type { PatientRate } from '../../utils/billing/patientRates';
import type { VisitPricing } from './visitBillingLines';

export interface FundPricingState {
  /** Lines must not be priced while loading: a medical aid patient could get the practice tariff instead of the fund's */
  status: 'loading' | 'ready';
  /** For priceForPatient: the fund's prices, the patient's own rate and the treating practitioner's rate (practitionerId) */
  pricing: VisitPricing;
  /** The practice's 8109 clinical staff count (1-3) */
  infectionControlStaff: number;
  /** Set when billing must stop for this patient because the fund's prices could not be read */
  blockMessage: string | null;
  /** Each practitioner's own practice number and rate (practitionerBilling.ts); empty until loaded or set up */
  practitionerBilling: PractitionerBillingMap;
  /** The patient's own price rate (patientRates.ts; parity R28): a staff rate also takes the staff medicine price */
  patientRate: PatientRate | null;
}

const LOADING: FundPricingState = {
  status: 'loading',
  pricing: { practiceId: null, fund: null, book: EMPTY_PRICE_BOOK },
  infectionControlStaff: DEFAULT_INFECTION_CONTROL_STAFF,
  blockMessage: null,
  practitionerBilling: NO_PRACTITIONER_BILLING,
  patientRate: null
};

// Without a practice (or before its type is known) there are no fund schedules: the practice tariff applies
const NO_PRACTICE: FundPricingState = { ...LOADING, status: 'ready' };

/**
 * Loads what the billing screens need to price a patient's lines: the practice's fund schedules, the patient's fund,
 * the 8109 staff count, each practitioner's rate (parity D31) and the patient's own rate (R28). New lines are priced at
 * the patient's rate and the rate of `practitionerId` (the visit's treating practitioner), from the practice's price
 * list only: a fund's own price never changes. Before the fund tables exist the schedules are empty, so prices stay
 * the practice tariff; before the patient rates exist every patient reads as having none.
 * A result loaded for other inputs (another patient or practice) is never returned: it reads as loading.
 */
export function useFundPricing(params: {
  practiceId: string | null;
  practiceType: string | null;
  patientId?: string | null;
  medicalAidDetailsId?: string | null;
  /** The treating practitioner whose rate prices new lines; none: the price list */
  practitionerId?: string | null;
}): FundPricingState {
  const { practiceId, practiceType, patientId = null, medicalAidDetailsId = null, practitionerId = null } = params;
  const key = JSON.stringify([practiceId, practiceType, patientId, medicalAidDetailsId]);
  const [loaded, setLoaded] = useState<{ key: string; state: FundPricingState } | null>(null);

  useEffect(() => {
    if (!practiceId || !practiceType) return;
    let cancelled = false;
    Promise.all([
      loadFundPriceBook(practiceId, practiceType),
      loadPatientFundKey({ patientId, medicalAidDetailsId }),
      loadInfectionControlStaff(practiceId),
      loadPractitionerBilling(practiceId),
      loadPatientRate(patientId)
    ])
      .then(([bookLoad, fundLoad, staff, billingLoad, rateLoad]) => {
        if (cancelled) return;
        const fundPricesExist = bookLoad.book.rows.length > 0 || bookLoad.book.contracts.length > 0;
        let blockMessage: string | null = null;
        if (bookLoad.error && fundLoad.hasMedicalAid !== false) {
          blockMessage = `The medical aid prices could not be loaded (${bookLoad.error}), so services cannot be priced for this patient. Close and reopen the visit to try again.`;
        } else if (fundLoad.error && fundPricesExist) {
          blockMessage = `The patient's medical aid could not be read (${fundLoad.error}), so it is not known whether fund prices apply. Close and reopen the visit to try again.`;
        } else if (billingLoad.status === 'error') {
          // A partner's own rate unknown: their lines would be billed at the price list
          blockMessage = `The practitioners' rates could not be loaded (${billingLoad.message}), so services cannot be priced. Close and reopen the visit to try again.`;
        } else if (rateLoad.status === 'error') {
          // A staff or contract patient would be billed the full price
          blockMessage = `The patient's price rate could not be loaded (${rateLoad.message}), so services cannot be priced. Close and reopen the visit to try again.`;
        }
        setLoaded({
          key,
          state: {
            status: 'ready',
            pricing: { practiceId, fund: fundLoad.fund, book: bookLoad.book, patientRate: rateLoad.rate },
            infectionControlStaff: staff,
            blockMessage,
            practitionerBilling: billingLoad.billing,
            patientRate: rateLoad.rate
          }
        });
      })
      .catch(error => {
        if (cancelled) return;
        const reason = error instanceof Error ? plainWords(error.message) : 'unknown error';
        setLoaded({
          key,
          state: { ...NO_PRACTICE, blockMessage: `The medical aid prices could not be loaded (${reason}). Close and reopen the visit to try again.` }
        });
      });
    return () => {
      cancelled = true;
    };
  }, [key, practiceId, practiceType, patientId, medicalAidDetailsId]);

  const base = !practiceId || !practiceType ? NO_PRACTICE : loaded?.key === key ? loaded.state : LOADING;
  const ratePercent = rateOf(practitionerId, base.practitionerBilling);
  // The same object while nothing changes, so the screens' priced lists are not rebuilt on every render
  return useMemo(() => (ratePercent === null ? base : { ...base, pricing: { ...base.pricing, ratePercent } }), [base, ratePercent]);
}
