import React, { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  AGE_BANDS,
  DEFAULT_AGE_FILTER,
  FLAG_DEFINITIONS,
  PRIVATE_FUND,
  accountIdOfRowKey,
  buildAgeAnalysis,
  parseAmountInput,
  type AccountFlagKind,
  type AgeAnalysisContext,
  type AgeAnalysisFilter,
  type AgeAnalysisRow,
  type AgeGrouping,
  type AgingReport,
  type PortionScope
} from '../../../services/ledgerService';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { downloadReportCsv, printReport } from '../financeExport';
import { ActionButton, EmptyState, FilterPill, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { Field, inputClass } from '../receipts/ArUi';
import { ageAnalysisTable } from '../controls/controlsDocuments';

const nad = (cents: number) => formatNad(fromCents(cents));

const GROUPINGS: Array<{ value: AgeGrouping; label: string }> = [
  { value: 'account', label: 'Account (family together)' },
  { value: 'patient', label: 'Patient' },
  { value: 'fund', label: 'Medical aid fund' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'option', label: 'Fund and option' }
];
const PORTIONS: Array<{ value: PortionScope; label: string }> = [
  { value: 'both', label: 'Everything' },
  { value: 'patient', label: 'Patients owe' },
  { value: 'medical_aid', label: 'Medical aids owe' }
];
const OLDER_THAN = [0, 30, 60, 90, 120, 150, 180];
const ONLY_FLAGS: Array<AccountFlagKind> = ['dispute', 'handed_over', 'cash_only', 'no_statement'];

interface AgeAnalysisPanelProps {
  aging: AgingReport;
  context: AgeAnalysisContext;
  doctorNames: Readonly<Record<string, string>>;
  practiceName: string;
  asAtLabel: string;
  /** Account and patient rows open the account */
  onOpenAccount: (row: AgeAnalysisRow) => void;
  /** The filters it opens with (Finance > Reports' medical aid age analysis opens it per fund, what the funds owe) */
  initialFilter?: Partial<AgeAnalysisFilter>;
}

/**
 * The age analysis: who owes what, by the age of the debt (current to 180+), per account, patient,
 * fund, administrator or option, with the credit not yet allocated next to it. Filters as in
 * Eminance; CSV and print of exactly what is on screen.
 */
export const AgeAnalysisPanel: React.FC<AgeAnalysisPanelProps> = ({ aging, context, doctorNames, practiceName, asAtLabel, onOpenAccount, initialFilter }) => {
  const [filter, setFilter] = useState<AgeAnalysisFilter>(() => ({ ...DEFAULT_AGE_FILTER, ...initialFilter }));
  const [minBalance, setMinBalance] = useState('');
  const update = (patch: Partial<AgeAnalysisFilter>) => setFilter(current => ({ ...current, ...patch }));

  const minBalanceCents = minBalance.trim() ? parseAmountInput(minBalance) : 0;
  const analysis = useMemo(
    () => buildAgeAnalysis(aging, { ...filter, minBalanceCents: minBalanceCents ?? 0 }, context),
    [aging, filter, minBalanceCents, context]
  );
  const groupingLabel = GROUPINGS.find(option => option.value === filter.grouping)?.label ?? 'Account';
  const openable = filter.grouping === 'account' || filter.grouping === 'patient';
  // A patient's account opens its sheet; a company or fund account's own row (AC-...) opens it under Companies
  const opensAccount = (row: AgeAnalysisRow): boolean => !!row.accountId || accountIdOfRowKey(row.key) !== null;
  // Fund rows ("NHP", "NHP · Gold") carry the fund's logo, as on the Patients page
  const fundOf = (row: AgeAnalysisRow): string | null => {
    const fund = filter.grouping === 'fund' ? row.key : filter.grouping === 'option' ? row.key.split(' · ')[0] : null;
    // A company or fund account's row (accountIdOfRowKey) has no medical aid logo
    return fund && fund !== PRIVATE_FUND && accountIdOfRowKey(row.key) === null ? fund : null;
  };
  const doctors = Object.entries(doctorNames).sort(([, a], [, b]) => a.localeCompare(b));

  const report = () => ageAnalysisTable(analysis, {
    title: `Age analysis by ${groupingLabel.toLowerCase()}`,
    basis: `As at ${asAtLabel}${filter.portion === 'patient' ? ', what patients owe' : filter.portion === 'medical_aid' ? ', what medical aids owe' : ''}`,
    rowHeader: groupingLabel
  });

  const columns: TableColumn<AgeAnalysisRow>[] = [
    {
      key: 'label',
      header: groupingLabel,
      render: row => (
        <div className="flex min-w-0 items-center gap-2">
          <MedicalAidLogo name={fundOf(row)} />
          <div className="min-w-0">
            <p className={`max-w-[200px] truncate font-medium sm:max-w-[280px] ${openable && opensAccount(row) ? 'text-cyan-700' : 'text-gray-900'}`}>{row.label}</p>
            <p className="text-xs text-gray-500">
              {row.patientIds.length > 1 && filter.grouping === 'account' ? `${row.patientIds.length} patients · ` : ''}
              {row.flags.filter(flag => flag !== 'statement_language' && flag !== 'statement_message').map(flag => FLAG_DEFINITIONS[flag].label).join(' · ')}
            </p>
          </div>
        </div>
      )
    },
    ...AGE_BANDS.map(band => ({
      key: band.key,
      header: band.label,
      align: 'right' as const,
      hideBelow: 'lg' as const,
      render: (row: AgeAnalysisRow) => (row.bands[band.key] ? nad(row.bands[band.key]) : <span className="text-gray-300">—</span>)
    })),
    { key: 'owed', header: 'Owed', align: 'right', render: row => <span className="font-semibold text-gray-900">{nad(row.owedCents)}</span> },
    { key: 'unallocated', header: 'Unallocated', align: 'right', hideBelow: 'md', render: row => (row.unallocatedCents > 0 ? <span className="text-amber-700">{nad(row.unallocatedCents)}</span> : <span className="text-gray-300">—</span>) },
    { key: 'net', header: 'Net', align: 'right', hideBelow: 'sm', render: row => nad(row.netCents) }
  ];

  return (
    <SectionCard
      title="Age analysis"
      subtitle={`As at ${asAtLabel}: ${analysis.totals.rowCount} ${analysis.totals.rowCount === 1 ? 'row' : 'rows'}, ${nad(analysis.totals.owedCents)} owed`}
      icon="solar:sort-by-time-bold-duotone"
      tone="orange"
      actions={<>
        <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={() => downloadReportCsv(report())} />
        <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print" onClick={() => { if (!printReport(report(), practiceName)) toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.'); }} />
      </>}
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Group by" htmlFor="age-grouping">
          <select id="age-grouping" className={inputClass} value={filter.grouping}
            onChange={event => {
              const grouping = event.target.value as AgeGrouping;
              update({ grouping, portion: grouping === 'fund' || grouping === 'administrator' || grouping === 'option' ? 'medical_aid' : filter.portion });
            }}>
            {GROUPINGS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Older than" htmlFor="age-older">
          <select id="age-older" className={inputClass} value={filter.minAgeDays} onChange={event => update({ minAgeDays: Number(event.target.value) })}>
            {OLDER_THAN.map(days => <option key={days} value={days}>{days === 0 ? 'Any age' : `${days} days or more`}</option>)}
          </select>
        </Field>
        <Field label="Owes at least" htmlFor="age-minimum" error={minBalance.trim() && minBalanceCents === null ? 'Enter an amount' : null}>
          <input id="age-minimum" className={inputClass} inputMode="decimal" placeholder="N$ 0" value={minBalance} onChange={event => setMinBalance(event.target.value)} />
        </Field>
        <Field label="Search" htmlFor="age-search">
          <input id="age-search" className={inputClass} value={filter.search} onChange={event => update({ search: event.target.value })} placeholder="Name or fund" />
        </Field>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PORTIONS.map(option => <FilterPill key={option.value} active={filter.portion === option.value} onClick={() => update({ portion: option.value })}>{option.label}</FilterPill>)}
        <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
        <FilterPill active={!filter.excludeFlags.includes('handed_over')} onClick={() => update({ excludeFlags: filter.excludeFlags.includes('handed_over') ? [] : ['handed_over'] })}>Include handed over</FilterPill>
        {ONLY_FLAGS.map(flag => (
          <FilterPill key={flag} active={filter.onlyFlag === flag} onClick={() => update({ onlyFlag: filter.onlyFlag === flag ? null : flag, excludeFlags: flag === 'handed_over' ? [] : filter.excludeFlags })}>
            Only {FLAG_DEFINITIONS[flag].label.toLowerCase()}
          </FilterPill>
        ))}
        {doctors.length > 1 && (
          <select aria-label="Practitioner" className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs" value={filter.practitionerId ?? ''} onChange={event => update({ practitionerId: event.target.value || null })}>
            <option value="">All practitioners</option>
            {doctors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      <DataTable
        rows={analysis.rows}
        columns={columns}
        rowKey={row => row.key}
        onRowClick={openable ? row => { if (opensAccount(row)) onOpenAccount(row); } : undefined}
        rowLabel={row => `Open the account of ${row.label}`}
        resetKey={JSON.stringify(filter) + minBalance}
        itemLabel="rows"
        totals={[
          `Total (${analysis.totals.rowCount})`,
          ...AGE_BANDS.map(band => nad(analysis.totals.bands[band.key])),
          nad(analysis.totals.owedCents),
          nad(analysis.totals.unallocatedCents),
          nad(analysis.totals.netCents)
        ]}
        empty={<EmptyState compact icon="solar:check-circle-bold-duotone" title="Nobody owes anything with these filters" message="Change the filters to see more." />}
      />
      <p className="mt-3 text-xs text-gray-500">
        Aged by the invoice date. On a phone the age columns are hidden: open an account to see them. A family is one account under whoever pays.
      </p>
    </SectionCard>
  );
};
