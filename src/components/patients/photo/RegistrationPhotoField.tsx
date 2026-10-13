import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { PatientPhotoCapture } from './PatientPhotoCapture';

interface Props {
  value: Blob | null;
  onChange: (photo: Blob | null) => void;
  labelClassName: string;
}

const buttonClass = 'flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';

/**
 * The optional photo at registration (owner's decision, 13 Oct 2026): taken or chosen now, stored once the file is
 * saved (it needs the new file's number for its folder). Shown only once patients.photo_path exists.
 */
export const RegistrationPhotoField: React.FC<Props> = ({ value, onChange, labelClassName }) => {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="space-y-1 md:col-span-2">
      <span className={labelClassName}>Photo</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
          {preview ? (
            <img src={preview} alt="The patient's new photo" className="h-full w-full object-cover" />
          ) : (
            <Icon icon="solar:user-bold-duotone" className="h-8 w-8" aria-hidden="true" />
          )}
        </div>
        <PatientPhotoCapture
          idPrefix="registration-photo"
          onPhoto={onChange}
          onError={message => toast.error(message)}
          buttonClassName={buttonClass}
        />
        {value && (
          <button type="button" onClick={() => onChange(null)} className={buttonClass}>
            <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4 text-red-500" aria-hidden="true" />
            <span>Remove</span>
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">Optional. Helps the team recognise the patient at the desk.</p>
    </div>
  );
};
