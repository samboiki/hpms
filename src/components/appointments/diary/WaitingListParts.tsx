import React from 'react';
import { Icon } from '@iconify/react';
import { formatDiaryDate, formatDiaryTimestamp } from '../../../utils/diary/diaryTime';
import { formatBookingLength } from '../../../utils/diary/bookingLength';
import {
  describeOffer,
  describePreferences,
  describeSlotWhen,
  isLapsedEntry,
  waitingPatientName,
  type DiarySlot,
  type SmsOfferState,
  type WaitingListEntry
} from '../../../utils/diary/waitingList';

/** The small buttons beside an entry or a free time (the diary windows' secondary style, smaller) */
export const WAITING_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';
export const WAITING_PRIMARY_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

interface WaitingEntrySummaryProps {
  entry: WaitingListEntry;
  today: string;
  practitionerLabel: (id: string | null) => string;
  /** The practice's appointment type's name, when the entry has one */
  typeName?: string | null;
}

/** Who is waiting, for whom, when they can come and where their offer stands, in plain words */
export const WaitingEntrySummary: React.FC<WaitingEntrySummaryProps> = ({ entry, today, practitionerLabel, typeName }) => {
  const offer = describeOffer(entry.offer);
  const lapsed = isLapsedEntry(entry, today);
  const since = entry.createdAt ? formatDiaryDate(entry.createdAt.slice(0, 10)) : null;
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="break-words font-medium text-gray-900">{waitingPatientName(entry)}</span>
        {since && <span className="text-xs text-gray-500">waiting since {since}</span>}
      </p>
      <p className="mt-0.5 break-words text-xs text-gray-600">
        {entry.practitionerId ? practitionerLabel(entry.practitionerId) : 'Any practitioner'}
        {' · '}
        {typeName ? `${typeName}, ` : ''}
        {formatBookingLength(entry.lengthMinutes)}
        {' · '}
        {describePreferences(entry)}
      </p>
      {entry.current && (
        <p className="mt-0.5 text-xs text-gray-600">
          Booked for {describeSlotWhen(entry.current.date, entry.current.time ?? '')}: wants it earlier
        </p>
      )}
      {entry.note && <p className="mt-0.5 break-words text-xs text-gray-500">{entry.note}</p>}
      {offer && (
        <p className="mt-1 inline-flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900 ring-1 ring-amber-200">
          <Icon icon="solar:chat-round-dots-bold-duotone" className="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span className="min-w-0">
            {offer}
            {entry.offer?.at ? ` (sent ${formatDiaryTimestamp(entry.offer.at)})` : ''}. Their reply comes in under Messages, SMS replies.
          </span>
        </p>
      )}
      {lapsed && (
        <p className="mt-1 text-xs text-amber-800">Waited until {formatDiaryDate(entry.until)}: take them off the list or change the day.</p>
      )}
    </div>
  );
};

interface OfferBySmsActionProps {
  /** smsOfferState(entry.patient) */
  state: SmsOfferState;
  onOffer: () => void;
}

/**
 * "Offer by SMS", or "Asked for no SMS" in its place for a patient who replied STOP: reception phones them instead and
 * can note the call in the entry's note.
 */
export const OfferBySmsAction: React.FC<OfferBySmsActionProps> = ({ state, onOffer }) => {
  if (state === 'asked_for_no_sms') {
    return (
      <span
        className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-500"
        title="The patient replied STOP to SMS: phone them, and note the call in their waiting list entry"
      >
        Asked for no SMS
      </span>
    );
  }
  const canOffer = state === 'can_offer';
  return (
    <span title={canOffer ? undefined : 'No cell number on file that can receive an SMS'}>
      <button type="button" onClick={onOffer} disabled={!canOffer} className={WAITING_BUTTON_CLASS}>
        <Icon icon="solar:chat-round-dots-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
        Offer by SMS
      </button>
    </span>
  );
};

interface FreeTimeRowProps {
  slot: DiarySlot;
  practitionerLabel: (id: string | null) => string;
  /** smsOfferState(entry.patient): offering by SMS is not possible without a number, nor for a patient who replied STOP */
  smsOffer: SmsOfferState;
  onOffer: () => void;
  onBook: () => void;
}

/** One free time that suits a waiting patient, with "Offer by SMS" and "Book" */
export const FreeTimeRow: React.FC<FreeTimeRowProps> = ({ slot, practitionerLabel, smsOffer, onOffer, onBook }) => (
  <li className="flex flex-wrap items-center gap-2 px-3 py-2">
    <span className="min-w-0 flex-1 text-sm text-gray-800">
      {describeSlotWhen(slot.date, slot.time)} with {practitionerLabel(slot.practitionerId)}
    </span>
    <OfferBySmsAction state={smsOffer} onOffer={onOffer} />
    <button type="button" onClick={onBook} className={WAITING_PRIMARY_BUTTON_CLASS}>
      <Icon icon="solar:calendar-add-bold-duotone" className="h-4 w-4" aria-hidden="true" />
      Book
    </button>
  </li>
);
