import React, { useEffect, useId, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  CODE_RULE_LIMITS,
  checkCodeRulesDraft,
  describePlaceOfService,
  draftOfCodeRules,
  type CodeRules,
  type CodeRulesDraft
} from '../../utils/billing/codeRules';
import { MATERIAL_FACTOR_PERCENT } from '../../utils/billing/pricing';
import { INFECTION_CONTROL_CODE, MATERIAL_FACTOR_CODE, isRestorationCode } from '../../utils/billing/tariffRules';
import { saveCodeRules } from '../../services/codeRulesService';

interface CodeRulesFormProps {
  practiceId: string;
  code: string;
  description: string;
  /** The code's rules now (null: none) */
  rules: CodeRules | null;
  /** Dental practices: 8346 and 8109 come from the app's dental rules */
  dental: boolean;
  /** The codes billed on the date shown, to say when a linked code has no price */
  billableCodes: ReadonlySet<string>;
  /** A code's description, shown next to a linked code */
  describe: (code: string) => string | null;
  /** "Do not claim" is the code's "Who pays: patient pays all"; absent while who pays cannot be changed */
  doNotClaim?: { value: boolean; onChange: (next: boolean) => Promise<void> };
  onCancel: () => void;
  onSaved: (rules: CodeRules) => void;
}

const INPUT_LOOK =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#01b9d4] disabled:bg-gray-100';
const INPUT = `w-full ${INPUT_LOOK}`;
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';
const CHECKBOX = 'mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500';

/**
 * What happens when staff bill one code (parity E9, D13, O2), for the practice's own use: the fund's authorisation
 * number, lab work, time, "do not claim", a recall after some months, a default place of service and the codes it
 * brings with it. Every rule acts on the visit's Billing tab (codeRules.ts); other practices are not affected.
 */
