import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { EmptyState, ErrorState, LoadingState, SectionCard } from '../finance/FinanceUI';
import { downloadReportCsv } from '../finance/financeExport';
import { loadDeliveriesByIds, loadItemMovements, loadPatientNames } from '../../services/stock/stockService';
import { todayKey } from '../../utils/billing/dates';
import { MOVEMENT_LABELS, isTransferMovement } from '../../utils/stock/ledger';
import { buildRegister, type RegisterEntry } from '../../utils/stock/register';
import type { StockMovement } from '../../utils/stock/stockRows';
import { registerTable } from './stockDocuments';
import type { StockContext } from './stockContext';
import { Field } from './stockParts';
import { INPUT, SECONDARY, STOCK_COLOR, day, errorText, printOrSay } from './stockUi';
import { ScheduledRegisterAll } from './ScheduledRegisterAll';

/** The medicine choice that shows every scheduled medicine's register for the period (ScheduledRegisterAll) */
const ALL_MEDICINES = 'all';

/** The scheduled-medicine register of one item: every receipt and issue in a period with the running balance */
export const RegisterReport: React.FC<{ context: StockContext }> = ({ context }) => {
  const scheduled = useMemo(() => context.items.filter(item => item.isScheduled).sort((a, b) => a.name.localeCompare(b.name)), [context.items]);
  const [itemId, setItemId] = useState(scheduled[0]?.id ?? '');
  const today = todayKey();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [entries, setEntries] = useState<RegisterEntry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const item = scheduled.find(entry => entry.id === itemId) ?? null;

  useEffect(() => {
    if (!itemId || itemId === ALL_MEDICINES) return;
    let active = true;
    setEntries(null);
    setFailed(null);
    (async () => {
      const movements = await loadItemMovements(itemId);
      const [patients, deliveries] = await Promise.all([
        loadPatientNames(movements.flatMap(row => (row.patientId ? [row.patientId] : []))),
        loadDeliveriesByIds(movements.flatMap(row => (row.deliveryId ? [row.deliveryId] : [])))
      ]);
      const supplierOf = new Map(deliveries.map(delivery => [delivery.id, context.suppliers.find(supplier => supplier.id === delivery.supplierId)?.name ?? null]));
      const party = (row: StockMovement): string | null =>
        row.patientId ? patients.get(row.patientId) ?? 'Patient' : row.deliveryId ? supplierOf.get(row.deliveryId) ?? null : null;
      const by = (row: StockMovement): string | null => {
        const id = row.practitionerId ?? row.createdBy;
        return id ? context.staffNames.get(id) ?? null : null;
      };
      // Moves between the practice's own stores are neither receipts nor issues (they net to nothing)
      return movements.filter(row => !isTransferMovement(row.kind)).map((row): RegisterEntry => ({
        id: row.id,
        kind: row.kind,
        quantity: row.quantity,
        valueCents: row.valueCents,
        occurredOn: row.occurredOn,
        createdAt: row.createdAt,
        documentRef: row.documentRef,
        party: party(row),
        by: by(row),
        note: [MOVEMENT_LABELS[row.kind], row.reason, row.batchNo ? `batch ${row.batchNo}` : null].filter(Boolean).join('; ')
      }));
    })()
      .then(rows => active && setEntries(rows))
      .catch(error => active && setFailed(errorText(error, 'Could not load the register')));
    return () => {
      active = false;
    };
  }, [itemId, context.staffNames, context.suppliers]);

  const register = useMemo(() => (entries && from <= to ? buildRegister(entries, from, to) : null), [entries, from, to]);
  const table = () => (item && register ? registerTable(item.name, item.scheduleLabel, from, to, register) : null);

  if (scheduled.length === 0) {
    return (
      <EmptyState
        icon="solar:lock-keyhole-bold-duotone"
        title="No scheduled medicines"
        message="Mark an item as a scheduled medicine (open it on the Items tab and change it) to keep its register here."
      />
    );
  }

  return (
    <SectionCard
      title="Scheduled-medicine register"
      subtitle="Every receipt and issue, from the stock ledger, with the balance after each"
      icon="solar:lock-keyhole-bold-duotone"
      tone={STOCK_COLOR.tone}
      actions={itemId === ALL_MEDICINES ? undefined : (
        <div className="flex gap-2">
          <button type="button" disabled={!register} onClick={() => { const report = table(); if (report) printOrSay(report, context.practiceName); }} className={SECONDARY}>
            <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
          <button type="button" disabled={!register} onClick={() => { const report = table(); if (report) downloadReportCsv(report); }} className={SECONDARY}>
            <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        </div>
      )}
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Medicine">
          {props => (
            <select {...props} value={itemId} onChange={event => setItemId(event.target.value)} className={INPUT}>
              <option value={ALL_MEDICINES}>All scheduled medicines</option>
              {scheduled.map(entry => <option key={entry.id} value={entry.id}>{entry.name}{entry.scheduleLabel ? ` (${entry.scheduleLabel})` : ''}</option>)}
            </select>
          )}
        </Field>
        <Field label="From">
          {props => <input {...props} type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className={INPUT} />}
        </Field>
        <Field label="To">
          {props => <input {...props} type="date" value={to} min={from} max={today} onChange={event => setTo(event.target.value)} className={INPUT} />}
        </Field>
      </div>
      {itemId === ALL_MEDICINES ? (
        <ScheduledRegisterAll context={context} from={from} to={to} />
      ) : failed ? (
        <ErrorState title="The register could not be loaded" message={failed} />
      ) : !register ? (
        <LoadingState label="Loading the register" rows={3} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <caption className="sr-only">Register of {item?.name} from {day(from)} to {day(to)}</caption>
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">Date</th>
                <th scope="col" className="px-3 py-2 text-left">Document</th>
                <th scope="col" className="px-3 py-2 text-left">Patient or supplier</th>
                <th scope="col" className="hidden px-3 py-2 text-left md:table-cell">By</th>
                <th scope="col" className="px-3 py-2 text-right">In</th>
                <th scope="col" className="px-3 py-2 text-right">Out</th>
                <th scope="col" className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-gray-50/60">
                <td className="px-3 py-2 text-gray-500" colSpan={6}>Brought forward</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{register.opening}</td>
              </tr>
              {register.rows.map(row => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2">{day(row.occurredOn)}</td>
                  <td className="px-3 py-2">{row.documentRef ?? MOVEMENT_LABELS[row.kind]}</td>
                  <td className="px-3 py-2">{row.party ?? '–'}</td>
                  <td className="hidden px-3 py-2 md:table-cell">{row.by ?? '–'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.received || ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.issued || ''}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.balance}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <th scope="row" colSpan={4} className="px-3 py-2 text-left">Carried forward</th>
                <td className="px-3 py-2 text-right tabular-nums">{register.received}</td>
                <td className="px-3 py-2 text-right tabular-nums">{register.issued}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{register.closing}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </SectionCard>
  );
};

export default RegisterReport;
