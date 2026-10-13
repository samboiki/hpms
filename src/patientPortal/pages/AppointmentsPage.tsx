import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { checkVisitChange } from '../../../supabase/functions/_shared/patientPortalRequests.ts';
import { toTelHref } from '../../components/patients/patientContact';
import { usePortal, usePortalLoad } from '../portalContext';
import {
  appointmentStatus,
  formatDay,
  formatTime,
  PREFERRED_TIME_LABELS,
  REQUEST_KIND_LABELS,
  REQUEST_STATUS_LABELS,
  splitAppointments,
  visitTypeLabel,
  type PortalAppointment,
  type PortalRequest,
} from '../portalModel';
import { cancelAppointment, loadAppointments, loadRequests, withdrawRequest, type PortalLoad } from '../portalService';
import {
  Card,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  NotEnabledBlock,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusPill,
} from '../components/PortalUi';
import RequestForm from '../components/RequestForm';

const PAST_SHOWN = 10;

const AppointmentCard: React.FC<{
  appointment: PortalAppointment;
  patientId: string;
  practiceId: string | null;
  upcoming: boolean;
  onReschedule?: () => void;
  onChanged: () => void;
}> = ({ appointment, patientId, practiceId, upcoming, onReschedule, onChanged }) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const status = appointmentStatus(appointment, now);
  const change = upcoming ? checkVisitChange(appointment.visit, { patientId, practiceId }, now) : null;
  const phoneHref = toTelHref(appointment.practicePhone);

  const cancel = async () => {
    setBusy(true);
    const result = await cancelAppointment(patientId, appointment.visit.id);
    setBusy(false);
    setConfirming(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Your appointment is cancelled. The practice can see it.');
    onChanged();
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">
            {formatDay(appointment.date) ?? 'Date to be confirmed'}
            {appointment.time ? `, ${formatTime(appointment.time)}` : ''}
          </p>
          <p className="text-sm text-gray-600">
            {visitTypeLabel(appointment.visitType)}
            {appointment.doctorName ? ` with ${appointment.doctorName}` : ''}
          </p>
          {appointment.practiceName && <p className="text-sm text-gray-500">{appointment.practiceName}</p>}
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>

      {upcoming && change && !change.ok && (
        <p className="text-sm text-gray-600">
          {change.message}
          {phoneHref && (
            <>
              {' '}
              <a href={phoneHref} className="font-medium text-cyan-700 underline">
                Call the practice
              </a>
            </>
          )}
        </p>
      )}

      {upcoming && change?.ok && !confirming && (
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton icon="solar:calendar-mark-bold-duotone" onClick={onReschedule}>
            Another time
          </SecondaryButton>
          <SecondaryButton icon="solar:close-circle-bold-duotone" onClick={() => setConfirming(true)}>
            Cancel
          </SecondaryButton>
        </div>
      )}

      {confirming && (
        <div className="rounded-xl bg-rose-50 p-3 space-y-3">
          <p className="text-sm text-rose-900">Cancel this appointment? The time goes back to the practice for someone else.</p>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </SecondaryButton>
            <PrimaryButton onClick={() => void cancel()} busy={busy} danger>
              Yes, cancel
            </PrimaryButton>
          </div>
        </div>
      )}
    </Card>
  );
};

