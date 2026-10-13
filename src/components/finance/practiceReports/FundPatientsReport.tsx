import React, { useMemo, useState } from 'react';
import type { AgeAnalysisContext, AgingReport } from '../../../services/ledgerService';
import { formatNad } from '../financeFormat';
import { Field, inputClass } from '../receipts/ArUi';
import { fundChoices, fundPatients, fundPatientsTable } from './fundPatients';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';

interface Props {
  practiceId: string;
  practiceName: string;
  todayLabel: string;
  aging: AgingReport;
  ageContext: AgeAnalysisContext;
}

/** A fund's patients with balances (parity R20): the age analysis per patient with a fund filter, as at today */
export const FundPatientsReport: React.FC<Props> = ({ practiceId, practiceName, todayLabel, aging, ageContext }) => {
  const choices = useMemo(() => fundChoices(aging, ageContext), [aging, ageContext]);
  const [chosen, setChosen] = useState('');
  const fund = chosen && choices.some(choice => choice.fund === chosen) ? chosen : choices[0]?.fund ?? '';
  const report = useMemo(() => (fund ? fundPatientsTable(fundPatients(aging, fund, ageContext), fund, todayLabel) : null), [aging, fund, ageContext, todayLabel]);
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: { ...ageContext.patientNames }, onChanged: () => undefined });

  return (
    <>
      <ReportFrame
        title="A fund's patients with balances"
        subtitle={`As at ${todayLabel}`}
        icon="solar:users-group-two-rounded-bold-duotone"
        tone="orange"
        exportKey="fund_patients"
        practiceId={practiceId}
        practiceName={practiceName}
        range={null}
        exportFilters={{ fund: fund || null }}
        status={{ state: 'ready' }}
        report={report}
        empty={{ title: 'Nobody of this fund owes anything', hint: 'Patients of the fund with something owed, or with credit not allocated, appear here.' }}
        onOpen={open}
        resetKey={fund}
        controls={
          choices.length === 0 ? (
            <p className="text-sm text-gray-600">No patient owes the practice anything, so there is no fund to choose.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Fund" htmlFor="fund-patients-fund" hint="The medical aid recorded on each patient's file">
                <select id="fund-patients-fund" className={inputClass} value={fund} onChange={event => setChosen(event.target.value)}>
                  {choices.map(choice => (
                    <option key={choice.fund} value={choice.fund}>
                      {`${choice.fund} (${choice.patients} ${choice.patients === 1 ? 'patient' : 'patients'}, ${formatNad(choice.owedCents / 100)})`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )
        }
      />
      {element}
    </>
  );
};
