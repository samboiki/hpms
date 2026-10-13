import React, { useEffect, useMemo, useState } from 'react';
import type { PatientListRecord } from '../../services/patientListService';
import { loadMailingSources } from '../../services/labels/mailingLabelsService';
import { mailingRun } from '../../utils/labels/labelContent';
import type { ListMember } from '../../utils/patientLists/listRules';
import type { PatientMergeSource } from '../../utils/templates/mergeFields';
import { LabelPrintSheet } from '../labels/LabelPrintSheet';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
const nameOf = (member: ListMember): string => `${member.facts.firstName} ${member.facts.lastName}`.trim() || 'A patient';

/**
 * O9: mailing labels for everyone on the list, in list order: the name and postal address (else the home address) as
 * the practice's letters use them, printed on an A4 label sheet or a label printer (src/components/labels). Patients
 * without an address on file get no label and are named; a family at one address can get one label.
 */
export const ListLabelsSheet: React.FC<{ onClose: () => void; list: PatientListRecord; members: readonly ListMember[] }> = ({ onClose, list, members }) => {
  const [sources, setSources] = useState<Map<string, PatientMergeSource> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onePerAddress, setOnePerAddress] = useState(true);

  useEffect(() => {
    let active = true;
    loadMailingSources(members.map(member => member.patientId))
      .then(loaded => active && setSources(loaded))
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not read the addresses.');
      });
    return () => {
      active = false;
    };
    // Read once when the sheet opens (the parent mounts it on open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useMemo(
    () => (sources
      ? mailingRun(members.map(member => ({ patientId: member.patientId, name: nameOf(member), source: sources.get(member.patientId) ?? null })), { onePerAddress })
      : null),
    [sources, members, onePerAddress]
  );

  return (
    <LabelPrintSheet
      open
      onClose={onClose}
      title={`Mailing labels: ${list.name}`}
      subtitle={`${plural(members.length, 'patient')} on the list, in list order`}
      labels={error ? [] : run?.labels ?? null}
      purpose="address"
      look="purple"
    >
      <div className="space-y-3">
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={onePerAddress}
            onChange={event => setOnePerAddress(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span>
            One label per address
            <span className="block text-xs text-gray-500">A family living at one address gets one label: the first of them on the list.</span>
          </span>
        </label>
        {run && run.sameAddress > 0 && (
          <p className="text-sm text-gray-600" role="status">
            {plural(run.sameAddress, 'patient')} {run.sameAddress === 1 ? 'shares' : 'share'} an address with someone before them on the list: no extra label.
          </p>
        )}
        {run && run.withoutAddress.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            <p>{run.withoutAddress.length} of {members.length} have no postal or home address on file, so they get no label.</p>
            <details className="mt-1">
              <summary className="cursor-pointer font-medium">Who they are</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {run.withoutAddress.slice(0, 50).map(patient => <li key={patient.patientId}>{patient.name}</li>)}
              </ul>
              {run.withoutAddress.length > 50 && <p className="mt-1">and {run.withoutAddress.length - 50} more.</p>}
            </details>
          </div>
        )}
      </div>
    </LabelPrintSheet>
  );
};

export default ListLabelsSheet;
