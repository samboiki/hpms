import { useEffect, useState } from 'react';
import { loadIsDentalPractice } from '../../services/dental/dentalChartService';

/**
 * Whether a practice is a dental practice (isDentalPractice on practices.practice_type): the tooth chart, its tab and
 * its links appear for dental practices only. null while the type is being read; false without a practice or when
 * the type cannot be read, so nothing dental ever shows by mistake in a GP, specialist or optometry practice.
 */
export function useDentalPractice(practiceId: string | null | undefined): boolean | null {
  const [known, setKnown] = useState<{ practiceId: string; dental: boolean } | null>(null);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    void loadIsDentalPractice(practiceId).then(dental => {
      if (!cancelled) setKnown({ practiceId, dental });
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  if (!practiceId) return false;
  return known?.practiceId === practiceId ? known.dental : null;
}
