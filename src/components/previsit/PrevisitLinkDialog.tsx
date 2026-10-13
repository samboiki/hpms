import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../modals/FormModal';
import { getSmsLength } from '../messages/messageText';
import { formatPhoneForDisplay } from '../patients/patientContact';
import { createPrevisitLink, sendPrevisitLinkSms } from '../../services/previsitService';
import { previsitLink } from '../../utils/clinical/previsitQuestions';

interface PrevisitLinkDialogProps {
  /** null when closed */
  request: {
    practiceId: string;
    patientId: string;
    patientName: string;
    visitId: string;
    /** The patient's number in international format, or null when there is none */
    phone: string | null;
    /** The SMS around the booking's link */
    messageFor: (link: string) => string;
  } | null;
  onClose: () => void;
  onSent: () => void;
}

const PRIMARY_CLASS =
  'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:from-purple-600 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2';
const SECONDARY_CLASS =
  'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

// A stand-in of the code's length, so the preview counts the characters the real SMS has
const CODE_STAND_IN = 'xxxxxxxxxxxxxxxxxxxxxx';

/**
 * Sends the booking's questions link by SMS (parity B17), through the practice's SMS gateway: the number and the text
 * first, nothing sent until Send SMS. The link is made at that moment (an earlier link of the booking then stops
 * working), so looking at the message and going back never ends a link already sent.
 */
export const PrevisitLinkDialog: React.FC<PrevisitLinkDialogProps> = ({ request, onClose, onSent }) => {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = request ? request.messageFor(previsitLink(window.location.origin, CODE_STAND_IN)) : '';

  const send = async () => {
    if (!request?.phone || sending) return;
    setSending(true);
    setError(null);
    const created = await createPrevisitLink(request.visitId);
    if (!created.ok) {
      setSending(false);
      setError(created.message);
      return;
    }
    const result = await sendPrevisitLinkSms({
      practiceId: request.practiceId,
      patientId: request.patientId,
      visitId: request.visitId,
      phone: request.phone,
      message: request.messageFor(previsitLink(window.location.origin, created.code))
    });
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success(`Questions sent to ${request.patientName}`);
    onSent();
  };

  return (
    <FormModal
      isOpen={!!request}
      onClose={() => {
        if (sending) return;
        setError(null);
        onClose();
      }}
      title="Send the questions by SMS"
      icon="solar:clipboard-list-bold-duotone"
      className="max-w-lg"
    >
      {request && (
        <div className="flex flex-col gap-4">
          <dl className="text-sm">
            <dt className="font-semibold text-gray-700">To</dt>
            <dd className="mt-0.5 text-gray-900">
              {request.phone ? <span className="font-mono">{formatPhoneForDisplay(request.phone)}</span> : 'No cell number that can receive an SMS'}
              <span className="ml-2 text-gray-500">({request.patientName})</span>
            </dd>
          </dl>
          <figure className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
            <figcaption className="text-xs font-medium text-purple-900">The SMS (the link's code is made when you send it)</figcaption>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">{preview}</p>
            <p className="mt-1 text-xs text-purple-800/80">
              {preview.length} characters, {getSmsLength(preview).parts} SMS. The link opens without signing in, shows only the practice's
              questions and works once, until the end of the booking's day.
            </p>
          </figure>
          <p className="text-sm text-gray-600">Nothing is sent until you press Send SMS.</p>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} disabled={sending} className={SECONDARY_CLASS}>
              Back
            </button>
            <button type="button" onClick={() => void send()} disabled={sending || !request.phone} className={PRIMARY_CLASS}>
              <Icon
                icon={sending ? 'solar:refresh-bold-duotone' : 'solar:plain-bold-duotone'}
                className={`h-5 w-5 ${sending ? 'animate-spin motion-reduce:animate-none' : ''}`}
                aria-hidden="true"
              />
              {sending ? 'Sending...' : error ? 'Try again' : 'Send SMS'}
            </button>
          </div>
        </div>
      )}
    </FormModal>
  );
};

export default PrevisitLinkDialog;
