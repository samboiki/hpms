import { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../utils/plainErrors';
import { loadDiaryBlocks, type DiaryBlocksLoad } from '../services/diaryService';
import type { DiaryBlock } from '../utils/diary/blockedTime';

const NO_BLOCKS: DiaryBlock[] = [];

export interface DiaryBlocksState {
  /** 'not_enabled': the diary_blocks table is not in the database yet */
  status: 'idle' | 'loading' | DiaryBlocksLoad['state'];
  blocks: DiaryBlock[];
  error: string | null;
  reload: () => void;
}

/** Blocked time of the practice for the days fromKey-toKey ('yyyy-MM-dd'), reloaded when they change. */
export function useDiaryBlocks(practiceId: string | null | undefined, fromKey: string, toKey: string): DiaryBlocksState {
  const [result, setResult] = useState<DiaryBlocksLoad | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!practiceId) {
      setResult(null);
      return;
    }
    let cancelled = false;
    loadDiaryBlocks(practiceId, fromKey, toKey)
      .then((loaded) => {
        if (!cancelled) setResult(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ state: 'error', message: error instanceof Error ? plainWords(error.message) : String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, fromKey, toKey, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return {
    status: !practiceId ? 'idle' : result?.state ?? 'loading',
    blocks: result?.state === 'ready' ? result.blocks : NO_BLOCKS,
    error: result?.state === 'error' ? result.message : null,
    reload
  };
}
