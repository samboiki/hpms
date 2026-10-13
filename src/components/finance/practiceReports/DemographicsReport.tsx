import React, { useMemo, useState } from 'react';
import { monthKeyOf } from '../../../services/ledgerService';
import type { PeriodLabels } from '../financeNav';
import { formatMonthKey } from '../financeFormat';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import {
  DEMOGRAPHIC_NOTES,
  HEARD_KEYS,
  PATIENT_SOURCES,
  SOURCE_LABELS,
  countBy,
  dimensionLabel,
  dimensionTable,
  heardLabel,
  heardMonthTable,
  heardPerMonth,
  monthTable,
  openedIn,
  openedPerMonth,
  patientFacts,
  patientListTable,
  type Dimension
} from './patientDemographics';
import { townNote } from './patientTowns';
import { loadDemographics } from './patientReportsService';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

type View = 'month' | Dimension | 'list';
type Scope = 'new' | 'all';

const VIEWS = [
  { value: 'month' as const, label: 'New per month', icon: 'solar:calendar-add-bold-duotone' },
  { value: 'language' as const, label: 'Language', icon: 'solar:translation-bold-duotone' },
  { value: 'town' as const, label: 'Town', icon: 'solar:map-point-bold-duotone' },
  { value: 'region' as const, label: 'Region', icon: 'solar:map-bold-duotone' },
  { value: 'source' as const, label: 'How they came', icon: 'solar:routing-2-bold-duotone' },
  { value: 'heard' as const, label: 'Heard about us', icon: 'solar:chat-round-like-bold-duotone' },
  { value: 'list' as const, label: 'Patients', icon: 'solar:list-bold-duotone' }
];

const EXPORT_KEYS: Record<View, string> = {
  month: 'demographics_new_per_month',
  language: 'demographics_language',
  town: 'demographics_town',
  region: 'demographics_region',
  source: 'demographics_source',
  heard: 'demographics_heard',
  list: 'demographics_patients'
};

const TITLES: Record<Dimension, string> = {
  language: 'Patients by home language',
  town: 'Patients by town',
  region: 'Patients by region',
  source: 'Patients by how they came to us',
  heard: 'Patients by how they heard about us'
};

const isDimension = (view: View): view is Dimension => view === 'language' || view === 'town' || view === 'region' || view === 'source';
/** Views that count new files per month of the period (the patients-in-scope picker does not apply) */
const isPerMonth = (view: View): boolean => view === 'month' || view === 'heard';

type Filters = Record<Dimension | 'month', string>;
const NO_FILTERS: Filters = { language: '', town: '', region: '', source: '', heard: '', month: '' };

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
}

