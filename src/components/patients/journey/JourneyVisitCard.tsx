import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { formatNad } from '../../../utils/billing/money';
import { formatDoctorName } from '../../../utils/formatDoctorName';
import { CARD, PRIMARY, SECONDARY } from '../../stock/stockUi';
import type { PatientInvoice } from '../patientBilling';
import { VisitMoreMenu } from './VisitMoreMenu';
import {
  billingActionName,
  canMarkDone,
  formatVisitWhen,
  journeyStatus,
  mainAction,
  moreActions,
  recordActions,
  visitBilling,
  visitBloodPressure,
  visitDateKey,
  visitDateTimeAttribute,
  visitHeadline,
  visitRecords,
  type JourneyStatusKind,
  type JourneyVisit,
  type VisitBillingLabel,
  type VisitMenuAction,
  type VisitQuickTab,
  type VisitRecordCounts
} from './visitJourney';

// One quiet tint per status; the dot on the timeline line uses the same colour
const STATUS_STYLES: Record<JourneyStatusKind, { pill: string; dot: string }> = {
  done: { pill: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  pending: { pill: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  scheduled: { pill: 'border-sky-200 bg-sky-50 text-sky-800', dot: 'bg-sky-500' },
  cancelled: { pill: 'border-gray-200 bg-gray-50 text-gray-600', dot: 'bg-gray-400' },
  'no-show': { pill: 'border-gray-200 bg-gray-50 text-gray-600', dot: 'bg-gray-400' }
};

// Colour only where it means something: settled, money still to come in, or overdue
const BILLING_TONE: Record<VisitBillingLabel, string> = {
  Paid: 'text-emerald-700',
  'Part paid': 'text-amber-700',
  Unpaid: 'text-gray-600',
  Overdue: 'font-semibold text-red-700'
};

// The app's shared buttons (stockUi): the card's main action in the action colour, every other one neutral
const actionClass = (isMain: boolean) => (isMain ? PRIMARY : SECONDARY);
const iconClass = (isMain: boolean) => `h-4 w-4 flex-none ${isMain ? 'text-white' : 'text-gray-500'}`;

export interface JourneyVisitCardProps<V extends JourneyVisit> {
  visit: V;
  /** Today's date ('yyyy-MM-dd'), the same for every card */
  today: string;
  /** Lab, imaging and media counts for this visit */
  counts?: Partial<VisitRecordCounts>;
  /** This patient's invoices; undefined until they have loaded */
  invoices?: readonly PatientInvoice[];
  onOpenVisit?: (visit: V) => void;
  /** Opens the visit on one of its tabs (falls back to opening the visit) */
  onOpenVisitTab?: (visit: V, tab: VisitQuickTab) => void;
  onCreateFollowUp?: (visit: V) => void;
  onStatusChange?: (visitId: string, newStatus: string) => void;
}

/**
 * One visit on the patient journey: when, why and with whom, its status, diagnosis and plan, and one
 * row of actions that open the visit, its billing and its records (with counts of what exists).
 */
export function JourneyVisitCard<V extends JourneyVisit>({
  visit,
  today,
  counts,
  invoices,
  onOpenVisit,
  onOpenVisitTab,
  onCreateFollowUp,
  onStatusChange
}: JourneyVisitCardProps<V>) {
  const headingId = useId();
  const metaId = useId();
  const moreButtonId = useId();
  // A new status shows at once while it saves
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusSeen, setStatusSeen] = useState(visit.status);
  if (statusSeen !== visit.status) {
    // The stored status changed (saved here, or Complete/Reopen in the visit screen): show that one
    setStatusSeen(visit.status);
    setSavingStatus(null);
  }

  const shownVisit: JourneyVisit = savingStatus ? { ...visit, status: savingStatus } : visit;
  const status = journeyStatus(shownVisit, today);
  const billing = visitBilling(shownVisit, invoices, today);
  const main = mainAction(billing);
  const records = recordActions(visitRecords(visit, counts));
  const menu = moreActions(shownVisit, { canFollowUp: !!onCreateFollowUp }, today);
  const { title, type } = visitHeadline(visit);
  const practitioner = formatDoctorName(visit.doctor?.full_name || visit.doctor_name, '');
  const diagnosis = visit.diagnosis?.trim();
  const plan = visit.treatment_plan?.trim();
  const bloodPressure = visitBloodPressure(visit.vitals);
  const isToday = visitDateKey(visit) === today;
  const visitName = visit.visit_number ? `visit #${visit.visit_number}` : 'this visit';

  const openTab = (tab: VisitQuickTab) => {
    if (onOpenVisitTab) onOpenVisitTab(visit, tab);
    else onOpenVisit?.(visit);
  };

  const changeStatus = async (newStatus: 'completed' | 'in-progress') => {
    if (isSaving) return;
    const question =
      newStatus === 'completed' ? 'Mark this visit as done?' : 'Reopen this visit? It will show as Pending again.';
    if (!window.confirm(question)) return;
    setIsSaving(true);
    setSavingStatus(newStatus);
    // "Mark as done" goes away once the visit is done; keep keyboard users in this card
    if (newStatus === 'completed') document.getElementById(moreButtonId)?.focus();
    try {
      const { error } = await supabase.from('visits').update({ status: newStatus }).eq('id', visit.id);
      if (error) throw error;
      onStatusChange?.(visit.id, newStatus);
    } catch (error) {
      console.error('Error updating visit status:', error);
      setSavingStatus(null);
      toast.error('Could not update the visit status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const onMenuSelect = (action: VisitMenuAction) => {
    if (action.id === 'letters') openTab('leave');
    else if (action.id === 'follow-up') onCreateFollowUp?.(visit);
    else void changeStatus('in-progress');
  };

  // A click anywhere on the card opens the visit, as before; buttons and the menu handle their own clicks
  const onCardClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!onOpenVisit) return;
    if ((event.target as Element).closest('button, a, [role="menu"]')) return;
    // Selecting text (to copy a diagnosis, say) is not a request to open the visit
    if (window.getSelection()?.toString()) return;
    onOpenVisit(visit);
  };

  return (
    <article
      aria-labelledby={headingId}
      onClick={onCardClick}
      className={`${CARD} relative p-4 sm:p-5 ${onOpenVisit ? 'cursor-pointer' : ''}`}
    >
      {/* Marker on the timeline line (from sm up), coloured by status; offsets count from inside the 1px border */}
      <span
        aria-hidden="true"
        className={`absolute -left-[33px] top-[23px] hidden h-4 w-4 rounded-full border-[3px] border-white ring-1 ring-gray-200 sm:block ${STATUS_STYLES[status.kind].dot}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p id={metaId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <time dateTime={visitDateTimeAttribute(visit)} className="font-medium text-gray-900">
              {formatVisitWhen(visit)}
            </time>
            {isToday && <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-xs font-medium text-purple-700">Today</span>}
            {visit.visit_number ? <span>Visit #{visit.visit_number}</span> : null}
          </p>
          <h3 id={headingId} className="mt-1 line-clamp-2 break-words text-base font-semibold text-gray-900" title={title}>
            {title}
          </h3>
          {(type || practitioner) && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-gray-600">
              {type && <span>{type}</span>}
              {type && practitioner && (
                <span aria-hidden="true" className="text-gray-300">
                  ·
                </span>
              )}
              {practitioner && (
                <span className="inline-flex items-center gap-1">
                  <Icon icon="solar:user-bold-duotone" className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                  {practitioner}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-none flex-wrap items-center gap-2">
          {/* Read out when it changes (Mark as done, Reopen) */}
          <span
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status.kind].pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[status.kind].dot}`} aria-hidden="true" />
            <span className="sr-only">Status: </span>
            {status.label}
          </span>
          {canMarkDone(shownVisit, today) && (
            <button
              type="button"
              onClick={() => void changeStatus('completed')}
              disabled={isSaving}
              aria-describedby={metaId}
              className={SECONDARY}
            >
              <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Mark as done
            </button>
          )}
          <VisitMoreMenu buttonId={moreButtonId} items={menu} onSelect={onMenuSelect} label={`More actions for ${visitName}`} />
        </div>
      </div>

      {(diagnosis || plan || bloodPressure) && (
        // From sm up the labels share one width, so values line up from card to card
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
          {diagnosis && (
            <>
              <dt className="text-gray-500">Diagnosis</dt>
              <dd className="line-clamp-2 break-words text-gray-800" title={diagnosis}>
                {diagnosis}
              </dd>
            </>
          )}
          {plan && (
            <>
              <dt className="text-gray-500">Plan</dt>
              <dd className="line-clamp-2 break-words text-gray-800" title={plan}>
                {plan}
              </dd>
            </>
          )}
          {bloodPressure && (
            <>
              <dt className="text-gray-500">Blood pressure</dt>
              {/* Flagged in words as well as colour, so red keeps meaning "look at this" */}
              <dd className={bloodPressure.high ? 'font-medium text-red-700' : 'text-gray-800'} title={bloodPressure.message ?? undefined}>
                {bloodPressure.text}
                {bloodPressure.high && ' · High'}
              </dd>
            </>
          )}
        </dl>
      )}

      {/* Phones: a two-column grid. From sm up: one row, visit and billing on the left, records on the right */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:pt-3">
        <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          {onOpenVisit && (
            <button type="button" onClick={() => onOpenVisit(visit)} aria-describedby={metaId} className={actionClass(main === 'open')}>
              <Icon icon="solar:stethoscope-bold-duotone" className={iconClass(main === 'open')} aria-hidden="true" />
              Open visit
            </button>
          )}
          <button
            type="button"
            onClick={() => openTab('billing')}
            aria-label={billingActionName(billing)}
            aria-describedby={metaId}
            className={actionClass(main === 'billing')}
          >
            {/* Phones: "Billing" over the amount and status, which may wrap; from sm up, one line */}
            <span className="flex min-w-0 flex-col items-center sm:flex-row sm:gap-1.5">
              <span className="inline-flex items-center gap-2">
                <Icon icon="solar:wallet-bold-duotone" className={iconClass(main === 'billing')} aria-hidden="true" />
                Billing
              </span>
              {billing.state === 'billed' && (
                <span className="flex flex-wrap justify-center gap-x-1 text-xs sm:text-sm">
                  <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900">{formatNad(billing.total)}</span>
                  <span className={`whitespace-nowrap ${BILLING_TONE[billing.label]}`}>· {billing.label}</span>
                </span>
              )}
              {billing.state === 'not-billed' && <span className="whitespace-nowrap text-xs font-normal">Not billed</span>}
            </span>
          </button>
        </div>
        <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          {records.map((action) => (
            <button
              key={action.tab}
              type="button"
              onClick={() => openTab(action.tab)}
              aria-label={action.countText ? `${action.label}, ${action.countText}` : action.label}
              aria-describedby={metaId}
              className={actionClass(false)}
            >
              <Icon icon={action.icon} className={iconClass(false)} aria-hidden="true" />
              {action.label}
              {action.count > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-semibold leading-none tabular-nums text-gray-700">
                  {action.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

export default JourneyVisitCard;
