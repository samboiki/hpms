import React, { useMemo, useState } from 'react';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { AGE_BANDS, zeroBands, type AgingReport } from '../../../services/ledgerService';
import { ActionButton, EmptyState, ErrorState, FilterPill, Notice, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { Field, inputClass } from '../receipts/ArUi';
import {
  PAYER_KIND_LABELS,
  accountAges,
  invoicesOfAccount,
  sortAccounts,
  type AccountAges,
  type PayerAccount
} from '../../../utils/accounts/payerAccounts';
import type { PracticePayerData } from '../../../services/payerAccountService';
import { PayerAccountSheet } from './PayerAccountSheet';
import { CompanyAccountSheet } from './CompanyAccountSheet';

const nad = (cents: number) => formatNad(fromCents(cents));

interface Row {
  account: PayerAccount;
  ages: AccountAges;
}

interface CompanyAccountsPanelProps {
  practiceId: string;
  /** The practice's receivables (every invoice) */
  aging: AgingReport;
  /** The workspace's accounts and who pays each invoice billed to one (FinanceWorkspace.payers) */
  payers: PracticePayerData;
  todayKey: string;
  /** The account open in its sheet (from here or from an age analysis row) */
  openAccountId: string | null;
  onOpenAccount: (accountId: string | null) => void;
  /** An account, a payment or an employee changed: Finance reads its figures again */
  onChanged: () => void;
}

/**
 * Finance > Debtors > Companies (parity A14, A19): the employers, the Employees' Compensation Fund, the MVA Fund and
 * other payers, each with what the visits billed to it still owe by age; each opens to its invoices, employees,
 * statement and payments.
 */
export const CompanyAccountsPanel: React.FC<CompanyAccountsPanelProps> = ({ practiceId, aging, payers, todayKey, openAccountId, onOpenAccount, onChanged }) => {
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ account: PayerAccount | null } | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      sortAccounts(payers.accounts)
        .filter(account => showClosed || !account.closedAt)
        .filter(account => !search.trim() || `${account.name} ${account.accountNumber}`.toLowerCase().includes(search.trim().toLowerCase()))
        .map(account => ({ account, ages: accountAges(aging, invoicesOfAccount(payers.byInvoice, account.id)) })),
    [payers.accounts, payers.byInvoice, showClosed, search, aging]
  );
  const totals = rows.reduce(
    (sum, row) => {
      for (const band of AGE_BANDS) sum.bands[band.key] += row.ages.bands[band.key];
      sum.owed += row.ages.owedCents;
      return sum;
    },
    { bands: zeroBands(), owed: 0 }
  );
  const open = payers.accounts.find(account => account.id === openAccountId) ?? null;
  const closedCount = payers.accounts.filter(account => account.closedAt).length;

  const columns: TableColumn<Row>[] = [
    {
      key: 'name',
      header: 'Account',
      render: row => (
        <div className="min-w-0">
          <p className={`max-w-[150px] truncate font-medium sm:max-w-[280px] ${row.account.closedAt ? 'text-gray-500' : 'text-cyan-700'}`}>{row.account.name}</p>
          <p className="text-xs text-gray-500">
            {PAYER_KIND_LABELS[row.account.kind]} · {row.account.accountNumber}
            {row.account.closedAt ? ' · Closed' : ''}
          </p>
        </div>
      )
    },
    ...AGE_BANDS.map(band => ({
      key: band.key,
      header: band.label,
      align: 'right' as const,
      hideBelow: 'lg' as const,
      render: (row: Row) => (row.ages.bands[band.key] ? nad(row.ages.bands[band.key]) : <span className="text-gray-300">—</span>)
    })),
    { key: 'owed', header: 'Owed', align: 'right', render: row => <span className="font-semibold text-gray-900">{nad(row.ages.owedCents)}</span> }
  ];

  let body: React.ReactNode;
  if (payers.status === 'not_set_up') {
    body = (
      <Notice tone="info" title="Company accounts are not set up yet">
        Once the database has them, employers and the compensation and MVA funds can be billed here, each with its own statement and age analysis.
      </Notice>
    );
  } else if (payers.status === 'error') {
    body = <ErrorState title="The company accounts could not be read" message={payers.error ?? 'Try again.'} onRetry={onChanged} />;
  } else {
    body = (
      <>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Search" htmlFor="company-search" className="w-full sm:w-72">
            <input id="company-search" className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or account number" />
          </Field>
          {closedCount > 0 && (
            <FilterPill active={showClosed} onClick={() => setShowClosed(value => !value)} count={closedCount}>
              Show closed accounts
            </FilterPill>
          )}
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={row => row.account.id}
          onRowClick={row => onOpenAccount(row.account.id)}
          rowLabel={row => `Open the account of ${row.account.name}`}
          resetKey={`${search}|${showClosed}`}
          itemLabel="accounts"
          totals={[`Total (${rows.length})`, ...AGE_BANDS.map(band => nad(totals.bands[band.key])), nad(totals.owed)]}
          empty={
            <EmptyState
              compact
              icon="solar:buildings-2-bold-duotone"
              title={payers.accounts.length === 0 ? 'No company accounts yet' : 'No account matches'}
              message={
                payers.accounts.length === 0
                  ? "Add an employer that pays for its employees' visits. The compensation and MVA funds are added the first time an injury or accident case is billed to them."
                  : 'Change the search to see more.'
              }
            />
          }
        />
        <p className="mt-3 text-xs text-gray-500">
          Aged by the invoice date. These invoices are the accounts&apos; to pay: they are not on the patients&apos; own statements, reminders or interest runs.
        </p>
      </>
    );
  }

  return (
    <SectionCard
      title="Company and fund accounts"
      subtitle="Employers, the Employees' Compensation Fund, the MVA Fund and other payers: what the visits billed to each still owe"
      icon="solar:buildings-2-bold-duotone"
      tone="orange"
      actions={
        payers.status === 'ready' ? (
          <ActionButton icon="solar:add-circle-bold-duotone" label="Add account" variant="primary" onClick={() => setEditing({ account: null })} />
        ) : undefined
      }
    >
      {body}

      {editing && (
        <PayerAccountSheet
          practiceId={practiceId}
          account={editing.account}
          onClose={() => setEditing(null)}
          onSaved={saved => {
            setEditing(null);
            onChanged();
            if (!editing.account) onOpenAccount(saved.id);
          }}
        />
      )}
      {open && !editing && (
        <CompanyAccountSheet
          practiceId={practiceId}
          account={open}
          accounts={payers.accounts}
          todayKey={todayKey}
          onClose={() => onOpenAccount(null)}
          onEdit={() => setEditing({ account: open })}
          onChanged={onChanged}
        />
      )}
    </SectionCard>
  );
};

export default CompanyAccountsPanel;
