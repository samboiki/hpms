import React, { useEffect, useState } from 'react';
import type { AgeAnalysisContext } from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { AllocationsByAgeReport } from './AllocationsByAgeReport';
import { CashByPractitionerReport } from './CashByPractitionerReport';
import { ClaimsDashboard } from './ClaimsDashboardReport';
import { DemographicsReport } from './DemographicsReport';
import { DiagnosesReport } from './DiagnosesReport';
import { DiscountsReport } from './DiscountsReport';
import { FundPatientsReport } from './FundPatientsReport';
import { GrossProfitReport } from './GrossProfitReport';
import { InvoicesPerFundReport } from './InvoicesPerFundReport';
import { ReportBuilderReport } from './ReportBuilderReport';
import { SpendByTownReport } from './SpendByTownReport';
import { StockMovementReport } from './StockMovementReport';
import { TransactionsReport } from './TransactionsReport';
import { WhoDidWhatReport } from './WhoDidWhatReport';
import { YearToDateReport } from './YearToDateReport';
import type { LiveReportId } from './liveReportDefinitions';
import { loadStaffNames } from './practiceReportsService';

interface PanelProps {
  id: LiveReportId;
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  workspace: FinanceWorkspace;
  derived: FinanceDerived;
  ageContext: AgeAnalysisContext;
  /** Every report's name by its download key (the fixed reports' too), for the downloads in "who did what" */
  reportNames: Readonly<Record<string, string>>;
}

type Staff = { names: Record<string, string>; staff: Array<{ id: string; name: string; role: string | null; active: boolean }> };

/** The opened report (liveReportDefinitions.ts lists them) */
export const LiveReportPanel: React.FC<PanelProps> = ({ id, practiceId, practiceName, labels, workspace, derived, ageContext, reportNames }) => {
  const [staff, setStaff] = useState<Staff>({ names: {}, staff: [] });
  useEffect(() => {
    let cancelled = false;
    loadStaffNames(practiceId)
      .then(result => { if (!cancelled) setStaff(result); })
      // Names are a nicety: the reports name "someone not on the staff list" instead of failing
      .catch(() => { if (!cancelled) setStaff({ names: {}, staff: [] }); });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const common = { practiceId, practiceName, labels };
  switch (id) {
    case 'transactions':
      return <TransactionsReport {...common} staffNames={staff.names} />;
    case 'cash_by_practitioner':
      return <CashByPractitionerReport {...common} staffNames={staff.names} />;
    case 'invoices_per_fund':
      return <InvoicesPerFundReport {...common} workspace={workspace} />;
    case 'fund_patients':
      return <FundPatientsReport practiceId={practiceId} practiceName={practiceName} todayLabel={labels.today} aging={derived.aging} ageContext={ageContext} />;
    case 'diagnoses':
      return <DiagnosesReport {...common} staffNames={staff.names} />;
    case 'claims_dashboard':
      return <ClaimsDashboard {...common} />;
    case 'discounts':
      return <DiscountsReport {...common} staffNames={staff.names} />;
    case 'who_did_what':
      return <WhoDidWhatReport {...common} staff={staff.staff} staffNames={staff.names} reportNames={reportNames} />;
    case 'payments_by_age':
      return <AllocationsByAgeReport {...common} />;
    case 'year_to_date':
      return <YearToDateReport {...common} staffNames={staff.names} />;
    case 'demographics':
      return <DemographicsReport {...common} />;
    case 'spend_by_town':
      return <SpendByTownReport {...common} />;
    case 'stock_movement':
      return <StockMovementReport {...common} />;
    case 'gross_profit':
      return <GrossProfitReport {...common} staffNames={staff.names} />;
    case 'report_builder':
      return <ReportBuilderReport {...common} staffNames={staff.names} />;
  }
};
