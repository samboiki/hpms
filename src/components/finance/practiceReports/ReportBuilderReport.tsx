import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { centsToInput, parseAmountInput } from '../../../services/ledgerService';
import type { PeriodLabels } from '../financeNav';
import { ActionButton, FilterPill, Notice, SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import {
  BUILDER_FIELDS,
  BUILDER_SOURCES,
  BUILDER_SOURCE_LABELS,
  MAIN_AMOUNT,
  builderData,
  choiceLabel,
  choicesOf,
  definitionJson,
  fieldOf,
  newDefinition,
  runQuery,
  type BuilderSource,
  type QueryDefinition
} from './reportBuilder';
import { SAVED_NOT_SET_UP, loadBuilderInput, loadSavedQueries, removeQuery, saveQuery, type SavedQuery } from './reportBuilderService';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

const SOURCE_TABS = BUILDER_SOURCES.map(source => ({
  value: source,
  label: BUILDER_SOURCE_LABELS[source],
  icon: source === 'invoices' ? 'solar:bill-list-bold-duotone' : source === 'payments' ? 'solar:wad-of-money-bold-duotone' : 'solar:calendar-mark-bold-duotone'
}));

const DATE_BASIS: Record<BuilderSource, string> = { invoices: 'Invoices dated', payments: 'Payments received', visits: 'Visits on days' };
const SEARCH_HINT: Record<BuilderSource, string> = { invoices: 'Invoice number or patient', payments: 'Payment number or payer', visits: 'Patient' };

type Saved = { state: 'loading' } | { state: 'ready'; queries: SavedQuery[] } | { state: 'not_set_up' } | { state: 'error'; error: string };

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  staffNames: Record<string, string>;
}

/**
 * Build a report (parity R22): invoices, payments or visits of the period with the columns, filters and grouping the
 * practice chooses, saved under a name for everyone in the practice. Rows come from the person's own reads through a
 * fixed list of fields (reportBuilder.ts); CSV and Print as on every report.
 */
