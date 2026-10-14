import React, { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { normalisePracticeType } from '../../utils/billing/practiceTypeNames';
import type { PaidBy } from '../../utils/billing/lineSplit';
import type { OwnTariffRow } from '../../utils/billing/practiceTariffs';
import {
  loadFundContractRecords,
  loadFundTariffRecords,
  loadInfectionControlStaff,
  loadPracticeTypeId,
  type FundContractRecord,
  type FundTariffRecord
} from '../../services/fundPricingService';
import { loadOwnTariffs, loadTariffPortions } from '../../services/practiceTariffService';
import { loadInvoicingSetup } from '../../services/invoicingSetup';
import { fundOptions, type FundOption, type PracticeTariffRecord } from '../../components/tariffs/tariffAdmin';
import FundSchedulesPanel from '../../components/tariffs/FundSchedulesPanel';
import ScheduleImportPanel from '../../components/tariffs/ScheduleImportPanel';
import FundContractsPanel from '../../components/tariffs/FundContractsPanel';
import PracticeTariffPanel from '../../components/tariffs/PracticeTariffPanel';
import CopaymentPanel from '../../components/billing/CopaymentPanel';
import PromotionsPackagesPanel from '../../components/billingExtras/PromotionsPackagesPanel';
import PracticeTypeNeededNotice from '../../components/settings/PracticeTypeNeededNotice';
import { needsPracticeTypeChoice } from '../../utils/practiceType';
import NamafListNote from '../../components/tariffs/NamafListNote';
import { loadNamafDisciplines, loadPracticeNamaf, type NamafLoad } from '../../services/namafTariffService';
import { withNamafTariffs, type NamafDiscipline } from '../../utils/billing/namafTariffs';

/** The load stops here when the practice has no type: the page then points to Settings instead of an error */
const PRACTICE_TYPE_MISSING = 'The practice type is not set, so its tariff list is unknown.';

type Tab = 'funds' | 'import' | 'contracts' | 'tariff';

interface PageData {
  practiceName: string;
  practiceType: string;
  practiceTypeId: string | null;
  /** The shared list of the practice type (practice_tariffs): imports compare with it */
  tariffRows: PracticeTariffRecord[];
  /** The shared list over the NAMAF benchmark of the practice's discipline: what billing prices from (fund prices compare with it) */
  listRows: PracticeTariffRecord[];
  /** The NAMAF list the practice bills from, and the disciplines an administrator can choose instead */
  namaf: NamafLoad;
  disciplines: NamafDiscipline[];
  /** The practice's own codes (practice_own_tariffs), merged over the shared list on the Practice tariff tab */
  ownTariffs: { rows: OwnTariffRow[]; enabled: boolean };
  /** Who pays new lines of each code; `editable` once invoice lines can keep it (line-portions update) */
  portions: { map: Map<string, PaidBy>; editable: boolean };
  fundRows: FundTariffRecord[];
  fundsEnabled: boolean;
  contracts: FundContractRecord[];
  funds: FundOption[];
  infectionControlStaff: number;
}

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: PageData };

const TARIFF_COLUMNS =
  'id, code, description, price, unit, is_active, effective_from, effective_to, can_be_multiplied, requires_tooth_number, business_rule_formula, example_calculation, notes';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'funds', label: 'Fund prices', icon: 'solar:tag-price-bold-duotone' },
  { key: 'import', label: 'Import a schedule', icon: 'solar:upload-bold-duotone' },
  { key: 'contracts', label: 'Contracts and co-payments', icon: 'solar:diploma-verified-bold-duotone' },
  { key: 'tariff', label: 'Practice tariff', icon: 'solar:list-bold-duotone' }
];

const isTab = (value: string | null): value is Tab => TABS.some(item => item.key === value);

