import {
  AGING_BUCKETS,
  NO_SHOW_NOTE_MARKER,
  TAKINGS_METHODS,
  attendanceByMonth,
  dailyTakings,
  doctorProductivity,
  expensesByTypeAndMonth,
  fromCents,
  shareOf,
  statutoryPayrollByMonth,
  sumAmounts,
  summarizeAttendance,
  toCents,
  type StatutoryMonthRow
} from '../../services/ledgerService';
import { DEADLINE_WARNING_DAYS } from '../../utils/billing/fundRules';
import { formatDoctorName } from '../../utils/formatDoctorName';
import type { FinanceDerived } from './deriveFinance';
import type { FinanceWorkspace } from './financeData';
import type { PeriodLabels } from './financeNav';
import type { CsvCell, ReportTable } from './financeExport';
import { debtorsByFund } from './fundDebtors';
import { PAYMENT_METHOD_META, expenseTypeLabel, inventoryCategoryLabel } from './financeTheme';
import { formatMonthKey, formatNad, pluralize } from './financeFormat';

export type ReportId =
  | 'daily_takings'
  | 'collections'
  | 'ar_aging'
  | 'fund_debtors'
  | 'revenue_by_tariff'
  | 'payer_mix'
  | 'doctor_productivity'
  | 'attendance'
  | 'payroll_vs_revenue'
  | 'statutory_payroll'
  | 'expenses_by_category'
  | 'inventory_valuation';

export const DERIVED_NOTE = 'Derived from HPMS records (not a double-entry ledger).';

export type ReportResult = { report: ReportTable; unavailable?: undefined } | { report?: undefined; unavailable: string };

/** Aged receivables, one row per unpaid invoice with its amount in its age column */
function arAging(derived: FinanceDerived, workspace: FinanceWorkspace, labels: PeriodLabels): ReportTable {
  const { aging } = derived;
  const bucketIndex = Object.fromEntries(AGING_BUCKETS.map((b, i) => [b.key, i]));
  const rows: CsvCell[][] = aging.items.map(item => {
    const buckets: CsvCell[] = AGING_BUCKETS.map(() => null);
    buckets[bucketIndex[item.bucket]] = item.amount;
    const patientId = item.invoice.patientId;
    return [
      item.invoice.invoiceNumber,
      (patientId && workspace.patientNames[patientId]) || 'Unknown patient',
      (patientId && workspace.schemeByPatient[patientId]) || '',
      item.invoice.dueDate ?? item.invoice.issueDate,
      item.daysPastDue,
      ...buckets,
      item.amount
    ];
  });
  return {
    title: 'Accounts receivable aging',
    basis: `As at ${labels.today}`,
    columns: [
      { header: 'Invoice', type: 'text' },
      { header: 'Patient', type: 'text' },
      { header: 'Medical aid fund', type: 'text' },
      { header: 'Due', type: 'date' },
      { header: 'Days past due', type: 'count' },
      ...AGING_BUCKETS.map(b => ({ header: b.label, type: 'money' as const })),
      { header: 'Owed', type: 'money' }
    ],
    rows,
    totals: ['Total', '', '', '', '', ...AGING_BUCKETS.map(b => aging.byBucket[b.key].amount), aging.total],
    notes: [
      'Unpaid, uncancelled invoices aged by days past their due date.',
      `Medical aids owe ${formatNad(aging.medicalAid)}; patients owe ${formatNad(aging.patient)}.`,
      DERIVED_NOTE
    ]
  };
}

