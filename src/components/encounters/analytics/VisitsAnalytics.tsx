import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Area, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCount } from '../../finance/financeFormat';
import { formatDiaryDate, parseDateKey } from '../../../utils/diary/diaryTime';
import { bucketTitle, type CountedGroup, type PeriodRange, type VisitFigures } from '../../../utils/encounters/encounterAnalytics';
import type { VisitFocus } from '../../../utils/encounters/encounterLinks';
import { AnalyticsEmpty, ChartKeys, DashboardSection, InsightTile, RichTooltip } from './AnalyticsParts';
import { COLORS, SLICE_COLORS, visitsText } from './analyticsPalette';

interface VisitsAnalyticsProps {
  figures: VisitFigures;
  range: PeriodRange;
  /** "Last 30 days" */
  periodText: string;
  /** "13 Sep-12 Oct 2026" */
  rangeText: string;
  onOpenVisits: (focus: VisitFocus) => void;
  onOpenDiaryDay: (dayKey: string) => void;
}

/** A chart's figure under the pointer, from recharts' click */
type ChartClick = { activePayload?: Array<{ payload?: { key?: string } }> } | null;

const average = (total: number, parts: number): string => {
  if (parts === 0) return '-';
  const value = total / parts;
  return value < 10 ? value.toFixed(1) : formatCount(Math.round(value));
};

/**
 * Encounters > Analytics > Visits, the middle column: visits per day (or week) with the seen ones, and the visits by
 * practitioner and by visit type. Every point, bar and slice opens what it counts: the day in the diary, or the
 * visits in the encounters list.
 */
