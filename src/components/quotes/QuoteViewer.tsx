import React, { useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import FormModal from '../modals/FormModal';
import { invoiceLink, patientOverviewLink } from '../billing/invoiceLinks';
import { toDateKey, todayKey } from '../../utils/billing/dates';
import { formatNad } from '../../utils/billing/money';
import {
  QUOTE_STATUS_LABELS,
  canSendQuote,
  effectiveQuoteStatus,
  formatDayFirst,
  quoteActions,
  type QuoteRecord,
  type QuoteStatus
} from './quotes';
import {
  deleteQuote,
  downloadQuotePdf,
  isQuotesNotEnabledError,
  loadInvoiceNumber,
  loadLetterhead,
  loadPatientContact,
  loadQuote,
  markQuoteSent,
  setQuoteStatus,
  updateQuoteFundDetails,
  type PatientContact,
  type QuoteWithLines
} from './quoteService';
import type { PracticeLetterhead } from './quotePdf';
import QuoteConvert from './QuoteConvert';
import { QuoteEmailPanel, QuoteSmsPanel } from './QuoteSend';
import { MessageList, QuoteStatusChip, QuotesNotEnabled, inputClass, labelClass, primaryButton, secondaryButton } from './QuoteBits';
import TeethChartLink from '../dental/TeethChartLink';
import AuthorisationSheet from '../patients/registers/AuthorisationSheet';
import { loadPatientFundKey } from '../../services/fundPricingService';
import { draftFromQuote, type AuthorisationDraft } from '../../utils/billing/authorisations';

interface QuoteViewerProps {
  quoteId: string | null;
  onClose: () => void;
  onEdit: (quote: QuoteRecord) => void;
  /** Something changed (status, sent, invoiced, deleted): lists reload */
  onChanged: () => void;
}

type Loaded = QuoteWithLines & { contact: PatientContact; invoiceNumber: string | null };
type LoadState = { status: 'loading' } | { status: 'not_enabled' } | { status: 'error'; message: string } | ({ status: 'ready' } & Loaded);
type Panel = 'sms' | 'email' | 'convert' | 'fund' | null;

// Timestamps are shown as the local calendar day (Windhoek), day first
const formatTimestamp = (value: string | null): string => (value ? formatDayFirst(toDateKey(new Date(value))) : '-');

/** One quote: lines, estimate, print and send, status changes and conversion to an invoice. */
const QuoteViewer: React.FC<QuoteViewerProps> = ({ quoteId, onClose, onEdit, onChanged }) => {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [letterhead, setLetterhead] = useState<PracticeLetterhead | null>(null);
  const [busy, setBusy] = useState(false);
  const [preauth, setPreauth] = useState('');
  const [fundReference, setFundReference] = useState('');
  // The quote's pre-authorisation number on its way into the patient's authorisations (parity D15, F18)
  const [toRegister, setToRegister] = useState<{ draft: AuthorisationDraft; fund: string | null } | null>(null);

  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    setLoad(current => (current.status === 'ready' && current.quote.id === quoteId ? current : { status: 'loading' }));
    loadQuote(quoteId)
      .then(async loaded => {
        const [contact, invoiceNumber] = await Promise.all([
          loadPatientContact(loaded.quote.patientId),
          loaded.quote.convertedInvoiceId ? loadInvoiceNumber(loaded.quote.convertedInvoiceId) : Promise.resolve(null)
        ]);
        if (cancelled) return;
        setLoad({ status: 'ready', ...loaded, contact, invoiceNumber });
        setPreauth(loaded.quote.preauthNumber ?? '');
        setFundReference(loaded.quote.fundReference ?? '');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad(
          isQuotesNotEnabledError(error)
            ? { status: 'not_enabled' }
            : { status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not open the quote.' }
        );
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId, version]);

  useEffect(() => {
    setPanel(null);
  }, [quoteId]);

  const refresh = () => {
    setPanel(null);
    setVersion(value => value + 1);
    onChanged();
  };

  const ready = load.status === 'ready' ? load : null;
  const quote = ready?.quote ?? null;
  const effective: QuoteStatus | null = quote ? effectiveQuoteStatus(quote.status, quote.validUntil, todayKey()) : null;
  const actions = quote && effective ? quoteActions(quote.status, effective) : [];
  const sendable = quote && effective ? canSendQuote(quote.status, effective) : false;

  const withLetterhead = async (): Promise<PracticeLetterhead> => {
    if (letterhead) return letterhead;
    if (!quote) throw new Error('The quote is not loaded.');
    const loaded = await loadLetterhead(quote.practiceId);
    setLetterhead(loaded);
    return loaded;
  };

  const run = async (work: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(success);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'That did not work. Try again.', { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: QuoteStatus, question: string | null) => {
    if (!quote) return;
    if (question && !window.confirm(question)) return;
    void run(() => setQuoteStatus(quote.id, status), `Quote ${quote.quoteNumber} is now ${QUOTE_STATUS_LABELS[status].toLowerCase()}.`);
  };

  const print = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const head = await withLetterhead();
      downloadQuotePdf(ready.quote, ready.lines, head, { name: ready.contact.name, phone: ready.contact.phone, email: ready.contact.email });
      toast.success(ready.quote.status === 'draft' ? 'Quote PDF downloaded. Mark it as sent when you give it to the patient.' : 'Quote PDF downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not create the PDF.');
    } finally {
      setBusy(false);
    }
  };

  const openSms = async () => {
    try {
      await withLetterhead();
      setPanel('sms');
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not read the practice details.');
    }
  };

  // The email's message names the practice and its phone number, so the letterhead is read first (as for the SMS)
  const openEmail = async () => {
    try {
      await withLetterhead();
      setPanel('email');
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not read the practice details.');
    }
  };

  return (
    <FormModal isOpen={Boolean(quoteId)} onClose={onClose} title={quote ? `Quote ${quote.quoteNumber}` : 'Quote'} icon="solar:bill-list-bold-duotone" className="max-w-3xl">
      {load.status === 'loading' && (
        <div className="space-y-3" role="status" aria-live="polite">
          {[0, 1, 2].map(row => (
            <div key={row} className="h-14 animate-pulse rounded-xl bg-gray-100" />
          ))}
          <span className="sr-only">Loading the quote</span>
        </div>
      )}
      {load.status === 'not_enabled' && <QuotesNotEnabled />}
      {load.status === 'error' && (
        <div className="space-y-3 py-6 text-center" role="alert">
          <p className="text-sm text-red-700">{load.message}</p>
          <button type="button" className={secondaryButton} onClick={() => setVersion(value => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {ready && quote && effective && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{quote.quoteNumber}</h3>
                <QuoteStatusChip status={effective} />
              </div>
              {/* The patient's file, from the quote (the quote closes as the file opens) */}
              <p className="text-sm text-gray-700">
                <Link to={patientOverviewLink(quote.patientId)} onClick={onClose} title="The patient's file" className="font-medium text-cyan-700 hover:underline">
                  {ready.contact.name}
                </Link>
              </p>
              <p className="text-xs text-gray-500">
                {quote.medicalAidName
                  ? `${quote.medicalAidName}${quote.medicalAidScheme ? ` - ${quote.medicalAidScheme}` : ''}${quote.membershipNumber ? ` (member no ${quote.membershipNumber})` : ''}`
                  : 'Private: no medical aid on file'}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-gray-500">Dated {formatDayFirst(quote.quoteDate)}</p>
              <p className={effective === 'expired' ? 'font-medium text-amber-700' : 'text-gray-500'}>Valid until {formatDayFirst(quote.validUntil)}</p>
            </div>
          </div>

          {effective === 'expired' && (
            <MessageList
              tone="warning"
              messages={['This quote has expired. Edit it to extend its validity (and update its prices) before the patient accepts it or you send it again.']}
            />
          )}
          {quote.status === 'converted' && (
            <MessageList
              tone="info"
              messages={[`Invoiced ${formatTimestamp(quote.convertedAt)}${ready.invoiceNumber ? ` as invoice ${ready.invoiceNumber}` : ''}. The quote can no longer change.`]}
            />
          )}
          {quote.status === 'converted' && quote.convertedInvoiceId && (
            <Link to={invoiceLink(quote.convertedInvoiceId)} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:underline">
              <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Open invoice{ready.invoiceNumber ? ` ${ready.invoiceNumber}` : ''}
            </Link>
          )}
          {/* Dental practices: back to the tooth chart the quote's plan came from */}
          <TeethChartLink patientId={quote.patientId} practiceId={quote.practiceId} onNavigate={onClose} />

          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} onClick={() => void print()} disabled={busy}>
              <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Print / PDF
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => void openSms()}
              disabled={busy || !sendable}
              title={sendable ? 'Send by SMS' : 'An expired, declined or invoiced quote cannot be sent'}
            >
              <Icon icon="solar:chat-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              SMS
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => void openEmail()}
              disabled={busy || !sendable}
              title={sendable ? 'Send by email' : 'An expired, declined or invoiced quote cannot be sent'}
            >
              <Icon icon="solar:letter-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Email
            </button>
            {actions.includes('edit') && (
              <button type="button" className={secondaryButton} onClick={() => onEdit(quote)} disabled={busy}>
                <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                {effective === 'expired' ? 'Edit or extend' : 'Edit'}
              </button>
            )}
            {actions.includes('mark_sent') && (
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => void run(() => markQuoteSent(quote, 'print'), `Quote ${quote.quoteNumber} marked as sent.`)}>
                <Icon icon="solar:plain-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Mark as sent
              </button>
            )}
            {actions.includes('accept') && (
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => changeStatus('accepted', `Did the patient accept quote ${quote.quoteNumber}?`)}>
                <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 text-green-600" aria-hidden="true" />
                Accepted
              </button>
            )}
            {actions.includes('decline') && (
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => changeStatus('declined', `Mark quote ${quote.quoteNumber} as declined by the patient?`)}>
                <Icon icon="solar:close-circle-bold-duotone" className="h-4 w-4 text-red-500" aria-hidden="true" />
                Declined
              </button>
            )}
            {actions.includes('reopen') && (
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => changeStatus('draft', null)}>
                <Icon icon="solar:undo-left-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Reopen as draft
              </button>
            )}
            {actions.includes('convert') && (
              <button type="button" className={primaryButton} disabled={busy} onClick={() => setPanel('convert')}>
                <Icon icon="solar:bill-check-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Convert to invoice
              </button>
            )}
            {actions.includes('delete') && (
              <button
                type="button"
                className={secondaryButton}
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Delete draft quote ${quote.quoteNumber}? This cannot be undone.`)) return;
                  setBusy(true);
                  deleteQuote(quote.id)
                    .then(() => {
                      toast.success(`Draft quote ${quote.quoteNumber} deleted.`);
                      onChanged();
                      onClose();
                    })
                    .catch((error: unknown) => toast.error(error instanceof Error ? plainWords(error.message) : 'Could not delete the quote.'))
                    .finally(() => setBusy(false));
                }}
              >
                <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4 text-red-500" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>

          {panel === 'sms' && letterhead && (
            <QuoteSmsPanel
              quote={quote}
              contact={ready.contact}
              practiceName={letterhead.name}
              practicePhone={letterhead.contactPhone}
              onCancel={() => setPanel(null)}
              onSent={refresh}
            />
          )}
          {panel === 'email' && letterhead && (
            <QuoteEmailPanel quote={quote} lines={ready.lines} contact={ready.contact} letterhead={letterhead} onCancel={() => setPanel(null)} onSent={refresh} />
          )}
          {panel === 'convert' && <QuoteConvert quote={quote} lines={ready.lines} onCancel={() => setPanel(null)} onConverted={refresh} />}

          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {ready.lines.map(line => (
              <li key={line.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 p-3 text-sm">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-gray-900">
                    <span className="font-semibold">{line.code}</span> {line.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    {line.quantity} x {formatNad(line.unitPrice)}
                    {line.toothNumbers.length > 0 ? ` · tooth ${line.toothNumbers.join(', ')}` : ''}
                    {line.notes ? ` · ${line.notes}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatNad(line.totalPrice)}</p>
                  <p className="text-[11px] text-gray-500">
                    Medical aid {formatNad(line.medicalAidEstimate)} · patient {formatNad(line.patientEstimate)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-gray-200 p-3">
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-gray-500">Total</dt>
                <dd className="font-semibold text-gray-900">{formatNad(quote.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-gray-500">Medical aid (estimated)</dt>
                <dd className="font-semibold text-gray-900">{formatNad(quote.medicalAidEstimate)}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-gray-500">Patient portion (estimated)</dt>
                <dd className="font-semibold text-cyan-700">{formatNad(quote.patientEstimate)}</dd>
              </div>
            </dl>
            {quote.estimateNote && <p className="mt-2 text-xs text-gray-600">{quote.estimateNote}</p>}
          </div>

          <div className="rounded-xl border border-gray-200 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-gray-900">Medical aid pre-authorisation</p>
              {quote.status !== 'converted' && panel !== 'fund' && (
                <button type="button" className={secondaryButton} onClick={() => setPanel('fund')}>
                  <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Update
                </button>
              )}
            </div>
            {panel === 'fund' ? (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Pre-authorisation number</span>
                  <input className={inputClass} maxLength={40} value={preauth} onChange={event => setPreauth(event.target.value)} />
                </label>
                <label className="block">
                  <span className={labelClass}>Fund reference</span>
                  <input className={inputClass} maxLength={60} value={fundReference} onChange={event => setFundReference(event.target.value)} />
                </label>
                <div className="flex gap-2 sm:col-span-2 sm:justify-end">
                  <button type="button" className={secondaryButton} onClick={() => setPanel(null)} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={primaryButton}
                    disabled={busy}
                    onClick={() => void run(() => updateQuoteFundDetails(quote.id, preauth, fundReference), 'Pre-authorisation details saved.')}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 text-gray-700">
                  Number: {quote.preauthNumber ?? 'not yet'} · Fund reference: {quote.fundReference ?? '-'}
                </p>
                {quote.preauthNumber && ready && (
                  <button
                    type="button"
                    className={`mt-2 ${secondaryButton}`}
                    disabled={busy}
                    onClick={() =>
                      void loadPatientFundKey({ patientId: quote.patientId }).then(fund => {
                        const reference = fund.fund?.reference ?? null;
                        const made = draftFromQuote(
                          { id: quote.id, preauthNumber: quote.preauthNumber, quoteDate: quote.quoteDate, validUntil: quote.validUntil, codes: ready.lines.map(line => line.code) },
                          reference
                        );
                        if (made.ok) setToRegister({ draft: made.draft, fund: reference });
                        else toast.error(made.message, { duration: 8000 });
                      })
                    }
                  >
                    <Icon icon="solar:shield-check-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    Add to the patient&apos;s authorisations
                  </button>
                )}
              </>
            )}
          </div>

          {quote.notes && (
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
              <p className="text-xs font-medium text-gray-500">Notes for the patient</p>
              <p className="whitespace-pre-line">{quote.notes}</p>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Created {formatTimestamp(quote.createdAt)}
            {quote.sentAt ? ` · sent ${formatTimestamp(quote.sentAt)}${quote.sentVia ? ` by ${quote.sentVia}` : ''}` : ''}
            {quote.acceptedAt ? ` · accepted ${formatTimestamp(quote.acceptedAt)}` : ''}
            {quote.declinedAt ? ` · declined ${formatTimestamp(quote.declinedAt)}` : ''}
            {quote.convertedAt ? ` · invoiced ${formatTimestamp(quote.convertedAt)}` : ''}
          </p>
        </div>
      )}
      {toRegister && quote && (
        <AuthorisationSheet
          patientId={quote.patientId}
          authorisation={null}
          startFrom={toRegister.draft}
          patientFund={toRegister.fund}
          onClose={() => setToRegister(null)}
          onSaved={result => {
            setToRegister(null);
            toast.success(
              result.applied > 0
                ? `Added to the patient's authorisations. ${result.applied} ${result.applied === 1 ? 'line' : 'lines'} already billed now ${result.applied === 1 ? 'carries' : 'carry'} the number.`
                : "Added to the patient's authorisations: lines billed in its window carry the number."
            );
          }}
        />
      )}
    </FormModal>
  );
};

export default QuoteViewer;
