import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format, isValid, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { formatDoctorName } from '../../utils/formatDoctorName';
import { EXCLUDE_CARRIER_VISITS } from '../../utils/carrierVisits';

interface PatientHistoryPanelProps {
  patientId: string;
  /** The visit being edited. It is excluded from every section; omit it for a new visit. */
  currentVisitId?: string;
  /** Optional extra tenant filter. Existing patient-scoped queries rely on RLS, so callers may omit it. */
  practiceId?: string;
  /** Shows an "Open visit" action on each previous visit; the caller decides how to open it. */
  onOpenVisit?: (visitId: string) => void;
}

interface HistoryVisit {
  id: string;
  visit_date: string | null;
  visit_time: string | null;
  visit_type: string;
  status: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  notes: string | null;
  doctor: { full_name: string | null } | null;
}

interface HistoryVitals {
  id: string;
  visit_id: string | null;
  created_at: string | null;
  blood_pressure: string | null;
  temperature: number | null;
  pulse_rate: number | null;
  respiratory_rate: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
}

interface HistoryMedication {
  id: string;
  visit_id: string | null;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  prescribed_date: string | null;
  created_at: string | null;
}

interface HistoryLabRequest {
  id: string;
  visit_id: string | null;
  request_date: string;
  status: string;
  lab_facility: string | null;
  notes: string | null;
  lab_results: { id: string; test_name: string; test_value: string; test_unit: string | null }[] | null;
}

type SectionState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: T[] };

const LOADING = { status: 'loading' } as const;
const HISTORY_LIMIT = 50;
const VITALS_LIMIT = 10;

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700'
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'No date';
  const date = parseISO(value);
  return isValid(date) ? format(date, 'dd MMM yyyy') : 'No date';
};

const humanize = (value?: string | null): string => (value ? value.replace(/[-_]/g, ' ') : '-');

const display = (value?: string | number | null): string =>
  value === null || value === undefined || value === '' ? '-' : String(value);

// Every query below is scoped by patient_id (vitals have no patient_id, so they are scoped
// through the patient's visit ids), mirroring VisitsTimeline / LabResultsTable.
const fetchPreviousVisits = async (
  patientId: string,
  currentVisitId?: string,
  practiceId?: string
): Promise<HistoryVisit[]> => {
  let query = supabase
    .from('visits')
    .select('id, visit_date, visit_time, visit_type, status, chief_complaint, diagnosis, treatment_plan, notes, doctor:users!doctor_id(full_name)')
    .eq('patient_id', patientId)
    // A row that only carries invoices (a payment plan, a package, an opening balance) is not a previous visit
    .or(EXCLUDE_CARRIER_VISITS);
  if (currentVisitId) query = query.neq('id', currentVisitId);
  if (practiceId) query = query.eq('practice_id', practiceId);

  const { data, error } = await query
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('visit_time', { ascending: false, nullsFirst: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;

  // The visits table also holds upcoming appointments; history only shows today and earlier.
  const today = format(new Date(), 'yyyy-MM-dd');
  return ((data ?? []) as unknown as HistoryVisit[]).filter(
    (visit) => !visit.visit_date || visit.visit_date <= today
  );
};

const fetchVitals = async (visitIds: string[]): Promise<HistoryVitals[]> => {
  if (visitIds.length === 0) return [];
  const { data, error } = await supabase
    .from('vitals')
    .select('id, visit_id, created_at, blood_pressure, temperature, pulse_rate, respiratory_rate, weight, height, bmi')
    .in('visit_id', visitIds)
    .order('created_at', { ascending: false })
    .limit(VITALS_LIMIT);
  if (error) throw error;
  return (data ?? []) as HistoryVitals[];
};

const fetchMedications = async (patientId: string, currentVisitId?: string): Promise<HistoryMedication[]> => {
  const { data, error } = await supabase
    .from('medications')
    .select('id, visit_id, medication_name, dosage, frequency, duration, prescribed_date, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return ((data ?? []) as HistoryMedication[]).filter((med) => !currentVisitId || med.visit_id !== currentVisitId);
};

const fetchLabRequests = async (
  patientId: string,
  currentVisitId?: string,
  practiceId?: string
): Promise<HistoryLabRequest[]> => {
  let query = supabase
    .from('lab_requests')
    .select('id, visit_id, request_date, status, lab_facility, notes, lab_results(id, test_name, test_value, test_unit)')
    .eq('patient_id', patientId);
  if (practiceId) query = query.eq('practice_id', practiceId);

  const { data, error } = await query.order('request_date', { ascending: false }).limit(HISTORY_LIMIT);
  if (error) throw error;
  return ((data ?? []) as unknown as HistoryLabRequest[]).filter(
    (request) => !currentVisitId || request.visit_id !== currentVisitId
  );
};

const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
      STATUS_STYLES[(status ?? '').toLowerCase()] ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {humanize(status)}
  </span>
);

const SectionCard: React.FC<{
  icon: string;
  iconClassName: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}> = ({ icon, iconClassName, title, count, children }) => (
  <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
    <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
      <div className={`p-2 rounded-lg ${iconClassName}`}>
        <Icon icon={icon} className="w-5 h-5" aria-hidden="true" />
      </div>
      <h4 className="text-base font-semibold text-gray-800">{title}</h4>
      {count !== undefined && (
        <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{count}</span>
      )}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

interface SectionBodyProps<T> {
  state: SectionState<T>;
  loadingText: string;
  errorText: string;
  emptyText: string;
  onRetry: () => void;
  children: (rows: T[]) => React.ReactNode;
}

function SectionBody<T>({ state, loadingText, errorText, emptyText, onRetry, children }: SectionBodyProps<T>) {
  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500" role="status">
        <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 animate-spin text-purple-600" aria-hidden="true" />
        {loadingText}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 text-sm text-red-700" role="alert">
        <span className="flex items-center gap-2">
          <Icon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
          {errorText}
        </span>
        <button type="button" onClick={onRetry} className="font-medium underline hover:text-red-800">
          Retry
        </button>
      </div>
    );
  }
  if (state.rows.length === 0) {
    return <p className="py-4 text-sm text-gray-500">{emptyText}</p>;
  }
  return <>{children(state.rows)}</>;
}

const VisitDetail: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="mt-1 text-gray-800 whitespace-pre-wrap">{value?.trim() || 'Not recorded'}</dd>
  </div>
);

