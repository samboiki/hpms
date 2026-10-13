import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../../modals/FormModal';
import { closeWaitingListEntry, loadWaitingList } from '../../../services/waitingListService';
import type { AppointmentType } from '../../../utils/diary/appointmentTypes';
import type { BookingPrefill } from '../../../utils/diary/bookingCopy';
import { formatBookingLength } from '../../../utils/diary/bookingLength';
import { parseDateKey, toDateKey } from '../../../utils/diary/diaryTime';
import {
  bookingPrefillFor,
  describeSlotWhen,
  freeMinutesFrom,
  isOpenEntry,
  smsOfferState,
  waitingNow,
  waitingPatientName,
  whoCouldTake,
  type DiaryBookingLike,
  type DiarySlot,
  type WaitingListEntry
} from '../../../utils/diary/waitingList';
import { windhoekClock } from '../../../utils/patientLists/listDates';
import { SECONDARY_CLASS } from './diarySettingsStyles';
import { WaitingListModal, type WaitingListState } from './WaitingListModal';
import { WaitingOfferDialog } from './WaitingOfferDialog';
import { FreeTimeRow, OfferBySmsAction, WaitingEntrySummary, WAITING_PRIMARY_BUTTON_CLASS } from './WaitingListParts';

/** Where the diary's booking form starts (PremiumAppointmentScheduler's BookingFormStart) */
export interface WaitingBookingStart {
  date: Date | null;
  time?: string;
  doctorId?: string;
  copy?: BookingPrefill;
}

interface UseDiaryWaitingListOptions {
  practiceId: string | null;
  practitioners: Array<{ id: string; name: string }>;
  /** "Dr A Nangolo" */
  practitionerLabel: (id: string | null) => string;
  appointmentTypes: AppointmentType[];
  /** The bookings the diary holds, to see how long a clicked free time lasts */
  bookings: DiaryBookingLike[];
  /** Opens the booking form */
  onBook: (start: WaitingBookingStart) => void;
}

export interface DiaryWaitingList {
  /** "Waiting list (3)" for the diary's More menu */
  menuLabel: string;
  open: () => void;
  /** A booking was cancelled: shows who on the list could take its time (nothing when nobody fits) */
  slotFreed: (slot: DiarySlot) => void;
  /** The strip above the booking form for a clicked free time, or null */
  stripFor: (start: WaitingBookingStart | null) => React.ReactNode;
  /** The booking form saved a booking (closes the waiting entry it was made for) */
  bookingSaved: (created: { id?: string } | null | undefined) => void;
  /** The booking form closed without saving */
  bookingClosed: () => void;
  /** One of the waiting list's windows is open (the diary's Esc handling leaves them alone) */
  isOpen: boolean;
  /** The windows: render once in the diary */
  element: React.ReactNode;
}

/**
 * The diary's waiting list (parity B21): the list, the prompt after a cancellation, the strip in the booking form for a
 * clicked free time, the SMS offer and the booking it leads to. Everything waits until the list loads: before the
 * database update the diary shows none of it.
 */
