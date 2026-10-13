import React, { useState } from 'react';
import { Field } from '../stock/stockParts';
import { INPUT, QUIET } from '../stock/stockUi';
import { EYES, EYE_LETTERS, EYE_NAMES, type EyeSide } from '../../utils/optometry/prescription';
import {
  CL_LENS_TYPES,
  CL_LENS_TYPE_LABELS,
  FAMILY_FLAGS,
  FAMILY_FLAG_LABELS,
  FINDING_LABELS,
  FIT_ASPECTS,
  FIT_ASPECT_LABELS,
  FIT_VALUES,
  FIT_VALUE_LABELS,
  FUNDUS_METHODS,
  FUNDUS_METHOD_LABELS,
  HEALTH_FLAGS,
  HEALTH_FLAG_LABELS,
  HISTORY_LIMITS,
  PART_LABELS,
  PART_STRUCTURES,
  STRUCTURE_LABELS,
  SYMPTOMS,
  SYMPTOM_LABELS,
  cornealCylinder,
  markPartNormal,
  parseKReading,
  partSummary,
  toggleChoice,
  validateKEye,
  type ClFitDraft,
  type ClFitErrors,
  type ClLensType,
  type EyePart,
  type Finding,
  type FundusMethod,
  type HistoryDraft,
  type HistoryErrors,
  type KEyeDraft,
  type KeratometryDraft,
  type KeratometryErrors,
  type OcularDraft,
  type OcularErrors,
  type Structure
} from '../../utils/optometry/examParts';

/**
 * The full eye exam's parts inside the visit's Eye exam section (VisitEyeExamPanel): the case history, keratometry,
 * the health of the front and back of the eye, and the contact-lens fit. Each part looks like the section's own
 * fieldsets (the same labels, boxes and choice pills).
 */

const pill = (active: boolean) =>
  `inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${active ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-700'}`;
const CHECK = 'h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500';
const LEGEND = 'mb-2 text-sm font-semibold text-gray-800';
const SUBLABEL = 'mb-1.5 block text-sm font-medium text-gray-700';

