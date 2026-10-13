import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import type { LetterDocument } from '../../utils/clinical/letters';
import { emailLetter, isEmailAddress } from '../../services/patientLettersService';
import { INPUT, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../patientLists/listStyles';
import { openLetterPdf } from './letterPdf';

interface LetterActionsProps {
  /** Builds (or returns) the letter; a sick note is built only when it is printed or sent */
  getDocument: () => Promise<LetterDocument>;
  practiceId: string;
  patientId: string;
  visitId: string | null;
  letterId?: string | null;
  /** Who the letter is emailed to unless reception types another address */
  defaultEmail?: string | null;
  recipientName?: string | null;
  onEmailed?: () => void;
  /** Smaller buttons in lists */
  compact?: boolean;
}

/** Print (opens the PDF to print or save) and Email (sent as a PDF through the practice's email). */
export const LetterActions: React.FC<LetterActionsProps> = ({
  getDocument,
  practiceId,
  patientId,
  visitId,
  letterId = null,
  defaultEmail = null,
  recipientName = null,
  onEmailed,
  compact = false
}) => {
  const [busy, setBusy] = useState<'print' | 'email' | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? '');
  const emailId = useId();
  const buttonClass = compact ? QUIET_BUTTON : SECONDARY_BUTTON;

  const print = async () => {
    setBusy('print');
    try {
      openLetterPdf(await getDocument());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open the letter.');
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!isEmailAddress(email)) {
      toast.error('Enter a complete email address.');
      return;
    }
    setBusy('email');
    try {
      const document = await getDocument();
      const result = await emailLetter({ practiceId, patientId, visitId, document, to: email, recipientName, letterId });
      if (result.ok) {
        toast.success(result.message);
        setEmailing(false);
        onEmailed?.();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the letter.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void print()}>
          <Icon icon="solar:printer-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {busy === 'print' ? 'Opening...' : 'Print'}
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={busy !== null}
          aria-expanded={emailing}
          aria-controls={`${emailId}-panel`}
          onClick={() => {
            setEmail(current => current || defaultEmail || '');
            setEmailing(value => !value);
          }}
        >
          <Icon icon="solar:letter-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Email
        </button>
      </div>
      {emailing && (
        <div id={`${emailId}-panel`} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={emailId} className="mb-1 block text-xs font-medium text-gray-600">
              Send to
            </label>
            <input
              id={emailId}
              type="email"
              className={INPUT}
              value={email}
              placeholder="name@example.com"
              autoComplete="off"
              onChange={event => setEmail(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => setEmailing(false)}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null || !email.trim()} onClick={() => void send()}>
              {busy === 'email' ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LetterActions;
