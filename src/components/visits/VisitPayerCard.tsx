import React, { useId } from 'react';
import { Icon } from '@iconify/react';
import { choiceValue, parseChoice } from '../../utils/accounts/visitPayer';
import type { VisitPayerState } from './useVisitPayer';

const INPUT = 'mt-0.5 block w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900';

/**
 * Who pays for the visit, on its Billing tab (parity A14, A19): the patient (and their medical aid, as always), a
 * company account the patient is on, or one of their injury or accident cases. Shown only when there is more than the
 * patient to choose from; saved with the visit, before its invoice.
 */
const VisitPayerCard: React.FC<{ state: VisitPayerState; disabled?: boolean }> = ({ state, disabled = false }) => {
  const id = useId();
  if (!state.shown) return null;
  if (state.status === 'error') {
    // Nothing to choose from until it is read: say so, in the card's own place and look
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-start gap-3 p-4">
          <Icon icon="solar:buildings-2-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-700" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-gray-900">Who pays for this visit</p>
            <p className="text-xs text-red-700" role="alert">
              {state.message}
            </p>
          </div>
        </div>
      </div>
    );
  }
  const value = choiceValue(state.choice);
  const selected = state.options.find(option => option.value === value) ?? state.options[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <Icon icon="solar:buildings-2-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-700" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={`${id}-payer`} className="block text-sm font-semibold text-gray-900">
            Who pays for this visit
          </label>
          <select
            id={`${id}-payer`}
            className={INPUT}
            value={value}
            onChange={event => state.setChoice(parseChoice(event.target.value))}
            disabled={disabled}
            aria-describedby={`${id}-detail`}
          >
            {state.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p id={`${id}-detail`} className="text-xs text-gray-600 break-words">
            {selected?.detail}
            {state.dirty ? ' Saved with the visit.' : ''}
          </p>
          {state.message && (
            <p className="text-xs text-red-700" role="alert">
              {state.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisitPayerCard;
