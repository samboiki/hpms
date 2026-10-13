import React, { useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import * as XLSX from 'xlsx';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { formatNad } from '../../utils/billing/money';
import { isValidDateKey, todayKey } from '../../utils/billing/dates';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import {
  cellText,
  detectLayout,
  outdatedScheduleWarning,
  planScheduleImport,
  readScheduleRows,
  scheduleYear,
  suggestedStartDate,
  type ExistingPrice,
  type ImportStatus,
  type ScheduleMapping,
  type Sheet
} from '../../utils/billing/tariffImport';
import { insertFundTariffs, insertPracticeTariffVersions, type FundTariffRecord } from '../../services/fundPricingService';
import { fundTariffRowsToSave, practiceTariffRowsToSave, type FundOption, type PracticeTariffRecord } from './tariffAdmin';

interface ScheduleImportPanelProps {
  practiceId: string;
  practiceType: string;
  practiceTypeId: string | null;
  isSuperAdmin: boolean;
  canEditPractice: boolean;
  fundsEnabled: boolean;
  funds: readonly FundOption[];
  tariffRows: readonly PracticeTariffRecord[];
  fundRows: readonly FundTariffRecord[];
  onImported: () => void;
}

type Target = 'fund' | 'practice_tariff';
interface LoadedSheet {
  name: string;
  rows: Sheet;
}

const MAX_PREVIEW_ROWS = 300;
const STATUS_LABELS: Record<ImportStatus, string> = {
  new: 'New code',
  changed: 'New price',
  unchanged: 'Same price',
  conflict: 'Conflict',
  skipped: 'Not imported'
};
const STATUS_STYLES: Record<ImportStatus, string> = {
  new: 'bg-emerald-100 text-emerald-800',
  changed: 'bg-cyan-100 text-cyan-800',
  unchanged: 'bg-gray-100 text-gray-600',
  conflict: 'bg-red-100 text-red-700',
  skipped: 'bg-amber-100 text-amber-800'
};
const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#01b9d4]';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';

const columnName = (index: number): string => {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    const rest = (value - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};

/** Reads an xlsx/xls/csv file into sheets of cells. Codes keep their text (no '0190' -> 190 in CSV files). */
async function readWorkbook(file: File): Promise<LoadedSheet[]> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  return workbook.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false
    })
  }));
}

/**
 * Import a schedule: a fund's prices, or (platform administrators) a NAMAF benchmark schedule as the practice tariff of
 * the practice type. The file's columns are detected and shown for staff to confirm, the start date comes from the
 * file and can be changed, and every row is compared with the prices in effect before anything is saved.
 */
