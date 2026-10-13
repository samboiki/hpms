import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, SECONDARY, errorText } from '../stock/stockUi';
import { formatServiceDate } from '../../utils/billing/dates';
import { checkFundDraft, fundDraftFrom, type FundDraft, type FundDraftField } from '../../utils/billing/fundMaster';
import { loadFundChanges, saveFundDetails, type FundChange, type FundEntry } from '../../services/fundMasterService';

interface FundEditSheetProps {
  fund: FundEntry;
  onClose: () => void;
  onSaved: () => void;
}

const CHECKBOX = 'mt-0.5 h-4 w-4 flex-none rounded border-gray-300 text-cyan-600 focus-visible:ring-2 focus-visible:ring-cyan-500';

/**
 * OneHealth support changes a fund's details and rules in one place. The claim checks of every practice use them
 * from the next screen they open; each save is kept in the fund's history (who, when, what changed).
 */
export const FundEditSheet: React.FC<FundEditSheetProps> = ({ fund, onClose, onSaved }) => {
  const [draft, setDraft] = useState<FundDraft>(() =>
    fundDraftFrom({ name: fund.name, claimsEmail: fund.claimsEmail, logoUrl: fund.logoUrl }, fund.rule)
  );
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ changes: FundChange[] } | { error: string } | null>(null);
  const { errors, save } = checkFundDraft(draft);
  const shown = (field: FundDraftField): string | undefined => (tried ? errors[field] : undefined);
  const set = <K extends FundDraftField>(field: K, value: FundDraft[K]) => setDraft(current => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!fund.code) return;
    let live = true;
    loadFundChanges(fund.code)
      .then(changes => {
        if (live) setHistory({ changes });
      })
      .catch(error => {
        if (live) setHistory({ error: errorText(error, 'The changes could not be read.') });
      });
    return () => {
      live = false;
    };
  }, [fund.code]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setTried(true);
    if (!save || saving) return;
    setSaving(true);
    try {
      await saveFundDetails(fund.providerId, save);
      toast.success(`${save.name} is saved. Claims use its new rules from the next screen opened.`);
      onSaved();
    } catch (error) {
      toast.error(errorText(error, 'The fund could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" className={SECONDARY} onClick={onClose} disabled={saving}>Cancel</button>
      <button type="button" className={PRIMARY} onClick={() => void submit()} disabled={saving || (tried && !save)}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );

  return (
    <ListSheet open onClose={onClose} title={`Change ${fund.name}`} subtitle={`Claim code ${fund.code ?? '-'}`} size="lg" dismissible={!saving} footer={footer}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">The fund</legend>
          <Field label="Name" error={shown('name')}>
            {props => <input {...props} className={INPUT} value={draft.name} onChange={event => set('name', event.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Claims email" hint="Claim files are emailed here from Finance > Batches." error={shown('claimsEmail')}>
            {props => <input {...props} type="email" className={INPUT} value={draft.claimsEmail} onChange={event => set('claimsEmail', event.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Claims portal (if the fund takes claims online)" hint="A web address starting with https://; practices see it when they send a batch." error={shown('claimsPortalUrl')}>
            {props => <input {...props} type="url" className={INPUT} value={draft.claimsPortalUrl} onChange={event => set('claimsPortalUrl', event.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Logo (link to the picture)" hint="Leave empty to show the app's own picture of the fund." error={shown('logoUrl')}>
            {props => <input {...props} type="url" className={INPUT} value={draft.logoUrl} onChange={event => set('logoUrl', event.target.value)} autoComplete="off" />}
          </Field>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">Claim deadline, from the date of service</legend>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:max-w-sm">
            <Field label="How long" error={shown('deadlineAmount')}>
              {props => <input {...props} inputMode="numeric" className={INPUT} value={draft.deadlineAmount} onChange={event => set('deadlineAmount', event.target.value)} />}
            </Field>
            <select
              aria-label="Days or months"
              className={`${INPUT} w-auto`}
              value={draft.deadlineUnit}
              onChange={event => set('deadlineUnit', event.target.value === 'months' ? 'months' : 'days')}
            >
              <option value="days">days</option>
              <option value="months">months</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className={CHECKBOX} checked={draft.deadlineConfirmed} onChange={event => set('deadlineConfirmed', event.target.checked)} />
            <span>
              Confirmed with the fund
              <span className="block text-xs text-gray-500">Lines past a confirmed deadline cannot be sent; past an unconfirmed one they are only flagged.</span>
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">Membership numbers and dependants</legend>
          <Field label="Length in digits" hint='Digits only: type 9, or "13 or 14". Leave empty when not known (no check).' error={shown('membershipDigits')}>
            {props => <input {...props} className={INPUT} value={draft.membershipDigits} onChange={event => set('membershipDigits', event.target.value)} autoComplete="off" />}
          </Field>
          <Field label="Hint for reception" hint="Shown when a number does not fit, for example where it is printed on the card." error={shown('membershipHint')}>
            {props => <input {...props} className={INPUT} value={draft.membershipHint} onChange={event => set('membershipHint', event.target.value)} maxLength={250} autoComplete="off" />}
          </Field>
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className={CHECKBOX} checked={draft.dependantCodeRequired} onChange={event => set('dependantCodeRequired', event.target.checked)} />
            <span>
              Dependants are claimed with their dependant code
              <span className="block text-xs text-gray-500">A spouse or child without the code from the card is flagged before sending.</span>
            </span>
          </label>
        </fieldset>

        <Field
          label="Payment terms (days)"
          hint={'How long the fund usually takes to answer: "Funds that have not answered" waits this long, unless a practice set its own wait. Empty: 30 days.'}
          error={shown('paymentTermsDays')}
        >
          {props => <input {...props} inputMode="numeric" className={`${INPUT} sm:max-w-[10rem]`} value={draft.paymentTermsDays} onChange={event => set('paymentTermsDays', event.target.value)} />}
        </Field>

        <details className="rounded-xl bg-gray-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-gray-800">Changes to this fund</summary>
          {history === null ? (
            <p className="mt-2 text-gray-500" role="status">Loading the changes...</p>
          ) : 'error' in history ? (
            <p className="mt-2 text-red-700">{history.error}</p>
          ) : history.changes.length === 0 ? (
            <p className="mt-2 text-gray-500">No changes yet: it holds the values the app used before.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {history.changes.map(change => (
                <li key={change.changedAt}>
                  <p className="text-xs font-medium text-gray-700">{formatServiceDate(new Date(change.changedAt))}, {change.changedBy}</p>
                  <ul className="list-disc pl-5 text-gray-800">
                    {change.lines.map(line => <li key={line} className="break-words">{line}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </details>
      </form>
    </ListSheet>
  );
};
