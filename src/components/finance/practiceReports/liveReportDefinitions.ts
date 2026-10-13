import type { PeriodLabels } from '../financeNav';
import { formatDateKey } from '../financeFormat';
import type { Tone } from '../FinanceUI';

export type LiveReportId =
  | 'transactions'
  | 'cash_by_practitioner'
  | 'invoices_per_fund'
  | 'fund_patients'
  | 'diagnoses'
  | 'claims_dashboard'
  | 'who_did_what'
  | 'discounts'
  | 'payments_by_age'
  | 'year_to_date'
  | 'report_builder'
  | 'demographics'
  | 'spend_by_town'
  | 'stock_movement'
  | 'gross_profit';

export interface LiveReportDefinition {
  id: LiveReportId;
  title: string;
  /** The question the report answers, in one plain sentence */
  question: string;
  description: string;
  icon: string;
  tone: Tone;
  /** What it covers, on its card */
  basis: (labels: PeriodLabels) => string;
  /** Only the practice's administrators see it (the database refuses anyone else) */
  adminOnly?: boolean;
}

/**
 * Finance > Reports' own reports: they read the period's rows when opened, filter and drill down, and every row opens
 * what it counts. Shown on the same cards as the fixed reports (ReportsTab places them among them).
 */
export const LIVE_REPORTS: Record<LiveReportId, LiveReportDefinition> = {
  transactions: {
    id: 'transactions',
    title: 'Practice transactions',
    question: 'What was invoiced, paid, credited, written off or corrected, and by whom?',
    description: 'Every entry of the period by type and practitioner, as a list or as totals by type and by practitioner',
    icon: 'solar:document-text-bold-duotone',
    tone: 'cyan',
    basis: labels => `Entries dated ${labels.current}`
  },
  cash_by_practitioner: {
    id: 'cash_by_practitioner',
    title: 'Cash flow per practitioner',
    question: 'How much money came in for each practitioner, on the day it came in?',
    description: 'Payments by the day received, split by the practitioner whose work they paid, per payment method',
    icon: 'solar:wad-of-money-bold-duotone',
    tone: 'green',
    basis: labels => `Payments received ${labels.current}`
  },
  fund_patients: {
    id: 'fund_patients',
    title: 'A fund\'s patients with balances',
    question: 'Which patients of a medical aid owe us, and how much?',
    description: 'Choose a fund: its patients with what the fund and they owe, credit not allocated and the oldest debt',
    icon: 'solar:users-group-two-rounded-bold-duotone',
    tone: 'orange',
    basis: labels => `As at ${labels.today}`
  },
  invoices_per_fund: {
    id: 'invoices_per_fund',
    title: 'Invoices per fund',
    question: 'Which invoices did we raise for each medical aid on a day, and have they been claimed?',
    description: 'Per fund for one day or the period: invoices, portions and whether each claim was sent',
    icon: 'solar:shield-check-bold-duotone',
    tone: 'cyan',
    basis: labels => `Invoices dated ${labels.current}`
  },
  claims_dashboard: {
    id: 'claims_dashboard',
    title: 'Claims dashboard',
    question: 'How much did we claim, how much did the funds pay, and how fast?',
    description: 'Claimed against paid per month and fund, days to pay, claims not paid by reason, funds that have not answered',
    icon: 'solar:chart-square-bold-duotone',
    tone: 'indigo',
    basis: labels => `Batches sent ${labels.current}`
  },
  diagnoses: {
    id: 'diagnoses',
    title: 'ICD-10 diagnoses',
    question: 'Which diagnoses did each practitioner treat, as the main diagnosis and on any line?',
    description: 'ICD-10 codes on the period\'s invoices per practitioner: main diagnosis and all codes, in visits and patients',
    icon: 'solar:stethoscope-bold-duotone',
    tone: 'blue',
    basis: labels => `Invoices dated ${labels.current}`
  },
  who_did_what: {
    id: 'who_did_what',
    title: 'Who did what',
    question: 'What did one person post or change in this period?',
    description: 'One staff member\'s invoices, payments, adjustments, patient-file changes, claims, cash-ups and downloads',
    icon: 'solar:user-check-bold-duotone',
    tone: 'violet',
    basis: labels => `${labels.current} · administrators only`,
    adminOnly: true
  },
  discounts: {
    id: 'discounts',
    title: 'Discounts given',
    question: 'Which discounts did we give, why, and for which practitioner?',
    description: 'Every discount of the period, on an invoice or on a line while billing, per practitioner and per reason',
    icon: 'solar:sale-bold-duotone',
    tone: 'green',
    basis: labels => `Discounts dated ${labels.current}`
  },
  payments_by_age: {
    id: 'payments_by_age',
    title: 'Payments by age of debt',
    question: 'Which age of debt did the money we received pay off?',
    description: 'Money received in the period by the age (current to 180+ days) of the invoices it paid, medical aid and patient portions, with money not allocated yet',
    icon: 'solar:hourglass-bold-duotone',
    tone: 'orange',
    basis: labels => `Payments received ${labels.current}`
  },
  year_to_date: {
    id: 'year_to_date',
    title: 'Year to date',
    question: 'What have we billed so far this year, month by month?',
    description: 'From 1 January per tariff code, medical aid fund or practitioner, one column per month, with the year-to-date total and share',
    icon: 'solar:calendar-date-bold-duotone',
    tone: 'indigo',
    basis: labels => `Billed 1 January to ${formatDateKey(labels.ranges.current.endKey)}`
  },
  demographics: {
    id: 'demographics',
    title: 'Demographics and new patients',
    question: 'Who are our patients, and how many new ones did we gain?',
    description: 'Patients by home language, town, region and how they came to us, and new patient files per month, with a list to export',
    icon: 'solar:user-plus-bold-duotone',
    tone: 'blue',
    basis: labels => `Files opened ${labels.current} and every patient on file`
  },
  spend_by_town: {
    id: 'spend_by_town',
    title: 'Spend and patients by town',
    question: 'What does a patient spend on average, and where do our patients live?',
    description: 'What was billed per patient and per town, the average spend per patient and how many patients each town has on file',
    icon: 'solar:map-point-bold-duotone',
    tone: 'amber',
    basis: labels => `Invoices dated ${labels.current}`
  },
  stock_movement: {
    id: 'stock_movement',
    title: 'Stock movement per group',
    question: 'Which stock moves fast, which sits on the shelf, and what did each group use?',
    description: 'Per stock group: value at the start, in, used, adjusted and at the end, with fast and slow movers',
    icon: 'solar:box-minimalistic-bold-duotone',
    tone: 'indigo',
    basis: labels => `Stock ledger ${labels.current}`
  },
  gross_profit: {
    id: 'gross_profit',
    title: 'Gross profit',
    question: 'What did we make on the stock we billed, per item, practitioner and month?',
    description: 'Stock billed against its cost: sales without VAT, cost, gross profit and margin per item, practitioner and month',
    icon: 'solar:money-bag-bold-duotone',
    tone: 'green',
    basis: labels => `Stock billed ${labels.current}`
  },
  report_builder: {
    id: 'report_builder',
    title: 'Build a report',
    question: 'Which invoices, payments or visits match what I need, with only the columns I want?',
    description: 'Choose invoices, payments or visits, the columns, filters and a grouping; save it for the practice and download or print it',
    icon: 'solar:widget-add-bold-duotone',
    tone: 'cyan',
    basis: labels => `${labels.current}, saved reports for the practice`
  }
};

