import React, { useId } from 'react';
import { Icon } from '@iconify/react';
import { describeRate, parseRatePercent } from '../../../utils/billing/practitionerBilling';
import { CLINICAL_ROLES } from '../../../utils/billing/invoiceRights';
import { PRACTITIONER_BILLING_NOT_SET_UP } from '../../../services/practitionerBillingService';
import type { PractitionerBillingDraft } from './usePractitionerBillingDraft';

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500';

/**
 * "Billing" on a practitioner's staff profile: the practice number their lines bill under when they are a partner with
 * their own number (the claim's field 29; empty: the practice's), and their rate as a percentage of the practice's price
 * list (empty: the list). Doctors and nurses only; administrators change it, others see it.
 */
const PractitionerBillingFields: React.FC<{ draft: PractitionerBillingDraft; role: string; canEdit: boolean }> = ({ draft, role, canEdit }) => {
  const id = useId();
  if (!(CLINICAL_ROLES as readonly string[]).includes(role)) return null;
  const { load } = draft;
  const typedRate = parseRatePercent(draft.rateText);
  const rateWords = describeRate(typedRate.ok ? typedRate.value : null);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Billing</h3>
      <p className="text-sm text-gray-500 mb-4">For partners who bill their own work: the medical aid pays the practice number on each line.</p>
      {load.status === 'loading' && <p className="text-sm text-gray-500">Loading the practitioner's billing...</p>}
      {load.status === 'not_set_up' && <p className="text-sm text-gray-600">{PRACTITIONER_BILLING_NOT_SET_UP}</p>}
      {load.status === 'error' && (
        <p className="flex items-start gap-2 text-sm text-red-700" role="alert">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          The practitioner's billing could not be loaded ({load.message}).
        </p>
      )}
      {load.status === 'ready' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-number`} className="block text-sm font-medium text-gray-700 mb-1">
              Own practice number
            </label>
            <input
              id={`${id}-number`}
              type="text"
              inputMode="numeric"
              value={draft.numberText}
              onChange={event => draft.setNumberText(event.target.value)}
              disabled={!canEdit}
              placeholder="Empty: the practice's number"
              aria-describedby={`${id}-number-help`}
              className={INPUT}
            />
            <p id={`${id}-number-help`} className="text-xs text-gray-500 mt-1">
              Their lines bill under this number; leave it empty when the practice bills for them.
            </p>
          </div>
          <div>
            <label htmlFor={`${id}-rate`} className="block text-sm font-medium text-gray-700 mb-1">
              Rate (% of the price list)
            </label>
            <input
              id={`${id}-rate`}
              type="text"
              inputMode="decimal"
              value={draft.rateText}
              onChange={event => draft.setRateText(event.target.value)}
              disabled={!canEdit}
              placeholder="Empty: the price list"
              aria-describedby={`${id}-rate-help`}
              className={INPUT}
            />
            <p id={`${id}-rate-help`} className="text-xs text-gray-500 mt-1">
              {rateWords ? `Their lines are priced at ${rateWords}.` : 'For example 120 for 20% above the price list.'} A fund's own prices are
              never changed. Used on the visit's Billing tab.
            </p>
          </div>
          {draft.problem && (
            <p className="text-sm text-red-700 sm:col-span-2" role="alert">
              {draft.problem}
            </p>
          )}
          {!canEdit && <p className="text-xs text-gray-500 sm:col-span-2">Only the practice's administrators change these.</p>}
        </div>
      )}
    </div>
  );
};

export default PractitionerBillingFields;
