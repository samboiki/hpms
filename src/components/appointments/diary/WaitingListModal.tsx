import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../../modals/FormModal';
import { searchPatients, type PatientMatch } from '../../finance/receipts/arService';
import {
  closeWaitingListEntry,
  findFreeTimesFor,
  loadUpcomingBookings,
  saveWaitingListEntry,
  WAITING_LIST_NOT_SET_UP_MESSAGE,
  type PatientBooking
} from '../../../services/waitingListService';
import { bookableAppointmentTypes, type AppointmentType } from '../../../utils/diary/appointmentTypes';
import { TYPE_LENGTH_OPTIONS, formatBookingLength } from '../../../utils/diary/bookingLength';
import { addDaysToKey } from '../../../utils/diary/diaryTime';
import {
  WAITING_DAYS,
  WAITING_NOTE_MAX,
  describeSlotWhen,
  sortWaitingList,
  smsOfferState,
  validateWaitingListDraft,
  waitingNow,
  waitingPatientName,
  type DiarySlot,
  type WaitingListEntry
} from '../../../utils/diary/waitingList';
import { windhoekClock } from '../../../utils/patientLists/listDates';
import { SettingsErrors } from './DiarySettingsParts';
import { FIELD_CLASS, ICON_BUTTON_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_CLASS, SECONDARY_CLASS } from './diarySettingsStyles';
import { FreeTimeRow, WaitingEntrySummary, WAITING_BUTTON_CLASS } from './WaitingListParts';

export type WaitingListState = 'loading' | 'ready' | 'not_set_up' | 'error';

interface WaitingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string | null;
  state: WaitingListState;
  entries: WaitingListEntry[];
  practitioners: Array<{ id: string; name: string }>;
  practitionerLabel: (id: string | null) => string;
  appointmentTypes: AppointmentType[];
  /** After an entry was added, changed or taken off */
  onChanged: () => void;
  onOffer: (entry: WaitingListEntry, slot: DiarySlot) => void;
  /** Opens the booking form for the patient (at this time, or for reception to choose one) */
  onBook: (entry: WaitingListEntry, slot: DiarySlot | null) => void;
}

interface EntryDraft {
  /** null: a new entry */
  id: string | null;
  patient: { id: string; name: string } | null;
  practitionerId: string;
  appointmentTypeId: string;
  lengthMinutes: number;
  days: number[];
  from: string;
  to: string;
  until: string;
  currentVisitId: string;
  note: string;
}

const newDraft = (today: string): EntryDraft => ({
  id: null,
  patient: null,
  practitionerId: '',
  appointmentTypeId: '',
  lengthMinutes: 15,
  days: [],
  from: '',
  to: '',
  // Four weeks: long enough for a cancellation to come up, short enough that the list stays current
  until: addDaysToKey(today, 28),
  currentVisitId: '',
  note: ''
});

const draftFromEntry = (entry: WaitingListEntry): EntryDraft => ({
  id: entry.id,
  patient: { id: entry.patient.id, name: waitingPatientName(entry) },
  practitionerId: entry.practitionerId ?? '',
  appointmentTypeId: entry.appointmentTypeId ?? '',
  lengthMinutes: entry.lengthMinutes,
  days: entry.days,
  from: entry.from ?? '',
  to: entry.to ?? '',
  until: entry.until,
  currentVisitId: entry.current?.visitId ?? '',
  note: entry.note ?? ''
});

/**
 * Diary > More > Waiting list (parity B21): patients who want an earlier time, whoever waited longest first. "Find a
 * time" looks up the free times that suit an entry; each can be offered by SMS or booked. Any staff member keeps the
 * list (the database checks the same rules: src/utils/diary/waitingList.ts).
 */
export const WaitingListModal: React.FC<WaitingListModalProps> = ({ isOpen, onClose, ...rest }) => (
  <FormModal isOpen={isOpen} onClose={onClose} title="Waiting list" icon="solar:hourglass-bold-duotone" className="max-w-2xl">
    <WaitingListContent {...rest} />
  </FormModal>
);

