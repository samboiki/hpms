import React, { useState } from 'react';
import { usePatientPhoto } from './usePatientPhoto';

interface Props {
  patientId: string | null | undefined;
  /** Size and shape of the photo: the classes of what it replaces (e.g. "w-12 h-12 rounded-full") */
  className: string;
  /** What shows when there is no photo: the initials or icon that were there before */
  children?: React.ReactNode;
}

/**
 * The patient's photo where their initials (or an icon) show (owner's decision, 13 Oct 2026); without a photo,
 * exactly what was there before.
 */
export const PatientAvatar: React.FC<Props> = ({ patientId, className, children = null }) => {
  const url = usePatientPhoto(patientId);
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return <>{children}</>;
  return <img src={url} alt="" className={`${className} object-cover flex-none`} onError={() => setFailed(url)} loading="lazy" decoding="async" />;
};
