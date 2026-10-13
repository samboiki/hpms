import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  MAX_SECONDARY_ICD10,
  icd10CodesOf,
  isValidIcd10Format,
  normalizeIcd10,
  validateIcd10Selection,
  type Icd10Selection
} from '../../utils/billing/icd10';
import { icd10ListProblems } from '../../utils/billing/icd10Master';
import { useIcd10Entries } from '../../hooks/useIcd10Search';
import Icd10SearchInput from './Icd10SearchInput';

interface Icd10CodeInputProps {
  value: Icd10Selection;
  onChange: (value: Icd10Selection) => void;
  disabled?: boolean;
  /** Shown above the inputs. */
  label?: string;
  /** Hide the "required" error until the user has interacted (e.g. while a line is new). */
  showRequiredError?: boolean;
  /** False where a code is optional (a private patient's invoice line): no "required" mark. */
  required?: boolean;
  /** Codes offered first in the search (the line's suggested codes); the practice's usual codes follow */
  suggestedCodes?: readonly string[];
}

/** A typed code tidied ("j069" -> "J06.9") when it has the ICD-10 shape; words that were searched for stay as typed. */
const tidy = (text: string): string => {
  const code = normalizeIcd10(text);
  return isValidIcd10Format(code) ? code : text.trim();
};

/**
 * ICD-10 entry for one service line: one primary code and up to MAX_SECONDARY_ICD10 (4) more, the 5 a claim line
 * carries, chosen from the medical aids' full list (Icd10SearchInput: by code or by words) or typed freely. Codes are
 * tidied on blur and checked as they are entered: their shape, and what the list says (a category heading, an asterisk
 * code first, not a main diagnosis, discontinued, not in the list), the same checks claim review makes.
 */
const Icd10CodeInput: React.FC<Icd10CodeInputProps> = ({
  value,
  onChange,
  disabled = false,
  label = 'ICD-10 diagnosis',
  showRequiredError = true,
  required = true,
  suggestedCodes
}) => {
  const primaryId = useId();
  const secondaryId = useId();
  const messagesId = useId();
  const [draft, setDraft] = useState('');
  const list = useIcd10Entries(icd10CodesOf(value));
  const { errors, warnings } = validateIcd10Selection(value);
  const listProblems = list.status === 'ready' ? icd10ListProblems([value.primary, ...value.secondary], list.entries) : [];
  const allErrors = [...errors, ...listProblems.filter(problem => problem.severity === 'error').map(problem => problem.message)];
  const allWarnings = [...warnings, ...listProblems.filter(problem => problem.severity === 'warning').map(problem => problem.message)];
  const visibleErrors = showRequiredError || value.primary.trim()
    ? allErrors
    : allErrors.filter(message => !message.includes('required'));
  const descriptionOf = (code: string): string | null => list.entries.get(normalizeIcd10(code))?.description ?? null;
  const primaryDescription = descriptionOf(value.primary);
  const canAddSecondary = !disabled && value.secondary.length < MAX_SECONDARY_ICD10;
  const draftCode = normalizeIcd10(draft);
  const hasMessages = visibleErrors.length > 0 || allWarnings.length > 0;

  const addSecondary = (code: string) => {
    if (!isValidIcd10Format(code)) return;
    onChange({ ...value, secondary: [...value.secondary, code] });
    setDraft('');
  };

  const removeSecondary = (index: number) => {
    onChange({ ...value, secondary: value.secondary.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2">
        <div className="sm:w-56">
          <label htmlFor={primaryId} className="block text-xs font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-600">*</span>}
          </label>
          <Icd10SearchInput
            id={primaryId}
            value={value.primary}
            disabled={disabled}
            position="main"
            suggestedCodes={suggestedCodes}
            onChange={text => onChange({ ...value, primary: text.toUpperCase() })}
            onPick={option => onChange({ ...value, primary: option.code })}
            onBlur={() => {
              const tidied = tidy(value.primary);
              if (tidied !== value.primary) onChange({ ...value, primary: tidied });
            }}
            ariaInvalid={visibleErrors.length > 0}
            ariaDescribedBy={hasMessages ? messagesId : undefined}
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
                title={descriptionOf(code) ?? undefined}
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
                <Icd10SearchInput
                  id={secondaryId}
                  value={draft}
                  position="other"
                  suggestedCodes={suggestedCodes}
                  placeholder="Add code or words"
                  onChange={text => setDraft(text.toUpperCase())}
                  onPick={option => addSecondary(option.code)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addSecondary(draftCode);
                    }
                  }}
                  className="w-40 px-2 py-1 text-xs font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => addSecondary(draftCode)}
                  disabled={!isValidIcd10Format(draftCode)}
                  className="p-1 text-cyan-700 hover:bg-cyan-50 rounded disabled:opacity-40"
                  aria-label="Add secondary code"
                  title="Add secondary code"
                >
                  <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                </button>
              </span>
            )}
            {!disabled && !canAddSecondary && (
              <span className="text-xs text-gray-500">A claim line carries {MAX_SECONDARY_ICD10 + 1} codes; put the ones that matter most first.</span>
            )}
          </div>
        </div>
      </div>

      {hasMessages && (
        <ul id={messagesId} className="space-y-0.5" aria-live="polite">
          {visibleErrors.map(message => (
            <li key={message} className="flex items-start gap-1 text-xs text-red-700">
              <Icon icon="solar:danger-circle-bold-duotone" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
              {message}
            </li>
          ))}
          {allWarnings.map(message => (
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
