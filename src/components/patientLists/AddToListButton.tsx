import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { isListsNotEnabledError, patientListService, type PatientListRecord } from '../../services/patientListService';
import { ListSheet } from './ListSheet';
import { ListsNotEnabled } from './ListsNotEnabled';
import { describeRule } from './listDisplay';
import { MANUAL_LIST_AUTOMATION, lookFor } from './listPresets';
import { INPUT, PRIMARY_BUTTON } from './listStyles';

export interface AddToListButtonProps {
  practiceId: string | null | undefined;
  /** The patients to add: the ticked ones, or everyone shown when nobody is ticked */
  patientIds: readonly string[];
  /** 'selected' when patients are ticked, 'shown' when the whole filtered list is used */
  scope: 'selected' | 'shown';
  /** After patients were added (e.g. to clear the ticks) */
  onAdded?: (result: { listId: string; listName: string; added: number }) => void;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'not_enabled' | 'error';

const countText = (count: number): string => `${count.toLocaleString('en-GB')} patient${count === 1 ? '' : 's'}`;

/**
 * "Add to list" for the Patients page: tick patients, press the button, tap a list. Hand-picked
 * lists come first; smart lists also take extra people by hand.
 */
export const AddToListButton: React.FC<AddToListButtonProps> = ({ practiceId, patientIds, scope, onAdded }) => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>('idle');
  const [lists, setLists] = useState<PatientListRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const requestRef = useRef(0);
  const count = patientIds.length;

  useEffect(() => {
    if (!open || !practiceId) return;
    const requestId = ++requestRef.current;
    setState('loading');
    patientListService
      .loadLists(practiceId)
      .then((loaded) => {
        if (requestId !== requestRef.current) return;
        setLists(loaded);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (requestId !== requestRef.current) return;
        setState(isListsNotEnabledError(error) ? 'not_enabled' : 'error');
      });
  }, [open, practiceId]);

  const addTo = async (list: PatientListRecord) => {
    if (!practiceId) return;
    setBusyId(list.id);
    try {
      const { added, alreadyOnList } = await patientListService.addPatients(practiceId, list.id, patientIds);
      const already = alreadyOnList > 0 ? ` (${countText(alreadyOnList)} already on it)` : '';
      if (added > 0) toast.success(`${countText(added)} added to "${list.name}"${already}.`);
      else toast(`Everyone was already on "${list.name}".`);
      setOpen(false);
      onAdded?.({ listId: list.id, listName: list.name, added });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the patients to the list.');
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!practiceId || !name) {
      toast.error('Give the new list a name.');
      return;
    }
    setBusyId('new');
    try {
      const list = await patientListService.createList({
        practiceId,
        name,
        description: null,
        kind: 'manual',
        rule: null,
        automation: MANUAL_LIST_AUTOMATION
      });
      setLists((previous) => [...previous, list]);
      setNewName('');
      await addTo(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the list.');
      setBusyId(null);
    }
  };

  const label =
    count === 0
      ? 'No patients to add to a list'
      : scope === 'selected'
        ? `Add ${countText(count)} (ticked) to a list`
        : `Add all ${countText(count)} shown to a list`;

  const manualLists = lists.filter((list) => list.kind === 'manual');
  const smartLists = lists.filter((list) => list.kind === 'smart');

  const renderRow = (list: PatientListRecord) => {
    const look = lookFor(list.rule);
    const busy = busyId === list.id;
    return (
      <li key={list.id}>
        <button
          type="button"
          onClick={() => void addTo(list)}
          disabled={busyId !== null}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-purple-50/60 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${look.tile}`}>
            <Icon
              icon={busy ? 'solar:refresh-bold-duotone' : look.icon}
              className={`h-5 w-5 ${look.iconColor} ${busy ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-900">{list.name}</span>
            <span className="block truncate text-xs text-gray-500">
              {list.rule ? describeRule(list.rule) : list.description ?? 'Hand-picked list'}
            </span>
          </span>
          <Icon icon="solar:add-circle-bold-duotone" className="h-5 w-5 shrink-0 text-purple-500" aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <>
      <span title={label}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={count === 0 || !practiceId}
          aria-label={label}
          className={`p-3 rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            scope === 'selected' && count > 0
              ? 'text-purple-600 bg-purple-50 hover:bg-purple-100 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Icon icon="solar:checklist-minimalistic-bold-duotone" className="w-5 h-5" aria-hidden="true" />
        </button>
      </span>

      <ListSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add to a list"
        subtitle={scope === 'selected' ? `${countText(count)} ticked` : `All ${countText(count)} shown (nobody is ticked)`}
      >
        {scope === 'shown' && count > 20 && (
          <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100">
            <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Nobody is ticked, so every patient in the current results will be added. Tick patients first to add only some.
          </p>
        )}

        {state === 'not_enabled' && <ListsNotEnabled compact />}
        {state === 'error' && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
            The lists could not be loaded. Close this and try again.
          </p>
        )}
        {state === 'loading' && (
          <div className="space-y-2" aria-busy="true" aria-label="Loading lists">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        )}

        {state === 'ready' && (
          <div className="space-y-4">
            <form onSubmit={createAndAdd} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={80}
                placeholder="New list, e.g. Flu vaccine 2026"
                className={INPUT}
                aria-label="Name of a new list"
              />
              <button type="submit" disabled={busyId !== null || !newName.trim()} className={`${PRIMARY_BUTTON} shrink-0`}>
                <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Create and add
              </button>
            </form>

            {manualLists.length > 0 && (
              <div>
                <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-gray-500">Hand-picked lists</p>
                <ul>{manualLists.map(renderRow)}</ul>
              </div>
            )}
            {smartLists.length > 0 && (
              <div>
                <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Smart lists (add extra people by hand)
                </p>
                <ul>{smartLists.map(renderRow)}</ul>
              </div>
            )}
            {lists.length === 0 && (
              <p className="px-2 text-sm text-gray-500">There are no lists yet. Name a new list above to start one.</p>
            )}
          </div>
        )}
      </ListSheet>
    </>
  );
};

export default AddToListButton;
