import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { ErrorState, LoadingState } from '../finance/FinanceUI';
import { downloadReportCsv, type ReportTable } from '../finance/financeExport';
import { logReportExport } from '../finance/practiceReports/practiceReportsService';
import { loadScheduledRegister, type ScheduledRegisterData } from '../../services/stock/scheduledRegisterService';
import { MOVEMENT_LABELS } from '../../utils/stock/ledger';
import { buildScheduledRegisters, scriptLine, type MedicineRegister } from '../../utils/stock/scheduledRegister';
import type { StockContext } from './stockContext';
import { SECONDARY, day, errorText, printOrSay } from './stockUi';

/** Every scheduled medicine's register, one after the other, as one table for print and CSV */
function allRegistersTable(registers: readonly MedicineRegister[], from: string, to: string): ReportTable {
  return {
    title: 'Scheduled-medicine register: all scheduled medicines',
    basis: `${day(from)} to ${day(to)}`,
    columns: [
      { header: 'Medicine', type: 'text' },
      { header: 'Date', type: 'date' },
      { header: 'Document', type: 'text' },
      { header: 'Patient or supplier', type: 'text' },
      { header: 'Where', type: 'text' },
      { header: 'Script', type: 'text' },
      { header: 'Prescriber or recorded by', type: 'text' },
      { header: 'Received', type: 'count' },
      { header: 'Issued', type: 'count' },
      { header: 'Balance', type: 'count' }
    ],
    rows: registers.flatMap(({ item, register }) => {
      const name = `${item.name}${item.scheduleLabel ? ` (${item.scheduleLabel})` : ''}`;
      return [
        [name, from, 'Brought forward', null, null, null, null, null, null, register.opening],
        ...register.rows.map(row => [
          name,
          row.occurredOn,
          row.documentRef ?? MOVEMENT_LABELS[row.kind],
          row.party,
          row.where,
          scriptLine(row.script),
          row.script?.prescriber ?? row.by,
          row.received || null,
          row.issued || null,
          row.balance
        ]),
        [name, to, 'Carried forward', null, null, null, null, register.received, register.issued, register.closing]
      ];
    }),
    notes: [
      'From the stock ledger: every receipt and issue of each scheduled medicine in the order recorded, with the balance after each.',
      'Script: the dispensing record the medicine was given on (its number, directions and repeats). Where: the branch of the visit.'
    ]
  };
}

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: ScheduledRegisterData };

/**
 * Stock > Reports > Scheduled register > All scheduled medicines: for a period, every scheduled medicine with its
 * balance brought forward, each receipt and issue (to whom, on which script, prescribed by whom and where) and the
 * balance carried forward. Printable as one register, medicine after medicine.
 */
