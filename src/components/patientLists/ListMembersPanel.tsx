import React, { useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { patientListService, type PatientListRecord } from '../../services/patientListService';
import type { ListMember, PatientFacts, ResolvedList } from '../../utils/patientLists/listRules';
import { formatPhoneForDisplay, normalizePhoneNumber } from '../patients/patientContact';
import { ListSheet } from './ListSheet';
import { buildMembersCsv, csvFileName, formatDateKey, memberReason } from './listDisplay';
import { CARD, CHIP, INPUT, QUIET_BUTTON, SECONDARY_BUTTON } from './listStyles';

interface ListMembersPanelProps {
  list: PatientListRecord;
  resolved: ResolvedList | undefined;
  /** Every patient of the practice (for "Add patients") */
  facts: readonly PatientFacts[];
  factsLoaded: boolean;
  factsError: string | null;
  practiceId: string;
  userId: string | null;
  todayKey: string;
  /** Member rows changed: reload them */
  onChanged: () => Promise<void> | void;
}

const PAGE = 100;

const fullName = (facts: PatientFacts): string => `${facts.firstName} ${facts.lastName}`.trim() || 'Unnamed patient';
const initials = (facts: PatientFacts): string =>
  `${facts.firstName.charAt(0)}${facts.lastName.charAt(0)}`.toUpperCase() || '?';

const matchesSearch = (facts: PatientFacts, query: string): boolean => {
  if (!query) return true;
  const digits = query.replace(/\D/g, '');
  const text = `${facts.firstName} ${facts.lastName}`.toLowerCase();
  return (
    query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => text.includes(word)) ||
    (digits.length >= 3 && (facts.cellNumber ?? '').replace(/\D/g, '').includes(digits))
  );
};

const lastSentText = (member: ListMember): string | null => {
  if (!member.lastSentAt) return null;
  const sent = new Date(member.lastSentAt);
  return Number.isNaN(sent.getTime()) ? null : `Messaged ${format(sent, 'd MMM yyyy')}`;
};

const PhoneLine: React.FC<{ facts: PatientFacts }> = ({ facts }) => {
  if (facts.smsOptOut) {
    return <span className={`${CHIP} bg-gray-100 text-gray-600`}>No SMS (opted out)</span>;
  }
  const phone = normalizePhoneNumber(facts.cellNumber);
  if (!phone) {
    return (
      <span className={`${CHIP} bg-amber-50 text-amber-700`}>
        <Icon icon="solar:smartphone-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
        {facts.cellNumber ? 'Cell number not valid' : 'No cell number'}
      </span>
    );
  }
  return <span className="text-xs tabular-nums text-gray-500">{formatPhoneForDisplay(phone)}</span>;
};

