/**
 * "Changed by someone else" (parity Q12): the check a screen makes before it saves a patient's details, a visit or an
 * invoice, and the sheet that asks what to do when someone changed it after the screen opened it. One helper for every
 * save path: the screen remembers the versions it opened (remember, or rememberCurrent for a screen filled from live
 * data), awaits confirmSave() before its first write, and calls refresh() after a write of its own that leaves it open.
 * confirmSave resolves to
 *   'save'   nothing changed, or the person chose "Save mine anyway" (their screen replaces what is saved);
 *   'reload' the person chose "Reload their version" (the screen shows the record as saved now; their changes go);
 *   'stop'   the person went back to the screen, or the record is gone: nothing is saved.
 * When the check cannot be made (offline) the screen saves as it did before. Render `dialog` once in the screen. The
 * sheet is the one the visit screen already uses over full-screen views (the account-flag check).
 */
import React, { useCallback, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { PrimaryButton, SecondaryButton, Sheet } from '../finance/receipts/ArUi';
import {
  RECORD_WORDS,
  changedBy,
  checkRecordVersions,
  describeChanges,
  loadPeopleNames,
  lostChangeWords,
  readRecordVersions,
  versionKey,
  type OpenedVersion,
  type RecordChange,
  type VersionedRecord
} from '../../services/recordVersion';

export type SaveDecision = 'save' | 'reload' | 'stop';

/** What the two choices mean on this screen, in plain words */
export interface RecordChangeChoices {
  /** "Reload their version": what the screen then shows, and that the person's changes are lost */
  reload: string;
  /** "Save mine anyway": what the person's screen replaces (the sheet adds whose change is lost) */
  save: string;
}

type Conflict =
  | { state: 'changed'; changes: RecordChange[]; current: OpenedVersion[] }
  | { state: 'gone'; kind: VersionedRecord };

interface Pending {
  conflict: Conflict;
  names: Record<string, string>;
  resolve: (decision: SaveDecision) => void;
}

export function useRecordChangeGuard(choices: RecordChangeChoices) {
  const meId = useAuthStore(state => state.user?.id ?? null);
  const opened = useRef<OpenedVersion[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

  /**
   * The versions the screen opened, read with what it shows. A version it never saw (updated_at not loaded) cannot be
   * compared and is left out; null (a row the database never stamped) is a version.
   */
  const remember = useCallback((versions: ReadonlyArray<(Omit<OpenedVersion, 'updatedAt'> & { updatedAt: string | null | undefined }) | null | undefined>) => {
    opened.current = versions.flatMap(version => (version?.id && version.updatedAt !== undefined ? [{ ...version, updatedAt: version.updatedAt }] : []));
  }, []);

  /** A screen filled from live data (the diary) keeps the versions as saved when it opens */
  const rememberCurrent = useCallback(async (records: ReadonlyArray<{ kind: VersionedRecord; id: string }>) => {
    try {
      const now = await readRecordVersions(records);
      opened.current = records
        .filter(record => now.has(versionKey(record.kind, record.id)))
        .map(record => ({ ...record, updatedAt: now.get(versionKey(record.kind, record.id))?.updatedAt ?? null }));
    } catch {
      opened.current = [];
    }
  }, []);

  /** Before the first write: only the kinds given are compared (the visit screen leaves out an invoice it will not write) */
  const confirmSave = useCallback(async (kinds?: readonly VersionedRecord[]): Promise<SaveDecision> => {
    const versions = kinds ? opened.current.filter(version => kinds.includes(version.kind)) : opened.current;
    const check = await checkRecordVersions(versions);
    if (check.state === 'unchanged') return 'save';
    if (check.state === 'not_checked') {
      console.warn('Could not check whether someone else changed this record first; saving as before:', check.reason);
      return 'save';
    }
    const names = check.state === 'changed'
      ? await loadPeopleNames(check.changes.map(change => change.updatedBy)).catch(() => ({} as Record<string, string>))
      : {};
    return new Promise<SaveDecision>(resolve => setPending({ conflict: check, names, resolve }));
  }, []);

  /** After the screen's own write, if it stays open: what is saved now is what it holds */
  const refresh = useCallback(async () => {
    if (opened.current.length === 0) return;
    try {
      const now = await readRecordVersions(opened.current);
      opened.current = opened.current.map(version => ({ ...version, updatedAt: now.get(versionKey(version.kind, version.id))?.updatedAt ?? version.updatedAt }));
    } catch {
      // The next check reads again
    }
  }, []);

  const finish = (decision: SaveDecision) => {
    if (!pending) return;
    // "Save mine anyway": the newer version is the one this screen now writes over, so a failed save does not ask again
    if (decision === 'save' && pending.conflict.state === 'changed') {
      const current = new Map(pending.conflict.current.map(version => [versionKey(version.kind, version.id), version.updatedAt]));
      opened.current = opened.current.map(version => {
        const key = versionKey(version.kind, version.id);
        return current.has(key) ? { ...version, updatedAt: current.get(key) ?? null } : version;
      });
    }
    pending.resolve(decision);
    setPending(null);
  };

  const dialog = pending
    ? <RecordChangeSheet conflict={pending.conflict} names={pending.names} meId={meId} choices={choices} onDone={finish} />
    : null;
  return { remember, rememberCurrent, confirmSave, refresh, dialog };
}

const capitalised = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const RecordChangeSheet: React.FC<{
  conflict: Conflict;
  names: Record<string, string>;
  meId: string | null;
  choices: RecordChangeChoices;
  onDone: (decision: SaveDecision) => void;
}> = ({ conflict, names, meId, choices, onDone }) => {
  if (conflict.state === 'gone') {
    return (
      <Sheet
        open
        onClose={() => onDone('stop')}
        size="md"
        overFullScreen
        tone="red"
        icon="solar:danger-triangle-bold-duotone"
        title="No longer there"
        subtitle="Nothing was saved."
        footer={<SecondaryButton data-autofocus icon="solar:arrow-left-bold-duotone" onClick={() => onDone('stop')}>Back</SecondaryButton>}
      >
        <p className="text-sm text-gray-700">
          {`${capitalised(RECORD_WORDS[conflict.kind])} was deleted after you opened it, or you can no longer open it, so your changes cannot be saved. Copy anything you still need before you close.`}
        </p>
      </Sheet>
    );
  }

  const people = { meId, names };
  const onlyMine = conflict.changes.every(change => changedBy(change.updatedBy, people) === 'You');
  return (
    <Sheet
      open
      onClose={() => onDone('stop')}
      size="md"
      overFullScreen
      tone="amber"
      icon="solar:users-group-rounded-bold-duotone"
      title={onlyMine ? 'Changed in another window' : 'Changed by someone else'}
      subtitle="Nothing is saved until you choose."
      footer={
        <>
          <SecondaryButton data-autofocus onClick={() => onDone('stop')}>Back</SecondaryButton>
          <SecondaryButton icon="solar:diskette-bold-duotone" onClick={() => onDone('save')}>Save mine anyway</SecondaryButton>
          <PrimaryButton icon="solar:refresh-bold-duotone" onClick={() => onDone('reload')}>
            {onlyMine ? 'Reload the saved version' : 'Reload their version'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-700">
        {describeChanges(conflict.changes, people).map(sentence => <p key={sentence}>{sentence}</p>)}
        <dl className="space-y-2">
          <div>
            <dt className="font-medium text-gray-900">{onlyMine ? 'Reload the saved version' : 'Reload their version'}</dt>
            <dd>{choices.reload}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Save mine anyway</dt>
            <dd>{`${choices.save} ${lostChangeWords(conflict.changes, people)}`}</dd>
          </div>
        </dl>
      </div>
    </Sheet>
  );
};
