import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { DataTable, type TableColumn } from '../finance/DataTable';
import { EmptyState } from '../finance/FinanceUI';
import { ListSheet } from '../patientLists/ListSheet';
import { payablesLink, stockDeliveryLink } from '../billing/invoiceLinks';
import { loadDeliveries, loadPayableStatuses, saveSupplier } from '../../services/stock/stockService';
import { isSupplierLedgerNotSetUp, loadSupplierAddress } from '../../services/stock/supplierLedgerService';
import { todayKey } from '../../utils/billing/dates';
import type { Delivery, Supplier } from '../../utils/stock/stockRows';
import { openInvoices, supplierAccount, type SupplierAccount, type SupplierLedgerData } from '../../utils/stock/supplierLedger';
import { PaySupplierSheet } from './PaySupplierSheet';
import { SupplierAccountSection } from './SupplierAccountSection';
import type { LoadState, StockContext } from './stockContext';
import { Chip, Field } from './stockParts';
import { INPUT, LINK, PRIMARY, SECONDARY, day, errorText, nad } from './stockUi';
import { useSupplierLedger } from './useSupplierLedger';

interface SupplierDraft {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  accountNumber: string;
  vatNumber: string;
  paymentTermsDays: string;
  notes: string;
  isActive: boolean;
  postalAddress: string;
}

const ADDRESS_FAILED = 'The postal address kept for this supplier could not be read, so saving now would remove it. Close the supplier and open it again.';

const draftOf = (supplier: Supplier | null): SupplierDraft => ({
  name: supplier?.name ?? '',
  contactName: supplier?.contactName ?? '',
  phone: supplier?.phone ?? '',
  email: supplier?.email ?? '',
  accountNumber: supplier?.accountNumber ?? '',
  vatNumber: supplier?.vatNumber ?? '',
  paymentTermsDays: String(supplier?.paymentTermsDays ?? 30),
  notes: supplier?.notes ?? '',
  isActive: supplier?.isActive ?? true,
  postalAddress: ''
});

/**
 * A supplier's details (any staff member can keep them) and, for a saved supplier, its account in the creditors ledger
 * (L12: SupplierAccountSection); before the ledger is set up, its deliveries and payables as before.
 */
