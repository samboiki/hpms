import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { ErrorState, LoadingState, SegmentedTabs } from '../finance/FinanceUI';
import { useAuthStore } from '../../stores/authStore';
import { invoiceLink, visitLink } from '../billing/invoiceLinks';
import { printDocument } from '../finance/receipts/receiptDocuments';
import type { AdmissionDetail, WardBoard } from '../../services/inpatientService';
import {
  ADMISSION_CONDITIONS,
  ADMISSION_SOURCES,
  ADMISSION_TYPES,
  canDo,
  dayOfStay,
  DISCHARGE_TYPES,
  labelOf,
  TRANSFER_REASONS,
  windhoekDay
} from '../../utils/inpatient/inpatientRules';
import { Chip } from '../stock/stockParts';
import { LINK, PRIMARY, SECONDARY, day, dayTime, errorText } from '../stock/stockUi';
import { bedPlace, patientName, staffName, useAdmissionDetail, useStaff } from './inpatientData';
import { dischargeSummaryHtml } from './dischargeSummary';
import { RoundsPanel } from './RoundsPanel';
import { NursingPanel } from './NursingPanel';
import { MedicationPanel } from './MedicationPanel';
import { VisitorsPanel } from './VisitorsPanel';
import { TransferSheet } from './TransferSheet';
import { DischargeSheet } from './DischargeSheet';
import { BillStaySheet } from './BillStaySheet';
import { EditAdmissionSheet } from './EditAdmissionSheet';

type Section = 'summary' | 'rounds' | 'nursing' | 'medicines' | 'visitors';

interface AdmissionSheetProps {
  admissionId: string;
  practiceId: string;
  role: string | null;
  board: WardBoard;
  onClose: () => void;
}

/** One stay: its details and history, ward rounds, nursing records, the medication chart and visitors */
export const AdmissionSheet: React.FC<AdmissionSheetProps> = ({ admissionId, practiceId, role, board, onClose }) => {
  const detail = useAdmissionDetail(admissionId);
  const { names } = useStaff(practiceId);
  const practiceName = useAuthStore(state => state.user?.practices?.name) || 'Practice';
  const [section, setSection] = useState<Section>('summary');
  const [sheet, setSheet] = useState<'transfer' | 'discharge' | 'bill' | 'edit' | null>(null);
  const data = detail.data;
  const admission = data?.admission;
  const active = admission?.admission_status === 'active';
  const currentBed = data?.allocations.find(allocation => allocation.is_current)?.bed_id ?? null;
  const nameOf = (id: string | null | undefined) => staffName(names, id);

  const print = () => {
    if (!data) return;
    const html = dischargeSummaryHtml(data, { practiceName, patientName: patientName(data.admission), staffName: nameOf, bedName: bedId => bedPlace(board, bedId) });
    if (!printDocument(html)) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  };

  const subtitle = admission
    ? `${admission.admission_number} · ${active ? `${bedPlace(board, currentBed)} · day ${dayOfStay(admission.admission_date)}`
      : `discharged ${day(admission.actual_discharge_date ? windhoekDay(admission.actual_discharge_date) : null)}`}`
    : undefined;

  return (
    <>
      <ListSheet
        open={!sheet}
        onClose={onClose}
        size="lg"
        title={admission ? patientName(admission) : 'Stay'}
        subtitle={subtitle}
        footer={data && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button type="button" onClick={print} className={SECONDARY}>
              <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              {active ? 'Print summary' : 'Discharge summary'}
            </button>
            {active && canDo(role, 'transfer') && (
              <button type="button" onClick={() => setSheet('transfer')} className={SECONDARY}>
                <Icon icon="solar:transfer-horizontal-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Move bed
              </button>
            )}
            {active && canDo(role, 'discharge') && (
              <button type="button" onClick={() => setSheet('discharge')} className={PRIMARY}>
                <Icon icon="solar:logout-2-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Discharge
              </button>
            )}
            {!active && !data.admission.billed_invoice_id && (
              <button type="button" onClick={() => setSheet('bill')} className={PRIMARY}>
                <Icon icon="solar:bill-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Bill the stay
              </button>
            )}
          </div>
        )}
      >
        {detail.error ? (
          <ErrorState title="The stay could not be loaded" message={errorText(detail.error)} onRetry={() => void detail.refetch()} />
        ) : !data ? (
          <LoadingState label="Loading the stay" rows={3} />
        ) : (
          <div className="space-y-4">
            <SegmentedTabs<Section>
              value={section}
              onChange={setSection}
              ariaLabel="Parts of the stay"
              options={[
                { value: 'summary', label: 'Summary', icon: 'solar:notes-bold-duotone' },
                { value: 'rounds', label: 'Rounds', icon: 'solar:stethoscope-bold-duotone' },
                { value: 'nursing', label: 'Nursing', icon: 'solar:clipboard-heart-bold-duotone' },
                { value: 'medicines', label: 'Medicines', icon: 'solar:pill-bold-duotone' },
                { value: 'visitors', label: 'Visitors', icon: 'solar:users-group-rounded-bold-duotone' }
              ]}
            />
            <div role="tabpanel">
              {section === 'summary' && <SummaryPanel data={data} board={board} nameOf={nameOf} canEdit={active} onEdit={() => setSheet('edit')} />}
              {section === 'rounds' && <RoundsPanel data={data} role={role} nameOf={nameOf} />}
              {section === 'nursing' && <NursingPanel data={data} role={role} nameOf={nameOf} />}
              {section === 'medicines' && <MedicationPanel data={data} role={role} nameOf={nameOf} />}
              {section === 'visitors' && <VisitorsPanel data={data} board={board} />}
            </div>
          </div>
        )}
      </ListSheet>
      {data && sheet === 'transfer' && <TransferSheet data={data} board={board} onClose={() => setSheet(null)} />}
      {data && sheet === 'discharge' && <DischargeSheet data={data} onClose={() => setSheet(null)} onDischarged={() => setSheet('bill')} />}
      {data && sheet === 'bill' && <BillStaySheet data={data} board={board} practiceId={practiceId} onClose={() => setSheet(null)} />}
      {data && sheet === 'edit' && <EditAdmissionSheet data={data} practiceId={practiceId} onClose={() => setSheet(null)} />}
    </>
  );
};

