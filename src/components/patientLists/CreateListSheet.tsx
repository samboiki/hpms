import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { patientListService, type PatientListRecord } from '../../services/patientListService';
import { ListSheet } from './ListSheet';
import { LIST_LOOKS, LIST_PRESETS, MANUAL_LIST_AUTOMATION, uniqueListName, type ListPreset } from './listPresets';
import { INPUT, LABEL, PRIMARY_BUTTON } from './listStyles';

interface CreateListSheetProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
  existingNames: readonly string[];
  onCreated: (list: PatientListRecord) => void;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Could not create the list.');

/** "New list": one tap on a ready-made smart list creates it; or name a hand-picked list. */
export const CreateListSheet: React.FC<CreateListSheetProps> = ({ open, onClose, practiceId, existingNames, onCreated }) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');

  const createFromPreset = async (preset: ListPreset) => {
    setBusyId(preset.id);
    try {
      const list = await patientListService.createList({
        practiceId,
        name: uniqueListName(preset.name, existingNames),
        description: null,
        kind: 'smart',
        rule: preset.rule,
        automation: preset.automation
      });
      toast.success(`"${list.name}" created. Check the message before switching on sending.`);
      onCreated(list);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyId(null);
    }
  };

  const createManual = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = manualName.trim();
    if (!name) {
      toast.error('Give the list a name, for example "Flu vaccine 2026".');
      return;
    }
    setBusyId('manual');
    try {
      const list = await patientListService.createList({
        practiceId,
        name,
        description: null,
        kind: 'manual',
        rule: null,
        automation: MANUAL_LIST_AUTOMATION
      });
      toast.success(`"${list.name}" created. Add patients from the Patients page or the list itself.`);
      setManualName('');
      onCreated(list);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ListSheet open={open} onClose={onClose} title="New list" subtitle="Pick a ready-made list or make your own." size="lg">
      <section aria-labelledby="smart-lists-heading">
        <div className="mb-3 flex items-center gap-2">
          <Icon icon="solar:magic-stick-3-bold-duotone" className="h-5 w-5 text-purple-500" aria-hidden="true" />
          <h3 id="smart-lists-heading" className="text-sm font-semibold text-gray-900">
            Smart lists
          </h3>
          <span className="text-xs text-gray-500">fill themselves every day</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LIST_PRESETS.map((preset) => {
            const look = LIST_LOOKS[preset.rule.type];
            const busy = busyId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={busyId !== null}
                onClick={() => void createFromPreset(preset)}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:border-purple-200 hover:bg-purple-50/40 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${look.tile}`}>
                  <Icon
                    icon={busy ? 'solar:refresh-bold-duotone' : look.icon}
                    className={`h-5 w-5 ${look.iconColor} ${busy ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{preset.name}</span>
                  <span className="block text-xs text-gray-500">{preset.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
          <Icon icon="solar:shield-check-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
          New lists never send by themselves: you check the message and switch sending on.
        </p>
      </section>

      <form onSubmit={createManual} className="mt-6 border-t border-gray-100 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Icon icon={LIST_LOOKS.manual.icon} className="h-5 w-5 text-indigo-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900">Hand-picked list</h3>
          <span className="text-xs text-gray-500">you choose who is on it</span>
        </div>
        <label htmlFor="new-list-name" className={LABEL}>
          List name
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="new-list-name"
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            maxLength={80}
            placeholder="e.g. Flu vaccine 2026"
            className={INPUT}
          />
          <button type="submit" disabled={busyId !== null} className={`${PRIMARY_BUTTON} shrink-0`}>
            {busyId === 'manual' ? (
              <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            )}
            Create list
          </button>
        </div>
      </form>
    </ListSheet>
  );
};

export default CreateListSheet;
