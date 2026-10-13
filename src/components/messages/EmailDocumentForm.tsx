import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { loadDocumentRecipients, type DocumentEmailResult } from '../../services/documentEmailService';
import {
  documentEmailMessage,
  documentEmailSubject,
  isEmailAddress,
  type DocumentEmailFacts,
  type DocumentRecipient
} from '../../utils/messages/documentEmail';
import { inputClass as financeInput } from '../finance/receipts/ArUi';

/** The classes of the screen the form sits in, so it looks like the rest of that screen */
export interface EmailFormLook {
  input: string;
  label: string;
  primary: string;
  secondary: string;
}

/** Finance's look (receipts, statements, invoices) */
const FINANCE_FORM_LOOK: EmailFormLook = {
  input: financeInput,
  label: 'mb-1 block text-sm font-medium text-gray-700',
  primary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
};

export interface EmailDraft {
  to: string;
  recipientName: string | null;
  subject: string;
  message: string;
}

interface EmailDocumentFormProps {
  practiceId: string;
  /** The patient the document belongs to: their address (or their account holder's) is offered first */
  patientId: string;
  /** What the default subject and message say */
  facts: DocumentEmailFacts;
  /** A document's own wording instead of the usual one (a quote's estimate and its lines) */
  defaultSubject?: string;
  defaultMessage?: (recipientName: string | null) => string;
  /** The PDF that goes with it ("invoice-INV-0042.pdf") */
  attachmentName: string;
  /** Makes the PDF and sends it (through the centralized email gateway) */
  send: (draft: EmailDraft) => Promise<DocumentEmailResult>;
  onSent: (to: string) => void;
  onCancel: () => void;
  look?: EmailFormLook;
}

const WHO: Readonly<Record<DocumentRecipient['who'], string>> = { account_holder: 'Account holder', patient: 'Patient' };

/**
 * Email a document: the recipient defaults to the account holder or the patient (one tap switches), the subject and
 * message can be changed, and the PDF is attached. Sent only when staff press Send.
 */
export const EmailDocumentForm: React.FC<EmailDocumentFormProps> = ({
  practiceId,
  patientId,
  facts,
  defaultSubject,
  defaultMessage,
  attachmentName,
  send,
  onSent,
  onCancel,
  look = FINANCE_FORM_LOOK
}) => {
  const id = useId();
  const messageFor = (name: string | null): string => (defaultMessage ? defaultMessage(name) : documentEmailMessage(facts, name));
  const [recipients, setRecipients] = useState<DocumentRecipient[] | null>(null);
  const [to, setTo] = useState('');
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [subject, setSubject] = useState(() => defaultSubject ?? documentEmailSubject(facts));
  const [message, setMessage] = useState(() => messageFor(null));
  // Once staff change the message, picking another address no longer rewrites it
  const messageEdited = useRef(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    loadDocumentRecipients(practiceId, patientId)
      .then(options => {
        if (!active) return;
        setRecipients(options);
        const first = options[0];
        if (first) {
          setTo(current => current || first.email);
          setRecipientName(first.name);
          if (!messageEdited.current) setMessage(messageFor(first.name));
        }
      })
      .catch(() => {
        if (active) setRecipients([]);
      });
    return () => {
      active = false;
    };
    // The addresses are read once when the form opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId, patientId]);

  const choose = (option: DocumentRecipient) => {
    setTo(option.email);
    setRecipientName(option.name);
    if (!messageEdited.current) setMessage(messageFor(option.name));
  };

  const valid = isEmailAddress(to) && subject.trim().length > 0 && message.trim().length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    try {
      const chosen = recipients?.find(option => option.email.toLowerCase() === to.trim().toLowerCase());
      const result = await send({ to: to.trim(), recipientName: chosen ? chosen.name : recipientName, subject, message });
      if (result.ok) {
        toast.success(result.message);
        onSent(to.trim());
      } else {
        toast.error(result.message, { duration: 8000 });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The email could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={event => void submit(event)} className="space-y-4" aria-busy={sending}>
      <div>
        <label htmlFor={`${id}-to`} className={look.label}>
          Send to
        </label>
        <input
          id={`${id}-to`}
          type="email"
          inputMode="email"
          autoComplete="off"
          className={look.input}
          value={to}
          placeholder="name@example.com"
          onChange={event => setTo(event.target.value)}
        />
        {recipients && recipients.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Addresses on file">
            {recipients.map(option => {
              const selected = option.email.toLowerCase() === to.trim().toLowerCase();
              return (
                <button
                  key={option.email}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(option)}
                  className={cn(
                    'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                    selected ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon icon={option.who === 'account_holder' ? 'solar:wallet-money-bold-duotone' : 'solar:user-bold-duotone'} className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {WHO[option.who]}: {option.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {recipients && recipients.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">No email address on the patient file or the account holder&apos;s. Type the address to use.</p>
        )}
        {recipients === null && <p className="mt-1 text-xs text-gray-500">Looking up the address on file...</p>}
      </div>

      <div>
        <label htmlFor={`${id}-subject`} className={look.label}>
          Subject
        </label>
        <input id={`${id}-subject`} className={look.input} maxLength={150} value={subject} onChange={event => setSubject(event.target.value)} />
      </div>

      <div>
        <label htmlFor={`${id}-message`} className={look.label}>
          Message
        </label>
        <textarea
          id={`${id}-message`}
          className={cn(look.input, 'min-h-[10rem]')}
          maxLength={5000}
          value={message}
          onChange={event => {
            setMessage(event.target.value);
            messageEdited.current = true;
          }}
        />
      </div>

      <p className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <Icon icon="solar:paperclip-bold-duotone" className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <span className="min-w-0 truncate">{attachmentName}</span>
        <span className="ml-auto shrink-0 text-xs text-gray-500">PDF</span>
      </p>
      <p className="text-xs text-gray-500">Sent from the practice&apos;s email and kept with the patient&apos;s messages.</p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={look.secondary} onClick={onCancel} disabled={sending}>
          Cancel
        </button>
        <button type="submit" className={look.primary} disabled={!valid || sending}>
          <Icon icon={sending ? 'solar:refresh-bold-duotone' : 'solar:letter-bold-duotone'} className={cn('h-4 w-4', sending && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
          {sending ? 'Sending...' : 'Send email'}
        </button>
      </div>
    </form>
  );
};

export default EmailDocumentForm;