const SupplierSheet: React.FC<{
  context: StockContext;
  supplier: Supplier | null;
  ledger: LoadState<SupplierLedgerData>;
  onLedgerChanged: () => void;
  onClose: () => void;
  onSaved: () => void;
}> = ({ context, supplier, ledger, onLedgerChanged, onClose, onSaved }) => {
  const [draft, setDraft] = useState<SupplierDraft>(() => draftOf(supplier));
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ deliveries: Delivery[]; owedCents: number; creditCents: number } | null>(null);
  const [paying, setPaying] = useState<SupplierAccount | null>(null);
  // The postal address is sent back with every save, so a saved supplier shows the field only once it was read
  const [address, setAddress] = useState<'loading' | 'ready' | 'not_set_up' | 'failed'>(supplier ? 'loading' : 'ready');
  const set = (changes: Partial<SupplierDraft>) => setDraft(current => ({ ...current, ...changes }));
  const ledgerData = ledger.status === 'ready' ? ledger.data : null;
  const legacy = ledger.status === 'not_set_up' || ledger.status === 'error';
  const showAddress = supplier ? address === 'ready' : ledger.status === 'ready';

  useEffect(() => {
    if (!supplier) return;
    let active = true;
    loadSupplierAddress(supplier.id)
      .then(value => {
        if (!active) return;
        setDraft(current => ({ ...current, postalAddress: value ?? '' }));
        setAddress('ready');
      })
      .catch((error: unknown) => {
        if (active) setAddress(isSupplierLedgerNotSetUp(error) ? 'not_set_up' : 'failed');
      });
    return () => {
      active = false;
    };
  }, [supplier]);

  useEffect(() => {
    if (!supplier || !legacy) return;
    let active = true;
    (async () => {
      const deliveries = await loadDeliveries(context.practiceId, { supplierId: supplier.id, limit: 100 });
      const payables = await loadPayableStatuses(deliveries.flatMap(row => (row.expenseId && !row.reversedAt ? [row.expenseId] : [])));
      const owedCents = deliveries.reduce((sum, row) => {
        const status = row.expenseId ? payables.get(row.expenseId)?.status : undefined;
        return row.kind === 'received' && !row.reversedAt && status && status !== 'paid' && status !== 'cancelled' ? sum + row.inclVatCents : sum;
      }, 0);
      const creditCents = deliveries.reduce((sum, row) => (row.kind === 'returned' && !row.reversedAt ? sum + row.inclVatCents : sum), 0);
      if (active) setHistory({ deliveries, owedCents, creditCents });
    })().catch(error => toast.error(errorText(error)));
    return () => {
      active = false;
    };
  }, [context.practiceId, supplier, legacy]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error('Give the supplier a name.');
      return;
    }
    if (!/^\d{1,3}$/.test(draft.paymentTermsDays.trim()) || Number(draft.paymentTermsDays) > 365) {
      toast.error('Payment terms are a number of days, 0 to 365.');
      return;
    }
    if (supplier && (address === 'loading' || address === 'failed')) {
      toast.error(address === 'loading' ? 'One moment: the supplier is still loading.' : ADDRESS_FAILED);
      return;
    }
    setSaving(true);
    try {
      await saveSupplier({
        id: supplier?.id ?? null,
        practice_id: context.practiceId,
        name: draft.name.trim(),
        contact_name: draft.contactName.trim() || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        account_number: draft.accountNumber.trim() || null,
        vat_number: draft.vatNumber.trim() || null,
        payment_terms_days: Number(draft.paymentTermsDays),
        notes: draft.notes.trim() || null,
        is_active: draft.isActive,
        ...(showAddress ? { postal_address: draft.postalAddress.trim() || null } : {})
      });
      toast.success(`${draft.name.trim()} saved.`);
      onSaved();
    } catch (error) {
      toast.error(errorText(error, 'Could not save the supplier.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet
      open
      onClose={onClose}
      title={supplier ? supplier.name : 'Add a supplier'}
      subtitle={supplier ? 'Details, deliveries and what is owed' : 'Wholesaler, laboratory or frame supplier'}
      size="lg"
      dismissible={!saving && !paying}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Close</button>
          <button type="submit" form="stock-supplier-form" disabled={saving} className={PRIMARY}>{supplier ? 'Save supplier' : 'Add supplier'}</button>
        </div>
      }
    >
      <div className="space-y-6">
        {supplier && ledgerData && (
          <SupplierAccountSection
            context={context}
            supplier={supplier}
            ledger={ledgerData}
            address={showAddress ? draft.postalAddress.trim() || null : null}
            onPay={setPaying}
            onChanged={onLedgerChanged}
          />
        )}
        {supplier && !ledgerData && history && (
          <section aria-label="Deliveries and payables" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Chip tone={history.owedCents > 0 ? 'amber' : 'green'}>Unpaid supplier invoices: {nad(history.owedCents)}</Chip>
              {history.creditCents > 0 && <Chip tone="cyan">Credits for returns: {nad(history.creditCents)}</Chip>}
              <Link to={payablesLink()} className={`${LINK} text-sm`}>Payables in Finance</Link>
            </div>
            {history.deliveries.length === 0 ? (
              <p className="text-sm text-gray-500">No deliveries from this supplier yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {history.deliveries.slice(0, 12).map(row => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <Link to={stockDeliveryLink(row.id)} className={LINK}>{row.number}</Link>
                      <span className="text-gray-500"> · {day(row.documentDate)} · {row.supplierReference}{row.reversedAt ? ' · reversed' : ''}</span>
                    </span>
                    <span className="tabular-nums">{row.kind === 'returned' ? '−' : ''}{nad(row.inclVatCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <form id="stock-supplier-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name" className="sm:col-span-2">
            {props => <input {...props} value={draft.name} onChange={event => set({ name: event.target.value })} className={INPUT} maxLength={120} autoFocus={!supplier} />}
          </Field>
          <Field label="Contact person">
            {props => <input {...props} value={draft.contactName} onChange={event => set({ contactName: event.target.value })} className={INPUT} maxLength={120} />}
          </Field>
          <Field label="Phone">
            {props => <input {...props} value={draft.phone} onChange={event => set({ phone: event.target.value })} className={INPUT} maxLength={40} inputMode="tel" />}
          </Field>
          <Field label="Email">
            {props => <input {...props} value={draft.email} onChange={event => set({ email: event.target.value })} className={INPUT} maxLength={160} inputMode="email" />}
          </Field>
          <Field label="Your account number with them" hint="Printed on orders and payables.">
            {props => <input {...props} value={draft.accountNumber} onChange={event => set({ accountNumber: event.target.value })} className={INPUT} maxLength={60} />}
          </Field>
          <Field label="Their VAT number">
            {props => <input {...props} value={draft.vatNumber} onChange={event => set({ vatNumber: event.target.value })} className={INPUT} maxLength={40} />}
          </Field>
          <Field label="Payment terms (days)" hint="When a delivery's invoice falls due.">
            {props => <input {...props} value={draft.paymentTermsDays} onChange={event => set({ paymentTermsDays: event.target.value })} className={INPUT} inputMode="numeric" />}
          </Field>
          {showAddress && (
            <Field label="Postal address" hint="Printed on its statement and payment advices." className="sm:col-span-2">
              {props => <textarea {...props} value={draft.postalAddress} onChange={event => set({ postalAddress: event.target.value })} className={INPUT} rows={2} maxLength={300} />}
            </Field>
          )}
          {supplier && address === 'failed' && <p className="text-sm text-red-600 sm:col-span-2" role="alert">{ADDRESS_FAILED}</p>}
          <Field label="Notes" className="sm:col-span-2">
            {props => <input {...props} value={draft.notes} onChange={event => set({ notes: event.target.value })} className={INPUT} maxLength={500} />}
          </Field>
          {supplier && (
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
              <input type="checkbox" checked={draft.isActive} onChange={event => set({ isActive: event.target.checked })} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              Still buying from this supplier
            </label>
          )}
        </form>
        {supplier && paying && (
          <PaySupplierSheet
            practiceId={context.practiceId}
            supplier={supplier}
            account={paying}
            onClose={() => setPaying(null)}
            onPaid={() => {
              setPaying(null);
              onLedgerChanged();
            }}
          />
        )}
      </div>
    </ListSheet>
  );
};

/** The supplier master */
export const SuppliersTab: React.FC<{ context: StockContext; openSupplierId: string | null }> = ({ context, openSupplierId }) => {
  const [open, setOpen] = useState<{ supplier: Supplier | null } | null>(null);
  // A linked supplier opens once: saving any supplier reloads the list, which opened the linked one again after it was
  // closed
  const openedLink = useRef<string | null>(null);
  useEffect(() => {
    if (!openSupplierId) {
      openedLink.current = null;
      return;
    }
    if (openedLink.current === openSupplierId) return;
    const supplier = context.suppliers.find(entry => entry.id === openSupplierId);
    if (supplier) {
      openedLink.current = openSupplierId;
      setOpen({ supplier });
    }
  }, [openSupplierId, context.suppliers]);

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of context.items) {
      if (item.preferredSupplierId && item.isActive) counts.set(item.preferredSupplierId, (counts.get(item.preferredSupplierId) ?? 0) + 1);
    }
    return counts;
  }, [context.items]);

  // L12: what each supplier is owed (after its credits) and how much of it is overdue, once the ledger is set up
  const ledger = useSupplierLedger(context.practiceId);
  const ledgerData = ledger.status === 'ready' ? ledger.data : null;
  const owed = useMemo(() => {
    if (!ledgerData) return null;
    const today = todayKey();
    return new Map(context.suppliers.map(supplier => {
      const account = supplierAccount(supplier.id, supplier.paymentTermsDays, ledgerData);
      const overdueCents = openInvoices(account).filter(row => row.dueDate < today).reduce((sum, row) => sum + row.owedCents, 0);
      return [supplier.id, { balanceCents: account.balanceCents, overdueCents }] as const;
    }));
  }, [ledgerData, context.suppliers]);

  const columns: TableColumn<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      render: row => (
        <div>
          <p className="font-medium text-gray-900">{row.name}{!row.isActive && <span className="ml-2 text-xs font-normal text-gray-500">not used</span>}</p>
          <p className="text-xs text-gray-500">{[row.contactName, row.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
        </div>
      )
    },
    { key: 'account', header: 'Your account', hideBelow: 'md', render: row => row.accountNumber ?? '–' },
    { key: 'terms', header: 'Terms', hideBelow: 'sm', render: row => `${row.paymentTermsDays} days` },
    ...(owed ? [{
      key: 'owed',
      header: 'Owed',
      align: 'right' as const,
      // Phones and tablets keep the list as it was (it fits): what is owed shows when the supplier is opened
      hideBelow: 'lg' as const,
      render: (row: Supplier) => {
        const account = owed.get(row.id);
        if (!account || (account.balanceCents === 0 && account.overdueCents === 0)) return <span className="text-gray-400">–</span>;
        return (
          <div className="tabular-nums">
            <p className={account.balanceCents < 0 ? 'text-emerald-700' : 'text-gray-900'}>
              {account.balanceCents < 0 ? `${nad(-account.balanceCents)} credit` : nad(account.balanceCents)}
            </p>
            {account.overdueCents > 0 && <p className="text-xs text-red-700">{nad(account.overdueCents)} overdue</p>}
          </div>
        );
      }
    }] : []),
    { key: 'items', header: 'Items from them', align: 'right', render: row => String(itemCounts.get(row.id) ?? 0) }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Suppliers you order from. Deliveries, returns and payables are kept against them.</p>
        <button type="button" onClick={() => setOpen({ supplier: null })} className={PRIMARY}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Add supplier
        </button>
      </div>
      <DataTable
        rows={context.suppliers}
        columns={columns}
        rowKey={row => row.id}
        onRowClick={row => setOpen({ supplier: row })}
        rowLabel={row => `Open ${row.name}`}
        itemLabel="suppliers"
        empty={<EmptyState icon="solar:shop-2-bold-duotone" title="No suppliers yet" message="Add the wholesalers and suppliers you buy from, so deliveries can be recorded against their invoices." />}
      />
      {open && (
        <SupplierSheet
          key={open.supplier?.id ?? 'new'}
          context={context}
          supplier={open.supplier}
          ledger={ledger}
          onLedgerChanged={ledger.reload}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            context.reload();
          }}
        />
      )}
    </div>
  );
};

export default SuppliersTab;
