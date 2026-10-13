import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { patientListsLink } from '../billing/invoiceLinks';
import { patientListService, type PatientListRecord } from '../../services/patientListService';
import { patientRecallService } from '../../services/patientRecallService';
import type { ListMember } from '../../utils/patientLists/listRules';
import { headlineRecall, type PatientRecall } from '../../utils/patientLists/recalls';
import { useAuthStore } from '../../stores/authStore';
import { ListSheet } from './ListSheet';
import { ListsNotEnabled } from './ListsNotEnabled';
import { RecallSheet } from './RecallSheet';
import { describeRule, memberReason, recallNoticeText, recallStatusText } from './listDisplay';
import { lookFor } from './listPresets';
import { CHIP, QUIET_BUTTON } from './listStyles';
import { usePatientListsData } from './usePatientListsData';

export interface PatientListsControlProps {
  practiceId: string | null | undefined;
  patient: { id: string; first_name?: string | null; last_name?: string | null };
  /** 'onDark' matches the buttons on the purple patient header */
  variant?: 'onDark' | 'default';
}

const BUTTON_CLASS = {
  onDark:
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
  default:
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500'
} as const;

interface Entry {
  list: PatientListRecord;
  member: ListMember | null;
}

/** Smart-list notices shown on the file itself (recall due, owing, birthday...); the rest are behind "Lists" */
const MAX_NOTICES = 3;
const NOTICE_CLASS = {
  onDark:
    'inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/25 hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
  default:
    'inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-100 hover:bg-purple-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500'
} as const;

/**
 * "Lists" on a patient's file: which lists they are on (and why), take them off, put them back,
 * or add them to another list in two taps.
 */