const RequestCard: React.FC<{ request: PortalRequest; onChanged: () => void }> = ({ request, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const status = REQUEST_STATUS_LABELS[request.status];
  const withdraw = async () => {
    setBusy(true);
    const result = await withdrawRequest(request.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Request withdrawn.');
    onChanged();
  };
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{REQUEST_KIND_LABELS[request.kind]}</p>
          <p className="text-xs text-gray-500">Sent {formatDay(request.createdAt)}</p>
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>
      {request.preferredDate && (
        <p className="text-sm text-gray-600">
          Asked for {formatDay(request.preferredDate)}
          {request.preferredTime ? `, ${(PREFERRED_TIME_LABELS[request.preferredTime] ?? request.preferredTime).toLowerCase()}` : ''}
        </p>
      )}
      {request.message && <p className="text-sm text-gray-600 break-words">"{request.message}"</p>}
      {request.staffNote && (
        <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-2 break-words">
          <span className="font-medium">The practice: </span>
          {request.staffNote}
        </p>
      )}
      {request.status === 'pending' && (
        <SecondaryButton onClick={() => void withdraw()} busy={busy} className="w-full">
          Withdraw request
        </SecondaryButton>
      )}
    </Card>
  );
};

type FormState = { kind: 'book' } | { kind: 'reschedule'; appointment: PortalAppointment } | null;

/** Upcoming and past appointments of the chosen person, booking requests, cancelling. */
const AppointmentsPage: React.FC = () => {
  const { selected, patients } = usePortal();
  const [searchParams, setSearchParams] = useSearchParams();
  // Home's "Book an appointment" opens the form directly (/me/appointments?book=1)
  const [form, setFormState] = useState<FormState>(() => (searchParams.get('book') === '1' ? { kind: 'book' } : null));
  const setForm = (next: FormState) => {
    setFormState(next);
    if (!next && searchParams.has('book')) setSearchParams({}, { replace: true });
  };
  const [showAllPast, setShowAllPast] = useState(false);
  const patientId = selected?.patientId ?? null;
  const patientIdsKey = patients.map((patient) => patient.patientId).join(',');

  const appointmentsLoader = useCallback(
    (): Promise<PortalLoad<PortalAppointment[]>> =>
      patientId ? loadAppointments(patientId) : Promise.resolve({ state: 'ready', data: [] }),
    [patientId]
  );
  const requestsLoader = useCallback(() => loadRequests(patientIdsKey ? patientIdsKey.split(',') : []), [patientIdsKey]);
  const { view, reload } = usePortalLoad(appointmentsLoader);
  const { view: requestsView, reload: reloadRequests } = usePortalLoad(requestsLoader);

  const split = useMemo(() => (view.state === 'ready' ? splitAppointments(view.data, new Date()) : null), [view]);
  const requests = requestsView.state === 'ready' ? requestsView.data.filter((request) => request.patientId === patientId) : [];
  const pendingForPatient = requests.filter((request) => request.status === 'pending').length;

  const refresh = () => {
    reload();
    reloadRequests();
  };

  if (!selected) return null;

  if (form) {
    return (
      <RequestForm
        kind={form.kind}
        patient={selected}
        appointment={form.kind === 'reschedule' ? form.appointment : null}
        pendingForPatient={pendingForPatient}
        onCancel={() => setForm(null)}
        onDone={() => {
          setForm(null);
          refresh();
        }}
      />
    );
  }

  const past = split?.past ?? [];
  return (
    <div>
      <PageTitle
        icon="solar:calendar-bold-duotone"
        title="Appointments"
        subtitle={selected.firstName}
        action={
          <PrimaryButton icon="solar:calendar-add-bold-duotone" onClick={() => setForm({ kind: 'book' })} className="px-3 py-2">
            Book
          </PrimaryButton>
        }
      />

      {view.state === 'loading' && <LoadingBlock />}
      {view.state === 'not_enabled' && <NotEnabledBlock />}
      {view.state === 'error' && <ErrorBlock message={view.message} onRetry={reload} />}

      {split && (
        <>
          <SectionTitle>Coming up</SectionTitle>
          {split.upcoming.length === 0 ? (
            <Card>
              <EmptyBlock icon="solar:calendar-minimalistic-bold-duotone" title="No appointments booked">
                Tap Book to ask the practice for one.
              </EmptyBlock>
            </Card>
          ) : (
            <div className="space-y-3">
              {split.upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.visit.id}
                  appointment={appointment}
                  patientId={selected.patientId}
                  practiceId={selected.practiceId}
                  upcoming
                  onReschedule={() => setForm({ kind: 'reschedule', appointment })}
                  onChanged={refresh}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Requests that could not be read are said to be missing, not silently left out */}
      {requestsView.state === 'error' && (
        <>
          <SectionTitle>Your requests</SectionTitle>
          <ErrorBlock message={requestsView.message} onRetry={reloadRequests} />
        </>
      )}

      {requests.length > 0 && (
        <>
          <SectionTitle>Your requests</SectionTitle>
          <div className="space-y-3">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} onChanged={refresh} />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle>Earlier</SectionTitle>
          <div className="space-y-3">
            {(showAllPast ? past : past.slice(0, PAST_SHOWN)).map((appointment) => (
              <AppointmentCard
                key={appointment.visit.id}
                appointment={appointment}
                patientId={selected.patientId}
                practiceId={selected.practiceId}
                upcoming={false}
                onChanged={refresh}
              />
            ))}
          </div>
          {!showAllPast && past.length > PAST_SHOWN && (
            <button type="button" onClick={() => setShowAllPast(true)} className="mt-3 w-full text-sm font-medium text-cyan-700 py-2">
              <Icon icon="solar:alt-arrow-down-bold-duotone" className="inline w-4 h-4 mr-1" aria-hidden="true" />
              Show all {past.length}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default AppointmentsPage;
