import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePractice } from '../../contexts/PracticeContext';
import { loadPeriodVisits } from '../../services/encounterAnalyticsService';
import { formatDiaryDateRange } from '../../utils/diary/diaryTime';
import { windhoekClock } from '../../utils/patientLists/listDates';
import {
  ANALYTICS_PERIODS,
  OUTCOME_LABELS,
  periodLabel,
  periodRange,
  summariseVisits,
  VISIT_OUTCOMES,
  type AnalyticsPeriod,
  type VisitOutcome
} from '../../utils/encounters/encounterAnalytics';
import type { AnalyticsView, VisitFocus } from '../../utils/encounters/encounterLinks';
import { AnalyticsEmpty, AnalyticsError, AnalyticsLoading, ColumnHeading, QuickStatTile, type QuickStat } from './analytics/AnalyticsParts';
import { VisitsAnalytics } from './analytics/VisitsAnalytics';
import { DiagnosesAndFollowUps } from './analytics/DiagnosesAndFollowUps';

/**
 * Encounters > Analytics, in the page's own layout (release 645b348): Quick Stats on the left, the header with the
 * views' tab bar and the charts in the middle, the date range on the right (stacked on a phone or tablet). Every
 * figure is counted from the practice's own visits and invoices for the chosen period
 * (src/utils/encounters/encounterAnalytics.ts) and opens what it counts: the diary day, the encounters list showing
 * those visits, or the patient, each with the way back. (October 2026: this page showed invented procedures, a fixed
 * status chart, random scores, made-up gender and age percentages and an "AI" summary, labelled "Live data".)
 */

const VIEWS: ReadonlyArray<{ value: AnalyticsView; label: string; icon: string }> = [
  { value: 'visits', label: 'Visits', icon: 'solar:chart-square-bold-duotone' },
  { value: 'diagnoses', label: 'Diagnoses and follow-ups', icon: 'solar:clipboard-heart-bold-duotone' }
];

// The period on the Total Visits tile: "30D"
const PERIOD_CODES: Record<AnalyticsPeriod, string> = { '7d': '7D', '30d': '30D', '3m': '3M', '6m': '6M' };

// Seen, no-shows and cancelled always show (a zero is worth knowing); the other two only when there are some
const ALWAYS_SHOWN: readonly VisitOutcome[] = ['seen', 'no_show', 'cancelled'];
const OUTCOME_TILES: Record<VisitOutcome, Pick<QuickStat, 'icon' | 'iconColor' | 'hint'>> = {
  seen: { icon: 'solar:check-circle-bold-duotone', iconColor: 'text-green-500', hint: 'Checked in or done' },
  no_show: { icon: 'solar:user-cross-rounded-bold-duotone', iconColor: 'text-amber-500', hint: 'Did not come' },
  cancelled: { icon: 'solar:close-circle-bold-duotone', iconColor: 'text-red-500' },
  not_marked: { icon: 'solar:question-circle-bold-duotone', iconColor: 'text-purple-500', hint: 'Past, never checked in' },
  still_to_come: { icon: 'solar:clock-circle-bold-duotone', iconColor: 'text-indigo-500', hint: 'Booked for today' }
};

export interface AdvancedEncountersDashboardProps {
  view: AnalyticsView;
  period: AnalyticsPeriod;
  onViewChange: (view: AnalyticsView) => void;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  /** Lists these visits in the encounters list */
  onOpenVisits: (focus: VisitFocus) => void;
  /** Opens the diary at a day ('yyyy-MM-dd') */
  onOpenDiaryDay: (dayKey: string) => void;
}

