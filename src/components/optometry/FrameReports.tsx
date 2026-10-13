import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip } from '../stock/stockParts';
import { INPUT, LINK, day, nad } from '../stock/stockUi';
import { invoiceLink, patientEyesLink } from '../billing/invoiceLinks';
import { loadPatientNames, loadStaffNames, loadSuppliers } from '../../services/stock/stockService';
import { loadFrameCatalogue, loadFrameSales, type FrameCatalogue, type FrameSalesData } from '../../services/optometry/optometryReportsService';
import { loadFrameUnits } from '../../services/optometry/frameUnitsService';
import { frameStatusRows, salesBySeller, type FrameStatusRow } from '../../utils/optometry/frameReports';
import { FRAME_UNIT_STATUSES, FRAME_UNIT_STATUS_LABELS, type FrameUnitStatus } from '../../utils/optometry/frameUnits';
import { NOT_KNOWN, frameSalesTable, framesByBarcodeTable, salespeopleTable } from './optometryDocuments';
import { BarcodesNotSetUp, ExportButtons, NUM, ReportStatus, TABLE_BOX, TD, TH } from './reportParts';

const errorMessage = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? error.message : fallback);

type Names = Map<string, string>;

// ---------------------------------------------------------------------------------------------------
// Frames sold in a period (month to date by default), with who sold them
// ---------------------------------------------------------------------------------------------------

type SalesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: FrameSalesData; patients: Names; staff: Names };

