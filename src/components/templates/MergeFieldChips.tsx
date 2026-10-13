import React from 'react';
import { MERGE_GROUP_LABELS, fieldToken, fieldsFor, type MergeField, type MergeFieldGroup, type TemplateUse } from '../../utils/templates/mergeFields';

interface MergeFieldChipsProps {
  use: TemplateUse;
  /** Puts the field where the cursor was in the field being written */
  onInsert: (token: string) => void;
  disabled?: boolean;
}

/**
 * The fields a template can use, by group, one tap each: staff never type {{...}} themselves. Only the fields that can
 * be filled where the template is used are offered (an SMS never gets a diagnosis or an ID number).
 */
export const MergeFieldChips: React.FC<MergeFieldChipsProps> = ({ use, onInsert, disabled = false }) => {
  const groups = new Map<MergeFieldGroup, MergeField[]>();
  for (const field of fieldsFor(use)) groups.set(field.group, [...(groups.get(field.group) ?? []), field]);
  return (
    <details open className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <summary className="cursor-pointer text-sm font-medium text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
        Insert a field
      </summary>
      <p className="mt-1 text-xs text-gray-600">Tap a field to put it where your cursor is. It is filled in for each patient.</p>
      <div className="mt-2 space-y-2">
        {[...groups.entries()].map(([group, fields]) => (
          <div key={group}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{MERGE_GROUP_LABELS[group]}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {fields.map(field => (
                <button
                  key={field.name}
                  type="button"
                  disabled={disabled}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => onInsert(fieldToken(field.name))}
                  title={fieldToken(field.name)}
                  aria-label={`Insert ${field.label}`}
                  className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
};

export default MergeFieldChips;
