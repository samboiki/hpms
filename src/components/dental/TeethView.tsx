import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { todayKey } from '../../utils/billing/dates';
import { defaultDentition, type Dentition } from '../../utils/dental/fdi';
import QuoteViewer from '../quotes/QuoteViewer';
import QuoteEditor, { type QuotePatient } from '../quotes/QuoteEditor';
import { secondaryButton } from '../quotes/QuoteBits';
import ChartLegend from './ChartLegend';
import DentitionSwitch from './DentitionSwitch';
import LabWorkSection from './LabWorkSection';
import Odontogram from './Odontogram';
import ToothSheet from './ToothSheet';
import TreatmentPlan from './TreatmentPlan';
import { usePlanPricing } from './usePlanPricing';
import { useDentalPractice } from './useDentalPractice';
import { useToothChart } from './useToothChart';

export interface TeethViewProps {
  practiceId: string | null | undefined;
  patientId: string;
  /** Opened from a visit: work recorded or marked done is linked to that visit, and links that leave it are text */
  visitId?: string | null;
  /** Opens one of the patient's visits (the patient file); visits are links without it */
  onOpenVisit?: (visitId: string) => void;
}

/** Practitioners, nurses and practice admins record and plan work (the database checks the same roles). */
const CLINICAL_ROLES = new Set(['doctor', 'nurse', 'admin']);

/**
 * Patient file > Teeth (dental practices): the tooth chart built from the billing and what was charted, one tap on
 * a tooth for its state, history and planned work, and the treatment plan that becomes a quote.
 */
const TeethView: React.FC<TeethViewProps> = ({ practiceId, patientId, visitId = null, onOpenVisit }) => {
  const isDental = useDentalPractice(practiceId);
  const role = useAuthStore(state => state.user?.role ?? null);
  const canChart = role !== null && CLINICAL_ROLES.has(role);
  const navigation = !visitId;
  const { load, model, entries, chartReady, dateOfBirth, reload } = useToothChart(practiceId, patientId, isDental === true);
  const ready = load.status === 'ready' ? load : null;
  const [dentition, setDentition] = useState<Dentition | null>(null);
  const [tooth, setTooth] = useState<string | null>(null);
  const [viewerQuoteId, setViewerQuoteId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ quoteId: string; patient: QuotePatient } | null>(null);
  // "Send to the lab" on a tooth opens a new lab order for it (Lab work, below the plan)
  const [labRequest, setLabRequest] = useState<{ teeth: string[]; nonce: number } | null>(null);
  const today = todayKey();

  const entriesById = useMemo(() => new Map(entries.map(entry => [entry.id, entry])), [entries]);
  const openTooth = useMemo(() => new Set(tooth ? [tooth] : []), [tooth]);
  const shown = dentition ?? defaultDentition(dateOfBirth, today, model.recordedTeeth);
  const pricing = usePlanPricing(practiceId, patientId, chartReady);
  // A change on the chart or a quote reloads the chart, the billing and the quotes (prices do not change with them)
  const changed = reload;

  if (isDental === false) {
    return <p className="py-8 text-center text-sm text-gray-500">The tooth chart is for dental practices.</p>;
  }
  if (isDental === null || load.status === 'loading') {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="mx-auto h-40 max-w-4xl animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none" />
        <span className="sr-only">Loading the tooth chart</span>
      </div>
    );
  }
  if (load.status === 'error') {
    return (
      <div className="space-y-3 py-6 text-center" role="alert">
        <p className="text-sm text-red-700">{load.message}</p>
        <button type="button" className={secondaryButton} onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  const planned = model.planItems.filter(item => !item.done && item.entry.status === 'planned').length;
  const teethWithHistory = model.recordedTeeth.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">Teeth</h3>
          <p className="text-xs text-gray-500">
            {teethWithHistory === 0 ? 'Nothing billed or charted on a tooth yet.' : `${teethWithHistory} teeth with history`}
            {planned > 0 ? ` · ${planned} planned` : ''}. {chartReady && canChart ? 'Tap a tooth to see or plan its work.' : 'Tap a tooth to see its work.'}
          </p>
        </div>
        <DentitionSwitch value={shown} onChange={setDentition} />
      </div>

      {!chartReady && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="status">
          <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            Charting is not set up yet. The chart shows the work billed with tooth numbers. Recording what is on a tooth
            and treatment plans start working once your administrator applies the dental chart update.
          </p>
        </div>
      )}
      {ready && ready.billed.unplaced > 0 && (
        <p className="text-xs text-amber-800">
          {ready.billed.unplaced} billed line{ready.billed.unplaced === 1 ? ' has a tooth number' : 's have tooth numbers'} that{' '}
          {ready.billed.unplaced === 1 ? 'is' : 'are'} not a tooth, so {ready.billed.unplaced === 1 ? 'it is' : 'they are'} not on the chart.
        </p>
      )}
      {ready?.quotesError && <p className="text-xs text-amber-800">The patient's quotes could not be read ({ready.quotesError}), so quote links are missing.</p>}

      <Odontogram dentition={shown} model={model} mode="open" selected={openTooth} onToothClick={setTooth} />
      <ChartLegend />

      {chartReady && practiceId && (
        <TreatmentPlan
          model={model}
          pricing={pricing}
          canChart={canChart}
          practiceId={practiceId}
          patientId={patientId}
          visitId={visitId}
          navigation={navigation}
          today={today}
          onChanged={changed}
          onOpenQuote={setViewerQuoteId}
          onSelectTooth={setTooth}
        />
      )}

      {practiceId && (
        <LabWorkSection
          practiceId={practiceId}
          patientId={patientId}
          visitId={visitId}
          navigation={navigation}
          today={today}
          canChart={canChart}
          model={model}
          dateOfBirth={dateOfBirth}
          orderRequest={labRequest}
        />
      )}

      {tooth && (
        <ToothSheet
          tooth={tooth}
          model={model}
          entriesById={entriesById}
          chartReady={chartReady}
          canChart={canChart}
          pricing={pricing}
          patientId={patientId}
          visitId={visitId}
          navigation={navigation}
          today={today}
          onClose={() => setTooth(null)}
          onChanged={changed}
          // The visit opens full screen; the sheet (a dialog above it) closes first so the visit is not hidden behind it
          onOpenVisit={
            onOpenVisit
              ? openedVisitId => {
                  setTooth(null);
                  onOpenVisit(openedVisitId);
                }
              : undefined
          }
          onOpenQuote={quoteId => {
            setTooth(null);
            setViewerQuoteId(quoteId);
          }}
          // The order sheet opens over the chart once the tooth sheet has closed
          onSendToLab={
            practiceId
              ? () => {
                  setLabRequest(current => ({ teeth: [tooth], nonce: (current?.nonce ?? 0) + 1 }));
                  setTooth(null);
                }
              : undefined
          }
        />
      )}

      <QuoteViewer
        quoteId={viewerQuoteId}
        onClose={() => setViewerQuoteId(null)}
        onChanged={changed}
        onEdit={quote => {
          setViewerQuoteId(null);
          setEditor({ quoteId: quote.id, patient: { id: quote.patientId, name: quote.patientName ?? 'Patient', phone: null, email: null } });
        }}
      />
      {editor && practiceId && (
        <QuoteEditor
          isOpen
          practiceId={practiceId}
          patient={editor.patient}
          quoteId={editor.quoteId}
          onClose={() => setEditor(null)}
          onSaved={quoteId => {
            setEditor(null);
            changed();
            setViewerQuoteId(quoteId);
          }}
        />
      )}
    </div>
  );
};

export default TeethView;
