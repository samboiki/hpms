import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { SectionCard } from '../finance/FinanceUI';
import { ListSheet } from '../patientLists/ListSheet';
import { loadBranches, saveStore } from '../../services/stock/storeService';
import { canStock, whoCan } from '../../utils/stock/stockRoles';
import { MAIN_STORE, MAIN_STORE_NAME, type StockStore } from '../../utils/stock/stores';
import type { StockContext } from './stockContext';
import { Chip, Field } from './stockParts';
import { INPUT, PRIMARY, QUIET, SECONDARY, STOCK_COLOR, errorText } from './stockUi';

type Branch = { id: string; name: string; isActive: boolean };

/** Add or change a store: its name, the branch whose sales and dispensing come from it, whether it is in use */
const StoreSheet: React.FC<{ context: StockContext; store: StockStore | null; branches: Branch[]; onClose: () => void }> = ({ context, store, branches, onClose }) => {
  const [name, setName] = useState(store?.name ?? '');
  const [branchId, setBranchId] = useState(store?.branchId ?? '');
  const [active, setActive] = useState(store?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Give the store a name.');
      return;
    }
    setSaving(true);
    try {
      await saveStore({ id: store?.id ?? null, practice_id: context.practiceId, name: name.trim(), branch_id: branchId || null, is_active: active });
      toast.success(store ? `${name.trim()} saved.` : `${name.trim()} added. Stock goes there by a delivery or a transfer.`);
      context.reload();
      onClose();
    } catch (error) {
      toast.error(errorText(error, 'Could not save the store.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet
      open
      onClose={onClose}
      title={store ? `Change ${store.name}` : 'Add a store'}
      subtitle="A branch's dispensary or a store room: its stock is kept apart from the main store's."
      dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form="stock-store-form" disabled={saving} className={PRIMARY}>{store ? 'Save store' : 'Add store'}</button>
        </div>
      }
    >
      <form id="stock-store-form" onSubmit={save} className="space-y-4" noValidate>
        <Field label="Name" hint='For example "Ondangwa dispensary" or "Store room".'>
          {props => <input {...props} value={name} onChange={event => setName(event.target.value)} className={INPUT} maxLength={60} autoFocus />}
        </Field>
        <Field label="Serves the branch" hint="Sales and dispensing on visits at that branch come from this store. Leave it empty for a store room.">
          {props => (
            <select {...props} value={branchId} onChange={event => setBranchId(event.target.value)} className={INPUT}>
              <option value="">No branch (a store room)</option>
              {branches.filter(branch => branch.isActive || branch.id === branchId).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          )}
        </Field>
        {store && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
            In use (a store can stop only when it holds nothing and nothing is on the way to or from it)
          </label>
        )}
      </form>
    </ListSheet>
  );
};

/**
 * L10: the practice's stores. With one place nothing about stores shows anywhere else; adding a store brings the
 * store pickers, stock per store and the Transfers tab.
 */
export const StoresCard: React.FC<{ context: StockContext }> = ({ context }) => {
  const canEdit = canStock(context.role, 'settings');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<{ store: StockStore | null } | null>(null);
  useEffect(() => {
    let active = true;
    loadBranches(context.practiceId).then(rows => active && setBranches(rows)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [context.practiceId]);

  const stores = useMemo(() => context.stores.filter(store => store.kind === 'store').sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)), [context.stores]);
  const held = (key: string) => [...(context.storeLevels.get(key)?.values() ?? [])].filter(level => level.onHand !== 0).length;
  const branchName = (id: string | null) => (id ? branches.find(branch => branch.id === id)?.name ?? 'A branch' : null);

  return (
    <SectionCard
      title="Stores"
      subtitle="Keep stock per branch or store room and move it between them"
      icon="solar:buildings-2-bold-duotone"
      tone={STOCK_COLOR.tone}
      actions={canEdit ? (
        <button type="button" onClick={() => setEditing({ store: null })} className={SECONDARY}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Add a store
        </button>
      ) : undefined}
    >
      {stores.length === 0 ? (
        <p className="text-sm text-gray-600">
          All stock is in one place. Add a store when a branch keeps its own stock, or for a store room: each store then has its own on hand,
          deliveries and counts, and stock moves between them with a transfer.{!canEdit ? ` ${whoCan('settings')}` : ''}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              <span className="font-medium text-gray-900">{MAIN_STORE_NAME}</span>
              <span className="block text-xs text-gray-500">Stock not in another store · {held(MAIN_STORE)} items held</span>
            </span>
          </li>
          {stores.map(store => (
            <li key={store.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-gray-900">{store.name}</span>
                {!store.isActive && <span className="ml-2"><Chip tone="gray">Not in use</Chip></span>}
                <span className="block text-xs text-gray-500">
                  {branchName(store.branchId) ? `Serves ${branchName(store.branchId)}` : 'Store room'} · {held(store.id)} items held
                </span>
              </span>
              {canEdit && (
                <button type="button" onClick={() => setEditing({ store })} className={QUIET} aria-label={`Change ${store.name}`}>
                  <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Change
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <StoreSheet context={context} store={editing.store} branches={branches} onClose={() => setEditing(null)} />}
    </SectionCard>
  );
};

export default StoresCard;
