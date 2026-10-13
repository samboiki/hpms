import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useMedicalAidLogo } from '../../hooks/useMedicalAidLogo';

const SIZES = { sm: 'h-6 w-8', md: 'h-8 w-10' } as const;

interface MedicalAidLogoProps {
  /** The fund as named on the patient file or the invoice; nothing is shown without one */
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  /**
   * True where the fund's name is not printed beside the logo: the name becomes its text for screen readers and its
   * tooltip. Beside the printed name the logo is decorative.
   */
  labelled?: boolean;
  className?: string;
}

/**
 * A medical aid's logo, the same picture the Patients page shows, wherever a fund is named (Finance's overview,
 * debtors and invoices). A fund without a logo, or a logo that does not load, shows a plain shield.
 */
export const MedicalAidLogo: React.FC<MedicalAidLogoProps> = ({ name, size = 'sm', labelled = false, className = '' }) => {
  const url = useMedicalAidLogo(name);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const label = name?.trim();
  if (!label) return null;
  const naming = labelled ? { role: 'img', 'aria-label': label, title: label } : { 'aria-hidden': true };
  return (
    <span className={`inline-flex flex-none items-center justify-center ${SIZES[size]} ${className}`} {...naming}>
      {url && url !== brokenUrl ? (
        <img src={url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" onError={() => setBrokenUrl(url)} />
      ) : (
        <Icon icon="solar:shield-plus-bold-duotone" className="h-5 w-5 text-gray-400" aria-hidden="true" />
      )}
    </span>
  );
};