/** The people on a list: why each one is there, take someone off or put them back, add, export. */
export const ListMembersPanel: React.FC<ListMembersPanelProps> = ({
  list,
  resolved,
  facts,
  factsLoaded,
  factsError,
  practiceId,
  userId,
  todayKey,
  onChanged
}) => {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const members = useMemo(() => resolved?.members ?? [], [resolved]);
  const excluded = resolved?.excluded ?? [];
  const filtered = useMemo(() => members.filter((member) => matchesSearch(member.facts, query.trim())), [members, query]);
  const withoutCell = members.filter((member) => !normalizePhoneNumber(member.facts.cellNumber)).length;

  const setExcluded = async (member: ListMember, value: boolean) => {
    setBusyId(member.patientId);
    try {
      await patientListService.setExcluded(practiceId, list.id, member.patientId, value, userId);
      await onChanged();
      const name = fullName(member.facts);
      toast.success(value ? `${name} was taken off "${list.name}".` : `${name} is back on "${list.name}".`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the list.');
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    if (members.length === 0) {
      toast.error('There is nobody on this list to export.');
      return;
    }
    const blob = new Blob([buildMembersCsv(members, list.rule, todayKey)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvFileName(list.name, todayKey);
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${members.length} patient${members.length === 1 ? '' : 's'}.`);
  };

  if (factsError) {
    return (
      <div className={`${CARD} flex items-start gap-2 p-4 text-sm text-red-700`} role="alert">
        <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>Patient details could not be loaded, so the list cannot be shown: {factsError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon
            icon="solar:magnifer-bold-duotone"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PAGE);
            }}
            placeholder="Search name or cell number"
            className={`${INPUT} pl-9`}
            aria-label="Search this list"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAddOpen(true)} disabled={!factsLoaded} className={`${SECONDARY_BUTTON} flex-1 sm:flex-none`}>
            <Icon icon="solar:user-plus-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Add patients
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!factsLoaded}
            className={`${SECONDARY_BUTTON} flex-1 sm:flex-none`}
            title="Download this list as a CSV file (opens in Excel)"
          >
            <Icon icon="solar:file-download-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      {!factsLoaded ? (
        <div className={`${CARD} space-y-3 p-4`} aria-busy="true" aria-label="Loading patients">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex animate-pulse items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-gray-100" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className={`${CARD} px-4 py-10 text-center`}>
          <Icon icon="solar:users-group-rounded-bold-duotone" className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-900">Nobody is on this list today</p>
          <p className="mt-1 text-sm text-gray-500">
            {list.kind === 'smart'
              ? 'Patients appear here by themselves as soon as they match. You can also add someone by hand.'
              : 'Add patients here, or tick patients on the Patients page and choose "Add to list".'}
          </p>
        </div>
      ) : (
        <div className={CARD}>
          <p className="border-b border-gray-100 px-4 py-2.5 text-xs text-gray-500">
            {members.length} patient{members.length === 1 ? '' : 's'}
            {withoutCell > 0 && ` · ${withoutCell} without a usable cell number`}
            {query.trim() && ` · ${filtered.length} match "${query.trim()}"`}
          </p>
          <ul className="divide-y divide-gray-100">
            {filtered.slice(0, shown).map((member) => {
              const sentText = lastSentText(member);
              return (
                <li key={member.patientId} className="flex items-start gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 text-xs font-semibold text-indigo-700">
                    {initials(member.facts)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium text-gray-900">{fullName(member.facts)}</span>
                      {list.kind === 'smart' && (
                        <span className={`${CHIP} ${member.automatic ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'}`}>
                          {member.automatic ? 'Automatic' : 'Added by hand'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{memberReason(member, list.rule, todayKey)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <PhoneLine facts={member.facts} />
                      {sentText && <span className="text-xs text-gray-400">{sentText}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void setExcluded(member, true)}
                    disabled={busyId === member.patientId}
                    className={`${QUIET_BUTTON} shrink-0`}
                    title={
                      member.automatic
                        ? 'Take this patient off the list. The rule will not add them again.'
                        : 'Take this patient off the list.'
                    }
                    aria-label={`Take ${fullName(member.facts)} off the list`}
                  >
                    <Icon icon="solar:user-minus-rounded-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{member.automatic ? 'Exclude' : 'Remove'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length > shown && (
            <div className="border-t border-gray-100 p-3 text-center">
              <button type="button" onClick={() => setShown(shown + PAGE)} className={QUIET_BUTTON}>
                Show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length - shown}
              </button>
            </div>
          )}
        </div>
      )}

      {excluded.length > 0 && (
        <div className={CARD}>
          <button
            type="button"
            onClick={() => setShowExcluded(!showExcluded)}
            aria-expanded={showExcluded}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <span className="flex items-center gap-2">
              <Icon icon="solar:eye-closed-bold-duotone" className="h-4 w-4 text-gray-400" aria-hidden="true" />
              Taken off this list ({excluded.length})
            </span>
            <Icon
              icon="solar:alt-arrow-down-bold-duotone"
              className={`h-4 w-4 text-gray-400 transition-transform ${showExcluded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {showExcluded && (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {excluded.map((member) => (
                <li key={member.patientId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{fullName(member.facts)}</span>
                  <button
                    type="button"
                    onClick={() => void setExcluded(member, false)}
                    disabled={busyId === member.patientId}
                    className={QUIET_BUTTON}
                  >
                    <Icon icon="solar:undo-left-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    Put back
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {addOpen && (
        <AddPatientsSheet
          list={list}
          practiceId={practiceId}
          facts={facts}
          memberIds={new Set(members.map((member) => member.patientId))}
          onClose={() => setAddOpen(false)}
          onAdded={onChanged}
        />
      )}
    </div>
  );
};

const AddPatientsSheet: React.FC<{
  list: PatientListRecord;
  practiceId: string;
  facts: readonly PatientFacts[];
  memberIds: ReadonlySet<string>;
  onClose: () => void;
  onAdded: () => Promise<void> | void;
}> = ({ list, practiceId, facts, memberIds, onClose, onAdded }) => {
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed.length < 2 ? [] : facts.filter((patient) => matchesSearch(patient, trimmed)).slice(0, 30)),
    [facts, trimmed]
  );

  const add = async (patient: PatientFacts) => {
    setBusyId(patient.patientId);
    try {
      await patientListService.addPatients(practiceId, list.id, [patient.patientId]);
      setAdded((previous) => new Set(previous).add(patient.patientId));
      await onAdded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the patient.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ListSheet
      open
      onClose={onClose}
      title={`Add patients to "${list.name}"`}
      subtitle="Search by name or cell number."
      initialFocus={searchRef}
    >
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type at least 2 letters"
        className={INPUT}
        aria-label="Search patients"
      />
      <ul className="mt-3 divide-y divide-gray-100">
        {results.map((patient) => {
          const onList = memberIds.has(patient.patientId) || added.has(patient.patientId);
          return (
            <li key={patient.patientId} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{fullName(patient)}</p>
                <p className="text-xs text-gray-500">
                  {patient.dateOfBirth ? `Born ${formatDateKey(patient.dateOfBirth)}` : 'No date of birth'}
                  {patient.cellNumber ? ` · ${patient.cellNumber}` : ''}
                </p>
              </div>
              {onList ? (
                <span className={`${CHIP} bg-emerald-50 text-emerald-700`}>
                  <Icon icon="solar:check-circle-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
                  On the list
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void add(patient)}
                  disabled={busyId !== null}
                  className={QUIET_BUTTON}
                  aria-label={`Add ${fullName(patient)}`}
                >
                  <Icon
                    icon={busyId === patient.patientId ? 'solar:refresh-bold-duotone' : 'solar:add-circle-bold-duotone'}
                    className={`h-4 w-4 text-purple-600 ${busyId === patient.patientId ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  Add
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {trimmed.length >= 2 && results.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">No patient matches "{trimmed}".</p>
      )}
    </ListSheet>
  );
};

export default ListMembersPanel;
