import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { toCents } from '../../utils/billing/money';
import { quoteEmailContent, quoteSmsText, type QuoteLineRecord, type QuoteRecord } from './quotes';
import { sendQuoteEmail, sendQuoteSms, type PatientContact } from './quoteService';
import { buildQuoteDocument, type PracticeLetterhead } from './quotePdf';
import { inputClass, labelClass, primaryButton, secondaryButton } from './QuoteBits';
import { EmailDocumentForm } from '../messages/EmailDocumentForm';

interface SendProps {
  quote: QuoteRecord;
  contact: PatientContact;
  onCancel: () => void;
  onSent: () => void;
}

const smsParts = (text: string): number => (text.length <= 160 ? 1 : Math.ceil(text.length / 153));

/** SMS through the centralized gateway (communicationService.sendSMS): staff can edit the text first. */
export const QuoteSmsPanel: React.FC<SendProps & { practiceName: string; practicePhone: string | null }> = ({
  quote,
  contact,
  practiceName,
  practicePhone,
  onCancel,
  onSent
}) => {
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [message, setMessage] = useState(() =>
    quoteSmsText({
      practiceName,
      practicePhone,
      patientFirstName: contact.firstName,
      quoteNumber: quote.quoteNumber,
      totalCents: toCents(quote.subtotal),
      patientCents: toCents(quote.patientEstimate),
      basis: quote.estimateBasis,
      validUntil: quote.validUntil
    })
  );
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!phone.trim() || !message.trim()) return;
    setSending(true);
    try {
      const result = await sendQuoteSms({ quote, phone, message });
      if (result.ok) {
        toast.success(result.message);
        onSent();
      } else {
        toast.error(result.message, { duration: 8000 });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the SMS.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-900">Send by SMS</p>
      <label className="block">
        <span className={labelClass}>Cell number</span>
        <input className={inputClass} inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} />
      </label>
      <label className="block">
        <span className={labelClass}>Message</span>
        <textarea className={`${inputClass} min-h-[96px]`} value={message} maxLength={612} onChange={event => setMessage(event.target.value)} />
        <span className="mt-1 block text-xs text-gray-500">
          {message.length} characters, {smsParts(message)} SMS. Sent through the practice SMS gateway and logged.
        </span>
      </label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={sending}>
          Cancel
        </button>
        <button type="button" className={primaryButton} onClick={() => void send()} disabled={sending || !phone.trim() || !message.trim()}>
          <Icon icon="solar:chat-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {sending ? 'Sending...' : 'Send SMS'}
        </button>
      </div>
    </div>
  );
};

/**
 * Email through the centralized gateway (communicationService.sendEmail), with the quote PDF attached: to the account
 * holder or the patient, with the quote's own wording as a message staff can change.
 */
export const QuoteEmailPanel: React.FC<SendProps & { lines: readonly QuoteLineRecord[]; letterhead: PracticeLetterhead }> = ({
  quote,
  lines,
  contact,
  letterhead,
  onCancel,
  onSent
}) => {
  const wording = (patientName: string) =>
    quoteEmailContent({
      practiceName: letterhead.name,
      practicePhone: letterhead.contactPhone,
      practiceEmail: letterhead.contactEmail,
      patientName,
      quote,
      lines
    });
  const printable = buildQuoteDocument(quote, lines, letterhead, { name: contact.name, phone: contact.phone, email: contact.email });

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-900">Send by email</p>
      <EmailDocumentForm
        practiceId={quote.practiceId}
        patientId={quote.patientId}
        facts={{ kind: 'quote', number: quote.quoteNumber, practiceName: letterhead.name, practicePhone: letterhead.contactPhone, amount: null, date: null }}
        defaultSubject={wording(contact.name).subject}
        defaultMessage={name => wording(name ?? contact.name).text}
        attachmentName={printable.fileName}
        look={{ input: inputClass, label: labelClass, primary: primaryButton, secondary: secondaryButton }}
        send={draft =>
          sendQuoteEmail({
            quote,
            lines,
            letterhead,
            patient: { name: contact.name, phone: contact.phone, email: contact.email },
            email: draft.to,
            checked: { subject: draft.subject, message: draft.message, recipientName: draft.recipientName }
          })
        }
        onCancel={onCancel}
        onSent={() => onSent()}
      />
    </div>
  );
};
