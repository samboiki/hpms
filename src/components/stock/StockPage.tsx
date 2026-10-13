import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { SECTION_COLORS } from '../../config/sectionColors';
import { PageHeader, PageShell } from '../layout/PageHeader';
import { PageTabs, type PageTab } from '../ui/PageTabs';
import { ErrorState, LoadingState } from '../finance/FinanceUI';
import { useStockSettings } from './useStockSettings';
import { useStockData, type StockContext } from './stockContext';
import { StockNotSetUp } from './stockParts';
import { StockItemsTab } from './StockItemsTab';
import { DeliveriesTab } from './DeliveriesTab';
import { StockTakeTab } from './StockTakeTab';
import { StockReportsTab } from './StockReportsTab';
import { SuppliersTab } from './SuppliersTab';
import { StockSettingsTab } from './StockSettingsTab';
import { TransfersTab } from './TransfersTab';
import { useStockStores } from './useStockStores';
import { usesStores } from '../../utils/stock/stores';
import { practiceInventoryLink } from '../billing/invoiceLinks';
import { CARD } from './stockUi';
import { todayKey } from '../../utils/billing/dates';
import { useOptometryPractice } from '../optometry/useOptometryPractice';
import PracticeLabOrders from '../optometry/PracticeLabOrders';
import FramesPanel from '../optometry/FramesPanel';
import OptometryReport from '../optometry/OptometryReport';
import FundNotesPanel from '../optometry/FundNotesPanel';

type StockTab = 'items' | 'deliveries' | 'transfers' | 'count' | 'reports' | 'suppliers' | 'settings' | 'frames' | 'lenses';

const TABS: readonly PageTab<StockTab>[] = [
  { key: 'items', label: 'Items', icon: 'solar:box-bold-duotone' },
  { key: 'deliveries', label: 'Deliveries', icon: 'solar:delivery-bold-duotone' },
  // Only for a practice with more than one store (L10)
  { key: 'transfers', label: 'Transfers', icon: 'solar:transfer-horizontal-bold-duotone' },
  { key: 'count', label: 'Stock take', icon: 'solar:checklist-minimalistic-bold-duotone' },
  // Optometry practices only (the Optometry page merged into Stock, owner 13 Oct 2026): frames with their barcodes and
  // consignment, and lens orders to the lab for a patient (ordered, back from the lab, collected)
  { key: 'frames', label: 'Frames', icon: 'solar:glasses-bold-duotone' },
  { key: 'lenses', label: 'Lens orders', icon: 'solar:eye-bold-duotone' },
  { key: 'reports', label: 'Reports', icon: 'solar:chart-2-bold-duotone' },
  { key: 'suppliers', label: 'Suppliers', icon: 'solar:shop-2-bold-duotone' },
  { key: 'settings', label: 'Settings', icon: 'solar:settings-bold-duotone' }
];

const isTab = (value: string | null): value is StockTab => TABS.some(tab => tab.key === value);

/**
 * Stock: medicines and consumables, deliveries from suppliers, stock takes, the reorder report, valuations and the
 * scheduled-medicine register. Every practice can use it for consumables; dispensing shows in the visit and the
 * patient file once a practice admin switches on "We dispense medicine" (Settings tab).
 */
