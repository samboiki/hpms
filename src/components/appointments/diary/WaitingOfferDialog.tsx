import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../../modals/FormModal';
import { getSmsLength } from '../../messages/messageText';
import { formatPhoneForDisplay, normalizePhoneNumber } from '../../patients/patientContact';
import { useSmsRepliesLive } from '../../../hooks/useSmsRepliesLive';
import { loadOfferPractice, sendWaitingListOffer } from '../../../services/waitingListService';
import { describeSlotWhen, offerMessage, waitingPatientName, type DiarySlot, type WaitingListEntry } from '../../../utils/diary/waitingList';
import { PRIMARY_CLASS, SECONDARY_CLASS } from './diarySettingsStyles';

interface WaitingOfferDialogProps {
  practiceId: string | null;
  /** The patient and the time offered; null when closed */
  offer: { entry: WaitingListEntry; slot: DiarySlot } | null;
  practitionerLabel: (id: string | null) => string;
  onClose: () => void;
  /** After the SMS went out (and the offer was noted on the list) */
  onSent: () => void;
}

/**
 * Offers a freed time to a waiting patient by SMS (parity B21), through the practice's SMS gateway. The number and the
 * message are shown first; nothing is sent until reception presses Send SMS. The patient's answer arrives in the SMS
 * replies inbox: a YES is never a booking by itself, reception books it.
 */
export const WaitingOfferDialog: React.FC<WaitingOfferDialogProps> = ({ practiceId, offer, practitionerLabel, onClose, onSent }) => {
  const repliesLive = useSmsRepliesLive(practiceId);
  const [practice, setPractice] = useState<{ name: string | null; phone: string | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!offer || !practiceId || practice) return;
    let cancelled = false;
    void loadOfferPractice(practiceId).then((loaded) => {
      if (!cancelled) setPractice(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [offer, practiceId, practice]);

  const message = useMemo(
    () =>
      offer && practice && repliesLive !== null
        ? offerMessage({
            practiceName: practice.name,
            practicePhone: practice.phone,
            patientFirstName: offer.entry.patient.firstName,
            practitionerName: practitionerLabel(offer.slot.practitionerId),
            date: offer.slot.date,
            time: offer.slot.time,
            repliesLive
          })
        : '',
    [offer, practice, repliesLive, practitionerLabel]
  );

  const phone = offer ? normalizePhoneNumber(offer.entry.patient.cellNumber) : null;
  const length = getSmsLength(message);

  const send = async () => {
    if (!offer || !practiceId || !message || sending) return;
    setSending(true);
    setError(null);
    const result = await sendWaitingListOffer({ practiceId, entry: offer.entry, slot: offer.slot, message });
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.recorded) toast.success(`Offer sent to ${waitingPatientName(offer.entry)}`);
    else toast.error(result.message ?? 'The SMS was sent, but the offer could not be noted on the list.');
    onSent();
  };

  return (
    <FormModal isOpen={!!offer} onClose={() => !sending && onClose()} title="Offer the time by SMS" icon="solar:chat-round-dots-bold-duotone" className="max-w-lg">
      {offer && (
        <div className="flex flex-col gap-4">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-gray-700">To</dt>
              <dd className="mt-0.5 text-gray-900">
                {phone ? <span className="font-mono">{formatPhoneForDisplay(phone)}</span> : 'No cell number that can receive an SMS'}
                <span className="ml-2 text-gray-500">({waitingPatientName(offer.entry)})</span>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-700">The time</dt>
              <dd className="mt-0.5 text-gray-900">
                {describeSlotWhen(offer.slot.date, offer.slot.time)} with {practitionerLabel(offer.slot.practitionerId)}
              </dd>
            </div>
          </dl>
          <figure className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
            <figcaption className="text-xs font-medium text-purple-900">The SMS</figcaption>
            {message ? (
              <p className="mt-1 whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">{message}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-500" role="status">Preparing the message...</p>
            )}
            {message && (
              <p className="mt-1 text-xs text-purple-800/80">
                {message.length} characters, {length.parts} SMS.{' '}
                {repliesLive
                  ? 'A YES or NO arrives in Messages, under SMS replies. Book the time here, from the waiting list.'
                  : "Your practice's SMS replies are not collected, so the SMS asks the patient to call."}
              </p>
            )}
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
            <button type="button" onClick={() => void send()} disabled={sending || !phone || !message} className={PRIMARY_CLASS}>
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

export default WaitingOfferDialog;
