import React, { useEffect, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { toast } from 'react-hot-toast';
import { communicationService } from '../../../services/communicationService';
import { loadPatientContact } from './arService';
import { printDocument, receiptHtml, receiptSmsText, type ReceiptDocument } from './receiptDocuments';
import { SecondaryButton } from './ArUi';
import { ReceiptEmailSheet } from '../../messages/DocumentEmailSheets';

interface ReceiptShareActionsProps {
  practiceId: string;
  receiptId: string;
  document: ReceiptDocument;
  /** The patient whose contact details are used for SMS and email (none for a fund's lump sum) */
  patientId: string | null;
  /** The only invoice paid, for the email log */
  invoiceId?: string | null;
}

/**
 * Print a receipt, or send it to the patient by SMS or email through the practice's
 * communication gateways (communicationService: logged, counted against the practice's bundle).
 * Nothing is sent until staff press a button; the SMS text is shown first.
 */
export const ReceiptShareActions: React.FC<ReceiptShareActionsProps> = ({ practiceId, receiptId, document, patientId, invoiceId }) => {
  const [contact, setContact] = useState<{ cellNumber: string | null; email: string | null; name: string } | null>(null);
  const [sending, setSending] = useState<'sms' | null>(null);
  const [sent, setSent] = useState<{ sms?: boolean; email?: boolean }>({});
  // The receipt goes as a PDF attachment, checked in the email sheet (to the account holder or the patient)
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContact(null);
    if (!patientId) return;
    loadPatientContact(practiceId, patientId)
      .then(result => { if (!cancelled) setContact(result); })
      .catch(error => console.warn('Receipt: patient contact unavailable', error));
    return () => { cancelled = true; };
  }, [practiceId, patientId]);

  const smsText = receiptSmsText(document);

  const print = () => {
    if (!printDocument(receiptHtml(document))) toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
  };

  const sendSms = async () => {
    if (!contact?.cellNumber || !patientId) return;
    setSending('sms');
    try {
      const result = await communicationService.sendSMS({
        practiceId,
        recipientPhone: contact.cellNumber,
        messageContent: smsText,
        messageType: 'system',
        patientId,
        metadata: { kind: 'payment_receipt', receiptId, receiptNumber: document.receiptNumber }
      });
      if (!result.success) throw new Error(result.error || 'The SMS was not sent');
      setSent(previous => ({ ...previous, sms: true }));
      toast.success(`Receipt sent by SMS to ${contact.cellNumber}`);
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The SMS was not sent');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SecondaryButton icon="solar:printer-minimalistic-bold-duotone" onClick={print}>Print receipt</SecondaryButton>
        {patientId && (
          <>
            <SecondaryButton
              icon={sent.sms ? 'solar:check-circle-bold-duotone' : 'solar:chat-round-dots-bold-duotone'}
              onClick={() => void sendSms()}
              disabled={!contact?.cellNumber || sending !== null || sent.sms}
              title={contact?.cellNumber ? `Send to ${contact.cellNumber}` : 'No cell number on the patient file'}
            >
              {sending === 'sms' ? 'Sending...' : sent.sms ? 'SMS sent' : 'Send by SMS'}
            </SecondaryButton>
            <SecondaryButton
              icon={sent.email ? 'solar:check-circle-bold-duotone' : 'solar:letter-bold-duotone'}
              onClick={() => setEmailing(true)}
              disabled={sending !== null || sent.email}
              title={contact?.email ? `Send to ${contact.email}` : 'Type the address in the email window'}
            >
              {sent.email ? 'Email sent' : 'Send by email'}
            </SecondaryButton>
          </>
        )}
      </div>
      {patientId && emailing && (
        <ReceiptEmailSheet
          open
          onClose={() => setEmailing(false)}
          practiceId={practiceId}
          patientId={patientId}
          receiptId={receiptId}
          document={document}
          invoiceId={invoiceId ?? null}
          onSent={() => setSent(previous => ({ ...previous, email: true }))}
        />
      )}
      {patientId && contact && !contact.cellNumber && !contact.email && (
        <p className="text-xs text-gray-500">The patient file has no cell number or email address: print the receipt, or type an address under Send by email.</p>
      )}
      {patientId && contact?.cellNumber && (
        <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          <span className="font-medium text-gray-700">SMS text: </span>{smsText}
        </p>
      )}
    </div>
  );
};
