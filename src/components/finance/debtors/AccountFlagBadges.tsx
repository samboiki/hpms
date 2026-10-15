import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  ACCOUNT_ALERT_WINDOW_DAYS,
  FLAG_DEFINITIONS,
  accountAlerts,
  billingFlags,
  promiseAlertText,
  toDateKey,
  type AccountAlerts,
  type CreditLimitStatus,
  type EffectiveFlag
} from '../../../services/ledgerService';
import { addDaysToKey } from '../../../utils/billing/dates';
import { isArNotSetUp } from '../receipts/arService';
import { flagChipText } from './accountText';
import { loadAccountAlerts } from './debtorsService';
import { useAccountFlags } from './useAccountFlags';

const TONES: Record<string, string> = {
  red: 'bg-red-50 text-red-800 border-red-200',
  amber: 'bg-amber-50 text-amber-900 border-amber-200',
  violet: 'bg-violet-50 text-violet-800 border-violet-200',
  cyan: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200'
};

interface FlagChipsProps {
  flags: readonly EffectiveFlag[];
  creditLimit?: CreditLimitStatus | null;
  /** Name of the account holder, for flags that come from their file */
  holderName?: string | null;
  /** Chips shown before "+N more" (0 = all) */
  max?: number;
  className?: string;
}

/** Account flags as small chips: what stops staff doing something wrong comes first */
export const FlagChips: React.FC<FlagChipsProps> = ({ flags, creditLimit = null, holderName = null, max = 0, className = '' }) => {
  if (flags.length === 0) return null;
  const shown = max > 0 ? flags.slice(0, max) : flags;
  const hidden = flags.length - shown.length;
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Account flags">
      {shown.map(flag => {
        const definition = FLAG_DEFINITIONS[flag.kind];
        const over = flag.kind === 'credit_limit' && creditLimit?.over;
        const text = flagChipText(flag, creditLimit);
        const title = [definition.meaning, flag.inherited ? `Set on the account of ${holderName ?? 'the account holder'}` : null, flag.flag?.reason ? `Reason: ${flag.flag.reason}` : null]
          .filter(Boolean).join('. ');
        return (
          <li key={flag.kind} title={title} className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[over ? 'red' : definition.tone]}`}>
            <Icon icon={definition.icon} className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className={flag.kind === 'alert' ? 'truncate max-w-[16rem]' : 'whitespace-nowrap'}>{text}</span>
            <span className="sr-only">{title}</span>
          </li>
        );
      })}
      {hidden > 0 && <li className="text-xs text-gray-500">+{hidden} more</li>}
    </ul>
  );
};

/**
 * The account's alerts when the patient file opens: a promise to pay still open (or overdue, in a
 * warning tone) and "Credit-control notes" when there are any. Each chip is one tap to the account on
 * the Account tab. One request (loadAccountAlerts); nothing shows when there is nothing, before the
 * debtors proposal is applied, or when it cannot be read (never an error banner on a patient file).
 */
export const AccountAlertChips: React.FC<{ practiceId: string; accountId: string; familyIds: readonly string[]; onOpen: () => void }> = ({
  practiceId,
  accountId,
  familyIds,
  onOpen
}) => {
  const [alerts, setAlerts] = useState<AccountAlerts | null>(null);
  const familyKey = familyIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const todayKey = toDateKey(new Date());
    const ids = [...new Set([accountId, ...familyKey.split(',').filter(Boolean)])];
    // Every patient on the account pays towards the account holder's promise
    const accountOf = (patientId: string) => (ids.includes(patientId) ? accountId : patientId);
    loadAccountAlerts(practiceId, accountId, ids, addDaysToKey(todayKey, -ACCOUNT_ALERT_WINDOW_DAYS))
      .then(data => {
        if (!cancelled) setAlerts(accountAlerts({ accountId, promises: data.promises, receipts: data.receipts, accountOf, hasNotes: data.hasNotes, todayKey }));
      })
      .catch(error => {
        if (cancelled) return;
        if (!isArNotSetUp(error)) console.warn('Account alerts unavailable', error);
        setAlerts(null);
      });
    return () => { cancelled = true; };
  }, [practiceId, accountId, familyKey]);

  if (!alerts || (!alerts.promise && !alerts.hasNotes)) return null;
  const chip = 'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-purple-600';
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Account alerts">
      {alerts.promise && (
        <li>
          <button type="button" onClick={onOpen} className={`${chip} ${TONES[alerts.promise.state === 'broken' ? 'amber' : 'cyan']}`} title="Open the patient's Account tab">
            <Icon icon={alerts.promise.state === 'broken' ? 'solar:danger-triangle-bold-duotone' : 'solar:calendar-mark-bold-duotone'} className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{promiseAlertText(alerts.promise)}</span>
          </button>
        </li>
      )}
      {alerts.hasNotes && (
        <li>
          <button type="button" onClick={onOpen} className={`${chip} ${TONES.violet}`} title="Open the patient's Account tab">
            <Icon icon="solar:notebook-bold-duotone" className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">Credit-control notes</span>
          </button>
        </li>
      )}
    </ul>
  );
};

/**
 * The account flags of a patient, loaded by itself: drop it on any screen that shows a patient
 * (the patient header, a visit, an invoice). Shows nothing until there is something to show, and
 * nothing at all before the debtors proposal is applied. With `onOpenAccount` (the patient file) it
 * also shows the account alerts, each one tap to the account. `billing` shows only the flags that
 * matter where people bill (cash only, credit limit, dispute, ...), after a short `label`.
 */
export const AccountFlagBadges: React.FC<{
  patientId: string | null | undefined;
  practiceId: string | null | undefined;
  max?: number;
  className?: string;
  onOpenAccount?: () => void;
  billing?: boolean;
  label?: string;
}> = ({ patientId, practiceId, max = 4, className, onOpenAccount, billing = false, label }) => {
  const account = useAccountFlags(patientId, practiceId);
  if (account.state !== 'ready') return null;
  const flags = billing ? billingFlags(account.flags) : account.flags;
  const chips = <FlagChips flags={flags} creditLimit={account.creditLimit} holderName={account.holder?.name ?? null} max={max} className={label ? '' : className} />;
  return (
    <>
      {label && flags.length > 0 ? (
        <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
          <span className="text-xs font-medium text-gray-500">{label}</span>
          {chips}
        </div>
      ) : chips}
      {onOpenAccount && practiceId && account.accountId && (
        <AccountAlertChips practiceId={practiceId} accountId={account.accountId} familyIds={account.familyIds} onOpen={onOpenAccount} />
      )}
    </>
  );
};

/**
 * One small icon on a diary card when the patient's account carries a flag that matters for billing;
 * the flags are its tooltip and its name for screen readers (flagSummaryText). Nothing otherwise.
 */
export const AccountFlagIcon: React.FC<{ summary: string | null | undefined; className?: string }> = ({ summary, className = '' }) => {
  if (!summary) return null;
  return (
    <span
      role="img"
      aria-label={summary}
      title={summary}
      className={`inline-flex flex-none items-center rounded-lg p-0.5 ring-1 bg-amber-50 text-amber-800 ring-amber-200 ${className}`}
    >
      <Icon icon="solar:flag-bold-duotone" className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
    </span>
  );
};