const WaitingListContent: React.FC<Omit<WaitingListModalProps, 'isOpen' | 'onClose'>> = ({
  practiceId,
  state,
  entries,
  practitioners,
  practitionerLabel,
  appointmentTypes,
  onChanged,
  onOffer,
  onBook
}) => {
  const clock = windhoekClock(new Date());
  const today = clock.dateKey;
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Free times found per entry ("Find a time"), and which entry is being looked up
  const [freeTimes, setFreeTimes] = useState<Record<string, DiarySlot[] | string>>({});
  const [finding, setFinding] = useState<string | null>(null);
  const shown = useMemo(() => sortWaitingList(entries, today), [entries, today]);
  const typeName = (id: string | null) => appointmentTypes.find((type) => type.id === id)?.name ?? null;

  if (!practiceId) return <p className="text-sm text-red-600">Your practice couldn't be identified. Reload the page and try again.</p>;
  if (state === 'loading' && entries.length === 0) return <p className="text-sm text-gray-500" role="status">Loading the waiting list...</p>;
  if (state === 'not_set_up') {
    return (
      <div className="rounded-xl bg-gray-50 px-4 py-6 text-center">
        <Icon icon="solar:hourglass-bold-duotone" className="mx-auto mb-2 h-8 w-8 text-indigo-400" aria-hidden="true" />
        <p className="mx-auto max-w-sm text-sm text-gray-600">{WAITING_LIST_NOT_SET_UP_MESSAGE}</p>
      </div>
    );
  }

  const findTimes = async (entry: WaitingListEntry) => {
    setFinding(entry.id);
    const found = await findFreeTimesFor(practiceId, entry, waitingNow());
    setFinding(null);
    setFreeTimes((current) => ({ ...current, [entry.id]: found.state === 'ready' ? found.slots : found.message }));
  };

  const takeOff = async (entry: WaitingListEntry) => {
    if (!window.confirm(`Take ${waitingPatientName(entry)} off the waiting list?`)) return;
    setSaving(true);
    const result = await closeWaitingListEntry(entry.id, 'removed');
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    setErrors([]);
    toast.success(`${waitingPatientName(entry)} taken off the waiting list`);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-600">
        Patients who want an earlier time. When a booking is cancelled, or you click a free time, the diary shows who on this
        list could take it.
      </p>
      {state === 'error' && <p className="text-sm text-red-600" role="alert">Could not load the waiting list. Close it and try again.</p>}
      <SettingsErrors errors={draft ? [] : errors} />

      {shown.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">Nobody is waiting for an earlier time.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white" aria-label="Patients waiting">
          {shown.map((entry) => {
            const found = freeTimes[entry.id];
            const smsOffer = smsOfferState(entry.patient);
            return (
              <li key={entry.id} className="space-y-2 px-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <WaitingEntrySummary entry={entry} today={today} practitionerLabel={practitionerLabel} typeName={typeName(entry.appointmentTypeId)} />
                  </div>
                  <span className="flex flex-none gap-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setErrors([]);
                        setDraft(draftFromEntry(entry));
                      }}
                      aria-label={`Change ${waitingPatientName(entry)}'s entry`}
                      title="Change"
                      className={ICON_BUTTON_CLASS}
                    >
                      <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void takeOff(entry)}
                      aria-label={`Take ${waitingPatientName(entry)} off the list`}
                      title="Take off the list"
                      className={ICON_BUTTON_CLASS}
                    >
                      <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void findTimes(entry)} disabled={finding === entry.id} className={WAITING_BUTTON_CLASS}>
                    <Icon
                      icon={finding === entry.id ? 'solar:refresh-bold-duotone' : 'solar:calendar-search-bold-duotone'}
                      className={`h-4 w-4 text-purple-500 ${finding === entry.id ? 'animate-spin motion-reduce:animate-none' : ''}`}
                      aria-hidden="true"
                    />
                    {finding === entry.id ? 'Looking...' : 'Find a time'}
                  </button>
                  <button type="button" onClick={() => onBook(entry, null)} className={WAITING_BUTTON_CLASS}>
                    <Icon icon="solar:calendar-add-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
                    Book a time
                  </button>
                </div>
                {typeof found === 'string' && <p className="text-xs text-red-600" role="alert">{found}</p>}
                {Array.isArray(found) &&
                  (found.length === 0 ? (
                    <p className="text-xs text-gray-500" role="status">
                      No free time suits {entry.patient.firstName || 'them'} before {describeSlotWhen(entry.until, '')}.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50/60" aria-label={`Free times for ${waitingPatientName(entry)}`}>
                      {found.map((slot) => (
                        <FreeTimeRow
                          key={`${slot.practitionerId}-${slot.date}-${slot.time}`}
                          slot={slot}
                          practitionerLabel={practitionerLabel}
                          smsOffer={smsOffer}
                          onOffer={() => onOffer(entry, slot)}
                          onBook={() => onBook(entry, slot)}
                        />
                      ))}
                    </ul>
                  ))}
              </li>
            );
          })}
        </ul>
      )}

      {draft ? (
        <EntryForm
          practiceId={practiceId}
          draft={draft}
          setDraft={setDraft}
          errors={errors}
          setErrors={setErrors}
          saving={saving}
          practitioners={practitioners}
          appointmentTypes={appointmentTypes}
          today={today}
          onSave={async (value) => {
            setSaving(true);
            const result = await saveWaitingListEntry(draft.id, value);
            setSaving(false);
            if (!result.ok) {
              setErrors([result.message]);
              return;
            }
            setErrors([]);
            toast.success(draft.id ? 'Waiting list entry saved' : `${draft.patient?.name ?? 'The patient'} added to the waiting list`);
            setDraft(null);
            onChanged();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setErrors([]);
            setDraft(newDraft(today));
          }}
          className={`${SECONDARY_CLASS} self-start`}
        >
          <Icon icon="solar:user-plus-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          Add a patient
        </button>
      )}
    </div>
  );
};