/** Demographics and new patients (parity R26): language, town, region, how patients came, new files per month, and the list */
export const DemographicsReport: React.FC<Props> = ({ practiceId, practiceName, labels }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(() => loadDemographics(practiceId), practiceId, 'Patient files could not be read in this database.');
  const [view, setView] = useState<View>('month');
  const [scope, setScope] = useState<Scope>('new');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: {}, onChanged: retry });

  const facts = useMemo(() => (data ? patientFacts(data.records, { referred: data.referred, bookedOnline: data.bookedOnline }) : []), [data]);
  const inScope = useMemo(() => (scope === 'new' ? openedIn(facts, range) : facts), [facts, scope, range]);
  const scopeText = scope === 'new' ? `Files opened ${labels.current}` : `Every patient on file, as at ${labels.today}`;
  const heardField = data?.heardField ?? false;
  const notes = useMemo(() => [
    DEMOGRAPHIC_NOTES.opened, townNote(data?.townField ?? false), DEMOGRAPHIC_NOTES.source,
    ...(heardField ? [DEMOGRAPHIC_NOTES.heard] : []), DEMOGRAPHIC_NOTES.language
  ], [data, heardField]);
  // "Heard about us" (owner, 13 Oct 2026) only once the database has the question's columns
  const views = useMemo(() => VIEWS.filter(option => option.value !== 'heard' || heardField), [heardField]);
  const months = useMemo(() => openedPerMonth(facts, range), [facts, range]);
  const heardMonths = useMemo(() => heardPerMonth(facts, range), [facts, range]);
  const groups = useMemo(() => (isDimension(view) ? countBy(inScope, view) : []), [inScope, view]);
  const choices = useMemo(() => ({
    language: countBy(inScope, 'language').map(group => group.key),
    town: countBy(inScope, 'town').map(group => group.key),
    region: countBy(inScope, 'region').map(group => group.key)
  }), [inScope]);

  const report = useMemo(() => {
    if (!data) return null;
    if (view === 'month') return monthTable(months, `Files opened ${labels.current}`, notes);
    if (view === 'heard') return heardMonthTable(heardMonths, `Files opened ${labels.current}`, notes);
    if (view === 'list') {
      const shown = inScope.filter(fact =>
        (!filters.language || fact.language === filters.language) &&
        (!filters.town || fact.town === filters.town) &&
        (!filters.region || fact.region === filters.region) &&
        (!filters.source || fact.source === filters.source) &&
        (!filters.heard || fact.heard === filters.heard) &&
        (!filters.month || (!!fact.openedOn && monthKeyOf(fact.openedOn) === filters.month)));
      const chosen = [
        filters.month ? formatMonthKey(filters.month, 'MMMM yyyy') : null,
        filters.language || null,
        filters.town || null,
        filters.region || null,
        filters.source ? dimensionLabel(filters.source, 'source') : null,
        filters.heard ? `Heard about us: ${heardLabel(filters.heard)}` : null
      ].filter(Boolean).join(' · ');
      return patientListTable(shown, { title: scope === 'new' ? 'New patients' : 'Patients on file', basis: `${scopeText}${chosen ? ` · ${chosen}` : ''}`, notes });
    }
    return dimensionTable(groups, { dimension: view, title: TITLES[view], basis: scopeText, notes });
  }, [data, view, months, heardMonths, labels, notes, inScope, filters, scope, scopeText, groups]);

  /** A summary row lists its patients */
  const openGroup = (index: number) => {
    if (isPerMonth(view)) {
      const month = months[index];
      if (!month) return;
      setScope('new');
      setFilters({ ...NO_FILTERS, month: month.monthKey });
    } else if (isDimension(view)) {
      const group = groups[index];
      if (!group) return;
      setFilters({ ...NO_FILTERS, [view]: group.key });
    } else {
      return;
    }
    setView('list');
  };
  const groupName = (index: number): string => {
    if (isPerMonth(view)) return months[index] ? formatMonthKey(months[index].monthKey, 'MMMM yyyy') : '';
    if (isDimension(view)) return groups[index] ? dimensionLabel(groups[index].key, view) : '';
    return '';
  };
  const setFilter = (key: keyof Filters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const choiceField = (key: 'language' | 'town' | 'region', label: string, every: string) => (
    <Field label={label} htmlFor={`demographics-${key}`}>
      <select id={`demographics-${key}`} className={inputClass} value={filters[key]} onChange={event => setFilter(key, event.target.value)}>
        <option value="">{every}</option>
        {choices[key].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </Field>
  );

  return (
    <>
      <ReportFrame
        title="Demographics and new patients"
        subtitle={scopeText}
        icon="solar:user-plus-bold-duotone"
        tone="blue"
        exportKey={EXPORT_KEYS[view]}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{
          scope, language: filters.language || null, town: filters.town || null, region: filters.region || null,
          source: filters.source || null, heard: filters.heard || null, month: filters.month || null
        }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: scope === 'new' ? 'No new patients in this period' : 'No patient files yet', hint: 'Patient files appear here once they are opened (Patients > Add patient).' }}
        onOpen={open}
        resetKey={`${view}|${scope}|${Object.values(filters).join('|')}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={views} ariaLabel="Demographics views" />
            {!isPerMonth(view) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Patients" htmlFor="demographics-scope">
                  <select id="demographics-scope" className={inputClass} value={scope} onChange={event => { setScope(event.target.value as Scope); setFilters(NO_FILTERS); }}>
                    <option value="new">New in this period</option>
                    <option value="all">Every patient on file</option>
                  </select>
                </Field>
                {view === 'list' && (
                  <>
                    {scope === 'new' && months.length > 1 && (
                      <Field label="Month opened" htmlFor="demographics-month">
                        <select id="demographics-month" className={inputClass} value={filters.month} onChange={event => setFilter('month', event.target.value)}>
                          <option value="">Every month</option>
                          {months.map(month => <option key={month.monthKey} value={month.monthKey}>{formatMonthKey(month.monthKey, 'MMMM yyyy')}</option>)}
                        </select>
                      </Field>
                    )}
                    {choiceField('language', 'Home language', 'Every language')}
                    {choiceField('town', 'Town', 'Every town')}
                    {choiceField('region', 'Region', 'Every region')}
                    <Field label="How they came to us" htmlFor="demographics-source">
                      <select id="demographics-source" className={inputClass} value={filters.source} onChange={event => setFilter('source', event.target.value)}>
                        <option value="">Every way</option>
                        {PATIENT_SOURCES.map(source => <option key={source} value={source}>{SOURCE_LABELS[source]}</option>)}
                      </select>
                    </Field>
                    {heardField && (
                      <Field label="Heard about us through" htmlFor="demographics-heard">
                        <select id="demographics-heard" className={inputClass} value={filters.heard} onChange={event => setFilter('heard', event.target.value)}>
                          <option value="">Every answer</option>
                          {HEARD_KEYS.map(key => <option key={key} value={key}>{heardLabel(key)}</option>)}
                        </select>
                      </Field>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        }
        onRowClick={view === 'list' ? undefined : openGroup}
        rowLabel={view === 'list' ? undefined : index => `List the patients of ${groupName(index)}`}
      />
      {element}
    </>
  );
};
