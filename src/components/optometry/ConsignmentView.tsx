import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Chip, Field } from '../stock/stockParts';
import { INPUT, LINK, PRIMARY, QUIET, SECONDARY, day, errorText, nad } from '../stock/stockUi';
import { payablesLink, supplierLink } from '../billing/invoiceLinks';
import { loadConsignment, type ConsignmentData } from '../../services/optometry/optometryReportsService';
import { settleConsignment } from '../../services/optometry/frameUnitsService';
import { toDateKey } from '../../utils/billing/dates';
import { LINE_KIND_LABELS, lineAmounts, onConsignment, owedBySupplier, validateSettle, type SettleDraft, type SupplierOwed } from '../../utils/optometry/consignment';
import { consignmentTable } from './optometryDocuments';
import { BarcodesNotSetUp, ExportButtons, NUM, ReportStatus, TABLE_BOX, TD, TH } from './reportParts';

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'not_set_up' } | { status: 'ready'; data: ConsignmentData };

const SETTLED_SHOWN = 20;

/** The supplier's invoice for consignment frames sold: the chosen lines become its payable */
const SettleSheet: React.FC<{
  practiceId: string;
  today: string;
  owed: SupplierOwed | null;
  supplierName: string;
  frameName: (itemId: string) => string;
  onClose: () => void;
  onSettled: () => void;
}> = ({ practiceId, today, owed, supplierName, frameName, onClose, onSettled }) => {
  const [draft, setDraft] = useState<SettleDraft>({ supplierReference: '', documentDate: today });
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Partial<Record<keyof SettleDraft | 'lines', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!owed) return;
    setDraft({ supplierReference: '', documentDate: today });
    setChosen(new Set(owed.lines.map(line => line.id)));
    setErrors({});
    setFormError(null);
  }, [owed, today]);

  const lines = owed ? owed.lines.filter(line => chosen.has(line.id)) : [];
  const total = lines.reduce((sum, line) => sum + lineAmounts(line).inclCents, 0);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!owed) return;
    const checked = validateSettle(draft, { practiceId, supplierId: owed.supplierId, lines, today });
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError(checked.errors.lines ?? 'Check the marked boxes.');
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const result = await settleConsignment(checked.payload);
      toast.success(result.number
        ? `${result.number} recorded: ${nad(result.totalCents)} owed to ${supplierName} on its account (Stock > Suppliers).`
        : `Added to payables: ${nad(result.totalCents)} for ${supplierName}.`);
      onSettled();
      onClose();
    } catch (failure) {
      setFormError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListSheet
      open={owed !== null}
      onClose={onClose}
      size="lg"
      title={`Supplier's invoice: ${supplierName}`}
      subtitle="Tick the frames the invoice is for. The total is owed on the supplier's account (Stock > Suppliers, where it is paid) and in payables, as a delivery's invoice is."
      dismissible={!busy}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{formError}</p>}
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="optometry-settle-form" className={PRIMARY} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Add {nad(total)} to payables
          </button>
        </div>
      }
    >
      <form id="optometry-settle-form" onSubmit={save} noValidate className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier's invoice number" error={errors.supplierReference}>
            {props => <input {...props} className={INPUT} maxLength={60} value={draft.supplierReference} disabled={busy} onChange={event => setDraft(current => ({ ...current, supplierReference: event.target.value }))} />}
          </Field>
          <Field label="Invoice date" error={errors.documentDate}>
            {props => <input {...props} type="date" className={INPUT} max={today} value={draft.documentDate} disabled={busy} onChange={event => setDraft(current => ({ ...current, documentDate: event.target.value }))} />}
          </Field>
        </div>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {(owed?.lines ?? []).map(line => {
            const amounts = lineAmounts(line);
            return (
              <li key={line.id} className="p-3">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    checked={chosen.has(line.id)}
                    disabled={busy}
                    onChange={() => setChosen(current => {
                      const next = new Set(current);
                      if (next.has(line.id)) next.delete(line.id);
                      else next.add(line.id);
                      return next;
                    })}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900">{frameName(line.itemId)}</span>
                    <span className="block text-xs text-gray-500">
                      {day(line.happenedOn)} · {LINE_KIND_LABELS[line.kind] ?? line.kind} · {line.quantity} x {nad(line.costEachCents)} + VAT
                    </span>
                  </span>
                  <span className="tabular-nums text-gray-900">{nad(amounts.inclCents)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </form>
    </ListSheet>
  );
};

/**
 * Consignment frames: what the practice owes each supplier for their frames sold (or lost), the supplier's frames
 * still on the shelf at the agreed cost, and the invoices already recorded with whether they are paid. The supplier's
 * invoice turns the lines it covers into a payable.
 */
const ConsignmentView: React.FC<{ practiceId: string; today: string }> = ({ practiceId, today }) => {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [settling, setSettling] = useState<SupplierOwed | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadConsignment(practiceId)
      .then(result => !cancelled && setState(result.status === 'ready' ? { status: 'ready', data: result.data } : { status: 'not_set_up' }))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', message: errorText(error, 'Could not read the consignment frames.') }));
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  const view = useMemo(() => {
    if (state.status !== 'ready') return null;
    const { data } = state;
    const suppliers = new Map(data.suppliers.map(supplier => [supplier.id, supplier.name] as const));
    const frames = new Map([...data.catalogue.frames].map(([id, frame]) => [id, frame.name] as const));
    // Invoices recorded: the lines one payable covers, newest first
    const settled = new Map<string, { expenseId: string | null; supplierId: string | null; reference: string | null; on: string; frames: number; inclCents: number }>();
    for (const line of data.lines) {
      if (!line.settledAt) continue;
      const key = line.expenseId ?? `${line.supplierId}-${line.supplierReference}`;
      const entry = settled.get(key) ?? { expenseId: line.expenseId, supplierId: line.supplierId, reference: line.supplierReference, on: toDateKey(line.settledAt) ?? '', frames: 0, inclCents: 0 };
      entry.frames += line.quantity;
      entry.inclCents += lineAmounts(line).inclCents;
      settled.set(key, entry);
    }
    return {
      suppliers,
      frames,
      owed: owedBySupplier(data.lines),
      shelf: onConsignment(data.frames, data.onHand),
      settled: [...settled.values()].sort((a, b) => b.on.localeCompare(a.on)),
      payables: data.payables
    };
  }, [state]);

  if (!view) {
    return (
      <ReportStatus
        status={state.status === 'ready' ? 'loading' : state.status}
        message={state.status === 'error' ? state.message : undefined}
        onRetry={() => setVersion(value => value + 1)}
        notSetUp={<BarcodesNotSetUp />}
      />
    );
  }
  const supplierName = (id: string | null) => (id ? view.suppliers.get(id) ?? 'Supplier' : 'No supplier named');
  const owedTotal = view.owed.reduce((sum, entry) => sum + entry.inclCents, 0);

  return (
    <div className="space-y-4">
      <section aria-label="Owed to suppliers" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900">Owed for consignment frames sold: {nad(owedTotal)} incl. VAT</h4>
          {view.owed.length > 0 && <ExportButtons practiceId={practiceId} table={() => consignmentTable(view.owed, today, { suppliers: view.suppliers, frames: view.frames })} />}
        </div>
        {view.owed.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing is owed: no consignment frame has been sold since the last supplier invoice.</p>
        ) : (
          <div className={TABLE_BOX}>
            <table className="w-full min-w-[26rem]">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className={TH}>Supplier</th>
                  <th scope="col" className={`${TH} text-right`}>Frames</th>
                  <th scope="col" className={`${TH} text-right`}>Owed incl. VAT</th>
                  <th scope="col" className={TH}><span className="sr-only">Record the invoice</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {view.owed.map(entry => (
                  <tr key={entry.supplierId ?? 'none'}>
                    <td className={TD}>
                      {entry.supplierId ? <Link to={supplierLink(entry.supplierId)} className={LINK}>{supplierName(entry.supplierId)}</Link> : supplierName(null)}
                      <span className="block text-xs text-gray-500">Since {day(entry.lines[0]?.happenedOn ?? '')}</span>
                    </td>
                    <td className={NUM}>{entry.frames}</td>
                    <td className={NUM}>{nad(entry.inclCents)}</td>
                    <td className={`${TD} text-right`}>
                      <button type="button" className={QUIET} disabled={!entry.supplierId} onClick={() => setSettling(entry)}>
                        Supplier&apos;s invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Suppliers' frames on the shelf" className="space-y-1">
        <h4 className="text-sm font-semibold text-gray-900">Suppliers&apos; frames on the shelf</h4>
        {view.shelf.length === 0 ? (
          <p className="text-sm text-gray-500">No consignment frame is on the shelf.</p>
        ) : (
          <div className={TABLE_BOX}>
            <table className="w-full min-w-[20rem]">
              <thead className="bg-gray-50"><tr><th scope="col" className={TH}>Supplier</th><th scope="col" className={`${TH} text-right`}>Frames</th><th scope="col" className={`${TH} text-right`}>At the agreed cost</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {view.shelf.map(entry => (
                  <tr key={entry.supplierId ?? 'none'}><td className={TD}>{supplierName(entry.supplierId)}</td><td className={NUM}>{entry.frames}</td><td className={NUM}>{nad(entry.costCents)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500">Not the practice&apos;s stock: owed only once sold. Excl. VAT.</p>
      </section>

      {view.settled.length > 0 && (
        <section aria-label="Supplier invoices recorded" className="space-y-1">
          <h4 className="text-sm font-semibold text-gray-900">Supplier invoices recorded</h4>
          <div className={TABLE_BOX}>
            <table className="w-full min-w-[26rem]">
              <thead className="bg-gray-50"><tr><th scope="col" className={TH}>Recorded</th><th scope="col" className={TH}>Supplier and invoice</th><th scope="col" className={`${TH} text-right`}>Incl. VAT</th><th scope="col" className={TH}>Payable</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {view.settled.slice(0, SETTLED_SHOWN).map(entry => {
                  const status = entry.expenseId ? view.payables.get(entry.expenseId) ?? null : null;
                  return (
                    <tr key={entry.expenseId ?? `${entry.supplierId}-${entry.reference}`}>
                      <td className={`${TD} whitespace-nowrap`}>{day(entry.on)}</td>
                      <td className={TD}>
                        {/* The supplier's account: this invoice with the rest of what is owed to them, paid from there */}
                        {entry.supplierId ? <Link to={supplierLink(entry.supplierId)} className={LINK}>{supplierName(entry.supplierId)}</Link> : supplierName(null)}
                        <span className="block text-xs text-gray-500">{entry.reference ?? ''} · {entry.frames} frame{entry.frames === 1 ? '' : 's'}</span>
                      </td>
                      <td className={NUM}>{nad(entry.inclCents)}</td>
                      <td className={TD}>
                        {status === 'paid' ? <Chip tone="green">Paid</Chip> : (
                          <Link to={entry.supplierId ? supplierLink(entry.supplierId) : payablesLink()} className={LINK}>{status ? 'Not paid yet' : 'Payables'}</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SettleSheet
        practiceId={practiceId}
        today={today}
        owed={settling}
        supplierName={supplierName(settling?.supplierId ?? null)}
        frameName={itemId => view.frames.get(itemId) ?? 'Frame'}
        onClose={() => setSettling(null)}
        onSettled={() => setVersion(value => value + 1)}
      />
    </div>
  );
};

export default ConsignmentView;