export const FrameSalesView: React.FC<{ practiceId: string; from: string; to: string }> = ({ practiceId, from, to }) => {
  const [state, setState] = useState<SalesState>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      const [data, staff] = await Promise.all([loadFrameSales(practiceId, from, to), loadStaffNames(practiceId)]);
      const patients = await loadPatientNames(data.lines.flatMap(line => (line.patientId ? [line.patientId] : [])));
      return { data, staff, patients };
    })()
      .then(result => !cancelled && setState({ status: 'ready', ...result }))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', message: errorMessage(error, 'Could not read the frames sold.') }));
    return () => {
      cancelled = true;
    };
  }, [practiceId, from, to, version]);

  const sellers = useMemo(() => (state.status === 'ready' ? salesBySeller(state.data.lines) : []), [state]);
  if (state.status !== 'ready') return <ReportStatus status={state.status} message={state.status === 'error' ? state.message : undefined} onRetry={() => setVersion(value => value + 1)} />;

  const { data, patients, staff } = state;
  const frames = data.lines.reduce((total, line) => total + line.units, 0);
  const sales = data.lines.reduce((total, line) => total + (line.priceExclCents ?? 0), 0);
  const profit = data.lines.reduce((total, line) => total + (line.profitCents ?? 0), 0);
  const log = { report: 'optometry_frames_sold', from, to };

  return (
    <div className="space-y-4">
      <section aria-label="Frame sales by salesperson" className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900">Frames sold: {frames} · {nad(sales)} excl. VAT · profit {nad(profit)}</h4>
          {sellers.length > 0 && <ExportButtons practiceId={practiceId} table={() => salespeopleTable(sellers, from, to, staff)} />}
        </div>
        {!data.barcodes && <p className="text-xs text-gray-500">Barcodes show here once frame barcodes are set up; until then the salesperson is who billed the frame.</p>}
        {sellers.length === 0 ? (
          <p className="text-sm text-gray-500">No frame was billed in this period.</p>
        ) : (
          <div className={TABLE_BOX}>
            <table className="w-full min-w-[20rem]">
              <thead className="bg-gray-50"><tr><th scope="col" className={TH}>Salesperson</th><th scope="col" className={`${TH} text-right`}>Frames</th><th scope="col" className={`${TH} text-right`}>Sales excl. VAT</th><th scope="col" className={`${TH} text-right`}>Profit</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {sellers.map(row => (
                  <tr key={row.sellerId ?? 'unknown'}><td className={TD}>{row.sellerId ? staff.get(row.sellerId) ?? NOT_KNOWN : NOT_KNOWN}</td><td className={NUM}>{row.frames}</td><td className={NUM}>{nad(row.salesCents)}</td><td className={NUM}>{nad(row.profitCents)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.lines.length > 0 && (
        <section aria-label="Frames sold, one by one" className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900">Each frame sold</h4>
            <ExportButtons practiceId={practiceId} log={log} table={() => frameSalesTable(data.lines, from, to, { patients, staff })} />
          </div>
          <div className={TABLE_BOX}>
            <table className="w-full min-w-[40rem]">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className={TH}>Date</th>
                  <th scope="col" className={TH}>Frame</th>
                  <th scope="col" className={TH}>Patient and invoice</th>
                  <th scope="col" className={`${TH} text-right`}>Price</th>
                  <th scope="col" className={`${TH} text-right`}>Cost</th>
                  <th scope="col" className={`${TH} text-right`}>Profit</th>
                  <th scope="col" className={TH}>Sold by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.lines.map(line => (
                  <tr key={line.invoiceLineId}>
                    <td className={`${TD} whitespace-nowrap`}>{day(line.soldOn)}</td>
                    <td className={TD}>
                      {line.frame}{line.units > 1 ? ` x ${line.units}` : ''}
                      {line.barcodes.length > 0 && <span className="block text-xs text-gray-500">{line.barcodes.join(', ')}</span>}
                      {line.consignment && <span className="block text-xs text-gray-500">Consignment</span>}
                    </td>
                    <td className={TD}>
                      {line.patientId ? <Link to={patientEyesLink(line.patientId)} className={LINK}>{patients.get(line.patientId) ?? 'Patient'}</Link> : '-'}
                      {line.invoiceId && <Link to={invoiceLink(line.invoiceId)} className={`${LINK} block text-xs`}>{line.invoiceNumber ?? 'Invoice'}</Link>}
                    </td>
                    <td className={NUM}>{line.priceExclCents === null ? '-' : nad(line.priceExclCents)}</td>
                    <td className={NUM}>{nad(line.costCents)}</td>
                    <td className={NUM}>{line.profitCents === null ? '-' : nad(line.profitCents)}</td>
                    <td className={TD}>{line.sellerId ? staff.get(line.sellerId) ?? NOT_KNOWN : NOT_KNOWN}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">Prices without VAT. A salesperson is changed on the frame&apos;s barcode (Frames tab).</p>
        </section>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------------
// Every frame by barcode, with its status
// ---------------------------------------------------------------------------------------------------

type BarcodeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_set_up' }
  | { status: 'ready'; rows: FrameStatusRow[]; catalogue: FrameCatalogue; patients: Names; suppliers: Names };

const UNIT_TONES: Readonly<Record<FrameUnitStatus, 'gray' | 'green' | 'amber' | 'red' | 'cyan' | 'violet'>> = {
  in_stock: 'green',
  reserved: 'violet',
  sold: 'gray',
  returned: 'cyan',
  written_off: 'red'
};
const SHOWN_AT_MOST = 500;

export const FramesByBarcodeView: React.FC<{ practiceId: string; today: string }> = ({ practiceId, today }) => {
  const [state, setState] = useState<BarcodeState>({ status: 'loading' });
  const [filter, setFilter] = useState<FrameUnitStatus | 'all'>('in_stock');
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async (): Promise<BarcodeState> => {
      const [units, catalogue, suppliers] = await Promise.all([loadFrameUnits(practiceId), loadFrameCatalogue(practiceId), loadSuppliers(practiceId)]);
      if (units.status === 'not_set_up') return { status: 'not_set_up' };
      const patients = await loadPatientNames(units.data.flatMap(unit => (unit.patientId ? [unit.patientId] : [])));
      return {
        status: 'ready',
        rows: frameStatusRows(units.data, catalogue.frames, today),
        catalogue,
        patients,
        suppliers: new Map(suppliers.map(supplier => [supplier.id, supplier.name] as const))
      };
    })()
      .then(result => !cancelled && setState(result))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', message: errorMessage(error, 'Could not read the frame barcodes.') }));
    return () => {
      cancelled = true;
    };
  }, [practiceId, today, version]);

  const shown = useMemo(() => {
    if (state.status !== 'ready') return [];
    const text = search.trim().toLowerCase();
    return state.rows.filter(row => (filter === 'all' || row.status === filter) && (!text || row.barcode.toLowerCase().includes(text) || row.frame.toLowerCase().includes(text)));
  }, [state, filter, search]);

  if (state.status !== 'ready') {
    return <ReportStatus status={state.status} message={state.status === 'error' ? state.message : undefined} onRetry={() => setVersion(value => value + 1)} notSetUp={<BarcodesNotSetUp />} />;
  }
  const counts = new Map(FRAME_UNIT_STATUSES.map(status => [status, state.rows.filter(row => row.status === status).length] as const));

  return (
    <section aria-label="Frames by barcode" className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex-1 text-sm sm:max-w-sm">
          <span className="mb-1.5 block font-medium text-gray-700">Find a frame</span>
          <input className={INPUT} value={search} onChange={event => setSearch(event.target.value)} placeholder="Scan a barcode, or type a brand or model" autoComplete="off" />
        </label>
        <ExportButtons
          practiceId={practiceId}
          disabled={shown.length === 0}
          log={{ report: 'optometry_frames_by_barcode' }}
          table={() => framesByBarcodeTable(shown, today, { patients: state.patients, suppliers: state.suppliers })}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show frames">
        {(['all', ...FRAME_UNIT_STATUSES] as const).map(option => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={`rounded-full px-3 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${filter === option ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {option === 'all' ? `All (${state.rows.length})` : `${FRAME_UNIT_STATUS_LABELS[option]} (${counts.get(option) ?? 0})`}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">{state.rows.length === 0 ? 'No frame has a barcode yet: frames get one when they are received.' : 'No frame matches.'}</p>
      ) : (
        <div className={TABLE_BOX}>
          <table className="w-full min-w-[34rem]">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className={TH}>Barcode</th>
                <th scope="col" className={TH}>Frame</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>Since</th>
                <th scope="col" className={`${TH} text-right`}>Days in stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.slice(0, SHOWN_AT_MOST).map(row => (
                <tr key={row.unitId}>
                  <td className={`${TD} whitespace-nowrap font-medium tabular-nums`}>{row.barcode}</td>
                  <td className={TD}>
                    {row.frame}
                    {row.consignmentSupplierId && <span className="block text-xs text-gray-500">Consignment: {state.suppliers.get(row.consignmentSupplierId) ?? 'supplier'}</span>}
                  </td>
                  <td className={TD}>
                    <Chip tone={UNIT_TONES[row.status]}>{FRAME_UNIT_STATUS_LABELS[row.status]}</Chip>
                    {row.patientId && (
                      <Link to={patientEyesLink(row.patientId)} className={`${LINK} block text-xs`}>{state.patients.get(row.patientId) ?? 'Patient'}</Link>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {row.since ? day(row.since) : '-'}
                    {row.by && <span className="block text-xs text-gray-500">{row.by}</span>}
                  </td>
                  <td className={NUM}>{row.daysInStock ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {shown.length > SHOWN_AT_MOST && <p className="text-xs text-gray-500">Showing the first {SHOWN_AT_MOST} of {shown.length}; print or CSV has them all.</p>}
    </section>
  );
};
