import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  AGE_BANDS,
  DEFAULT_WORK_LIST_FILTER,
  ESCALATION_LABELS,
  PATIENT_ACCOUNT_FILTER,
  PROMISE_STATE_LABELS,
  buildAgeAnalysis,
  buildWorkList,
  dateKeyFrom,
  handOverRows,
  type AccountFlag,
  type AgeAnalysisContext,
  type AgeAnalysisRow,
  type AgingReport,
  type ArReceipt,
  type ContactNote,
  type PaymentPromise,
  type WorkListFilter,
  type WorkListRow,
  type WorkListView
} from '../../../services/ledgerService';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, EmptyState, FilterPill, Notice, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { ErrorBox, Field, inputClass } from '../receipts/ArUi';
import { formatDay } from '../receipts/receiptDocuments';
import { errorText, loadCreditControl, loadPatientContacts } from './debtorsService';

const nad = (cents: number) => formatNad(fromCents(cents));

const VIEWS: Array<{ value: WorkListView | 'today'; label: string }> = [
  { value: 'today', label: 'To do today' },
  { value: 'all', label: 'All overdue' },
  { value: 'no_recent_contact', label: 'No contact in 30 days' },
  { value: 'disputes', label: 'Disputes' },
  { value: 'handed_over', label: 'Handed over' }
];

const PROMISE_TONE: Record<string, string> = {
  broken: 'bg-red-50 text-red-700 border-red-200',
  due_today: 'bg-amber-50 text-amber-800 border-amber-200',
  open: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  kept: 'bg-green-50 text-green-700 border-green-200'
};

interface CreditControlPanelProps {
  practiceId: string;
  aging: AgingReport;
  context: AgeAnalysisContext;
  receipts: readonly ArReceipt[];
  accountOf: (patientId: string) => string;
  flags: readonly AccountFlag[];
  todayKey: string;
  /** Changes after an account was worked on (notes, promises, flags) */
  refreshKey: number;
  onOpenAccount: (row: AgeAnalysisRow) => void;
}

/**
 * The collections work list: overdue accounts with what was last said, the promise in force and
 * how often promises were broken. "To do today" holds broken promises and promises due today.
 * Handed-over accounts have their own view and the debt collector's CSV.
 */
