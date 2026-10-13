import React, { useCallback } from 'react';
import { usePortal, usePortalLoad } from '../portalContext';
import { formatDay, type PortalPrescription } from '../portalModel';
import { loadPrescriptions, type PortalLoad } from '../portalService';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, NotEnabledBlock, Notice, PageTitle, StatusPill } from '../components/PortalUi';

const PrescriptionCard: React.FC<{ prescription: PortalPrescription }> = ({ prescription }) => {
  const how = [prescription.dosage, prescription.frequency, prescription.duration ? `for ${prescription.duration}` : null].filter(Boolean).join(', ');
  const active = (prescription.status ?? '').toLowerCase() === 'active';
  return (
    <Card className="space-y-1">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-gray-900 break-words min-w-0">{prescription.medicine}</p>
        {prescription.status && <StatusPill tone={active ? 'green' : 'gray'}>{active ? 'Current' : 'Finished'}</StatusPill>}
      </div>
      {how && <p className="text-sm text-gray-800">{how}</p>}
      {prescription.instructions && <p className="text-sm text-gray-600 break-words">{prescription.instructions}</p>}
      <p className="text-xs text-gray-500">
        {formatDay(prescription.prescribedDate) ?? ''}
        {prescription.prescriberName ? ` - ${prescription.prescriberName}` : ''}
        {prescription.practiceName ? ` - ${prescription.practiceName}` : ''}
      </p>
    </Card>
  );
};

/** Medicines prescribed to the chosen person, newest first. */
const PrescriptionsPage: React.FC = () => {
  const { selected } = usePortal();
  const patientId = selected?.patientId ?? null;
  const loader = useCallback(
    (): Promise<PortalLoad<PortalPrescription[]>> => (patientId ? loadPrescriptions(patientId) : Promise.resolve({ state: 'ready', data: [] })),
    [patientId]
  );
  const { view, reload } = usePortalLoad(loader);
  if (!selected) return null;

  return (
    <div className="space-y-3">
      <PageTitle icon="solar:pills-bold-duotone" title="Medicines" subtitle={selected.firstName} />
      <Notice tone="info">
        <p>Take medicines as your practitioner or pharmacist told you. Questions about a medicine? Ask the practice or your pharmacist.</p>
      </Notice>
      {view.state === 'loading' && <LoadingBlock />}
      {view.state === 'not_enabled' && <NotEnabledBlock />}
      {view.state === 'error' && <ErrorBlock message={view.message} onRetry={reload} />}
      {view.state === 'ready' && view.data.length === 0 && (
        <Card>
          <EmptyBlock icon="solar:pills-3-bold-duotone" title="No medicines prescribed yet" />
        </Card>
      )}
      {view.state === 'ready' && view.data.map((prescription) => <PrescriptionCard key={prescription.id} prescription={prescription} />)}
    </div>
  );
};

export default PrescriptionsPage;
