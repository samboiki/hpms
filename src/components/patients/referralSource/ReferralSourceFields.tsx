import React from 'react';
import {
  REFERRAL_OTHER_MAX_LENGTH,
  REFERRAL_SOURCES,
  REFERRAL_SOURCE_LABELS,
  isReferralSource,
  type ReferralAnswer
} from '../../../utils/patients/referralSource';

interface Props {
  id: string;
  value: ReferralAnswer;
  onChange: (value: ReferralAnswer) => void;
  /** The host form's own label and input classes, so the question looks like the fields around it */
  labelClassName: string;
  inputClassName: string;
  hintClassName?: string;
}

/**
 * "How did you hear about us?" (owner's decision, 13 Oct 2026): optional; "Other" asks for a few words. Shown only once
 * the columns exist (patientExtrasColumns.ts), by the registration form and the patient form.
 */
export const ReferralSourceFields: React.FC<Props> = ({ id, value, onChange, labelClassName, inputClassName, hintClassName = 'text-xs text-gray-500' }) => (
  <div className="space-y-1">
    <label htmlFor={id} className={labelClassName}>How did you hear about us?</label>
    <select
      id={id}
      value={value.source}
      onChange={event => {
        const source = isReferralSource(event.target.value) ? event.target.value : '';
        onChange({ source, other: source === 'other' ? value.other : '' });
      }}
      className={inputClassName}
      aria-describedby={`${id}-hint`}
    >
      <option value="">Not asked or skipped</option>
      {REFERRAL_SOURCES.map(source => (
        <option key={source} value={source}>{REFERRAL_SOURCE_LABELS[source]}</option>
      ))}
    </select>
    {value.source === 'other' && (
      <input
        id={`${id}-other`}
        type="text"
        autoComplete="off"
        maxLength={REFERRAL_OTHER_MAX_LENGTH}
        value={value.other}
        onChange={event => onChange({ source: 'other', other: event.target.value })}
        placeholder="Where did they hear about us?"
        aria-label="Where they heard about us"
        className={`${inputClassName} mt-2`}
      />
    )}
    <p id={`${id}-hint`} className={hintClassName}>Optional. Counted per month in Reports &gt; Demographics.</p>
  </div>
);
