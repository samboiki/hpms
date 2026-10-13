import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { LINK, SECONDARY, nad } from '../stock/stockUi';
import { addDaysToKey, addMonthsToKey, formatServiceDate } from '../../utils/billing/dates';
import { useSeesFinanceFigures } from '../../hooks/useScreenAccess';
import { loadReportData, type ReportData } from '../../services/optometry/optometryService';
import { framesSold, labTurnaround, presbyopiaByAge } from '../../utils/optometry/report';
import { EyesNotSetUp } from './optometryParts';
import ConsignmentView from './ConsignmentView';
import { FrameSalesView, FramesByBarcodeView } from './FrameReports';
import JobCostingView from './JobCostingView';
import PresbyopicList from './PresbyopicList';

/** The summary (below) and the reports that open from it; only some cover a period */
type View = 'summary' | 'jobs' | 'sold' | 'barcodes' | 'presbyopic' | 'consignment';
/** money: the report shows takings, costs or what is owed, so it follows Finance's access (seesFinanceFigures) */
const VIEWS: ReadonlyArray<{ key: View; label: string; period: boolean; money: boolean }> = [
  { key: 'summary', label: 'Summary', period: true, money: false },
  { key: 'jobs', label: 'Job costing', period: true, money: true },
  { key: 'sold', label: 'Frames sold and salespeople', period: true, money: true },
  { key: 'barcodes', label: 'Frames by barcode', period: false, money: false },
  { key: 'presbyopic', label: 'Presbyopic patients', period: false, money: false },
  { key: 'consignment', label: 'Consignment frames', period: false, money: true }
];

const isView = (value: string | null | undefined): value is View => VIEWS.some(entry => entry.key === value);

type Period = 'this_month' | 'last_month' | 'this_year' | 'last_12_months';
const PERIOD_LABELS: Readonly<Record<Period, string>> = {
  this_month: 'This month',
  last_month: 'Last month',
  this_year: 'This year',
  last_12_months: 'Last 12 months'
};

/** The first and last day of a period (both included), from today's date. */
function periodBounds(period: Period, today: string): { from: string; to: string } {
  const monthStart = `${today.slice(0, 8)}01`;
  switch (period) {
    case 'this_month':
      return { from: monthStart, to: today };
    case 'last_month':
      return { from: addMonthsToKey(monthStart, -1), to: addDaysToKey(monthStart, -1) };
    case 'this_year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'last_12_months':
      return { from: addDaysToKey(addMonthsToKey(today, -12), 1), to: today };
  }
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'not_set_up' } | { status: 'ready'; data: ReportData };

const th = 'px-2 py-1.5 text-left text-xs font-medium text-gray-500';
const td = 'px-2 py-1.5 text-sm text-gray-800';
const num = 'px-2 py-1.5 text-right text-sm tabular-nums text-gray-800';

/**
 * The optometry report: frames sold per brand (from the stock ledger), presbyopic patients by age (their latest
 * spectacle prescription has a reading addition) and how long the labs take, with remakes. The Report choice opens
 * job costing, the frames sold with their salespeople (month to date by default), every frame by barcode, the
 * presbyopic patients by name and the consignment frames owed to suppliers.
 */