/** Tick boxes as pills: any number may be ticked */
function ChoicePills<T extends string>({ label, options, labels, chosen, disabled, onChange }: {
  label: string;
  options: readonly T[];
  labels: Readonly<Record<T, string>>;
  chosen: readonly T[];
  disabled: boolean;
  onChange: (next: T[]) => void;
}) {
  return (
    <div>
      <p className={SUBLABEL}>{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map(option => (
          <label key={option} className={pill(chosen.includes(option))}>
            <input type="checkbox" className={CHECK} checked={chosen.includes(option)} disabled={disabled} onChange={() => onChange(toggleChoice(chosen, option, options))} />
            {labels[option]}
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Case history
// ---------------------------------------------------------------------------------------------------

export const CaseHistoryFields: React.FC<{ value: HistoryDraft; errors?: HistoryErrors; disabled: boolean; onChange: (next: HistoryDraft) => void }> = ({
  value,
  errors,
  disabled,
  onChange
}) => {
  const set = (patch: Partial<HistoryDraft>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="space-y-3">
      <legend className={LEGEND}>Case history</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Why the patient came" error={errors?.reason} className="sm:col-span-2">
          {props => <input {...props} className={`${INPUT} px-2.5 py-2`} value={value.reason} maxLength={HISTORY_LIMITS.reason} placeholder="Routine check, blurred reading..." disabled={disabled} onChange={event => set({ reason: event.target.value })} />}
        </Field>
        <Field label="Last eye test" error={errors?.lastTest}>
          {props => <input {...props} className={`${INPUT} px-2.5 py-2`} value={value.lastTest} maxLength={HISTORY_LIMITS.lastTest} placeholder="About 2 years ago" disabled={disabled} onChange={event => set({ lastTest: event.target.value })} />}
        </Field>
      </div>
      <ChoicePills label="Symptoms" options={SYMPTOMS} labels={SYMPTOM_LABELS} chosen={value.symptoms} disabled={disabled} onChange={symptoms => set({ symptoms })} />
      <ChoicePills label="General health" options={HEALTH_FLAGS} labels={HEALTH_FLAG_LABELS} chosen={value.health} disabled={disabled} onChange={health => set({ health })} />
      <Field label="Medicines and other health notes (optional)" error={errors?.healthNote}>
        {props => <input {...props} className={INPUT} value={value.healthNote} maxLength={HISTORY_LIMITS.healthNote} disabled={disabled} onChange={event => set({ healthNote: event.target.value })} />}
      </Field>
      <Field label="Eye history (optional)" error={errors?.eye} hint="Earlier eye problems, injuries, surgery, glasses or contact lenses">
        {props => <textarea {...props} rows={2} className={INPUT} value={value.eye} maxLength={HISTORY_LIMITS.eye} disabled={disabled} onChange={event => set({ eye: event.target.value })} />}
      </Field>
      <ChoicePills label="Eye conditions in the family" options={FAMILY_FLAGS} labels={FAMILY_FLAG_LABELS} chosen={value.family} disabled={disabled} onChange={family => set({ family })} />
      <Field label="Work, screens and driving (optional)" error={errors?.needs}>
        {props => <input {...props} className={INPUT} value={value.needs} maxLength={HISTORY_LIMITS.needs} placeholder="Drives at night, 8 hours on screens" disabled={disabled} onChange={event => set({ needs: event.target.value })} />}
      </Field>
    </fieldset>
  );
};

// ---------------------------------------------------------------------------------------------------
// Keratometry
// ---------------------------------------------------------------------------------------------------

/** "= 43.27 D" under a reading typed in mm, so the optometrist sees what is kept */
const kHint = (text: string): string | undefined => {
  const parsed = parseKReading(text);
  return parsed.ok && parsed.fromMm && parsed.dioptres !== null ? `= ${parsed.dioptres.toFixed(2)} D` : undefined;
};

export const KeratometryFields: React.FC<{ value: KeratometryDraft; errors?: KeratometryErrors; disabled: boolean; onChange: (next: KeratometryDraft) => void }> = ({
  value,
  errors,
  disabled,
  onChange
}) => {
  const setEye = (side: EyeSide, patch: Partial<KEyeDraft>) => onChange({ ...value, [side]: { ...value[side], ...patch } });
  return (
    <fieldset>
      <legend className={LEGEND}>Keratometry</legend>
      <p className="mb-2 text-xs text-gray-500">The flat and steep readings with their axes, in dioptres or as the radius in mm.</p>
      <div className="space-y-3">
        {EYES.map(side => {
          const eye = value[side];
          const eyeErrors = errors?.[side];
          const checked = validateKEye(eye);
          const cylinder = checked.ok && checked.reading ? cornealCylinder(checked.reading) : null;
          const input = (field: keyof KEyeDraft, label: string, numeric: boolean) => (
            <Field key={field} label={`${EYE_LETTERS[side]} ${label}`} error={eyeErrors?.[field]} hint={numeric ? undefined : kHint(eye[field])}>
              {props => (
                <input
                  {...props}
                  className={`${INPUT} px-2.5 py-2 text-right tabular-nums`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={eye[field]}
                  placeholder={numeric ? '180' : '43.25'}
                  disabled={disabled}
                  onChange={event => setEye(side, { [field]: event.target.value } as Partial<KEyeDraft>)}
                />
              )}
            </Field>
          );
          return (
            <div key={side}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={`Keratometry, ${EYE_NAMES[side].toLowerCase()}`}>
                {input('flat', 'flat K', false)}
                {input('flatAxis', 'flat axis', true)}
                {input('steep', 'steep K', false)}
                {input('steepAxis', 'steep axis', true)}
              </div>
              {cylinder && (
                <p className="mt-1 text-xs text-gray-600">
                  {EYE_NAMES[side]}: {cylinder.power > 0 ? `corneal cylinder ${cylinder.power.toFixed(2)} D at ${cylinder.axis}` : 'spherical cornea'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
};

// ---------------------------------------------------------------------------------------------------
// Ocular health
// ---------------------------------------------------------------------------------------------------

const FINDINGS: readonly Finding[] = ['normal', 'abnormal'];

const findingButton = (active: boolean, finding: Finding) =>
  `rounded-full border px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    active ? (finding === 'abnormal' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-cyan-300 bg-cyan-50 text-cyan-900') : 'border-gray-200 text-gray-700 hover:bg-gray-50'
  }`;

export const OcularHealthFields: React.FC<{ value: OcularDraft; errors?: OcularErrors; disabled: boolean; onChange: (next: OcularDraft) => void }> = ({
  value,
  errors,
  disabled,
  onChange
}) => {
  const hasAbnormal = (part: EyePart) => PART_STRUCTURES[part].some(structure => value.findings[structure].right === 'abnormal' || value.findings[structure].left === 'abnormal');
  const [open, setOpen] = useState<Record<EyePart, boolean>>({ front: hasAbnormal('front'), back: hasAbnormal('back') });
  const setFinding = (structure: Structure, patch: Partial<OcularDraft['findings'][Structure]>) =>
    onChange({ ...value, findings: { ...value.findings, [structure]: { ...value.findings[structure], ...patch } } });

  return (
    <fieldset className="space-y-3">
      <legend className={LEGEND}>Eye health</legend>
      {(['front', 'back'] as const).map(part => {
        const shown = open[part] || PART_STRUCTURES[part].some(structure => Boolean(errors?.findings?.[structure]));
        return (
          <div key={part} className="rounded-xl border border-gray-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{PART_LABELS[part]}</p>
                <p className="text-xs text-gray-500">{partSummary(value.findings, part)}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" className={QUIET} disabled={disabled} onClick={() => onChange(markPartNormal(value, part))}>
                  All normal
                </button>
                <button type="button" className={QUIET} aria-expanded={shown} onClick={() => setOpen(current => ({ ...current, [part]: !shown }))}>
                  {shown ? 'Hide the parts' : 'Each part'}
                </button>
              </div>
            </div>
            {shown && (
              <ul className="mt-2 divide-y divide-gray-100">
                {PART_STRUCTURES[part].map(structure => {
                  const finding = value.findings[structure];
                  const abnormal = finding.right === 'abnormal' || finding.left === 'abnormal';
                  return (
                    <li key={structure} className="space-y-1.5 py-2">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <span className="w-36 text-sm text-gray-800">{STRUCTURE_LABELS[structure]}</span>
                        {EYES.map(side => (
                          <span key={side} className="inline-flex items-center gap-1.5" role="group" aria-label={`${STRUCTURE_LABELS[structure]}, ${EYE_NAMES[side].toLowerCase()}`}>
                            <abbr title={EYE_NAMES[side]} className="text-xs font-semibold text-gray-500 no-underline">{EYE_LETTERS[side]}</abbr>
                            {FINDINGS.map(option => (
                              <button
                                key={option}
                                type="button"
                                className={findingButton(finding[side] === option, option)}
                                aria-pressed={finding[side] === option}
                                disabled={disabled}
                                onClick={() => setFinding(structure, { [side]: finding[side] === option ? '' : option } as Partial<OcularDraft['findings'][Structure]>)}
                              >
                                {FINDING_LABELS[option]}
                              </button>
                            ))}
                          </span>
                        ))}
                      </div>
                      {(abnormal || errors?.findings?.[structure]) && (
                        <Field label={`What you saw: ${STRUCTURE_LABELS[structure].toLowerCase()}`} error={errors?.findings?.[structure]}>
                          {props => <input {...props} className={INPUT} value={finding.note} maxLength={200} disabled={disabled} onChange={event => setFinding(structure, { note: event.target.value })} />}
                        </Field>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['cdRight', 'cdLeft'] as const).map(field => (
          <Field key={field} label={`${field === 'cdRight' ? EYE_LETTERS.right : EYE_LETTERS.left} cup-to-disc`} error={errors?.[field]}>
            {props => (
              <input {...props} className={`${INPUT} px-2.5 py-2 text-right tabular-nums`} inputMode="decimal" placeholder="0.3" value={value[field]} disabled={disabled} onChange={event => onChange({ ...value, [field]: event.target.value })} />
            )}
          </Field>
        ))}
        <Field label="How the back was seen" className="col-span-2">
          {props => (
            <select {...props} className={`${INPUT} px-2.5 py-2`} value={value.fundusMethod} disabled={disabled} onChange={event => onChange({ ...value, fundusMethod: event.target.value as FundusMethod | '' })}>
              <option value="">Not said</option>
              {FUNDUS_METHODS.map(method => <option key={method} value={method}>{FUNDUS_METHOD_LABELS[method]}</option>)}
            </select>
          )}
        </Field>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" className={CHECK} checked={value.dilated} disabled={disabled} onChange={event => onChange({ ...value, dilated: event.target.checked })} />
        Pupils dilated
      </label>
    </fieldset>
  );
};

// ---------------------------------------------------------------------------------------------------
// The contact-lens fit
// ---------------------------------------------------------------------------------------------------

export const ContactLensFitFields: React.FC<{ value: ClFitDraft; errors?: ClFitErrors; disabled: boolean; onChange: (next: ClFitDraft) => void }> = ({
  value,
  errors,
  disabled,
  onChange
}) => {
  const set = (patch: Partial<ClFitDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Lens type" className="col-span-2 sm:col-span-1">
          {props => (
            <select {...props} className={`${INPUT} px-2.5 py-2`} value={value.lensType} disabled={disabled} onChange={event => set({ lensType: event.target.value as ClLensType | '' })}>
              <option value="">Choose</option>
              {CL_LENS_TYPES.map(type => <option key={type} value={type}>{CL_LENS_TYPE_LABELS[type]}</option>)}
            </select>
          )}
        </Field>
        {(['overRight', 'overLeft'] as const).map(field => (
          <Field key={field} label={`${field === 'overRight' ? EYE_LETTERS.right : EYE_LETTERS.left} over-refraction`} error={errors?.[field]}>
            {props => <input {...props} className={`${INPUT} px-2.5 py-2 text-right tabular-nums`} inputMode="decimal" placeholder="+0.25" value={value[field]} disabled={disabled} onChange={event => set({ [field]: event.target.value } as Partial<ClFitDraft>)} />}
          </Field>
        ))}
        {(['vaRight', 'vaLeft'] as const).map(field => (
          <Field key={field} label={`${field === 'vaRight' ? EYE_LETTERS.right : EYE_LETTERS.left} vision with the lens`} error={errors?.[field]}>
            {props => <input {...props} className={`${INPUT} px-2.5 py-2`} placeholder="6/6" autoComplete="off" value={value[field]} disabled={disabled} onChange={event => set({ [field]: event.target.value } as Partial<ClFitDraft>)} />}
          </Field>
        ))}
      </div>
      <div>
        <p className={SUBLABEL}>How each lens fits</p>
        <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
          <span />
          {EYES.map(side => <span key={side} className="text-xs font-semibold text-gray-500">{EYE_NAMES[side]}</span>)}
          {FIT_ASPECTS.map(aspect => (
            <React.Fragment key={aspect}>
              <span className="text-sm text-gray-800">{FIT_ASPECT_LABELS[aspect]}</span>
              {EYES.map(side => (
                <select
                  key={side}
                  aria-label={`${FIT_ASPECT_LABELS[aspect]}, ${EYE_NAMES[side].toLowerCase()}`}
                  className={`${INPUT} px-2 py-1.5`}
                  value={value[side][aspect]}
                  disabled={disabled}
                  onChange={event => set({ [side]: { ...value[side], [aspect]: event.target.value } } as Partial<ClFitDraft>)}
                >
                  <option value="">Not judged</option>
                  {FIT_VALUES[aspect].map(option => <option key={option} value={option}>{FIT_VALUE_LABELS[aspect][option]}</option>)}
                </select>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
