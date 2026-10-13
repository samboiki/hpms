import { useEffect, useState } from 'react';
import { loadIsOptometryPractice } from '../../services/optometry/optometryService';

/**
 * Whether a practice is an optometry practice (isOptometryPractice on practices.practice_type): the Eyes tab, the
 * visit's eye exam and everything optometry appear for optometry practices only. null while the type is being read;
 * false without a practice or when the type cannot be read, so nothing optometry ever shows in a GP, specialist or
 * dental practice by mistake.
 */
export function useOptometryPractice(practiceId: string | null | undefined): boolean | null {
  const [known, setKnown] = useState<{ practiceId: string; optometry: boolean } | null>(null);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    void loadIsOptometryPractice(practiceId).then(optometry => {
      if (!cancelled) setKnown({ practiceId, optometry });
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  if (!practiceId) return false;
  return known?.practiceId === practiceId ? known.optometry : null;
}