const Fact: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900">{children || '-'}</dd>
  </div>
);

const SummaryPanel: React.FC<{ data: AdmissionDetail; board: WardBoard; nameOf: (id: string | null | undefined) => string; canEdit: boolean; onEdit: () => void }> = ({ data, board, nameOf, canEdit, onEdit }) => {
  const { admission } = data;
  const codes = [admission.primary_diagnosis_code, ...(admission.secondary_diagnosis_codes ?? [])].filter(Boolean).join(', ');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {admission.patient_condition && <Chip tone={admission.patient_condition === 'critical' ? 'red' : admission.patient_condition === 'stable' ? 'green' : 'amber'}>{labelOf(ADMISSION_CONDITIONS, admission.patient_condition)}</Chip>}
        {admission.isolation_required && <Chip tone="red" icon="solar:shield-warning-bold-duotone">Isolation{admission.isolation_type ? `: ${admission.isolation_type}` : ''}</Chip>}
        {admission.fall_risk && <Chip tone="amber" icon="solar:danger-triangle-bold-duotone">Fall risk</Chip>}
        {admission.allergy_alert && <Chip tone="red" icon="solar:danger-triangle-bold-duotone">Allergies</Chip>}
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fact label="Why admitted" wide>{admission.chief_complaint}</Fact>
        <Fact label="Diagnosis" wide>{[admission.primary_diagnosis, codes && `ICD-10 ${codes}`].filter(Boolean).join(' · ')}</Fact>
        <Fact label="Admitted">{`${dayTime(admission.admission_date)} · ${labelOf(ADMISSION_TYPES, admission.admission_type)}`}</Fact>
        <Fact label="Came from">{labelOf(ADMISSION_SOURCES, admission.admission_source) + (admission.referring_doctor_name ? ` (${admission.referring_doctor_name})` : '')}</Fact>
        <Fact label="Admitting doctor">{nameOf(admission.admitting_doctor_id)}</Fact>
        <Fact label="Attending doctor">{nameOf(admission.attending_doctor_id)}</Fact>
        <Fact label="Medical aid authorisation">{admission.pre_authorization_number}</Fact>
        <Fact label="Expected to go home">{admission.expected_discharge_date ? day(admission.expected_discharge_date) : ''}</Fact>
        {admission.admission_status !== 'active' && (
          <>
            <Fact label="Discharged">{`${dayTime(admission.actual_discharge_date)} · ${labelOf(DISCHARGE_TYPES, admission.discharge_type)}`}</Fact>
            <Fact label="Follow-up">{admission.follow_up_date ? day(admission.follow_up_date) : ''}</Fact>
            <Fact label="Instructions" wide>{admission.discharge_instructions}</Fact>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link to={`/patients?patientId=${encodeURIComponent(admission.patient_id)}`} className={LINK}>Patient file</Link>
        {admission.visit_id && <Link to={visitLink(admission.patient_id, admission.visit_id)} className={LINK}>The visit</Link>}
        {admission.billed_invoice_id && <Link to={invoiceLink(admission.billed_invoice_id)} className={LINK}>The stay&apos;s invoice</Link>}
        {canEdit && <button type="button" onClick={onEdit} className={LINK}>Change details</button>}
      </div>
      <section aria-label="Beds">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Beds</h3>
        <ul className="space-y-1 text-sm text-gray-700">
          {data.allocations.map(allocation => (
            <li key={allocation.id}>
              {bedPlace(board, allocation.bed_id)}: {dayTime(allocation.allocated_at)}{allocation.released_at ? ` to ${dayTime(allocation.released_at)}` : ' (now)'}
            </li>
          ))}
        </ul>
        {data.transfers.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-gray-500">
            {data.transfers.map(move => (
              <li key={move.id}>
                Moved {dayTime(move.transfer_datetime)} ({labelOf(TRANSFER_REASONS, move.transfer_reason)}{move.urgency && move.urgency !== 'routine' ? `, ${move.urgency}` : ''})
                {move.notes ? `: ${move.notes}` : ''} by {nameOf(move.performed_by)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
