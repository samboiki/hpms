import React, { useState } from 'react';
import { SegmentedTabs } from '../finance/FinanceUI';
import { CreditorsReports } from './CreditorsReports';
import { DispensingReport } from './DispensingReport';
import { RegisterReport } from './RegisterReport';
import { ReorderReport } from './ReorderReport';
import { StockListsReport } from './StockListsReport';
import { ValuationReport } from './ValuationReport';
import type { StockContext } from './stockContext';

type Report = 'reorder' | 'valuation' | 'register' | 'dispensing' | 'lists' | 'creditors';

/**
 * Reorder and supplier orders, stock valuation, the scheduled-medicine register, dispensing, the stock lists (R33) and
 * the creditors reports (R24)
 */
export const StockReportsTab: React.FC<{ context: StockContext }> = ({ context }) => {
  const [report, setReport] = useState<Report>('reorder');
  const options = [
    { value: 'reorder' as const, label: 'Reorder and orders', icon: 'solar:cart-large-2-bold-duotone' },
    { value: 'valuation' as const, label: 'Stock value', icon: 'solar:wallet-money-bold-duotone' },
    { value: 'register' as const, label: 'Scheduled register', icon: 'solar:lock-keyhole-bold-duotone' },
    ...(context.settings.dispensingEnabled ? [{ value: 'dispensing' as const, label: 'Dispensing', icon: 'solar:pills-3-bold-duotone' }] : []),
    { value: 'lists' as const, label: 'Stock lists', icon: 'solar:clipboard-list-bold-duotone' },
    { value: 'creditors' as const, label: 'Creditors', icon: 'solar:card-send-bold-duotone' }
  ];
  return (
    <div className="space-y-4">
      <SegmentedTabs value={report} onChange={setReport} options={options} ariaLabel="Stock reports" />
      {report === 'reorder' && <ReorderReport context={context} />}
      {report === 'valuation' && <ValuationReport context={context} />}
      {report === 'register' && <RegisterReport context={context} />}
      {report === 'dispensing' && context.settings.dispensingEnabled && <DispensingReport context={context} />}
      {report === 'lists' && <StockListsReport context={context} />}
      {report === 'creditors' && <CreditorsReports context={context} />}
    </div>
  );
};

export default StockReportsTab;