function revenueByTariff(derived: FinanceDerived, labels: PeriodLabels): ReportResult {
  if (!derived.tariffs) return { unavailable: 'Invoice line items could not be loaded.' };
  const rows = derived.tariffs;
  const notes = ['Line items of uncancelled invoices issued in the period.'];
  const rec = derived.reconciliation;
  if (rec && (Math.abs(rec.difference) >= 0.01 || rec.invoicesWithoutLines > 0)) {
    notes.push(`Invoice totals ${formatNad(rec.invoiceTotal)} vs line items ${formatNad(rec.lineTotal)}; ${rec.invoicesWithoutLines} invoice(s) without line items.`);
  }
  notes.push(DERIVED_NOTE);
  return {
    report: {
      title: 'Revenue by tariff code',
      basis: `Invoices issued ${labels.current}`,
      columns: [
        { header: 'Tariff code', type: 'text' },
        { header: 'Description', type: 'text' },
        { header: 'Quantity', type: 'count' },
        { header: 'Invoices', type: 'count' },
        { header: 'Medical aid', type: 'money' },
        { header: 'Patient', type: 'money' },
        { header: 'Revenue', type: 'money' },
        { header: 'Share', type: 'percent' }
      ],
      rows: rows.map(r => [r.code, r.description, r.quantity, r.invoiceCount, r.medicalAid, r.patient, r.revenue, r.share]),
      totals: [
        'Total', '', rows.reduce((n, r) => n + r.quantity, 0), null,
        sumAmounts(rows.map(r => r.medicalAid)), sumAmounts(rows.map(r => r.patient)), sumAmounts(rows.map(r => r.revenue)), rows.length > 0 ? 1 : null
      ],
      notes
    }
  };
}

function payerMixReport(derived: FinanceDerived, labels: PeriodLabels): ReportTable {
  const mix = derived.payerMix;
  const shareOfBilled = (amount: number) => (mix.total > 0 ? amount / mix.total : null);
  return {
    title: 'Payer mix',
    basis: `Invoices issued ${labels.current}`,
    columns: [{ header: 'Payer', type: 'text' }, { header: 'Invoices', type: 'count' }, { header: 'Amount', type: 'money' }, { header: 'Share of billed', type: 'percent' }],
    rows: [
      ['Medical aid (all funds)', null, mix.medicalAid, mix.medicalAidShare],
      ...mix.schemes.map(s => [`  ${s.scheme}`, s.invoiceCount, s.amount, shareOfBilled(s.amount)] as CsvCell[]),
      ['Patient (self-pay portion)', null, mix.patient, mix.patientShare]
    ],
    totals: ['Total billed', derived.revenue.invoiceCount, mix.total, mix.total > 0 ? 1 : null],
    notes: ['The patient owes whatever the medical aid does not cover, so the two parts add up to the total.', DERIVED_NOTE]
  };
}

function collectionsReport(derived: FinanceDerived, labels: PeriodLabels): ReportTable {
  return {
    title: 'Collections by payment method',
    basis: `Paid invoices issued ${labels.current}`,
    columns: [{ header: 'Payment method', type: 'text' }, { header: 'Invoices', type: 'count' }, { header: 'Amount', type: 'money' }, { header: 'Share', type: 'percent' }],
    rows: derived.methods.map(m => [PAYMENT_METHOD_META[m.method].label, m.count, m.amount, m.share]),
    totals: ['Total', derived.collections.count, derived.collections.collected, derived.methods.length > 0 ? 1 : null],
    notes: [
      'HPMS records a payment by marking an invoice paid; payment dates and part-payments are not stored, so collections follow the invoice date.',
      DERIVED_NOTE
    ]
  };
}

function payrollVsRevenueReport(derived: FinanceDerived): ReportResult {
  if (!derived.payrollVsRevenue) return { unavailable: 'Payroll could not be loaded.' };
  const rows = derived.payrollVsRevenue;
  const revenue = sumAmounts(rows.map(r => r.revenue));
  const payroll = sumAmounts(rows.map(r => r.payroll));
  return {
    report: {
      title: 'Payroll vs revenue',
      basis: `${formatMonthKey(rows[0]?.monthKey ?? '2000-01')} to ${formatMonthKey(rows[rows.length - 1]?.monthKey ?? '2000-01')}`,
      columns: [{ header: 'Month', type: 'text' }, { header: 'Revenue billed', type: 'money' }, { header: 'Payroll (gross)', type: 'money' }, { header: 'Payroll % of revenue', type: 'percent' }],
      rows: rows.map(r => [formatMonthKey(r.monthKey, 'MMMM yyyy'), r.revenue, r.payroll, r.ratio]),
      totals: ['Total', revenue, payroll, revenue > 0 ? payroll / revenue : null],
      notes: ['Payroll is gross pay of uncancelled payslips by pay period; revenue is uncancelled invoices by invoice date.', DERIVED_NOTE]
    }
  };
}

