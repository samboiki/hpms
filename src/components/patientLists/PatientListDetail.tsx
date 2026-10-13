import React, { useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { patientListService, type PatientListRecord } from '../../services/patientListService';
import type { PracticeDetails } from '../../utils/patientLists/listMessages';
import type { PatientFacts, ResolvedList } from '../../utils/patientLists/listRules';
import { ListMembersPanel } from './ListMembersPanel';
import { ListMessagePanel } from './ListMessagePanel';
import { ListRuleEditor } from './ListRuleEditor';
import { ListLettersSheet } from './ListLettersSheet';
import { ListLabelsSheet } from './ListLabelsSheet';
import { AUTOMATIC_SEND_DOT, automaticSendLine, automaticSendState } from './listDisplay';
import { lookFor } from './listPresets';
import { CHIP, DANGER_BUTTON, INPUT, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from './listStyles';

interface PatientListDetailProps {
  list: PatientListRecord;
  resolved: ResolvedList | undefined;
  facts: readonly PatientFacts[];
  factsLoaded: boolean;
  factsError: string | null;
  practice: PracticeDetails;
  practiceId: string;
  userId: string | null;
  todayKey: string;
  onBack: () => void;
  onSaved: (list: PatientListRecord) => void;
  onDeleted: (listId: string) => void;
  /** Member rows changed or a send finished */
  onRowsChanged: () => Promise<void>;
  /** A send finished: reload the list (last send summary) */
  onSent: () => void;
}

type Tab = 'patients' | 'message';

const DEFAULT_VISIT_TYPES = ['consultation', 'follow-up', 'procedure', 'emergency'];

/** One list: who is on it and why, its rule, and its message. */
export const PatientListDetail: React.FC<PatientListDetailProps> = ({
  list,
  resolved,
  facts,
  factsLoaded,
  factsError,
  practice,
  practiceId,
  userId,
  todayKey,
  onBack,
  onSaved,
  onDeleted,
  onRowsChanged,
  onSent
}) => {
  const [tab, setTab] = useState<Tab>('patients');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const [busy, setBusy] = useState(false);
  const [lettersOpen, setLettersOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const look = lookFor(list.rule);
  const members = resolved?.members ?? [];

  const visitTypes = useMemo(() => {
    const types = new Set(DEFAULT_VISIT_TYPES);
    for (const patient of facts) for (const type of Object.keys(patient.lastCompletedByType)) types.add(type);
    return [...types].sort();
  }, [facts]);

  const rename = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === list.name) {
      setRenaming(false);
      setName(list.name);
      return;
    }
    setBusy(true);
    try {
      onSaved(await patientListService.updateList(list.id, { name: trimmed }));
      setRenaming(false);
      toast.success('List renamed.');
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not rename the list.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Delete the list "${list.name}"? Patients are not affected; the list, its message and its send records are removed. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await patientListService.deleteList(list.id);
      toast.success(`"${list.name}" deleted.`);
      onDeleted(list.id);
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not delete the list.');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className={QUIET_BUTTON}>
        <Icon icon="solar:arrow-left-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        All lists
      </button>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${look.tile}`}>
            <Icon icon={look.icon} className={`h-6 w-6 ${look.iconColor}`} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {renaming ? (
              <form onSubmit={rename} className="flex flex-wrap items-center gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  className={`${INPUT} w-64 max-w-full`}
                  aria-label="List name"
                />
                <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(false);
                    setName(list.name);
                  }}
                  className={SECONDARY_BUTTON}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-gray-900">{list.name}</h2>
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  aria-label="Rename the list"
                  title="Rename"
                >
                  <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`${CHIP} ${list.kind === 'smart' ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'}`}>
                {list.kind === 'smart' ? 'Smart list' : 'Hand-picked'}
              </span>
              <span className="text-sm text-gray-500">
                {factsLoaded ? `${members.length} patient${members.length === 1 ? '' : 's'}` : 'Counting patients…'}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${AUTOMATIC_SEND_DOT[automaticSendState(list, new Date())]}`}
                  aria-hidden="true"
                />
                {automaticSendLine(list, new Date())}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {/* O8: a letter from one of the practice's templates for everyone on the list */}
          <button type="button" onClick={() => setLettersOpen(true)} disabled={busy || !factsLoaded || members.length === 0} className={SECONDARY_BUTTON}>
            <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Letters
          </button>
          {/* O9: mailing labels with everyone's name and address */}
          <button type="button" onClick={() => setLabelsOpen(true)} disabled={busy || !factsLoaded || members.length === 0} className={SECONDARY_BUTTON}>
            <Icon icon="solar:letter-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Labels
          </button>
          <button type="button" onClick={() => void remove()} disabled={busy} className={DANGER_BUTTON}>
            <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Delete list
          </button>
        </div>
      </header>
      {lettersOpen && (
        <ListLettersSheet open onClose={() => setLettersOpen(false)} list={list} members={members} practiceId={practiceId} />
      )}
      {labelsOpen && <ListLabelsSheet onClose={() => setLabelsOpen(false)} list={list} members={members} />}

      <div className="inline-flex w-full rounded-xl bg-gray-100 p-1 sm:w-auto" role="tablist" aria-label="List sections">
        {(
          [
            ['patients', factsLoaded ? `Patients (${members.length})` : 'Patients'],
            ['message', 'Message & sending']
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none ${
              tab === value ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'patients' ? (
        <div className="space-y-4" role="tabpanel">
          {list.kind === 'smart' && <ListRuleEditor list={list} visitTypes={visitTypes} onSaved={onSaved} />}
          <ListMembersPanel
            list={list}
            resolved={resolved}
            facts={facts}
            factsLoaded={factsLoaded}
            factsError={factsError}
            practiceId={practiceId}
            userId={userId}
            todayKey={todayKey}
            onChanged={onRowsChanged}
          />
        </div>
      ) : (
        <div role="tabpanel">
          <ListMessagePanel
            list={list}
            members={members}
            practice={practice}
            todayKey={todayKey}
            onSaved={onSaved}
            onSent={onSent}
          />
        </div>
      )}
    </div>
  );
};

export default PatientListDetail;
