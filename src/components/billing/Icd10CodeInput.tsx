import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  COMMON_ICD10_CODES,
  MAX_SECONDARY_ICD10,
  describeIcd10,
  normalizeIcd10,
  validateIcd10Selection,
  type Icd10Selection
} from '../../utils/billing/icd10';

interface Icd10CodeInputProps {
  value: Icd10Selection;
  onChange: (value: Icd10Selection) => void;
  disabled?: boolean;
  /** Shown above the inputs. */
  label?: string;
  /** Hide the "required" error until the user has interacted (e.g. while a line is new). */
  showRequiredError?: boolean;
}

/**
 * ICD-10 entry for one service line: one primary code and up to 9 secondary codes, picked from
 * the built-in common list or typed freely. Codes are tidied on blur ("j069" -> "J06.9") and
 * validated as they are entered.
 */
const Icd10CodeInput: React.FC<Icd10CodeInputProps> = ({
  value,
  onChange,
  disabled = false,
  label = 'ICD-10 diagnosis',
  showRequiredError = true
}) => {
  const listId = useId();
  const primaryId = useId();
  const secondaryId = useId();
  const [draft, setDraft] = useState('');
  const { errors, warnings } = validateIcd10Selection(value);
  const visibleErrors = showRequiredError || value.primary.trim()
    ? errors
    : errors.filter(message => !message.includes('required'));
  const primaryDescription = describeIcd10(value.primary);
  const canAddSecondary = !disabled && value.secondary.length < MAX_SECONDARY_ICD10;

  const addSecondary = () => {
    const code = normalizeIcd10(draft);
    if (!code) return;
    onChange({ ...value, secondary: [...value.secondary, code] });
    setDraft('');
  };

  const removeSecondary = (index: number) => {
    onChange({ ...value, secondary: value.secondary.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-2">
      <datalist id={listId}>
        {COMMON_ICD10_CODES.map(entry => (
          <option key={entry.code} value={entry.code}>
            {`${entry.code} - ${entry.description}`}
          </option>
        ))}
      </datalist>

      <div className="flex flex-col sm:flex-row sm:items-start gap-2">
        <div className="sm:w-48">
          <label htmlFor={primaryId} className="block text-xs font-medium text-gray-700 mb-1">
            {label} <span className="text-red-600">*</span>
          </label>
          <input
            id={primaryId}
            type="text"
            list={listId}
            value={value.primary}
            disabled={disabled}
            placeholder="e.g. J06.9"
            autoComplete="off"
            onChange={event => onChange({ ...value, primary: event.target.value.toUpperCase() })}
            onBlur={() => onChange({ ...value, primary: normalizeIcd10(value.primary) })}
            aria-invalid={visibleErrors.length > 0}
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-gray-100"
          />
          {primaryDescription && <p className="mt-1 text-xs text-gray-500">{primaryDescription}</p>}
        </div>

        <div className="flex-1">
          <label htmlFor={secondaryId} className="block text-xs font-medium text-gray-700 mb-1">
            Secondary codes ({value.secondary.length}/{MAX_SECONDARY_ICD10})
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {value.secondary.map((code, index) => (
              <span
                key={`${code}-${index}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-full"
                title={describeIcd10(code) ?? undefined}
              >
                {code}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeSecondary(index)}
                    className="text-cyan-700 hover:text-red-600"
                    aria-label={`Remove secondary code ${code}`}
                    title={`Remove secondary code ${code}`}
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
            {canAddSecondary && (
              <span className="inline-flex items-center gap-1">
                <input
                  id={secondaryId}
                  type="text"
                  list={listId}
                  value={draft}
                  placeholder="Add code"
                  autoComplete="off"
                  onChange={event => setDraft(event.target.value.toUpperCase())}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addSecondary();
                    }
                  }}
                  className="w-28 px-2 py-1 text-xs font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={addSecondary}
                  disabled={!draft.trim()}
                  className="p-1 text-cyan-700 hover:bg-cyan-50 rounded disabled:opacity-40"
                  aria-label="Add secondary code"
                  title="Add secondary code"
                >
                  <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {(visibleErrors.length > 0 || warnings.length > 0) && (
        <ul className="space-y-0.5" aria-live="polite">
          {visibleErrors.map(message => (
            <li key={message} className="flex items-start gap-1 text-xs text-red-700">
              <Icon icon="solar:danger-circle-bold-duotone" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
              {message}
            </li>
          ))}
          {warnings.map(message => (
            <li key={message} className="flex items-start gap-1 text-xs text-amber-700">
              <Icon icon="solar:info-circle-bold-duotone" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
              {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Icd10CodeInput;
