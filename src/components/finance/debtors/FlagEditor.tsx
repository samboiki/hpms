import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import {
  ACCOUNT_STATEMENT_MESSAGE_MAX,
  ALERT_MAX_LENGTH,
  FLAG_DEFINITIONS,
  FLAG_ORDER,
  STATEMENT_LANGUAGES,
  centsToInput,
  checkFlagChange,
  parseAmountInput,
  type AccountFlagKind,
  type EffectiveFlag,
  type FlagKind
} from '../../../services/ledgerService';
import { AmountInput, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { clearAccountFlag, setAccountFlag, setSmsOptOut } from './debtorsService';
import { flagChipText } from './accountText';

interface FlagEditorProps {
  practiceId: string;
  patientId: string;
  patientName: string;
  /** Who pays for the patient: account flags are changed on their file */
  holderName: string | null;
  flags: readonly EffectiveFlag[];
  /** null when the SMS opt-out does not exist in this database yet */
  smsOptOut: boolean | null;
  role: string | null | undefined;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Set or clear an account's flags. Account flags of a family member are changed on the account
 * holder's file (they cover the family), which the sheet says before anything is saved.
 */
export const FlagEditor: React.FC<FlagEditorProps> = ({ practiceId, patientId, patientName, holderName, flags, smsOptOut, role, onClose, onChanged }) => {
  const [editing, setEditing] = useState<FlagKind | null>(null);
  const [amount, setAmount] = useState('');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = (kind: FlagKind) => flags.find(flag => flag.kind === kind) ?? null;

  const start = (kind: FlagKind) => {
    const flag = current(kind);
    setEditing(kind);
    setError(null);
    setReason('');
    setAmount(kind === 'credit_limit' && flag?.flag?.amountCents ? centsToInput(flag.flag.amountCents) : '');
    setValue(kind === 'statement_language' ? flag?.flag?.value ?? 'af' : kind === 'alert' || kind === 'statement_message' ? flag?.flag?.value ?? '' : '');
  };

  const save = async (kind: FlagKind, setting: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (kind === 'no_sms') {
        await setSmsOptOut(practiceId, patientId, setting);
      } else {
        const amountCents = kind === 'credit_limit' ? parseAmountInput(amount) : null;
        const change = { kind, setting, amountCents, value, reason };
        const check = checkFlagChange(change, current(kind)?.flag ?? null, role);
        if (!check.ok) { setError(check.error); setBusy(false); return; }
        if (setting) await setAccountFlag(practiceId, patientId, { kind: kind as AccountFlagKind, amountCents, value, reason });
        else await clearAccountFlag(practiceId, patientId, kind as AccountFlagKind, reason);
      }
      toast.success(`${FLAG_DEFINITIONS[kind].label} ${setting ? 'saved' : 'cleared'}`);
      setEditing(null);
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Not saved');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} busy={busy} size="lg" title={`Account flags: ${patientName}`} subtitle="What every staff member must know before billing, claiming, messaging or chasing this account" icon="solar:flag-bold-duotone"
      footer={<PrimaryButton icon="solar:check-circle-bold-duotone" onClick={onClose} disabled={busy}>Done</PrimaryButton>}>
      <ul className="divide-y divide-gray-100">
        {FLAG_ORDER.map(kind => {
          const definition = FLAG_DEFINITIONS[kind];
          const flag = current(kind);
          if (kind === 'no_sms' && smsOptOut === null) return null;
          const on = kind === 'no_sms' ? smsOptOut === true : !!flag;
          const accountLevel = definition.level === 'account';
          return (
            <li key={kind} className="py-3">
              <div className="flex flex-wrap items-start gap-3">
                <Icon icon={definition.icon} className={`mt-0.5 h-5 w-5 flex-shrink-0 ${on ? 'text-cyan-600' : 'text-gray-300'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {definition.label}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${on ? 'bg-cyan-50 text-cyan-800' : 'bg-gray-100 text-gray-500'}`}>
                      {on ? (flag ? flagChipText(flag, null) : 'On') : 'Off'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {definition.meaning}
                    {accountLevel && holderName ? `. Covers the whole family: it is kept on ${holderName}'s file.` : ''}
                    {definition.roles.length > 0 ? ` Only a practice ${definition.roles.join(' or ')} can change it.` : ''}
                  </p>
                  {kind === 'statement_message' && flag?.flag?.value && <p className="mt-0.5 text-xs text-gray-600 break-words">Message: {flag.flag.value}</p>}
                  {flag?.flag?.reason && <p className="mt-0.5 text-xs text-gray-600">Reason: {flag.flag.reason}</p>}
                </div>
                {editing !== kind && (
                  <SecondaryButton onClick={() => start(kind)} className="!px-2.5 !py-1" disabled={busy}>
                    {on ? (definition.value === 'none' ? 'Clear' : 'Change') : 'Set'}
                  </SecondaryButton>
                )}
              </div>

              {editing === kind && (
                <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  {error && <ErrorBox>{error}</ErrorBox>}
                  {definition.value === 'amount' && (
                    <Field label="Credit limit" htmlFor={`flag-${kind}-amount`}>
                      <AmountInput id={`flag-${kind}-amount`} value={amount} onChange={event => setAmount(event.target.value)} />
                    </Field>
                  )}
                  {definition.value === 'language' && (
                    <Field label="Statements in" htmlFor={`flag-${kind}-value`}>
                      <select id={`flag-${kind}-value`} className={inputClass} value={value} onChange={event => setValue(event.target.value)}>
                        {STATEMENT_LANGUAGES.map(language => <option key={language.value} value={language.value}>{language.label}</option>)}
                      </select>
                    </Field>
                  )}
                  {definition.value === 'text' && (() => {
                    const max = kind === 'statement_message' ? ACCOUNT_STATEMENT_MESSAGE_MAX : ALERT_MAX_LENGTH;
                    return (
                      <Field label={kind === 'statement_message' ? 'Message on every statement' : 'Alert'} htmlFor={`flag-${kind}-value`} hint={`${value.length}/${max}`}>
                        <textarea id={`flag-${kind}-value`} rows={2} className={inputClass} value={value} onChange={event => setValue(event.target.value)} maxLength={max} />
                      </Field>
                    );
                  })()}
                  {kind !== 'no_sms' && (definition.needsReason || on) && (
                    <Field label={definition.needsReason ? 'Reason (kept with the account)' : 'Reason (optional)'} htmlFor={`flag-${kind}-reason`}>
                      <input id={`flag-${kind}-reason`} className={inputClass} value={reason} onChange={event => setReason(event.target.value)} maxLength={300} />
                    </Field>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(!on || definition.value !== 'none') && (
                      <PrimaryButton onClick={() => void save(kind, true)} busy={busy}>{on ? 'Save change' : `Set ${definition.label.toLowerCase()}`}</PrimaryButton>
                    )}
                    {on && (
                      <PrimaryButton tone="red" icon="solar:close-circle-bold-duotone" onClick={() => void save(kind, false)} busy={busy}>Clear</PrimaryButton>
                    )}
                    <SecondaryButton onClick={() => setEditing(null)} disabled={busy}>Back</SecondaryButton>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
};
