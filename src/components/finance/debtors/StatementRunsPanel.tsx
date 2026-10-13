import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  DEFAULT_AGE_FILTER,
  DEFAULT_STATEMENT_CRITERIA,
  STATEMENT_CHANNEL_LABELS,
  STATEMENT_SKIP_LABELS,
  buildAgeAnalysis,
  centsToInput,
  checkStatementCriteria,
  dateKeyFrom,
  parseAmountInput,
  planStatementRun,
  runLeavesSettledOff,
  statementCriteriaJson,
  statementFromKey,
  statementMessagesByAccount,
  statementSmsText,
  type AccountFlag,
  type AgeAnalysisContext,
  type AgingReport,
  type StatementChannel,
  type StatementContact,
  type StatementCriteria,
  type StatementLanguage,
  type StatementPlan
} from '../../../services/ledgerService';
import { EmptyState, Notice, SectionCard } from '../FinanceUI';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { formatDay, printDocument } from '../receipts/receiptDocuments';
import { useAuthStore } from '../../../stores/authStore';
import { isStaffAdmin } from '../../settings/UserManagement/staffUtils';
import { loadDocumentSettings } from '../../../services/documentSettingsService';
import { loadVatSettings } from '../../../services/vatSettingsService';
import { vatStatementNote } from '../../../utils/billing/vat';
import { DEFAULT_DOCUMENT_SETTINGS, practiceMessageFor, type DocumentSettings } from '../../../utils/billing/documentSettings';
import { DocumentSettingsSheet } from './DocumentSettingsSheet';
import {
  errorText,
  finishStatementRun,
  loadPatientContacts,
  loadPatientNames,
  loadPracticeDetails,
  loadStatementCriteria,
  loadStatementData,
  loadStatementRuns,
  saveStatementCriteria,
  startStatementRun,
  type PatientContact,
  type PracticeDetails,
  type SavedStatementCriteria,
  type StatementRunRecord
} from './debtorsService';
import { accountStatement, statementEmail, statementSection, statementsHtml, type StatementAccount } from './statementDocument';
import { sendStatementRun, type StatementMessage } from './statementSender';
import { statementPdfModel } from './statementPdf';
import { pdfBase64, renderFinanceDocumentPdf } from '../receipts/documentPdf';
import { loadLetterhead } from '../../quotes/quoteService';

const nad = (cents: number) => formatNad(fromCents(cents));
const CHANNELS: StatementChannel[] = ['email', 'sms', 'print'];

interface StatementRunsPanelProps {
  practiceId: string;
  aging: AgingReport;
  context: AgeAnalysisContext;
  /** Flags in force (statement language of each account holder) */
  flags: readonly AccountFlag[];
  todayKey: string;
}

interface Preview {
  plan: StatementPlan;
  contacts: Record<string, PatientContact>;
}

/**
 * Statement runs: saved criteria (e.g. every account over N$ 100 older than 30 days), a preview of
 * who gets what by which channel, then print, or send by email and SMS through the practice's
 * gateways. A family gets one statement, to its account holder, in the account's language.
 */
