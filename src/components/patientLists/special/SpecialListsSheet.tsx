import React, { useEffect, useId, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Link } from 'react-router-dom';
import { ListSheet } from '../ListSheet';
import { CHIP, INPUT, LABEL, SECONDARY_BUTTON } from '../listStyles';
import { patientAccountLink, patientOverviewLink } from '../../billing/invoiceLinks';
import { downloadCsv, exportFileName, toCsv } from '../../finance/financeExport';
import { formatServiceDate } from '../../../utils/billing/dates';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { windhoekClock } from '../../../utils/patientLists/listDates';
import { CASE_TYPE_LABELS, INJURY_CASE_TYPES, caseDetails, casePayerName, caseState, type InjuryCaseType } from '../../../utils/accounts/injuryCases';
import {
  DEFAULT_CASE_FILTER,
  REFERRAL_PERIODS,
  SPECIAL_LISTS,
  casesCsv,
  filterCases,
  handedOverCsv,
  referralRange,
  referredCsv,
  type CaseFilter,
  type CaseStateFilter,
  type ListCsv,
  type ReferralPeriod,
  type SpecialList
} from '../../../utils/patientLists/specialLists';
import { isPayersNotSetUp, loadPayerAccounts, loadPracticeCases, type PracticeCase } from '../../../services/payerAccountService';
import { ListNotSetUpError, loadHandedOverAccounts, loadReferredPatients, type HandedOverAccount, type ReferredPatient } from '../../../services/specialListsService';

interface SpecialListsSheetProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
}

type Loaded<T> = { status: 'loading' } | { status: 'not_set_up'; what: string } | { status: 'error'; message: string } | ({ status: 'ready' } & T);

const NAME = 'font-medium text-gray-900 hover:text-purple-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';
const STATE_CHOICES: Array<{ value: CaseStateFilter; label: string }> = [
  { value: 'open', label: 'Open cases' },
  { value: 'closed', label: 'Closed cases' },
  { value: 'all', label: 'Open and closed' }
];

/** A list's table missing is "not set up yet"; anything else says what failed */
const failed = (error: unknown, what: string): { status: 'not_set_up'; what: string } | { status: 'error'; message: string } =>
  error instanceof ListNotSetUpError || isPayersNotSetUp(error)
    ? { status: 'not_set_up', what }
    : { status: 'error', message: error instanceof Error ? plainWords(error.message) : 'The list could not be loaded.' };

/**
 * Messages > Lists > Special lists (parity R29): injury on duty and accident cases, accounts handed over to a debt
 * collector and referred patients, each with a CSV. Each name opens the patient's file. Read only.
 */
