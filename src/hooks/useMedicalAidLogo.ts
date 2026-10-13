import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { resolveMedicalAidLogo, type FundLogoEntry } from '../utils/medicalAidLogos';

let directory: Promise<FundLogoEntry[]> | null = null;

/**
 * The funds' logos (medical_aid_providers, the table the Patients page takes its logos from), read once per session
 * and shared by every logo on screen. When they cannot be read the logos fall back to the app's own images, until
 * the page is reloaded.
 */
export function loadFundLogos(): Promise<FundLogoEntry[]> {
  directory ??= (async () => {
    const { data, error } = await supabase.from('medical_aid_providers').select('name, short_name, medical_aid_reference, logo_url');
    if (error) throw new Error(error.message);
    return (data ?? []).map(row => ({ name: row.name, shortName: row.short_name, reference: row.medical_aid_reference, logoUrl: row.logo_url }));
  })().catch(error => {
    console.warn('Medical aid logos could not be loaded', error);
    return [];
  });
  return directory;
}

/** Reads the logos again next time (after OneHealth support changed a fund's logo on Administration > Medical aid funds) */
export function forgetFundLogos(): void {
  directory = null;
}

/** The logo of a medical aid named on a patient file or an invoice; null while loading or when it has none */
export function useMedicalAidLogo(name: string | null | undefined): string | null {
  const [funds, setFunds] = useState<readonly FundLogoEntry[]>([]);
  useEffect(() => {
    if (!name?.trim()) return;
    let live = true;
    void loadFundLogos().then(list => {
      if (live) setFunds(list);
    });
    return () => {
      live = false;
    };
  }, [name]);
  return useMemo(() => resolveMedicalAidLogo(name, funds), [name, funds]);
}
