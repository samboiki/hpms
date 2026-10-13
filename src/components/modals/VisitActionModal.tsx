import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { getVisitStage, getBackwardMoves, getMoveLabel, STAGE_LABELS, type VisitStage } from '../../utils/visitStage';
import { blocksReopen, INVOICE_LOCK_MESSAGES, loadVisitInvoiceLocks } from '../../utils/invoiceLock';
import type { ReminderStatus } from '../../utils/diary/reminderStatus';
import { ReminderStatusIcon } from '../appointments/diary/ReminderStatusIcon';
import { loadBookingInvoices } from '../../services/bookingLinksService';
import { formatBookingLength } from '../../utils/diary/bookingLength';
import { formatDiaryDate, formatTimeRange, timeToMinutes } from '../../utils/diary/diaryTime';
import type { BookingInvoice } from '../../utils/diary/patientBookings';
import { loadPatientFileStatus } from '../../services/patientFileService';
import { describeMissing, type PatientFileStatus } from '../../utils/patients/temporaryPatient';
import { DIARY_STATUS_COLOUR_STYLES, type DiaryStatus } from '../../utils/diary/diaryStatuses';
import CompletePatientFileModal from '../forms/CompletePatientFileModal';
import { VideoLinkPanel } from '../appointments/diary/VideoLinkPanel';
import { PrevisitBookingPanel } from '../previsit/PrevisitBookingPanel';

interface VisitActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: any;
  visitStatus: 'scheduled' | 'ready' | 'in-progress' | 'handed-off' | 'completed' | 'no-show' | 'cancelled';
  isCheckedIn?: boolean;
  onStartVisit?: () => void;
  onCompleteVisit?: () => void;
  /** Corrects the visit's stage (reopen, back to nurse/doctor, undo check-in or no-show) */
  onMoveToStage?: (stage: VisitStage) => void;
  onHandoffVisit?: () => void;
  onMarkReady?: () => void;
  onCheckIn?: () => void;
  onNoShow?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  /** Administrators only: removes a booking made by mistake, before the patient checks in */
  onDelete?: () => void;
  onSendSMS?: () => void;
  onSendEmail?: () => void;
  onCall?: () => void;
  onViewDetails?: () => void;
  /** Reminder / SMS confirmation status, spelled out (a tooltip on the diary card is not enough on a phone) */
  reminderStatus?: ReminderStatus | null;
  /** Opens the patient's file */
  onOpenPatientFile?: () => void;
  /** Opens the patient's invoices; when given, a visit under way or done shows its invoice here */
  onOpenInvoices?: () => void;
  /** Opens the booking form with this booking's patient, practitioner, type, length and reason at the next free time */
  onBookAgain?: () => void;
  /** Copies the booking; the diary then books it into the free time reception clicks */
  onCopy?: () => void;
  /** The practice's own statuses for the booking's current stage (diaryStatuses.ts diaryStatusChoices) */
  statusChoices?: DiaryStatus[];
  /** The booking's own status as the diary shows it (null: the stage alone) */
  currentStatus?: DiaryStatus | null;
  /** Gives the booking one of the practice's statuses, or none (null) */
  onSetStatus?: (statusId: string | null) => void;
  /** Sets when to call the patient back and why (a recall), from this visit; offered once the visit is under way or done */
  onSetRecall?: () => void;
}

