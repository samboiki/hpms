import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { CARD, LINK } from '../stock/stockUi';
import { optometryLink } from '../billing/invoiceLinks';
import { todayKey } from '../../utils/billing/dates';
import PracticeLabOrders from './PracticeLabOrders';
import FramesPanel from './FramesPanel';
import OptometryReport from './OptometryReport';
import FundNotesPanel from './FundNotesPanel';

type PracticeTab = 'orders' | 'frames' | 'report' | 'notes';
/** The same part on the Optometry page */
const PAGE_TABS = { orders: 'orders', frames: 'frames', report: 'reports', notes: 'notes' } as const;

const TABS: ReadonlyArray<{ key: PracticeTab; label: string; icon: string }> = [
  { key: 'orders', label: 'Open lab orders', icon: 'solar:delivery-bold-duotone' },
  { key: 'frames', label: 'Frames', icon: 'solar:glasses-bold-duotone' },
  { key: 'report', label: 'Report', icon: 'solar:chart-2-bold-duotone' },
  { key: 'notes', label: 'Benefit notes', icon: 'solar:wallet-money-bold-duotone' }
];

/**
 * Optometry for the whole practice: every open lab order, the frames in stock with their status, the optometry report
 * (frames sold, presbyopic patients by age, lab turnaround) and the practice's optical benefit notes per fund.
 */
const OptometryPracticePanel: React.FC<{ practiceId: string }> = ({ practiceId }) => {
  const [tab, setTab] = useState<PracticeTab>('orders');
  const today = todayKey();
  return (
    <section className={`${CARD} p-3 sm:p-5`} aria-label="Optometry for the whole practice">
      <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Optometry for the whole practice">
        {TABS.map(item => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={event => {
              setTab(item.key);
              // On a phone the tab strip scrolls: keep the chosen tab in sight
              event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              tab === item.key ? 'bg-cyan-50 text-cyan-800' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon icon={item.icon} className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={TABS.find(item => item.key === tab)?.label}>
        {tab === 'orders' && <PracticeLabOrders practiceId={practiceId} today={today} />}
        {tab === 'frames' && <FramesPanel practiceId={practiceId} />}
        {tab === 'report' && <OptometryReport practiceId={practiceId} today={today} />}
        {tab === 'notes' && <FundNotesPanel practiceId={practiceId} />}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        <Link to={optometryLink(PAGE_TABS[tab])} className={LINK}>Open on the Optometry page</Link> (also in the menu)
      </p>
    </section>
  );
};

export default OptometryPracticePanel;
