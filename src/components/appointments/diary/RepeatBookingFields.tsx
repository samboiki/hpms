import React, { useId } from 'react';
import { Icon } from '@iconify/react';
import { REPEAT_MAX_BOOKINGS, REPEAT_MAX_EVERY, describeRepeat, validateRepeatRule, type RepeatRule, type RepeatUnit } from '../../../utils/diary/repeatBookings';
import { formatDiaryDate } from '../../../utils/diary/diaryTime';

interface RepeatBookingFieldsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  rule: RepeatRule;
  onRuleChange: (rule: RepeatRule) => void;
  /** The first booking's day ('yyyy-MM-dd') */
  firstDate: string;
}

const INPUT_CLASS =
  'px-3 py-2 bg-gray-100 border-0 rounded-lg text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors';

/**
 * "Repeat this booking" in the booking form: every N days, weeks or months, for a number of bookings
 * or until a day. Shows the days it will book before anything is saved.
 */
export const RepeatBookingFields: React.FC<RepeatBookingFieldsProps> = ({ enabled, onEnabledChange, rule, onRuleChange, firstDate }) => {
  const id = useId();
  const result = enabled ? validateRepeatRule(firstDate, rule) : null;
  const change = (patch: Partial<RepeatRule>) => onRuleChange({ ...rule, ...patch });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <Icon icon="solar:repeat-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
        Repeat this booking
      </label>

      {enabled && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <label htmlFor={`${id}-every`}>Every</label>
            <input
              id={`${id}-every`}
              type="number"
              min={1}
              max={REPEAT_MAX_EVERY}
              value={rule.every}
              onChange={(event) => change({ every: Number(event.target.value) })}
              className={`${INPUT_CLASS} w-20`}
            />
            <select
              aria-label="Repeat unit"
              value={rule.unit}
              onChange={(event) => change({ unit: event.target.value as RepeatUnit })}
              className={INPUT_CLASS}
            >
              <option value="days">{rule.every === 1 ? 'day' : 'days'}</option>
              <option value="weeks">{rule.every === 1 ? 'week' : 'weeks'}</option>
              <option value="months">{rule.every === 1 ? 'month' : 'months'}</option>
            </select>
          </div>

          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
            <legend className="sr-only">How the series ends</legend>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name={`${id}-ends`} checked={rule.ends === 'count'} onChange={() => change({ ends: 'count' })} className="h-4 w-4 text-purple-600 focus:ring-purple-500" />
              <span>For</span>
            </label>
            <input
              type="number"
              aria-label="Number of bookings"
              min={2}
              max={REPEAT_MAX_BOOKINGS}
              value={rule.count}
              disabled={rule.ends !== 'count'}
              onChange={(event) => change({ count: Number(event.target.value) })}
              className={`${INPUT_CLASS} w-20 disabled:opacity-50`}
            />
            <span>bookings</span>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name={`${id}-ends`} checked={rule.ends === 'until'} onChange={() => change({ ends: 'until' })} className="h-4 w-4 text-purple-600 focus:ring-purple-500" />
              <span>until</span>
            </label>
            <input
              type="date"
              aria-label="Last day of the series"
              min={firstDate}
              value={rule.until}
              disabled={rule.ends !== 'until'}
              onChange={(event) => change({ until: event.target.value })}
              className={`${INPUT_CLASS} disabled:opacity-50`}
            />
          </fieldset>

          {result && !result.ok && (
            <p role="alert" className="text-sm text-red-600">{result.errors.join(' ')}</p>
          )}
          {result?.ok && (
            <div className="rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-900">
              <p className="font-medium">{describeRepeat(rule, result.dates)}</p>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-purple-800">Show the days</summary>
                <p className="mt-1 text-xs text-purple-800">{result.dates.map(formatDiaryDate).join(', ')}</p>
              </details>
              <p className="mt-1 text-xs text-purple-800/80">Clashes on any of these days are listed together before booking.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RepeatBookingFields;
