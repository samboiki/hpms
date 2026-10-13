import { useCallback, useEffect, useState } from 'react';
import type { AccountFlag, AccountHolderLink } from '../../../services/ledgerService';
import { loadAccountDirectory, loadPatientNames, type LoadState } from './debtorsService';

export interface AccountDirectoryState {
  state: LoadState | 'idle' | 'loading';
  error: string | null;
  links: AccountHolderLink[];
  flags: AccountFlag[];
  /** Names of account holders (they may owe nothing themselves, so Finance may not know them) */
  holderNames: Record<string, string>;
  reload: () => void;
}

/**
 * Family links and account flags of a practice, for screens that group by account holder. Only
 * loads when `enabled` (Finance passes "receipts are set up"), so a database without the debtors
 * proposal, or a test without Supabase, never makes the call.
 */
export function useAccountDirectory(practiceId: string | null, enabled: boolean): AccountDirectoryState {
  const [state, setState] = useState<AccountDirectoryState['state']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<AccountHolderLink[]>([]);
  const [flags, setFlags] = useState<AccountFlag[]>([]);
  const [holderNames, setHolderNames] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!practiceId || !enabled) {
      setState('idle');
      return;
    }
    let cancelled = false;
    setState(current => (current === 'ready' ? current : 'loading'));
    (async () => {
      const directory = await loadAccountDirectory(practiceId);
      const names = directory.state === 'ready'
        ? await loadPatientNames(practiceId, [...new Set(directory.links.map(link => link.holderId))]).catch(() => ({} as Record<string, string>))
        : {};
      if (cancelled) return;
      setLinks(directory.links);
      setFlags(directory.flags);
      setHolderNames(names);
      setError(directory.error);
      setState(directory.state);
    })();
    return () => { cancelled = true; };
  }, [practiceId, enabled, reloadKey]);

  const reload = useCallback(() => setReloadKey(key => key + 1), []);
  return { state, error, links, flags, holderNames, reload };
}