/** Day-end cash-up: what was taken each day of the period and how */
function dailyTakingsReport(workspace: FinanceWorkspace, labels: PeriodLabels): ReportTable {
  const takings = dailyTakings(workspace.invoices.rows, labels.ranges.current);
  return {
    title: 'Daily takings',
    basis: `Invoices marked paid ${labels.current}, by the time they were marked paid`,
    columns: [
      { header: 'Day', type: 'date' },
      ...TAKINGS_METHODS.map(method => ({ header: PAYMENT_METHOD_META[method].label, type: 'money' as const })),
      { header: 'Day total', type: 'money' },
      { header: 'Invoices', type: 'count' }
    ],
    rows: takings.days.map(day => [day.dateKey, ...TAKINGS_METHODS.map(method => day.byMethod[method]), day.total, day.count]),
    totals: ['Total', ...TAKINGS_METHODS.map(method => takings.byMethod[method]), takings.total, takings.count],
    notes: [
      'HPMS stores no payment date: a payment counts on the day its invoice was marked paid (the invoice\'s last update), so editing a paid invoice later moves it to that day.',
      'Each invoice counts in full under the payment method recorded when it was marked paid; part-payments are not recorded. Cash is what should be in the till.',
      DERIVED_NOTE
    ]
  };
}

/** What each medical aid owes and where each claim stands, as at today */
function fundDebtorsReport(derived: FinanceDerived, workspace: FinanceWorkspace, labels: PeriodLabels): ReportResult {
  if (workspace.claimBatches.error) return { unavailable: 'The claim batches of unpaid invoices could not be loaded.' };
  const debtors = debtorsByFund({
    aging: derived.aging,
    schemeByPatient: workspace.schemeByPatient,
    batches: workspace.claimBatches.rows,
    serviceDateByVisit: workspace.serviceDateByVisit,
    todayKey: labels.todayKey
  });
  const { totals, expiringSoon, unreadableBatches } = debtors;
  const notes = [
    'Only the medical aid portion of unpaid invoices; what patients owe is in Accounts receivable aging.',
    'Past claim deadline: not sent yet and older than the fund\'s deadline, counted from the visit date (the invoice date if the visit could not be read). Funds without a configured deadline are not checked.'
  ];
  if (expiringSoon.count > 0) {
    notes.push(`Not sent and due at the fund within ${DEADLINE_WARNING_DAYS} days: ${pluralize(expiringSoon.count, 'invoice')}, ${formatNad(expiringSoon.amount)}. Send these first.`);
  }
  if (unreadableBatches.count > 0) {
    notes.push(`${pluralize(unreadableBatches.count, 'invoice')} (${formatNad(unreadableBatches.amount)}) belong to a claim batch that could not be read and are shown as sent.`);
  }
  notes.push(DERIVED_NOTE);
  return {
    report: {
      title: 'Debtors by medical aid fund',
      basis: `As at ${labels.today}: unpaid invoices with a medical aid portion`,
      columns: [
        { header: 'Medical aid fund', type: 'text' },
        { header: 'Invoices', type: 'count' },
        { header: 'Not in a batch', type: 'money' },
        { header: 'In a batch, not sent', type: 'money' },
        { header: 'Past claim deadline', type: 'money' },
        { header: 'Sent to fund', type: 'money' },
        { header: 'Owed by fund', type: 'money' },
        { header: 'Claim deadline', type: 'text' }
      ],
      rows: debtors.rows.map(row => [row.fund, row.invoiceCount, row.notBatched, row.inUnsentBatch, row.pastDeadline, row.sent, row.total, row.deadline ?? 'Not configured']),
      totals: ['Total', totals.invoiceCount, totals.notBatched, totals.inUnsentBatch, totals.pastDeadline, totals.sent, totals.total, ''],
      notes
    }
  };
}