export function useDiaryWaitingList({
  practiceId,
  practitioners,
  practitionerLabel,
  appointmentTypes,
  bookings,
  onBook
}: UseDiaryWaitingListOptions): DiaryWaitingList {
  const [state, setState] = useState<WaitingListState>('loading');
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [freed, setFreed] = useState<{ slot: DiarySlot; entries: WaitingListEntry[] } | null>(null);
  const [offer, setOffer] = useState<{ entry: WaitingListEntry; slot: DiarySlot } | null>(null);
  // The entry the open booking form was started for: closed as booked once that booking is saved
  const bookingFor = useRef<string | null>(null);

  const reload = useCallback(async (): Promise<WaitingListEntry[]> => {
    if (!practiceId) return [];
    const load = await loadWaitingList(practiceId);
    if (load.state === 'ready') {
      setEntries(load.entries);
      setState('ready');
      return load.entries;
    }
    setState(load.state === 'not_set_up' ? 'not_set_up' : 'error');
    return [];
  }, [practiceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const today = windhoekClock(new Date()).dateKey;
  const openCount = useMemo(() => entries.filter((entry) => isOpenEntry(entry, today)).length, [entries, today]);
  const typeName = useCallback((id: string | null) => appointmentTypes.find((type) => type.id === id)?.name ?? null, [appointmentTypes]);

  const book = useCallback(
    (entry: WaitingListEntry, slot: DiarySlot | null) => {
      bookingFor.current = entry.id;
      setListOpen(false);
      setFreed(null);
      const type = appointmentTypes.find((item) => item.id === entry.appointmentTypeId) ?? null;
      onBook({
        date: slot ? parseDateKey(slot.date) : null,
        time: slot?.time,
        doctorId: slot?.practitionerId ?? entry.practitionerId ?? undefined,
        copy: bookingPrefillFor(entry, type)
      });
    },
    [appointmentTypes, onBook]
  );

  const slotFreed = useCallback(
    (slot: DiarySlot) => {
      if (state === 'not_set_up') return;
      void reload().then((fresh) => {
        const fits = whoCouldTake(fresh, slot, waitingNow());
        if (fits.length > 0) setFreed({ slot, entries: fits });
      });
    },
    [reload, state]
  );

  const bookingSaved = useCallback(
    (created: { id?: string } | null | undefined) => {
      const entryId = bookingFor.current;
      bookingFor.current = null;
      if (!entryId || !created?.id) return;
      const entry = entries.find((item) => item.id === entryId);
      void closeWaitingListEntry(entryId, 'booked', created.id).then((result) => {
        if (!result.ok) {
          toast.error(`Booked, but still on the waiting list: ${result.message}`);
          return;
        }
        toast.success(
          entry?.current
            ? `${waitingPatientName(entry)} is off the waiting list. Their later booking (${describeSlotWhen(entry.current.date, entry.current.time ?? '')}) is still in the diary: cancel it if they no longer need it.`
            : `${entry ? waitingPatientName(entry) : 'The patient'} is booked and off the waiting list.`,
          { duration: entry?.current ? 8000 : 4000 }
        );
        void reload();
      });
    },
    [entries, reload]
  );

  const stripFor = useCallback(
    (start: WaitingBookingStart | null): React.ReactNode => {
      if (!start || start.copy || !start.date || !start.time || !start.doctorId || state !== 'ready' || entries.length === 0) return null;
      const date = toDateKey(start.date);
      const slot: DiarySlot = {
        practitionerId: start.doctorId,
        date,
        time: start.time.slice(0, 5),
        lengthMinutes: freeMinutesFrom(bookings, start.doctorId, date, start.time)
      };
      const fits = whoCouldTake(entries, slot, waitingNow()).slice(0, 3);
      if (fits.length === 0) return null;
      return (
        <section className="mb-4 rounded-xl border border-purple-100 bg-purple-50/60 p-3" aria-labelledby="waiting-strip-title">
          <h3 id="waiting-strip-title" className="flex items-center gap-1.5 text-sm font-semibold text-purple-900">
            <Icon icon="solar:hourglass-bold-duotone" className="h-4 w-4 flex-none" aria-hidden="true" />
            On the waiting list for this time
          </h3>
          <ul className="mt-2 space-y-2">
            {fits.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start gap-2 rounded-lg bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <WaitingEntrySummary entry={entry} today={today} practitionerLabel={practitionerLabel} typeName={typeName(entry.appointmentTypeId)} />
                </div>
                <span className="flex flex-wrap gap-2">
                  <OfferBySmsAction state={smsOfferState(entry.patient)} onOffer={() => setOffer({ entry, slot })} />
                  <button type="button" onClick={() => book(entry, slot)} className={WAITING_PRIMARY_BUTTON_CLASS}>
                    <Icon icon="solar:calendar-add-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    Book {entry.patient.firstName || 'them'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      );
    },
    [state, entries, bookings, today, practitionerLabel, typeName, book]
  );

  const element = (
    <>
      <WaitingListModal
        isOpen={listOpen}
        onClose={() => setListOpen(false)}
        practiceId={practiceId}
        state={state}
        entries={entries}
        practitioners={practitioners}
        practitionerLabel={practitionerLabel}
        appointmentTypes={appointmentTypes}
        onChanged={() => void reload()}
        onOffer={(entry, slot) => setOffer({ entry, slot })}
        onBook={book}
      />

      {/* A booking was cancelled: who on the waiting list could take its time */}
      <FormModal isOpen={!!freed} onClose={() => setFreed(null)} title="A time came free" icon="solar:hourglass-bold-duotone" className="max-w-2xl">
        {freed && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-700">
              {describeSlotWhen(freed.slot.date, freed.slot.time)} with {practitionerLabel(freed.slot.practitionerId)} (
              {formatBookingLength(freed.slot.lengthMinutes)}) is free again. On the waiting list,{' '}
              {freed.entries.length === 1 ? 'this patient' : `these ${freed.entries.length} patients`} could take it, whoever waited longest
              first:
            </p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white" aria-label="Who could take the time">
              {freed.entries.map((entry) => (
                <li key={entry.id} className="space-y-2 px-3 py-3">
                  <WaitingEntrySummary entry={entry} today={today} practitionerLabel={practitionerLabel} typeName={typeName(entry.appointmentTypeId)} />
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50/60">
                    <FreeTimeRow
                      slot={freed.slot}
                      practitionerLabel={practitionerLabel}
                      smsOffer={smsOfferState(entry.patient)}
                      onOffer={() => setOffer({ entry, slot: freed.slot })}
                      onBook={() => book(entry, freed.slot)}
                    />
                  </ul>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button type="button" onClick={() => setFreed(null)} className={SECONDARY_CLASS}>
                Close
              </button>
            </div>
          </div>
        )}
      </FormModal>

      <WaitingOfferDialog
        practiceId={practiceId}
        offer={offer}
        practitionerLabel={practitionerLabel}
        onClose={() => setOffer(null)}
        onSent={() => {
          setOffer(null);
          setFreed(null);
          void reload();
        }}
      />
    </>
  );

  return {
    menuLabel: openCount > 0 ? `Waiting list (${openCount})` : 'Waiting list',
    open: () => {
      setListOpen(true);
      void reload();
    },
    slotFreed,
    stripFor,
    bookingSaved,
    bookingClosed: () => {
      bookingFor.current = null;
    },
    isOpen: listOpen || !!freed || !!offer,
    element
  };
}
