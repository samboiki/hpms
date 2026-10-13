import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_AGE_FILTER,
  accountPatientRows,
  buildAgeAnalysis,
  familyAccounts,
  patientAccountRow,
  type AgeAnalysisFilter,
  type AgeAnalysisRow
} from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { DebtorsView, PeriodLabels } from '../financeNav';
import { ErrorState, LoadingState, Notice, SegmentedTabs, type SegmentOption } from '../FinanceUI';
import { CONTROLS_NOT_SET_UP_MESSAGE } from '../controls/controlsCopy';
import { AccountSheet } from './AccountSheet';
import { AgeAnalysisPanel } from './AgeAnalysisPanel';
import { CreditControlPanel } from './CreditControlPanel';
import { InterestPanel } from './InterestPanel';
import { SmallBalancesPanel } from './SmallBalancesPanel';
import { StatementRunsPanel } from './StatementRunsPanel';
import { ageContext } from './debtorsContext';
import { loadMedicalAidPlans } from './debtorsService';
import { useAccountDirectory } from './useAccountDirectory';
import { CompanyAccountsPanel } from '../companies/CompanyAccountsPanel';
import { accountIdOfRowKey, withoutAccountInvoices } from '../../../utils/accounts/payerAccounts';
import { NO_PRACTICE_PAYERS } from '../../../services/payerAccountService';

export type { DebtorsView } from '../financeNav';

const VIEWS: SegmentOption<DebtorsView>[] = [
  { value: 'ages', label: 'Age analysis', icon: 'solar:sort-by-time-bold-duotone' },
  { value: 'credit', label: 'Credit control', icon: 'solar:phone-calling-bold-duotone' },
  { value: 'statements', label: 'Statements', icon: 'solar:bill-list-bold-duotone' },
  { value: 'interest', label: 'Interest', icon: 'solar:graph-up-bold-duotone' },
  { value: 'small', label: 'Small balances', icon: 'solar:eraser-bold-duotone' },
  { value: 'companies', label: 'Companies', icon: 'solar:buildings-2-bold-duotone' }
];

interface DebtorsTabProps {
  workspace: FinanceWorkspace;
  derived: FinanceDerived;
  labels: PeriodLabels;
  practiceName: string;
  /** Reloads Finance (after interest is charged or reversed) */
  onRefresh: () => void;
  view?: DebtorsView;
  onViewChange?: (view: DebtorsView) => void;
  /** A link to one company or fund account (?account=, e.g. from the patient file's company accounts) opens it */
  linkedCompanyId?: string | null;
  /** A report card opened the age analysis on a grouping (per fund, what the funds owe); a new key opens it afresh */
  agePreset?: { filter: Partial<AgeAnalysisFilter>; key: number } | null;
}

/**
 * Debtors: who owes what and for how long (per account, patient, fund or administrator), the
 * collections work list, statement runs and interest. A family is one account under whoever pays;
 * every account opens to its patients, notes, promises, flags and statement.
 */