/** Visits, billing and collections per treating doctor */
function doctorProductivityReport(workspace: FinanceWorkspace, labels: PeriodLabels): ReportResult {
  if (workspace.visits.error) return { unavailable: 'Visits could not be loaded.' };
  const rows = doctorProductivity(workspace.invoices.rows, workspace.visits.rows, labels.ranges.current);
  const visits = rows.reduce((n, row) => n + row.completedVisits, 0);
  const billed = sumAmounts(rows.map(row => row.billed));
  const collected = sumAmounts(rows.map(row => row.collected));
  const doctorName = (doctorId: string | null) =>
    doctorId ? formatDoctorName(workspace.doctorNames[doctorId], 'Unknown doctor') : 'No doctor recorded';
  return {
    report: {
      title: 'Doctor productivity',
      basis: `Visits and invoices dated ${labels.current}`,
      columns: [
        { header: 'Doctor', type: 'text' },
        { header: 'Visits completed', type: 'count' },
        { header: 'Invoices', type: 'count' },
        { header: 'Billed', type: 'money' },
        { header: 'Collected', type: 'money' },
        { header: 'Billed per visit', type: 'money' },
        { header: 'Collection rate', type: 'percent' }
      ],
      rows: rows.map(row => [doctorName(row.doctorId), row.completedVisits, row.invoiceCount, row.billed, row.collected, row.billedPerVisit, row.collectionRate]),
      totals: [
        'Total', visits, rows.reduce((n, row) => n + row.invoiceCount, 0), billed, collected,
        visits > 0 ? fromCents(Math.round(toCents(billed) / visits)) : null, shareOf(collected, billed)
      ],
      notes: [
        'An invoice counts for the doctor on its visit; if that visit is outside the period or has no doctor, for the doctor who created the invoice. Cancelled invoices are excluded.',
        'Billed and collected follow the invoice date, as in Collections; collected means marked paid. Billed per visit divides billed by the visits completed in the period.',
        DERIVED_NOTE
      ]
    }
  };
}

/** Booked, attended, no-show and cancelled visits per month */
function attendanceReport(workspace: FinanceWorkspace, labels: PeriodLabels): ReportResult {
  if (workspace.visits.error) return { unavailable: 'Visits could not be loaded.' };
  const months = attendanceByMonth(workspace.visits.rows, labels.ranges.current);
  const total = summarizeAttendance(months);
  const notes = [
    'Booked counts every visit on its appointment day (the scheduled date, else the visit date): appointments and walk-ins, as HPMS records both as visits. Attended means completed.',
    `Missed appointments are saved as cancelled with a note starting "${NO_SHOW_NOTE_MARKER}" (the visits table does not accept a no-show status); they count as no-shows, not cancellations.`,
    'No-show and cancellation rates are shares of everything booked in the month.'
  ];
  if (total.open > 0) {
    notes.push(`Not closed: ${pluralize(total.open, 'visit')} still scheduled or in progress. On days that have passed these were never closed and may be unrecorded no-shows.`);
  }
  return {
    report: {
      title: 'Appointments and attendance',
      basis: `Visits dated ${labels.current}; cancelled visits noted "did not attend" count as no-shows`,
      columns: [
        { header: 'Month', type: 'text' },
        { header: 'Booked', type: 'count' },
        { header: 'Attended', type: 'count' },
        { header: 'No-shows', type: 'count' },
        { header: 'Cancelled', type: 'count' },
        { header: 'Not closed', type: 'count' },
        { header: 'No-show rate', type: 'percent' },
        { header: 'Cancellation rate', type: 'percent' }
      ],
      rows: total.booked === 0 ? [] : months.map(row => [
        formatMonthKey(row.monthKey, 'MMMM yyyy'), row.booked, row.attended, row.noShows, row.cancelled, row.open, row.noShowRate, row.cancellationRate
      ]),
      totals: ['Total', total.booked, total.attended, total.noShows, total.cancelled, total.open, total.noShowRate, total.cancellationRate],
      notes
    }
  };
}

