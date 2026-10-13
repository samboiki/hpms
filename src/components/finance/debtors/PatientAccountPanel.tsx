import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';
import {
  DEFAULT_AGE_FILTER,
  RELATIONSHIP_LABELS,
  accountPatientRows,
  buildAgeAnalysis,
  buildAgingReport,
  creditByPayer,
  patientAccountRow,
  toDateKey,
  type AgeAnalysisContext,
  type AgeAnalysisRow,
  type ArReceipt
} from '../../../services/ledgerService';
import { PrimaryButton, SecondaryButton } from '../receipts/ArUi';
import { FlagChips } from './AccountFlagBadges';
import { AccountSheet } from './AccountSheet';
import { FamilySheet } from './FamilySheet';
import { patientFileLink } from './accountText';
import { FlagEditor } from './FlagEditor';
import { errorText, loadPatientNames, loadStatementData } from './debtorsService';
import { useAccountFlags } from './useAccountFlags';

interface OpenedAccount {
  accountId: string;
  name: string;
  row: AgeAnalysisRow | null;
  /** What the account owes itself (the patient portion): the reminder SMS and promises ask for nothing more */
  own: AgeAnalysisRow | null;
  patientRows: AgeAnalysisRow[];
  receipts: ArReceipt[];
  holderOf: Record<string, string>;
}

/** The account of a family (or one patient): what it owes by age per patient, and its receipts */
async function loadAccount(practiceId: string, accountId: string, familyIds: readonly string[]): Promise<OpenedAccount> {
  const ids = [...new Set([accountId, ...familyIds])];
  const [entries, names] = await Promise.all([loadStatementData(practiceId, ids), loadPatientNames(practiceId, ids)]);
  const holderOf = Object.fromEntries(ids.filter(id => id !== accountId).map(id => [id, accountId]));
  const context: AgeAnalysisContext = { patientNames: names, fundByPatient: {}, holderByPatient: holderOf, creditByPatient: creditByPayer(entries.receipts).byPatient };
  const aging = buildAgingReport(entries.invoices, toDateKey(new Date()), entries.balances);
  const row = buildAgeAnalysis(aging, { ...DEFAULT_AGE_FILTER, grouping: 'account', portion: 'both', excludeFlags: [] }, context).rows
    .find(item => item.accountId === accountId) ?? null;
  return {
    accountId,
    name: names[accountId] ?? 'Account holder',
    row,
    own: patientAccountRow(aging, accountId, context),
    patientRows: accountPatientRows(aging, { patientIds: ids }, 'both', context),
    receipts: entries.receipts,
    holderOf
  };
}

interface PatientAccountPanelProps {
  practiceId: string;
  patientId: string;
  patientName: string;
  /**
   * When an account alert in the file header was tapped (Date.now()): the panel scrolls into view and is outlined.
   * Only a recent tap counts, so coming back to Billing later does not jump to the account again.
   */
  focusKey?: number;
}

/** How long after the tap the panel may still take to load and come into view */
const FOCUS_REQUEST_MS = 15000;

/**
 * The account on the patient's Billing tab: flags, who pays (links both ways between family
 * members), and the account itself (what each patient owes by age, promise to pay, notes,
 * reminder and statement). Quiet before the debtors proposal is applied.
 */
