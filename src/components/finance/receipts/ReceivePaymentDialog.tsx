import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import DateInput from '../../ui/DateInput';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  CAPTURE_METHODS,
  PORTION_LABELS,
  RECEIPT_METHOD_LABELS,
  centsToInput,
  checkAllocation,
  checkLineSplit,
  coverCodes,
  coverLabel,
  invoiceDateKey,
  openItemKey,
  owedPortions,
  parseAmountInput,
  patientOwesNowCents,
  payerPortions,
  sortOldestFirst,
  splitCovers,
  suggestAllocation,
  suggestLineSplit,
  toDateKey,
  type InvoiceLineOpen,
  type LineAmount,
  type OpenItem,
  type PayerType,
  type Portion,
  type ReceiptMethod,
  type SuggestedAllocation
} from '../../../services/ledgerService';
import {
  AR_NOT_SET_UP_MESSAGE,
  loadInvoiceLines,
  loadPatientAccount,
  postReceipt,
  searchPatients,
  type PatientAccount,
  type PatientMatch
} from './arService';
import { AmountInput, ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass, type Choice } from './ArUi';
import { AllocationLinePicker } from './AllocationLinePicker';
import { FundPaymentSheet } from './FundPaymentSheet';
import { ReceiptShareActions } from './ReceiptShareActions';
import { formatDay, type ReceiptDocument } from './receiptDocuments';

export interface ReceivePaymentDialogProps {
  practiceId: string;
  practiceName: string;
  /** Who records it (printed on the receipt) */
  staffName?: string | null;
  /** 'medical_aid' opens the fund payment keyed line by line (FundPaymentSheet) */
  initialPayer?: PayerType;
  initialPatient?: { id: string; name: string } | null;
  /** Opened from an invoice: that invoice is paid first */
  focusInvoiceId?: string | null;
  /**
   * Opened by "Invoice and take payment": the amount starts at what the patient owes now on that
   * invoice (patientOwesNowCents); nothing when the medical aid pays it all
   */
  prefillPatientShare?: boolean;
  /** Opened over a full-screen screen (the visit) */
  overFullScreen?: boolean;
  onClose: () => void;
  /** A receipt was saved (refresh lists and balances) */
  onSaved?: () => void;
}

interface PayItem extends OpenItem {
  key: string;
}

const PAYER_CHOICES: readonly Choice<PayerType>[] = [
  { value: 'patient', label: 'Patient', icon: 'solar:user-bold-duotone' },
  { value: 'medical_aid', label: 'Medical aid fund', icon: 'solar:heart-pulse-bold-duotone' },
  { value: 'other', label: 'Someone else', icon: 'solar:users-group-rounded-bold-duotone' }
];

const METHOD_ICONS: Record<string, string> = {
  cash: 'solar:wad-of-money-bold-duotone',
  card: 'solar:card-bold-duotone',
  eft: 'solar:transfer-horizontal-bold-duotone',
  debit_order: 'solar:calendar-mark-bold-duotone',
  medical_aid: 'solar:heart-pulse-bold-duotone'
};

type CaptureMethod = Exclude<ReceiptMethod, 'other' | 'not_recorded'>;
const METHOD_CHOICES: readonly Choice<CaptureMethod>[] = CAPTURE_METHODS.map(method => ({
  value: method as CaptureMethod,
  label: RECEIPT_METHOD_LABELS[method],
  icon: METHOD_ICONS[method]
}));

const nad = (cents: number) => formatNad(fromCents(cents));

/** Oldest first, but the invoice the payment was opened from comes first */
function suggestWithFocus(amountCents: number, items: readonly PayItem[], portions: Portion[], focusInvoiceId: string | null): SuggestedAllocation {
  if (!focusInvoiceId) return suggestAllocation(amountCents, items, portions);
  const first = suggestAllocation(amountCents, items.filter(item => item.invoiceId === focusInvoiceId), portions);
  const rest = suggestAllocation(first.unallocatedCents, items.filter(item => item.invoiceId !== focusInvoiceId), portions);
  return { lines: [...first.lines, ...rest.lines], allocatedCents: first.allocatedCents + rest.allocatedCents, unallocatedCents: rest.unallocatedCents };
}

