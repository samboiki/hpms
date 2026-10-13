import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatNad } from '../../utils/billing/money';
import { summarizePatientInvoices } from '../../components/patients/patientBilling';
import { usePortal, usePortalLoad } from '../portalContext';
import { appointmentStatus, formatDay, formatTime, splitAppointments, visitTypeLabel, type PortalAppointment } from '../portalModel';
import { loadAppointments, loadInvoices, type PortalInvoice, type PortalLoad } from '../portalService';
import { Card, ErrorBlock, LoadingBlock, NotEnabledBlock, Notice, StatusPill } from '../components/PortalUi';

const QuickAction: React.FC<{ to: string; icon: string; title: string; detail?: string }> = ({ to, icon, title, detail }) => (
  <Link to={to} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col gap-2 min-h-[104px]">
    <Icon icon={icon} className="w-8 h-8 text-cyan-600" aria-hidden="true" />
    <span className="font-medium text-gray-900 text-sm">{title}</span>
    {detail && <span className="text-xs text-gray-500">{detail}</span>}
  </Link>
);

const NextAppointment: React.FC<{ appointment: PortalAppointment | null }> = ({ appointment }) => {
  if (!appointment) {
    return (
      <Card className="flex items-center gap-3">
        <Icon icon="solar:calendar-minimalistic-bold-duotone" className="w-10 h-10 text-gray-300 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium text-gray-800">No appointment booked</p>
          <Link to="/me/appointments?book=1" className="text-sm font-medium text-cyan-700">
            Ask for an appointment
          </Link>
        </div>
      </Card>
    );
  }
  const status = appointmentStatus(appointment, new Date());
  return (
    <Link to="/me/appointments" className="block">
      <Card className="space-y-1 border-cyan-100">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Next appointment</p>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
        <p className="text-lg font-semibold text-gray-900">
          {formatDay(appointment.date) ?? 'Date to be confirmed'}
          {appointment.time ? `, ${formatTime(appointment.time)}` : ''}
        </p>
        <p className="text-sm text-gray-600">
          {visitTypeLabel(appointment.visitType)}
          {appointment.doctorName ? ` with ${appointment.doctorName}` : ''}
        </p>
        {appointment.practiceName && <p className="text-sm text-gray-500">{appointment.practiceName}</p>}
      </Card>
    </Link>
  );
};

/** Home: the next appointment, what is owed, quick ways in. */
const HomePage: React.FC = () => {
  const { selected, status } = usePortal();
  const patientId = selected?.patientId ?? null;
  const appointmentsLoader = useCallback(
    (): Promise<PortalLoad<PortalAppointment[]>> => (patientId ? loadAppointments(patientId) : Promise.resolve({ state: 'ready', data: [] })),
    [patientId]
  );
  const invoicesLoader = useCallback(
    (): Promise<PortalLoad<PortalInvoice[]>> => (patientId ? loadInvoices(patientId) : Promise.resolve({ state: 'ready', data: [] })),
    [patientId]
  );
  const { view: appointments, reload: reloadAppointments } = usePortalLoad(appointmentsLoader);
  const { view: invoices } = usePortalLoad(invoicesLoader);

  const next = useMemo(
    () => (appointments.state === 'ready' ? splitAppointments(appointments.data, new Date()).upcoming[0] ?? null : null),
    [appointments]
  );
  const owed = useMemo(() => (invoices.state === 'ready' ? summarizePatientInvoices(invoices.data).balanceDuePatient : null), [invoices]);
  if (!selected) return null;

  const unlinked = status?.unlinkedOnNumber ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Hello, {selected.firstName || 'there'}</h1>
        {selected.practiceName && <p className="text-sm text-gray-500">{selected.practiceName}</p>}
      </div>

      {/* A booking that could not be read is never shown as "No appointment booked" */}
      {appointments.state === 'loading' ? (
        <LoadingBlock />
      ) : appointments.state === 'error' ? (
        <ErrorBlock message={appointments.message} onRetry={reloadAppointments} />
      ) : appointments.state === 'not_enabled' ? (
        <NotEnabledBlock />
      ) : (
        <NextAppointment appointment={next} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <QuickAction to="/me/appointments?book=1" icon="solar:calendar-add-bold-duotone" title="Book an appointment" />
        <QuickAction
          to="/me/invoices"
          icon="solar:wallet-money-bold-duotone"
          title="Invoices"
          detail={owed === null ? undefined : owed > 0 ? `You owe ${formatNad(owed)}` : 'Nothing to pay'}
        />
        <QuickAction to="/me/results" icon="solar:test-tube-bold-duotone" title="Results" detail="Shared by your practitioner" />
        <QuickAction to="/me/prescriptions" icon="solar:pills-bold-duotone" title="Medicines" />
      </div>

      {unlinked > 0 && (
        <Link to="/me/link" className="block">
          <Notice tone="info" icon="solar:users-group-rounded-bold-duotone">
            <p>
              This cell number is on {unlinked} more patient {unlinked === 1 ? 'file' : 'files'}. Add your child under 18, or
              another adult can add themselves with their own details.
            </p>
            <p className="font-medium underline">Add a person</p>
          </Notice>
        </Link>
      )}
    </div>
  );
};

export default HomePage;
