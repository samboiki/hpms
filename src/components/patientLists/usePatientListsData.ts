import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isListsNotEnabledError, patientListService, type PatientListRecord } from '../../services/patientListService';
import { windhoekClock } from '../../utils/patientLists/listDates';
import type { PracticeDetails } from '../../utils/patientLists/listMessages';
import {
  resolveListMembers,
  type ListMemberRow,
  type PatientFacts,
  type ResolvedList
} from '../../utils/patientLists/listRules';

export type ListsStatus = 'loading' | 'ready' | 'not_enabled' | 'error';

interface ListsState {
  status: ListsStatus;
  error: string | null;
  lists: PatientListRecord[];
  rows: ListMemberRow[];
  facts: PatientFacts[];
  /** Patient facts arrive after the lists; member counts show once they are in */
  factsLoaded: boolean;
  factsError: string | null;
  practice: PracticeDetails;
  /** Windhoek date the data was loaded for */
  todayKey: string;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Something went wrong.');

const initialState = (): ListsState => ({
  status: 'loading',
  error: null,
  lists: [],
  rows: [],
  facts: [],
  factsLoaded: false,
  factsError: null,
  practice: { name: null, phone: null },
  todayKey: windhoekClock(new Date()).dateKey
});

/**
 * Lists, member rows and patient facts of a practice, with every list's members worked out from
 * them. With `patientId`, only that patient's rows and facts are loaded (the per-patient control).
 */
export function usePatientListsData(practiceId: string | null | undefined, patientId?: string | null) {
  const [state, setState] = useState<ListsState>(initialState);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    const todayKey = windhoekClock(new Date()).dateKey;
    if (!practiceId) {
      setState({ ...initialState(), status: 'error', error: 'No practice is selected. Please sign in again.' });
      return;
    }
    setState((previous) => ({ ...previous, status: previous.status === 'ready' ? 'ready' : 'loading', error: null, todayKey }));
    try {
      const [lists, rows, practice] = await Promise.all([
        patientListService.loadLists(practiceId),
        patientListService.loadMemberRows(practiceId, patientId ?? undefined),
        patientListService.loadPractice(practiceId).catch((): PracticeDetails => ({ name: null, phone: null }))
      ]);
      if (requestId !== requestRef.current) return;
      setState((previous) => ({ ...previous, status: 'ready', lists, rows, practice, todayKey }));
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState((previous) => ({
        ...previous,
        status: isListsNotEnabledError(error) ? 'not_enabled' : 'error',
        error: errorText(error)
      }));
      return;
    }

    try {
      const facts = await patientListService.loadFacts(practiceId, todayKey, patientId ? [patientId] : undefined);
      if (requestId !== requestRef.current) return;
      setState((previous) => ({ ...previous, facts, factsLoaded: true, factsError: null }));
    } catch (error) {
      if (requestId !== requestRef.current) return;
      if (isListsNotEnabledError(error)) {
        setState((previous) => ({ ...previous, status: 'not_enabled', error: errorText(error) }));
      } else {
        setState((previous) => ({ ...previous, factsLoaded: false, factsError: errorText(error) }));
      }
    }
  }, [practiceId, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadRows = useCallback(async () => {
    if (!practiceId) return;
    const rows = await patientListService.loadMemberRows(practiceId, patientId ?? undefined);
    setState((previous) => ({ ...previous, rows }));
  }, [practiceId, patientId]);

  const putList = useCallback((list: PatientListRecord) => {
    setState((previous) => {
      const exists = previous.lists.some((item) => item.id === list.id);
      return {
        ...previous,
        lists: exists ? previous.lists.map((item) => (item.id === list.id ? list : item)) : [...previous.lists, list]
      };
    });
  }, []);

  const dropList = useCallback((listId: string) => {
    setState((previous) => ({
      ...previous,
      lists: previous.lists.filter((list) => list.id !== listId),
      rows: previous.rows.filter((row) => row.list_id !== listId)
    }));
  }, []);

  const resolved = useMemo(() => {
    const map = new Map<string, ResolvedList>();
    if (!state.factsLoaded) return map;
    for (const list of state.lists) {
      map.set(
        list.id,
        resolveListMembers({
          kind: list.kind,
          rule: list.rule,
          facts: state.facts,
          rows: state.rows,
          listId: list.id,
          todayKey: state.todayKey
        })
      );
    }
    return map;
  }, [state.lists, state.rows, state.facts, state.factsLoaded, state.todayKey]);

  return { ...state, resolved, reload: load, reloadRows, putList, dropList };
}