export const PatientAccountPanel: React.FC<PatientAccountPanelProps> = ({ practiceId, patientId, patientName, focusKey = 0 }) => {
  const user = useAuthStore(state => state.user);
  const account = useAccountFlags(patientId, practiceId);
  const [sheet, setSheet] = useState<'flags' | 'family' | null>(null);
  const [opened, setOpened] = useState<OpenedAccount | null>(null);
  const [opening, setOpening] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const handledFocusKey = useRef(0);
  const [highlighted, setHighlighted] = useState(false);

  // Tapped from an alert beside the patient's name: bring the account into view once it is shown
  useEffect(() => {
    if (!focusKey || focusKey === handledFocusKey.current || account.state !== 'ready' || !sectionRef.current) return;
    handledFocusKey.current = focusKey;
    if (Date.now() - focusKey > FOCUS_REQUEST_MS) return;
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sectionRef.current.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    sectionRef.current.focus({ preventScroll: true });
    setHighlighted(true);
  }, [focusKey, account.state]);
  useEffect(() => {
    if (!highlighted) return;
    const timer = window.setTimeout(() => setHighlighted(false), 2500);
    return () => window.clearTimeout(timer);
  }, [highlighted]);

  if (account.state === 'idle' || account.state === 'loading') return null;
  if (account.state === 'not_set_up') {
    return <p className="text-xs text-gray-500">Account flags, family accounts and credit control are not set up in this database yet.</p>;
  }
  if (account.state === 'error') {
    return (
      <p className="text-xs text-gray-500">
        The account could not be loaded. <button type="button" onClick={account.reload} className="text-cyan-700 underline">Try again</button>
      </p>
    );
  }

  const open = async () => {
    if (!account.accountId) return;
    setOpening(true);
    try {
      setOpened(await loadAccount(practiceId, account.accountId, account.familyIds));
    } catch (loadError) {
      toast.error(errorText(loadError, 'The account could not be opened'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className={`rounded-xl border bg-white p-4 scroll-mt-4 focus:outline-none ${highlighted ? 'border-cyan-400 ring-2 ring-cyan-300' : 'border-gray-200'}`}
      aria-label="Account"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Account</h3>
          <p className="mt-0.5 text-sm text-gray-600">
            {account.holder ? (
              <>Paid for by <Link to={patientFileLink(account.holder.id)} className="font-medium text-cyan-700 hover:underline">{account.holder.name}</Link> ({RELATIONSHIP_LABELS[account.holder.relationship].toLowerCase()} of the holder)</>
            ) : account.members.length > 0 ? (
              <>Pays for {account.members.map((member, index) => (
                <React.Fragment key={member.id}>
                  {index > 0 && ', '}
                  <Link to={patientFileLink(member.id)} className="font-medium text-cyan-700 hover:underline">{member.name}</Link> ({RELATIONSHIP_LABELS[member.relationship].toLowerCase()})
                </React.Fragment>
              ))}</>
            ) : 'Pays for themselves'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton icon="solar:flag-bold-duotone" onClick={() => setSheet('flags')} className="!px-2.5 !py-1">Flags</SecondaryButton>
          <SecondaryButton icon="solar:users-group-rounded-bold-duotone" onClick={() => setSheet('family')} className="!px-2.5 !py-1">Family</SecondaryButton>
          <PrimaryButton icon="solar:phone-calling-bold-duotone" onClick={() => void open()} busy={opening} className="!px-2.5 !py-1">Promises and notes</PrimaryButton>
        </div>
      </div>
      {account.flags.length > 0 && (
        <FlagChips flags={account.flags} creditLimit={account.creditLimit} holderName={account.holder?.name ?? null} className="mt-3" />
      )}

      {sheet === 'flags' && (
        <FlagEditor
          practiceId={practiceId}
          patientId={patientId}
          patientName={patientName}
          holderName={account.holder?.name ?? null}
          flags={account.flags}
          smsOptOut={account.smsOptOut}
          role={user?.role}
          onClose={() => setSheet(null)}
          onChanged={account.reload}
        />
      )}
      {sheet === 'family' && (
        <FamilySheet practiceId={practiceId} patientId={patientId} patientName={patientName} holder={account.holder} members={account.members} onClose={() => setSheet(null)} onChanged={account.reload} />
      )}
      {opened && (
        <AccountSheet
          practiceId={practiceId}
          accountId={opened.accountId}
          name={opened.name}
          row={opened.row}
          ownRow={opened.own}
          patientRows={opened.patientRows}
          receipts={opened.receipts}
          accountOf={id => opened.holderOf[id] ?? id}
          onClose={() => setOpened(null)}
          onChanged={account.reload}
        />
      )}
    </section>
  );
};