const CodeRulesForm: React.FC<CodeRulesFormProps> = ({
  practiceId,
  code,
  description,
  rules,
  dental,
  billableCodes,
  describe,
  doNotClaim,
  onCancel,
  onSaved
}) => {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  // Opened from a row further down the list: bring the form into view (no animation)
  useEffect(() => {
    formRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  const [draft, setDraft] = useState<CodeRulesDraft>(() => {
    const start = draftOfCodeRules(rules);
    return start.linkedCodes.length > 0 ? start : { ...start, linkedCodes: [{ code: '', quantity: '1' }] };
  });
  const [noClaim, setNoClaim] = useState(doNotClaim?.value ?? false);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const checked = checkCodeRulesDraft(code, draft, { dental, billableCodes });
  const errors = checked.ok ? [] : checked.errors;
  const warnings = checked.ok ? checked.warnings : [];
  const place = draft.placeOfService.trim();
  const update = (changes: Partial<CodeRulesDraft>) => setDraft(current => ({ ...current, ...changes }));
  const updateLink = (index: number, changes: Partial<{ code: string; quantity: string }>) =>
    setDraft(current => ({ ...current, linkedCodes: current.linkedCodes.map((link, at) => (at === index ? { ...link, ...changes } : link)) }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!checked.ok) return;
    setSaving(true);
    try {
      await saveCodeRules(practiceId, code, checked.rules);
      if (doNotClaim && noClaim !== doNotClaim.value) await doNotClaim.onChange(noClaim);
      toast.success(`${code} saved: staff see these rules when they bill it.`);
      onSaved(checked.rules);
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The rules could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={save} className="space-y-4 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 sm:p-5" aria-labelledby={`${id}-title`} noValidate>
      <div className="flex items-start gap-2">
        <Icon icon="solar:tuning-2-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#01b9d4]" aria-hidden="true" />
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="text-base font-semibold text-gray-900">
            When {code} is billed
          </h3>
          <p className="text-sm text-gray-600">
            {description ? `${description}. ` : ''}These apply to every visit of your practice; other practices are not affected.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" className={CHECKBOX} checked={draft.needsAuthorisation} onChange={event => update({ needsAuthorisation: event.target.checked })} />
          <span>
            Needs the fund&apos;s authorisation number
            <span className="block text-xs text-gray-500">A medical aid line without one is flagged</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" className={CHECKBOX} checked={draft.labWork} onChange={event => update({ labWork: event.target.checked })} />
          <span>
            Includes lab work
            <span className="block text-xs text-gray-500">The line asks for the lab and its slip number</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" className={CHECKBOX} checked={draft.timeBased} onChange={event => update({ timeBased: event.target.checked })} />
          <span>
            Charged by time
            <span className="block text-xs text-gray-500">The line asks how long it took; claims send those minutes</span>
          </span>
        </label>
        {doNotClaim && (
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className={CHECKBOX} checked={noClaim} onChange={event => setNoClaim(event.target.checked)} />
            <span>
              Do not claim
              <span className="block text-xs text-gray-500">The patient pays all of it (as Who pays)</span>
            </span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={LABEL}>Recall after (months)</span>
          <input
            className={INPUT}
            value={draft.recallMonths}
            onChange={event => update({ recallMonths: event.target.value.replace(/[^0-9]/g, '') })}
            inputMode="numeric"
            maxLength={2}
            placeholder="No recall"
            aria-describedby={`${id}-recall-hint`}
          />
          <span id={`${id}-recall-hint`} className="mt-1 block text-xs text-gray-500">
            {draft.recallMonths
              ? `When it is invoiced, staff are offered a recall ${draft.recallMonths} month${draft.recallMonths === '1' ? '' : 's'} after the visit.`
              : `Empty: no recall. Or 1 to ${CODE_RULE_LIMITS.recallMonthsMax}: staff are offered a recall that many months after the visit.`}
          </span>
        </label>
        <label className="block sm:col-span-1 lg:col-span-2">
          <span className={LABEL}>Recall for</span>
          <input
            className={INPUT}
            value={draft.recallReason}
            onChange={event => update({ recallReason: event.target.value })}
            maxLength={120}
            disabled={!draft.recallMonths}
            placeholder={description || 'e.g. 6-monthly check-up'}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Place of service</span>
          <input
            className={`${INPUT} font-mono`}
            value={draft.placeOfService}
            onChange={event => update({ placeOfService: event.target.value.replace(/[^0-9]/g, '') })}
            inputMode="numeric"
            maxLength={2}
            placeholder="e.g. 11"
            aria-describedby={`${id}-place-hint`}
          />
          <span id={`${id}-place-hint`} className="mt-1 block text-xs text-gray-500">
            {place ? describePlaceOfService(place) : "Fills the visit's place of service when it has none"}
          </span>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Codes it brings with it</legend>
        <p className="text-xs text-gray-500">Added to the visit with {code}; staff can remove any before saving.</p>
        <ul className="space-y-2">
          {draft.linkedCodes.map((link, index) => {
            const known = link.code.trim() ? describe(link.code.trim().toUpperCase()) : null;
            return (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <input
                  className={`${INPUT_LOOK} w-28 font-mono`}
                  value={link.code}
                  onChange={event => updateLink(index, { code: event.target.value.toUpperCase() })}
                  maxLength={10}
                  placeholder="Code"
                  aria-label={`Linked code ${index + 1}`}
                />
                <input
                  className={`${INPUT_LOOK} w-20`}
                  value={link.quantity}
                  onChange={event => updateLink(index, { quantity: event.target.value.replace(/[^0-9]/g, '') })}
                  inputMode="numeric"
                  maxLength={2}
                  aria-label={`Quantity of linked code ${index + 1}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{known ?? ''}</span>
                <button
                  type="button"
                  onClick={() => setDraft(current => ({ ...current, linkedCodes: current.linkedCodes.filter((_, at) => at !== index) }))}
                  aria-label={`Remove linked code ${link.code || index + 1}`}
                  className="rounded text-xs font-medium text-red-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        {draft.linkedCodes.length < CODE_RULE_LIMITS.linkedMax && (
          <button
            type="button"
            onClick={() => setDraft(current => ({ ...current, linkedCodes: [...current.linkedCodes, { code: '', quantity: '1' }] }))}
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Add a linked code
          </button>
        )}
        {dental && (
          <p className="text-xs text-gray-500">
            {isRestorationCode(code) ? `Built in: ${MATERIAL_FACTOR_CODE} (material, ${MATERIAL_FACTOR_PERCENT}% of this code's price) follows it. ` : ''}
            {INFECTION_CONTROL_CODE} (infection control) is added once per visit by the app.
          </p>
        )}
        {warnings.length > 0 && (
          <ul className="space-y-1 text-xs text-amber-800" role="status">
            {warnings.map(warning => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </fieldset>

      {attempted && errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {errors.map(error => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-medium text-white hover:bg-[#019bb3] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <Icon icon="solar:diskette-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Saving...' : 'Save the rules'}
        </button>
      </div>
    </form>
  );
};

export default CodeRulesForm;
