import React from 'react';
import { DataTable, type TableColumn } from '../finance/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../finance/FinanceUI';
import type { Admission } from '../../services/inpatientService';
import { DISCHARGE_TYPES, labelOf, windhoekDay } from '../../utils/inpatient/inpatientRules';
import { Chip } from '../stock/stockParts';
import { day, errorText } from '../stock/stockUi';
import { patientName, useDischarged } from './inpatientData';

/** The last 50 stays that ended: when, how the patient left, and whether the stay was billed (a row opens it) */
export const DischargedTab: React.FC<{ practiceId: string | null; onOpen: (admissionId: string) => void }> = ({ practiceId, onOpen }) => {
  const discharged = useDischarged(practiceId, true);
  if (discharged.error) return <ErrorState title="Could not load the discharged patients" message={errorText(discharged.error)} onRetry={() => void discharged.refetch()} />;
  if (!discharged.data) return <LoadingState label="Loading the discharged patients" />;
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
    {
      key: 'dates',
      header: 'Stay',
      render: row => (
        <span className="text-gray-800">
          {day(windhoekDay(row.admission_date))} to {row.actual_discharge_date ? day(windhoekDay(row.actual_discharge_date)) : '-'}
        </span>
      )
    },
    { key: 'how', header: 'Left', hideBelow: 'sm', render: row => <span className="text-gray-800">{labelOf(DISCHARGE_TYPES, row.discharge_type) || '-'}</span> },
    {
      key: 'billed',
      header: 'Billed',
      render: row => (row.billed_invoice_id ? <Chip tone="green">Billed</Chip> : <Chip tone="amber">Not billed</Chip>)
    }
  ];
  return (
    <DataTable
      rows={discharged.data}
      columns={columns}
      rowKey={row => row.id}
      onRowClick={row => onOpen(row.id)}
      rowLabel={row => `Open the stay of ${patientName(row)}`}
      itemLabel="stays"
      empty={<EmptyState icon="solar:history-bold-duotone" title="No discharges yet" message="Patients appear here once they are discharged." />}
    />
  );
};
