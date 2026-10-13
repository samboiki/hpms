import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';
import { communicationService } from '../../../services/communicationService';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  AGE_BANDS,
  CONTACT_CHANNELS,
  PROMISE_STATE_LABELS,
  RELATIONSHIP_LABELS,
  checkContactNote,
  checkPromise,
  parseAmountInput,
  promiseStatus,
  reminderSmsText,
  statementFromKey,
  statementLanguageOf,
  statementMessageOf,
  toDateKey,
  type AgeAnalysisRow,
  type ArReceipt,
  type ContactChannel,
  type ContactNote,
  type PaymentPromise
} from '../../../services/ledgerService';
import DateInput from '../../ui/DateInput';
import { AmountInput, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { formatDay, printDocument } from '../receipts/receiptDocuments';
import { FlagChips } from './AccountFlagBadges';
import { FlagEditor } from './FlagEditor';
import { FamilySheet } from './FamilySheet';
import { patientFileLink } from './accountText';
import { useAccountFlags } from './useAccountFlags';
import {
  addContactNote,
  cancelPromise,
  loadAccountHistory,
  loadPatientContacts,
  loadPracticeDetails,
  loadStatementData,
  recordPromise,
  type PatientContact,
  type PracticeDetails
} from './debtorsService';
import { accountStatement, statementSection, statementsHtml, type AccountStatement, type StatementAccount, type StatementMeta } from './statementDocument';
import { StatementEmailSheet } from '../../messages/DocumentEmailSheets';
import { loadDocumentSettings } from '../../../services/documentSettingsService';
import { loadVatSettings } from '../../../services/vatSettingsService';
import { vatStatementNote } from '../../../utils/billing/vat';
import { practiceMessageFor } from '../../../utils/billing/documentSettings';

const nad = (cents: number) => formatNad(fromCents(cents));

interface AccountSheetProps {
  practiceId: string;
  /** The account: the account holder (or the patient who pays for themselves) */
  accountId: string;
  name: string;
  /** The account's row of the age analysis (what it owes, by age) */
  row: AgeAnalysisRow | null;
  /**
   * What the account owes itself (patientAccountRow: the patient portion less unallocated payments), as the work list
   * shows it. The reminder SMS and the promise limit use only this: the medical aid is claimed for its own part.
   */
  ownRow: AgeAnalysisRow | null;
  /** The patients behind the row, with what each owes */
  patientRows: readonly AgeAnalysisRow[];
  /** Receipts Finance has loaded (promises are kept or broken by them) */
  receipts: readonly ArReceipt[];
  accountOf: (patientId: string) => string;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * One account for the collections clerk: what it owes by age and per patient, the family, flags,
 * the promise in force, contact notes, a reminder SMS and the statement. Every action is kept on
 * the account holder's file.
 */
export const AccountSheet: React.FC<AccountSheetProps> = ({ practiceId, accountId, name, row, ownRow, patientRows, receipts, accountOf, onClose, onChanged }) => {
  const user = useAuthStore(state => state.user);
  const account = useAccountFlags(accountId, practiceId);
  const [todayKey] = useState(() => toDateKey(new Date()));
  const [history, setHistory] = useState<{ notes: ContactNote[]; promises: PaymentPromise[] } | null>(null);
  const [contact, setContact] = useState<PatientContact | null>(null);
  const [practice, setPractice] = useState<PracticeDetails | null>(null);
  const [sheet, setSheet] = useState<'flags' | 'family' | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadAccountHistory(practiceId, [accountId])
      .then(result => { if (!cancelled) setHistory({ notes: result.notes, promises: result.promises }); })
      .catch(() => { if (!cancelled) setHistory({ notes: [], promises: [] }); });
    return () => { cancelled = true; };
  }, [practiceId, accountId, historyKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPatientContacts(practiceId, [accountId]), loadPracticeDetails(practiceId)])
      .then(([contacts, details]) => { if (!cancelled) { setContact(contacts[accountId] ?? null); setPractice(details); } })
      .catch(error => console.warn('Account: contact details unavailable', error));
    return () => { cancelled = true; };
  }, [practiceId, accountId]);

  const changed = useCallback(() => {
    setHistoryKey(key => key + 1);
    account.reload();
    onChanged();
  }, [account, onChanged]);

  const promises = useMemo(() => (history?.promises ?? []).filter(promise => !promise.cancelledAt)
    .map(promise => ({ promise, status: promiseStatus(promise, receipts, todayKey, accountOf) })), [history, receipts, todayKey, accountOf]);
  const latest = promises[0] ?? null;
  const broken = promises.filter(item => item.status.state === 'broken').length;
  const language = statementLanguageOf(account.flags);
  const owedCents = row?.owedCents ?? 0;
  // What the patient may be asked for: never the medical aid's part
  const ownCents = Math.max(ownRow?.netCents ?? 0, 0);

  return (
    <Sheet open onClose={onClose} size="xl" title={name} subtitle={row ? `Owes ${nad(owedCents)}${row.medicalAidCents > 0 ? ` (patient to pay ${nad(ownCents)})` : ''}${row.unallocatedCents > 0 ? `, ${nad(row.unallocatedCents)} credit not allocated` : ''}` : 'Account'} icon="solar:user-bold-duotone"
      footer={<PrimaryButton icon="solar:check-circle-bold-duotone" onClick={onClose}>Done</PrimaryButton>}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <FlagChips flags={account.flags} creditLimit={account.creditLimit} />
          <SecondaryButton icon="solar:flag-bold-duotone" onClick={() => setSheet('flags')} className="!px-2.5 !py-1">Flags</SecondaryButton>
          <SecondaryButton icon="solar:users-group-rounded-bold-duotone" onClick={() => setSheet('family')} className="!px-2.5 !py-1">Family</SecondaryButton>
          <Link to={patientFileLink(accountId)} className="text-sm font-medium text-cyan-700 hover:underline">Open the patient file</Link>
        </div>

        {row && (
          <section aria-label="What the account owes">
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Patient</th>
                    {AGE_BANDS.map(band => <th key={band.key} scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">{band.label}</th>)}
                    <th scope="col" className="px-3 py-2 text-right font-medium">Owed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(patientRows.length > 0 ? patientRows : [row]).map(patientRow => (
                    <tr key={patientRow.key}>
                      <td className="px-3 py-2">
                        {patientRow.accountId ? <Link to={patientFileLink(patientRow.accountId)} className="text-cyan-700 hover:underline">{patientRow.label}</Link> : patientRow.label}
                      </td>
                      {AGE_BANDS.map(band => <td key={band.key} className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{patientRow.bands[band.key] ? nad(patientRow.bands[band.key]) : ''}</td>)}
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{nad(patientRow.owedCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {account.members.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Pays for {account.members.map((member, index) => (
                  <React.Fragment key={member.id}>
                    {index > 0 && ', '}
                    <Link to={patientFileLink(member.id)} className="text-cyan-700 hover:underline">{member.name}</Link> ({RELATIONSHIP_LABELS[member.relationship].toLowerCase()})
                  </React.Fragment>
                ))}
              </p>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PromiseSection
            practiceId={practiceId}
            accountId={accountId}
            owedCents={ownCents}
            todayKey={todayKey}
            latest={latest}
            broken={broken}
            onChanged={changed}
          />
          <NotesSection practiceId={practiceId} accountId={accountId} notes={history?.notes ?? null} onChanged={changed} />
        </div>

        <ContactSection
          practiceId={practiceId}
          accountId={accountId}
          name={name}
          row={row}
          ownRow={ownRow}
          contact={contact}
          practice={practice}
          language={language}
          layBye={account.flags.some(flag => flag.kind === 'lay_bye')}
          statementMessage={statementMessageOf(account.flags)}
          smsBlocked={account.smsOptOut === true}
          memberIds={[...new Set([accountId, ...account.members.map(member => member.id)])]}
          patientNames={Object.fromEntries([[accountId, name], ...account.members.map(member => [member.id, member.name])])}
          todayKey={todayKey}
          onChanged={changed}
        />
      </div>

      {sheet === 'flags' && (
        <FlagEditor
          practiceId={practiceId}
          patientId={accountId}
          patientName={name}
          holderName={account.holder?.name ?? null}
          flags={account.flags}
          smsOptOut={account.smsOptOut}
          role={user?.role}
          onClose={() => setSheet(null)}
          onChanged={changed}
        />
      )}
      {sheet === 'family' && (
        <FamilySheet practiceId={practiceId} patientId={accountId} patientName={name} holder={account.holder} members={account.members} onClose={() => setSheet(null)} onChanged={changed} />
      )}
    </Sheet>
  );
};

const PromiseSection: React.FC<{
  practiceId: string;
  accountId: string;
  owedCents: number;
  todayKey: string;
  latest: { promise: PaymentPromise; status: ReturnType<typeof promiseStatus> } | null;
  broken: number;
  onChanged: () => void;
}> = ({ practiceId, accountId, owedCents, todayKey, latest, broken, onChanged }) => {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [promisedOn, setPromisedOn] = useState(todayKey);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const amountCents = parseAmountInput(amount);
    const check = checkPromise({ amountCents, promisedOn, todayKey, owedCents });
    if (!check.ok) { setError(check.error); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await recordPromise(practiceId, accountId, { amountCents: amountCents ?? 0, promisedOn, note });
      toast.success(`Promise recorded${result.replaced > 0 ? ' (it replaces the earlier one)' : ''}`);
      setAdding(false);
      setAmount('');
      setNote('');
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? plainWords(saveError.message) : 'Not saved');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!latest) return;
    const reason = window.prompt('Why is the promise cancelled?');
    if (!reason || reason.trim().length < 3) return;
    try {
      await cancelPromise(latest.promise.id, reason);
      toast.success('Promise cancelled');
      onChanged();
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? plainWords(cancelError.message) : 'Not cancelled');
    }
  };

  const tone = latest?.status.state === 'broken' ? 'border-red-200 bg-red-50' : latest?.status.state === 'kept' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white';
  return (
    <section className="space-y-3" aria-label="Promise to pay">
      <h4 className="text-sm font-semibold text-gray-800">Promise to pay</h4>
      {latest ? (
        <div className={`rounded-xl border p-3 text-sm ${tone}`}>
          <p className="font-medium text-gray-900">{PROMISE_STATE_LABELS[latest.status.state]}: {nad(latest.promise.amountCents)} by {formatDay(latest.promise.promisedOn)}</p>
          <p className="text-xs text-gray-600">
            Made {formatDay(latest.promise.madeOn)}. Paid {nad(latest.status.paidCents)} in time{latest.status.paidLateCents > 0 ? `, ${nad(latest.status.paidLateCents)} late` : ''}.
            {broken > 0 ? ` ${broken} broken ${broken === 1 ? 'promise' : 'promises'} on record.` : ''}
          </p>
          {latest.promise.note && <p className="mt-1 text-xs text-gray-600">{latest.promise.note}</p>}
          {(latest.status.state === 'open' || latest.status.state === 'due_today') && (
            <button type="button" onClick={() => void cancel()} className="mt-1 text-xs text-gray-500 underline hover:text-red-700">Cancel this promise</button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No promise recorded.</p>
      )}
      {!adding ? (
        <SecondaryButton icon="solar:calendar-mark-bold-duotone" onClick={() => { setAdding(true); setError(null); }} disabled={owedCents <= 0}>Record a promise</SecondaryButton>
      ) : (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount promised" htmlFor="promise-amount"><AmountInput id="promise-amount" value={amount} onChange={event => setAmount(event.target.value)} /></Field>
            <DateInput label="Will pay by" value={promisedOn} onChange={setPromisedOn} minDate={todayKey} />
          </div>
          <Field label="Note (optional)" htmlFor="promise-note"><input id="promise-note" className={inputClass} value={note} onChange={event => setNote(event.target.value)} maxLength={300} /></Field>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => void save()} busy={busy}>Save promise</PrimaryButton>
            <SecondaryButton onClick={() => setAdding(false)} disabled={busy}>Back</SecondaryButton>
          </div>
        </div>
      )}
    </section>
  );
};

const NotesSection: React.FC<{ practiceId: string; accountId: string; notes: ContactNote[] | null; onChanged: () => void }> = ({ practiceId, accountId, notes, onChanged }) => {
  const [channel, setChannel] = useState<ContactChannel>('call');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const check = checkContactNote(text);
    if (!check.ok) { setError(check.error); return; }
    setBusy(true);
    setError(null);
    try {
      await addContactNote(practiceId, accountId, channel, text);
      setText('');
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? plainWords(saveError.message) : 'Not saved');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3" aria-label="Contact notes">
      <h4 className="text-sm font-semibold text-gray-800">Contact notes</h4>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_1fr]">
        <select aria-label="How" className={inputClass} value={channel} onChange={event => setChannel(event.target.value as ContactChannel)}>
          {CONTACT_CHANNELS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <textarea aria-label="What was said or agreed" rows={2} className={inputClass} value={text} onChange={event => setText(event.target.value)} maxLength={2000} placeholder="What was said or agreed" />
      </div>
      <PrimaryButton icon="solar:notebook-bold-duotone" onClick={() => void save()} busy={busy} disabled={text.trim().length === 0}>Add note</PrimaryButton>
      {notes === null ? (
        <div className="h-12 animate-pulse rounded-lg bg-gray-100" role="status" aria-label="Loading notes" />
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-500">No contact recorded yet.</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {notes.slice(0, 30).map(note => (
            <li key={note.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-sm">
              <p className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleString('en-NA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {CONTACT_CHANNELS.find(option => option.value === note.channel)?.label}</p>
              <p className="whitespace-pre-wrap text-gray-800">{note.note}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const ContactSection: React.FC<{
  practiceId: string;
  accountId: string;
  name: string;
  row: AgeAnalysisRow | null;
  /** What the account owes itself (the patient portion less unallocated payments): the only amount the SMS asks for */
  ownRow: AgeAnalysisRow | null;
  contact: PatientContact | null;
  practice: PracticeDetails | null;
  language: 'en' | 'af';
  /** Flagged "Lay-bye": the statement says it is paid off as agreed instead of showing what is overdue */
  layBye: boolean;
  /** The account's own message on its statements (parity I8) */
  statementMessage: string | null;
  smsBlocked: boolean;
  memberIds: string[];
  patientNames: Record<string, string>;
  todayKey: string;
  onChanged: () => void;
}> = ({ practiceId, accountId, name, row, ownRow, contact, practice, language, layBye, statementMessage, smsBlocked, memberIds, patientNames, todayKey, onChanged }) => {
  const [busy, setBusy] = useState<'sms' | 'print' | 'email' | null>(null);
  // The statement being emailed (made when Email statement is pressed)
  const [emailing, setEmailing] = useState<{ account: StatementAccount; built: AccountStatement; meta: StatementMeta } | null>(null);
  const sms = ownRow && ownRow.netCents > 0 && practice
    ? reminderSmsText({ practiceName: practice.name, owedCents: ownRow.netCents, oldestAgeDays: ownRow.oldestAgeDays, reference: contact?.reference ?? null, payment: practice.payment, contactPhone: practice.contactPhone, language })
    : null;
  // Only the medical aid's part is open: there is nothing to ask the patient for
  const onlyFundOwes = !sms && (row?.medicalAidCents ?? 0) > 0 && (ownRow?.netCents ?? 0) <= 0;

  const sendReminder = async () => {
    if (!sms || !contact?.cellNumber) return;
    if (!window.confirm(`Send this SMS to ${contact.cellNumber}?\n\n${sms}`)) return;
    setBusy('sms');
    try {
      const result = await communicationService.sendSMS({
        practiceId, recipientPhone: contact.cellNumber, messageContent: sms, messageType: 'system', patientId: accountId,
        metadata: { kind: 'debt_reminder' }
      });
      if (!result.success) throw new Error(result.error || 'The SMS was not sent');
      await addContactNote(practiceId, accountId, 'sms', `Reminder SMS sent to ${contact.cellNumber}: ${sms}`).catch(() => undefined);
      toast.success(`Reminder sent to ${contact.cellNumber}`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The SMS was not sent');
    } finally {
      setBusy(null);
    }
  };

  const statement = async (channel: 'print' | 'email') => {
    if (!practice) return;
    setBusy(channel);
    try {
      // The practice's message on statements and its settled-items default (parity D22, D26) come with every statement
      const [entries, settings, vat] = await Promise.all([loadStatementData(practiceId, memberIds), loadDocumentSettings(practiceId), loadVatSettings(practiceId)]);
      const account = { holderId: accountId, holderName: name, memberIds, patientNames, reference: contact?.reference ?? null, language, layBye, message: statementMessage };
      const built = accountStatement(account, entries, { fromKey: statementFromKey(todayKey, 3), asAtKey: todayKey, leaveSettledOff: settings.leaveSettledOff });
      const meta = {
        practiceName: practice.name, contactPhone: practice.contactPhone, contactEmail: practice.contactEmail, payment: practice.payment, asAtKey: todayKey, message: '',
        practiceMessage: practiceMessageFor(settings, 'statement'),
        vatNote: vatStatementNote(vat)
      };
      if (channel === 'print') {
        if (!printDocument(statementsHtml([statementSection(account, built, meta)], `Statement ${name}`))) toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      } else {
        // Checked and sent in the email sheet: the statement as a PDF attachment, with a message staff can change
        setEmailing({ account, built, meta });
      }
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The statement could not be made');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3 border-t border-gray-100 pt-4" aria-label="Contact">
      <h4 className="text-sm font-semibold text-gray-800">Contact</h4>
      <p className="text-sm text-gray-700">{[contact?.cellNumber, contact?.email].filter(Boolean).join(' · ') || 'No cell number or email on the patient file.'}</p>
      {sms && contact?.cellNumber && !smsBlocked && <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600"><span className="font-medium">Reminder SMS: </span>{sms}</p>}
      {smsBlocked && <p className="text-xs text-gray-500">The patient opted out of SMS: use email, a call or a printed statement.</p>}
      {onlyFundOwes && <p className="text-xs text-gray-500">The patient owes nothing themselves: what is open is the medical aid&apos;s part, followed up with the fund.</p>}
      <div className="flex flex-wrap gap-2">
        <SecondaryButton icon="solar:chat-round-dots-bold-duotone" onClick={() => void sendReminder()} disabled={!sms || !contact?.cellNumber || smsBlocked || busy !== null}>
          {busy === 'sms' ? 'Sending...' : 'Send reminder SMS'}
        </SecondaryButton>
        <SecondaryButton icon="solar:printer-minimalistic-bold-duotone" onClick={() => void statement('print')} disabled={!practice || busy !== null}>
          {busy === 'print' ? 'Preparing...' : 'Print statement'}
        </SecondaryButton>
        <SecondaryButton icon="solar:letter-bold-duotone" onClick={() => void statement('email')} disabled={!practice || busy !== null}>
          {busy === 'email' ? 'Preparing...' : 'Email statement'}
        </SecondaryButton>
      </div>
      {emailing && (
        <StatementEmailSheet
          open
          onClose={() => setEmailing(null)}
          practiceId={practiceId}
          patientId={accountId}
          account={emailing.account}
          built={emailing.built}
          meta={emailing.meta}
          onSent={to => {
            // On the account's contact history too, as before
            void addContactNote(practiceId, accountId, 'email', `Statement emailed to ${to}`).catch(() => undefined);
            onChanged();
          }}
        />
      )}
    </section>
  );
};