interface Saved {
  receiptId: string;
  document: ReceiptDocument;
  patientId: string | null;
  onlyInvoiceId: string | null;
}

/** Amounts typed per invoice line: whole cents, 0 for an empty box, null where the text is not an amount */
const parseLineTexts = (texts: Readonly<Record<string, string>>): Array<{ lineId: string; cents: number | null }> =>
  Object.entries(texts).map(([lineId, text]) => ({ lineId, cents: text.trim() === '' ? 0 : parseAmountInput(text) }));

/** The lines chosen in a row (amounts above zero) */
const chosenOf = (texts: Readonly<Record<string, string>>): LineAmount[] =>
  parseLineTexts(texts)
    .filter((entry): entry is { lineId: string; cents: number } => entry.cents !== null && entry.cents > 0)
    .map(entry => ({ lineId: entry.lineId, amountCents: entry.cents }));

/**
 * Receive payment: who paid, how much and how; the open invoices oldest first with the suggested
 * allocation filled in (editable); what is left over stays on the account as credit. Saved as one
 * receipt with all its allocations in one call. A medical aid fund's payment is keyed line by line
 * against its total in FundPaymentSheet.
 */
export const ReceivePaymentDialog: React.FC<ReceivePaymentDialogProps> = ({
  practiceId,
  practiceName,
  staffName,
  initialPayer = 'patient',
  initialPatient = null,
  focusInvoiceId = null,
  prefillPatientShare = false,
  overFullScreen = false,
  onClose,
  onSaved
}) => {
  const [todayKey] = useState(() => toDateKey(new Date()));
  const [payerType, setPayerType] = useState<PayerType>(initialPayer);
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(initialPatient);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PatientMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [payerName, setPayerName] = useState('');
  const [account, setAccount] = useState<PatientAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<CaptureMethod>(initialPayer === 'medical_aid' ? 'medical_aid' : 'cash');
  const [reference, setReference] = useState('');
  const [receivedOn, setReceivedOn] = useState(todayKey);
  const [notes, setNotes] = useState('');
  const [lineText, setLineText] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState(false);
  // The open invoices' lines (what is unpaid on each); null before allocation lines exist in the database
  const [invoiceLines, setInvoiceLines] = useState<Record<string, InvoiceLineOpen[]> | null>(null);
  // Rows paid by line: the typed amount per invoice line, by row key; other rows are split oldest line first
  const [byLine, setByLine] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const isFund = payerType === 'medical_aid';

  // Patient search (debounced)
  useEffect(() => {
    if (isFund || patient) return;
    const term = query.trim();
    setSearching(term.length >= 2);
    if (term.length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPatients(practiceId, term)
        .then(result => { if (!cancelled) setMatches(result); })
        .catch(error => { if (!cancelled) setLoadError(error instanceof Error ? plainWords(error.message) : 'Could not search patients'); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, practiceId, patient, isFund]);

  // The chosen patient's open invoices
  useEffect(() => {
    if (isFund || !patient) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    // Data and the loading flag change together, so the list never shows a half-loaded state
    loadPatientAccount(practiceId, patient.id)
      .then(result => {
        if (cancelled) return;
        setAccount(result);
        setNotSetUp(result.state === 'not_set_up');
        setLoading(false);
      })
      .catch(error => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? plainWords(error.message) : 'Could not load the account');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isFund, patient, practiceId]);

  // The open invoices' lines, to choose what a payment covers (nothing to choose before allocation lines exist)
  useEffect(() => {
    setByLine({});
    if (!account || account.state !== 'ready') {
      setInvoiceLines(null);
      return;
    }
    const ids = account.invoices
      .filter(invoice => {
        const owed = owedPortions(invoice, account.balances[invoice.id]);
        return owed.patient > 0 || owed.medical_aid > 0;
      })
      .map(invoice => invoice.id);
    let cancelled = false;
    loadInvoiceLines(ids)
      .then(result => { if (!cancelled) setInvoiceLines(result); })
      .catch(error => {
        if (cancelled) return;
        // Payments are then split oldest line first by the database, as when nobody chooses
        console.warn('Invoice lines unavailable', error);
        setInvoiceLines(null);
      });
    return () => { cancelled = true; };
  }, [account]);

  // "Invoice and take payment": start at what the patient owes now on the new invoice, once, unless staff typed already
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!prefillPatientShare || prefilled || !focusInvoiceId || !account) return;
    setPrefilled(true);
    const invoice = account.invoices.find(row => row.id === focusInvoiceId);
    const owedCents = invoice ? patientOwesNowCents(invoice, account.balances[invoice.id]) : 0;
    if (owedCents > 0) setAmountText(current => (current.trim() ? current : centsToInput(owedCents)));
  }, [prefillPatientShare, prefilled, focusInvoiceId, account]);

  const items: PayItem[] = useMemo(() => {
    if (isFund || !account) return [];
    const list: PayItem[] = [];
    for (const invoice of account.invoices) {
      const owed = owedPortions(invoice, account.balances[invoice.id]);
      (['patient', 'medical_aid'] as Portion[]).forEach(portion => {
        if (owed[portion] > 0) {
          list.push({
            key: openItemKey({ invoiceId: invoice.id, portion }),
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            dateKey: invoiceDateKey(invoice),
            portion,
            outstandingCents: owed[portion]
          });
        }
      });
    }
    return list;
  }, [isFund, account]);

  const portions = useMemo(() => payerPortions(payerType), [payerType]);
  const ordered = useMemo(() => {
    const sorted = sortOldestFirst(items, portions);
    return focusInvoiceId ? [...sorted.filter(item => item.invoiceId === focusInvoiceId), ...sorted.filter(item => item.invoiceId !== focusInvoiceId)] : sorted;
  }, [items, portions, focusInvoiceId]);

  const amountCents = parseAmountInput(amountText);
  const suggestion = useMemo(
    () => suggestWithFocus(amountCents ?? 0, ordered, portions, focusInvoiceId),
    [amountCents, ordered, portions, focusInvoiceId]
  );

  // Until staff change a line by hand, the lines follow the suggestion
  useEffect(() => {
    if (edited) return;
    setLineText(Object.fromEntries(suggestion.lines.map(line => [openItemKey(line), centsToInput(line.amountCents)])));
  }, [edited, suggestion]);

  const parsed = ordered.map(item => {
    const text = lineText[item.key] ?? '';
    const cents = text.trim() === '' ? 0 : parseAmountInput(text);
    return { item, cents };
  });
  const lines = parsed
    .filter((line): line is { item: PayItem; cents: number } => line.cents !== null && line.cents > 0)
    .map(line => ({ invoiceId: line.item.invoiceId, portion: line.item.portion, amountCents: line.cents, outstandingCents: line.item.outstandingCents }));
  const invalidLineKeys = new Set(parsed.filter(line => line.cents === null).map(line => line.item.key));
  const check = checkAllocation(amountCents, lines);

  // Rows paid by line: each line no more than it can take (the database checks the same); the row is their sum
  const lineChecks = new Map(ordered.filter(item => byLine[item.key]).map(item => {
    const texts = byLine[item.key];
    const invalid = Object.fromEntries(parseLineTexts(texts).filter(entry => entry.cents === null).map(entry => [entry.lineId, 'Enter an amount like 15.00']));
    const chosen = chosenOf(texts);
    const totalCents = chosen.reduce((sum, entry) => sum + entry.amountCents, 0);
    const errors: Record<string, string> = { ...checkLineSplit(totalCents, item.portion, invoiceLines?.[item.invoiceId] ?? [], chosen).lineErrors, ...invalid };
    return [item.key, { chosen, errors }] as const;
  }));
  const lineProblems = [...lineChecks.values()].some(entry => Object.keys(entry.errors).length > 0);

  /** What a payment on an invoice covers, as the receipt words it: the lines chosen, else the automatic split (the database's rule) */
  const coverWords = (line: { invoiceId: string; portion: Portion; amountCents: number; lines?: readonly LineAmount[] }): string[] => {
    const invoice = invoiceLines?.[line.invoiceId];
    if (!invoice || invoice.length === 0) return [];
    const split = line.lines ? { lines: [...line.lines], offLineCents: 0 } : suggestLineSplit(line.amountCents, line.portion, invoice);
    return splitCovers(split, invoice, line.portion).map(cover => `${coverLabel(cover)} ${nad(cover.amountCents)}`);
  };

  const setLineAmount = (item: PayItem, lineId: string, value: string) => {
    const texts = { ...(byLine[item.key] ?? {}), [lineId]: value };
    const sum = chosenOf(texts).reduce((total, entry) => total + entry.amountCents, 0);
    setEdited(true);
    setByLine(previous => ({ ...previous, [item.key]: texts }));
    setLineText(previous => ({ ...previous, [item.key]: sum > 0 ? centsToInput(sum) : '' }));
  };

  // Start from the automatic split of what the row pays now; staff change the lines from there
  const chooseLines = (item: PayItem, rowCents: number) => {
    const split = suggestLineSplit(rowCents, item.portion, invoiceLines?.[item.invoiceId] ?? []);
    setEdited(true);
    setByLine(previous => ({ ...previous, [item.key]: Object.fromEntries(split.lines.map(entry => [entry.lineId, centsToInput(entry.amountCents)])) }));
    // Money that fits on no line (interest, a correction) cannot be chosen line by line: the row pays the lines only
    if (split.offLineCents > 0) setLineText(previous => ({ ...previous, [item.key]: centsToInput(rowCents - split.offLineCents) }));
  };

  const splitAutomatically = (item: PayItem) =>
    setByLine(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== item.key)));

  const payerProblem = !patient
    ? 'Choose the patient whose account it is'
    : payerType === 'other' && !payerName.trim()
      ? 'Type who paid'
      : null;
  const dateProblem = !receivedOn ? 'Choose the date the money came in' : receivedOn > todayKey ? 'A receipt cannot be dated in the future' : null;
  const canSave = !saving && !notSetUp && !payerProblem && !dateProblem && check.ok && invalidLineKeys.size === 0 && !lineProblems;

  const setLine = (key: string, value: string) => {
    setEdited(true);
    setLineText(previous => ({ ...previous, [key]: value }));
  };

  const choosePayer = (value: PayerType) => {
    if (value === payerType) return;
    setPayerType(value);
    setEdited(false);
    setByLine({});
    setLoadError(null);
    if (method === 'medical_aid') setMethod('cash');
  };

  const save = async () => {
    if (!canSave || amountCents === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      // A row paid by line carries its lines; the others are split oldest line first by the database
      const allocations = lines.map(({ invoiceId, portion, amountCents: cents }) => {
        const chosen = lineChecks.get(openItemKey({ invoiceId, portion }))?.chosen ?? [];
        return { invoiceId, portion, amountCents: cents, ...(chosen.length > 0 ? { lines: chosen } : {}) };
      });
      const result = await postReceipt({
        practiceId,
        payerType,
        patientId: patient?.id ?? null,
        fundName: null,
        payerName: payerType === 'other' ? payerName : null,
        method,
        amountCents,
        receivedOn,
        reference,
        notes,
        source: 'manual',
        allocations
      });
      const invoiceNumbers = new Map(ordered.map(item => [item.invoiceId, item.invoiceNumber]));
      setSaved({
        receiptId: result.receipt_id,
        patientId: patient?.id ?? null,
        onlyInvoiceId: new Set(allocations.map(line => line.invoiceId)).size === 1 ? allocations[0].invoiceId : null,
        document: {
          practiceName,
          receiptNumber: result.receipt_number,
          receivedOn,
          payer: payerType === 'other' ? payerName.trim() : patient?.name ?? 'Patient',
          patientName: payerType === 'other' ? patient?.name ?? null : null,
          method,
          amountCents,
          reference: reference.trim() || null,
          lines: allocations.map(line => ({
            invoiceNumber: invoiceNumbers.get(line.invoiceId) ?? 'Invoice',
            portion: line.portion,
            amountCents: line.amountCents,
            covers: coverWords(line)
          })),
          unallocatedCents: amountCents - check.allocatedCents,
          receivedBy: staffName ?? null
        }
      });
      onSaved?.();
    } catch (error) {
      setSaveError(error instanceof Error ? plainWords(error.message) : 'The receipt could not be saved');
    } finally {
      setSaving(false);
    }
  };

  // A fund's payment is keyed line by line against its total
  if (isFund) {
    return (
      <FundPaymentSheet
        practiceId={practiceId}
        practiceName={practiceName}
        staffName={staffName}
        overFullScreen={overFullScreen}
        onPatientPayment={() => choosePayer('patient')}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  if (saved) {
    return (
      <Sheet
        open
        onClose={onClose}
        title={`Receipt ${saved.document.receiptNumber} saved`}
        subtitle={`${nad(saved.document.amountCents)} from ${saved.document.payer}`}
        icon="solar:check-circle-bold-duotone"
        tone="green"
        size="md"
        overFullScreen={overFullScreen}
        footer={<PrimaryButton icon="solar:close-circle-bold-duotone" onClick={onClose}>Done</PrimaryButton>}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-1">
            <SummaryRow label="Received" value={nad(saved.document.amountCents)} strong />
            <SummaryRow label="Paid on invoices" value={nad(saved.document.amountCents - saved.document.unallocatedCents)} />
            {saved.document.unallocatedCents > 0 && (
              <SummaryRow label="Kept as credit on the account" value={nad(saved.document.unallocatedCents)} tone="warning" />
            )}
          </div>
          {saved.document.unallocatedCents > 0 && (
            <p className="text-sm text-gray-600">
              The credit stays on receipt {saved.document.receiptNumber}. Allocate it later or refund it from Finance &gt; Payments.
            </p>
          )}
          <ReceiptShareActions
            practiceId={practiceId}
            receiptId={saved.receiptId}
            document={saved.document}
            patientId={saved.patientId}
            invoiceId={saved.onlyInvoiceId}
          />
        </div>
      </Sheet>
    );
  }

  const footer = (
    <>
      <div className="mr-auto text-sm">
        {amountCents !== null && (
          <span className={check.remainingCents < 0 ? 'font-medium text-red-700' : check.remainingCents > 0 ? 'text-amber-800' : 'text-green-700'}>
            {check.remainingCents < 0
              ? `${nad(-check.remainingCents)} too much allocated`
              : check.remainingCents > 0
                ? `${nad(check.remainingCents)} left: kept as credit`
                : 'All allocated'}
          </span>
        )}
      </div>
      <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
      <PrimaryButton icon="solar:diskette-bold-duotone" busy={saving} disabled={!canSave} onClick={() => void save()}>
        {saving ? 'Saving...' : `Save receipt${amountCents ? ` of ${nad(amountCents)}` : ''}`}
      </PrimaryButton>
    </>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title="Receive payment"
      subtitle="Record money received and allocate it to invoices"
      icon="solar:hand-money-bold-duotone"
      size="xl"
      overFullScreen={overFullScreen}
      footer={footer}
    >
      <div className="space-y-5">
        {notSetUp && <ErrorBox>{AR_NOT_SET_UP_MESSAGE}</ErrorBox>}
        {loadError && <ErrorBox>{loadError}</ErrorBox>}

        <Field label="Who paid">
          <ChoiceGroup value={payerType} onChange={choosePayer} options={PAYER_CHOICES} label="Who paid" disabled={saving} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
            {payerType === 'other' && (
              <Field label="Paid by" htmlFor="ar-payer-name" hint="For example an employer, a relative or an insurer">
                <input id="ar-payer-name" className={inputClass} value={payerName} onChange={event => setPayerName(event.target.value)} disabled={saving} />
              </Field>
            )}
            <Field label={payerType === 'other' ? "Patient's account" : 'Patient'} htmlFor="ar-patient">
              {patient ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-900">
                    <Icon icon="solar:user-bold-duotone" className="h-4 w-4 flex-shrink-0 text-cyan-600" aria-hidden="true" />
                    <span className="truncate">{patient.name}</span>
                  </span>
                  {!initialPatient && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatient(null);
                        setQuery('');
                        setEdited(false);
                      }}
                      className="text-xs font-medium text-cyan-700 hover:underline"
                      disabled={saving}
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    id="ar-patient"
                    className={inputClass}
                    placeholder="Name, ID number or cell number"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    autoComplete="off"
                    aria-autocomplete="list"
                  />
                  {(matches.length > 0 || searching) && (
                    <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg" role="listbox">
                      {searching && matches.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">Searching...</li>}
                      {matches.map(match => (
                        <li key={match.id} role="option" aria-selected={false}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-cyan-50"
                            onClick={() => {
                              setPatient({ id: match.id, name: match.name });
                              setMatches([]);
                              setEdited(false);
                            }}
                          >
                            <span className="block text-sm font-medium text-gray-900">{match.name}</span>
                            <span className="block text-xs text-gray-500">{[match.idNumber, match.cellNumber].filter(Boolean).join(' · ') || 'No ID or cell number'}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!searching && query.trim().length >= 2 && matches.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">No patient matches. Check the spelling or search by ID number.</p>
                  )}
                </div>
              )}
            </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Amount received" htmlFor="ar-amount" error={amountText.trim() && amountCents === null ? 'Enter an amount like 450.00' : null}>
            <AmountInput id="ar-amount" value={amountText} onChange={event => setAmountText(event.target.value)} placeholder="0.00" invalid={!!amountText.trim() && amountCents === null} disabled={saving} />
          </Field>
          <Field label="Date received" error={dateProblem && receivedOn ? dateProblem : null}>
            <DateInput value={receivedOn} onChange={setReceivedOn} maxDate={todayKey} disabled={saving} />
          </Field>
          <Field label="Reference" htmlFor="ar-reference" hint="Card slip or EFT reference (optional)">
            <input id="ar-reference" className={inputClass} value={reference} onChange={event => setReference(event.target.value)} disabled={saving} />
          </Field>
        </div>

        <Field label="How it was paid">
          <ChoiceGroup value={method} onChange={setMethod} options={METHOD_CHOICES} label="How it was paid" disabled={saving} />
        </Field>

        <section aria-labelledby="ar-open-items">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 id="ar-open-items" className="text-sm font-semibold text-gray-900">Open invoices, oldest first</h3>
              <p className="text-xs text-gray-500">
                {`The payment goes to the ${portions[0] === 'patient' ? 'patient' : 'medical aid'} portion first. Change any line if needed.`}
              </p>
            </div>
            <div className="flex gap-2">
              <SecondaryButton
                icon="solar:magic-stick-3-bold-duotone"
                onClick={() => {
                  setEdited(false);
                  setByLine({});
                }}
                disabled={saving || !edited}
                className="!px-3 !py-1.5"
              >
                Suggest again
              </SecondaryButton>
              <SecondaryButton
                icon="solar:eraser-bold-duotone"
                onClick={() => {
                  setEdited(true);
                  setLineText({});
                  setByLine({});
                }}
                disabled={saving || Object.keys(lineText).length === 0}
                className="!px-3 !py-1.5"
              >
                Clear
              </SecondaryButton>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2" role="status" aria-label="Loading open invoices">
              {[0, 1, 2].map(index => <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
            </div>
          ) : ordered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
              {patient ? 'Nothing is owed on this account. The whole payment will be kept as credit.' : 'Choose a patient to see what they owe.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {parsed.map(({ item, cents }) => {
                const error = invalidLineKeys.has(item.key) ? 'Enter an amount like 150.00' : check.lineErrors[item.key];
                const itemLines = invoiceLines?.[item.invoiceId] ?? [];
                const choosing = !!byLine[item.key];
                const rowCents = cents ?? 0;
                // What the payment covers when nobody chooses: the database's split, oldest line first
                const covers = !choosing && rowCents > 0 && itemLines.length > 0
                  ? coverCodes(splitCovers(suggestLineSplit(rowCents, item.portion, itemLines), itemLines, item.portion))
                  : '';
                return (
                  <li key={item.key} className="px-3 py-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem_10rem] sm:items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          <span className="font-mono text-cyan-700">{item.invoiceNumber}</span>
                          <span className="text-gray-500"> · {formatDay(item.dateKey)}</span>
                        </p>
                        <p className="truncate text-xs text-gray-500">{PORTION_LABELS[item.portion]} portion</p>
                      </div>
                      <p className="text-sm text-gray-600 sm:text-right">
                        <span className="sm:hidden">Owed </span>
                        <span className="tabular-nums font-medium text-gray-900">{nad(item.outstandingCents)}</span>
                      </p>
                      <div>
                        <label className="sr-only" htmlFor={`ar-line-${item.key}`}>Pay on {item.invoiceNumber}, {PORTION_LABELS[item.portion]} portion</label>
                        <AmountInput
                          id={`ar-line-${item.key}`}
                          value={lineText[item.key] ?? ''}
                          onChange={event => setLine(item.key, event.target.value)}
                          placeholder="0.00"
                          invalid={!!error}
                          disabled={saving}
                          // Paid by line: the row is the sum of its lines
                          readOnly={choosing}
                          aria-describedby={choosing ? `ar-line-${item.key}-sum` : undefined}
                        />
                        {choosing && <p id={`ar-line-${item.key}-sum`} className="mt-1 text-xs text-gray-500">The lines below add up to this</p>}
                        {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
                      </div>
                    </div>
                    {itemLines.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {covers && <span className="text-gray-500">Covers {covers}</span>}
                        <button
                          type="button"
                          onClick={() => (choosing ? splitAutomatically(item) : chooseLines(item, rowCents))}
                          aria-expanded={choosing}
                          disabled={saving}
                          className="rounded font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
                        >
                          {choosing ? 'Split automatically (oldest line first)' : 'Choose lines'}
                        </button>
                      </div>
                    )}
                    {choosing && (
                      <AllocationLinePicker
                        idPrefix={`ar-line-${item.key}`}
                        invoiceNumber={item.invoiceNumber}
                        portion={item.portion}
                        lines={itemLines}
                        values={byLine[item.key]}
                        errors={lineChecks.get(item.key)?.errors ?? {}}
                        disabled={saving}
                        onChange={(lineId, value) => setLineAmount(item, lineId, value)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1.5">
          <SummaryRow label="Received" value={amountCents !== null ? nad(amountCents) : '—'} />
          <SummaryRow label="Allocated to invoices" value={nad(check.allocatedCents)} />
          <SummaryRow
            label={check.remainingCents < 0 ? 'Allocated too much' : 'Left over (kept as credit)'}
            value={nad(Math.abs(check.remainingCents))}
            strong
            tone={check.remainingCents < 0 ? 'warning' : check.remainingCents > 0 ? 'warning' : 'good'}
          />
        </div>

        <Field label="Notes" htmlFor="ar-notes">
          <textarea id="ar-notes" rows={2} className={inputClass} value={notes} onChange={event => setNotes(event.target.value)} disabled={saving} />
        </Field>

        {check.error && amountCents !== null && <ErrorBox>{check.error}</ErrorBox>}
        {payerProblem && amountCents !== null && <p className="text-sm text-amber-800">{payerProblem}</p>}
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
      </div>
    </Sheet>
  );
};