const monthList = (rows: StatutoryMonthRow[]): string => rows.map(row => formatMonthKey(row.monthKey)).join(', ');

/** Monthly PAYE, Social Security and pension totals from payslips, for the statutory returns */
function statutoryPayrollReport(workspace: FinanceWorkspace, labels: PeriodLabels): ReportResult {
  if (workspace.payslips.error) return { unavailable: 'Payroll could not be loaded.' };
  if (workspace.payslipLines.error) return { unavailable: 'Payslip lines could not be loaded, so PAYE and Social Security cannot be split out.' };
  const months = statutoryPayrollByMonth(workspace.payslips.rows, workspace.payslipLines.rows, labels.ranges.current);
  const total = (pick: (row: StatutoryMonthRow) => number) => sumAmounts(months.map(pick));
  const payslips = months.reduce((n, row) => n + row.payslips, 0);
  const notes = [
    'Totals from HPMS payslips to help you complete the NamRA PAYE return and the Social Security Commission return. This is not the return itself: check the figures against your payroll records before filing.',
    'Deductions are grouped by their name on the payslip: PAYE or tax; Social Security or SSC; pension, provident or retirement; medical aid. SSC (employer) is the employer contribution lines named Social Security.',
    'Cancelled payslips are excluded; each payslip counts in the month its pay period starts.'
  ];
  const unitemised = months.filter(row => row.unitemisedPayslips > 0);
  if (unitemised.length > 0) {
    const count = unitemised.reduce((n, row) => n + row.unitemisedPayslips, 0);
    notes.push(`${monthList(unitemised)}: ${pluralize(count, 'payslip has', 'payslips have')} deductions but no payslip lines, so their deductions are under Other deductions. Check them before filing.`);
  }
  const unbalanced = months.filter(row => row.difference !== 0);
  if (unbalanced.length > 0) {
    notes.push(`${monthList(unbalanced)}: gross pay less the deductions differs from net pay by ${formatNad(total(row => row.difference))}, so the payslip lines do not add up to the payslip totals.`);
  }
  const employerShort = months.filter(row => row.sscEmployee > 0 && row.sscEmployer < row.sscEmployee);
  if (employerShort.length > 0) {
    notes.push(`${monthList(employerShort)}: the employer's Social Security share is lower than the employees' share because older payslips did not record it. The employer normally pays the same as the employee.`);
  }
  return {
    report: {
      title: 'PAYE, Social Security and pension',
      basis: `Payslips for pay periods starting ${labels.current}`,
      columns: [
        { header: 'Month', type: 'text' },
        { header: 'Payslips', type: 'count' },
        { header: 'Employees', type: 'count' },
        { header: 'Gross pay', type: 'money' },
        { header: 'PAYE', type: 'money' },
        { header: 'SSC (employee)', type: 'money' },
        { header: 'SSC (employer)', type: 'money' },
        { header: 'Pension / provident', type: 'money' },
        { header: 'Medical aid', type: 'money' },
        { header: 'Other deductions', type: 'money' },
        { header: 'Net pay', type: 'money' }
      ],
      rows: payslips === 0 ? [] : months.map(row => [
        formatMonthKey(row.monthKey, 'MMMM yyyy'), row.payslips, row.employees, row.gross, row.paye, row.sscEmployee, row.sscEmployer,
        row.pension, row.medicalAid, row.otherDeductions, row.net
      ]),
      totals: [
        'Total', payslips, null, total(row => row.gross), total(row => row.paye), total(row => row.sscEmployee), total(row => row.sscEmployer),
        total(row => row.pension), total(row => row.medicalAid), total(row => row.otherDeductions), total(row => row.net)
      ],
      notes
    }
  };
}

