import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  PORTAL_REQUEST_LIMITS,
  requestableDateRange,
  validatePortalRequest,
  type PreferredTime,
} from '../../../supabase/functions/_shared/patientPortalRequests.ts';
import { formatDay, formatTime, PREFERRED_TIME_LABELS, type LinkedPatient, type PortalAppointment } from '../portalModel';
import { sendRequest } from '../portalService';
import { Card, Notice, PrimaryButton, SecondaryButton } from './PortalUi';

export type RequestFormKind = 'book' | 'reschedule' | 'profile_change';

const TITLES: Record<RequestFormKind, string> = {
  book: 'Ask for an appointment',
  reschedule: 'Ask for another time',
  profile_change: 'Ask for a change to your details',
};

/**
 * A request to the practice. Reception answers it (Communications > App requests); the patient sees the
 * answer under Visits or My details. The same rules run here and in the patient-portal edge function.
 */
const RequestForm: React.FC<{
  kind: RequestFormKind;
  patient: LinkedPatient;
  appointment?: PortalAppointment | null;
  pendingForPatient: number;
  onDone: () => void;
  onCancel: () => void;
}> = ({ kind, patient, appointment = null, pendingForPatient, onDone, onCancel }) => {
  const now = new Date();
  const range = requestableDateRange(now);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState<PreferredTime>('any');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const input = {
      kind,
      patientId: patient.patientId,
      visitId: appointment?.visit.id ?? null,
      preferredDate: kind === 'profile_change' ? null : preferredDate,
      preferredTime: kind === 'profile_change' ? null : preferredTime,
      message,
    };
    const check = validatePortalRequest(input, {
      now: new Date(),
      pendingForPatient,
      visit: appointment?.visit ?? null,
      patientPracticeId: patient.practiceId,
      pendingForVisit: 0,
    });
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setBusy(true);
    const result = await sendRequest(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Sent. The practice will let you know.');
    onDone();
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <h2 className="font-semibold text-gray-900">{TITLES[kind]}</h2>
          {patient.practiceName && <p className="text-sm text-gray-500">{patient.practiceName}</p>}
          {appointment && (
            <p className="text-sm text-gray-500">
              Now: {formatDay(appointment.date) ?? 'no date'}
              {appointment.time ? ` at ${formatTime(appointment.time)}` : ''}
            </p>
          )}
        </div>

        {kind !== 'profile_change' && (
          <>
            <div>
              <label htmlFor="request-date" className="block text-sm font-medium text-gray-700">
                Day you would like
              </label>
              <input
                id="request-date"
                type="date"
                min={range.first}
                max={range.last}
                value={preferredDate}
                onChange={(event) => setPreferredDate(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="mt-1 text-xs text-gray-500">From tomorrow. For today, please phone the practice.</p>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">Time of day</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['morning', 'afternoon', 'any'] as const).map((option) => (
                  <label
                    key={option}
                    className={`text-center rounded-xl border px-2 py-2.5 text-sm cursor-pointer ${
                      preferredTime === option ? 'border-cyan-500 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="preferred-time"
                      value={option}
                      checked={preferredTime === option}
                      onChange={() => setPreferredTime(option)}
                      className="sr-only"
                    />
                    {PREFERRED_TIME_LABELS[option]}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div>
          <label htmlFor="request-message" className="block text-sm font-medium text-gray-700">
            {kind === 'profile_change' ? 'What should the practice change?' : 'Reason for the visit (optional)'}
          </label>
          <textarea
            id="request-message"
            rows={3}
            maxLength={PORTAL_REQUEST_LIMITS.maxMessageLength}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder={kind === 'profile_change' ? 'For example: my new address is 12 Feld Street, Windhoek' : 'For example: check-up, cough for a week'}
          />
        </div>

        {error && (
          <Notice tone="error">
            <p>{error}</p>
          </Notice>
        )}

        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton onClick={onCancel}>Back</SecondaryButton>
          <PrimaryButton type="submit" busy={busy} icon="solar:plain-bold-duotone">
            Send
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
};

export default RequestForm;