export const ReportBuilderReport: React.FC<Props> = ({ practiceId, practiceName, labels, staffNames }) => {
  const range = labels.ranges.current;
  const [definition, setDefinition] = useState<QueryDefinition>(() => newDefinition('invoices'));
  const [savedId, setSavedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [minText, setMinText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [saved, setSaved] = useState<Saved>({ state: 'loading' });
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const source = definition.source;
  const { status, data, retry } = useReportLoad(
    () => loadBuilderInput(practiceId, source, range),
    `${practiceId}|${source}|${range.startKey}|${range.endKey}`,
    'These records are not set up in this database yet (payments need proposals/2026-10-07-receipts-and-allocations.sql).'
  );
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: data?.patientNames ?? {}, onChanged: retry });

  const reloadSaved = useCallback(() => {
    let cancelled = false;
    loadSavedQueries(practiceId).then(result => {
      if (cancelled) return;
      setSaved(result.state === 'ready' ? { state: 'ready', queries: result.data } : result.state === 'not_set_up' ? { state: 'not_set_up' } : { state: 'error', error: result.error });
    });
    return () => { cancelled = true; };
  }, [practiceId]);
  useEffect(() => reloadSaved(), [reloadSaved]);

  const built = useMemo(() => (data ? builderData(data, staffNames) : null), [data, staffNames]);
  const fields = BUILDER_FIELDS[source];
  const filterFields = fields.filter(field => field.groupable);
  const activeFilters = Object.keys(definition.filters).length + (definition.minAmountCents !== null ? 1 : 0);
  const title = name.trim() || `${BUILDER_SOURCE_LABELS[source]} report`;

  const report = useMemo(() => {
    if (!built) return null;
    const chosen = Object.entries(definition.filters).map(([key, value]) => `${fieldOf(source, key)?.label ?? key}: ${choiceLabel(built, key, value)}`);
    return runQuery(built, definition, { title, basis: `${DATE_BASIS[source]} ${labels.current}${chosen.length > 0 ? ` · ${chosen.join(' · ')}` : ''}` });
  }, [built, definition, source, title, labels]);

  const change = (next: Partial<QueryDefinition>) => setDefinition(previous => ({ ...previous, ...next }));
  const startNew = (next: BuilderSource) => {
    setDefinition(newDefinition(next));
    setSavedId(null);
    setName('');
    setMinText('');
    setConfirmRemove(false);
  };
  const toggleColumn = (key: string) => {
    const on = definition.columns.includes(key);
    // A report keeps at least one column
    if (on && definition.columns.length === 1) return;
    change({ columns: on ? definition.columns.filter(column => column !== key) : [...definition.columns, key] });
  };
  const setFilter = (key: string, value: string) => {
    const filters = { ...definition.filters };
    if (value) filters[key] = value; else delete filters[key];
    change({ filters });
  };
  const chooseSaved = (id: string) => {
    setConfirmRemove(false);
    if (!id) {
      startNew(source);
      return;
    }
    const query = saved.state === 'ready' ? saved.queries.find(item => item.id === id) : undefined;
    if (!query) return;
    if (!query.definition) {
      toast.error('That saved report can no longer be read. Remove it and save it again.');
      setSavedId(query.id);
      setName(query.name);
      return;
    }
    setDefinition(query.definition);
    setSavedId(query.id);
    setName(query.name);
    setMinText(query.definition.minAmountCents !== null ? centsToInput(query.definition.minAmountCents) : '');
  };

  /** Saves the report under its name: over the saved report that is open, or as a new one */
  const save = async (asNew: boolean) => {
    if (!name.trim()) {
      toast.error('Give the report a name first.');
      return;
    }
    setBusy(true);
    try {
      const id = await saveQuery(practiceId, asNew ? null : savedId, name, definitionJson(definition));
      setSavedId(id);
      toast.success(`Saved "${name.trim()}" for everyone in the practice`);
      reloadSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The report could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!savedId) return;
    setBusy(true);
    try {
      await removeQuery(savedId);
      toast.success(`Removed "${name.trim() || 'the report'}" from the saved reports`);
      startNew(source);
      reloadSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The report could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  const minAmountValid = minText.trim() === '' || parseAmountInput(minText) !== null;

  return (
    <>
      <ReportFrame
        title="Build a report"
        subtitle={`${DATE_BASIS[source]} ${labels.current}`}
        icon="solar:widget-add-bold-duotone"
        tone="cyan"
        exportKey="report_builder"
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ source, group_by: definition.groupBy, saved: savedId, columns: definition.columns.length, filters: activeFilters }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'Nothing matches', hint: 'No records of this period pass the filters. Change the filters, or the period at the top of the page.' }}
        onOpen={open}
        resetKey={JSON.stringify(definitionJson(definition))}
        controls={
          <div className="space-y-4">
            <SegmentedTabs value={source} onChange={startNew} options={SOURCE_TABS} ariaLabel="What the report is about" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Saved reports" htmlFor="builder-saved" hint={saved.state === 'error' ? saved.error : undefined}>
                <select id="builder-saved" className={inputClass} value={savedId ?? ''} onChange={event => chooseSaved(event.target.value)} disabled={saved.state !== 'ready'}>
                  <option value="">{saved.state === 'loading' ? 'Loading saved reports' : 'A new report'}</option>
                  {saved.state === 'ready' && saved.queries.map(query => (
                    <option key={query.id} value={query.id}>{query.definition ? `${query.name} (${BUILDER_SOURCE_LABELS[query.definition.source].toLowerCase()})` : `${query.name} (cannot be read)`}</option>
                  ))}
                </select>
              </Field>
              <Field label="Group by" htmlFor="builder-group">
                <select id="builder-group" className={inputClass} value={definition.groupBy ?? ''} onChange={event => change({ groupBy: event.target.value || null })}>
                  <option value="">No grouping: every record</option>
                  {filterFields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </Field>
              <Field label="Search" htmlFor="builder-search">
                <input id="builder-search" type="search" className={inputClass} value={definition.search} placeholder={SEARCH_HINT[source]} maxLength={100}
                  onChange={event => change({ search: event.target.value })} />
              </Field>
              {MAIN_AMOUNT[source] && (
                <Field label="Amount at least (N$)" htmlFor="builder-min" error={minAmountValid ? null : 'Type an amount such as 250 or 1,250.50'}>
                  <input id="builder-min" type="text" inputMode="decimal" autoComplete="off" className={inputClass} value={minText} placeholder="Any amount"
                    onChange={event => {
                      setMinText(event.target.value);
                      const cents = event.target.value.trim() === '' ? null : parseAmountInput(event.target.value);
                      if (event.target.value.trim() === '' || cents !== null) change({ minAmountCents: cents });
                    }} />
                </Field>
              )}
            </div>
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-gray-700">Columns</legend>
              <div className="flex flex-wrap gap-2">
                {fields.map(field => (
                  <FilterPill key={field.key} active={definition.columns.includes(field.key)} onClick={() => toggleColumn(field.key)}>{field.label}</FilterPill>
                ))}
              </div>
            </fieldset>
            <div>
              <button
                type="button"
                onClick={() => setShowFilters(shown => !shown)}
                aria-expanded={showFilters}
                aria-controls="builder-filters"
                className="text-sm font-medium text-cyan-700 hover:text-cyan-800"
              >
                {showFilters ? 'Hide filters' : `Filters${Object.keys(definition.filters).length > 0 ? ` (${Object.keys(definition.filters).length} on)` : ''}`}
              </button>
              {showFilters && (
                <div id="builder-filters" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {filterFields.map(field => (
                    <Field key={field.key} label={field.label} htmlFor={`builder-filter-${field.key}`}>
                      <select id={`builder-filter-${field.key}`} className={inputClass} value={definition.filters[field.key] ?? ''} onChange={event => setFilter(field.key, event.target.value)}>
                        <option value="">Any</option>
                        {built && choicesOf(built, field.key).map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                      </select>
                    </Field>
                  ))}
                </div>
              )}
            </div>
            {saved.state === 'not_set_up' ? (
              <Notice tone="warning">{SAVED_NOT_SET_UP}</Notice>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Name to save it under" htmlFor="builder-name" className="min-w-[12rem] flex-1">
                  <input id="builder-name" type="text" className={inputClass} value={name} maxLength={80} placeholder="For example: Unpaid invoices over N$500"
                    onChange={event => setName(event.target.value)} />
                </Field>
                <ActionButton icon="solar:diskette-bold-duotone" label={savedId ? 'Save changes' : 'Save report'} onClick={() => void save(false)} disabled={busy || saved.state !== 'ready' || !minAmountValid} />
                {savedId && !confirmRemove && (
                  <>
                    <ActionButton icon="solar:copy-bold-duotone" label="Save as new" onClick={() => void save(true)} disabled={busy || !minAmountValid} />
                    <ActionButton icon="solar:trash-bin-minimalistic-bold-duotone" label="Remove" onClick={() => setConfirmRemove(true)} disabled={busy} />
                  </>
                )}
                {savedId && confirmRemove && (
                  <>
                    <ActionButton icon="solar:trash-bin-minimalistic-bold-duotone" label={`Remove "${name.trim() || 'this report'}"`} onClick={() => void remove()} disabled={busy} />
                    <ActionButton icon="solar:close-circle-bold-duotone" label="Keep it" onClick={() => setConfirmRemove(false)} disabled={busy} />
                  </>
                )}
              </div>
            )}
          </div>
        }
        onRowClick={definition.groupBy && report?.groupKeys ? index => {
          const key = report.groupKeys?.[index];
          // A group of records without a value (an undated invoice) cannot be a filter
          if (!key || !definition.groupBy) return;
          setDefinition(previous => ({ ...previous, filters: { ...previous.filters, [definition.groupBy as string]: key }, groupBy: null }));
        } : undefined}
        rowLabel={definition.groupBy && report?.groupKeys ? index => `List the ${BUILDER_SOURCE_LABELS[source].toLowerCase()} of ${String(report.table.rows[index]?.[0] ?? 'this row')}` : undefined}
      />
      {element}
    </>
  );
};
