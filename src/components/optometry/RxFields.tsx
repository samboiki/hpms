import React, { useState } from 'react';
import { Field } from '../stock/stockParts';
import { INPUT } from '../stock/stockUi';
import {
  EYE_LETTERS,
  EYE_NAMES,
  EYES,
  PRISM_BASES,
  PRISM_BASE_LABELS,
  type EyeDraft,
  type EyeSide,
  type PrismBase,
  type RxDraft,
  type RxDraftErrors,
  type RxKind
} from '../../utils/optometry/prescription';

interface RxFieldsProps {
  value: RxDraft;
  onChange: (next: RxDraft) => void;
  kind: RxKind;
  errors?: RxDraftErrors;
  disabled?: boolean;
}

const SMALL_INPUT = `${INPUT} px-2.5 py-2 text-right tabular-nums`;

/**
 * Both eyes of a prescription: sphere, cylinder, axis, add and vision for each eye, prism one tap away (it is rare),
 * base curve and diameter for contact lenses. Signs are typed (+1.25, -0.50; "pl" for plano), so the keyboard is a
 * text keyboard: phone number pads have no minus sign.
 */
const RxFields: React.FC<RxFieldsProps> = ({ value, onChange, kind, errors, disabled }) => {
  const hasPrism = EYES.some(side => value[side].prism.trim() !== '' || value[side].base !== '');
  const [showPrism, setShowPrism] = useState(hasPrism);
  const set = (side: EyeSide, eye: EyeDraft) => onChange(side === 'right' ? { ...value, right: eye } : { ...value, left: eye });
  const setText = (side: EyeSide, field: Exclude<keyof EyeDraft, 'base'>, text: string) => {
    const eye: EyeDraft = { ...value[side] };
    eye[field] = text;
    set(side, eye);
  };

  const dioptre = (side: EyeSide, field: 'sphere' | 'cylinder' | 'add', label: string, placeholder: string) => (
    <Field label={label} error={errors?.[side]?.[field]}>
      {props => (
        <input
          {...props}
          className={SMALL_INPUT}
          value={value[side][field]}
          onChange={event => setText(side, field, event.target.value)}
          placeholder={placeholder}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
        />
      )}
    </Field>
  );

  const plain = (side: EyeSide, field: 'axis' | 'baseCurve' | 'diameter' | 'prism', label: string, placeholder: string, mode: 'numeric' | 'decimal') => (
    <Field label={label} error={errors?.[side]?.[field]}>
      {props => (
        <input
          {...props}
          className={SMALL_INPUT}
          value={value[side][field]}
          onChange={event => setText(side, field, event.target.value)}
          placeholder={placeholder}
          inputMode={mode}
          autoComplete="off"
          disabled={disabled}
        />
      )}
    </Field>
  );

  return (
    <div className="space-y-3">
      {EYES.map(side => (
        <fieldset key={side} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3" disabled={disabled}>
          <legend className="px-1 text-sm font-semibold text-gray-800">
            {EYE_NAMES[side]} ({EYE_LETTERS[side]})
          </legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {dioptre(side, 'sphere', 'Sphere', 'pl')}
            {dioptre(side, 'cylinder', 'Cyl', '')}
            {plain(side, 'axis', 'Axis', '', 'numeric')}
            {dioptre(side, 'add', 'Add', '')}
            <Field label="Vision" error={errors?.[side]?.va}>
              {props => (
                <input
                  {...props}
                  className={`${INPUT} px-2.5 py-2`}
                  value={value[side].va}
                  onChange={event => setText(side, 'va', event.target.value)}
                  placeholder="6/6"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={disabled}
                />
              )}
            </Field>
            {kind === 'contact_lenses' && plain(side, 'baseCurve', 'Base curve', '8.6', 'decimal')}
            {kind === 'contact_lenses' && plain(side, 'diameter', 'Diameter', '14.2', 'decimal')}
            {kind === 'spectacles' && showPrism && plain(side, 'prism', 'Prism', '', 'decimal')}
            {kind === 'spectacles' && showPrism && (
              <Field label="Base" error={errors?.[side]?.base}>
                {props => (
                  <select
                    {...props}
                    className={`${INPUT} px-2.5 py-2`}
                    value={value[side].base}
                    onChange={event => set(side, { ...value[side], base: event.target.value as PrismBase | '' })}
                    disabled={disabled}
                  >
                    <option value="">None</option>
                    {PRISM_BASES.map(base => (
                      <option key={base} value={base}>
                        {PRISM_BASE_LABELS[base]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </div>
        </fieldset>
      ))}
      {kind === 'spectacles' && !showPrism && (
        <button
          type="button"
          onClick={() => setShowPrism(true)}
          className="text-sm font-medium text-cyan-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
          disabled={disabled}
        >
          Add a prism
        </button>
      )}
    </div>
  );
};

export default RxFields;
