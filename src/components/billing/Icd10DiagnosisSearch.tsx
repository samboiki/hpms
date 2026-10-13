import React, { useId, useState } from 'react';
import { extractIcd10Codes } from '../../utils/billing/icd10';
import { addIcd10ToDiagnosis } from '../../utils/billing/icd10Master';
import Icd10SearchInput from './Icd10SearchInput';

interface Icd10DiagnosisSearchProps {
  /** The visit diagnosis as typed so far */
  diagnosis: string;
  onDiagnosisChange: (next: string) => void;
  disabled?: boolean;
}

/**
 * Under the visit diagnosis (parity E14): find a code in the medical aids' full ICD-10 list, by code or by words, and add
 * it to the diagnosis ("J06.9 Acute upper respiratory infection, unspecified"). The billing lines suggest the codes
 * written there and the problem list offers them; the first one becomes a line's main code, so options are marked for
 * that place until the diagnosis has a code.
 */
const Icd10DiagnosisSearch: React.FC<Icd10DiagnosisSearchProps> = ({ diagnosis, onDiagnosisChange, disabled = false }) => {
  const id = useId();
  const [text, setText] = useState('');

  return (
    <div className="mt-2">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600">
        Add an ICD-10 code
      </label>
      <Icd10SearchInput
        id={id}
        value={text}
        disabled={disabled}
        position={extractIcd10Codes(diagnosis).length === 0 ? 'main' : 'other'}
        placeholder="Code or words, e.g. J06.9 or sinusitis"
        onChange={setText}
        onPick={option => {
          onDiagnosisChange(addIcd10ToDiagnosis(diagnosis, option.code, option.entry?.description));
          setText('');
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-gray-100"
      />
    </div>
  );
};

export default Icd10DiagnosisSearch;