export const StockPage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { practiceId: contextPracticeId } = usePractice();
  const practiceId = contextPracticeId ?? user?.practice_id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const [tab, setTab] = useState<StockTab>(isTab(requested) ? requested : 'items');
  useEffect(() => {
    if (isTab(requested)) setTab(requested);
  }, [requested]);

  const setup = useStockSettings(practiceId);
  const data = useStockData(practiceId);
  const stores = useStockStores(practiceId, user?.id);
  const hasStores = usesStores(stores.stores);
  const optometry = useOptometryPractice(practiceId) === true;
  const tabs = TABS.filter(entry => (entry.key !== 'transfers' || hasStores) && ((entry.key !== 'frames' && entry.key !== 'lenses') || optometry));
  const shown: StockTab = tabs.some(entry => entry.key === tab) ? tab : 'items';

  const changeTab = (next: StockTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    params.delete('item');
    params.delete('delivery');
    params.delete('supplier');
    params.delete('transfer');
    params.delete('store');
    params.delete('count');
    params.delete('report');
    setSearchParams(params, { replace: true });
  };

  const context = useMemo<StockContext | null>(() => {
    if (!practiceId || setup.status !== 'ready' || data.status !== 'ready') return null;
    return {
      practiceId,
      practiceName: user?.practices?.name || 'Practice',
      role: user?.role ?? null,
      settings: setup.settings,
      items: data.data.items,
      levels: data.data.levels,
      suppliers: data.data.suppliers,
      staffNames: data.data.staffNames,
      stores: stores.stores,
      storeLevels: stores.levels,
      userBranchId: stores.userBranchId,
      reload: () => {
        data.reload();
        stores.reload();
      },
      reloadSettings: setup.reload
    };
  }, [practiceId, setup, data, stores, user?.role, user?.practices?.name]);

  const notSetUp = setup.status === 'not_set_up' || data.status === 'not_set_up';
  const failed = setup.status === 'error' ? setup.message : data.status === 'error' ? data.message : null;

  return (
    <PageShell>
      <PageHeader
        section="stock"
        icon="solar:box-bold-duotone"
        title="Stock"
        subtitle="Medicines and consumables: what came in, what went out, and what is on the shelf."
        actions={context?.settings.dispensingEnabled && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
            <Icon icon="solar:pill-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            This practice dispenses
          </span>
        )}
      />

      {notSetUp ? (
        <div className="space-y-3">
          <StockNotSetUp />
          <p className="text-sm text-gray-600">
            Your current list is in <Link to={practiceInventoryLink()} className="font-medium text-cyan-700 hover:underline">Settings &gt; Practice &gt; Inventory</Link>.
          </p>
        </div>
      ) : failed ? (
        <ErrorState title="Stock could not be loaded" message={failed} onRetry={() => { setup.reload(); data.reload(); }} />
      ) : !context ? (
        <LoadingState label="Loading stock" />
      ) : (
        <>
          <PageTabs tabs={tabs} active={shown} onChange={changeTab} label="Stock sections" activeClassName={SECTION_COLORS.stock.activeTab} />
          <div role="tabpanel" aria-label={tabs.find(item => item.key === shown)?.label}>
            {shown === 'items' && <StockItemsTab context={context} openItemId={searchParams.get('item')} openStore={searchParams.get('store')} />}
            {shown === 'deliveries' && <DeliveriesTab context={context} openDeliveryId={searchParams.get('delivery')} />}
            {shown === 'transfers' && <TransfersTab context={context} openTransfer={searchParams.get('transfer')} storeFilter={searchParams.get('store')} />}
            {shown === 'count' && <StockTakeTab context={context} openCountId={searchParams.get('count')} />}
            {shown === 'reports' && (
              optometry ? (
                <div className="space-y-6">
                  <StockReportsTab context={context} />
                  <section className={`${CARD} p-3 sm:p-5`} aria-label="Optometry reports">
                    <OptometryReport practiceId={context.practiceId} today={todayKey()} initialView={searchParams.get('report')} />
                  </section>
                </div>
              ) : <StockReportsTab context={context} />
            )}
            {shown === 'frames' && (
              <section className={`${CARD} p-3 sm:p-5`}>
                <FramesPanel practiceId={context.practiceId} />
              </section>
            )}
            {shown === 'lenses' && (
              <div className="space-y-6">
                <section className={`${CARD} p-3 sm:p-5`} aria-label="Lens orders">
                  <p className="mb-3 text-sm text-gray-600">
                    Lenses ordered from the lab for a patient, until the patient collects them. A new order is made in the patient&apos;s file
                    (Eyes tab) from their prescription; the lab is one of your suppliers.
                  </p>
                  <PracticeLabOrders practiceId={context.practiceId} today={todayKey()} />
                </section>
                <section className={`${CARD} p-3 sm:p-5`} aria-label="Optical benefit notes">
                  <FundNotesPanel practiceId={context.practiceId} />
                </section>
              </div>
            )}
            {shown === 'suppliers' && <SuppliersTab context={context} openSupplierId={searchParams.get('supplier')} />}
            {shown === 'settings' && <StockSettingsTab context={context} />}
          </div>
        </>
      )}
    </PageShell>
  );
};

export default StockPage;
