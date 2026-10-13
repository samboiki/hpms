import React, { useMemo, useState } from 'react';
import { MOVEMENT_KINDS, type MovementKind } from '../../../services/ledgerService';
import type { PeriodLabels } from '../financeNav';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import {
  filterTransactions,
  practiceTransactions,
  practitionerLabel,
  totalsByPractitioner,
  transactionDetailTable,
  transactionPractitionerTable,
  transactionTypeTable
} from './practiceTransactions';
import { loadTransactions } from './practiceReportsService';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

type View = 'detail' | 'types' | 'practitioners';

const VIEWS = [
  { value: 'detail' as const, label: 'Every entry', icon: 'solar:list-bold-duotone' },
  { value: 'types' as const, label: 'By type', icon: 'solar:layers-minimalistic-bold-duotone' },
  { value: 'practitioners' as const, label: 'By practitioner', icon: 'solar:users-group-rounded-bold-duotone' }
];

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  staffNames: Record<string, string>;
}

/** Practice transactions (parity R5): every entry of the period, by type and practitioner, as detail and summary */
export const TransactionsReport: React.FC<Props> = ({ practiceId, practiceName, labels, staffNames }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadTransactions(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'Practice transactions need receipts set up in this database (proposals/2026-10-07-receipts-and-allocations.sql).'
  );
  const [view, setView] = useState<View>('detail');
  const [kind, setKind] = useState<MovementKind | ''>('');
  const [practitioner, setPractitioner] = useState('');
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: data?.patientNames ?? {}, onChanged: retry });

  const rows = useMemo(() => (data ? practiceTransactions(data.sources, range) : []), [data, range]);
  const practitioners = useMemo(() => totalsByPractitioner(rows).map(total => total.practitioner), [rows]);
  const filtered = useMemo(() => filterTransactions(rows, { kind: kind || null, practitioner: practitioner || null }), [rows, kind, practitioner]);
  const scope = practitioner ? ` · ${practitionerLabel(practitioner, staffNames)}` : '';
  const report = useMemo(() => {
    if (!data) return null;
    if (view === 'types') return transactionTypeTable(filtered, `${labels.current}${scope}`);
    if (view === 'practitioners') return transactionPractitionerTable(filterTransactions(rows, { kind: kind || null, practitioner: null }), labels.current, staffNames);
    return transactionDetailTable({ rows: filtered, periodLabel: `${labels.current}${scope}`, patientNames: data.patientNames, staffNames });
  }, [data, view, filtered, rows, kind, labels, scope, staffNames]);

  return (
    <>
      <ReportFrame
        title="Practice transactions"
        subtitle={`Entries dated ${labels.current}`}
        icon="solar:document-text-bold-duotone"
        tone="cyan"
        exportKey={view === 'detail' ? 'transactions' : view === 'types' ? 'transactions_by_type' : 'transactions_by_practitioner'}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ type: kind || null, practitioner: practitioner || null }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'No entries in this period', hint: 'Invoices, payments, credit notes, write-offs, corrections and refunds dated in the period appear here.' }}
        onOpen={open}
        resetKey={`${view}|${kind}|${practitioner}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Practice transactions views" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Type" htmlFor="transactions-type">
                <select id="transactions-type" className={inputClass} value={kind} onChange={event => setKind(event.target.value as MovementKind | '')}>
                  <option value="">Every type</option>
                  {MOVEMENT_KINDS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </Field>
              {view !== 'practitioners' && (
                <Field label="Practitioner" htmlFor="transactions-practitioner">
                  <select id="transactions-practitioner" className={inputClass} value={practitioner} onChange={event => setPractitioner(event.target.value)}>
                    <option value="">All practitioners</option>
                    {practitioners.map(key => <option key={key} value={key}>{practitionerLabel(key, staffNames)}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </div>
        }
        onRowClick={view === 'practitioners' && report ? index => {
          const key = totalsByPractitioner(filterTransactions(rows, { kind: kind || null, practitioner: null }))[index]?.practitioner;
          if (key) {
            setPractitioner(key);
            setView('detail');
          }
        } : view === 'types' ? index => {
          const next = report?.table.rows[index]?.[0];
          const match = MOVEMENT_KINDS.find(option => option.label === next);
          if (match) {
            setKind(match.key);
            setView('detail');
          }
        } : undefined}
        rowLabel={view === 'practitioners' ? index => `Show the entries of ${String(report?.table.rows[index]?.[0] ?? '')}`
          : view === 'types' ? index => `Show the ${String(report?.table.rows[index]?.[0] ?? '').toLowerCase()}` : undefined}
      />
      {element}
    </>
  );
};
