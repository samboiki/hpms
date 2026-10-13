import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatPhoneForDisplay, normalizePhoneNumber, toTelHref } from '../../components/patients/patientContact';
import { usePortal, usePortalLoad } from '../portalContext';
import { patientName, REQUEST_STATUS_LABELS } from '../portalModel';
import { formatServiceDate } from '../../utils/billing/dates';
import { loadRequests } from '../portalService';
import { Card, DetailRow, ErrorBlock, PageTitle, SecondaryButton, SectionTitle, StatusPill } from '../components/PortalUi';
import RequestForm from '../components/RequestForm';

/** "*******0123": enough to recognise the number on a screen others may see. */
const maskedId = (id: string | null): string => {
  if (!id) return '-';
  const visible = id.slice(-4);
  return `${'*'.repeat(Math.max(0, id.length - 4))}${visible}`;
};

const phoneText = (raw: string | null): string => {
  const e164 = normalizePhoneNumber(raw);
  return e164 ? formatPhoneForDisplay(e164) : raw ?? '-';
};

/** The chosen person's details as the practice has them, change requests, and who is on this app. */
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { selected, patients, status, signOut } = usePortal();
  const [editing, setEditing] = useState(false);
  const patientIdsKey = patients.map((patient) => patient.patientId).join(',');
  const loader = useCallback(() => loadRequests(patientIdsKey ? patientIdsKey.split(',') : []), [patientIdsKey]);
  const { view, reload } = usePortalLoad(loader);
  if (!selected) return null;

  const requests = view.state === 'ready' ? view.data.filter((request) => request.patientId === selected.patientId) : [];
  const changeRequests = requests.filter((request) => request.kind === 'profile_change');
  const pending = requests.filter((request) => request.status === 'pending').length;

  if (editing) {
    return (
      <RequestForm
        kind="profile_change"
        patient={selected}
        pendingForPatient={pending}
        onCancel={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          reload();
        }}
      />
    );
  }

  const practicePhone = toTelHref(selected.practicePhone);
  const unlinked = status?.unlinkedOnNumber ?? 0;

  return (
    <div>
      <PageTitle icon="solar:user-id-bold-duotone" title={patientName(selected)} subtitle={selected.relationship === 'child' ? 'Your child' : 'You'} />

      <Card>
        <DetailRow label="Date of birth" value={formatServiceDate(selected.dateOfBirth)} />
        <DetailRow label="ID number" value={maskedId(selected.idNumber)} />
        <DetailRow label="Cell number" value={phoneText(selected.cellNumber)} />
        <DetailRow label="Email" value={selected.email ?? '-'} />
        <DetailRow label="Home address" value={selected.homeAddress ?? '-'} />
        <DetailRow
          label="Postal address"
          value={[selected.postalAddress, selected.postalCode].filter(Boolean).join(', ') || '-'}
        />
        <SecondaryButton icon="solar:pen-new-square-bold-duotone" onClick={() => setEditing(true)} className="w-full mt-3">
          Ask for a change
        </SecondaryButton>
        <p className="mt-2 text-xs text-gray-500">Changes are made by the practice, so your file stays correct.</p>
      </Card>

      {/* Change requests that could not be read are said to be missing, not silently left out */}
      {view.state === 'error' && (
        <>
          <SectionTitle>Change requests</SectionTitle>
          <ErrorBlock message={view.message} onRetry={reload} />
        </>
      )}

      {changeRequests.length > 0 && (
        <>
          <SectionTitle>Change requests</SectionTitle>
          <div className="space-y-2">
            {changeRequests.map((request) => (
              <Card key={request.id} className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-800 break-words min-w-0">{request.message}</p>
                  <StatusPill tone={REQUEST_STATUS_LABELS[request.status].tone}>{REQUEST_STATUS_LABELS[request.status].label}</StatusPill>
                </div>
                {request.staffNote && <p className="text-sm text-gray-600">The practice: {request.staffNote}</p>}
              </Card>
            ))}
          </div>
        </>
      )}

      {selected.practiceName && (
        <>
          <SectionTitle>Practice</SectionTitle>
          <Card>
            <p className="font-medium text-gray-900">{selected.practiceName}</p>
            {selected.practiceAddress && <p className="text-sm text-gray-600">{selected.practiceAddress}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {practicePhone && (
                <a href={practicePhone} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800">
                  <Icon icon="solar:phone-bold-duotone" className="w-5 h-5 text-cyan-700" aria-hidden="true" />
                  Call
                </a>
              )}
              {selected.practiceEmail && (
                <a
                  href={`mailto:${selected.practiceEmail}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800"
                >
                  <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 text-cyan-700" aria-hidden="true" />
                  Email
                </a>
              )}
            </div>
          </Card>
        </>
      )}

      <SectionTitle>People on this app</SectionTitle>
      <Card className="space-y-2">
        {patients.map((patient) => (
          <div key={patient.patientId} className="flex items-center gap-2 text-sm text-gray-800">
            <Icon icon={patient.relationship === 'child' ? 'solar:smile-circle-bold-duotone' : 'solar:user-bold-duotone'} className="w-5 h-5 text-cyan-700" aria-hidden="true" />
            <span className="min-w-0 truncate">{patientName(patient)}</span>
            <span className="text-gray-500">{patient.relationship === 'child' ? '(child)' : ''}</span>
          </div>
        ))}
        {unlinked > 0 && (
          <p className="text-sm text-gray-600">
            This cell number is on {unlinked} more patient {unlinked === 1 ? 'file' : 'files'}.
          </p>
        )}
        <SecondaryButton icon="solar:user-plus-bold-duotone" onClick={() => navigate('/me/link')} className="w-full">
          Add a person
        </SecondaryButton>
      </Card>

      <SecondaryButton icon="solar:logout-2-bold-duotone" onClick={() => void signOut()} className="w-full mt-6">
        Sign out
      </SecondaryButton>
    </div>
  );
};

export default ProfilePage;