export const VisitsAnalytics: React.FC<VisitsAnalyticsProps> = ({ figures, range, periodText, rangeText, onOpenVisits, onOpenDiaryDay }) => {
  const trend = useMemo(() => {
    const seen = new Set(figures.outcomes.seen);
    return figures.buckets.map((bucket) => {
      const day = parseDateKey(bucket.from);
      return {
        key: bucket.from,
        date: day ? format(day, 'd MMM') : bucket.from,
        visits: bucket.ids.length,
        seen: bucket.ids.filter((id) => seen.has(id)).length
      };
    });
  }, [figures]);

  if (figures.ids.length === 0) {
    return (
      <DashboardSection title={figures.unit === 'day' ? 'Daily Visit Trends' : 'Weekly Visit Trends'} icon="solar:calendar-line-duotone">
        <AnalyticsEmpty
          icon="solar:calendar-search-bold-duotone"
          title="No visits in this period"
          message={`Nothing was booked or seen between ${formatDiaryDate(range.from)} and ${formatDiaryDate(range.to)}. Choose a longer date range to look further back.`}
          tall={false}
        />
      </DashboardSection>
    );
  }

  const byDay = figures.unit === 'day';
  const total = figures.ids.length;
  const peak = Math.max(...trend.map((point) => point.visits));
  const seenRate = `${Math.round((figures.outcomes.seen.length / total) * 100)}%`;

  const openBucket = (key: string) => {
    const bucket = figures.buckets.find((item) => item.from === key);
    if (!bucket || bucket.ids.length === 0) return;
    if (byDay) onOpenDiaryDay(bucket.from);
    else onOpenVisits({ label: `Week of ${bucketTitle(bucket, 'week')}`, visitIds: bucket.ids });
  };
  const openGroup = (groups: CountedGroup[]) => (key: string) => {
    const group = groups.find((item) => item.key === key);
    if (group) onOpenVisits({ label: `${group.label}, ${rangeText}`, visitIds: group.ids });
  };
  const openPractitioner = openGroup(figures.byPractitioner);
  const openVisitType = openGroup(figures.byVisitType);
  const groupKeys = (groups: CountedGroup[]) => groups.map((group) => ({ key: group.key, name: group.label, short: group.label, count: group.ids.length }));

  const practitioners = figures.byPractitioner.map((group) => ({ key: group.key, name: group.label, count: group.ids.length }));
  const visitTypes = figures.byVisitType.map((group) => ({ key: group.key, name: group.label, value: group.ids.length }));
  const busiest = figures.byPractitioner[0];
  const commonest = figures.byVisitType[0];

  return (
    <>
      {/* Daily (or weekly) Visits Line Chart */}
      <DashboardSection
        title={byDay ? 'Daily Visit Trends' : 'Weekly Visit Trends'}
        icon="solar:calendar-line-duotone"
        iconColor="from-cyan-500 to-blue-500"
        actions={
          <p className="text-xs text-gray-500">
            Showing {periodText.toLowerCase()} of patient visits. {byDay ? 'Click a day to open it in the diary.' : 'Click a week to list its visits.'}
          </p>
        }
      >
        <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={trend}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              onClick={(state: ChartClick) => {
                const key = state?.activePayload?.[0]?.payload?.key;
                if (key) openBucket(key);
              }}
              style={{ cursor: 'pointer' }}
            >
              <defs>
                <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray[200]} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.gray[600] }} interval={trend.length <= 14 ? 0 : 2} angle={-45} textAnchor="end" height={60} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: COLORS.gray[600] }}
                label={{ value: 'Number of Visits', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: COLORS.gray[700] } }}
              />
              <Tooltip content={<RichTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {/* Area fill for total visits */}
              <Area type="monotone" dataKey="visits" stroke={COLORS.primary} fill="url(#visitGradient)" strokeWidth={0} name="Total Visits Area" legendType="none" />
              {/* Main visits line */}
              <Line type="monotone" dataKey="visits" stroke={COLORS.primary} strokeWidth={3} dot={{ fill: COLORS.primary, r: 4 }} activeDot={{ r: 6 }} name="Total Visits" />
              {/* Seen visits line */}
              <Line type="monotone" dataKey="seen" stroke={COLORS.success} strokeWidth={2} strokeDasharray="5 5" dot={{ fill: COLORS.success, r: 3 }} name="Seen" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ChartKeys
          rows={trend
            .filter((point) => point.visits > 0)
            .map((point) => {
              const bucket = figures.buckets.find((item) => item.from === point.key)!;
              return { key: point.key, name: bucketTitle(bucket, figures.unit), short: point.date, count: point.visits };
            })}
          label={byDay ? 'Visits per day' : 'Visits per week'}
          action={byDay ? 'Open the day in the diary.' : 'Open them in the encounters list.'}
          onOpen={openBucket}
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-600">{byDay ? 'Average Daily' : 'Average Weekly'}</p>
            <p className="text-lg font-semibold text-gray-900">{average(total, trend.length)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">{byDay ? 'Peak Day' : 'Peak Week'}</p>
            <p className="text-lg font-semibold text-gray-900">{formatCount(peak)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Total Period</p>
            <p className="text-lg font-semibold text-gray-900">{formatCount(total)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Seen Rate</p>
            <p className="text-lg font-semibold text-gray-900">{seenRate}</p>
          </div>
        </div>
      </DashboardSection>

      {/* Visits by Practitioner and by Visit Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardSection
          title="Visits by Practitioner"
          icon="solar:stethoscope-bold-duotone"
          iconColor="from-cyan-500 to-blue-500"
          actions={<span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Click a bar to list its visits</span>}
        >
          <div aria-hidden="true">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={practitioners} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray[200]} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.gray[600] }} angle={-45} textAnchor="end" height={80} interval={0} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: COLORS.gray[600] }}
                  label={{ value: 'Visits', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: COLORS.gray[700] } }}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-semibold text-gray-900">{payload[0].payload.name}</p>
                        <p className="text-sm text-gray-600">
                          Visits: <span className="font-medium">{payload[0].value}</span>
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} cursor="pointer" onClick={(_, index) => openPractitioner(practitioners[index].key)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartKeys rows={groupKeys(figures.byPractitioner)} label="Visits by practitioner" action="Open them in the encounters list." onOpen={openPractitioner} />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <InsightTile label="Most Visits" value={busiest.label} note={visitsText(busiest.ids.length)} tone="cyan" />
            <InsightTile label="Practitioners" value={formatCount(figures.byPractitioner.length)} note="This period" tone="blue" />
          </div>
        </DashboardSection>

        <DashboardSection
          title="Visits by Type"
          icon="solar:pie-chart-2-bold-duotone"
          iconColor="from-purple-500 to-indigo-600"
          actions={<span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Click a slice to list its visits</span>}
        >
          <div aria-hidden="true">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={visitTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  cursor="pointer"
                  onClick={(_, index) => openVisitType(visitTypes[index].key)}
                >
                  {visitTypes.map((entry, index) => (
                    <Cell key={entry.key} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-semibold text-gray-900">{payload[0].payload.name}</p>
                        <p className="text-sm text-gray-600">
                          Visits: <span className="font-medium">{payload[0].payload.value}</span>
                        </p>
                        <p className="text-xs text-gray-500">{((payload[0].payload.value / total) * 100).toFixed(1)}% of total</p>
                      </div>
                    ) : null
                  }
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ChartKeys rows={groupKeys(figures.byVisitType)} label="Visits by visit type" action="Open them in the encounters list." onOpen={openVisitType} />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <InsightTile label="Most Common" value={commonest.label} note={`${formatCount(commonest.ids.length)} of ${formatCount(total)} visits`} tone="cyan" />
            <InsightTile label="Visit Types" value={formatCount(figures.byVisitType.length)} note="This period" tone="blue" />
          </div>
        </DashboardSection>
      </div>
    </>
  );
};
