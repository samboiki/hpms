import React from 'react';
import { format } from 'date-fns';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';

interface PayslipData {
  employeeName: string;
  employeeId: string;
  department?: string;
  designation?: string;
  payPeriod: string;
  payDate: string;
  basicSalary: number;
  earnings: Array<{ name: string; amount: number; isCompanyContribution?: boolean }>;
  deductions: Array<{ name: string; amount: number }>;
  currency: string;
  companyName?: string;
  companyAddress?: string;
  employeeCode?: string;
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
  ytdGrossEarnings?: number;
  ytdTotalDeductions?: number;
  ytdNetPay?: number;
  leaveBalances?: {
    annual?: { balance: number; entitlement: number; used: number };
    sick?: { balance: number; entitlement: number; used: number };
    compassionate?: { balance: number; entitlement: number; used: number };
  };
}

interface PayslipPreviewProps {
  payslipData: PayslipData;
  onDownload?: () => void;
}

export const PayslipPreview: React.FC<PayslipPreviewProps> = ({ payslipData, onDownload }) => {
  const totalEarnings = payslipData.basicSalary + payslipData.earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalDeductions = payslipData.deductions.reduce((sum, d) => sum + d.amount, 0);
  const netPay = totalEarnings - totalDeductions;
  
  // Calculate tax values
  const taxableEarnings = payslipData.basicSalary + payslipData.earnings.filter(e => e.taxable !== false).reduce((sum, e) => sum + e.amount, 0);
  const taxPaid = payslipData.deductions.find(d => d.name.toLowerCase().includes('tax'))?.amount || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NA', {
      style: 'currency',
      currency: payslipData.currency,
    }).format(amount);
  };

  return (
    <div className="bg-white border-2 border-black">
      {/* Company Header */}
      <div className="border-b-2 border-black p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="font-bold text-sm">Co. Name</p>
            <p className="text-sm">{payslipData.companyName}</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-sm">Co. Address</p>
            <p className="text-sm">{payslipData.companyAddress || 'P.O Box 51454 Windhoek, Namibia'}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm">Payment Dt</p>
            <p className="text-sm">{payslipData.payDate}</p>
            <p className="font-bold text-sm mt-2">Period Code</p>
            <p className="text-sm">{payslipData.payPeriod}</p>
          </div>
        </div>
      </div>

      {/* Employee Details */}
      <div className="border-b-2 border-black p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="font-bold text-sm">Emp Code</p>
            <p className="text-sm">{payslipData.employeeCode}</p>
            <p className="font-bold text-sm mt-2">Emp Name</p>
            <p className="text-sm">{payslipData.employeeName}</p>
            <p className="font-bold text-sm mt-2">Emp Address</p>
            <p className="text-sm">Windhoek, Namibia</p>
          </div>
          <div>
            <p className="font-bold text-sm">Department</p>
            <p className="text-sm">{payslipData.department || 'General'}</p>
            <p className="font-bold text-sm mt-2">Job Title</p>
            <p className="text-sm">{payslipData.designation || 'Staff'}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm">Bank</p>
            <p className="text-sm">{payslipData.bankName || 'Not provided'}</p>
            <p className="font-bold text-sm mt-2">Account No.</p>
            <p className="text-sm">{payslipData.accountNumber || 'Not provided'}</p>
            <p className="font-bold text-sm mt-2">Branch Code</p>
            <p className="text-sm">{payslipData.branchCode || 'Not provided'}</p>
          </div>
        </div>
      </div>

      {/* Earnings and Deductions */}
      <div className="grid grid-cols-2 gap-0">
        {/* Earnings Column */}
        <div className="border-r-2 border-black">
          <div className="bg-gray-100 p-2 border-b border-black">
            <h4 className="font-bold text-center text-sm">EARNINGS</h4>
          </div>
          <div className="p-4">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1 text-sm">Salary</td>
                  <td className="py-1 text-sm text-right">{formatCurrency(payslipData.basicSalary)}</td>
                </tr>
                {payslipData.earnings.map((earning, index) => (
                  <tr key={index}>
                    <td className="py-1 text-sm">{earning.name}</td>
                    <td className="py-1 text-sm text-right">{formatCurrency(earning.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deductions Column */}
        <div>
          <div className="bg-gray-100 p-2 border-b border-black">
            <h4 className="font-bold text-center text-sm">DEDUCTIONS</h4>
          </div>
          <div className="p-4">
            <table className="w-full">
              <tbody>
                {payslipData.deductions.map((deduction, index) => (
                  <tr key={index}>
                    <td className="py-1 text-sm">{deduction.name}</td>
                    <td className="py-1 text-sm text-right">{formatCurrency(deduction.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Additional Info Section */}
      <div className="border-t-2 border-black grid grid-cols-3 gap-0">
        <div className="border-r border-black p-4">
          <p className="font-bold text-sm mb-2">ADDITIONAL INFO</p>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="font-semibold">COMPANY CONTRIBUTION</td>
                <td></td>
              </tr>
              {payslipData.earnings.filter(e => e.isCompanyContribution).map((earning, index) => (
                <tr key={`cc-${index}`}>
                  <td className="pl-2">{earning.name}</td>
                  <td className="text-right">{formatCurrency(earning.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className="pt-2 font-semibold">Total</td>
                <td className="text-right pt-2 font-semibold">
                  {formatCurrency(payslipData.earnings.filter(e => e.isCompanyContribution).reduce((sum, e) => sum + e.amount, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-r border-black p-4">
          <p className="font-bold text-sm mb-2">YEAR TO DATE TOTALS</p>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td>Gross Earnings</td>
                <td className="text-right">{formatCurrency(payslipData.ytdGrossEarnings || totalEarnings)}</td>
              </tr>
              <tr>
                <td>Total Deductions</td>
                <td className="text-right">{formatCurrency(payslipData.ytdTotalDeductions || totalDeductions)}</td>
              </tr>
              <tr>
                <td>Net Pay</td>
                <td className="text-right">{formatCurrency(payslipData.ytdNetPay || netPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-4 text-center">
          <p className="font-bold text-sm mb-2">CURRENT PERIOD</p>
          <p className="text-xs">Co. Contributions</p>
          <p className="font-bold">{formatCurrency(
            payslipData.earnings?.reduce((sum: number, e: any) => 
              e.isCompanyContribution ? sum + e.amount : sum, 0) || 0
          )}</p>
        </div>
      </div>

      {/* Totals Footer */}
      <div className="border-t-2 border-black">
        <table className="w-full">
          <tbody>
            <tr className="bg-gray-100">
              <td className="p-2 font-bold text-sm">Total Earnings</td>
              <td className="p-2 text-right font-bold text-sm">{formatCurrency(totalEarnings)}</td>
              <td className="p-2 font-bold text-sm">Total Deductions</td>
              <td className="p-2 text-right font-bold text-sm">{formatCurrency(totalDeductions)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Net Pay Section */}
      <div className="border-t-2 border-black bg-gray-100 p-4">
        <div className="flex justify-between items-center">
          <span className="font-bold text-lg">NETT PAY</span>
          <span className="font-bold text-2xl">{formatCurrency(netPay)}</span>
        </div>
      </div>

      {/* Leave Details */}
      <div className="border-t-2 border-black p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2">Leave Description</th>
              <th className="text-center">Cycle End Date</th>
              <th className="text-center">Days @ Start</th>
              <th className="text-center">Leave Taken</th>
              <th className="text-center">Leave Accrued</th>
              <th className="text-center">Days @ End</th>
              <th className="text-center">Entitlement</th>
            </tr>
          </thead>
          <tbody>
            {payslipData.leaveBalances?.annual && (
              <tr>
                <td className="py-2">Annual Leave</td>
                <td className="text-center">31/12/{new Date().getFullYear()}</td>
                <td className="text-center">{(payslipData.leaveBalances.annual.balance + payslipData.leaveBalances.annual.used - 2.0833).toFixed(2)}</td>
                <td className="text-center">{payslipData.leaveBalances.annual.used.toFixed(2)}</td>
                <td className="text-center">2.08</td>
                <td className="text-center">{payslipData.leaveBalances.annual.balance.toFixed(2)}</td>
                <td className="text-center">{payslipData.leaveBalances.annual.entitlement.toFixed(2)}</td>
              </tr>
            )}
            {payslipData.leaveBalances?.sick && (
              <tr>
                <td className="py-2">Sick Leave</td>
                <td className="text-center">31/12/{new Date().getFullYear() + 2}</td>
                <td className="text-center">{(payslipData.leaveBalances.sick.balance + payslipData.leaveBalances.sick.used - 1.25).toFixed(2)}</td>
                <td className="text-center">{payslipData.leaveBalances.sick.used.toFixed(2)}</td>
                <td className="text-center">1.25</td>
                <td className="text-center">{payslipData.leaveBalances.sick.balance.toFixed(2)}</td>
                <td className="text-center">{payslipData.leaveBalances.sick.entitlement.toFixed(2)}</td>
              </tr>
            )}
            {payslipData.leaveBalances?.compassionate && (
              <tr>
                <td className="py-2">Compassionate</td>
                <td className="text-center">31/12/{new Date().getFullYear()}</td>
                <td className="text-center">{payslipData.leaveBalances.compassionate.entitlement.toFixed(2)}</td>
                <td className="text-center">{payslipData.leaveBalances.compassionate.used.toFixed(2)}</td>
                <td className="text-center">0.00</td>
                <td className="text-center">{payslipData.leaveBalances.compassionate.balance.toFixed(2)}</td>
                <td className="text-center">{payslipData.leaveBalances.compassionate.entitlement.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Action Button */}
      {onDownload && (
        <div className="p-4 text-center bg-gray-50">
          <Button
            onClick={onDownload}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
          >
            <Icon icon={SolarIcons.download} className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      )}
    </div>
  );
};