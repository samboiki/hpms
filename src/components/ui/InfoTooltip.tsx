import React, { useState, useRef, useEffect } from 'react';
import Icon, { SolarIcons } from './Icon';
import { motion, AnimatePresence } from 'framer-motion';

interface InfoTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  className?: string;
  iconClassName?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  content, 
  title,
  className = '',
  iconClassName = 'w-4 h-4 text-gray-400 hover:text-gray-600',
  position = 'top'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && iconRef.current && tooltipRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const padding = 8;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = iconRect.top - tooltipRect.height - padding;
          left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'bottom':
          top = iconRect.bottom + padding;
          left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = iconRect.top + (iconRect.height / 2) - (tooltipRect.height / 2);
          left = iconRect.left - tooltipRect.width - padding;
          break;
        case 'right':
          top = iconRect.top + (iconRect.height / 2) - (tooltipRect.height / 2);
          left = iconRect.right + padding;
          break;
      }

      // Ensure tooltip stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < padding) left = padding;
      if (left + tooltipRect.width > viewportWidth - padding) {
        left = viewportWidth - tooltipRect.width - padding;
      }
      if (top < padding) top = iconRect.bottom + padding;
      if (top + tooltipRect.height > viewportHeight - padding) {
        top = iconRect.top - tooltipRect.height - padding;
      }

      setTooltipPosition({ top, left });
    }
  }, [isOpen, position]);

  return (
    <>
      <div
        ref={iconRef}
        className={`inline-flex items-center cursor-help ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <Icon icon={SolarIcons.infoCircle} className={iconClassName} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 max-w-xs"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
            }}
          >
            <div className="bg-gray-900 text-white rounded-lg shadow-xl p-3">
              {title && (
                <div className="font-semibold text-sm mb-1 text-blue-200">{title}</div>
              )}
              <div className="text-sm">{content}</div>
              <div
                className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
                  position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
                  position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
                  position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
                  'left-[-4px] top-1/2 -translate-y-1/2'
                }`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Payroll-specific tooltips
export const PayrollTooltips = {
  statutory: (
    <InfoTooltip
      title="Statutory Deductions"
      content="These are legally required deductions mandated by government law, such as income tax (PAYE), social security, and medicare. Employers must deduct these from employee salaries."
    />
  ),
  
  recurring: (
    <InfoTooltip
      title="Recurring vs Event-based"
      content="Recurring items appear automatically on every payslip (e.g., basic salary, tax). Event-based items are one-time adjustments added as needed (e.g., bonuses, penalties)."
    />
  ),
  
  companyContribution: (
    <InfoTooltip
      title="Company Contribution"
      content="Benefits paid by the employer on behalf of the employee, such as employer's portion of health insurance or retirement contributions. These don't reduce the employee's net pay."
    />
  ),
  
  baseCalculation: (
    <InfoTooltip
      title="Base Calculation"
      content={
        <div className="space-y-2">
          <div><strong>Basic Salary:</strong> Calculated on base salary only</div>
          <div><strong>Gross Salary:</strong> Calculated on total earnings including allowances</div>
          <div><strong>Custom:</strong> Fixed amount not based on salary</div>
        </div>
      }
    />
  ),
  
  approvalWorkflow: (
    <InfoTooltip
      title="Approval Workflow"
      content="Adjustments require approval before being included in payslips. Admins and doctors can approve adjustments by clicking the green checkmark. Only approved adjustments affect net pay."
    />
  ),
  
  payslipAdjustments: (
    <InfoTooltip
      title="Payslip Adjustments"
      content="One-time additions or deductions for specific events like overtime pay, bonuses, penalties, or absence deductions. These are not recurring and must be added monthly as needed."
    />
  ),
  
  bonusPeriod: (
    <InfoTooltip
      title="Bonus Period Types"
      content={
        <div className="space-y-2">
          <div><strong>Monthly:</strong> Paid every month</div>
          <div><strong>Yearly:</strong> Paid once a year (usually December)</div>
          <div><strong>Birthday:</strong> Paid in employee's birth month</div>
          <div><strong>Custom:</strong> Paid in specific months you select</div>
        </div>
      }
    />
  ),
  
  payeInfo: (
    <InfoTooltip
      title="PAYE (Pay As You Earn)"
      content="Income tax deducted from employee salaries at source. The employer deducts and remits this tax to the government on behalf of employees. Tax rates vary based on income brackets."
    />
  ),
  
  netPay: (
    <InfoTooltip
      title="Net Pay Calculation"
      content={
        <div className="space-y-1">
          <div className="font-semibold">Net Pay = Gross Earnings - Total Deductions</div>
          <div className="text-xs mt-2">Where:</div>
          <div className="text-xs">• Gross = Basic + Allowances + Bonuses</div>
          <div className="text-xs">• Deductions = Tax + Insurance + Other</div>
        </div>
      }
    />
  )
};