import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatServiceDate } from '../../../utils/billing/dates';
import { linkPatientToAccount, removeInjuryCase, unlinkPatientFromAccount } from '../../../services/payerAccountService';
import {
  CASE_TYPE_SHORT,
  caseDetails,
  casePayerName,
  caseState,
  caseTitle,
  type CaseState,
  type InjuryCase
} from '../../../utils/accounts/injuryCases';
import { describeAccount, referenceNumberProblem, sortAccounts } from '../../../utils/accounts/payerAccounts';
import { debtorsLink } from '../../billing/invoiceLinks';
import { usePatientPayers } from './usePatientPayers';
import { InjuryCaseSheet } from './InjuryCaseSheet';

interface PatientPayersRegisterProps {
  practiceId: string;
  patientId: string;
  /** A case's payer changed, so the invoices of its visits did too */
  onInvoicesChanged?: () => void;
}

const PRIMARY = 'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed';
const SECONDARY = 'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
const LINK = 'font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded disabled:opacity-50';
const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30';

const CASE_CHIP: Record<CaseState, { className: string; icon: string; label: string }> = {
  open: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'solar:check-circle-bold-duotone', label: 'Open' },
  closed: { className: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'solar:lock-keyhole-bold-duotone', label: 'Closed' },
  removed: { className: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'solar:trash-bin-trash-bold-duotone', label: 'Removed' }
};