export const PatientListsControl: React.FC<PatientListsControlProps> = ({ practiceId, patient, variant = 'default' }) => {
  const { user } = useAuthStore();
  const data = usePatientListsData(practiceId, patient.id);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const name = `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim() || 'this patient';
  // The patient's recalls (parity O3): the next one shows beside the list notices; none before recalls are set up
  const [recalls, setRecalls] = useState<PatientRecall[]>([]);
  const [recallOpen, setRecallOpen] = useState(false);
  const loadRecalls = useCallback(() => {
    if (!practiceId) return;
    patientRecallService
      .loadForPatient(practiceId, patient.id)
      .then(setRecalls)
      .catch(() => setRecalls([]));
  }, [practiceId, patient.id]);
  useEffect(() => loadRecalls(), [loadRecalls]);
  const recall = headlineRecall(recalls);

  const { onLists, takenOff, others } = useMemo(() => {
    const groups = { onLists: [] as Entry[], takenOff: [] as Entry[], others: [] as Entry[] };
    for (const list of data.lists) {
      const resolved = data.resolved.get(list.id);
      const member = resolved?.members.find((item) => item.patientId === patient.id) ?? null;
      const excluded = resolved?.excluded.find((item) => item.patientId === patient.id) ?? null;
      if (member) groups.onLists.push({ list, member });
      else if (excluded) groups.takenOff.push({ list, member: excluded });
      else groups.others.push({ list, member: null });
    }
    // Hand-picked lists first: those are the ones people add patients to
    groups.others.sort((a, b) => Number(a.list.kind === 'smart') - Number(b.list.kind === 'smart'));
    return groups;
  }, [data.lists, data.resolved, patient.id]);

  const run = async (listId: string, action: () => Promise<unknown>, success: string) => {
    if (!practiceId) return;
    setBusyId(listId);
    try {
      await action();
      await data.reloadRows();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the list.');
    } finally {
      setBusyId(null);
    }
  };

  const takeOff = (entry: Entry) =>
    run(
      entry.list.id,
      () => patientListService.setExcluded(practiceId as string, entry.list.id, patient.id, true, user?.id ?? null),
      `${name} was taken off "${entry.list.name}".`
    );
  const putBack = (entry: Entry) =>
    run(
      entry.list.id,
      () => patientListService.setExcluded(practiceId as string, entry.list.id, patient.id, false, user?.id ?? null),
      `${name} is back on "${entry.list.name}".`
    );
  const add = (entry: Entry) =>
    run(
      entry.list.id,
      () => patientListService.addPatients(practiceId as string, entry.list.id, [patient.id]),
      `${name} was added to "${entry.list.name}".`
    );

  const ready = data.status === 'ready' && data.factsLoaded;
  const count = ready ? onLists.length : null;
  // Smart lists that picked this patient today: shown as notices on the file, with the reason as the tooltip
  const notices = ready ? onLists.filter((entry) => entry.list.kind === 'smart' && entry.member?.automatic) : [];
  const disabledTitle = data.status === 'not_enabled' ? 'Automation lists are not switched on yet' : undefined;

  // A list's icon tile; with no list, the "Recall due" look (the patient's own recall reads like the recall list)
  const listIcon = (list: PatientListRecord | null) => {
    const look = lookFor(list ? list.rule : { type: 'recall_due', months: 6, visitTypes: [] });
    return (
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${look.tile}`}>
        <Icon icon={look.icon} className={`h-4 w-4 ${look.iconColor}`} aria-hidden="true" />
      </span>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${BUTTON_CLASS[variant]} ${data.status === 'not_enabled' ? 'opacity-70' : ''}`}
        title={disabledTitle ?? `Lists ${name} is on (reminders, recalls, birthdays)`}
        aria-label={count !== null ? `Lists: ${name} is on ${count} list${count === 1 ? '' : 's'}` : 'Lists'}
      >
        <Icon icon="solar:checklist-minimalistic-bold-duotone" className="w-4 h-4" aria-hidden="true" />
        <span>Lists</span>
        {count !== null && count > 0 && (
          <span
            className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-xs font-semibold tabular-nums ${
              variant === 'onDark' ? 'bg-white/90 text-indigo-700' : 'bg-purple-100 text-purple-700'
            }`}
          >
            {count}
          </span>
        )}
      </button>

      {(notices.length > 0 || recall) && (
        <span className="flex flex-wrap items-center gap-1.5" aria-label={`Notices for ${name}`}>
          {recall && (
            <button
              type="button"
              onClick={() => setRecallOpen(true)}
              className={NOTICE_CLASS[variant]}
              title={`Recall: ${recall.reason} · ${recallStatusText(recall, data.todayKey)}`}
            >
              <Icon icon="solar:calendar-mark-bold-duotone" className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{recallNoticeText(recall, data.todayKey)}</span>
            </button>
          )}
          {notices.slice(0, MAX_NOTICES).map(({ list, member }) => (
            <button
              key={list.id}
              type="button"
              onClick={() => setOpen(true)}
              className={NOTICE_CLASS[variant]}
              title={member ? `${list.name}: ${memberReason(member, list.rule, data.todayKey)}` : list.name}
            >
              <Icon icon={lookFor(list.rule).icon} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{list.name}</span>
            </button>
          ))}
          {notices.length > MAX_NOTICES && (
            <button type="button" onClick={() => setOpen(true)} className={NOTICE_CLASS[variant]} title="See all the lists this patient is on">
              +{notices.length - MAX_NOTICES}
            </button>
          )}
        </span>
      )}

      <ListSheet open={open} onClose={() => setOpen(false)} title={`Lists for ${name}`} subtitle="Smart lists update themselves every day.">
        {/* The patient's own recall: when to call them back, and why (set here or from a visit) */}
        <section aria-labelledby="patient-recall" className="mb-5">
          <h3 id="patient-recall" className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Recall
          </h3>
          <div className="flex items-center gap-3 rounded-xl px-1 py-2">
            {listIcon(null)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{recall ? recall.reason : 'No recall set'}</p>
              {recall && <p className="truncate text-xs text-gray-500">{recallStatusText(recall, data.todayKey)}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setRecallOpen(true);
              }}
              className={QUIET_BUTTON}
            >
              <Icon icon="solar:calendar-mark-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
              {recall ? 'Recalls' : 'Set a recall'}
            </button>
          </div>
        </section>
        {data.status === 'not_enabled' && <ListsNotEnabled compact />}
        {data.status === 'error' && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
            The lists could not be loaded.{' '}
            <button type="button" onClick={() => void data.reload()} className="font-medium underline">
              Try again
            </button>
          </div>
        )}
        {data.factsError && data.status === 'ready' && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="alert">
            Smart lists cannot be checked right now: {data.factsError}
          </p>
        )}
        {(data.status === 'loading' || (data.status === 'ready' && !data.factsLoaded && !data.factsError)) && (
          <div className="space-y-2" aria-busy="true" aria-label="Loading lists">
            {[0, 1].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        )}

        {ready && (
          <div className="space-y-5">
            <section aria-labelledby="patient-lists-on">
              <h3 id="patient-lists-on" className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                On these lists
              </h3>
              {onLists.length === 0 ? (
                <p className="text-sm text-gray-500">Not on any list today.</p>
              ) : (
                <ul className="space-y-1">
                  {onLists.map((entry) => (
                    <li key={entry.list.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                      {listIcon(entry.list)}
                      <div className="min-w-0 flex-1">
                        {/* The list itself under Messages > Lists, with everyone on it */}
                        <Link
                          to={patientListsLink(entry.list.id)}
                          className="block truncate text-sm font-medium text-gray-900 hover:text-purple-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                        >
                          {entry.list.name}
                        </Link>
                        <p className="truncate text-xs text-gray-500">
                          {entry.member ? memberReason(entry.member, entry.list.rule, data.todayKey) : ''}
                        </p>
                      </div>
                      {entry.member?.automatic && <span className={`${CHIP} hidden bg-purple-50 text-purple-700 sm:inline-flex`}>Automatic</span>}
                      <button
                        type="button"
                        onClick={() => void takeOff(entry)}
                        disabled={busyId !== null}
                        className={QUIET_BUTTON}
                        aria-label={`Take ${name} off ${entry.list.name}`}
                      >
                        {busyId === entry.list.id ? (
                          <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Icon icon="solar:user-minus-rounded-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                        )}
                        {entry.member?.automatic ? 'Exclude' : 'Remove'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {takenOff.length > 0 && (
              <section aria-labelledby="patient-lists-off">
                <h3 id="patient-lists-off" className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Taken off
                </h3>
                <ul className="space-y-1">
                  {takenOff.map((entry) => (
                    <li key={entry.list.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                      {listIcon(entry.list)}
                      <p className="min-w-0 flex-1 truncate text-sm text-gray-600">{entry.list.name}</p>
                      <button type="button" onClick={() => void putBack(entry)} disabled={busyId !== null} className={QUIET_BUTTON}>
                        <Icon icon="solar:undo-left-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                        Put back
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="patient-lists-add">
              <h3 id="patient-lists-add" className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Add to a list
              </h3>
              {others.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {data.lists.length === 0 ? (
                    <>
                      There are no lists yet. Create them under{' '}
                      <Link to={patientListsLink()} className="font-medium text-purple-700 hover:underline">
                        Messages &gt; Lists
                      </Link>
                      .
                    </>
                  ) : (
                    `${name} is on every list.`
                  )}
                </p>
              ) : (
                <ul className="space-y-1">
                  {others.map((entry) => (
                    <li key={entry.list.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                      {listIcon(entry.list)}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{entry.list.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {entry.list.rule ? describeRule(entry.list.rule) : entry.list.description ?? 'Hand-picked list'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void add(entry)}
                        disabled={busyId !== null}
                        className={QUIET_BUTTON}
                        aria-label={`Add ${name} to ${entry.list.name}`}
                      >
                        {busyId === entry.list.id ? (
                          <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
                        )}
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </ListSheet>

      <RecallSheet
        open={recallOpen}
        onClose={() => setRecallOpen(false)}
        practiceId={practiceId}
        patientId={patient.id}
        patientName={name}
        onChanged={() => {
          loadRecalls();
          // A recall date changes who is on "Recall due" today
          void data.reload();
        }}
      />
    </>
  );
};

export default PatientListsControl;