const PatientHistoryPanel: React.FC<PatientHistoryPanelProps> = ({ patientId, currentVisitId, practiceId, onOpenVisit }) => {
  const [visits, setVisits] = useState<SectionState<HistoryVisit>>(LOADING);
  const [vitals, setVitals] = useState<SectionState<HistoryVitals>>(LOADING);
  const [medications, setMedications] = useState<SectionState<HistoryMedication>>(LOADING);
  const [labRequests, setLabRequests] = useState<SectionState<HistoryLabRequest>>(LOADING);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setVisits(LOADING);
    setVitals(LOADING);
    setMedications(LOADING);
    setLabRequests(LOADING);

    const load = async <T,>(
      loader: () => Promise<T[]>,
      setSection: (state: SectionState<T>) => void
    ): Promise<T[] | null> => {
      try {
        const rows = await loader();
        if (!cancelled) setSection({ status: 'ready', rows });
        return rows;
      } catch (error) {
        console.error('[PatientHistoryPanel] Failed to load history section:', error);
        if (!cancelled) setSection({ status: 'error' });
        return null;
      }
    };

    void load(() => fetchPreviousVisits(patientId, currentVisitId, practiceId), setVisits).then((previousVisits) => {
      if (previousVisits === null) {
        if (!cancelled) setVitals({ status: 'error' });
        return;
      }
      return load(() => fetchVitals(previousVisits.map((visit) => visit.id)), setVitals);
    });
    void load(() => fetchMedications(patientId, currentVisitId), setMedications);
    void load(() => fetchLabRequests(patientId, currentVisitId, practiceId), setLabRequests);

    return () => {
      cancelled = true;
    };
  }, [patientId, currentVisitId, practiceId, reloadKey]);

  const visitDateById = useMemo(
    () => new Map(visits.status === 'ready' ? visits.rows.map((visit) => [visit.id, visit.visit_date]) : []),
    [visits]
  );

  const retry = () => setReloadKey((key) => key + 1);
  const countOf = <T,>(state: SectionState<T>) => (state.status === 'ready' ? state.rows.length : undefined);

  if (!patientId) {
    return <p className="py-8 text-center text-sm text-gray-500">No patient selected.</p>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 mb-6">
      <SectionCard
        icon="solar:clipboard-list-bold-duotone"
        iconClassName="bg-purple-100 text-purple-600"
        title="Previous Visits"
        count={countOf(visits)}
      >
        <SectionBody
          state={visits}
          loadingText="Loading previous visits..."
          errorText="Could not load previous visits."
          emptyText="No previous visits"
          onRetry={retry}
        >
          {(rows) => (
            <ul className="space-y-2">
              {rows.map((visit) => {
                const isExpanded = expandedVisitId === visit.id;
                return (
                  <li key={visit.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => setExpandedVisitId(isExpanded ? null : visit.id)}
                        aria-expanded={isExpanded}
                        className="flex-1 min-w-0 flex items-start justify-between gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="font-semibold text-gray-900">
                              {formatDate(visit.visit_date)}
                              {visit.visit_time ? ` ${visit.visit_time.slice(0, 5)}` : ''}
                            </span>
                            <span className="capitalize text-gray-600">{humanize(visit.visit_type)}</span>
                            <span className="text-gray-600">{formatDoctorName(visit.doctor?.full_name)}</span>
                            <StatusBadge status={visit.status} />
                          </div>
                          <p className="mt-1 text-sm text-gray-700 truncate">
                            <span className="font-medium">Complaint:</span> {visit.chief_complaint?.trim() || 'Not recorded'}
                          </p>
                          {!isExpanded && visit.diagnosis?.trim() && (
                            <p className="text-sm text-gray-600 truncate">
                              <span className="font-medium">Diagnosis:</span> {visit.diagnosis}
                            </p>
                          )}
                        </div>
                        <Icon
                          icon="solar:alt-arrow-down-bold-duotone"
                          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                      {/* Separate from the expand toggle: opens the visit itself */}
                      {onOpenVisit && (
                        <div className="flex items-center pl-1 pr-3">
                          <button
                            type="button"
                            onClick={() => onOpenVisit(visit.id)}
                            aria-label={`Open the visit of ${formatDate(visit.visit_date)}`}
                            title="Open this visit"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm font-medium whitespace-nowrap transition-colors"
                          >
                            <Icon icon="solar:square-arrow-right-up-bold-duotone" className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Open visit</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 px-3 pb-3 pt-1 text-sm border-t border-gray-100 bg-gray-50/50">
                            <VisitDetail label="Chief complaint" value={visit.chief_complaint} />
                            <VisitDetail label="Diagnosis" value={visit.diagnosis} />
                            <VisitDetail label="Treatment plan" value={visit.treatment_plan} />
                            <VisitDetail label="Clinical notes" value={visit.notes} />
                          </dl>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionBody>
      </SectionCard>

      <SectionCard
        icon="solar:heart-pulse-bold-duotone"
        iconClassName="bg-red-100 text-red-600"
        title="Vitals History"
        count={countOf(vitals)}
      >
        <SectionBody
          state={vitals}
          loadingText="Loading vitals history..."
          errorText="Could not load vitals history."
          emptyText="No previous vitals recorded"
          onRetry={retry}
        >
          {(rows) => (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'BP', 'Temp (°C)', 'Pulse (bpm)', 'Resp', 'Weight (kg)', 'Height (cm)', 'BMI'].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((reading) => (
                    <tr key={reading.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {formatDate((reading.visit_id && visitDateById.get(reading.visit_id)) || reading.created_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{display(reading.blood_pressure)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{display(reading.temperature)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{display(reading.pulse_rate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{display(reading.respiratory_rate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{display(reading.weight)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{display(reading.height)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{display(reading.bmi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionBody>
      </SectionCard>

      <SectionCard
        icon="solar:pill-bold-duotone"
        iconClassName="bg-orange-100 text-orange-600"
        title="Previous Medications"
        count={countOf(medications)}
      >
        <SectionBody
          state={medications}
          loadingText="Loading previous medications..."
          errorText="Could not load previous medications."
          emptyText="No previous medications"
          onRetry={retry}
        >
          {(rows) => (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Medication', 'Dosage', 'Frequency', 'Duration'].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((med) => (
                    <tr key={med.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {formatDate(med.prescribed_date || med.created_at)}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{med.medication_name}</td>
                      <td className="px-3 py-2">{display(med.dosage)}</td>
                      <td className="px-3 py-2">{display(med.frequency)}</td>
                      <td className="px-3 py-2">{display(med.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionBody>
      </SectionCard>

      <SectionCard
        icon="solar:test-tube-bold-duotone"
        iconClassName="bg-green-100 text-green-600"
        title="Previous Lab Requests"
        count={countOf(labRequests)}
      >
        <SectionBody
          state={labRequests}
          loadingText="Loading previous lab requests..."
          errorText="Could not load previous lab requests."
          emptyText="No previous lab requests"
          onRetry={retry}
        >
          {(rows) => (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Tests / Results', 'Laboratory', 'Status'].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((request) => {
                    const results = request.lab_results ?? [];
                    return (
                      <tr key={request.id} className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900">{formatDate(request.request_date)}</td>
                        <td className="px-3 py-2">
                          {results.length > 0 ? (
                            <ul className="space-y-0.5">
                              {results.map((result) => (
                                <li key={result.id}>
                                  <span className="font-medium text-gray-900">{result.test_name}</span>
                                  {`: ${result.test_value}${result.test_unit ? ` ${result.test_unit}` : ''}`}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-600">{request.notes?.trim() || 'No results recorded'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{display(request.lab_facility)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={request.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionBody>
      </SectionCard>
    </motion.div>
  );
};

export default PatientHistoryPanel;