export const AdvancedEncountersDashboard: React.FC<AdvancedEncountersDashboardProps> = ({
  view,
  period,
  onViewChange,
  onPeriodChange,
  onOpenVisits,
  onOpenDiaryDay
}) => {
  const { practiceId, isLoading: practiceLoading } = usePractice();
  const queryClient = useQueryClient();
  // The practice's date (Windhoek), whatever time zone the computer is set to
  const todayKey = windhoekClock(new Date()).dateKey;
  const range = useMemo(() => periodRange(period, todayKey), [period, todayKey]);
  const rangeText = formatDiaryDateRange(range.from, range.to);

  // The period's visits feed the Quick Stats of both views and the Visits view's charts
  const visits = useQuery({
    queryKey: ['encounter-analytics', 'visits', practiceId, range.from, range.to],
    queryFn: () => loadPeriodVisits(practiceId as string, range),
    enabled: !!practiceId,
    staleTime: 60_000
  });
  const figures = useMemo(
    () => (visits.data ? summariseVisits(visits.data.rows, range, todayKey, visits.data.staff) : null),
    [visits.data, range, todayKey]
  );

  // The Date Range card opens its choices over the page
  const [choosingPeriod, setChoosingPeriod] = useState(false);
  const periodButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const periodTitleId = useId();
  const closePeriod = () => {
    setChoosingPeriod(false);
    periodButton.current?.focus();
  };
  useEffect(() => {
    if (!choosingPeriod) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChoosingPeriod(false);
        periodButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [choosingPeriod]);

  const open = (what: string, ids: string[]) => onOpenVisits({ label: `${what}, ${rangeText}`, visitIds: ids });
  const quickStats: QuickStat[] = figures
    ? [
        {
          label: 'Total Visits',
          count: figures.ids.length,
          icon: 'solar:calendar-mark-bold-duotone',
          iconColor: 'text-cyan-500',
          caption: PERIOD_CODES[period],
          onOpen: () => open('All visits', figures.ids)
        },
        ...VISIT_OUTCOMES.filter((outcome) => ALWAYS_SHOWN.includes(outcome) || figures.outcomes[outcome].length > 0).map((outcome) => ({
          label: OUTCOME_LABELS[outcome],
          count: figures.outcomes[outcome].length,
          ...OUTCOME_TILES[outcome],
          onOpen: () => open(OUTCOME_LABELS[outcome], figures.outcomes[outcome])
        }))
      ]
    : [];

  const content = () => {
    if (!practiceId) {
      return practiceLoading ? (
        <AnalyticsLoading label="Loading your practice..." />
      ) : (
        <AnalyticsEmpty icon="solar:chart-2-bold-duotone" title="No practice chosen" message="Analytics count the visits of your practice once you are signed in to one." />
      );
    }
    if (view === 'diagnoses') {
      return <DiagnosesAndFollowUps practiceId={practiceId} range={range} todayKey={todayKey} rangeText={rangeText} onOpenVisits={onOpenVisits} />;
    }
    if (visits.isPending) return <AnalyticsLoading label="Counting the visits..." />;
    if (!figures) {
      return <AnalyticsError title="The visits could not be counted" message="Check the connection and try again." onRetry={() => void visits.refetch()} />;
    }
    return (
      <VisitsAnalytics
        figures={figures}
        range={range}
        periodText={periodLabel(period)}
        rangeText={rangeText}
        onOpenVisits={onOpenVisits}
        onOpenDiaryDay={onOpenDiaryDay}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Quick Stats */}
        <div className="col-span-12 xl:col-span-2 space-y-4">
          <ColumnHeading>Quick Stats</ColumnHeading>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 xl:grid-cols-1">
            {figures
              ? quickStats.map((stat) => <QuickStatTile key={stat.label} {...stat} />)
              : practiceId && visits.isPending
                ? [0, 1, 2].map((index) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4" aria-hidden="true">
                      <div className="animate-pulse motion-reduce:animate-none space-y-2">
                        <div className="h-6 w-6 rounded bg-gray-200" />
                        <div className="h-5 w-12 rounded bg-gray-200" />
                        <div className="h-3 w-16 rounded bg-gray-100" />
                      </div>
                    </div>
                  ))
                : null}
          </div>
        </div>

        {/* Middle Column - Charts (after the date range on a phone or tablet) */}
        <div className="col-span-12 xl:col-span-8 space-y-6 order-last xl:order-none">
          {/* Analytics Header and Navigation Container */}
          <div className="rounded-xl transition-all duration-300 animate-fade-in shadow-glass hover:shadow-lg bg-white border border-gray-200 shadow-sm">
            <div className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">Analytics Performance Insights and Trends</h2>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-800">{periodLabel(period)}</span> ({rangeText}), counted from the practice&apos;s own visits and invoices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void queryClient.invalidateQueries({ queryKey: ['encounter-analytics'] })}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" aria-hidden="true" />
                  Count again
                </button>
              </div>

              <div role="tablist" aria-label="Analytics views" className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {VIEWS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={view === item.value}
                    onClick={() => onViewChange(item.value)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      view === item.value ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon icon={item.icon} className="w-4 h-4 flex-none" aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div role="tabpanel" aria-label={VIEWS.find((item) => item.value === view)?.label} className="space-y-6">
            {content()}
          </div>
        </div>

        {/* Right Column - Filters */}
        <div className="col-span-12 xl:col-span-2 space-y-4">
          <ColumnHeading>Filters</ColumnHeading>
          <button
            ref={periodButton}
            type="button"
            onClick={() => setChoosingPeriod(true)}
            aria-haspopup="dialog"
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <span className="flex items-center justify-between mb-2">
              <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-cyan-500" aria-hidden="true" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" aria-hidden="true" />
            </span>
            <span className="block text-sm font-medium text-gray-900 text-left">Date Range</span>
            <span className="block text-xs text-cyan-600 text-left mt-1">{periodLabel(period)}</span>
          </button>
        </div>
      </div>

      {/* Date Range choices */}
      <AnimatePresence>
        {choosingPeriod && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closePeriod}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={periodTitleId}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 id={periodTitleId} className="text-2xl font-bold text-gray-900">Select Date Range</h3>
                <button
                  ref={closeButton}
                  type="button"
                  onClick={closePeriod}
                  aria-label="Close"
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" aria-hidden="true" />
                </button>
              </div>
              <div className="space-y-3 mb-6">
                {ANALYTICS_PERIODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={period === item.id}
                    className={`w-full px-4 py-3 rounded-xl font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      period === item.id ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => {
                      onPeriodChange(item.id);
                      closePeriod();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
