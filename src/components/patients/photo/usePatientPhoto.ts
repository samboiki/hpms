import { useEffect, useState } from 'react';
import { PATIENT_PHOTO_CHANGED, patientPhotoUrl } from './patientPhotoService';

/** The patient's photo link (null while loading, when there is none, or before photos are set up); follows changes */
export function usePatientPhoto(patientId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!patientId) return;
    let active = true;
    const load = () => {
      void patientPhotoUrl(patientId).then(next => {
        if (active) setUrl(next);
      });
    };
    load();
    const onChanged = (event: Event) => {
      if ((event as CustomEvent<string>).detail === patientId) load();
    };
    window.addEventListener(PATIENT_PHOTO_CHANGED, onChanged);
    return () => {
      active = false;
      window.removeEventListener(PATIENT_PHOTO_CHANGED, onChanged);
    };
  }, [patientId]);
  return url;
}