const Chip: React.FC<{ className: string; icon: string; children: React.ReactNode }> = ({ className, icon, children }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${className}`}>
    <Icon icon={icon} className="w-3.5 h-3.5" aria-hidden="true" />
    {children}
  </span>
);

const SectionHeader: React.FC<{ icon: string; title: string; subtitle: string; children?: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
  <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-cyan-50 text-cyan-700">
        <Icon icon={icon} className="w-5 h-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </header>
);

/**
 * The patient's injury on duty, occupational disease and motor vehicle accident cases, and the company accounts that
 * pay for them, on the Billing tab of the patient file (parity A14, A19). A visit is billed under a case or to a
 * company from the visit's Billing tab.
 */
const PatientPayersRegister: React.FC<PatientPayersRegisterProps> = ({ practiceId, patientId, onInvoicesChanged }) => {
  const id = useId();
  const payers = usePatientPayers(practiceId, patientId);
  const [sheet, setSheet] = useState<{ injuryCase: InjuryCase | null } | null>(null);
  const [removing, setRemoving] = useState<{ kind: 'case' | 'account'; id: string; reason: string } | null>(null);
  const [joining, setJoining] = useState<{ accountId: string; employeeNumber: string } | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(() => Object.fromEntries(payers.accounts.map(account => [account.id, account.name])), [payers.accounts]);
  const accountById = useMemo(() => new Map(payers.accounts.map(account => [account.id, account])), [payers.accounts]);
  const memberships = payers.memberships.filter(member => !member.unlinkedAt);
  const joinable = sortAccounts(payers.accounts.filter(account => !account.closedAt && (account.kind === 'employer' || account.kind === 'other') && !memberships.some(member => member.accountId === account.id)));
  const removedCount = payers.cases.filter(item => item.removedAt).length;
  const cases = [...payers.cases]
    .filter(item => showRemoved || !item.removedAt)
    .sort((a, b) => Number(caseState(a) !== 'open') - Number(caseState(b) !== 'open') || b.injuryDate.localeCompare(a.injuryDate));

  if (payers.status === 'not_set_up') {
    return (
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader icon="solar:adhesive-plaster-bold-duotone" title="Injury and accident cases" subtitle="Injuries on duty, occupational diseases and road accidents, and the companies that pay for this patient." />
        <p className="px-4 py-4 text-sm text-gray-600">Injury cases and company accounts are not set up in this database yet, so they cannot be recorded here.</p>
      </section>
    );
  }
  const loading = payers.status === 'loading';

  const run = async (key: string, work: () => Promise<void>, done: string, invoices = false) => {
    setBusy(key);
    setError(null);
    try {
      await work();
      setNotice(done);
      payers.reload();
      if (invoices) onInvoicesChanged?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = () => {
    if (!removing || removing.reason.trim().length < 3) return;
    const target = removing;
    if (target.kind === 'case') {
      void run(target.id, () => removeInjuryCase(target.id, target.reason.trim()), 'The case was removed. It stays on the file as removed.');
    } else {
      void run(target.id, () => unlinkPatientFromAccount(target.id, patientId, target.reason.trim()), `The patient is no longer on ${names[target.id] ?? 'the account'}. Visits already billed to it stay billed to it.`);
    }
    setRemoving(null);
  };

  const join = () => {
    if (!joining?.accountId) return;
    const target = joining;
    if (referenceNumberProblem(target.employeeNumber, 'The employee number')) return;
    void run('join', () => linkPatientToAccount(target.accountId, patientId, target.employeeNumber), `The patient is on ${names[target.accountId] ?? 'the account'}. Their visits can be billed to it from the visit's Billing tab.`);
    setJoining(null);
  };

  const reasonBox = (label: string, placeholder: string) =>
    removing && (
      <div className="mt-2 space-y-2 rounded-lg bg-amber-50 p-3">
        <label htmlFor={`${id}-reason`} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <input id={`${id}-reason`} className={INPUT} value={removing.reason} maxLength={300} onChange={event => setRemoving({ ...removing, reason: event.target.value })} placeholder={placeholder} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={SECONDARY} onClick={() => setRemoving(null)}>
            Keep
          </button>
          <button type="button" className={PRIMARY} onClick={confirmRemove} disabled={removing.reason.trim().length < 3}>
            Confirm
          </button>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      {(notice || error || payers.error) && (
        <div
          className={`flex items-start justify-between gap-3 p-3 rounded-lg text-sm ${error || payers.error ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800'}`}
          role={error || payers.error ? 'alert' : 'status'}
        >
          <span className="flex items-start gap-2">
            <Icon icon={error || payers.error ? 'solar:danger-triangle-bold-duotone' : 'solar:check-circle-bold-duotone'} className="mt-0.5 w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {error ?? payers.error ?? notice}
          </span>
          <button type="button" onClick={() => { setNotice(null); setError(null); }} className="font-medium underline">Dismiss</button>
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader
          icon="solar:adhesive-plaster-bold-duotone"
          title="Injury and accident cases"
          subtitle="Injuries on duty, occupational diseases and road accidents. Entered once; each visit of the case is billed to whoever pays it."
        >
          <button type="button" className={PRIMARY} onClick={() => setSheet({ injuryCase: null })} disabled={loading}>
            <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            Add case
          </button>
        </SectionHeader>
        <div className="p-4">
          {loading ? (
            <div className="space-y-2" role="status" aria-label="Loading cases">
              {[0, 1].map(index => <div key={index} className="h-10 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" />)}
            </div>
          ) : cases.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No cases on file. Add one when the patient comes for an injury on duty or a road accident.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {cases.map(item => {
                const state = caseState(item);
                const chip = CASE_CHIP[state];
                return (
                  <li key={item.id} className={`py-3 ${item.removedAt ? 'text-gray-400' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 break-words">{caseTitle(item)}</p>
                        <p className="mt-0.5 text-xs text-gray-500 break-words">{caseDetails(item, names)}</p>
                        <p className="mt-0.5 text-xs text-gray-500 break-words">Paid by {casePayerName(item, names)}</p>
                        {item.notes && <p className="mt-1 text-sm text-gray-700 break-words">{item.notes}</p>}
                      </div>
                      <Chip className={chip.className} icon={chip.icon}>
                        {CASE_TYPE_SHORT[item.type]} · {chip.label}
                      </Chip>
                    </div>
                    {!item.removedAt && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <button type="button" className={LINK} onClick={() => setSheet({ injuryCase: item })} disabled={busy === item.id}>Change</button>
                        <button type="button" className={LINK} onClick={() => setRemoving({ kind: 'case', id: item.id, reason: '' })} disabled={busy === item.id}>
                          {busy === item.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    )}
                    {removing?.kind === 'case' && removing.id === item.id && reasonBox('Why the case is removed', 'For example: recorded on the wrong patient')}
                  </li>
                );
              })}
            </ul>
          )}
          {removedCount > 0 && (
            <button type="button" className={`mt-2 text-sm ${LINK}`} onClick={() => setShowRemoved(value => !value)} aria-pressed={showRemoved}>
              {showRemoved ? 'Hide removed cases' : `Show removed cases (${removedCount})`}
            </button>
          )}
        </div>
      </section>

      {!loading && (memberships.length > 0 || joinable.length > 0) && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <SectionHeader icon="solar:buildings-2-bold-duotone" title="Company accounts" subtitle="Employers that pay for this patient's visits. Their statements are under Finance > Debtors > Companies.">
            {joinable.length > 0 && !joining && (
              <button type="button" className={SECONDARY} onClick={() => setJoining({ accountId: '', employeeNumber: '' })}>
                <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
                Add to a company account
              </button>
            )}
          </SectionHeader>
          <div className="space-y-3 p-4">
            {memberships.length === 0 ? (
              <p className="text-sm text-gray-500">No company pays for this patient.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {memberships.map(member => {
                  const account = accountById.get(member.accountId);
                  return (
                    <li key={member.id} className="py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 text-sm">
                          <p className="font-medium text-gray-900 break-words">{account ? describeAccount(account) : 'Company account'}</p>
                          <p className="text-xs text-gray-500">
                            {member.employeeNumber ? `Employee no ${member.employeeNumber} · ` : ''}
                            {member.linkedAt ? `Since ${formatServiceDate(member.linkedAt.slice(0, 10))}` : ''}
                            {account?.closedAt ? ' · Account closed' : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 text-sm">
                          <Link to={debtorsLink('companies', member.accountId)} className={LINK} title="Finance > Debtors > Companies">Account in Finance</Link>
                          <button type="button" className={LINK} onClick={() => setRemoving({ kind: 'account', id: member.accountId, reason: '' })} disabled={busy === member.accountId}>
                            Take off
                          </button>
                        </div>
                      </div>
                      {removing?.kind === 'account' && removing.id === member.accountId && reasonBox('Why the patient comes off the account', 'For example: left the company')}
                    </li>
                  );
                })}
              </ul>
            )}
            {joining && (
              <div className="grid gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                <div>
                  <label htmlFor={`${id}-account`} className="mb-1 block text-sm font-medium text-gray-700">Company account</label>
                  <select id={`${id}-account`} className={INPUT} value={joining.accountId} onChange={event => setJoining({ ...joining, accountId: event.target.value })}>
                    <option value="">Choose the company</option>
                    {joinable.map(account => <option key={account.id} value={account.id}>{describeAccount(account)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${id}-number`} className="mb-1 block text-sm font-medium text-gray-700">Employee number</label>
                  <input id={`${id}-number`} className={INPUT} value={joining.employeeNumber} maxLength={30} onChange={event => setJoining({ ...joining, employeeNumber: event.target.value })} />
                  {referenceNumberProblem(joining.employeeNumber, 'The employee number') && (
                    <p className="mt-1 text-xs text-red-600" role="alert">{referenceNumberProblem(joining.employeeNumber, 'The employee number')}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" className={SECONDARY} onClick={() => setJoining(null)}>Cancel</button>
                  <button type="button" className={PRIMARY} onClick={join} disabled={!joining.accountId || busy === 'join'}>Add</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {sheet && (
        <InjuryCaseSheet
          practiceId={practiceId}
          patientId={patientId}
          injuryCase={sheet.injuryCase}
          accounts={payers.accounts}
          onClose={() => setSheet(null)}
          onSaved={(saved, visitsMoved) => {
            setSheet(null);
            // A fund's account made for this first case is not in the list read before
            const payer = saved.payerAccountId ? names[saved.payerAccountId] ?? "the case's payer" : 'the patient';
            setNotice(
              `${sheet.injuryCase ? 'The case was changed.' : 'The case was added.'}${visitsMoved > 0 ? ` ${visitsMoved} ${visitsMoved === 1 ? 'visit is' : 'visits are'} now billed to ${payer}.` : ''} Bill a visit under it from the visit's Billing tab.`
            );
            payers.reload();
            if (visitsMoved > 0) onInvoicesChanged?.();
          }}
        />
      )}
    </div>
  );
};

export default PatientPayersRegister;
