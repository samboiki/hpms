import React, { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { claimMemberPreview } from '../../../utils/patients/medicalAidMember';

interface MainMemberFieldsProps {
  surnameField: UseFormRegisterReturn;
  initialsField: UseFormRegisterReturn;
  idNumberField: UseFormRegisterReturn;
  /** Current values, for the claim preview */
  surname: string | null | undefined;
  initials: string | null | undefined;
  inputClassName: string;
  labelClassName: string;
}

/**
 * The main member's surname, initials and ID number for a spouse or child on a medical aid, with how
 * the fund will see the member on a claim (claims for dependants go out under the main member's name).
 */
export const MainMemberFields: React.FC<MainMemberFieldsProps> = ({
  surnameField,
  initialsField,
  idNumberField,
  surname,
  initials,
  inputClassName,
  labelClassName
}) => {
  const baseId = useId();
  const preview = claimMemberPreview({ surname: surname ?? '', initials: initials ?? '' });
  return (
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
      <p className="md:col-span-3 text-sm text-gray-700">Main member, as printed on the medical aid card.</p>
      <div className="space-y-1">
        <label htmlFor={`${baseId}-surname`} className={labelClassName}>
          Main member surname
        </label>
        <input id={`${baseId}-surname`} type="text" autoComplete="off" className={inputClassName} placeholder="e.g. Shilongo" {...surnameField} />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${baseId}-initials`} className={labelClassName}>
          Initials
        </label>
        <input
          id={`${baseId}-initials`}
          type="text"
          autoComplete="off"
          maxLength={8}
          className={`${inputClassName} uppercase`}
          placeholder="e.g. JN"
          {...initialsField}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${baseId}-id`} className={labelClassName}>
          Main member ID number
        </label>
        <input id={`${baseId}-id`} type="text" autoComplete="off" className={inputClassName} {...idNumberField} />
      </div>
      {preview && (
        <p className="md:col-span-3 text-xs text-gray-600">
          On claims the member is <span className="font-mono font-semibold text-gray-800">{preview}</span>
        </p>
      )}
    </div>
  );
};

interface DependantCodeInputProps {
  field: UseFormRegisterReturn;
  error?: string | null;
  inputClassName: string;
  labelClassName: string;
}

/** The dependant code from the card (shown only once the database has the column). */
export const DependantCodeInput: React.FC<DependantCodeInputProps> = ({ field, error, inputClassName, labelClassName }) => {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClassName}>
        Dependant code <span className="font-normal text-gray-500">(on the card next to the name, e.g. 01)</span>
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        inputMode="numeric"
        maxLength={3}
        className={inputClassName}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...field}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default MainMemberFields;