/** Practice expenses per category (expense type) and month */
function expensesByCategoryReport(derived: FinanceDerived, workspace: FinanceWorkspace, labels: PeriodLabels): ReportResult {
  if (workspace.expenses.error) return { unavailable: 'Practice expenses could not be loaded.' };
  const table = expensesByTypeAndMonth(workspace.expenses.rows, labels.ranges.current);
  const notes = ['Practice overhead from Settings > Practice Overhead, by expense date; the category is the expense type. Cancelled expenses are excluded.'];
  if (derived.expenses && derived.expenses.unpaid > 0) notes.push(`${formatNad(derived.expenses.unpaid)} of these expenses is not paid yet.`);
  notes.push('Staff pay from payslips is not included; see Payroll vs revenue.', DERIVED_NOTE);
  return {
    report: {
      title: 'Expenses by category',
      basis: `Expenses dated ${labels.current}`,
      columns: [
        { header: 'Category', type: 'text' },
        ...table.monthKeys.map(monthKey => ({ header: formatMonthKey(monthKey), type: 'money' as const })),
        { header: 'Total', type: 'money' },
        { header: 'Share', type: 'percent' }
      ],
      rows: table.rows.map(row => [expenseTypeLabel(row.type), ...row.byMonth, row.total, shareOf(row.total, table.total)]),
      totals: ['Total', ...table.monthTotals, table.total, table.rows.length > 0 ? 1 : null],
      notes
    }
  };
}

/** Stock and equipment at cost per category, as at today */
function inventoryValuationReport(derived: FinanceDerived, labels: PeriodLabels): ReportResult {
  if (!derived.inventory) return { unavailable: 'Inventory could not be loaded.' };
  const valuation = derived.inventory;
  return {
    report: {
      title: 'Stock and equipment valuation',
      basis: `As at ${labels.today}: quantity x unit cost`,
      columns: [
        { header: 'Category', type: 'text' },
        { header: 'Items', type: 'count' },
        { header: 'Low stock items', type: 'count' },
        { header: 'Expired (at cost)', type: 'money' },
        { header: 'Value at cost', type: 'money' },
        { header: 'Share', type: 'percent' }
      ],
      rows: valuation.byCategory.map(row => [
        inventoryCategoryLabel(row.category), row.count, row.lowStockCount, row.expiredValue, row.value, shareOf(row.value, valuation.total)
      ]),
      totals: ['Total', valuation.count, valuation.lowStockCount, valuation.expiredValue, valuation.total, valuation.byCategory.length > 0 ? 1 : null],
      notes: [
        `Consumable stock ${formatNad(valuation.stockValue)}; equipment ${formatNad(valuation.equipmentValue)} at cost (no depreciation is recorded in HPMS).`,
        'Value is quantity x unit cost, or the stored value where no unit cost is set. Expired stock is still included at cost.',
        'The item-by-item list is in Ledgers > Inventory (Export CSV).',
        DERIVED_NOTE
      ]
    }
  };
}

export function buildReport(id: ReportId, derived: FinanceDerived, workspace: FinanceWorkspace, labels: PeriodLabels): ReportResult {
  switch (id) {
    case 'daily_takings':
      return { report: dailyTakingsReport(workspace, labels) };
    case 'collections':
      return { report: collectionsReport(derived, labels) };
    case 'ar_aging':
      return { report: arAging(derived, workspace, labels) };
    case 'fund_debtors':
      return fundDebtorsReport(derived, workspace, labels);
    case 'revenue_by_tariff':
      return revenueByTariff(derived, labels);
    case 'payer_mix':
      return { report: payerMixReport(derived, labels) };
    case 'doctor_productivity':
      return doctorProductivityReport(workspace, labels);
    case 'attendance':
      return attendanceReport(workspace, labels);
    case 'payroll_vs_revenue':
      return payrollVsRevenueReport(derived);
    case 'statutory_payroll':
      return statutoryPayrollReport(workspace, labels);
    case 'expenses_by_category':
      return expensesByCategoryReport(derived, workspace, labels);
    case 'inventory_valuation':
      return inventoryValuationReport(derived, labels);
  }
}
