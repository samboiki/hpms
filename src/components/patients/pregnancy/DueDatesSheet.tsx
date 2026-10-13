import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { ListSheet } from '../../patientLists/ListSheet';
import { INPUT, LABEL, SECONDARY_BUTTON } from '../../patientLists/listStyles';
import { patientOverviewLink } from '../../billing/invoiceLinks';
import { DueDatesNotSetUpError, listDueDates, type DuePatient } from '../../../services/pregnancyService';
import { DUE_PERIODS, duePeriodRange, gestationShort, type DuePeriod } from '../../../utils/clinical/pregnancy';
import { formatServiceDate } from '../../../utils/billing/dates';
import { windhoekClock } from '../../../utils/patientLists/listDates';

interface DueDatesSheetProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not_set_up' }
  | { status: 'error'; message: string }
  | { status: 'ready'; patients: DuePatient[]; more: boolean };

/**
 * Messages > Lists > Due dates: the practice's patients with a pregnancy due date in a chosen period, soonest first,
 * with how far along each is. Each name opens the patient's file, where the due date is kept and changed.
 */
export const DueDatesSheet: React.FC<DueDatesSheetProps> = ({ open, onClose, practiceId }) => {
  const [period, setPeriod] = useState<DuePeriod>('next_4_weeks');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const id = useId();
  const todayKey = windhoekClock(new Date()).dateKey;
  const range = duePeriodRange(period, todayKey, { from, to });
  const rangeKey = 'problem' in range ? null : `${range.from}:${range.to}`;

  useEffect(() => {
    if (!open) return;
    if (!rangeKey) {
      setState({ status: 'idle' });
      return;
    }
    const [rangeFrom, rangeTo] = rangeKey.split(':');
    let active = true;
    setState({ status: 'loading' });
    listDueDates(practiceId, { from: rangeFrom, to: rangeTo })
      .then(result => {
        if (active) setState({ status: 'ready', ...result });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState(error instanceof DueDatesNotSetUpError ? { status: 'not_set_up' } : { status: 'error', message: error instanceof Error ? error.message : 'Could not load the due dates.' });
      });
    return () => {
      active = false;
    };
  }, [open, practiceId, rangeKey]);

  const count = state.status === 'ready' ? state.patients.length : 0;

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      title="Pregnancy due dates"
      subtitle="Who is due in the period you choose. The due date is kept on each patient's file."
      size="lg"
      footer={
        <div className="flex justify-end">
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label htmlFor={`${id}-period`} className={LABEL}>
              Due in
            </label>
            <select id={`${id}-period`} className={INPUT} value={period} onChange={event => setPeriod(event.target.value as DuePeriod)}>
              {DUE_PERIODS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <label htmlFor={`${id}-from`} className={LABEL}>
                  From
                </label>
                <input id={`${id}-from`} type="date" className={INPUT} value={from} onChange={event => setFrom(event.target.value)} />
              </div>
              <div>
                <label htmlFor={`${id}-to`} className={LABEL}>
                  To
                </label>
                <input id={`${id}-to`} type="date" className={INPUT} value={to} onChange={event => setTo(event.target.value)} />
              </div>
            </>
          )}
        </div>

        {'problem' in range ? (
          <p className="text-sm text-gray-600">{range.problem}</p>
        ) : (
          <p className="text-sm text-gray-600" aria-live="polite">
            {formatServiceDate(range.from)} to {formatServiceDate(range.to)}
            {state.status === 'ready' && `: ${count} ${count === 1 ? 'patient' : 'patients'}${state.more ? ' (the first 500)' : ''}`}
          </p>
        )}

        {state.status === 'loading' && <p className="text-sm text-gray-500">Loading the due dates...</p>}
        {state.status === 'not_set_up' && <p className="text-sm text-gray-500">Pregnancy due dates are not set up in this database yet.</p>}
        {state.status === 'error' && (
          <p className="text-sm text-red-700" role="alert">
            {state.message}
          </p>
        )}
        {state.status === 'ready' && count === 0 && 'from' in range && (
          <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700">
            Nobody is due in this period. A due date is added on the patient file&apos;s Overview.
          </p>
        )}
        {state.status === 'ready' && count > 0 && (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {state.patients.map(patient => {
              const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient';
              return (
                <li key={patient.patientId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link
                      to={patientOverviewLink(patient.patientId)}
                      className="font-medium text-gray-900 hover:text-purple-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    >
                      {name}
                    </Link>
                    {patient.cellNumber && <p className="text-gray-500">{patient.cellNumber}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatServiceDate(patient.dueDate)}</p>
                    <p className="flex items-center justify-end gap-1 text-gray-500">
                      <Icon icon="solar:heart-pulse-bold-duotone" className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
                      {gestationShort(patient.dueDate, todayKey)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ListSheet>
  );
};

export default DueDatesSheet;
