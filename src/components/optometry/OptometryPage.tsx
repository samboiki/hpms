import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { APP_COLOR } from '../../config/sectionColors';
import { PageHeader, PageShell } from '../layout/PageHeader';
import { PageTabs, type PageTab } from '../ui/PageTabs';
import { LoadingState } from '../finance/FinanceUI';
import { CARD } from '../stock/stockUi';
import { todayKey } from '../../utils/billing/dates';
import { useOptometryPractice } from './useOptometryPractice';
import { OPTOMETRY_PAGE } from './optometryPageHeader';
import PracticeLabOrders from './PracticeLabOrders';
import FramesPanel from './FramesPanel';
import OptometryReport from './OptometryReport';
import FundNotesPanel from './FundNotesPanel';

export type OptometryTab = 'orders' | 'frames' | 'reports' | 'notes';

const TABS: readonly PageTab<OptometryTab>[] = [
  { key: 'orders', label: 'Lab orders', icon: 'solar:delivery-bold-duotone' },
  { key: 'frames', label: 'Frames', icon: 'solar:glasses-bold-duotone' },
  { key: 'reports', label: 'Reports', icon: 'solar:chart-2-bold-duotone' },
  { key: 'notes', label: 'Benefit notes', icon: 'solar:wallet-money-bold-duotone' }
];

const isTab = (value: string | null): value is OptometryTab => TABS.some(tab => tab.key === value);

/**
 * Optometry for the whole practice, outside the patient file: every open lab order, the frames with their barcodes,
 * the optometry reports (job costing, frames sold, frames by barcode, presbyopic patients, consignment) and the
 * optical benefit notes. The same parts as the patient file's practice view (Eyes tab), on their own page. Optometry
 * practices only (isOptometryPractice): the sidebar shows no link to it elsewhere, and the page says so if opened.
 * It opens for the roles that open Stock (OPTOMETRY_FOLLOWS, src/utils/auth/screenAccess.ts; its route in App.tsx and
 * the sidebar), and its money reports only for those that open Finance (OptometryReport).
 */
const OptometryPage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { practiceId: contextPracticeId } = usePractice();
  const practiceId = contextPracticeId ?? user?.practice_id ?? null;
  const optometry = useOptometryPractice(practiceId);
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const [tab, setTab] = useState<OptometryTab>(isTab(requested) ? requested : 'orders');
  useEffect(() => {
    if (isTab(requested)) setTab(requested);
  }, [requested]);
  const today = todayKey();

  const changeTab = (next: OptometryTab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    params.delete('report');
    setSearchParams(params, { replace: true });
  };

  return (
    <PageShell>
      <PageHeader icon={OPTOMETRY_PAGE.icon} title={OPTOMETRY_PAGE.label} subtitle={OPTOMETRY_PAGE.subtitle} />
      {optometry === null ? (
        <LoadingState label="Loading optometry" />
      ) : !optometry || !practiceId ? (
        <section className={`${CARD} p-5 text-sm text-gray-700`} role="status">
          <p className="font-semibold text-gray-900">This page is for optometry practices</p>
          <p className="mt-0.5">Your practice is not set up as an optometry practice, so there are no lab orders or frames to show.</p>
        </section>
      ) : (
        <>
          <PageTabs tabs={TABS} active={tab} onChange={changeTab} label="Optometry sections" activeClassName={APP_COLOR.activeTab} />
          <section className={`${CARD} p-3 sm:p-5`} role="tabpanel" aria-label={TABS.find(item => item.key === tab)?.label}>
            {tab === 'orders' && <PracticeLabOrders practiceId={practiceId} today={today} />}
            {tab === 'frames' && <FramesPanel practiceId={practiceId} />}
            {tab === 'reports' && <OptometryReport practiceId={practiceId} today={today} initialView={searchParams.get('report')} />}
            {tab === 'notes' && <FundNotesPanel practiceId={practiceId} />}
          </section>
        </>
      )}
    </PageShell>
  );
};

export default OptometryPage;