const OptometryReport: React.FC<{
  practiceId: string;
  today: string;
  /** The report a link asks for (Stock > Reports ?report=, e.g. a consignment invoice's "The frames are in ..."); a money report still needs Finance access */
  initialView?: string | null;
}> = ({ practiceId, today, initialView = null }) => {
  const seesMoney = useSeesFinanceFigures();
  const [chosen, setView] = useState<View>(isView(initialView) ? initialView : 'summary');
  useEffect(() => {
    if (isView(initialView)) setView(initialView);
  }, [initialView]);
  const [period, setPeriod] = useState<Period>('this_month');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const bounds = useMemo(() => periodBounds(period, today), [period, today]);
  const views = VIEWS.filter(entry => seesMoney || !entry.money);
  const view: View = views.some(entry => entry.key === chosen) ? chosen : 'summary';
  // The summary's figures (the presbyopic list uses its prescriptions); the other reports read their own
  const needsSummary = view === 'summary' || view === 'presbyopic';
  const usesPeriod = VIEWS.find(entry => entry.key === view)?.period ?? true;

  useEffect(() => {
    if (!needsSummary) return;
    let cancelled = false;
    setLoad({ status: 'loading' });
    loadReportData(practiceId, bounds.from, bounds.to)
      .then(data => !cancelled && setLoad(data === 'not_set_up' ? { status: 'not_set_up' } : { status: 'ready', data }))
      .catch((error: unknown) => !cancelled && setLoad({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not build the report.' }));
    return () => {
      cancelled = true;
    };
  }, [practiceId, bounds, version, needsSummary]);

  const report = useMemo(() => {
    if (load.status !== 'ready') return null;
    return {
      frames: framesSold(load.data.movements, load.data.frames),
      presbyopia: presbyopiaByAge(load.data.latestRx, today),
      labs: labTurnaround(load.data.orders)
    };
  }, [load, today]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-gray-700" htmlFor="optometry-report-view">Report</label>
        <select
          id="optometry-report-view"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          value={view}
          onChange={event => setView(event.target.value as View)}
        >
          {views.map(option => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
        {usesPeriod && (
          <>
            <label className="text-sm text-gray-700" htmlFor="optometry-report-period">Period</label>
            <select
              id="optometry-report-period"
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              value={period}
              onChange={event => setPeriod(event.target.value as Period)}
            >
              {(Object.keys(PERIOD_LABELS) as Period[]).map(option => (
                <option key={option} value={option}>{PERIOD_LABELS[option]}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500">{formatServiceDate(bounds.from)} to {formatServiceDate(bounds.to)}</span>
          </>
        )}
      </div>

      {needsSummary && load.status === 'loading' && <p className="py-6 text-center text-sm text-gray-500" role="status">Building the report...</p>}
      {needsSummary && load.status === 'not_set_up' && <EyesNotSetUp compact />}
      {needsSummary && load.status === 'error' && (
        <div className="space-y-2 py-4 text-center" role="alert">
          <p className="text-sm text-red-700">{load.message}</p>
          <button type="button" className={SECONDARY} onClick={() => setVersion(value => value + 1)}>Try again</button>
        </div>
      )}

      {view === 'presbyopic' && load.status === 'ready' && <PresbyopicList practiceId={practiceId} latest={load.data.latestRx} today={today} />}
      {view === 'jobs' && <JobCostingView practiceId={practiceId} from={bounds.from} to={bounds.to} />}
      {view === 'sold' && <FrameSalesView practiceId={practiceId} from={bounds.from} to={bounds.to} />}
      {view === 'barcodes' && <FramesByBarcodeView practiceId={practiceId} today={today} />}
      {view === 'consignment' && <ConsignmentView practiceId={practiceId} today={today} />}

      {view === 'summary' && report && (
        <>
          <section aria-label="Frames sold">
            <h4 className="mb-1 text-sm font-semibold text-gray-900">Frames sold: {report.frames.units}</h4>
            {/* "Frames sold" is a money report: for a role kept out of Finance this pressed into nothing */}
            {report.frames.units > 0 && seesMoney && (
              <p className="mb-1 text-xs text-gray-500">
                <button type="button" className={LINK} onClick={() => setView('sold')}>Each frame, with its barcode and who sold it</button>
              </p>
            )}
            {report.frames.rows.length === 0 ? (
              <p className="text-sm text-gray-500">No frame was billed in this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full min-w-[16rem]">
                  {/* The practice's costs follow Finance's access, as every money report here does */}
                  <thead className="bg-gray-50"><tr><th scope="col" className={th}>Brand</th><th scope="col" className={`${th} text-right`}>Frames</th>{seesMoney && <th scope="col" className={`${th} text-right`}>Cost to the practice</th>}</tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.frames.rows.map(row => (
                      <tr key={row.brand}><td className={td}>{row.brand}</td><td className={num}>{row.units}</td>{seesMoney && <td className={num}>{nad(row.costCents)}</td>}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="Presbyopic patients by age">
            <h4 className="mb-1 text-sm font-semibold text-gray-900">
              Presbyopic patients: {report.presbyopia.presbyopic} of {report.presbyopia.withPrescription} with a spectacle prescription
            </h4>
            <p className="mb-1 text-xs text-gray-500">
              By age today; their latest spectacle prescription has a reading addition. All dates, not only this period.{' '}
              <button type="button" className={LINK} onClick={() => setView('presbyopic')}>See them by name</button>
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full min-w-[16rem]">
                <thead className="bg-gray-50"><tr><th scope="col" className={th}>Age</th><th scope="col" className={`${th} text-right`}>Patients</th><th scope="col" className={`${th} text-right`}>Average add</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {report.presbyopia.rows.map(row => (
                    <tr key={row.band}><td className={td}>{row.band}</td><td className={num}>{row.patients}</td><td className={num}>{row.averageAdd === null ? '-' : `+${row.averageAdd.toFixed(2)}`}</td></tr>
                  ))}
                  {report.presbyopia.unknownAge > 0 && (
                    <tr><td className={td}>No date of birth</td><td className={num}>{report.presbyopia.unknownAge}</td><td className={num}>-</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label="Lab turnaround">
            <h4 className="mb-1 text-sm font-semibold text-gray-900">Lab orders placed: {report.labs.orders}</h4>
            {report.labs.orders === 0 ? (
              <p className="text-sm text-gray-500">No lab order was placed in this period.</p>
            ) : (
              <>
                <p className="mb-1 text-xs text-gray-600">
                  Back from the lab: {report.labs.backFromLab}
                  {report.labs.averageDaysAtLab !== null ? ` · on average ${report.labs.averageDaysAtLab} days at the lab (median ${report.labs.medianDaysAtLab})` : ''}
                  {report.labs.averageDaysToCollect !== null ? ` · ${report.labs.averageDaysToCollect} days from order to collection` : ''}
                  {` · remakes ${report.labs.remakes}`}
                  {report.labs.remakeRate !== null ? ` (${report.labs.remakeRate} %)` : ''}
                  {report.labs.cancelled > 0 ? ` · cancelled ${report.labs.cancelled}` : ''}
                </p>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full min-w-[18rem]">
                    <thead className="bg-gray-50"><tr><th scope="col" className={th}>Lab</th><th scope="col" className={`${th} text-right`}>Orders</th><th scope="col" className={`${th} text-right`}>Days at the lab</th><th scope="col" className={`${th} text-right`}>Remakes</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.labs.byLab.map(row => (
                        <tr key={row.lab}><td className={td}>{row.lab}</td><td className={num}>{row.orders}</td><td className={num}>{row.averageDaysAtLab ?? '-'}</td><td className={num}>{row.remakes}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default OptometryReport;