export const DebtorsTab: React.FC<DebtorsTabProps> = ({ workspace, derived, labels, practiceName, onRefresh, view, onViewChange, linkedCompanyId = null, agePreset = null }) => {
  const [ownView, setOwnView] = useState<DebtorsView>('ages');
  const activeView = view ?? ownView;
  const changeView = onViewChange ?? setOwnView;
  const arReady = workspace.ar?.state === 'ready';
  const directory = useAccountDirectory(workspace.practiceId, arReady);
  const [optionByPatient, setOptionByPatient] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<{ accountId: string; name: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Plan options (for "Fund and option"); without them the option is shown as unknown
  const owingPatients = useMemo(
    () => [...new Set(derived.aging.items.map(item => item.invoice.patientId).filter((id): id is string => !!id))],
    [derived.aging]
  );
  useEffect(() => {
    if (directory.state !== 'ready' || owingPatients.length === 0) return;
    let cancelled = false;
    loadMedicalAidPlans(owingPatients)
      .then(plans => { if (!cancelled) setOptionByPatient(plans.optionByPatient); })
      .catch(() => { /* the option grouping shows "Option not recorded" */ });
    return () => { cancelled = true; };
  }, [directory.state, owingPatients]);

  const receipts = useMemo(() => (workspace.ar?.state === 'ready' ? workspace.ar.receipts : []), [workspace.ar]);
  const context = useMemo(() => ageContext({
    patientNames: { ...directory.holderNames, ...workspace.patientNames },
    schemeByPatient: workspace.schemeByPatient,
    optionByPatient,
    links: directory.links,
    flags: directory.flags,
    receipts,
    payers: workspace.payers
  }), [directory.holderNames, directory.links, directory.flags, workspace.patientNames, workspace.schemeByPatient, optionByPatient, receipts, workspace.payers]);
  const family = useMemo(() => familyAccounts(directory.links), [directory.links]);

  // Company and fund accounts (parity A14, A19): their invoices are on their own rows of the age analysis and under
  // Companies; what acts on a patient's account (work list, statement runs, interest, small balances, the account
  // sheet) sees only what the patients owe themselves
  const [openCompany, setOpenCompany] = useState<string | null>(linkedCompanyId);
  useEffect(() => {
    if (linkedCompanyId) setOpenCompany(linkedCompanyId);
  }, [linkedCompanyId]);
  const payerByInvoice = context.payerByInvoice;
  const patientAging = useMemo(() => withoutAccountInvoices(derived.aging, payerByInvoice ?? {}), [derived.aging, payerByInvoice]);

  // The account sheet: the whole account (both portions), each of its patients, and what the account owes itself (the
  // patient portion, as on the work list): the only amount a reminder or a promise may ask for
  const opened = useMemo(() => {
    if (!open) return null;
    const accounts = buildAgeAnalysis(patientAging, { ...DEFAULT_AGE_FILTER, grouping: 'account', portion: 'both', excludeFlags: [] }, context).rows;
    const row = accounts.find(item => item.accountId === open.accountId) ?? null;
    const patientRows = accountPatientRows(patientAging, { patientIds: family.everyoneOf(open.accountId) }, 'both', context);
    return { row, patientRows, own: patientAccountRow(patientAging, open.accountId, context) };
  }, [open, patientAging, context, family]);

  const openAccount = (row: AgeAnalysisRow) => {
    // A company or fund account's own row (AC-...) opens that account under Companies
    const companyId = accountIdOfRowKey(row.key);
    if (companyId) {
      setOpenCompany(companyId);
      changeView('companies');
      return;
    }
    if (!row.accountId) return;
    const accountId = family.accountOf(row.accountId);
    setOpen({ accountId, name: context.patientNames[accountId] ?? row.label });
  };

  if (!arReady) {
    return <Notice tone="info" title="Debtors is not set up yet">{CONTROLS_NOT_SET_UP_MESSAGE}</Notice>;
  }
  if (directory.state === 'idle' || directory.state === 'loading') return <LoadingState label="Loading the accounts" rows={4} />;
  if (directory.state === 'not_set_up') return <Notice tone="info" title="Debtors is not set up yet">{CONTROLS_NOT_SET_UP_MESSAGE}</Notice>;
  if (directory.state === 'error') return <ErrorState title="Could not load the accounts" message={directory.error ?? 'Try again.'} onRetry={directory.reload} />;

  return (
    <div className="space-y-6">
      <SegmentedTabs value={activeView} onChange={changeView} options={VIEWS} ariaLabel="Debtors views" />

      {activeView === 'ages' && (
        <AgeAnalysisPanel
          key={agePreset?.key ?? 'ages'}
          aging={derived.aging}
          context={context}
          doctorNames={workspace.doctorNames}
          practiceName={practiceName}
          asAtLabel={labels.today}
          onOpenAccount={openAccount}
          initialFilter={agePreset?.filter}
        />
      )}
      {activeView === 'credit' && (
        <CreditControlPanel
          practiceId={workspace.practiceId}
          aging={patientAging}
          context={context}
          receipts={receipts}
          accountOf={family.accountOf}
          flags={directory.flags}
          todayKey={labels.todayKey}
          refreshKey={refreshKey}
          onOpenAccount={openAccount}
        />
      )}
      {activeView === 'statements' && (
        <StatementRunsPanel practiceId={workspace.practiceId} aging={patientAging} context={context} flags={directory.flags} todayKey={labels.todayKey} />
      )}
      {activeView === 'interest' && (
        <InterestPanel practiceId={workspace.practiceId} aging={patientAging} context={context} todayKey={labels.todayKey} onChanged={onRefresh} />
      )}
      {activeView === 'small' && (
        <SmallBalancesPanel practiceId={workspace.practiceId} aging={patientAging} context={context} accountOf={family.accountOf} onChanged={onRefresh} />
      )}
      {activeView === 'companies' && (
        <CompanyAccountsPanel
          practiceId={workspace.practiceId}
          aging={derived.aging}
          payers={workspace.payers ?? NO_PRACTICE_PAYERS}
          todayKey={labels.todayKey}
          openAccountId={openCompany}
          onOpenAccount={setOpenCompany}
          onChanged={onRefresh}
        />
      )}

      {open && opened && (
        <AccountSheet
          practiceId={workspace.practiceId}
          accountId={open.accountId}
          name={open.name}
          row={opened.row}
          ownRow={opened.own}
          patientRows={opened.patientRows}
          receipts={receipts}
          accountOf={family.accountOf}
          onClose={() => setOpen(null)}
          onChanged={() => { directory.reload(); setRefreshKey(key => key + 1); }}
        />
      )}
    </div>
  );
};