/**
 * Tariffs: the practice tariff of the practice type (NAMAF benchmark) with the practice's own codes and prices, the
 * funds' own prices (for example PSEMAS), contracts priced as a percentage of a schedule, co-payments and levies, and
 * imports of schedule files. Billing uses these through fundPricing.ts: a medical aid patient is billed the fund's
 * price where it has one, everyone else the practice tariff (the practice's own price where it has one).
 * Other screens link straight to a tab with ?tab= (the visit's Billing tab opens the co-payments).
 */
const TariffManagement: React.FC = () => {
  const { user, selectedPracticeId } = useAuthStore();
  const practiceId = selectedPracticeId || user?.practice_id || null;
  const isSuperAdmin = user?.is_super_admin === true;
  const canEditPractice = isSuperAdmin || user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = isTab(requestedTab) ? requestedTab : 'funds';
  const setTab = (next: Tab) =>
    setSearchParams(
      current => {
        const params = new URLSearchParams(current);
        params.set('tab', next);
        return params;
      },
      { replace: true }
    );
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  useEffect(() => {
    if (!practiceId) {
      setLoad({ status: 'error', message: 'No practice is selected. Choose a practice first.' });
      return;
    }
    let cancelled = false;
    const run = async () => {
      const { data: practice, error: practiceError } = await supabase
        .from('practices')
        .select('id, name, practice_type')
        .eq('id', practiceId)
        .maybeSingle();
      // The database's own wording goes to the console; staff get what to do
      if (practiceError) {
        console.error('Tariffs: reading the practice failed', practiceError);
        throw new Error('Could not read the practice. Please refresh the page.');
      }
      // The type's name as the app reads it ('dental_practice' is 'dental': practiceTypeNames.ts); '' when not set
      const practiceType = normalisePracticeType(practice?.practice_type);
      if (!practiceType) throw new Error(PRACTICE_TYPE_MISSING);
      const [practiceTypeId, tariffs, providers, fundLoad, contracts, infectionControlStaff, own, portions, setup, namaf, disciplines] = await Promise.all([
        loadPracticeTypeId(practiceType),
        supabase.from('practice_tariffs_with_types').select(TARIFF_COLUMNS).eq('practice_type_name', practiceType),
        supabase.from('medical_aid_providers').select('name, short_name, medical_aid_reference').order('name'),
        loadFundTariffRecords(practiceType),
        loadFundContractRecords(practiceId),
        loadInfectionControlStaff(practiceId),
        loadOwnTariffs(practiceId),
        loadTariffPortions(practiceId),
        loadInvoicingSetup(),
        loadPracticeNamaf(practiceId, practiceType),
        // The chooser only: without it the list the practice uses is still shown
        loadNamafDisciplines().catch(() => ({ status: 'ready' as const, disciplines: [] as NamafDiscipline[] }))
      ]);
      if (tariffs.error || providers.error || portions.error) console.error('Tariffs: loading failed', tariffs.error ?? providers.error ?? portions.error);
      if (tariffs.error) throw new Error('Could not load the tariff list. Please refresh the page.');
      if (providers.error) throw new Error('Could not load the medical aid funds. Please refresh the page.');
      if (portions.error) throw new Error('Could not read who pays each code. Please refresh the page.');
      return {
        practiceName: practice?.name ?? '',
        practiceType,
        practiceTypeId,
        tariffRows: (tariffs.data ?? []) as PracticeTariffRecord[],
        listRows: withNamafTariffs((tariffs.data ?? []) as PracticeTariffRecord[], namaf.tariffs) as PracticeTariffRecord[],
        namaf,
        disciplines: disciplines.disciplines,
        ownTariffs: own,
        portions: { map: portions.portions, editable: setup.linePortions === true },
        fundRows: fundLoad.rows,
        fundsEnabled: fundLoad.enabled,
        contracts,
        funds: fundOptions(providers.data ?? [], fundLoad.rows),
        infectionControlStaff
      };
    };
    setLoad(current => (current.status === 'ready' ? current : { status: 'loading' }));
    run()
      .then(data => {
        if (!cancelled) setLoad({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'The tariffs could not be loaded.' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, reloadKey]);

  const data = load.status === 'ready' ? load.data : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Tariffs</h1>
          <p className="mt-1 text-gray-600">
            {data
              ? `${data.practiceName ? `${data.practiceName}: ` : ''}the ${data.practiceType} practice tariff, the funds' own prices and contracts`
              : 'The practice tariff, the funds\' own prices and contracts'}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {load.status === 'loading' && (
          <div className="flex items-center justify-center py-16" role="status">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#01b9d4]" />
            <span className="ml-3 text-gray-600">Loading the tariffs...</span>
          </div>
        )}

        {/* Owner, 13 Oct 2026: 'general' or no type matches no price list; the type is chosen in Settings */}
        {(load.status === 'error' && load.message === PRACTICE_TYPE_MISSING) || (data && needsPracticeTypeChoice(data.practiceType)) ? (
          <PracticeTypeNeededNotice />
        ) : null}

        {load.status === 'error' && load.message !== PRACTICE_TYPE_MISSING && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">{load.message}</div>
            <button type="button" onClick={reload} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-red-700 hover:bg-red-100">
              Try again
            </button>
          </div>
        )}

        {data && (
          <>
            {!data.fundsEnabled && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status">
                <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span>
                  Fund prices are not switched on yet: the database change in proposals/2026-10-07-fund-tariffs.sql has not been applied. Until then every
                  patient is billed the practice tariff, as before.
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tariff sections">
              {TABS.map(item => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => setTab(item.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    tab === item.key ? 'bg-[#01b9d4] text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon icon={item.icon} className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>

            <div role="tabpanel" aria-label={TABS.find(item => item.key === tab)?.label}>
              {tab === 'funds' && (
                <FundSchedulesPanel
                  practiceId={practiceId as string}
                  practiceType={data.practiceType}
                  isSuperAdmin={isSuperAdmin}
                  canEditPractice={canEditPractice}
                  funds={data.funds}
                  tariffRows={data.listRows}
                  fundRows={data.fundRows}
                  contracts={data.contracts}
                  onChanged={reload}
                />
              )}
              {tab === 'import' && (
                <ScheduleImportPanel
                  practiceId={practiceId as string}
                  practiceType={data.practiceType}
                  practiceTypeId={data.practiceTypeId}
                  isSuperAdmin={isSuperAdmin}
                  canEditPractice={canEditPractice}
                  fundsEnabled={data.fundsEnabled}
                  funds={data.funds}
                  tariffRows={data.tariffRows}
                  fundRows={data.fundRows}
                  onImported={reload}
                />
              )}
              {tab === 'contracts' && (
                <div className="space-y-6">
                  <FundContractsPanel
                    practiceId={practiceId as string}
                    practiceType={data.practiceType}
                    dental={isDentalPractice(data.practiceType)}
                    canEditPractice={canEditPractice}
                    fundsEnabled={data.fundsEnabled}
                    funds={data.funds}
                    contracts={data.contracts}
                    infectionControlStaff={data.infectionControlStaff}
                    onChanged={reload}
                  />
                  <CopaymentPanel practiceId={practiceId as string} canEdit={canEditPractice} funds={data.funds} />
                  {/* Promotions and prepaid packages (parity D18, D17) */}
                  <PromotionsPackagesPanel practiceId={practiceId as string} canEdit={canEditPractice} />
                </div>
              )}
              {tab === 'tariff' && (
                <div className="space-y-4">
                  {/* Which NAMAF benchmark list the practice bills from, its source and dates (parity E1) */}
                  <NamafListNote
                    practiceId={practiceId as string}
                    practiceType={data.practiceType}
                    canEdit={canEditPractice}
                    namaf={data.namaf}
                    disciplines={data.disciplines}
                    onChanged={reload}
                  />
                  <PracticeTariffPanel
                    practiceType={data.practiceType}
                    tariffRows={data.listRows}
                    practiceId={practiceId as string}
                    canEdit={canEditPractice}
                    ownTariffs={data.ownTariffs}
                    portions={data.portions}
                    onChanged={reload}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TariffManagement;
