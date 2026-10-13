import React from 'react';
import { Icon } from '@iconify/react';
import { format, isValid, parseISO } from 'date-fns';
import { EmptyState } from '../../finance/FinanceUI';
import type { FundMoveRecord } from '../../../services/fundMoveService';

const when = (timestamp: string): string => {
  const date = parseISO(timestamp);
  return isValid(date) ? format(date, 'd MMM yyyy, HH:mm') : '';
};

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** The moves made so far, as each was recorded: from where to where, when, by whom, how many and why */
export const FundMoveHistoryList: React.FC<{ records: readonly FundMoveRecord[] }> = ({ records }) => {
  if (records.length === 0) {
    return (
      <EmptyState
        icon="solar:history-bold-duotone"
        title="No moves yet"
        message="Moves of patients to another fund or option are listed here, with the reason given."
        compact
      />
    );
  }
  return (
    <ul className="space-y-3">
      {records.map(record => (
        <li key={record.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-900">
            <span className="break-words">{record.fromLabel || 'Fund not recorded'}</span>
            <Icon icon="solar:arrow-right-bold-duotone" className="h-4 w-4 flex-none text-gray-400" aria-label="to" />
            <strong className="break-words">
              {record.toProvider}
              {record.toOption ? `, option ${record.toOption}` : ''}
            </strong>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {when(record.movedAt)}
            {record.movedByName ? ` by ${record.movedByName}` : ''}
          </p>
          <p className="mt-2 text-sm text-gray-700">
            {plural(record.patientCount, 'patient', 'patients')} moved
            {record.claimsMoved > 0 ? `; ${plural(record.claimsMoved, 'claim not sent yet', 'claims not sent yet')} went to the new fund's batch` : ''}.
          </p>
          <p className="mt-1 break-words text-sm text-gray-600">Reason: {record.reason}</p>
        </li>
      ))}
    </ul>
  );
};

export default FundMoveHistoryList;
