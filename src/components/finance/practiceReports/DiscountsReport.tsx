import React, { useMemo, useState } from 'react';
import type { PeriodLabels } from '../financeNav';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import {
  discountGroupTable,
  discountListTable,
  groupDiscounts,
  practitionerKey,
  practitionerKeyLabel,
  reasonKey,
  reasonKeyLabel
} from './discountListing';
import { loadDiscounts } from './discountReportService';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

type View = 'list' | 'practitioner' | 'reason';

const VIEWS = [
  { value: 'list' as const, label: 'Every discount', icon: 'solar:list-bold-duotone' },
  { value: 'practitioner' as const, label: 'Per practitioner', icon: 'solar:users-group-rounded-bold-duotone' },
  { value: 'reason' as const, label: 'Per reason', icon: 'solar:tag-price-bold-duotone' }
];

const EXPORT_KEYS: Record<View, string> = { list: 'discounts', practitioner: 'discounts_by_practitioner', reason: 'discounts_by_reason' };

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  staffNames: Record<string, string>;
}

/** Discounts given (parity R3): per period, practitioner and reason; every discount opens its invoice */
export const DiscountsReport: React.FC<Props> = ({ practiceId, practiceName, labels, staffNames }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadDiscounts(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'Discounts are not set up in this database yet (proposals/2026-10-13-discounts-and-statements.sql).'
  );
  const [view, setView] = useState<View>('list');
  const [who, setWho] = useState('');
  const [why, setWhy] = useState('');
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: data?.patientNames ?? {}, onChanged: retry });

  const items = useMemo(() => data?.items ?? [], [data]);
  const byPractitioner = useMemo(() => groupDiscounts(items, practitionerKey), [items]);
  const byReason = useMemo(() => groupDiscounts(items, reasonKey), [items]);
  const report = useMemo(() => {
    if (!data) return null;
    if (view === 'practitioner') {
      return discountGroupTable({ groups: byPractitioner, title: 'Discounts given per practitioner', header: 'Practitioner', label: key => practitionerKeyLabel(key, staffNames), periodLabel: labels.current });
    }
    if (view === 'reason') {
      return discountGroupTable({ groups: byReason, title: 'Discounts given per reason', header: 'Reason', label: key => reasonKeyLabel(key, data.promotionNames), periodLabel: labels.current });
    }
    const shown = items.filter(item => (!who || practitionerKey(item) === who) && (!why || reasonKey(item) === why));
    const filters = [who ? practitionerKeyLabel(who, staffNames) : null, why ? reasonKeyLabel(why, data.promotionNames) : null].filter(Boolean).join(' · ');
    return discountListTable(shown, `${labels.current}${filters ? ` · ${filters}` : ''}`, staffNames, data.patientNames);
  }, [data, view, who, why, items, byPractitioner, byReason, labels, staffNames]);

  return (
    <>
      <ReportFrame
        title="Discounts given"
        subtitle={`Discounts dated ${labels.current}`}
        icon="solar:sale-bold-duotone"
        tone="green"
        exportKey={EXPORT_KEYS[view]}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ practitioner: who || null, reason: why || null }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'No discounts in this period', hint: 'Discounts given on an invoice (Finance > the invoice > Discount) and line discounts typed while billing appear here.' }}
        onOpen={open}
        resetKey={`${view}|${who}|${why}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Discount views" />
            {view === 'list' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Practitioner" htmlFor="discount-practitioner">
                  <select id="discount-practitioner" className={inputClass} value={who} onChange={event => setWho(event.target.value)}>
                    <option value="">Everyone</option>
                    {byPractitioner.map(group => <option key={group.key} value={group.key}>{practitionerKeyLabel(group.key, staffNames)}</option>)}
                  </select>
                </Field>
                <Field label="Reason" htmlFor="discount-reason-filter">
                  <select id="discount-reason-filter" className={inputClass} value={why} onChange={event => setWhy(event.target.value)}>
                    <option value="">Every reason</option>
                    {byReason.map(group => <option key={group.key} value={group.key}>{reasonKeyLabel(group.key, data?.promotionNames)}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        }
        onRowClick={view === 'list' ? undefined : index => {
          const key = (view === 'practitioner' ? byPractitioner : byReason)[index]?.key;
          if (!key) return;
          if (view === 'practitioner') { setWho(key); setWhy(''); } else { setWhy(key); setWho(''); }
          setView('list');
        }}
        rowLabel={view === 'list' ? undefined : index => {
          const key = (view === 'practitioner' ? byPractitioner : byReason)[index]?.key ?? '';
          return `Show the discounts of ${view === 'practitioner' ? practitionerKeyLabel(key, staffNames) : reasonKeyLabel(key, data?.promotionNames)}`;
        }}
      />
      {element}
    </>
  );
};
