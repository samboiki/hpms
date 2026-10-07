import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import type { PatientListRecord } from '../../services/patientListService';
import type { ResolvedList } from '../../utils/patientLists/listRules';
import { CreateListSheet } from './CreateListSheet';
import { ListsNotEnabled } from './ListsNotEnabled';
import { PatientListDetail } from './PatientListDetail';
import { describeRule, lastRunText, scheduleSummary } from './listDisplay';
import { lookFor } from './listPresets';
import { CARD, CHIP, PRIMARY_BUTTON, SECONDARY_BUTTON } from './listStyles';
import { usePatientListsData } from './usePatientListsData';

export interface PatientListsPageProps {
  /** Defaults to the signed-in user's practice */
  practiceId?: string | null;
}

const ListCard: React.FC<{
  list: PatientListRecord;
  resolved: ResolvedList | undefined;
  factsLoaded: boolean;
  onOpen: () => void;
}> = ({ list, resolved, factsLoaded, onOpen }) => {
  const look = lookFor(list.rule);
  const count = resolved?.members.length ?? 0;
  const lastRun = lastRunText(list.lastRunSummary);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${CARD} group flex h-full w-full flex-col p-4 text-left transition-all hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 sm:p-5`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${look.tile}`}>
          <Icon icon={look.icon} className={`h-6 w-6 ${look.iconColor}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{list.name}</p>
          <span className={`${CHIP} mt-0.5 ${list.kind === 'smart' ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'}`}>
            {list.kind === 'smart' ? 'Smart' : 'Hand-picked'}
          </span>
        </div>
        <div className="text-right">
          {factsLoaded ? (
            <p className="text-2xl font-semibold tabular-nums leading-none text-gray-900">{count}</p>
          ) : (
            <span className="inline-block h-6 w-8 animate-pulse rounded bg-gray-100" aria-label="Counting" />
          )}
          <p className="mt-1 text-xs text-gray-500">{count === 1 && factsLoaded ? 'patient' : 'patients'}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-gray-600">
        {list.ruleError
          ? 'This list needs fixing: its rule cannot be read.'
          : list.rule
            ? describeRule(list.rule)
            : list.description ?? 'Patients you add by hand'}
      </p>
      <div className="mt-auto space-y-1 pt-3">
        <p className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className={`h-1.5 w-1.5 rounded-full ${list.automationEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
            aria-hidden="true"
          />
          {scheduleSummary(list.automation, list.automationEnabled)}
        </p>
        {lastRun && <p className="text-xs text-gray-400">{lastRun}</p>}
      </div>
    </button>
  );
};

/**
 * The Lists page: patient lists for reminders, recalls and greetings. Smart lists fill themselves;
 * hand-picked lists hold whoever staff add. Each list can send its own SMS.
 */
export const PatientListsPage: React.FC<PatientListsPageProps> = ({ practiceId: practiceIdProp }) => {
  const { user } = useAuthStore();
  const practiceId = practiceIdProp ?? user?.practice_id ?? null;
  const data = usePatientListsData(practiceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const selected = data.lists.find((list) => list.id === selectedId) ?? null;

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Icon icon="solar:checklist-minimalistic-bold-duotone" className="h-6 w-6 text-purple-600" aria-hidden="true" />
          Patient lists
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Group patients for birthdays, recalls and reminders. Smart lists fill themselves every day.
        </p>
      </div>
      {data.status === 'ready' && (
        <button type="button" onClick={() => setCreateOpen(true)} className={PRIMARY_BUTTON}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          New list
        </button>
      )}
    </div>
  );

  let body: React.ReactNode;
  if (data.status === 'not_enabled') {
    body = <ListsNotEnabled />;
  } else if (data.status === 'error') {
    body = (
      <div className={`${CARD} mx-auto max-w-md p-6 text-center`} role="alert">
        <Icon icon="solar:danger-triangle-bold-duotone" className="mx-auto mb-3 h-10 w-10 text-amber-500" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-900">The lists could not be loaded</p>
        <p className="mt-1 text-sm text-gray-500">{data.error}</p>
        <button type="button" onClick={() => void data.reload()} className={`${SECONDARY_BUTTON} mt-4`}>
          <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  } else if (data.status === 'loading') {
    body = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading lists">
        {[0, 1, 2].map((card) => (
          <div key={card} className={`${CARD} h-44 animate-pulse bg-gray-50`} />
        ))}
      </div>
    );
  } else if (selected && practiceId) {
    body = (
      <PatientListDetail
        key={selected.id}
        list={selected}
        resolved={data.resolved.get(selected.id)}
        facts={data.facts}
        factsLoaded={data.factsLoaded}
        factsError={data.factsError}
        practice={data.practice}
        practiceId={practiceId}
        userId={user?.id ?? null}
        todayKey={data.todayKey}
        onBack={() => setSelectedId(null)}
        onSaved={data.putList}
        onDeleted={(listId) => {
          data.dropList(listId);
          setSelectedId(null);
        }}
        onRowsChanged={data.reloadRows}
        onSent={() => void data.reloadAfterSend()}
      />
    );
  } else if (data.lists.length === 0) {
    body = (
      <div className={`${CARD} mx-auto max-w-xl px-6 py-12 text-center`}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 ring-1 ring-purple-100">
          <Icon icon="solar:magic-stick-3-bold-duotone" className="h-8 w-8 text-purple-500" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">No lists yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
          Start with a ready-made list such as Birthdays today or Recall due. It fills itself, and nothing is sent until you
          switch sending on.
        </p>
        <button type="button" onClick={() => setCreateOpen(true)} className={`${PRIMARY_BUTTON} mt-5`}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          Create your first list
        </button>
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.lists.map((list) => (
          <ListCard
            key={list.id}
            list={list}
            resolved={data.resolved.get(list.id)}
            factsLoaded={data.factsLoaded}
            onOpen={() => setSelectedId(list.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {!selected && header}
      {data.factsError && data.status === 'ready' && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100" role="alert">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Patient details could not be loaded, so smart lists show no one for now. {data.factsError}
        </p>
      )}
      {body}
      {practiceId && data.status === 'ready' && (
        <CreateListSheet
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          practiceId={practiceId}
          existingNames={data.lists.map((list) => list.name)}
          onCreated={(list) => {
            data.putList(list);
            setCreateOpen(false);
            setSelectedId(list.id);
          }}
        />
      )}
    </div>
  );
};

export default PatientListsPage;
