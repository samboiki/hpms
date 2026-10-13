import { useEffect, useState } from 'react';
import { loadSmsRepliesLive } from '../components/communications/smsRepliesService';

/**
 * Whether the practice's SMS replies are collected (loadSmsRepliesLive: OneHealth support switches it on per practice).
 * null while it is read; false without a practice or when it cannot be read, so no screen ever promises that a
 * patient's reply will be seen when it will not.
 */
export function useSmsRepliesLive(practiceId: string | null | undefined): boolean | null {
  const [known, setKnown] = useState<{ practiceId: string; live: boolean } | null>(null);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    void loadSmsRepliesLive(practiceId).then(live => {
      if (!cancelled) setKnown({ practiceId, live });
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  if (!practiceId) return false;
  return known?.practiceId === practiceId ? known.live : null;
}