export const ScheduledRegisterAll: React.FC<{ context: StockContext; from: string; to: string }> = ({ context, from, to }) => {
  const scheduled = useMemo(() => context.items.filter(item => item.isScheduled), [context.items]);
  const itemKey = scheduled.map(item => item.id).sort().join(',');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (from > to) return;
    let cancelled = false;
    setState({ status: 'loading' });
    loadScheduledRegister(context.practiceId, itemKey ? itemKey.split(',') : [], from, to)
      .then(data => !cancelled && setState({ status: 'ready', data }))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', message: errorText(error, 'Could not load the register') }));
    return () => {
      cancelled = true;
    };
  }, [context.practiceId, itemKey, from, to, version]);

  const registers = useMemo(() => {
    if (state.status !== 'ready') return null;
    const supplierNames = new Map(context.suppliers.map(supplier => [supplier.id, supplier.name] as const));
    const deliverySuppliers = new Map([...state.data.deliverySupplierIds].flatMap(([deliveryId, supplierId]) => {
      const name = supplierNames.get(supplierId);
      return name ? [[deliveryId, name] as const] : [];
    }));
    return buildScheduledRegisters({
      items: scheduled.map(item => ({ id: item.id, name: item.name, scheduleLabel: item.scheduleLabel, unit: item.unit })),
      movements: state.data.movements,
      dispensings: state.data.dispensings,
      invoiceVisits: state.data.invoiceVisits,
      visitBranches: state.data.visitBranches,
      patients: state.data.patients,
      staff: context.staffNames,
      deliverySuppliers,
      from,
      to
    });
  }, [state, scheduled, context.suppliers, context.staffNames, from, to]);

  const exportAs = (format: 'csv' | 'print') => {
    if (!registers) return;
    const report = allRegistersTable(registers, from, to);
    if (format === 'print' && !printOrSay(report, context.practiceName)) return;
    if (format === 'csv') downloadReportCsv(report);
    // The register names patients: each print and download is recorded
    void logReportExport(context.practiceId, { report: 'scheduled_register_all', format, range: { startKey: from, endKey: to }, rows: report.rows.length });
  };

  if (from > to) return <p className="text-sm text-gray-500">Choose a period: the first day before the last.</p>;
  if (state.status === 'error') return <ErrorState title="The register could not be loaded" message={state.message} onRetry={() => setVersion(value => value + 1)} />;
  if (!registers) return <LoadingState label="Loading the register" rows={3} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {registers.length === 0 ? 'No scheduled medicine was in stock or moved in this period.' : `${registers.length} scheduled medicine${registers.length === 1 ? '' : 's'} in stock or moved in this period.`}
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={registers.length === 0} onClick={() => exportAs('print')} className={SECONDARY}>
            <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Print all
          </button>
          <button type="button" disabled={registers.length === 0} onClick={() => exportAs('csv')} className={SECONDARY}>
            <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        </div>
      </div>

      {registers.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <caption className="sr-only">Scheduled medicines from {day(from)} to {day(to)}</caption>
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">Medicine</th>
                <th scope="col" className="px-3 py-2 text-right">Brought forward</th>
                <th scope="col" className="px-3 py-2 text-right">In</th>
                <th scope="col" className="px-3 py-2 text-right">Out</th>
                <th scope="col" className="hidden px-3 py-2 text-right md:table-cell">To patients</th>
                <th scope="col" className="px-3 py-2 text-right">Carried forward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registers.map(({ item, register, toPatients }) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">{item.name}{item.scheduleLabel ? ` (${item.scheduleLabel})` : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{register.opening}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{register.received}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{register.issued}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{toPatients}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{register.closing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {registers.map(({ item, register }) => (
        <section key={item.id} aria-label={`Register of ${item.name}`} className="space-y-1">
          <h4 className="text-sm font-semibold text-gray-900">{item.name}{item.scheduleLabel ? ` (${item.scheduleLabel})` : ''}</h4>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">Date</th>
                  <th scope="col" className="px-3 py-2 text-left">Document</th>
                  <th scope="col" className="px-3 py-2 text-left">Patient or supplier</th>
                  <th scope="col" className="hidden px-3 py-2 text-left md:table-cell">Where</th>
                  <th scope="col" className="hidden px-3 py-2 text-left md:table-cell">By</th>
                  <th scope="col" className="px-3 py-2 text-right">In</th>
                  <th scope="col" className="px-3 py-2 text-right">Out</th>
                  <th scope="col" className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-gray-50/60">
                  <td className="px-3 py-2 text-gray-500" colSpan={7}>Brought forward</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{register.opening}</td>
                </tr>
                {register.rows.map(row => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-2">{day(row.occurredOn)}</td>
                    <td className="px-3 py-2">{row.documentRef ?? MOVEMENT_LABELS[row.kind]}</td>
                    <td className="px-3 py-2">
                      {row.party ?? '–'}
                      {row.script && <span className="block text-xs text-gray-500">{scriptLine(row.script)}</span>}
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">{row.where ?? '–'}</td>
                    <td className="hidden px-3 py-2 md:table-cell">{row.script?.prescriber ?? row.by ?? '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.received || ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.issued || ''}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.balance}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <th scope="row" colSpan={5} className="px-3 py-2 text-left">Carried forward</th>
                  <td className="px-3 py-2 text-right tabular-nums">{register.received}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{register.issued}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{register.closing}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
};