const ScheduleImportPanel: React.FC<ScheduleImportPanelProps> = ({
  practiceId,
  practiceType,
  practiceTypeId,
  isSuperAdmin,
  canEditPractice,
  fundsEnabled,
  funds,
  tariffRows,
  fundRows,
  onImported
}) => {
  const [target, setTarget] = useState<Target>('fund');
  const [fundReference, setFundReference] = useState(funds[0]?.reference ?? '');
  const [planOption, setPlanOption] = useState('');
  const [shared, setShared] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<LoadedSheet[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [mapping, setMapping] = useState<ScheduleMapping | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<ImportStatus | 'all'>('all');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dental = isDentalPractice(practiceType);
  const sheet = sheets.find(item => item.name === sheetName)?.rows ?? [];
  const layout = useMemo(() => (sheet.length > 0 ? detectLayout(sheet) : null), [sheet]);
  const header = mapping ? sheet[mapping.headerRow] ?? [] : [];
  const width = Math.max(header.length, ...sheet.slice(0, 60).map(row => row.length), 0);
  const columns = Array.from({ length: width }, (_, index) => ({
    index,
    label: `${columnName(index)}: ${cellText(header[index]) || '(no heading)'}`
  }));
  const priceLabel = (index: number): string =>
    layout?.priceColumns.find(column => column.index === index)?.label ?? columns[index]?.label ?? columnName(index);

  const rows = useMemo(() => (mapping ? readScheduleRows(sheet, mapping) : []), [sheet, mapping]);
  const targetRows = useMemo((): ExistingPrice[] => {
    if (target === 'practice_tariff') {
      return tariffRows.map(row => ({
        code: row.code,
        price: row.price,
        effective_from: row.effective_from ?? null,
        effective_to: row.effective_to ?? null,
        is_active: row.is_active ?? null
      }));
    }
    const wantedPlan = planOption.trim().toLowerCase();
    return fundRows
      .filter(
        row =>
          (row.fund_reference ?? '').trim().toUpperCase() === fundReference &&
          (row.plan_option ?? '').trim().toLowerCase() === wantedPlan &&
          (row.practice_id ?? null) === (shared ? null : practiceId)
      )
      .map(row => ({ code: row.code, price: row.unit_price, effective_from: row.effective_from, effective_to: row.effective_to, is_active: row.is_active }));
  }, [target, tariffRows, fundRows, fundReference, planOption, shared, practiceId]);
  const knownCodes = useMemo(
    () => (target === 'fund' ? new Set(tariffRows.map(row => (row.code ?? '').trim().toUpperCase())) : undefined),
    [target, tariffRows]
  );
  const plan = useMemo(
    () => (isValidDateKey(startDate) && rows.length > 0 ? planScheduleImport(rows, targetRows, startDate, { dental, knownCodes }) : null),
    [rows, targetRows, startDate, dental, knownCodes]
  );
  const visibleRows = (plan?.rows ?? []).filter(row => statusFilter === 'all' || row.status === statusFilter);
  const dateProblem =
    !isValidDateKey(startDate) ? 'Enter the date the prices start.' : endDate && (!isValidDateKey(endDate) || endDate < startDate) ? 'The end date must be on or after the start date.' : null;
  const warning = isValidDateKey(startDate) ? outdatedScheduleWarning(startDate, todayKey()) : null;

  const permission =
    target === 'practice_tariff'
      ? isSuperAdmin
        ? null
        : 'Only OneHealth support can change the practice tariff: it is shared by every practice of this type.'
      : !fundsEnabled
        ? 'Fund schedules are not switched on yet (proposals/2026-10-07-fund-tariffs.sql).'
        : shared && !isSuperAdmin
          ? "Only OneHealth support can change a fund's schedule for every practice."
          : !shared && !canEditPractice
            ? "Only the practice's administrators can change its prices."
            : !fundReference
              ? 'Choose the fund.'
              : null;

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const loaded = await readWorkbook(file);
      const usable = loaded.find(item => detectLayout(item.rows)) ?? loaded[0];
      setFileName(file.name);
      setSheets(loaded);
      setSheetName(usable?.name ?? '');
      const found = usable ? detectLayout(usable.rows) : null;
      setMapping(
        found && found.priceColumn !== null
          ? { headerRow: found.headerRow, codeColumn: found.codeColumn, descriptionColumn: found.descriptionColumn, priceColumn: found.priceColumn }
          : null
      );
      setStartDate(suggestedStartDate(usable ? scheduleYear(file.name, usable.rows, found?.headerRow ?? 0) : null) ?? '');
      setStatusFilter('all');
      if (!found) toast.error('No header row with a code column was found. Check the sheet and the columns below.');
    } catch (error) {
      toast.error(`The file could not be read: ${error instanceof Error ? plainWords(error.message) : 'unknown error'}`);
    } finally {
      setReading(false);
    }
  };

  const changeSheet = (name: string) => {
    setSheetName(name);
    const rowsOfSheet = sheets.find(item => item.name === name)?.rows ?? [];
    const found = detectLayout(rowsOfSheet);
    setMapping(
      found && found.priceColumn !== null
        ? { headerRow: found.headerRow, codeColumn: found.codeColumn, descriptionColumn: found.descriptionColumn, priceColumn: found.priceColumn }
        : null
    );
  };

  const save = async () => {
    if (!plan || plan.blocked || plan.toSave.length === 0 || dateProblem || permission || !fileName) return;
    if (!practiceTypeId) {
      toast.error(`The practice type "${practiceType}" was not found, so the prices cannot be saved.`);
      return;
    }
    const what = target === 'practice_tariff' ? `the ${practiceType} practice tariff` : `${fundReference}${planOption.trim() ? ` (${planOption.trim()})` : ''}`;
    if (!window.confirm(`Save ${plan.toSave.length} prices for ${what}, starting ${startDate}? Older visits keep the prices of their own date.`)) return;
    setSaving(true);
    try {
      const saved =
        target === 'practice_tariff'
          ? await insertPracticeTariffVersions(
              practiceTariffRowsToSave(plan.rows, tariffRows, { practiceTypeId, startDate, endDate: endDate || null })
            )
          : await insertFundTariffs(
              fundTariffRowsToSave(plan.rows, {
                practiceTypeId,
                practiceId: shared ? null : practiceId,
                fundReference,
                planOption: planOption.trim() || null,
                startDate,
                endDate: endDate || null,
                source: `Imported from ${fileName} (${sheetName}, ${priceLabel(mapping?.priceColumn ?? 0)})`
              })
            );
      toast.success(`${saved} prices saved, starting ${startDate}.`);
      setSheets([]);
      setFileName(null);
      setMapping(null);
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The prices could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-5 md:grid-cols-2">
        <div>
          <span className={labelClass}>What the file holds</span>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={target === 'fund'} onChange={() => setTarget('fund')} />
              A fund's prices (for example the PSEMAS dental tariff)
            </label>
            <label className={`flex items-center gap-2 ${isSuperAdmin ? '' : 'text-gray-400'}`} title={isSuperAdmin ? undefined : 'Platform administrators only'}>
              <input type="radio" checked={target === 'practice_tariff'} disabled={!isSuperAdmin} onChange={() => setTarget('practice_tariff')} />
              NAMAF benchmark schedule: the practice tariff of every {practiceType} practice
            </label>
          </div>
        </div>
        {target === 'fund' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Fund</span>
              <select className={inputClass} value={fundReference} onChange={event => setFundReference(event.target.value)}>
                <option value="">Choose a fund</option>
                {funds.map(fund => (
                  <option key={fund.reference} value={fund.reference}>
                    {fund.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Plan option (optional)</span>
              <input className={inputClass} value={planOption} placeholder="Every plan" onChange={event => setPlanOption(event.target.value)} />
            </label>
            <label className={`flex items-center gap-2 text-sm sm:col-span-2 ${isSuperAdmin ? '' : 'text-gray-400'}`}>
              <input type="checkbox" checked={shared} disabled={!isSuperAdmin} onChange={event => setShared(event.target.checked)} />
              The fund's schedule for every {practiceType} practice (otherwise this practice's own agreed prices)
            </label>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <span className={labelClass}>File (xlsx, xls or csv)</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={reading}
          onChange={event => chooseFile(event.target.files?.[0])}
          className="block text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#01b9d4] file:px-3 file:py-2 file:text-white"
        />
        <p className="mt-2 text-xs text-gray-500">
          NAMAF sends each practice the schedule of its own discipline. The layout of NAMAF's workbook (practice-number prefixes, an Item / Description
          header and one price column per discipline) is read directly; other files are read by their column headings, which you can change below.
        </p>
      </div>

      {fileName && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <Icon icon="solar:document-text-bold-duotone" className="h-5 w-5 text-[#01b9d4]" />
            <span className="font-semibold">{fileName}</span>
            {sheets.length > 1 && (
              <select className="rounded-lg border border-gray-300 px-2 py-1 text-sm" value={sheetName} onChange={event => changeSheet(event.target.value)}>
                {sheets.map(item => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
            {layout?.namaf && <span className="rounded bg-cyan-100 px-2 py-0.5 text-xs text-cyan-800">NAMAF layout</span>}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="block">
              <span className={labelClass}>Header row</span>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={mapping ? mapping.headerRow + 1 : ''}
                onChange={event =>
                  setMapping(current => ({
                    headerRow: Math.max(0, Number(event.target.value) - 1),
                    codeColumn: current?.codeColumn ?? 0,
                    descriptionColumn: current?.descriptionColumn ?? null,
                    priceColumn: current?.priceColumn ?? 2
                  }))
                }
              />
            </label>
            <label className="block">
              <span className={labelClass}>Code column</span>
              <select
                className={inputClass}
                value={mapping?.codeColumn ?? ''}
                onChange={event => setMapping(current => (current ? { ...current, codeColumn: Number(event.target.value) } : current))}
              >
                {columns.map(column => (
                  <option key={column.index} value={column.index}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Description column</span>
              <select
                className={inputClass}
                value={mapping?.descriptionColumn ?? ''}
                onChange={event =>
                  setMapping(current => (current ? { ...current, descriptionColumn: event.target.value === '' ? null : Number(event.target.value) } : current))
                }
              >
                <option value="">None</option>
                {columns.map(column => (
                  <option key={column.index} value={column.index}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>{layout?.namaf ? 'Discipline (price column)' : 'Price column'}</span>
              <select
                className={inputClass}
                value={mapping?.priceColumn ?? ''}
                onChange={event => setMapping(current => (current ? { ...current, priceColumn: Number(event.target.value) } : current))}
              >
                {columns.map(column => (
                  <option key={column.index} value={column.index}>
                    {priceLabel(column.index)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Prices start on</span>
              <input type="date" className={inputClass} value={startDate} onChange={event => setStartDate(event.target.value)} />
            </label>
            <label className="block">
              <span className={labelClass}>Prices end on (optional)</span>
              <input type="date" className={inputClass} value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} />
            </label>
            <p className="self-end text-xs text-gray-500">
              The start date was read from the file where it gives the year (NAMAF schedules start on 1 January). A newer version replaces an older one from
              its start date; older visits keep their prices.
            </p>
          </div>

          {warning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {plan && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <button type="button" onClick={() => setStatusFilter('all')} className={`rounded-full px-3 py-1 ${statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  All {plan.rows.length}
                </button>
                {(Object.keys(STATUS_LABELS) as ImportStatus[]).map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-3 py-1 ${statusFilter === status ? 'ring-2 ring-gray-700' : ''} ${STATUS_STYLES[status]}`}
                  >
                    {STATUS_LABELS[status]} {plan.counts[status]}
                  </button>
                ))}
              </div>
              <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Now</th>
                      <th className="px-3 py-2 text-right">From the file</th>
                      <th className="px-3 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleRows.slice(0, MAX_PREVIEW_ROWS).map(row => (
                      <tr key={`${row.code}-${row.line}`}>
                        <td className="px-3 py-1.5 text-gray-400">{row.line}</td>
                        <td className="px-3 py-1.5 font-semibold text-gray-900">{row.code}</td>
                        <td className="max-w-md truncate px-3 py-1.5 text-gray-700" title={row.description}>
                          {row.description || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{row.currentPrice === null ? '-' : formatNad(row.currentPrice)}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-gray-900">{row.price === null ? '-' : formatNad(row.price)}</td>
                        <td className="px-3 py-1.5">
                          <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[row.status]}`}>{STATUS_LABELS[row.status]}</span>
                          {row.note && <span className="ml-2 text-xs text-gray-500">{row.note}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleRows.length > MAX_PREVIEW_ROWS && (
                  <p className="p-2 text-center text-xs text-gray-500">Showing the first {MAX_PREVIEW_ROWS} of {visibleRows.length} rows.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              {permission ??
                dateProblem ??
                (plan?.blocked
                  ? 'Some prices conflict with a version that starts on the same day. End that version or choose another start date.'
                  : plan
                    ? `${plan.toSave.length} prices will be saved; codes with the same price are left as they are.`
                    : 'Choose the columns to read the prices.')}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={saving || Boolean(permission) || Boolean(dateProblem) || !plan || plan.blocked || plan.toSave.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0196be] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon icon="solar:upload-bold-duotone" className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save these prices'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleImportPanel;