export const isLiveReportId = (value: unknown): value is LiveReportId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(LIVE_REPORTS, value);

/** The names of what each report downloads or prints (report_exports.report), for "who did what" */
export const LIVE_EXPORT_NAMES: Readonly<Record<string, string>> = {
  transactions: 'Practice transactions',
  transactions_by_type: 'Practice transactions by type',
  transactions_by_practitioner: 'Practice transactions by practitioner',
  cash_by_practitioner: 'Cash flow per practitioner',
  cash_by_practitioner_payments: 'Cash flow per practitioner: payments',
  fund_patients: 'A fund\'s patients with balances',
  invoices_per_fund: 'Invoices per fund',
  invoices_per_fund_detail: 'Invoices per fund: invoices',
  claims_per_month: 'Claims dashboard: per month',
  claims_per_fund: 'Claims dashboard: per fund',
  claims_rejection_reasons: 'Claims dashboard: claims not paid, by reason',
  claims_silent_funds: 'Claims dashboard: funds that have not answered',
  diagnoses: 'ICD-10 diagnoses',
  diagnoses_by_practitioner: 'ICD-10 diagnoses by practitioner',
  who_did_what: 'Who did what',
  discounts: 'Discounts given',
  discounts_by_practitioner: 'Discounts given per practitioner',
  discounts_by_reason: 'Discounts given per reason',
  payments_by_age: 'Payments by age of debt',
  payments_by_age_detail: 'Payments by age of debt: every allocation',
  year_to_date_tariff: 'Year to date per tariff code',
  year_to_date_fund: 'Year to date per fund',
  year_to_date_practitioner: 'Year to date per practitioner',
  demographics_new_per_month: 'New patients per month',
  demographics_language: 'Patients by home language',
  demographics_town: 'Patients by town',
  demographics_region: 'Patients by region',
  demographics_source: 'Patients by how they came to us',
  demographics_patients: 'Demographics: patient list',
  spend_by_town: 'Spend and patients by town',
  spend_per_patient: 'Spend per patient',
  stock_movement_groups: 'Stock movement per group',
  stock_movement_fast: 'Stock movement: fast movers',
  stock_movement_slow: 'Stock movement: slow movers',
  gross_profit_items: 'Gross profit per item',
  gross_profit_practitioners: 'Gross profit per practitioner',
  gross_profit_months: 'Gross profit per month',
  gross_profit_lines: 'Gross profit: every line',
  report_builder: 'Build a report',
  // Finance > Batches > Fund statement (claims/FundStatementSheet.tsx)
  fund_statement: 'Statement of outstanding claims per fund'
};
