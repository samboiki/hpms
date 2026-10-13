import React, { useEffect, useId, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Link } from 'react-router-dom';
import { format, isValid, parseISO } from 'date-fns';
import { patientFileLink } from '../debtors/accountText';
import { Field, PrimaryButton, SecondaryButton, inputClass } from '../receipts/ArUi';
import { searchPatients, type PatientMatch } from '../receipts/arService';
import { linkPatientToAccount, unlinkPatientFromAccount } from '../../../services/payerAccountService';
import { referenceNumberProblem, type PayerMember } from '../../../utils/accounts/payerAccounts';

const LINK = 'rounded text-sm font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50';

const when = (timestamp: string | null): string => {
  const date = timestamp ? parseISO(timestamp) : null;
  return date && isValid(date) ? format(date, 'd MMM yyyy') : '';
};

interface CompanyEmployeesProps {
  practiceId: string;
  accountId: string;
  accountName: string;
  members: readonly PayerMember[];
  names: Readonly<Record<string, string>>;
  /** The account is closed: nobody is added */
  closed: boolean;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * The patients a company pays for (parity A14): their visits can be billed to it from the visit's Billing tab. Taking
 * someone off keeps the history (and the visits already billed); the reason is kept.
 */
export const CompanyEmployees: React.FC<CompanyEmployeesProps> = ({ practiceId, accountId, accountName, members, names, closed, onChanged, onError }) => {
  const id = useId();
  const [term, setTerm] = useState('');
  const [matches, setMatches] = useState<PatientMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<PatientMatch | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ patientId: string; reason: string } | null>(null);
  const [showPast, setShowPast] = useState(false);

  const current = members.filter(member => !member.unlinkedAt);
  const past = members.filter(member => member.unlinkedAt);
  const numberProblem = referenceNumberProblem(employeeNumber, 'The employee number');