export const CreditControlPanel: React.FC<CreditControlPanelProps> = ({ practiceId, aging, context, receipts, accountOf, flags, todayKey, refreshKey, onOpenAccount }) => {
  const [data, setData] = useState<{ notes: ContactNote[]; promises: PaymentPromise[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<WorkListView | 'today'>('today');
  const [filter, setFilter] = useState<WorkListFilter>(DEFAULT_WORK_LIST_FILTER);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const since = `${Number(todayKey.slice(0, 4)) - 2}${todayKey.slice(4)}`;
    loadCreditControl(practiceId, since)
      .then(result => { if (!cancelled) { setData(result); setError(null); } })
      .catch(loadError => { if (!cancelled) setError(errorText(loadError, 'Could not load the notes and promises')); });
    return () => { cancelled = true; };
  }, [practiceId, todayKey, refreshKey]);

  // The work list is per account (a family under whoever pays), on what patients owe: the account sheet's reminder
  // SMS and promise limit use the same filter, so the figures never disagree
  const accounts = useMemo(
    () => buildAgeAnalysis(aging, PATIENT_ACCOUNT_FILTER, context).rows,
    [aging, context]
  );
  const rowsByAccount = useMemo(() => new Map(accounts.map(row => [row.accountId ?? row.key, row])), [accounts]);
  const lists = useMemo(() => {
    if (!data) return null;
    const make = (workView: WorkListView) => buildWorkList({ accounts, notes: data.notes, promises: data.promises, receipts, accountOf, todayKey, filter: { ...filter, view: workView } });
    const broken = make('broken');
    const due = make('due_today');
    return { today: [...broken, ...due], current: view === 'today' ? [...broken, ...due] : make(view) };
  }, [data, accounts, receipts, accountOf, todayKey, filter, view]);

  const exportHandOver = async () => {
    if (!lists) return;
    setExporting(true);
    try {
      const contacts = await loadPatientContacts(practiceId, lists.current.map(row => row.patientId));
      const rows = handOverRows({
        workList: lists.current,
        flags,
        contacts: Object.fromEntries(Object.entries(contacts).map(([id, contact]) => [id, { name: contact.name, idNumber: contact.idNumber, cellNumber: contact.cellNumber, email: contact.email, address: contact.address, reference: contact.reference }]))
      });
      const csv = toCsv(
        [
          { header: 'Account holder', type: 'text' }, { header: 'ID number', type: 'text' }, { header: 'Cell', type: 'text' }, { header: 'Email', type: 'text' },
          { header: 'Address', type: 'text' }, { header: 'Reference', type: 'text' }, { header: 'Owed', type: 'money' },
          ...AGE_BANDS.map(band => ({ header: band.label, type: 'money' as const })),
          { header: 'Oldest invoice (days)', type: 'count' }, { header: 'Last payment', type: 'date' }, { header: 'Last payment amount', type: 'money' },
          { header: 'Broken promises', type: 'count' }, { header: 'Handed over on', type: 'date' }, { header: 'Reason', type: 'text' }
        ],
        rows.map(row => [
          row.contact.name, row.contact.idNumber, row.contact.cellNumber, row.contact.email, row.contact.address, row.contact.reference, fromCents(row.owedCents),
          ...AGE_BANDS.map(band => fromCents(row.bands[band.key])),
          row.oldestInvoiceAgeDays, row.lastPaymentOn, fromCents(row.lastPaymentCents), row.brokenPromises, row.handedOverOn, row.reason
        ])
      );
      downloadCsv(exportFileName(`hand-over list ${todayKey}`), csv);
      toast.success(`${rows.length} ${rows.length === 1 ? 'account' : 'accounts'} exported for the debt collector`);
    } catch (exportError) {
      toast.error(errorText(exportError, 'The list could not be exported'));
    } finally {
      setExporting(false);
    }
  };

  // The list on screen, for working it in Excel (contact details only in the debt collector's file)
  const exportList = () => {
    if (!lists) return;
    const csv = toCsv(
      [
        { header: 'Account', type: 'text' }, { header: 'Owes', type: 'money' }, { header: 'Oldest invoice (days)', type: 'count' },
        { header: 'Last payment', type: 'date' }, { header: 'Last payment amount', type: 'money' }, { header: 'Last contact', type: 'date' },
        { header: 'Promise', type: 'text' }, { header: 'Promised for', type: 'date' }, { header: 'Promised amount', type: 'money' }, { header: 'Broken promises', type: 'count' }
      ],
      lists.current.map(row => [
        row.name, fromCents(row.owedCents), row.oldestAgeDays, row.lastPaymentOn, fromCents(row.lastPaymentCents), row.lastNote ? dateKeyFrom(row.lastNote.createdAt) : null,
        row.promise ? PROMISE_STATE_LABELS[row.promise.status.state] : '', row.promise?.promise.promisedOn ?? null,
        row.promise ? fromCents(row.promise.promise.amountCents) : null, row.brokenPromises
      ])
    );
    downloadCsv(exportFileName(`credit control ${VIEWS.find(option => option.value === view)?.label ?? ''} ${todayKey}`), csv);
  };

  const columns: TableColumn<WorkListRow>[] = [
    {
      key: 'name',
      header: 'Account',
      render: row => (
        <div className="min-w-0">
          <p className="max-w-[220px] truncate font-medium text-cyan-700 sm:max-w-[320px]">{row.name}</p>
          <p className="max-w-[260px] truncate text-xs text-gray-500 sm:max-w-[360px]">
            {row.lastNote ? `${formatDay(dateKeyFrom(row.lastNote.createdAt))}: ${row.lastNote.note}` : 'No contact recorded'}
          </p>
        </div>
      )
    },
    {
      key: 'promise',
      header: 'Promise',
      render: row => row.promise ? (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${PROMISE_TONE[row.promise.status.state] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`} title={ESCALATION_LABELS[row.escalation]}>
          {PROMISE_STATE_LABELS[row.promise.status.state]} {formatDay(row.promise.promise.promisedOn)}
        </span>
      ) : <span className="text-xs text-gray-400">None</span>
    },
    { key: 'age', header: 'Oldest', hideBelow: 'md', render: row => (row.oldestAgeDays === null ? 'Undated' : `${row.oldestAgeDays} days`) },
    { key: 'paid', header: 'Last payment', hideBelow: 'lg', render: row => (row.lastPaymentOn ? `${formatDay(row.lastPaymentOn)} · ${nad(row.lastPaymentCents)}` : <span className="text-gray-400">—</span>) },
    { key: 'owed', header: 'Owes', align: 'right', render: row => <span className="font-semibold text-gray-900">{nad(row.owedCents)}</span> }
  ];

  return (
    <SectionCard
      title="Credit control"
      subtitle="Overdue accounts, what was said, and promises to pay"
      icon="solar:phone-calling-bold-duotone"
      tone="amber"
      actions={lists && lists.current.length > 0
        ? view === 'handed_over'
          ? <ActionButton icon="solar:download-minimalistic-bold-duotone" label={exporting ? 'Exporting...' : 'Debt collector CSV'} onClick={() => void exportHandOver()} disabled={exporting} />
          : <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={exportList} />
        : undefined}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map(option => (
          <FilterPill key={option.value} active={view === option.value} onClick={() => setView(option.value)} count={option.value === 'today' && lists ? lists.today.length : undefined}>
            {option.label}
          </FilterPill>
        ))}
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Owing for at least" htmlFor="cc-age">
          <select id="cc-age" className={inputClass} value={filter.minAgeDays} onChange={event => setFilter(current => ({ ...current, minAgeDays: Number(event.target.value) }))}>
            {[0, 30, 60, 90, 120, 180].map(days => <option key={days} value={days}>{days === 0 ? 'Any time' : `${days} days`}</option>)}
          </select>
        </Field>
        <Field label="Search" htmlFor="cc-search">
          <input id="cc-search" className={inputClass} value={filter.search} onChange={event => setFilter(current => ({ ...current, search: event.target.value }))} />
        </Field>
      </div>
      {view === 'handed_over' && <Notice tone="info">Handed-over accounts are worked by the debt collector: they are left out of statements, interest and the other views.</Notice>}
      {!lists ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" role="status" aria-label="Loading the work list" />
      ) : (
        <div className="mt-3">
          <DataTable
            rows={lists.current}
            columns={columns}
            rowKey={row => row.patientId}
            onRowClick={row => { const ageRow = rowsByAccount.get(row.patientId); if (ageRow) onOpenAccount(ageRow); }}
            rowLabel={row => `Open the account of ${row.name}`}
            resetKey={`${view}|${filter.minAgeDays}|${filter.search}`}
            itemLabel="accounts"
            empty={<EmptyState compact icon="solar:check-circle-bold-duotone" title={view === 'today' ? 'Nothing to follow up today' : 'No accounts here'} message={view === 'today' ? 'Broken promises and promises due today appear here first thing.' : 'Accounts that owe money appear here.'} />}
          />
        </div>
      )}
    </SectionCard>
  );
};
