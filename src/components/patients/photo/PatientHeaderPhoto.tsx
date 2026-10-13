import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { currentPracticeId } from '../../../services/recordFiles';
import { usePatientPhotoColumn } from '../../forms/patientExtrasColumns';
import { usePatientPhoto } from './usePatientPhoto';
import { PatientPhotoCapture } from './PatientPhotoCapture';
import { removePatientPhoto, savePatientPhoto } from './patientPhotoService';

interface Props {
  patientId: string | undefined;
  firstName?: string;
  lastName?: string;
}

const initialsOf = (firstName?: string, lastName?: string) =>
  `${firstName?.trim()?.[0] ?? ''}${lastName?.trim()?.[0] ?? ''}`.toUpperCase() || '?';

/**
 * The patient file header's photo (owner's decision, 13 Oct 2026; parity A12): the photo, or the initials, in the
 * header's own glass tile; a tap offers Take photo, Upload photo and Remove. Not shown until patients.photo_path exists.
 */
export const PatientHeaderPhoto: React.FC<Props> = ({ patientId, firstName, lastName }) => {
  const available = usePatientPhotoColumn();
  const url = usePatientPhoto(available ? patientId : null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!available || !patientId) return null;

  const save = async (photo: Blob) => {
    setSaving(true);
    try {
      await savePatientPhoto({ practiceId: currentPracticeId(), patientId, photo });
      toast.success('Photo saved');
      setOpen(false);
    } catch (error) {
      console.error('Could not save the patient photo:', error);
      toast.error('The photo was not saved. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await removePatientPhoto(patientId);
      toast.success('Photo removed');
      setOpen(false);
    } catch (error) {
      console.error('Could not remove the patient photo:', error);
      toast.error('The photo was not removed. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const menuButton = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50';
  return (
    <div ref={wrapper} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="group relative block h-16 w-16 overflow-hidden rounded-xl bg-white/20 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label={url ? 'Change or remove the patient photo' : 'Add a patient photo'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xl font-bold">{initialsOf(firstName, lastName)}</span>
        )}
        <span className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-purple-600 shadow-sm">
          <Icon icon="solar:camera-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-2 w-48 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-black/5">
          <PatientPhotoCapture
            idPrefix={`patient-photo-${patientId}`}
            onPhoto={photo => void save(photo)}
            onError={message => toast.error(message)}
            disabled={saving}
            buttonClassName={menuButton}
          />
          {url && (
            <button type="button" onClick={() => void remove()} disabled={saving} className={menuButton}>
              <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4 text-red-500" aria-hidden="true" />
              <span>Remove photo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