export const StatementRunsPanel: React.FC<StatementRunsPanelProps> = ({ practiceId, aging, context, flags, todayKey }) => {
  const [saved, setSaved] = useState<SavedStatementCriteria[] | null>(null);
  const [runs, setRuns] = useState<StatementRunRecord[]>([]);
  const [practice, setPractice] = useState<PracticeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [criteria, setCriteria] = useState<StatementCriteria>(DEFAULT_STATEMENT_CRITERIA);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'print' | 'send' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The practice's message on statements and whether they leave settled items off (parity D22, D26)
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>(DEFAULT_DOCUMENT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const user = useAuthStore(state => state.user);
  const isAdmin = isStaffAdmin(user);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadStatementCriteria(practiceId), loadStatementRuns(practiceId), loadPracticeDetails(practiceId), loadDocumentSettings(practiceId)])
      .then(([criteriaRows, runRows, details, settings]) => {
        if (cancelled) return;
        setSaved(criteriaRows);
        setRuns(runRows);
        setPractice(details);
        setDocumentSettings(settings);
      })
      .catch(loadError => { if (!cancelled) setError(errorText(loadError, 'Could not load the statement runs')); });
    return () => { cancelled = true; };
  }, [practiceId, reloadKey]);

  const languages = useMemo(() => {
    const byAccount: Record<string, StatementLanguage> = {};
    for (const flag of flags) if (flag.flag === 'statement_language' && !flag.clearedAt && flag.value === 'af') byAccount[flag.patientId] = 'af';
    return byAccount;
  }, [flags]);
  // Lay-bye accounts (the flag is on the account holder): their statements say so instead of showing what is overdue
  const layByes = useMemo(() => new Set(flags.filter(flag => flag.flag === 'lay_bye' && !flag.clearedAt).map(flag => flag.patientId)), [flags]);
  // Each account's own message for its statements (parity I8), kept on the account holder
  const accountMessages = useMemo(() => statementMessagesByAccount(flags), [flags]);
  const leavesSettledOff = runLeavesSettledOff(criteria, documentSettings.leaveSettledOff);
  const funds = useMemo(() => [...new Set(Object.values(context.fundByPatient))].sort(), [context.fundByPatient]);

  const choose = (id: string) => {
    setSelectedId(id);
    setPreview(null);
    setCriteria(saved?.find(item => item.id === id)?.criteria ?? DEFAULT_STATEMENT_CRITERIA);
  };

  const makePreview = async () => {
    const check = checkStatementCriteria(criteria);
    if (!check.ok) { toast.error(check.error ?? 'Check the criteria'); return; }
    setBusy('preview');
    try {
      const accounts = buildAgeAnalysis(aging, { ...DEFAULT_AGE_FILTER, grouping: 'account', portion: criteria.portion, excludeFlags: [], includeCreditOnly: false }, context).rows;
      const contacts = await loadPatientContacts(practiceId, accounts.map(row => row.accountId ?? '').filter(Boolean));
      // A patient who replied STOP gets no SMS from a run: their statement goes by email or print
      const routes: Record<string, StatementContact> = Object.fromEntries(Object.entries(contacts).map(([id, contact]) => [id, { email: contact.email, cellNumber: contact.smsOptOut ? null : contact.cellNumber }]));
      setPreview({ plan: planStatementRun({ accounts, criteria, contacts: routes, fundByPatient: context.fundByPatient, languageByAccount: languages }), contacts });
    } catch (previewError) {
      toast.error(errorText(previewError, 'The preview could not be made'));
    } finally {
      setBusy(null);
    }
  };

  /** The statements of the planned accounts on the given channels, built from one batch of entries */
  const build = async (channels: StatementChannel[]) => {
    if (!preview || !practice) throw new Error('Preview the run first');
    const planned = preview.plan.statements.filter(statement => channels.includes(statement.channel));
    // A family statement shows every member's activity in the period, also of members who owe nothing now
    const holders = context.holderByPatient ?? {};
    const familyOf = (holderId: string, owing: readonly string[]) =>
      [...new Set([...owing, ...Object.keys(holders).filter(patientId => holders[patientId] === holderId)])];
    const patientIds = [...new Set(planned.flatMap(statement => [statement.patientId, ...familyOf(statement.patientId, statement.memberIds)]))];
    const missing = patientIds.filter(id => !context.patientNames[id]);
    const [entries, extraNames, vat] = await Promise.all([loadStatementData(practiceId, patientIds), loadPatientNames(practiceId, missing), loadVatSettings(practiceId)]);
    const patientNames = { ...context.patientNames, ...extraNames };
    const meta = {
      practiceName: practice.name, contactPhone: practice.contactPhone, contactEmail: practice.contactEmail, payment: practice.payment, asAtKey: todayKey, message: criteria.message,
      practiceMessage: practiceMessageFor(documentSettings, 'statement'),
      vatNote: vatStatementNote(vat)
    };
    const fromKey = statementFromKey(todayKey, criteria.historyMonths);
    return planned.map(statement => {
      const account: StatementAccount = {
        holderId: statement.patientId,
        holderName: statement.name,
        memberIds: familyOf(statement.patientId, statement.memberIds),
        patientNames,
        reference: preview.contacts[statement.patientId]?.reference ?? null,
        language: statement.language,
        layBye: layByes.has(statement.patientId),
        message: accountMessages[statement.patientId] ?? null
      };
      const built = accountStatement(account, entries, { fromKey, asAtKey: todayKey, leaveSettledOff: leavesSettledOff });
      return { statement, account, built, meta };
    });
  };

  const print = async () => {
    setBusy('print');
    try {
      const items = await build(['print']);
      if (items.length === 0) { toast('No statements to print in this run'); return; }
      if (!printDocument(statementsHtml(items.map(item => statementSection(item.account, item.built, item.meta)), `Statements ${criteria.name}`))) {
        toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      }
    } catch (printError) {
      toast.error(errorText(printError, 'The statements could not be printed'));
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!preview || !practice) return;
    setBusy('send');
    setConfirming(false);
    try {
      const items = await build(['email', 'sms']);
      const run = await startStatementRun(practiceId, {
        criteria_id: selectedId || null,
        name: criteria.name,
        criteria: statementCriteriaJson(criteria),
        as_at: todayKey,
        planned: { ...preview.plan.counts, skipped: preview.plan.skipped.length }
      });
      // The SMS says what the run asks for: on a patient run, what the patient owes after their credit
      const smsBalance = (closing: { patient: number; credit: number; total: number }) =>
        (criteria.portion === 'patient' ? Math.max(0, closing.patient - closing.credit) : closing.total);
      // Each emailed statement also goes as a plain PDF, without a password (owner, 13 Oct 2026)
      const letterhead = items.some(item => item.statement.channel === 'email') ? await loadLetterhead(practiceId) : null;
      const statementPdf = (item: (typeof items)[number]) => {
        if (!letterhead) return undefined;
        const model = statementPdfModel(item.account, item.built, item.meta, letterhead);
        return { fileName: model.fileName, base64: pdfBase64(renderFinanceDocumentPdf(model)) };
      };
      const messages: StatementMessage[] = [
        ...items.map(item => ({
          planned: item.statement,
          email: item.statement.channel === 'email' ? { ...statementEmail(item.account, item.built, item.meta), attachment: statementPdf(item) } : undefined,
          sms: item.statement.channel === 'sms'
            ? statementSmsText({ practiceName: practice.name, balanceCents: smsBalance(item.built.statement.closing), asAtKey: todayKey, reference: item.account.reference, payment: practice.payment, message: criteria.message, contactPhone: practice.contactPhone, language: item.statement.language })
            : undefined
        })),
        // Statements to print are counted with the run; Print makes them
        ...preview.plan.statements.filter(statement => statement.channel === 'print').map(planned => ({ planned }))
      ];
      setProgress({ done: 0, total: messages.length });
      const totals = await sendStatementRun(messages, { practiceId, runId: run.id, bulk: true }, (done, total) => setProgress({ done, total }));
      await finishStatementRun(run.id, { ...totals });
      toast.success(`Sent: ${totals.emailed} emails, ${totals.sms} SMS. ${totals.printed} to print${totals.failed > 0 ? `, ${totals.failed} failed` : ''}.`);
      setReloadKey(key => key + 1);
    } catch (sendError) {
      toast.error(errorText(sendError, 'The run stopped'));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  if (error && !saved) return <ErrorBox>{error}</ErrorBox>;

  return (
    <SectionCard title="Statement runs" subtitle="Who gets a statement, and how: preview first, then print or send" icon="solar:bill-list-bold-duotone" tone="cyan">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Run" htmlFor="statement-run" className="w-full sm:w-72">
            <select id="statement-run" className={inputClass} value={selectedId} onChange={event => choose(event.target.value)}>
              <option value="">{DEFAULT_STATEMENT_CRITERIA.name} (default)</option>
              {(saved ?? []).map(item => <option key={item.id} value={item.id}>{item.criteria.name}</option>)}
            </select>
          </Field>
          <SecondaryButton icon="solar:pen-bold-duotone" onClick={() => setEditing(true)}>Change criteria</SecondaryButton>
          <SecondaryButton icon="solar:settings-bold-duotone" onClick={() => setSettingsOpen(true)}>Messages and settings</SecondaryButton>
          <PrimaryButton icon="solar:eye-bold-duotone" onClick={() => void makePreview()} busy={busy === 'preview'}>Preview</PrimaryButton>
        </div>
        <p className="text-sm text-gray-600">
          {criteria.portion === 'patient' ? 'What patients owe' : 'The whole account'}, at least {nad(criteria.minBalanceCents)}
          {criteria.minAgeDays > 0 ? `, with something ${criteria.minAgeDays} days or older` : ''}
          {criteria.funds.length > 0 ? `, members of ${criteria.funds.join(', ')}` : ''}. Sent by {criteria.channels.map(channel => STATEMENT_CHANNEL_LABELS[channel].toLowerCase()).join(', then ')}.
          {criteria.historyMonths > 0 ? ` Shows ${criteria.historyMonths} ${criteria.historyMonths === 1 ? 'month' : 'months'} of history.` : ' Shows the whole history.'}
          {leavesSettledOff ? ' Settled items are left off.' : ''}
        </p>

        {preview && (
          <div className="space-y-3 rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {CHANNELS.map(channel => <span key={channel} className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-800">{STATEMENT_CHANNEL_LABELS[channel]}: {preview.plan.counts[channel]}</span>)}
              <span className="text-gray-500">{preview.plan.skipped.length} skipped</span>
            </div>
            {preview.plan.statements.length === 0 ? (
              <EmptyState compact icon="solar:bill-list-bold-duotone" title="Nobody matches this run" message="Lower the minimum balance or the age, or include more funds." />
            ) : (
              <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100 text-sm">
                {preview.plan.statements.map(statement => (
                  <li key={statement.patientId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{statement.name}{statement.memberIds.length > 1 ? ` (+${statement.memberIds.length - 1})` : ''}</span>
                    <span className="text-xs text-gray-500">{STATEMENT_CHANNEL_LABELS[statement.channel]}{statement.to ? ` · ${statement.to}` : ''}{statement.language === 'af' ? ' · Afrikaans' : ''}</span>
                    <span className="tabular-nums">{nad(statement.netCents)}</span>
                  </li>
                ))}
              </ul>
            )}
            {preview.plan.skipped.length > 0 && (
              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer">Why {preview.plan.skipped.length} {preview.plan.skipped.length === 1 ? 'account is' : 'accounts are'} skipped</summary>
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(preview.plan.skipped.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.reason]: (counts[item.reason] ?? 0) + 1 }), {}))
                    .map(([reason, count]) => <li key={reason}>{STATEMENT_SKIP_LABELS[reason as keyof typeof STATEMENT_SKIP_LABELS]}: {count}</li>)}
                </ul>
              </details>
            )}
            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              <SecondaryButton icon="solar:printer-minimalistic-bold-duotone" onClick={() => void print()} disabled={busy !== null || preview.plan.counts.print === 0}>
                {busy === 'print' ? 'Preparing...' : `Print ${preview.plan.counts.print}`}
              </SecondaryButton>
              <PrimaryButton icon="solar:letter-bold-duotone" onClick={() => setConfirming(true)} disabled={busy !== null || preview.plan.counts.email + preview.plan.counts.sms === 0}>
                Send {preview.plan.counts.email} emails and {preview.plan.counts.sms} SMS
              </PrimaryButton>
            </div>
            {progress && <p className="text-sm text-gray-700" role="status">Sending {progress.done} of {progress.total}...</p>}
          </div>
        )}

        {runs.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-800">Earlier runs</h4>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
              {runs.slice(0, 8).map(run => {
                const results = (run.results ?? {}) as Record<string, number>;
                return (
                  <li key={run.id} className="flex flex-wrap gap-x-3 px-3 py-2">
                    <span className="font-medium text-gray-900">{run.name}</span>
                    <span className="text-gray-500">{formatDay(dateKeyFrom(run.startedAt))}</span>
                    <span className="text-gray-600">
                      {run.finishedAt ? `${results.emailed ?? 0} emailed, ${results.sms ?? 0} SMS, ${results.printed ?? 0} to print${results.failed ? `, ${results.failed} failed` : ''}` : 'Did not finish: check the communication logs'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <Notice tone="info">Statements go only to the email address or cell number on the patient file, without a password made from a date of birth, and every message is logged with the run.</Notice>
      </div>

      {editing && (
        <CriteriaSheet
          practiceId={practiceId}
          savedId={selectedId || null}
          criteria={criteria}
          funds={funds}
          settledDefault={documentSettings.leaveSettledOff}
          onClose={() => setEditing(false)}
          onApply={(next, id) => { setCriteria(next); setPreview(null); setEditing(false); if (id) { setSelectedId(id); setReloadKey(key => key + 1); } }}
        />
      )}
      {settingsOpen && (
        <DocumentSettingsSheet
          practiceId={practiceId}
          settings={documentSettings}
          canEdit={isAdmin}
          onClose={() => setSettingsOpen(false)}
          onSaved={next => { setDocumentSettings(next); setPreview(null); setSettingsOpen(false); }}
        />
      )}
      {confirming && preview && (
        <Sheet open onClose={() => setConfirming(false)} size="md" title="Send the statements?" subtitle={`${preview.plan.counts.email} emails and ${preview.plan.counts.sms} SMS through the practice's gateways`} icon="solar:letter-bold-duotone"
          footer={<><SecondaryButton onClick={() => setConfirming(false)}>Back</SecondaryButton><PrimaryButton icon="solar:letter-bold-duotone" onClick={() => void send()}>Send now</PrimaryButton></>}>
          <p className="text-sm text-gray-700">Each message counts against the practice's SMS and email bundles. Patients who replied STOP get their statement by email or on paper instead.</p>
        </Sheet>
      )}
    </SectionCard>
  );
};

const CriteriaSheet: React.FC<{
  practiceId: string;
  savedId: string | null;
  criteria: StatementCriteria;
  funds: readonly string[];
  /** The practice's default for settled items (Messages and settings) */
  settledDefault: boolean;
  onClose: () => void;
  onApply: (criteria: StatementCriteria, savedId: string | null) => void;
}> = ({ practiceId, savedId, criteria, funds, settledDefault, onClose, onApply }) => {
  const [draft, setDraft] = useState<StatementCriteria>(criteria);
  const [minBalance, setMinBalance] = useState(centsToInput(criteria.minBalanceCents));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<StatementCriteria>) => setDraft(current => ({ ...current, ...patch }));
  const finalDraft = (): StatementCriteria | null => {
    const cents = minBalance.trim() ? parseAmountInput(minBalance) : 0;
    if (cents === null) { setError('Enter the smallest balance in N$'); return null; }
    const next = { ...draft, minBalanceCents: cents };
    const check = checkStatementCriteria(next);
    if (!check.ok) { setError(check.error); return null; }
    return next;
  };
  const save = async () => {
    const next = finalDraft();
    if (!next) return;
    setBusy(true);
    try {
      const result = await saveStatementCriteria(practiceId, savedId, next, statementCriteriaJson(next));
      toast.success(`Saved "${next.name}"`);
      onApply(next, result.id);
    } catch (saveError) {
      setError(errorText(saveError, 'Not saved'));
    } finally {
      setBusy(false);
    }
  };
  const toggleChannel = (channel: StatementChannel) => update({ channels: draft.channels.includes(channel) ? draft.channels.filter(item => item !== channel) : [...draft.channels, channel] });
  return (
    <Sheet open onClose={onClose} busy={busy} size="lg" title="Statement run criteria" subtitle="Saved runs are kept for next month" icon="solar:pen-bold-duotone"
      footer={<>
        <SecondaryButton onClick={onClose} disabled={busy}>Back</SecondaryButton>
        <SecondaryButton onClick={() => { const next = finalDraft(); if (next) onApply(next, null); }} disabled={busy}>Use once</SecondaryButton>
        <PrimaryButton onClick={() => void save()} busy={busy}>Save run</PrimaryButton>
      </>}>
      <div className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Name" htmlFor="criteria-name"><input id="criteria-name" className={inputClass} value={draft.name} onChange={event => update({ name: event.target.value })} maxLength={80} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Owes at least" htmlFor="criteria-min"><input id="criteria-min" className={inputClass} inputMode="decimal" value={minBalance} onChange={event => setMinBalance(event.target.value)} /></Field>
          <Field label="Something at least" htmlFor="criteria-age">
            <select id="criteria-age" className={inputClass} value={draft.minAgeDays} onChange={event => update({ minAgeDays: Number(event.target.value) })}>
              {[0, 30, 60, 90, 120].map(days => <option key={days} value={days}>{days === 0 ? 'Any age' : `${days} days old`}</option>)}
            </select>
          </Field>
          <Field label="History shown" htmlFor="criteria-history">
            <select id="criteria-history" className={inputClass} value={draft.historyMonths} onChange={event => update({ historyMonths: Number(event.target.value) })}>
              {[1, 2, 3, 6, 12, 0].map(months => <option key={months} value={months}>{months === 0 ? 'Whole history' : `${months} ${months === 1 ? 'month' : 'months'}`}</option>)}
            </select>
          </Field>
        </div>
        <Field label="What the statement asks for" htmlFor="criteria-portion">
          <select id="criteria-portion" className={inputClass} value={draft.portion} onChange={event => update({ portion: event.target.value === 'both' ? 'both' : 'patient' })}>
            <option value="patient">What patients owe themselves (usual)</option>
            <option value="both">The whole account, medical aid portions too</option>
          </select>
        </Field>
        <Field label="Settled items (paid invoices and what paid them)" htmlFor="criteria-settled">
          <select id="criteria-settled" className={inputClass} value={draft.leaveSettledOff === null ? '' : draft.leaveSettledOff ? 'off' : 'show'}
            onChange={event => update({ leaveSettledOff: event.target.value === '' ? null : event.target.value === 'off' })}>
            <option value="">As the practice&apos;s setting ({settledDefault ? 'left off' : 'shown'})</option>
            <option value="off">Leave them off</option>
            <option value="show">Show them</option>
          </select>
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Send by (in this order of preference)</legend>
          <div className="flex flex-wrap gap-3">
            {CHANNELS.map(channel => (
              <label key={channel} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600" checked={draft.channels.includes(channel)} onChange={() => toggleChannel(channel)} />
                {STATEMENT_CHANNEL_LABELS[channel]}{draft.channels.includes(channel) ? ` (${draft.channels.indexOf(channel) + 1})` : ''}
              </label>
            ))}
          </div>
        </fieldset>
        {funds.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-700">Only members of (none ticked = everyone)</legend>
            <div className="flex max-h-32 flex-wrap gap-3 overflow-y-auto">
              {funds.map(fund => (
                <label key={fund} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600" checked={draft.funds.includes(fund)}
                    onChange={() => update({ funds: draft.funds.includes(fund) ? draft.funds.filter(item => item !== fund) : [...draft.funds, fund] })} />
                  {fund}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600" checked={draft.excludeDisputed} onChange={() => update({ excludeDisputed: !draft.excludeDisputed })} />Skip accounts in dispute</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600" checked={draft.excludeHandedOver} onChange={() => update({ excludeHandedOver: !draft.excludeHandedOver })} />Skip handed-over accounts</label>
        </div>
        <Field label="Message on every statement (optional)" htmlFor="criteria-message" hint="For example: we are closed from 20 December to 3 January">
          <textarea id="criteria-message" rows={2} className={inputClass} value={draft.message} onChange={event => update({ message: event.target.value })} maxLength={500} />
        </Field>
      </div>
    </Sheet>
  );
};