  // Patients of the practice as reception types (at least two letters)
  useEffect(() => {
    const typed = term.trim();
    if (typed.length < 2 || chosen) {
      setMatches([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchPatients(practiceId, typed)
        .then(found => {
          if (active) setMatches(found.slice(0, 8));
        })
        .catch(error => {
          if (active) onError(error instanceof Error ? plainWords(error.message) : 'The patients could not be searched.');
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [term, chosen, practiceId, onError]);

  const add = async () => {
    if (!chosen || numberProblem) return;
    setBusy('add');
    try {
      await linkPatientToAccount(accountId, chosen.id, employeeNumber);
      onChanged(`${chosen.name} is on ${accountName}'s account. Their visits can now be billed to it.`);
      setChosen(null);
      setTerm('');
      setEmployeeNumber('');
    } catch (error) {
      onError(error instanceof Error ? plainWords(error.message) : 'The patient could not be added.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!removing || removing.reason.trim().length < 3) return;
    setBusy(removing.patientId);
    try {
      await unlinkPatientFromAccount(accountId, removing.patientId, removing.reason.trim());
      onChanged(`${names[removing.patientId] ?? 'The patient'} was taken off the account. Visits already billed to it stay billed to it.`);
      setRemoving(null);
    } catch (error) {
      onError(error instanceof Error ? plainWords(error.message) : 'The patient could not be taken off the account.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-xl border border-gray-200 bg-white">
      <header className="border-b border-gray-100 px-4 py-3">
        <h3 id={`${id}-title`} className="text-sm font-semibold text-gray-900">
          Employees ({current.length})
        </h3>
        <p className="text-xs text-gray-500">Patients this account pays for. A visit of theirs is billed to it from the visit&apos;s Billing tab.</p>
      </header>
      <div className="space-y-3 p-4">
        {current.length === 0 ? (
          <p className="text-sm text-gray-500">Nobody is on this account yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {current.map(member => (
              <li key={member.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-gray-900">
                      {/* The employee's own file (its Billing tab shows the company account they are on) */}
                      <Link to={patientFileLink(member.patientId)} className="hover:text-cyan-700 hover:underline">
                        {names[member.patientId] ?? 'Patient'}
                      </Link>
                    </p>
                    <p className="text-xs text-gray-500">
                      {member.employeeNumber ? `Employee no ${member.employeeNumber} · ` : ''}
                      Since {when(member.linkedAt)}
                    </p>
                  </div>
                  {!closed && removing?.patientId !== member.patientId && (
                    <button type="button" className={LINK} onClick={() => setRemoving({ patientId: member.patientId, reason: '' })} disabled={busy !== null}>
                      Take off
                    </button>
                  )}
                </div>
                {removing?.patientId === member.patientId && (
                  <div className="mt-2 space-y-2 rounded-lg bg-amber-50 p-3">
                    <Field label="Why they come off the account" htmlFor={`${id}-reason`}>
                      <input
                        id={`${id}-reason`}
                        className={inputClass}
                        value={removing.reason}
                        maxLength={300}
                        onChange={event => setRemoving({ ...removing, reason: event.target.value })}
                        placeholder="For example: left the company"
                      />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                      <SecondaryButton onClick={() => setRemoving(null)} disabled={busy !== null}>
                        Keep
                      </SecondaryButton>
                      <PrimaryButton icon="solar:user-minus-rounded-bold-duotone" onClick={() => void remove()} busy={busy === member.patientId} disabled={removing.reason.trim().length < 3}>
                        Take off the account
                      </PrimaryButton>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!closed && (
          <div className="space-y-2 rounded-lg bg-gray-50 p-3">
            <Field label="Add a patient" htmlFor={`${id}-search`} hint={chosen ? undefined : 'Type the name, ID number or cell number'}>
              {chosen ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span className="break-words font-medium text-gray-900">{chosen.name}</span>
                  <button type="button" className={LINK} onClick={() => setChosen(null)}>
                    Choose someone else
                  </button>
                </div>
              ) : (
                <input id={`${id}-search`} type="search" className={inputClass} value={term} onChange={event => setTerm(event.target.value)} autoComplete="off" />
              )}
            </Field>
            {!chosen && term.trim().length >= 2 && (
              <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white" aria-label="Patients found">
                {searching && matches.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
                ) : matches.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500">No patient found.</li>
                ) : (
                  matches.map(match => (
                    <li key={match.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-cyan-50 focus:bg-cyan-50 focus:outline-none disabled:opacity-50"
                        onClick={() => setChosen(match)}
                        disabled={current.some(member => member.patientId === match.id)}
                      >
                        <span className="block break-words font-medium text-gray-900">{match.name}</span>
                        {current.some(member => member.patientId === match.id) && <span className="block text-xs text-gray-500">Already on this account</span>}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            {chosen && (
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Employee number (optional)" htmlFor={`${id}-number`} error={numberProblem} className="min-w-0 flex-1">
                  <input id={`${id}-number`} className={inputClass} value={employeeNumber} maxLength={30} onChange={event => setEmployeeNumber(event.target.value)} />
                </Field>
                <PrimaryButton icon="solar:user-plus-rounded-bold-duotone" onClick={() => void add()} busy={busy === 'add'} disabled={!!numberProblem}>
                  Add to the account
                </PrimaryButton>
              </div>
            )}
          </div>
        )}

        {past.length > 0 && (
          <div>
            <button type="button" className={LINK} onClick={() => setShowPast(value => !value)} aria-expanded={showPast}>
              {showPast ? 'Hide past employees' : `Show past employees (${past.length})`}
            </button>
            {showPast && (
              <ul className="mt-2 divide-y divide-gray-100">
                {past.map(member => (
                  <li key={member.id} className="py-2 text-sm text-gray-500">
                    <span className="break-words">{names[member.patientId] ?? 'Patient'}</span>, off the account {when(member.unlinkedAt)}
                    {member.unlinkReason ? `: ${member.unlinkReason}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default CompanyEmployees;