const VisitActionModal: React.FC<VisitActionModalProps> = ({
  isOpen,
  onClose,
  visit,
  visitStatus,
  isCheckedIn = false,
  onStartVisit,
  onCompleteVisit,
  onMoveToStage,
  onHandoffVisit,
  onMarkReady,
  onCheckIn,
  onNoShow,
  onReschedule,
  onCancel,
  onDelete,
  onSendSMS,
  onSendEmail,
  onCall,
  onViewDetails,
  reminderStatus,
  onOpenPatientFile,
  onOpenInvoices,
  onBookAgain,
  onCopy,
  statusChoices = [],
  currentStatus = null,
  onSetStatus,
  onSetRecall
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure the DOM is ready before starting animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for animation to complete before removing from DOM
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 800); // Match this with the transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // A paid invoice or a claim already sent to the fund means the visit can't be reopened: say so up front
  // instead of after staff confirm (the store still re-checks when the move is made)
  const [reopenBlockedReason, setReopenBlockedReason] = useState<string | null>(null);
  const visitId = visit?.id;
  const isCompletedVisit = !!visit && getVisitStage(visit) === 'completed';
  const canMoveStage = !!onMoveToStage;
  useEffect(() => {
    setReopenBlockedReason(null);
    if (!isOpen || !visitId || !isCompletedVisit || !canMoveStage) return;
    let cancelled = false;
    loadVisitInvoiceLocks(visitId)
      .then(locks => {
        const blocking = locks.find(invoice => blocksReopen(invoice.lock));
        if (!cancelled && blocking?.lock) setReopenBlockedReason(INVOICE_LOCK_MESSAGES[blocking.lock]);
      })
      .catch(error => console.error('Could not check the invoice before reopening:', error));
    return () => { cancelled = true; };
  }, [isOpen, visitId, isCompletedVisit, canMoveStage]);

  // The invoice of a visit under way or done, so the booking opens it (booking <-> invoice)
  const [invoices, setInvoices] = useState<BookingInvoice[]>([]);
  const canOpenInvoices = !!onOpenInvoices;
  const hasStarted = !!visit && ['in-progress', 'handed-off', 'completed'].includes(getVisitStage(visit));
  useEffect(() => {
    setInvoices([]);
    if (!isOpen || !visitId || !canOpenInvoices || !hasStarted) return;
    let cancelled = false;
    loadBookingInvoices([visitId])
      .then((loaded) => {
        if (!cancelled) setInvoices(loaded);
      })
      .catch((error) => console.error('Could not load the invoice of the visit:', error));
    return () => {
      cancelled = true;
    };
  }, [isOpen, visitId, canOpenInvoices, hasStarted]);

  // A patient booked with a name and cell only: reception completes the file when they arrive (one tap to the form)
  const patientId: string | null = visit?.patient_id ?? visit?.patient?.id ?? null;
  const [fileStatus, setFileStatus] = useState<PatientFileStatus | null>(null);
  const [isCompletingFile, setIsCompletingFile] = useState(false);
  const [fileCheckCount, setFileCheckCount] = useState(0);
  useEffect(() => {
    setFileStatus(null);
    if (!isOpen || !patientId) return;
    let cancelled = false;
    loadPatientFileStatus(patientId)
      .then((status) => {
        if (!cancelled) setFileStatus(status);
      })
      .catch((error) => console.error('Could not check whether the patient file is complete:', error));
    return () => {
      cancelled = true;
    };
  }, [isOpen, patientId, fileCheckCount]);

  if (!shouldRender || !visit) return null;

  // "Thu 8 Oct 2026, 09:30-10:00 (30 min)" for a diary booking
  const startMinutes = timeToMinutes(typeof visit.time === 'string' ? visit.time : null);
  const bookingWhen =
    typeof visit.date === 'string' && startMinutes !== null && typeof visit.duration === 'number' && visit.duration > 0
      ? `${formatDiaryDate(visit.date)}, ${formatTimeRange(startMinutes, startMinutes + visit.duration)} (${formatBookingLength(visit.duration)})`
      : null;

  const patientName = `${visit.patient?.first_name || ''} ${visit.patient?.last_name || ''}`.trim();
  const currentStage = getVisitStage(visit);
  const backMoves = onMoveToStage ? getBackwardMoves(currentStage) : [];
  // "View Details" opens the visit chart; for a visit under way that means carrying on with the consultation
  const isVisitUnderWay = currentStage === 'in-progress' || currentStage === 'handed-off';

  // Define actions based on visit status
  const getAvailableActions = () => {
    const actions = [];

    // Communication actions - SMS only
    if (visitStatus !== 'completed' && visitStatus !== 'cancelled') {
      actions.push({
        label: 'Send SMS',
        icon: <Icon icon="solar:chat-square-code-bold-duotone" className="w-5 h-5" />,
        onClick: onSendSMS,
        color: 'text-blue-600 hover:bg-blue-50',
        iconColor: 'text-blue-600',
        primary: true
      });
    }

    // Status-specific actions
    if (visitStatus === 'scheduled') {
      if (!isCheckedIn) {
        actions.push({
          label: 'Check In',
          icon: <Icon icon="solar:user-check-rounded-bold-duotone" className="w-5 h-5" />,
          onClick: onCheckIn,
          color: 'text-cyan-600 hover:bg-cyan-50',
          iconColor: 'text-cyan-600',
          divider: true
        });
      } else {
        actions.push({
          label: 'Start Visit',
          icon: <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5" />,
          onClick: onStartVisit,
          color: 'text-emerald-600 hover:bg-emerald-50',
          iconColor: 'text-emerald-600',
          divider: true
        });
      }
    }

    if (visitStatus === 'ready') {
      actions.push({
        label: 'Start Visit',
        icon: <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5" />,
        onClick: onStartVisit,
        color: 'text-emerald-600 hover:bg-emerald-50',
        iconColor: 'text-emerald-600',
        divider: true
      });
    }

    if (visitStatus === 'in-progress') {
      actions.push({
        label: 'Complete Visit',
        icon: <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />,
        onClick: onCompleteVisit,
        color: 'text-green-600 hover:bg-green-50',
        iconColor: 'text-green-600',
        divider: true
      });

      actions.push({
        label: 'Handoff to Nurse',
        icon: <Icon icon="solar:hand-shake-bold-duotone" className="w-5 h-5" />,
        onClick: onHandoffVisit,
        color: 'text-purple-600 hover:bg-purple-50',
        iconColor: 'text-purple-600'
      });
    }

    if (visitStatus === 'handed-off') {
      actions.push({
        label: 'Complete Visit',
        icon: <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />,
        onClick: onCompleteVisit,
        color: 'text-green-600 hover:bg-green-50',
        iconColor: 'text-green-600',
        divider: true
      });
    }

    // Reschedule/cancel only before the consultation starts. Once the patient is with the doctor or
    // nurse, the visit can't be "cancelled"; use the stage corrections below instead.
    if (['scheduled', 'ready'].includes(visitStatus)) {
      actions.push({
        label: 'Reschedule',
        icon: <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5" />,
        onClick: onReschedule,
        color: 'text-amber-600 hover:bg-amber-50',
        iconColor: 'text-amber-600'
      });

      actions.push({
        label: 'Cancel Visit',
        icon: <Icon icon="solar:close-square-bold-duotone" className="w-5 h-5" />,
        onClick: onCancel,
        color: 'text-red-600 hover:bg-red-50',
        iconColor: 'text-red-600'
      });

      // Add Mark No Show for scheduled visits
      if (visitStatus === 'scheduled') {
        actions.push({
          label: 'Mark No Show',
          icon: <Icon icon="solar:user-cross-rounded-bold-duotone" className="w-5 h-5" />,
          onClick: onNoShow,
          color: 'text-orange-600 hover:bg-orange-50',
          iconColor: 'text-orange-600'
        });
      }
    }

    // The next booking from this one, at any stage (a follow-up after the visit, a rebooking after a no-show):
    // the booking form starts filled in and still runs every booking check
    if (onBookAgain) {
      actions.push({
        label: 'Book Again',
        icon: <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5" />,
        onClick: onBookAgain,
        color: 'text-indigo-600 hover:bg-indigo-50',
        iconColor: 'text-indigo-600'
      });
    }
    // When to call the patient back, and why (parity O3): the "Recall due" list calls them on that day
    if (onSetRecall && hasStarted) {
      actions.push({
        label: 'Set Recall',
        icon: <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5" />,
        onClick: onSetRecall,
        color: 'text-indigo-600 hover:bg-indigo-50',
        iconColor: 'text-indigo-600'
      });
    }
    if (onCopy) {
      actions.push({
        label: 'Copy',
        icon: <Icon icon="solar:copy-bold-duotone" className="w-5 h-5" />,
        onClick: onCopy,
        color: 'text-gray-600 hover:bg-gray-50',
        iconColor: 'text-gray-600'
      });
    }

    // A booking made by mistake: administrators can delete it until the patient checks in
    if (onDelete && ['scheduled', 'cancelled', 'no-show'].includes(visitStatus) && !isCheckedIn) {
      actions.push({
        label: 'Delete Booking',
        icon: <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5" />,
        onClick: onDelete,
        color: 'text-red-700 hover:bg-red-50',
        iconColor: 'text-red-700',
        divider: true
      });
    }

    // View details action
    actions.push({
      label: 'View Details',
      icon: <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />,
      onClick: onViewDetails,
      color: 'text-gray-600 hover:bg-gray-50',
      iconColor: 'text-gray-600',
      divider: true
    });

    return actions;
  };

  const actions = getAvailableActions();

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] transition-all duration-700 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Modal: bottom sheet on phones (up to full height, header fixed, actions scroll), centred from sm */}
      <div
        className="fixed inset-0 flex items-end sm:items-center justify-center z-[9999] sm:p-4 pointer-events-none"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="visit-actions-title"
          className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[100dvh] sm:max-h-[90vh] flex flex-col transition-all duration-700 ease-in-out motion-reduce:transition-none pointer-events-auto overflow-hidden ${
          isVisible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-8'
        }`}>
          {/* Header */}
          <div className="relative flex-none overflow-hidden border-b border-gray-200">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="visit-actions-title" className="text-xl sm:text-2xl font-bold text-gray-900">Visit Actions</h3>
                  <p className="text-gray-600 text-base truncate" title={patientName}>{patientName}</p>
                  {bookingWhen && <p className="text-xs text-gray-500">{bookingWhen}</p>}
                  {(onOpenPatientFile || invoices.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {onOpenPatientFile && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenPatientFile();
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                        >
                          <Icon icon="solar:user-id-bold-duotone" className="h-4 w-4 text-purple-500" aria-hidden="true" />
                          Patient file
                        </button>
                      )}
                      {onOpenInvoices && invoices.map((invoice) => (
                        <button
                          key={invoice.id}
                          type="button"
                          onClick={() => {
                            onOpenInvoices();
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                        >
                          <Icon icon="solar:bill-list-bold-duotone" className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                          Invoice {invoice.number}
                          {invoice.paymentStatus === 'paid' ? ' (paid)' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  {reminderStatus && (
                    <div className="mt-2 flex items-start gap-2">
                      <ReminderStatusIcon status={reminderStatus} showLabel />
                      <p className="min-w-0 break-words text-xs text-gray-500">{reminderStatus.detail}</p>
                    </div>
                  )}
                  {/* A video consultation: its room link, copied or joined from here (parity B16) */}
                  <VideoLinkPanel
                    link={visit.video_link}
                    patient={patientId ? { id: patientId, firstName: visit.patient?.first_name || '', lastName: visit.patient?.last_name || '', cellNumber: visit.patient?.cell_number ?? null } : null}
                    visitId={visit.id}
                  />
                  {/* The practice's own statuses for this stage ("Called, no answer"): one tap; the stage itself means none */}
                  {onSetStatus && statusChoices.length > 0 && (
                    <div role="group" aria-label="Booking status" className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-500">Status:</span>
                      {[null, ...statusChoices].map((choice) => {
                        const pressed = (currentStatus?.id ?? null) === (choice?.id ?? null);
                        const style = choice ? DIARY_STATUS_COLOUR_STYLES[choice.colour] : null;
                        return (
                          <button
                            key={choice?.id ?? 'stage'}
                            type="button"
                            aria-pressed={pressed}
                            onClick={() => {
                              if (!pressed) onSetStatus(choice?.id ?? null);
                              onClose();
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                              style ? style.chip : 'bg-white text-gray-700 ring-gray-300'
                            } ${pressed ? 'outline outline-2 outline-offset-1 outline-purple-500' : 'hover:bg-opacity-70'}`}
                          >
                            {style && <span className={`h-2 w-2 flex-none rounded-full ${style.dot}`} aria-hidden="true" />}
                            {choice ? choice.name : STAGE_LABELS[currentStage]}
                            {pressed && <Icon icon="solar:check-circle-bold-duotone" className="h-3.5 w-3.5 flex-none" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close visit actions"
                  title="Close"
                  className="flex-none p-2 rounded-xl hover:bg-gray-100 transition-all duration-200"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Actions List with Premium Styling */}
          <div className="flex-1 min-h-0 p-4 sm:p-6 md:p-8 overflow-y-auto bg-gray-50/50">
            <div className="space-y-4">
              {/* Booked with a name and cell only: prompt reception to complete the file when the patient arrives */}
              {fileStatus?.incomplete && patientId && (
                <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:user-id-bold-duotone" className="mt-0.5 h-6 w-6 flex-none text-amber-600" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-amber-900">New patient: complete the file</p>
                      <p className="text-sm text-amber-900">
                        Still needed: {describeMissing(fileStatus.missing)}, and the medical aid if the patient has one. Medical aid
                        claims wait until the file is complete.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCompletingFile(true)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 sm:w-auto"
                  >
                    <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    Complete file
                  </button>
                </div>
              )}

              {/* The practice's questions before the visit: tablet, SMS link, answers (parity B17); hidden without questions */}
              <PrevisitBookingPanel visit={visit} canAsk={visitStatus === 'scheduled' || visitStatus === 'ready'} />

              {actions.filter(action => action.label !== 'Handoff to Nurse').map((action, index) => {
                // Determine if this is a priority action
                const isPriority = (
                  (visitStatus === 'scheduled' && isCheckedIn && action.label === 'Start Visit') ||
                  (visitStatus === 'scheduled' && !isCheckedIn && action.label === 'Check In') ||
                  (visitStatus === 'ready' && action.label === 'Start Visit') ||
                  (visitStatus === 'in-progress' && action.label === 'Complete Visit')
                );

                const isGridAction = !isPriority && action.label !== 'Send SMS' && action.label !== 'View Details';
                const isBottomAction = action.label === 'Send SMS' || action.label === 'View Details';

                if (isPriority) {
                  // Full-width priority action
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (action.onClick) {
                          action.onClick();
                          onClose();
                        }
                      }}
                      className="w-full group relative overflow-hidden rounded-xl transition-all duration-200 transform hover:scale-[1.02] border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50"
                      disabled={!action.onClick}
                    >
                      <div className="relative z-10 flex items-center gap-4 p-6">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                          action.label === 'Check In' ? 'bg-purple-100' :
                          action.label === 'Start Visit' ? 'bg-emerald-100' :
                          action.label === 'Complete Visit' ? 'bg-green-100' :
                          'bg-gray-100'
                        }`}>
                          <div className={
                            action.label === 'Check In' ? 'text-purple-600' :
                            action.label === 'Start Visit' ? 'text-emerald-600' :
                            action.label === 'Complete Visit' ? 'text-green-600' :
                            'text-gray-600'
                          }>
                            {React.cloneElement(action.icon, { className: 'w-5 h-5' })}
                          </div>
                        </div>
                        <div className="flex-1 text-left">
                          <span className="block font-semibold text-gray-800 text-lg">{action.label}</span>
                          <span className="block text-xs text-gray-500 mt-1">
                            {action.label === 'Start Visit' && 'Begin the consultation with the patient'}
                            {action.label === 'Check In' && 'Mark patient as arrived at the practice'}
                            {action.label === 'Complete Visit' && 'Finish and close the visit record'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                }

                return null;
              })}

              {/* Secondary Actions - Responsive Grid */}
              {(() => {
                const secondaryActions = actions.filter(action =>
                  (action.label !== 'Handoff to Nurse' || !!onHandoffVisit) &&
                  action.label !== 'Send SMS' &&
                  action.label !== 'View Details' &&
                  action.label !== 'Mark No Show' && // Exclude Mark No Show from grid
                  !(
                    (visitStatus === 'scheduled' && isCheckedIn && action.label === 'Start Visit') ||
                    (visitStatus === 'scheduled' && !isCheckedIn && action.label === 'Check In') ||
                    (visitStatus === 'ready' && action.label === 'Start Visit') ||
                    (visitStatus === 'in-progress' && action.label === 'Complete Visit')
                  )
                );

                const markNoShowAction = actions.find(action => action.label === 'Mark No Show');
                // One column on phones, so an action's icon and label never squeeze into a third of the sheet
                const gridCols = secondaryActions.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';

                return (
                  <>
                  <div className={`grid ${gridCols} gap-3 sm:gap-4`}>
                    {secondaryActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (action.onClick) {
                            action.onClick();
                            onClose();
                          }
                        }}
                        className="group relative overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg"
                        disabled={!action.onClick}
                      >
                        <div className="relative z-10 flex items-center gap-3 px-4 py-4 h-full bg-white group-hover:bg-gray-50 border border-gray-200 group-hover:border-gray-300 rounded-xl transition-all duration-200">
                          <div className="flex-shrink-0">
                            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                              action.label === 'Cancel Visit' || action.label === 'Delete Booking'
                              ? 'bg-red-100'
                              : action.label === 'Reschedule' || action.label === 'Book Again' || action.label === 'Set Recall'
                              ? 'bg-indigo-100'
                              : action.label === 'Handoff to Nurse'
                              ? 'bg-purple-100'
                              : 'bg-gray-100'
                            }`}>
                              <div className={
                                action.label === 'Cancel Visit' || action.label === 'Delete Booking'
                                ? 'text-red-600'
                                : action.label === 'Reschedule' || action.label === 'Book Again' || action.label === 'Set Recall'
                                ? 'text-indigo-600'
                                : action.label === 'Handoff to Nurse'
                                ? 'text-purple-600'
                                : 'text-gray-600'
                              }>
                                {React.cloneElement(action.icon, { className: 'w-5 h-5' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 text-left">
                            <span className="block font-semibold text-gray-700 text-base">{action.label}</span>
                            <span className="block text-xs text-gray-500 mt-1">
                              {action.label === 'Cancel Visit' && 'Cancel appointment'}
                              {action.label === 'Mark No Show' && 'Patient didn\'t arrive'}
                              {action.label === 'Reschedule' && 'Change date/time'}
                              {action.label === 'Start Visit' && 'Begin consultation'}
                              {action.label === 'Check In' && 'Mark as arrived'}
                              {action.label === 'Complete Visit' && 'Finish visit'}
                              {action.label === 'Handoff to Nurse' && 'Send to nurse for a procedure'}
                              {action.label === 'Delete Booking' && 'Remove a booking made by mistake'}
                              {action.label === 'Book Again' && 'Same patient and practitioner, next free time'}
                              {action.label === 'Copy' && 'Then click a free time in the diary'}
                              {action.label === 'Set Recall' && 'When to call the patient back, and why'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Mark No Show - Full Width */}
                  {markNoShowAction && (
                    <button
                      onClick={() => {
                        if (markNoShowAction.onClick) {
                          markNoShowAction.onClick();
                          onClose();
                        }
                      }}
                      className="w-full group relative overflow-hidden rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg mt-4"
                      disabled={!markNoShowAction.onClick}
                    >
                      <div className="relative z-10 flex items-center gap-4 px-6 py-5 bg-white group-hover:bg-gray-50 border border-gray-200 group-hover:border-gray-300 rounded-xl transition-all duration-200">
                        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl">
                          <div className="text-orange-600">
                            {React.cloneElement(markNoShowAction.icon, { className: 'w-5 h-5' })}
                          </div>
                        </div>
                        <div className="flex-1 text-left">
                          <span className="block font-semibold text-gray-700 text-lg">Mark No Show</span>
                          <span className="block text-xs text-gray-500 mt-1">Patient didn't arrive for their scheduled appointment</span>
                        </div>
                      </div>
                    </button>
                  )}
                  </>
                );
              })()}

              {/* Stage corrections: reopen, back to nurse/doctor, undo check-in or no-show */}
              {backMoves.length > 0 && onMoveToStage && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    {currentStage === 'completed' ? 'Completed by mistake? Reopen the visit' : 'Correct the stage'}
                  </p>
                  <p className="text-xs text-amber-800/80 mt-0.5">
                    Currently: {STAGE_LABELS[currentStage]}
                  </p>
                  {reopenBlockedReason && currentStage === 'completed' ? (
                    <p className="mt-3 text-sm text-amber-900">{reopenBlockedReason}</p>
                  ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {backMoves.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => {
                          onMoveToStage(stage);
                          onClose();
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-amber-300 text-amber-900 text-sm font-medium hover:bg-amber-100 transition-colors"
                      >
                        <Icon icon="solar:undo-left-round-bold-duotone" className="w-4 h-4" />
                        {getMoveLabel(currentStage, stage)}
                      </button>
                    ))}
                  </div>
                  )}
                </div>
              )}

              {/* Bottom Actions */}
              <div className="space-y-3 border-t border-gray-200 pt-6">
                {actions.filter(action => action.label === 'Send SMS' || action.label === 'View Details').map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (action.onClick) {
                        action.onClick();
                        onClose();
                      }
                    }}
                    className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md"
                    disabled={!action.onClick}
                  >
                    <div className={`relative z-10 flex items-center gap-4 px-5 py-4 ${
                      action.label === 'Send SMS'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                      : action.label === 'View Details'
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200'
                    }`}>
                      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                        action.label === 'Send SMS' || action.label === 'View Details'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {action.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <span className={`block font-medium text-sm ${
                          action.label === 'Send SMS' || action.label === 'View Details'
                          ? 'text-white'
                          : 'text-gray-700'
                        }`}>{action.label === 'View Details' && isVisitUnderWay ? 'Open Visit' : action.label}</span>
                        <span className={`block text-xs mt-0.5 ${
                          action.label === 'Send SMS' || action.label === 'View Details'
                          ? 'text-white/80'
                          : 'text-gray-500'
                        }`}>
                          {action.label === 'Send SMS' && 'Send a text message to the patient'}
                          {action.label === 'View Details' && (isVisitUnderWay ? 'Continue notes, billing and orders' : 'See complete visit information')}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {patientId && (
        <CompletePatientFileModal
          patientId={patientId}
          isOpen={isCompletingFile}
          onClose={() => {
            setIsCompletingFile(false);
            // Read the file again: a completed file no longer shows the prompt
            setFileCheckCount((count) => count + 1);
          }}
        />
      )}
    </>,
    document.body
  );
};

export default VisitActionModal;