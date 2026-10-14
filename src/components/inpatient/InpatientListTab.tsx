import React from 'react';
import { DataTable, type TableColumn } from '../finance/DataTable';
import { EmptyState } from '../finance/FinanceUI';
import type { Admission, WardBoard } from '../../services/inpatientService';
import { ADMISSION_CONDITIONS, dayOfStay, labelOf, windhoekDay } from '../../utils/inpatient/inpatientRules';
import { Chip } from '../stock/stockParts';
import { day } from '../stock/stockUi';
import { bedPlace, currentBedOf, patientName, staffName, useStaff } from './inpatientData';

/** Who is admitted now: their bed, day of stay, doctor and safety flags; a row opens the stay */
export const InpatientListTab: React.FC<{ board: WardBoard; practiceId: string | null; onOpen: (admissionId: string) => void }> = ({ board, practiceId, onOpen }) => {
  const { names } = useStaff(practiceId);
  const columns: TableColumn<Admission>[] = [
    {
      key: 'patient',
      header: 'Patient',
      render: row => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{patientName(row)}</p>
          <p className="text-xs text-gray-500">{row.admission_number}</p>
        </div>
      )
    },
    { key: 'bed', header: 'Bed', render: row => <span className="text-gray-800">{bedPlace(board, currentBedOf(board, row.id)?.bed_id)}</span> },
    {
      key: 'day',
      header: 'Stay',
      render: row => (
        <span className="text-gray-800">
          Day {dayOfStay(row.admission_date)}
          <span className="block text-xs text-gray-500">since {day(windhoekDay(row.admission_date))}</span>
        </span>
      )
    },
    { key: 'doctor', header: 'Doctor', hideBelow: 'md', render: row => <span className="text-gray-800">{staffName(names, row.attending_doctor_id) || '-'}</span> },
    {
      key: 'flags',
      header: 'Alerts',
      hideBelow: 'sm',
      render: row => (
        <span className="flex flex-wrap gap-1">
          {row.patient_condition && row.patient_condition !== 'stable' && <Chip tone={row.patient_condition === 'critical' ? 'red' : 'amber'}>{labelOf(ADMISSION_CONDITIONS, row.patient_condition)}</Chip>}
          {row.isolation_required && <Chip tone="red">Isolation</Chip>}
          {row.fall_risk && <Chip tone="amber">Fall risk</Chip>}
          {row.allergy_alert && <Chip tone="red">Allergy</Chip>}
        </span>
      )
    }
  ];
  return (
    <DataTable
      rows={board.active}
      columns={columns}
      rowKey={row => row.id}
      onRowClick={row => onOpen(row.id)}
      rowLabel={row => `Open the stay of ${patientName(row)}`}
      itemLabel="patients"
      empty={<EmptyState icon="solar:user-heart-bold-duotone" title="Nobody is admitted" message="Admit a patient from the button above, the patient's file or their visit." />}
    />
  );
};