interface EntryFormProps {
  practiceId: string;
  draft: EntryDraft;
  setDraft: (draft: EntryDraft | null) => void;
  errors: string[];
  setErrors: (errors: string[]) => void;
  saving: boolean;
  practitioners: Array<{ id: string; name: string }>;
  appointmentTypes: AppointmentType[];
  today: string;
  onSave: (value: Parameters<typeof saveWaitingListEntry>[1]) => Promise<void>;
}

/** Add a patient to the list, or change their entry */
const EntryForm: React.FC<EntryFormProps> = ({ practiceId, draft, setDraft, errors, setErrors, saving, practitioners, appointmentTypes, today, onSave }) => {
  const [term, setTerm] = useState('');
  const [matches, setMatches] = useState<PatientMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [bookings, setBookings] = useState<PatientBooking[]>([]);
  const types = bookableAppointmentTypes(appointmentTypes);
  const lengthOptions: number[] = [...TYPE_LENGTH_OPTIONS];
  if (!lengthOptions.includes(draft.lengthMinutes)) lengthOptions.push(draft.lengthMinutes);
  const change = (patch: Partial<EntryDraft>) => setDraft({ ...draft, ...patch });

  // Patients matching what is typed (the shared patient search), a moment after typing stops
  useEffect(() => {
    if (draft.patient || term.trim().length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchPatients(practiceId, term)
        .then((found) => {
          if (!cancelled) setMatches(found);
        })
        .catch((error) => console.error('Patient search failed:', error))
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, practiceId, draft.patient]);

  // The patient's own bookings, one of which they may want earlier
  const patientId = draft.patient?.id ?? null;
  useEffect(() => {
    setBookings([]);
    if (!patientId) return;
    let cancelled = false;
    void loadUpcomingBookings(patientId, today).then((loaded) => {
      if (!cancelled) setBookings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, today]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateWaitingListDraft(
      {
        patientId: draft.patient?.id ?? null,
        practitionerId: draft.practitionerId || null,
        appointmentTypeId: draft.appointmentTypeId || null,
        lengthMinutes: draft.lengthMinutes,
        days: draft.days,
        from: draft.from,
        to: draft.to,
        until: draft.until,
        currentVisitId: draft.currentVisitId || null,
        note: draft.note
      },
      today
    );
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    await onSave(checked.value);
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4 rounded-xl border border-purple-200 bg-purple-50/40 p-4">
      <h4 className="text-sm font-semibold text-gray-900">{draft.id ? 'Change the entry' : 'Add a patient to the waiting list'}</h4>
      <div>
        <label htmlFor="waiting-patient" className={LABEL_CLASS}>Patient</label>
        {draft.patient ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words text-sm font-medium text-gray-900">{draft.patient.name}</span>
            {!draft.id && (
              <button type="button" onClick={() => change({ patient: null, currentVisitId: '' })} className={WAITING_BUTTON_CLASS}>
                Choose another patient
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              id="waiting-patient"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Name, ID number or cell number"
              autoComplete="off"
              className={INPUT_CLASS}
              aria-describedby="waiting-patient-results"
              autoFocus
            />
            <div id="waiting-patient-results" aria-live="polite">
              {searching && <p className="mt-1 text-xs text-gray-500">Searching...</p>}
              {matches.length > 0 && (
                <ul className="mt-1 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                  {matches.map((match) => (
                    <li key={match.id}>
                      <button
                        type="button"
                        onClick={() => {
                          change({ patient: { id: match.id, name: match.name } });
                          setTerm('');
                        }}
                        className="flex w-full flex-wrap items-baseline gap-x-2 px-3 py-2 text-left text-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                      >
                        <span className="font-medium text-gray-900">{match.name}</span>
                        <span className="text-xs text-gray-500">{match.cellNumber ?? 'no cell number'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="waiting-practitioner" className={LABEL_CLASS}>With</label>
          <select id="waiting-practitioner" value={draft.practitionerId} onChange={(event) => change({ practitionerId: event.target.value })} className={INPUT_CLASS}>
            <option value="">Any practitioner</option>
            {practitioners.map((practitioner) => (
              <option key={practitioner.id} value={practitioner.id}>
                {practitioner.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="waiting-type" className={LABEL_CLASS}>For</label>
          <select
            id="waiting-type"
            value={draft.appointmentTypeId}
            onChange={(event) => {
              const type = types.find((item) => item.id === event.target.value);
              change({ appointmentTypeId: event.target.value, ...(type ? { lengthMinutes: type.lengthMinutes } : {}) });
            }}
            className={INPUT_CLASS}
          >
            <option value="">Any appointment</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="waiting-length" className={LABEL_CLASS}>How long</label>
          <select id="waiting-length" value={draft.lengthMinutes} onChange={(event) => change({ lengthMinutes: Number(event.target.value) })} className={INPUT_CLASS}>
            {lengthOptions.sort((a, b) => a - b).map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatBookingLength(minutes)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="waiting-until" className={LABEL_CLASS}>Waits until</label>
          <input
            id="waiting-until"
            type="date"
            min={today}
            max={addDaysToKey(today, 365)}
            value={draft.until}
            onChange={(event) => change({ until: event.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <fieldset>
        <legend className={LABEL_CLASS}>Days that suit</legend>
        <div className="flex flex-wrap gap-1.5">
          {WAITING_DAYS.map((day) => {
            const on = draft.days.includes(day.day);
            return (
              <button
                key={day.day}
                type="button"
                aria-pressed={on}
                aria-label={day.label}
                onClick={() => change({ days: on ? draft.days.filter((value) => value !== day.day) : [...draft.days, day.day] })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  on ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {day.short}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-gray-500">{draft.days.length === 0 ? 'None chosen: any day.' : 'Only the days chosen.'}</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="waiting-from" className={LABEL_CLASS}>Not before</label>
          <input id="waiting-from" type="time" step={300} value={draft.from} onChange={(event) => change({ from: event.target.value })} className={`w-full ${FIELD_CLASS}`} />
        </div>
        <div>
          <label htmlFor="waiting-to" className={LABEL_CLASS}>Finished by</label>
          <input id="waiting-to" type="time" step={300} value={draft.to} onChange={(event) => change({ to: event.target.value })} className={`w-full ${FIELD_CLASS}`} />
        </div>
      </div>

      {draft.patient && (
        <div>
          <label htmlFor="waiting-current" className={LABEL_CLASS}>Their booking to move earlier</label>
          <select id="waiting-current" value={draft.currentVisitId} onChange={(event) => change({ currentVisitId: event.target.value })} className={INPUT_CLASS}>
            <option value="">None: they have no booking yet</option>
            {bookings.map((booking) => (
              <option key={booking.visitId} value={booking.visitId}>
                {describeSlotWhen(booking.date, booking.time ?? '')}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="waiting-note" className={LABEL_CLASS}>Note</label>
        <input
          id="waiting-note"
          value={draft.note}
          maxLength={WAITING_NOTE_MAX}
          onChange={(event) => change({ note: event.target.value })}
          placeholder="For example: can come at short notice"
          className={INPUT_CLASS}
        />
      </div>

      <SettingsErrors errors={errors} />
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setErrors([]);
          }}
          className={SECONDARY_CLASS}
        >
          Cancel
        </button>
        <button type="submit" disabled={saving} className={PRIMARY_CLASS}>
          <Icon
            icon={saving ? 'solar:refresh-bold-duotone' : 'solar:hourglass-bold-duotone'}
            className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          />
          {saving ? 'Saving...' : draft.id ? 'Save' : 'Add to the list'}
        </button>
      </div>
    </form>
  );
};

export default WaitingListModal;