export const SpecialListsSheet: React.FC<SpecialListsSheetProps> = ({ open, onClose, practiceId }) => {
  const id = useId();
  const [list, setList] = useState<SpecialList>('cases');
  const [caseFilter, setCaseFilter] = useState<CaseFilter>(DEFAULT_CASE_FILTER);
  const [period, setPeriod] = useState<ReferralPeriod>('last_30');
  const todayKey = windhoekClock(new Date()).dateKey;
  const range = referralRange(period, todayKey);
  const [cases, setCases] = useState<Loaded<{ rows: PracticeCase[]; names: Record<string, string> }>>({ status: 'loading' });
  const [handedOver, setHandedOver] = useState<Loaded<{ rows: HandedOverAccount[] }>>({ status: 'loading' });
  const [referred, setReferred] = useState<Loaded<{ rows: ReferredPatient[]; more: boolean }>>({ status: 'loading' });

  useEffect(() => {
    if (!open || list !== 'cases') return;
    let active = true;
    setCases({ status: 'loading' });
    Promise.all([loadPracticeCases(practiceId), loadPayerAccounts(practiceId)])
      .then(([rows, accounts]) => {
        if (active) setCases({ status: 'ready', rows, names: Object.fromEntries(accounts.map(account => [account.id, account.name])) });
      })
      .catch(error => {
        if (active) setCases(failed(error, 'Injury and accident cases'));
      });
    return () => {
      active = false;
    };
  }, [open, list, practiceId]);

  useEffect(() => {
    if (!open || list !== 'handed_over') return;
    let active = true;
    setHandedOver({ status: 'loading' });
    loadHandedOverAccounts(practiceId)
      .then(rows => {
        if (active) setHandedOver({ status: 'ready', rows });
      })
      .catch(error => {
        if (active) setHandedOver(failed(error, 'Account flags'));
      });
    return () => {
      active = false;
    };
  }, [open, list, practiceId]);

  const rangeKey = `${range.from}:${range.to}`;
  useEffect(() => {
    if (!open || list !== 'referred') return;
    const [from, to] = rangeKey.split(':');
    let active = true;
    setReferred({ status: 'loading' });
    loadReferredPatients(practiceId, { from, to })
      .then(result => {
        if (active) setReferred({ status: 'ready', rows: result.patients, more: result.more });
      })
      .catch(error => {
        if (active) setReferred(failed(error, 'Referrals'));
      });
    return () => {
      active = false;
    };
  }, [open, list, practiceId, rangeKey]);

  const shownCases = useMemo(() => (cases.status === 'ready' ? filterCases(cases.rows, caseFilter) : []), [cases, caseFilter]);
  const choice = SPECIAL_LISTS.find(item => item.value === list) ?? SPECIAL_LISTS[0];

  const csv: ListCsv | null =
    list === 'cases' && cases.status === 'ready'
      ? casesCsv(shownCases, cases.names)
      : list === 'handed_over' && handedOver.status === 'ready'
        ? handedOverCsv(handedOver.rows)
        : list === 'referred' && referred.status === 'ready'
          ? referredCsv(referred.rows)
          : null;
  const download = () => {
    if (!csv) return;
    downloadCsv(exportFileName(`${choice.label} ${todayKey}`), toCsv(csv.headers.map(header => ({ header, type: 'text' as const })), csv.rows));
  };

  const status = (state: Loaded<object>, empty: string, count: number) => {
    if (state.status === 'loading') return <p className="text-sm text-gray-500">Loading the list...</p>;
    if (state.status === 'not_set_up') return <p className="text-sm text-gray-500">{state.what} are not set up in this database yet.</p>;
    if (state.status === 'error') {
      return (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      );
    }
    if (count === 0) return <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700">{empty}</p>;
    return null;
  };

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      title="Special lists"
      subtitle="Patients by what is on their files: injury cases, accounts with a collector, referrals."
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON} onClick={download} disabled={!csv || csv.rows.length === 0}>
            Download CSV
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-list`} className={LABEL}>
            List
          </label>
          <select id={`${id}-list`} className={INPUT} value={list} onChange={event => setList(event.target.value as SpecialList)}>
            {SPECIAL_LISTS.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{choice.hint}</p>
        </div>

        {list === 'cases' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-type`} className={LABEL}>
                  Kind
                </label>
                <select
                  id={`${id}-type`}
                  className={INPUT}
                  value={caseFilter.type}
                  onChange={event => setCaseFilter(current => ({ ...current, type: event.target.value as InjuryCaseType | 'all' }))}
                >
                  <option value="all">Every kind</option>
                  {INJURY_CASE_TYPES.map(type => (
                    <option key={type} value={type}>
                      {CASE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-state`} className={LABEL}>
                  Cases
                </label>
                <select
                  id={`${id}-state`}
                  className={INPUT}
                  value={caseFilter.state}
                  onChange={event => setCaseFilter(current => ({ ...current, state: event.target.value as CaseStateFilter }))}
                >
                  {STATE_CHOICES.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {status(cases, 'No case matches. A case is added on the patient file, Account tab.', shownCases.length)}
            {cases.status === 'ready' && shownCases.length > 0 && (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" aria-label="Injury and accident cases">
                {shownCases.map(row => (
                  <li key={row.injuryCase.id} className="space-y-0.5 px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <Link to={patientAccountLink(row.injuryCase.patientId)} className={NAME}>
                        {row.patientName}
                      </Link>
                      <span className={`${CHIP} ${caseState(row.injuryCase) === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {CASE_TYPE_LABELS[row.injuryCase.type]}, {formatServiceDate(row.injuryCase.injuryDate)}
                      </span>
                    </div>
                    <p className="break-words text-gray-600">{caseDetails(row.injuryCase, cases.names)}</p>
                    <p className="text-xs text-gray-500">
                      Paid by {casePayerName(row.injuryCase, cases.names)} · {row.visitCount} {row.visitCount === 1 ? 'visit' : 'visits'}
                      {row.lastVisit ? `, last ${formatServiceDate(row.lastVisit)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {list === 'handed_over' && (
          <>
            {status(handedOver, 'No account is handed over. An account is flagged "Handed over" on the patient file, Account tab.', handedOver.status === 'ready' ? handedOver.rows.length : 0)}
            {handedOver.status === 'ready' && handedOver.rows.length > 0 && (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" aria-label="Accounts handed over">
                {handedOver.rows.map(row => (
                  <li key={row.patientId} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link to={patientAccountLink(row.patientId)} className={NAME}>
                        {row.name}
                      </Link>
                      <p className="text-gray-500">
                        Handed over {formatServiceDate(row.setAt.slice(0, 10))}
                        {row.people > 1 ? ` · ${row.people} patients on the account` : ''}
                      </p>
                      {row.reason && <p className="break-words text-gray-600">{row.reason}</p>}
                    </div>
                    <p className="text-right font-medium tabular-nums text-gray-900">{row.owedCents === null ? 'Owed: not known' : `${formatNad(fromCents(row.owedCents))} owed`}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {list === 'referred' && (
          <>
            <div className="sm:max-w-xs">
              <label htmlFor={`${id}-period`} className={LABEL}>
                Letters dated in
              </label>
              <select id={`${id}-period`} className={INPUT} value={period} onChange={event => setPeriod(event.target.value as ReferralPeriod)}>
                {REFERRAL_PERIODS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-600" aria-live="polite">
              {formatServiceDate(range.from)} to {formatServiceDate(range.to)}
              {referred.status === 'ready' && `: ${referred.rows.length} ${referred.rows.length === 1 ? 'referral' : 'referrals'}${referred.more ? ' (the first 1,000)' : ''}`}
            </p>
            {status(referred, 'No referral letter is dated in this period. Referrals are added on the patient file, Account tab.', referred.status === 'ready' ? referred.rows.length : 0)}
            {referred.status === 'ready' && referred.rows.length > 0 && (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" aria-label="Referred patients">
                {referred.rows.map(row => (
                  <li key={row.referralId} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link to={patientOverviewLink(row.patientId)} className={NAME}>
                        {row.name}
                      </Link>
                      <p className="break-words text-gray-500">Referred by {row.referringName}</p>
                      {row.reason && <p className="break-words text-gray-600">{row.reason}</p>}
                    </div>
                    <div className="text-right text-gray-600">
                      <p>{formatServiceDate(row.referralDate)}</p>
                      {row.validUntil && <p className="text-xs text-gray-500">Valid until {formatServiceDate(row.validUntil)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </ListSheet>
  );
};

export default SpecialListsSheet;
