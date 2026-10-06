import {
  accountsPayable,
  buildAgingReport,
  buildFinanceSummary,
  collectionsByMethod,
  expensesByMonth,
  hasUnrecognisedStatus,
  invoiceDateKey,
  isInRange,
  monthlyRevenue,
  payerMix,
  payrollByMonth,
  payrollVsRevenue,
  receivablesByScheme,
  reconcileLineItems,
  revenueByTariffCode,
  summarizeByStatus,
  summarizeCollections,
  summarizeExpenses,
  summarizePayroll,
  summarizeRevenue,
  valueInventory,
  type AgingReport,
  type CollectionsSummary,
  type ExpenseMonthRow,
  type ExpenseSummary,
  type FinanceSummary,
  type InventoryValuation,
  type LineItemReconciliation,
  type MethodCollections,
  type MonthlyRevenueRow,
  type PayablesSummary,
  type PayerMix,
  type PayrollMonthRow,
  type PayrollSummary,
  type PayrollVsRevenueRow,
  type PeriodRanges,
  type RevenueSummary,
  type SchemeReceivable,
  type StatusSummary,
  type TariffRevenueRow
} from '../../services/ledgerService';
import type { FinanceWorkspace } from './financeData';

export interface FinanceContext {
  ranges: PeriodRanges;
  /** Local "today": the as-at date for receivables, payables and inventory */
  todayKey: string;
  /** Month keys (oldest first) for trend charts */
  trendMonths: string[];
}

/**
 * Everything the Finance tabs show, computed once per load. A figure whose source failed to
 * load is null (shown as "unavailable"), never zero.
 */
export interface FinanceDerived {
  revenue: RevenueSummary;
  previousRevenue: RevenueSummary;
  collections: CollectionsSummary;
  previousCollections: CollectionsSummary;
  /** Invoices issued in the selected period, by status */
  statusSummary: StatusSummary;
  monthly: MonthlyRevenueRow[];
  aging: AgingReport;
  schemeReceivables: SchemeReceivable[];
  payerMix: PayerMix;
  tariffs: TariffRevenueRow[] | null;
  reconciliation: LineItemReconciliation | null;
  methods: MethodCollections[];
  payroll: PayrollSummary | null;
  previousPayroll: PayrollSummary | null;
  payrollMonthly: PayrollMonthRow[] | null;
  payrollVsRevenue: PayrollVsRevenueRow[] | null;
  expenses: ExpenseSummary | null;
  previousExpenses: ExpenseSummary | null;
  expensesMonthly: ExpenseMonthRow[] | null;
  payables: PayablesSummary | null;
  inventory: InventoryValuation | null;
  summary: FinanceSummary;
  previousSummary: FinanceSummary;
  /** Invoices whose stored status is not a known status (treated as unpaid) */
  unrecognisedStatusCount: number;
}

export function deriveFinance(workspace: FinanceWorkspace, context: FinanceContext): FinanceDerived {
  const { current, previous } = context.ranges;
  const invoices = workspace.invoices.rows;
  const payslipsOk = !workspace.payslips.error;
  const expensesOk = !workspace.expenses.error;
  const linesOk = !workspace.lineItems.error;

  const revenue = summarizeRevenue(invoices, current);
  const previousRevenue = summarizeRevenue(invoices, previous);
  const aging = buildAgingReport(invoices, context.todayKey);
  const payroll = payslipsOk ? summarizePayroll(workspace.payslips.rows, current) : null;
  const previousPayroll = payslipsOk ? summarizePayroll(workspace.payslips.rows, previous) : null;
  const expenses = expensesOk ? summarizeExpenses(workspace.expenses.rows, current) : null;
  const previousExpenses = expensesOk ? summarizeExpenses(workspace.expenses.rows, previous) : null;
  const payables = expensesOk ? accountsPayable(workspace.expenses.rows, context.todayKey) : null;
  const inventory = workspace.inventory.error ? null : valueInventory(workspace.inventory.rows, context.todayKey);

  const balanceItems = {
    receivables: aging.total,
    payables: payables?.total ?? null,
    inventory: inventory?.total ?? null
  };

  return {
    revenue,
    previousRevenue,
    collections: summarizeCollections(invoices, current),
    previousCollections: summarizeCollections(invoices, previous),
    statusSummary: summarizeByStatus(invoices.filter(inv => isInRange(invoiceDateKey(inv), current))),
    monthly: monthlyRevenue(invoices, context.trendMonths),
    aging,
    schemeReceivables: receivablesByScheme(aging, workspace.schemeByPatient),
    payerMix: payerMix(invoices, current, workspace.schemeByPatient),
    tariffs: linesOk ? revenueByTariffCode(workspace.lineItems.rows, invoices, current) : null,
    reconciliation: linesOk ? reconcileLineItems(workspace.lineItems.rows, invoices, current) : null,
    methods: collectionsByMethod(invoices, current),
    payroll,
    previousPayroll,
    payrollMonthly: payslipsOk ? payrollByMonth(workspace.payslips.rows, context.trendMonths) : null,
    payrollVsRevenue: payslipsOk ? payrollVsRevenue(invoices, workspace.payslips.rows, context.trendMonths) : null,
    expenses,
    previousExpenses,
    expensesMonthly: expensesOk ? expensesByMonth(workspace.expenses.rows, context.trendMonths) : null,
    payables,
    inventory,
    summary: buildFinanceSummary({
      income: revenue.billed,
      practiceExpenses: expenses?.total ?? null,
      payroll: payroll?.gross ?? null,
      ...balanceItems
    }),
    previousSummary: buildFinanceSummary({
      income: previousRevenue.billed,
      practiceExpenses: previousExpenses?.total ?? null,
      payroll: previousPayroll?.gross ?? null,
      ...balanceItems
    }),
    unrecognisedStatusCount: invoices.filter(hasUnrecognisedStatus).length
  };
}
