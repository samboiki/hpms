import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  Phone,
  AlertCircle,
  Trash2,
  Edit2,
  MoreVertical,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  XCircle,
  Stethoscope,
  Activity,
  Settings,
  MessageCircle,
  User,
  Calendar,
  Timer,
  Clipboard,
  HandshakeIcon,
  CheckCircle2,
  PhoneIcon,
  TestTube,
  RefreshCcw
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  parseISO,
  setHours,
  setMinutes,
  isToday,
  getHours,
  getMinutes,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth
} from 'date-fns';
// Removed motion animations for professional stability
import FormModal from './modals/FormModal';
import PremiumAddAppointmentForm from './forms/PremiumAddAppointmentForm';
import { PremiumDayGridView } from './appointments/PremiumDayGridView';
import { PremiumWeekGridView } from './appointments/PremiumWeekGridView';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useTheme } from '../stores/themeStore';
import DuotoneIcon from './icons/DuotoneIcon';
import { Icon } from '@iconify/react';
import VisitActionModal from './modals/VisitActionModal';
import BookingRequestModal from './modals/BookingRequestModal';
import EnhancedSmsModal from './messages/EnhancedSmsModal';
import { useVisitsStore } from '../stores/visitsStore';
import { HandoffCardPrintButtons } from './dashboard/HandoffCardPrintButtons';
import { formatDoctorName } from '../utils/formatDoctorName';
import { getVisitStage, getMoveConfirmMessage, STAGE_LABELS, type VisitStage } from '../utils/visitStage';
import { BlockTimeModal } from './appointments/diary/BlockTimeModal';
import { DiaryDayNotices } from './appointments/diary/DiaryDayNotices';
import { ReminderStatusIcon } from './appointments/diary/ReminderStatusIcon';
import { VideoBookingIcon } from './appointments/diary/VideoBookingIcon';
import { useDiaryWaitingList } from './appointments/diary/useDiaryWaitingList';
import { DiaryStatusLabel } from './appointments/diary/DiaryStatusLabel';
import { DiaryBillingBadge } from './appointments/diary/DiaryBillingBadge';
import { RecallSheet } from './patientLists/RecallSheet';
import { PremiumMonthGridView } from './appointments/PremiumMonthGridView';
import { RemindPatientsModal } from './appointments/diary/RemindPatientsModal';
import { DiarySettingsModal, type DiarySettingsTab } from './appointments/diary/DiarySettingsModal';
import { DiaryMoreMenu } from './appointments/diary/DiaryMoreMenu';
import { DiaryReportModal } from './appointments/diary/DiaryReportModal';
import { CopiedBookingBanner } from './appointments/diary/CopiedBookingBanner';
import { PractitionerFilterModal } from './appointments/diary/PractitionerFilterModal';
import { useDiaryBlocks } from '../hooks/useDiaryBlocks';
import { useDiaryDefault } from '../hooks/useDiaryDefault';
import { useDiarySettings } from '../hooks/useDiarySettings';
import { useReminderStatuses } from '../hooks/useReminderStatuses';
import { useVisitBillingBadges } from '../hooks/useVisitBillingBadges';
import { useAccountFlagSummaries } from './finance/debtors/useAccountFlags';
import { checkBooking, findNextFreeSlotFor } from '../services/diaryService';
import { blocksOnDay } from '../utils/diary/blockedTime';
import { bookAgainFrom, pastePractitioner, prefillFromBooking, type BookingPrefill } from '../utils/diary/bookingCopy';
import { formatBookingLength, resolveBookingLength } from '../utils/diary/bookingLength';
import { describeDiaryView, resolveDiaryView, sameDiaryView, type DiaryView } from '../utils/diary/diaryDefaultView';
import { focusedDiaryView, type DiaryDayFocus } from '../utils/diary/diaryDayFocus';
import { freedSlotOf, type DiarySlot } from '../utils/diary/waitingList';
import { diaryRangeFor } from '../utils/diary/diaryRange';
import { minutesToTime, parseDateKey, timeToMinutes, toDateKey } from '../utils/diary/diaryTime';
import { bookingLinks } from '../utils/diary/patientBookings';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { diaryHolidayOn } from '../utils/diary/holidays';
import { practitionerDayHours, practitionerHoursResolver } from '../utils/diary/workingHours';
import { loadPracticeBusinessHours } from '../services/diarySettingsService';
import { practiceHoursResolver } from '../utils/diary/nextFreeSlot';
import { diaryDayColumns, diaryPractitioners, workingHoursStaff, type DiaryPractitioner, type DiaryStaffMember } from '../utils/diary/diaryPractitioners';
import { describeWorkingDay, offHourSpans, shownGridRange, type OffHourSpan } from '../utils/diary/gridHours';
import { gridRowMinutes, gridSlotFor, startStepFor } from '../utils/diary/slotLength';
import { diaryStatusChoices, shownDiaryStatus, type DiaryStatus } from '../utils/diary/diaryStatuses';
import type { AppointmentType } from '../utils/diary/appointmentTypes';
import { formatRole } from './settings/UserManagement/staffUtils';

interface AppointmentPatient {
  id: string;
  first_name: string;
  last_name: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
}

interface Appointment {
  id: string;
  patient: AppointmentPatient;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  /** Minutes the booking takes in the diary (worked out below from duration_minutes and the type) */
  duration: number;
  /** The booked length as stored (visits.duration_minutes); null = the practice's default for the type */
  duration_minutes?: number | null;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'pending' | 'scheduled' | 'ready' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  /** The reason reception typed (visits.chief_complaint); "Book again" and "Copy" carry it over */
  reason?: string | null;
  is_checked_in?: boolean;
  is_ready?: boolean;
  is_confirmed?: boolean;
  is_cancelled?: boolean;
  is_handoff?: boolean;
  is_from_website?: boolean;
  /** The practice's own status of the booking (src/utils/diary/diaryStatuses.ts) */
  diary_status_id?: string | null;
  /** The practice's appointment type the booking was made as (src/utils/diary/appointmentTypes.ts) */
  appointment_type_id?: string | null;
  /** A video consultation's room link (src/utils/diary/videoBookings.ts); null = seen in the rooms */
  video_link?: string | null;
}

/** A member of the practice's staff (any role); src/utils/diary/diaryPractitioners.ts decides who gets a column */
interface StaffMember {
  id: string;
  email: string;
  /** false once deactivated (their bookings stay in view) */
  is_active?: boolean | null;
  user_metadata?: {
    full_name?: string;
    role?: string;
  };
}

interface BlockedTime {
  id: string;
  doctor_id: string;
  start_time: string;
  end_time: string;
  reason: string;
}

/** Where the booking form starts: a free time clicked in a grid, "Book again", or a copy pasted into a free time */
interface BookingFormStart {
  /** null: no date yet ("Book again" found no free time), reception chooses */
  date: Date | null;
  time?: string;
  /** The column or slot's practitioner: wins over the copy's and the user's default */
  doctorId?: string;
  copy?: BookingPrefill;
  /** Made by pasting the copy: the copy is done once this booking is saved */
  pasted?: boolean;
}

interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_date?: string;
  scheduled_time?: string;
  visit_date?: string;
  visit_time?: string;
  is_cancelled: boolean;
  /** Minutes the visit takes in the diary (worked out from its booked length or type) */
  duration?: number;
}

interface PremiumAppointmentSchedulerProps {
  appointments: Appointment[];
  /** Everyone in the practice, any role, active or not (the diary works out who treats) */
  staff: StaffMember[];
  blockedTimes: BlockedTime[];
  visits?: Visit[];
  isLoading: boolean;
  error: Error | null;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onEditAppointment?: (appointment: Appointment) => void;
  onEditVisit?: (visit: any) => void;
  onCreateAppointment: (doctorId: string, date: string, time: string) => void;
  onBlockTime: (doctorId: string, startTime: string, endTime: string, reason: string) => void;
  onDeleteAppointment?: (appointmentId: string) => void;
  currentUserRole: 'admin' | 'doctor' | 'nurse' | 'receptionist';
  currentUserId: string;
  onRefresh?: () => void;
  viewMode?: 'day' | 'week' | 'month' | 'all';
  internalViewMode?: 'timeline' | 'grid';
  onInternalViewModeChange?: (mode: 'timeline' | 'grid') => void;
  /** The practice whose diary this is (blocked time is stored per practice) */
  practiceId?: string | null;
  /** Switches between the day, week and month views (the dashboard loads the matching range) */
  onViewModeChange?: (mode: 'day' | 'week' | 'month') => void;
  /**
   * The booking a diary link was made for (src/utils/diary/diaryDayFocus.ts), kept in view on arrival: its
   * practitioner's column joins the view, and a cancelled booking shows the cancelled bookings. Applied once per link.
   */
  diaryFocus?: DiaryDayFocus | null;
  /**
   * The time a booking cancelled outside the diary freed (the Reschedule form's Cancel Appointment): offered to the
   * waiting list as after Cancel Visit. Applied once per slot.
   */
  freedSlot?: DiarySlot | null;
}

// Constants
const HOUR_HEIGHT = 60;
const TIME_SLOT_INTERVAL = 30;
const BUSINESS_HOURS = {
  start: 7,
  end: 23,
};

// Premium color scheme matching patients page
const getStatusGradient = (status: Appointment['status']) => {
  switch (status) {
    case 'pending':
      return 'from-yellow-400 to-yellow-500';
    case 'scheduled':
      return 'from-[#01b9d5] to-[#0196be]';
    case 'ready':
      return 'from-green-500 to-green-600';
    case 'in-progress':
      return 'from-amber-500 to-amber-600';
    case 'completed':
      return 'from-gray-400 to-gray-500';
    case 'cancelled':
      return 'from-red-400 to-red-500';
    case 'no-show':
      return 'from-orange-400 to-orange-500';
    default:
      return 'from-gray-400 to-gray-500';
  }
};

const getTypeAccent = (type: Appointment['type']) => {
  switch (type) {
    case 'consultation':
      return 'border-l-4 border-[#01b9d5]';
    case 'follow-up':
      return 'border-l-4 border-purple-500';
    case 'procedure':
      return 'border-l-4 border-amber-500';
    case 'emergency':
      return 'border-l-4 border-red-500 animate-pulse';
    default:
      return 'border-l-4 border-gray-400';
  }
};

const getStatusIcon = (status: Appointment['status']) => {
  switch (status) {
    case 'pending':
      return AlertCircle;
    case 'scheduled':
      return CalendarIcon;
    case 'ready':
      return CheckCircle;
    case 'in-progress':
      return Activity;
    case 'completed':
      return CheckCircle;
    case 'cancelled':
      return XCircle;
    case 'no-show':
      return AlertCircle;
    default:
      return CalendarIcon;
  }
};

const getStatusColorClasses = (status: Appointment['status']) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'ready':
      return 'bg-green-100 text-green-800';
    case 'in-progress':
      return 'bg-orange-100 text-orange-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'no-show':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

type StatusFilterKey = 'pending' | 'scheduled' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled';

// Puts every appointment in exactly one status chip, so chip counts always add up to the total shown
// VisitActionModal names a checked-in patient "ready"; every other stage keeps its name
const toActionModalStatus = (stage: VisitStage) => (stage === 'checked-in' ? 'ready' : stage);

const getStatusFilterKey = (apt: Appointment): StatusFilterKey => {
  if (apt.status === 'cancelled' || apt.status === 'no-show' || apt.is_cancelled) return 'cancelled';
  if (apt.status === 'completed') return 'completed';
  // Handed-off visits are still open consultations (status stays in-progress)
  if (apt.status === 'in-progress' || apt.is_handoff) return 'in-progress';
  // Dashboard maps is_checked_in / is_ready to status 'ready'
  if (apt.status === 'ready' || apt.is_checked_in || apt.is_ready) return 'checked-in';
  // Unconfirmed visits, including website booking requests
  if (apt.status === 'pending' || !apt.is_confirmed) return 'pending';
  return 'scheduled';
};

// Badge text in plain words (staff never see raw values like 'no-show'). 'pending' means not yet
// confirmed, which is not a visit stage, so it keeps its own word
const getStatusBadgeLabel = (apt: Appointment): string =>
  apt.status === 'pending' ? 'Pending' : STAGE_LABELS[getVisitStage(apt)];

// A website booking request still waiting for the practice to confirm it: it opens the request, not the visit
const isBookingRequest = (apt: Appointment): boolean => apt.status === 'scheduled' && !apt.is_confirmed && !!apt.is_from_website;

// Before the practice's statuses and types load (or when it has none): the same empty lists on every render
const NO_DIARY_STATUSES: DiaryStatus[] = [];
const NO_APPOINTMENT_TYPES: AppointmentType[] = [];

// A diary column as the time grids draw it
const toGridColumn = (practitioner: DiaryPractitioner) => ({
  id: practitioner.id,
  email: '',
  user_metadata: { full_name: practitioner.name, role: practitioner.role ?? '' }
});

const PremiumAppointmentScheduler: React.FC<PremiumAppointmentSchedulerProps> = (props) => {
  const {
    appointments: bookedAppointments,
    staff,
    blockedTimes,
    visits = [],
    isLoading,
    error,
    selectedDate,
    onDateChange,
    onAppointmentClick,
    onEditAppointment,
    onCreateAppointment,
    onBlockTime,
    onDeleteAppointment,
    currentUserRole,
    currentUserId,
    onRefresh,
    viewMode = 'week',
    internalViewMode: externalInternalViewMode,
    onInternalViewModeChange
  } = props;

  const { currentTheme } = useTheme();
  // The booking's links: the patient file and the invoices
  const navigate = useNavigate();

  // Get practice_id from localStorage or from the first appointment
  const storedPracticeId = localStorage.getItem('selectedPracticeId');
  const firstAppointmentPracticeId = bookedAppointments.length > 0 ? bookedAppointments[0].practice_id : '';
  const practiceId = storedPracticeId || firstAppointmentPracticeId || '';

  // Booking lengths per visit type, working hours and reminder settings (Diary settings)
  const diarySettings = useDiarySettings(props.practiceId || practiceId || null);
  const typeLengths = diarySettings.settings.lengths;
  // Each practitioner's slot (grid rows, start times, "Next free slot") and the practice's own statuses and types
  const practitionerSlots = diarySettings.settings.slots;
  const diaryStatuses = diarySettings.statuses ?? NO_DIARY_STATUSES;
  const appointmentTypes = diarySettings.appointmentTypes ?? NO_APPOINTMENT_TYPES;
  // Each booking as long as it was booked, else its type's default: the grids size cards by it
  const appointments = useMemo<Appointment[]>(
    () => bookedAppointments.map((apt) => ({ ...apt, duration: resolveBookingLength({ duration_minutes: apt.duration_minutes, visit_type: apt.type }, typeLengths) })),
    [bookedAppointments, typeLengths]
  );
  // The day's visits (the day grid's free/taken check) with the same lengths
  const visitsWithLength = useMemo<Visit[]>(() => {
    const lengthById = new Map(appointments.map((apt) => [apt.id, apt.duration]));
    return visits.map((visit) => ({ ...visit, duration: lengthById.get(visit.id) }));
  }, [visits, appointments]);

  // Whose bookings the diary shows (src/utils/diary/diaryDefaultView.ts): the user's saved default, else a doctor
  // their own column and everyone else all practitioners, until the user picks others in the practitioner filter.
  // Worked out on every render, so it follows the signed-in user and the saved default as they load
  const diaryDefault = useDiaryDefault(currentUserId || null);
  const [pickedView, setPickedView] = useState<DiaryView | null>(null);
  const activeStaffIds = useMemo(
    () => (staff.length > 0 ? staff.filter((member) => member.is_active !== false).map((member) => member.id) : null),
    [staff]
  );
  const defaultView = useMemo(
    () => resolveDiaryView({ role: currentUserRole, userId: currentUserId, saved: diaryDefault.saved, activeStaffIds }),
    [currentUserRole, currentUserId, diaryDefault.saved, activeStaffIds]
  );
  const selectedPractitionerIds: DiaryView = pickedView ?? defaultView;
  // The one practitioner shown, when only one is: blocked time, reminders and new bookings start with them
  const selectedDoctorId = selectedPractitionerIds.length === 1 ? selectedPractitionerIds[0] : null;
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<BookingFormStart | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // A new booking form for every opening, so it always starts from what was clicked or copied
  const [bookingFormKey, setBookingFormKey] = useState(0);
  // "Copy" in the visit actions: the next free time clicked in a grid gets this booking
  const [copiedBooking, setCopiedBooking] = useState<BookingPrefill | null>(null);
  const [internalViewMode, setInternalViewMode] = useState<'timeline' | 'grid'>(externalInternalViewMode || 'grid');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [selectedVisitForAction, setSelectedVisitForAction] = useState<Appointment | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  // "Set Recall" in a visit's actions: the visit the recall is set from
  const [recallBooking, setRecallBooking] = useState<Appointment | null>(null);
  const [selectedVisitForSMS, setSelectedVisitForSMS] = useState<Appointment | null>(null);
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
  const [selectedBookingRequest, setSelectedBookingRequest] = useState<Appointment | null>(null);
  const [isBookingRequestModalOpen, setIsBookingRequestModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isRemindOpen, setIsRemindOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<DiarySettingsTab | null>(null);
  // A link from elsewhere (Communications > Automations) opens the diary settings: /?diarySettings=reminders
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedSettingsTab = searchParams.get('diarySettings');
  useEffect(() => {
    if (linkedSettingsTab !== 'reminders' && linkedSettingsTab !== 'lengths' && linkedSettingsTab !== 'hours' && linkedSettingsTab !== 'statuses') return;
    setSettingsTab(linkedSettingsTab);
    // Dropped once read (replace), so Back or a refresh does not open it again
    const next = new URLSearchParams(searchParams);
    next.delete('diarySettings');
    setSearchParams(next, { replace: true });
  }, [linkedSettingsTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle Mark Ready - sets is_ready flag in visits table
  const handleMarkReady = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { markPatientReady } = useVisitsStore.getState();
      await markPatientReady(visitId);
      
      toast.success('Patient marked as ready!');
    } catch (error) {
      console.error('Error marking patient ready:', error);
      toast.error('Failed to mark patient ready');
    }
  };

  // Handle Start Visit - changes status to in-progress, then opens the consultation screen
  const handleStartVisit = async (appointment: Appointment) => {
    try {
      // Use visitsStore action for immediate state update
      const { startVisit } = useVisitsStore.getState();
      await startVisit(appointment.id);
      
      toast.success('Visit started!');
    } catch (error) {
      console.error('Error starting visit:', error);
      toast.error('Failed to start visit');
      return;
    }

    // Open the chart the same way "View Details" does so the doctor lands in the consultation
    if (props.onEditVisit) {
      props.onEditVisit(appointment);
    } else {
      onAppointmentClick(appointment);
    }
  };

  // Handle Check In - sets is_checked_in flag in visits table
  const handleCheckIn = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { checkInPatient } = useVisitsStore.getState();
      await checkInPatient(visitId);
      
      toast.success('Patient checked in successfully!');
    } catch (error) {
      console.error('Error checking in patient:', error);
      toast.error('Failed to check in patient');
    }
  };

  // Handle Complete Visit - changes status to completed
  const handleCompleteVisit = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { completeVisit } = useVisitsStore.getState();
      await completeVisit(visitId);
      
      toast.success('Visit marked as completed!');
    } catch (error) {
      console.error('Error completing visit:', error);
      toast.error('Failed to complete visit');
    }
  };

  // Correct a visit's stage: reopen a completed visit (to doctor or nurse), take a patient back
  // from the nurse, undo a check-in, or undo a no-show when the patient arrives late
  const handleMoveToStage = async (appointment: Appointment, stage: VisitStage) => {
    const from = getVisitStage(appointment);
    if (!window.confirm(getMoveConfirmMessage(from, stage))) return;
    try {
      await useVisitsStore.getState().moveVisitToStage(appointment.id, stage, from);
      toast.success(`Moved to: ${STAGE_LABELS[stage]}`);
    } catch (error) {
      console.error('Error changing visit stage:', error);
      // The store's own refusals are plain words (an Error); a database error object keeps its wording to the console
      toast.error((error instanceof Error && error.message) || 'Could not change the visit stage. Please try again.', { duration: 6000 });
    }
  };

  // The practice's own status ("Called, no answer"): words on the booking; the stage, and so billing and reminders,
  // stay as they are. Every change to visits goes to the audit log (a database trigger)
  const handleSetStatus = async (appointment: Appointment, statusId: string | null) => {
    const status = statusId ? diaryStatuses.find((item) => item.id === statusId) : null;
    try {
      await useVisitsStore.getState().updateVisit(appointment.id, { diary_status_id: statusId });
      toast.success(status ? `Status: ${status.name}` : `Status: ${STAGE_LABELS[getVisitStage(appointment)]}`);
    } catch (error) {
      console.error('Error setting the booking status:', error);
      toast.error((error instanceof Error && error.message) || 'Could not set the status. Please try again.');
    }
  };

  // Doctor hands the patient to the nurse (procedure, injection, dressing) without closing the visit
  const handleHandoffVisit = async (visitId: string) => {
    try {
      await useVisitsStore.getState().handoffVisit(visitId);
      toast.success('Handed off to nurse');
    } catch (error) {
      console.error('Error handing off visit:', error);
      toast.error('Could not hand off the visit. Please try again.');
    }
  };

  // Handle Re-schedule - changes status back to scheduled from completed or cancelled
  const handleRevertToScheduled = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'scheduled',
          is_ready: false, // Reset ready status
          is_checked_in: false, // Reset checked in status
          is_cancelled: false, // Reset cancelled status
          is_confirmed: true, // Set as confirmed when rescheduling
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;
      
      toast.success('Visit rescheduled successfully!');
      
      // Don't refresh - let real-time subscription handle updates to prevent flickering
    } catch (error) {
      console.error('Error rescheduling visit:', error);
      toast.error('Failed to reschedule visit');
    }
  };

  // Handle Cancel Visit - marks visit as cancelled
  const handleCancelVisit = async (visitId: string) => {
    if (!window.confirm('Cancel this appointment? The patient will no longer be expected at this time.')) return;
    try {
      // Use visitsStore action for immediate state update
      const { cancelVisit } = useVisitsStore.getState();
      await cancelVisit(visitId);

      toast.success('Appointment cancelled');
      // Its time is free again: the waiting list says who could take it (nothing when nobody fits)
      const cancelled = appointments.find((apt) => apt.id === visitId);
      const freed = cancelled ? freedSlotOf(cancelled) : null;
      if (freed) waitingList.slotFreed(freed);
    } catch (error) {
      console.error('Error cancelling visit:', error);
      toast.error('Could not cancel the appointment. Please try again.');
    }
  };

  // Administrators: delete a booking made by mistake (the database allows it only before the patient checks in)
  const handleDeleteBooking = async (visit: { id: string; patient?: { first_name?: string; last_name?: string }; scheduled_date?: string; visit_date?: string; scheduled_time?: string; visit_time?: string }) => {
    const patientName = `${visit.patient?.first_name || ''} ${visit.patient?.last_name || ''}`.trim() || 'this patient';
    const day = visit.scheduled_date || visit.visit_date;
    const time = (visit.scheduled_time || visit.visit_time || '').slice(0, 5);
    const when = day ? ` on ${format(parseISO(day), 'dd MMM yyyy')}${time ? ` at ${time}` : ''}` : '';
    if (!window.confirm(`Delete the booking for ${patientName}${when}? It is removed for good. If the patient is just not coming, use Cancel Visit instead.`)) return;
    try {
      // Read before the delete: the booking leaves the diary's list with it
      const deleted = appointments.find((apt) => apt.id === visit.id);
      const { deleteVisit } = useVisitsStore.getState();
      await deleteVisit(visit.id);
      toast.success('Booking deleted');
      // Its time is free again, as after Cancel Visit: the waiting list says who could take it
      const freed = deleted ? freedSlotOf(deleted) : null;
      if (freed) waitingList.slotFreed(freed);
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error(error instanceof Error ? error.message : 'Could not delete the booking. Please try again.');
    }
  };

  // Handle No Show - marks visit as no-show
  const handleNoShow = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { markNoShow } = useVisitsStore.getState();
      await markNoShow(visitId);
      
      toast.success('Visit marked as no-show!');
    } catch (error) {
      console.error('Error marking no-show:', error);
      toast.error('Failed to mark as no-show');
    }
  };

  // Handle Confirm Booking - confirms a website booking request
  const handleConfirmBooking = async (visitId: string) => {
    try {
      // Use visitsStore action for immediate state update
      const { confirmVisit } = useVisitsStore.getState();
      await confirmVisit(visitId);
      
      toast.success('Booking confirmed successfully!', {
        icon: '✅',
        duration: 4000
      });
    } catch (error) {
      console.error('Error confirming booking:', error);
      toast.error('Failed to confirm booking');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync with external internalViewMode prop
  useEffect(() => {
    if (externalInternalViewMode && externalInternalViewMode !== internalViewMode) {
      setInternalViewMode(externalInternalViewMode);
    }
  }, [externalInternalViewMode]);

  // Notify parent when internal view mode changes
  const handleInternalViewModeChange = (mode: 'timeline' | 'grid') => {
    setInternalViewMode(mode);
    if (onInternalViewModeChange) {
      onInternalViewModeChange(mode);
    }
  };

  // Get week dates for week view
  const weekDates = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  // Filter appointments based on view mode
  const dateFilteredAppointments = useMemo(() => {
    let filtered = appointments;
    
    // Log website bookings
    const websiteBookings = appointments.filter(apt => apt.is_from_website);
    if (websiteBookings.length > 0) {
      console.log('Found website bookings:', websiteBookings.length, {
        viewMode,
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        selectedDoctorId,
        bookings: websiteBookings.map(b => ({
          id: b.id,
          date: b.date,
          status: b.status,
          is_confirmed: b.is_confirmed
        }))
      });
    }

    if (viewMode === 'all') {
      // No date filtering for "all" view - show everything
    } else if (viewMode === 'day') {
      filtered = appointments.filter((apt) => {
        const aptDate = apt.date;
        if (!aptDate) return false;
        return format(parseISO(aptDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      });
    } else if (viewMode === 'week') {
      filtered = appointments.filter((apt) => {
        const aptDate = apt.date;
        if (!aptDate) return false;
        const date = parseISO(aptDate);
        return weekDates.some(weekDate => isSameDay(date, weekDate));
      });
    } else if (viewMode === 'month') {
      filtered = appointments.filter((apt) => {
        const aptDate = apt.date;
        if (!aptDate) return false;
        const date = parseISO(aptDate);
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        return date >= monthStart && date <= monthEnd;
      });
    }

    if (selectedPractitionerIds.length > 0) {
      const shown = new Set(selectedPractitionerIds);
      filtered = filtered.filter((apt) => {
        // Include website bookings (no doctor assigned yet) whoever is shown
        if (!apt.doctor_id && apt.is_from_website) {
          return true;
        }
        return shown.has(apt.doctor_id);
      });
    }


    // Sort by date for "all" view - most recent first
    if (viewMode === 'all') {
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateB.getTime() - dateA.getTime();
      });
    }

    return filtered;
  }, [appointments, selectedDate, selectedDoctorId, selectedPractitionerIds, viewMode, weekDates]);

  // Chip counts come from the date/doctor-filtered list so they don't change when a chip is selected
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilterKey, number> = {
      'pending': 0, 'scheduled': 0, 'checked-in': 0, 'in-progress': 0, 'completed': 0, 'cancelled': 0
    };
    dateFilteredAppointments.forEach((apt) => {
      counts[getStatusFilterKey(apt)] += 1;
    });
    return counts;
  }, [dateFilteredAppointments]);

  // Apply the status chip filter
  const filteredAppointments = useMemo(() => {
    if (!statusFilter) return dateFilteredAppointments;
    return dateFilteredAppointments.filter((apt) => getStatusFilterKey(apt) === statusFilter);
  }, [dateFilteredAppointments, statusFilter]);

  // Blocked time and public holidays for the days on screen (blocked time is stored per practice)
  const diaryPracticeId = props.practiceId || practiceId || null;
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  // The same days the dashboard loaded bookings for: the day, its Monday-Sunday week, or its month
  const visibleRange = diaryRangeFor(viewMode === 'all' ? 'day' : viewMode, selectedDate);
  const diaryBlocks = useDiaryBlocks(diaryPracticeId, visibleRange.from, visibleRange.to);
  const dayHoliday = useMemo(() => diaryHolidayOn(selectedDateKey), [selectedDateKey]);
  const dayBlocks = useMemo(() => blocksOnDay(diaryBlocks.blocks, selectedDateKey), [diaryBlocks.blocks, selectedDateKey]);
  const practitionerName = useCallback((id: string) => {
    const member = staff.find((m) => m.id === id);
    return member?.user_metadata?.full_name || member?.email?.split('@')[0] || null;
  }, [staff]);
  // "Dr." for doctors only: a nurse or an administrator who treats is shown by name
  const practitionerLabel = (id: string | null | undefined, fallback = 'Unassigned'): string => {
    const member = staff.find((m) => m.id === id);
    if (!member) return fallback;
    const name = member.user_metadata?.full_name || member.email;
    return member.user_metadata?.role === 'doctor' ? formatDoctorName(name, fallback) : name || fallback;
  };

  // Who gets a diary column (src/utils/diary/diaryPractitioners.ts): active doctors, anyone with
  // working hours, and whoever has a booking in the days shown
  const diaryStaff = useMemo<DiaryStaffMember[]>(
    () =>
      staff.map((member) => ({
        id: member.id,
        name: member.user_metadata?.full_name || member.email?.split('@')[0] || 'Practitioner',
        role: member.user_metadata?.role ?? null,
        isActive: member.is_active !== false
      })),
    [staff]
  );
  // The practitioners of the bookings in the days shown, as one key, so the column list changes only
  // when someone is added or removed (the diary's windows reload when their list changes)
  const bookedPractitionersKey = useMemo(
    () =>
      [...new Set(
        appointments
          .filter((apt) => (apt.date || '').slice(0, 10) >= visibleRange.from && (apt.date || '').slice(0, 10) <= visibleRange.to)
          .map((apt) => apt.doctor_id || '')
      )].sort().join('|'),
    [appointments, visibleRange.from, visibleRange.to]
  );
  const practitioners = useMemo(
    () =>
      diaryPractitioners({
        staff: diaryStaff,
        workingHours: diarySettings.hours,
        bookedIds: bookedPractitionersKey.split('|'),
        chosenIds: selectedPractitionerIds
      }),
    [diaryStaff, diarySettings.hours, bookedPractitionersKey, selectedPractitionerIds]
  );
  const blockPractitioners = useMemo(() => practitioners.map(({ id, name }) => ({ id, name })), [practitioners]);

  // A booking opened from elsewhere (a diary link, the diary report) is in view on arrival: its practitioner's column
  // joins the view (a doctor's diary opens on their own column) and a cancelled one shows the cancelled bookings,
  // which the time grid otherwise leaves out (src/utils/diary/diaryDayFocus.ts)
  const showDiaryFocus = useCallback(
    (focus: DiaryDayFocus) => {
      const next = focusedDiaryView(selectedPractitionerIds, focus, practitioners.map((practitioner) => practitioner.id));
      if (!sameDiaryView(next, selectedPractitionerIds)) setPickedView(next);
      setStatusFilter(focus.showCancelled ? 'cancelled' : null);
    },
    [selectedPractitionerIds, practitioners]
  );
  // A diary link's focus, once the user's own default view is known (it decides whose columns show), once per link
  const shownFocus = useRef<DiaryDayFocus | null>(null);
  const linkedFocus = props.diaryFocus ?? null;
  useEffect(() => {
    if (!linkedFocus || shownFocus.current === linkedFocus || diaryDefault.status === 'loading') return;
    shownFocus.current = linkedFocus;
    showDiaryFocus(linkedFocus);
  }, [linkedFocus, diaryDefault.status, showDiaryFocus]);
  // Diary settings > Working hours: an administrator sees all active staff (giving someone hours
  // gives them a column); others see the practitioners already in the diary
  const hoursStaff = useMemo(
    () =>
      workingHoursStaff(diaryStaff, practitioners, currentUserRole === 'admin').map((member) => ({
        id: member.id,
        name: member.role && member.role !== 'doctor' ? `${member.name} (${formatRole(member.role)})` : member.name
      })),
    [diaryStaff, practitioners, currentUserRole]
  );

  // The practice's opening hours: the hours of practitioners without their own, and part of the grid's day
  const [businessHours, setBusinessHours] = useState<unknown>(null);
  useEffect(() => {
    if (!diaryPracticeId) return;
    let cancelled = false;
    loadPracticeBusinessHours(diaryPracticeId).then((hours) => {
      if (!cancelled) setBusinessHours(hours);
    });
    return () => {
      cancelled = true;
    };
  }, [diaryPracticeId]);
  const practiceHours = useMemo(() => practiceHoursResolver(businessHours), [businessHours]);
  // A practitioner's hours on a day: their own when saved in Diary settings, else the opening hours
  // (the same hours the booking warnings and "Next free slot" use)
  const workingDayOf = useCallback(
    (practitionerId: string, dateKey: string) => practitionerHoursResolver(diarySettings.hours, practitionerId, practiceHours)(dateKey),
    [diarySettings.hours, practiceHours]
  );
  // Whose hours shape the grids: the chosen practitioners, else everyone with a column
  const shownPractitioners = useMemo(
    () => (selectedPractitionerIds.length > 0 ? practitioners.filter((practitioner) => selectedPractitionerIds.includes(practitioner.id)) : practitioners),
    [practitioners, selectedPractitionerIds]
  );
  const shownDateKeys = useMemo(() => (viewMode === 'week' ? weekDates.map(toDateKey) : [selectedDateKey]), [viewMode, weekDates, selectedDateKey]);
  // The grids' rows: the shortest diary slot of the practitioners shown (src/utils/diary/slotLength.ts), 30 minutes
  // when none has one
  const gridRows = useMemo(
    () => gridRowMinutes(practitionerSlots, shownPractitioners.map((practitioner) => practitioner.id)),
    [practitionerSlots, shownPractitioners]
  );
  // The time grids run from the earliest start to the latest finish of the practice and the
  // practitioners shown, and always far enough to show every booking (src/utils/diary/gridHours.ts)
  const gridHours = useMemo(
    () =>
      shownGridRange(
        shownDateKeys.flatMap((dateKey) => [practiceHours(dateKey), ...shownPractitioners.map((practitioner) => workingDayOf(practitioner.id, dateKey))]),
        dateFilteredAppointments.map((apt) => ({ start: timeToMinutes(apt.time), minutes: apt.duration })),
        gridRows
      ),
    [shownDateKeys, shownPractitioners, practiceHours, workingDayOf, dateFilteredAppointments, gridRows]
  );
  // The day grid: a column per practitioner (the chosen one alone), and one for bookings without a
  // practitioner; each column shaded where its practitioner is not working, with the day's hours on top
  const dayColumns = useMemo(
    () => diaryDayColumns(practitioners, selectedPractitionerIds, filteredAppointments.map((apt) => apt.doctor_id)),
    [practitioners, selectedPractitionerIds, filteredAppointments]
  );
  const dayGridColumns = useMemo(() => dayColumns.map(toGridColumn), [dayColumns]);
  const dayColumnHours = useMemo(() => {
    const offHours = new Map<string, OffHourSpan[]>();
    const summaries = new Map<string, string>();
    // Each column's own slots, when its practitioner's slot is longer than the rows
    const slots = new Map<string, number>();
    for (const column of dayColumns) {
      if (!column.id) continue; // bookings without a practitioner: no hours to shade
      const workingDay = workingDayOf(column.id, selectedDateKey);
      offHours.set(column.id, offHourSpans(gridHours, [workingDay]));
      summaries.set(column.id, describeWorkingDay(workingDay));
      slots.set(column.id, gridSlotFor(practitionerSlots, column.id));
    }
    return { offHours, summaries, slots };
  }, [dayColumns, workingDayOf, selectedDateKey, gridHours, practitionerSlots]);
  // The week grid has a column per day: shaded where the chosen practitioner, or else nobody, works
  const weekOffHours = useMemo(
    () =>
      new Map(
        weekDates.map(toDateKey).map((dateKey) => [dateKey, offHourSpans(gridHours, shownPractitioners.map((practitioner) => workingDayOf(practitioner.id, dateKey)))])
      ),
    [weekDates, gridHours, shownPractitioners, workingDayOf]
  );
  const weekGridPractitioners = useMemo(() => practitioners.map(toGridColumn), [practitioners]);

  // A booking on the time grids opens what its card opens: a website request its confirmation, any
  // other booking the visit actions (the patient file is one tap away there)
  const openBooking = (booking: { id: string }) => {
    const appointment = appointments.find((apt) => apt.id === booking.id);
    if (!appointment) return;
    if (isBookingRequest(appointment)) {
      setSelectedBookingRequest(appointment);
      setIsBookingRequestModalOpen(true);
      return;
    }
    if (!appointment.patient_id) {
      toast.error('Cannot open visit details - patient information missing');
      return;
    }
    setSelectedVisitForAction(appointment);
    setIsActionModalOpen(true);
  };

  // Reminder / SMS confirmation status of the bookings on screen (not narrowed by the status chips)
  // (The month grid shows counts only, so a month's worth of bookings is not looked up)
  const visibleVisitIds = useMemo(
    () => (viewMode === 'month' ? [] : dateFilteredAppointments.map((apt) => apt.id)),
    [dateFilteredAppointments, viewMode]
  );
  const reminderStatuses = useReminderStatuses(visibleVisitIds);
  // "Invoiced" / "Paid" on the cards (parity B13): one read for every booking on screen, never one per card
  const billingBadges = useVisitBillingBadges(visibleVisitIds);
  // The practice's own status on each booking shown, while the booking is at that status's stage
  const bookingStatuses = useMemo(() => {
    const shown = new Map<string, DiaryStatus>();
    if (diaryStatuses.length === 0) return shown;
    for (const apt of dateFilteredAppointments) {
      const status = shownDiaryStatus(diaryStatuses, apt);
      if (status) shown.set(apt.id, status);
    }
    return shown;
  }, [dateFilteredAppointments, diaryStatuses]);
  // Account flags that matter for billing (cash only, credit limit, dispute, ...): one small icon per time-grid card
  const visiblePatientIds = useMemo(
    () => (viewMode === 'month' ? [] : dateFilteredAppointments.map((apt) => apt.patient_id)),
    [dateFilteredAppointments, viewMode]
  );
  const accountFlagSummaries = useAccountFlagSummaries(visiblePatientIds, diaryPracticeId);

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
      for (let minute = 0; minute < 60; minute += TIME_SLOT_INTERVAL) {
        const time = setMinutes(setHours(selectedDate, hour), minute);
        slots.push(format(time, 'HH:mm'));
      }
    }
    return slots;
  }, [selectedDate]);

  // Premium stats with gradients
  const stats = useMemo(() => {
    const total = filteredAppointments.length;
    const completed = filteredAppointments.filter(a => a.status === 'completed').length;
    const cancelled = filteredAppointments.filter(a => a.status === 'cancelled').length;
    const pending = filteredAppointments.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length;

    return [
      { label: 'Total', value: total, gradient: 'from-[#01b9d5] to-[#0196be]', icon: CalendarIcon },
      { label: 'Completed', value: completed, gradient: 'from-emerald-500 to-emerald-600', icon: CheckCircle },
      { label: 'Pending', value: pending, gradient: 'from-amber-500 to-amber-600', icon: Clock },
      { label: 'Cancelled', value: cancelled, gradient: 'from-red-500 to-red-600', icon: XCircle }
    ];
  }, [filteredAppointments]);

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'all') {
      // No navigation for "all time" view
      return;
    } else if (viewMode === 'week') {
      const newDate = direction === 'prev' ? subWeeks(selectedDate, 1) : addWeeks(selectedDate, 1);
      onDateChange(newDate);
    } else if (viewMode === 'month') {
      const newDate = direction === 'prev' ? subMonths(selectedDate, 1) : addMonths(selectedDate, 1);
      onDateChange(newDate);
    } else {
      const newDate = direction === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1);
      onDateChange(newDate);
    }
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const calculateAppointmentPosition = (appointment: Appointment, dayOffset = 0) => {
    const time = appointment.time;
    if (!time) return { top: 0, height: HOUR_HEIGHT, left: 0, width: 100 };

    const [hours, minutes] = time.split(':').map(Number);
    const startMinutes = (hours - BUSINESS_HOURS.start) * 60 + minutes;
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = (appointment.duration / 60) * HOUR_HEIGHT;
    
    // For week view, calculate left position based on day
    const left = dayOffset * 14.285; // 100% / 7 days
    const width = 14.285; // Width for one day

    return { top, height: Math.max(height, 40), left, width };
  };

  // Handle appointment drop. The cards are rows from `visits` (Dashboard maps them), so the move is
  // saved there; the old `appointments` update matched no row and reported success without moving anything
  const handleAppointmentDrop = async (appointmentId: string, newTime: Date, newDoctorId: string) => {
    try {
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) return false;

      await useVisitsStore.getState().updateVisit(appointmentId, {
        scheduled_date: format(newTime, 'yyyy-MM-dd'),
        scheduled_time: format(newTime, 'HH:mm:ss'),
        doctor_id: newDoctorId
      });

      // Refresh data
      if (onRefresh) {
        onRefresh();
      }

      return true;
    } catch (error) {
      console.error('Error in handleAppointmentDrop:', error);
      return false;
    }
  };

  // What reception confirms before a dragged booking lands (the same checks as the booking form): a
  // clash with the practitioner's other bookings (each as long as it was booked), the patient twice
  // that day, blocked time, a holiday, or outside the practitioner's working hours. The booking keeps
  // its length.
  const checkMove = async (appointmentId: string, newTime: Date, newDoctorId: string): Promise<string[]> => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment || !diaryPracticeId) return [];
    const date = format(newTime, 'yyyy-MM-dd');
    const warnings = await checkBooking({
      practiceId: diaryPracticeId,
      proposal: {
        visitId: appointment.id,
        patientId: appointment.patient_id,
        doctorId: newDoctorId,
        date,
        time: format(newTime, 'HH:mm'),
        durationMinutes: appointment.duration
      },
      practitionerName,
      lengths: typeLengths,
      practitionerDay: practitionerDayHours(diarySettings.hours, newDoctorId, date),
      // A booking made as one of the practice's types keeps its daily limit when it is moved
      appointmentType: appointmentTypes.find((type) => type.id === appointment.appointment_type_id) ?? null
    });
    return warnings.map((warning) => warning.message);
  };

  const openBookingForm = (start: BookingFormStart | null) => {
    setSelectedTimeSlot(start);
    setBookingFormKey((key) => key + 1);
    setIsAddModalOpen(true);
  };

  // The waiting list (parity B21): Diary > More, who could take a cancelled time, and who could take a clicked free time
  const waitingList = useDiaryWaitingList({
    practiceId: diaryPracticeId,
    practitioners: blockPractitioners,
    practitionerLabel: (id) => practitionerLabel(id, 'Any practitioner'),
    appointmentTypes,
    bookings: appointments,
    onBook: openBookingForm
  });

  // A booking cancelled outside the diary (the Reschedule form's Cancel Appointment): its time is offered to the
  // waiting list as after Cancel Visit, once per slot
  const offeredSlot = useRef<DiarySlot | null>(null);
  const linkedFreedSlot = props.freedSlot ?? null;
  const { slotFreed } = waitingList;
  useEffect(() => {
    if (!linkedFreedSlot || offeredSlot.current === linkedFreedSlot) return;
    offeredSlot.current = linkedFreedSlot;
    slotFreed(linkedFreedSlot);
  }, [linkedFreedSlot, slotFreed]);

  // A free time clicked in the day or week grid: a new booking there, or the copied booking pasted there
  // with the column's practitioner (the week grid: the practitioner shown, else the copy's own)
  const openSlot = (date: Date, time: string, columnPractitionerId?: string) => {
    if (copiedBooking) {
      openBookingForm({ date, time, doctorId: pastePractitioner(columnPractitionerId, copiedBooking) ?? undefined, copy: copiedBooking, pasted: true });
      return;
    }
    openBookingForm({ date, time, doctorId: columnPractitionerId });
  };

  // "Copy": the banner says whose booking is copied; a free time clicked next opens the booking form from it
  const handleCopyBooking = (appointment: Appointment) => {
    const copy = prefillFromBooking(appointment);
    if (!copy) {
      toast.error('This booking has no patient to copy.');
      return;
    }
    setCopiedBooking(copy);
  };

  // "Book again": the booking form with the same patient, practitioner, type, length and reason at the
  // practitioner's next free time from the day after this booking; without one the date is left for
  // reception to choose. The form runs every booking check before saving
  const handleBookAgain = async (appointment: Appointment) => {
    const copy = prefillFromBooking(appointment);
    if (!copy) {
      toast.error('This booking has no patient to book again.');
      return;
    }
    let start: BookingFormStart = { date: null, copy };
    if (copy.practitionerId && diaryPracticeId) {
      const toastId = toast.loading('Looking for the next free time...');
      try {
        const slot = await findNextFreeSlotFor({
          practiceId: diaryPracticeId,
          doctorId: copy.practitionerId,
          fromDate: parseDateKey(bookAgainFrom(appointment.date, toDateKey(new Date()))) ?? new Date(),
          durationMinutes: copy.durationMinutes,
          businessHours,
          lengths: typeLengths,
          workingHours: diarySettings.hours,
          stepMinutes: startStepFor(practitionerSlots, copy.practitionerId)
        });
        if (slot) {
          start = { date: parseDateKey(slot.date), time: slot.time, copy };
          toast.dismiss(toastId);
        } else {
          toast(`No free ${formatBookingLength(copy.durationMinutes)} time in the next 4 weeks. Choose the date.`, { id: toastId });
        }
      } catch (error) {
        console.error('Could not look for the next free time:', error);
        toast.error('Could not look for a free time. Choose the date.', { id: toastId });
      }
    }
    openBookingForm(start);
  };

  // Esc forgets a copy (not while a window is open over the diary: Esc closes that window first)
  const isDialogOpen =
    isAddModalOpen || isActionModalOpen || showDoctorModal || isBlockModalOpen || isRemindOpen || isReportOpen ||
    settingsTab !== null || isSMSModalOpen || isBookingRequestModalOpen || waitingList.isOpen;
  useEffect(() => {
    if (!copiedBooking || isDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setCopiedBooking(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [copiedBooking, isDialogOpen]);

  // Premium Grid View Component - Card-based layout for all modes
  const GridView = () => {
    const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
    
    // Group appointments by sections
    const appointmentSections = useMemo(() => {
      const sections = {
        bookingRequests: [] as typeof filteredAppointments,
        schedule: [] as typeof filteredAppointments,
        handedOff: [] as typeof filteredAppointments,
        completed: [] as typeof filteredAppointments,
        cancelled: [] as typeof filteredAppointments
      };

      filteredAppointments.forEach(apt => {
        if (apt.status === 'cancelled' || apt.is_cancelled) {
          sections.cancelled.push(apt);
        } else if (apt.status === 'completed') {
          sections.completed.push(apt);
        } else if (apt.is_handoff && apt.status !== 'completed') {
          sections.handedOff.push(apt);
        } else if (isBookingRequest(apt)) {
          // Booking requests from website (scheduled but not confirmed)
          sections.bookingRequests.push(apt);
        } else {
          // scheduled, ready, in-progress, checked-in all go to schedule section
          sections.schedule.push(apt);
        }
      });

      // Sort each section
      Object.keys(sections).forEach(key => {
        if (key === 'schedule') {
          // For schedule section: sort by status priority then time
          sections.schedule.sort((a, b) => {
            // Status priority: in-progress (1), ready (2), checked-in (3), scheduled (4)
            const getStatusPriority = (apt: typeof a) => {
              if (apt.status === 'in-progress') return 1;
              if (apt.status === 'ready' || apt.is_ready) return 2;
              if (apt.is_checked_in && !apt.is_ready) return 3;
              return 4; // scheduled
            };
            
            const priorityA = getStatusPriority(a);
            const priorityB = getStatusPriority(b);
            
            // First sort by status priority
            if (priorityA !== priorityB) {
              return priorityA - priorityB;
            }
            
            // Then sort by time within same status
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeA.localeCompare(timeB);
          });
        } else {
          // For completed, cancelled, and handedOff sections: sort by time only
          sections[key as keyof typeof sections].sort((a, b) => {
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeA.localeCompare(timeB);
          });
        }
      });

      return sections;
    }, [filteredAppointments]);

    // Card-based grid view for day/week/month/all
    return (
      <div className="p-6">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
              <CalendarIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No appointments found</p>
            <p className="text-sm text-gray-400 mt-1">
              {viewMode === 'all'
                ? 'All time appointments'
                : viewMode === 'week' 
                ? `Week of ${format(weekDates[0], 'd MMM')} - ${format(weekDates[6], 'd MMM yyyy')}`
                : viewMode === 'month'
                ? format(selectedDate, 'MMMM yyyy')
                : format(selectedDate, 'd MMMM yyyy')
              }
            </p>
            <p className="text-sm text-gray-500 mt-3">
              {statusFilter
                ? 'A status filter is on. Click the highlighted status above to show all appointments.'
                : 'Click "Schedule" above to book an appointment.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Booking Request Section */}
            {appointmentSections.bookingRequests.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    <span className="font-bold text-base">Booking Requests</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.bookingRequests.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-orange-300 via-orange-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.bookingRequests.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          setSelectedBookingRequest(appointment);
                          setIsBookingRequestModalOpen(true);
                        }}
                      >
                          {/* Faint inside border with status color */}
                          <div className="absolute inset-0 rounded-[11px] border-2 border-orange-500/20 pointer-events-none" />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-booking-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill="#f97316" />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-booking-${appointment.id})`} />
                          </svg>

                          {/* Smaller number badge - top left */}
                          <div className="absolute left-3 top-3 z-10">
                            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 border border-orange-200">
                              <span className="font-semibold text-sm text-orange-700">
                                {index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Clean compact content */}
                          <div className="relative">
                            {/* Top section with number badge and patient info side by side */}
                            <div className="flex gap-3 px-4 pt-4 pb-4">
                              {/* Space for number badge on the left */}
                              <div className="w-8 flex-none"></div>

                              {/* Patient details column - positioned next to number badge */}
                              <div className="flex-1 min-w-0 space-y-2">
                                {/* Patient name with icon; the status badges sit in the same row (wrapping below
                                    on narrow cards) so they can never cover the name */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <div className="p-1.5 rounded-lg flex-none">
                                    <User className="h-4 w-4 text-orange-600" />
                                  </div>
                                  <h3
                                    className="font-bold text-[#4f575e] text-base tracking-tight truncate flex-1 min-w-0"
                                    style={{ fontFamily: 'Poppins, sans-serif' }}
                                    title={`${appointment.patient.first_name} ${appointment.patient.last_name}`}
                                  >
                                    {appointment.patient.first_name} {appointment.patient.last_name}
                                  </h3>
                                  <div className="ml-auto flex flex-none flex-wrap items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                                      Website booking
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                      Needs confirmation
                                    </span>
                                  </div>
                                </div>

                                {/* Phone number with badge */}
                                {appointment.patient.cell_number && (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-orange-50/70">
                                      <Phone className="h-3.5 w-3.5 text-orange-600" />
                                    </div>
                                    <span className="text-sm text-gray-600">{appointment.patient.cell_number}</span>
                                  </div>
                                )}
                                
                                {/* Service requested */}
                                {appointment.notes && appointment.notes.includes('Service:') && (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg">
                                      <Clipboard className="h-3.5 w-3.5 text-orange-600" />
                                    </div>
                                    <span className="text-sm text-gray-600">
                                      {appointment.notes.match(/Service: ([^\n]*)/)?.[1] || 'Consultation'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Full width grey line */}
                            <div className="h-px bg-gray-200" />

                            {/* Bottom section with info and button */}
                            <div className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                {/* Info sections */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Date section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm bg-orange-50 text-orange-700">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{format(aptDate, 'd MMM yyyy')}</span>
                                  </div>

                                  {/* Time section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm bg-orange-50 text-orange-700">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>
                                </div>

                                {/* Action buttons - bottom right */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Confirm the booking
                                      handleConfirmBooking(appointment.id);
                                    }}
                                    className="px-4 py-2 bg-[#01b9d4] hover:bg-[#00a5be] text-white rounded-lg font-medium flex items-center gap-2 shadow-lg text-sm"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    Confirm
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBookingRequest(appointment);
                                      setIsBookingRequestModalOpen(true);
                                    }}
                                    className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl  duration-200 group"
                                    title="Manage Booking"
                                    aria-label="Manage booking"
                                  >
                                    <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}

            {/* Handed Off Section */}
            {appointmentSections.handedOff.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <HandshakeIcon className="h-5 w-5" />
                    <span className="font-bold text-base">Handed Off</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.handedOff.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-300 via-purple-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.handedOff.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                      >
                          {/* Faint inside border with status color */}
                          <div className="absolute inset-0 rounded-[11px] border-2 border-purple-500/20 pointer-events-none" />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-handoff-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill="#a855f7" />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-handoff-${appointment.id})`} />
                          </svg>

                          {/* Smaller number badge - top left */}
                          <div className="absolute left-3 top-3 z-10">
                            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 border border-purple-200">
                              <span className="font-semibold text-sm text-purple-700">
                                {index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Clean compact content */}
                          <div className="relative">
                            {/* Top section with number badge and patient info side by side */}
                            <div className="flex gap-3 px-4 pt-4 pb-4">
                              {/* Space for number badge on the left */}
                              <div className="w-8 flex-none"></div>

                              {/* Patient details column - positioned next to number badge */}
                              <div className="flex-1 min-w-0 space-y-2">
                                {/* Patient name with icon; the status badge sits in the same row (wrapping below on
                                    narrow cards) so it can never cover the name */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <div className="p-1.5 rounded-lg flex-none">
                                    <User className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <h3
                                    className="font-bold text-[#4f575e] text-base tracking-tight truncate flex-1 min-w-0"
                                    style={{ fontFamily: 'Poppins, sans-serif' }}
                                    title={`${appointment.patient.first_name} ${appointment.patient.last_name}`}
                                  >
                                    {appointment.patient.first_name} {appointment.patient.last_name}
                                  </h3>
                                  <span className="ml-auto flex-none px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                    Handed off
                                  </span>
                                </div>

                                {/* Phone number with badge */}
                                {appointment.patient.cell_number && (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-purple-50/70">
                                      <Phone className="h-3.5 w-3.5 text-purple-600" />
                                    </div>
                                    <span className="text-sm text-gray-600">{appointment.patient.cell_number}</span>
                                  </div>
                                )}
                                
                                {/* Designated doctor with badge */}
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg">
                                    <Stethoscope className="h-3.5 w-3.5 text-purple-600" />
                                  </div>
                                  <span className="text-sm text-gray-600">{practitionerLabel(appointment.doctor_id)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Full width grey line */}
                            <div className="h-px bg-gray-200" />

                            {/* Handoff indicator and print actions row */}
                            <div className="px-4 py-3 bg-purple-50/30 border-b border-purple-100/50">
                              <div className="flex items-center justify-between gap-3">
                                {/* Ready for checkout badge */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 animate-pulse">
                                    <Clipboard className="h-4 w-4" />
                                    <span className="text-sm font-semibold">Ready for checkout</span>
                                  </div>
                                </div>

                                {/* Print buttons with labels */}
                                <div className="flex items-center gap-2">
                                  <HandoffCardPrintButtons
                                    visitId={appointment.id}
                                    patientId={appointment.patient_id}
                                    practiceId={appointment.practice_id || practiceId}
                                    showLabels={true}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Bottom section with info and button */}
                            <div className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                {/* Info sections */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Time section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm bg-purple-50 text-purple-700">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>

                                </div>

                                {/* Complete button - bottom right */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompleteVisit(appointment.id);
                                  }}
                                  className="px-4 py-2 bg-[#01b9d4] hover:bg-[#00a5be] text-white rounded-lg font-medium flex items-center gap-2 shadow-lg text-sm"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>Complete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}

            {/* Schedule Section - Active appointments */}
            {appointmentSections.schedule.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <span className="font-bold text-base">Schedule</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.schedule.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-blue-300 via-blue-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.schedule.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const isUpcoming = appointment.status === 'scheduled';
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                      >
                            {/* Faint inside border with status color */}
                            <div className={`absolute inset-0 rounded-[11px] border-2 ${
                            appointment.status === 'scheduled' ? 'border-blue-500/20' :
                            appointment.status === 'ready' ? 'border-emerald-500/20' :
                            appointment.status === 'in-progress' ? 'border-amber-500/20' :
                            appointment.status === 'completed' ? 'border-gray-500/20' :
                            appointment.status === 'cancelled' ? 'border-red-500/20' :
                            'border-purple-500/20'
                          } pointer-events-none`} />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill={
                                appointment.status === 'scheduled' ? '#3b82f6' :
                                appointment.status === 'ready' ? '#10b981' :
                                appointment.status === 'in-progress' ? '#f59e0b' :
                                appointment.status === 'completed' ? '#6b7280' :
                                appointment.status === 'cancelled' ? '#ef4444' :
                                '#a855f7'
                              } />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-${appointment.id})`} />
                          </svg>

                          {/* Smaller number badge - top left */}
                          <div className="absolute left-3 top-3 z-10">
                            <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg ${
                              appointment.status === 'scheduled' ? 'bg-blue-100 border border-blue-200' :
                              appointment.status === 'in-progress' ? 'bg-amber-100 border border-amber-200' :
                              appointment.status === 'completed' ? 'bg-gray-100 border border-gray-200' :
                              appointment.status === 'cancelled' ? 'bg-red-100 border border-red-200' :
                              'bg-purple-100 border border-purple-200'
                            }`} style={appointment.status === 'ready' ? { backgroundColor: '#01b8d8', border: 'none' } : {}}>
                              <span className={`font-semibold text-sm ${
                                appointment.status === 'scheduled' ? 'text-blue-700' :
                                appointment.status === 'ready' ? 'text-white' :
                                appointment.status === 'in-progress' ? 'text-amber-700' :
                                appointment.status === 'completed' ? 'text-gray-700' :
                                appointment.status === 'cancelled' ? 'text-red-700' :
                                'text-purple-700'
                              }`}>
                                {index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Clean compact content */}
                          <div className="relative">
                            {/* Top section with number badge and patient info side by side */}
                            <div className="flex gap-3 px-4 pt-4 pb-4">
                              {/* Space for number badge on the left */}
                              <div className="w-8 flex-none"></div>

                              {/* Patient details column - positioned next to number badge */}
                              <div className="flex-1 min-w-0 space-y-2">
                                {/* Patient name with icon; the status badge sits in the same row (wrapping below on
                                    narrow cards) so it can never cover the name */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <div className="p-1.5 rounded-lg flex-none">
                                    <User className={`h-4 w-4 ${
                                      appointment.status === 'scheduled' ? 'text-blue-600' :
                                      appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                      appointment.status === 'in-progress' ? 'text-amber-600' :
                                      appointment.status === 'completed' ? 'text-gray-600' :
                                      appointment.status === 'cancelled' ? 'text-red-600' :
                                      'text-purple-600'
                                    }`} />
                                  </div>
                                  <h3
                                    className="font-bold text-[#4f575e] text-base tracking-tight truncate flex-1 min-w-0"
                                    style={{ fontFamily: 'Poppins, sans-serif' }}
                                    title={`${appointment.patient.first_name} ${appointment.patient.last_name}`}
                                  >
                                    {appointment.patient.first_name} {appointment.patient.last_name}
                                  </h3>
                                  <div className="ml-auto flex flex-none items-center">
                                    {/* Show scheduled badge when: scheduled, confirmed, not checked in, not ready, not cancelled */}
                                    {appointment.status === 'scheduled' &&
                                     appointment.is_confirmed &&
                                     !appointment.is_checked_in &&
                                     !appointment.is_ready &&
                                     !appointment.is_cancelled && (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                        Scheduled
                                      </span>
                                    )}

                                    {/* Show checked in badge if checked in but not ready */}
                                    {appointment.status === 'scheduled' && appointment.is_checked_in && !appointment.is_ready && (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                        Checked in
                                      </span>
                                    )}

                                    {/* Show ready badge for ready status */}
                                    {appointment.status === 'ready' && (
                                      <span
                                        className="px-2.5 py-1 rounded-full text-xs font-semibold text-white inline-block"
                                        style={{ backgroundColor: '#01b8d8' }}
                                      >
                                        Ready
                                      </span>
                                    )}

                                    {appointment.status === 'in-progress' && (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 inline-block">
                                        In progress
                                      </span>
                                    )}

                                    {/* Show other status badges */}
                                    {appointment.status !== 'scheduled' && appointment.status !== 'ready' && appointment.status !== 'in-progress' && (
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        appointment.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                                        appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        'bg-purple-100 text-purple-700'
                                      }`}>
                                        {getStatusBadgeLabel(appointment)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Phone number with badge */}
                                {appointment.patient.cell_number && (
                                  <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${
                                      appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                      appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                      appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                      appointment.status === 'completed' ? 'bg-gray-50/70' :
                                      appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                      'bg-purple-50/70'
                                    }`}>
                                      <Phone className={`h-3.5 w-3.5 ${
                                        appointment.status === 'scheduled' ? 'text-blue-600' :
                                        appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                        appointment.status === 'in-progress' ? 'text-amber-600' :
                                        appointment.status === 'completed' ? 'text-gray-600' :
                                        appointment.status === 'cancelled' ? 'text-red-600' :
                                        'text-purple-600'
                                      }`} />
                                    </div>
                                    <span className="text-sm text-gray-600">{appointment.patient.cell_number}</span>
                                  </div>
                                )}
                                
                                {/* Designated doctor with badge */}
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <Stethoscope className={`h-3.5 w-3.5 ${
                                      appointment.status === 'scheduled' ? 'text-blue-600' :
                                      appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                      appointment.status === 'in-progress' ? 'text-amber-600' :
                                      appointment.status === 'completed' ? 'text-gray-600' :
                                      appointment.status === 'cancelled' ? 'text-red-600' :
                                      'text-purple-600'
                                    }`} />
                                  </div>
                                  <span className="text-sm text-gray-600">{practitionerLabel(appointment.doctor_id)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Full width grey line */}
                            <div className="h-px bg-gray-200" />

                            {/* Bottom section with info and button */}
                            <div className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                {/* Info sections */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Time section */}
                                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm ${
                                    appointment.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                    appointment.status === 'ready' ? 'bg-cyan-50 text-[#01b8d8]' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50 text-amber-700' :
                                    appointment.status === 'completed' ? 'bg-gray-50 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                                    'bg-purple-50 text-purple-700'
                                  }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>

                                  {/* A video consultation (parity B16) */}
                                  <VideoBookingIcon link={appointment.video_link} showLabel />
                                  {/* Reminder / SMS confirmation (not for finished visits) */}
                                  <ReminderStatusIcon
                                    status={appointment.status !== 'completed' ? reminderStatuses.get(appointment.id) : null}
                                    showLabel
                                  />
                                  {/* Invoiced or paid (parity B13), in words */}
                                  <DiaryBillingBadge badge={billingBadges.get(appointment.id)} size="sm" />
                                  {/* The practice's own status ("Called, no answer"), in words and colour */}
                                  <DiaryStatusLabel status={bookingStatuses.get(appointment.id)} size="sm" />
                                </div>

                                {/* Action buttons - bottom right */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready' || appointment.status === 'in-progress' || appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Validate appointment data before opening modal
                                        if (!appointment.patient_id) {
                                          console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                                          toast.error('Cannot open visit details - patient information missing');
                                          return;
                                        }
                                        setSelectedVisitForAction(appointment);
                                        setIsActionModalOpen(true);
                                      }}
                                      className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl  duration-200 group"
                                      title="Visit actions"
                                      aria-label="Visit actions"
                                    >
                                      <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}

            {/* Completed Section */}
            {appointmentSections.completed.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-bold text-base">Completed</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.completed.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 via-gray-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.completed.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const isUpcoming = appointment.status === 'scheduled';
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                      >
                            {/* Faint inside border with status color */}
                            <div className={`absolute inset-0 rounded-[11px] border-2 ${
                            appointment.status === 'scheduled' ? 'border-blue-500/20' :
                            appointment.status === 'ready' ? 'border-emerald-500/20' :
                            appointment.status === 'in-progress' ? 'border-amber-500/20' :
                            appointment.status === 'completed' ? 'border-gray-500/20' :
                            appointment.status === 'cancelled' ? 'border-red-500/20' :
                            'border-purple-500/20'
                          } pointer-events-none`} />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-completed-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill={
                                appointment.status === 'scheduled' ? '#3b82f6' :
                                appointment.status === 'ready' ? '#10b981' :
                                appointment.status === 'in-progress' ? '#f59e0b' :
                                appointment.status === 'completed' ? '#6b7280' :
                                appointment.status === 'cancelled' ? '#ef4444' :
                                '#a855f7'
                              } />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-completed-${appointment.id})`} />
                          </svg>

                          {/* Smaller number badge - top left */}
                          <div className="absolute left-3 top-3 z-10">
                            <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg ${
                              appointment.status === 'scheduled' ? 'bg-blue-100 border border-blue-200' :
                              appointment.status === 'in-progress' ? 'bg-amber-100 border border-amber-200' :
                              appointment.status === 'completed' ? 'bg-gray-100 border border-gray-200' :
                              appointment.status === 'cancelled' ? 'bg-red-100 border border-red-200' :
                              'bg-purple-100 border border-purple-200'
                            }`} style={appointment.status === 'ready' ? { backgroundColor: '#01b8d8', border: 'none' } : {}}>
                              <span className={`font-semibold text-sm ${
                                appointment.status === 'scheduled' ? 'text-blue-700' :
                                appointment.status === 'ready' ? 'text-white' :
                                appointment.status === 'in-progress' ? 'text-amber-700' :
                                appointment.status === 'completed' ? 'text-gray-700' :
                                appointment.status === 'cancelled' ? 'text-red-700' :
                                'text-purple-700'
                              }`}>
                                {appointmentSections.schedule.length + index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Clean compact content */}
                          <div className="relative">
                            {/* Top section with number badge and patient info side by side */}
                            <div className="flex gap-3 px-4 pt-4 pb-4">
                              {/* Space for number badge on the left */}
                              <div className="w-8 flex-none"></div>

                              {/* Patient details column - positioned next to number badge */}
                              <div className="flex-1 min-w-0 space-y-2">
                                {/* Patient name with icon; the status badge sits in the same row (wrapping below on
                                    narrow cards) so it can never cover the name */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <div className="p-1.5 rounded-lg flex-none">
                                    <User className={`h-4 w-4 ${
                                      appointment.status === 'scheduled' ? 'text-blue-600' :
                                      appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                      appointment.status === 'in-progress' ? 'text-amber-600' :
                                      appointment.status === 'completed' ? 'text-gray-600' :
                                      appointment.status === 'cancelled' ? 'text-red-600' :
                                      'text-purple-600'
                                    }`} />
                                  </div>
                                  <h3
                                    className="font-bold text-[#4f575e] text-base tracking-tight truncate flex-1 min-w-0"
                                    style={{ fontFamily: 'Poppins, sans-serif' }}
                                    title={`${appointment.patient.first_name} ${appointment.patient.last_name}`}
                                  >
                                    {appointment.patient.first_name} {appointment.patient.last_name}
                                  </h3>
                                  <span className={`ml-auto flex-none px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    appointment.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {getStatusBadgeLabel(appointment)}
                                  </span>
                                </div>

                                {/* Phone number with badge */}
                                {appointment.patient.cell_number && (
                                  <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${
                                      appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                      appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                      appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                      appointment.status === 'completed' ? 'bg-gray-50/70' :
                                      appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                      'bg-purple-50/70'
                                    }`}>
                                      <Phone className={`h-3.5 w-3.5 ${
                                        appointment.status === 'scheduled' ? 'text-blue-600' :
                                        appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                        appointment.status === 'in-progress' ? 'text-amber-600' :
                                        appointment.status === 'completed' ? 'text-gray-600' :
                                        appointment.status === 'cancelled' ? 'text-red-600' :
                                        'text-purple-600'
                                      }`} />
                                    </div>
                                    <span className="text-sm text-gray-600">{appointment.patient.cell_number}</span>
                                  </div>
                                )}
                                
                                {/* Designated doctor with badge */}
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <Stethoscope className={`h-3.5 w-3.5 ${
                                      appointment.status === 'scheduled' ? 'text-blue-600' :
                                      appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                      appointment.status === 'in-progress' ? 'text-amber-600' :
                                      appointment.status === 'completed' ? 'text-gray-600' :
                                      appointment.status === 'cancelled' ? 'text-red-600' :
                                      'text-purple-600'
                                    }`} />
                                  </div>
                                  <span className="text-sm text-gray-600">{practitionerLabel(appointment.doctor_id)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Full width grey line */}
                            <div className="h-px bg-gray-200" />

                            {/* Bottom section with info and button */}
                            <div className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                {/* Info sections */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Time section */}
                                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm ${
                                    appointment.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                    appointment.status === 'ready' ? 'bg-cyan-50 text-[#01b8d8]' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50 text-amber-700' :
                                    appointment.status === 'completed' ? 'bg-gray-50 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                                    'bg-purple-50 text-purple-700'
                                  }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>

                                  {/* A video consultation (parity B16) */}
                                  <VideoBookingIcon link={appointment.video_link} showLabel />
                                  {/* Reminder / SMS confirmation (not for finished visits) */}
                                  <ReminderStatusIcon
                                    status={appointment.status !== 'completed' ? reminderStatuses.get(appointment.id) : null}
                                    showLabel
                                  />
                                  {/* Invoiced or paid (parity B13), in words */}
                                  <DiaryBillingBadge badge={billingBadges.get(appointment.id)} size="sm" />
                                  {/* The practice's own status ("Called, no answer"), in words and colour */}
                                  <DiaryStatusLabel status={bookingStatuses.get(appointment.id)} size="sm" />
                                </div>

                                {/* Action buttons - bottom right */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready' || appointment.status === 'in-progress' || appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Validate appointment data before opening modal
                                        if (!appointment.patient_id) {
                                          console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                                          toast.error('Cannot open visit details - patient information missing');
                                          return;
                                        }
                                        setSelectedVisitForAction(appointment);
                                        setIsActionModalOpen(true);
                                      }}
                                      className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl  duration-200 group"
                                      title="Visit actions"
                                      aria-label="Visit actions"
                                    >
                                      <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}

            {/* Cancelled Section */}
            {appointmentSections.cancelled.length > 0 && (
              <div className="relative">
                {/* Section header */}
                <div className="flex items-center mb-4">
                  <div className="bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg px-5 py-2.5 shadow-lg flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    <span className="font-bold text-base">Cancelled</span>
                    <span className="text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      {appointmentSections.cancelled.length}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-red-300 via-red-200 to-transparent ml-4" />
                </div>

                {/* Appointments grid */}
                <div className="grid grid-cols-1 gap-3">
                  {appointmentSections.cancelled.map((appointment, index) => {
                    const StatusIcon = getStatusIcon(appointment.status);
                    const isUpcoming = appointment.status === 'scheduled';
                    const aptDate = parseISO(appointment.date);

                    return (
                      <div
                        key={appointment.id}
                        className="relative bg-white rounded-xl border border-gray-200 shadow-sm cursor-pointer overflow-hidden group"
                        onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                      >
                            {/* Faint inside border with status color */}
                            <div className={`absolute inset-0 rounded-[11px] border-2 ${
                            appointment.status === 'scheduled' ? 'border-blue-500/20' :
                            appointment.status === 'ready' ? 'border-emerald-500/20' :
                            appointment.status === 'in-progress' ? 'border-amber-500/20' :
                            appointment.status === 'completed' ? 'border-gray-500/20' :
                            appointment.status === 'cancelled' ? 'border-red-500/20' :
                            'border-purple-500/20'
                          } pointer-events-none`} />

                          {/* Subtle geometric pattern */}
                          <svg className="absolute right-0 top-0 w-32 h-32 opacity-[0.03]" viewBox="0 0 100 100">
                            <pattern id={`pattern-cancelled-${appointment.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                              <circle cx="10" cy="10" r="1.5" fill={
                                appointment.status === 'scheduled' ? '#3b82f6' :
                                appointment.status === 'ready' ? '#10b981' :
                                appointment.status === 'in-progress' ? '#f59e0b' :
                                appointment.status === 'completed' ? '#6b7280' :
                                appointment.status === 'cancelled' ? '#ef4444' :
                                '#a855f7'
                              } />
                            </pattern>
                            <rect width="100" height="100" fill={`url(#pattern-cancelled-${appointment.id})`} />
                          </svg>

                          {/* Smaller number badge - top left */}
                          <div className="absolute left-3 top-3 z-10">
                            <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg ${
                              appointment.status === 'scheduled' ? 'bg-blue-100 border border-blue-200' :
                              appointment.status === 'in-progress' ? 'bg-amber-100 border border-amber-200' :
                              appointment.status === 'completed' ? 'bg-gray-100 border border-gray-200' :
                              appointment.status === 'cancelled' ? 'bg-red-100 border border-red-200' :
                              'bg-purple-100 border border-purple-200'
                            }`} style={appointment.status === 'ready' ? { backgroundColor: '#01b8d8', border: 'none' } : {}}>
                              <span className={`font-semibold text-sm ${
                                appointment.status === 'scheduled' ? 'text-blue-700' :
                                appointment.status === 'ready' ? 'text-white' :
                                appointment.status === 'in-progress' ? 'text-amber-700' :
                                appointment.status === 'completed' ? 'text-gray-700' :
                                appointment.status === 'cancelled' ? 'text-red-700' :
                                'text-purple-700'
                              }`}>
                                {appointmentSections.schedule.length + appointmentSections.completed.length + index + 1}
                              </span>
                            </div>
                          </div>

                          {/* Clean compact content */}
                          <div className="relative">
                            {/* Top section with number badge and patient info side by side */}
                            <div className="flex gap-3 px-4 pt-4 pb-4">
                              {/* Space for number badge on the left */}
                              <div className="w-8 flex-none"></div>

                              {/* Patient details column - positioned next to number badge */}
                              <div className="flex-1 min-w-0 space-y-2">
                                {/* Patient name with icon; the status badge sits in the same row (wrapping below on
                                    narrow cards) so it can never cover the name */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <div className="p-1.5 rounded-lg flex-none">
                                    <User className={`h-4 w-4 ${
                                      appointment.status === 'scheduled' ? 'text-blue-600' :
                                      appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                      appointment.status === 'in-progress' ? 'text-amber-600' :
                                      appointment.status === 'completed' ? 'text-gray-600' :
                                      appointment.status === 'cancelled' ? 'text-red-600' :
                                      'text-purple-600'
                                    }`} />
                                  </div>
                                  <h3
                                    className="font-bold text-[#4f575e] text-base tracking-tight truncate flex-1 min-w-0"
                                    style={{ fontFamily: 'Poppins, sans-serif' }}
                                    title={`${appointment.patient.first_name} ${appointment.patient.last_name}`}
                                  >
                                    {appointment.patient.first_name} {appointment.patient.last_name}
                                  </h3>
                                  <span className={`ml-auto flex-none px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    appointment.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {getStatusBadgeLabel(appointment)}
                                  </span>
                                </div>

                                {/* Phone number with badge */}
                                {appointment.patient.cell_number && (
                                  <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${
                                      appointment.status === 'scheduled' ? 'bg-blue-50/70' :
                                      appointment.status === 'ready' ? 'bg-cyan-50/70' :
                                      appointment.status === 'in-progress' ? 'bg-amber-50/70' :
                                      appointment.status === 'completed' ? 'bg-gray-50/70' :
                                      appointment.status === 'cancelled' ? 'bg-red-50/70' :
                                      'bg-purple-50/70'
                                    }`}>
                                      <Phone className={`h-3.5 w-3.5 ${
                                        appointment.status === 'scheduled' ? 'text-blue-600' :
                                        appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                        appointment.status === 'in-progress' ? 'text-amber-600' :
                                        appointment.status === 'completed' ? 'text-gray-600' :
                                        appointment.status === 'cancelled' ? 'text-red-600' :
                                        'text-purple-600'
                                      }`} />
                                    </div>
                                    <span className="text-sm text-gray-600">{appointment.patient.cell_number}</span>
                                  </div>
                                )}
                                
                                {/* Designated doctor with badge */}
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg ${
                                    ''
                                  }`}>
                                    <Stethoscope className={`h-3.5 w-3.5 ${
                                      appointment.status === 'scheduled' ? 'text-blue-600' :
                                      appointment.status === 'ready' ? 'text-[#01b8d8]' :
                                      appointment.status === 'in-progress' ? 'text-amber-600' :
                                      appointment.status === 'completed' ? 'text-gray-600' :
                                      appointment.status === 'cancelled' ? 'text-red-600' :
                                      'text-purple-600'
                                    }`} />
                                  </div>
                                  <span className="text-sm text-gray-600">{practitionerLabel(appointment.doctor_id)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Full width grey line */}
                            <div className="h-px bg-gray-200" />

                            {/* Bottom section with info and button */}
                            <div className="px-4 py-3">
                              <div className="flex items-center justify-between">
                                {/* Info sections */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Time section */}
                                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm ${
                                    appointment.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                                    appointment.status === 'ready' ? 'bg-cyan-50 text-[#01b8d8]' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50 text-amber-700' :
                                    appointment.status === 'completed' ? 'bg-gray-50 text-gray-700' :
                                    appointment.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                                    'bg-purple-50 text-purple-700'
                                  }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.time ? format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a') : 'No time'}</span>
                                  </div>

                                  {/* Type section */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    {appointment.type === 'consultation' ? <Stethoscope className="h-3.5 w-3.5" /> :
                                      appointment.type === 'follow-up' ? <RefreshCcw className="h-3.5 w-3.5" /> :
                                      appointment.type === 'procedure' ? <TestTube className="h-3.5 w-3.5" /> :
                                      <Calendar className="h-3.5 w-3.5" />}
                                    <span className="text-xs font-semibold capitalize">{appointment.type}</span>
                                  </div>

                                  {/* Duration */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                                    <Timer className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">{appointment.duration}m</span>
                                  </div>

                                  {/* A video consultation (parity B16) */}
                                  <VideoBookingIcon link={appointment.video_link} showLabel />
                                  {/* Reminder / SMS confirmation (not for finished visits) */}
                                  <ReminderStatusIcon
                                    status={appointment.status !== 'completed' ? reminderStatuses.get(appointment.id) : null}
                                    showLabel
                                  />
                                  {/* Invoiced or paid (parity B13), in words */}
                                  <DiaryBillingBadge badge={billingBadges.get(appointment.id)} size="sm" />
                                  {/* The practice's own status ("Called, no answer"), in words and colour */}
                                  <DiaryStatusLabel status={bookingStatuses.get(appointment.id)} size="sm" />
                                </div>

                                {/* Action buttons - bottom right */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready' || appointment.status === 'in-progress' || appointment.status === 'completed' || appointment.status === 'cancelled') && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Validate appointment data before opening modal
                                        if (!appointment.patient_id) {
                                          console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                                          toast.error('Cannot open visit details - patient information missing');
                                          return;
                                        }
                                        setSelectedVisitForAction(appointment);
                                        setIsActionModalOpen(true);
                                      }}
                                      className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl  duration-200 group"
                                      title="Visit actions"
                                      aria-label="Visit actions"
                                    >
                                      <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Professional Timeline/Week View Component
  const TimelineView = () => {
    const visibleDoctors = selectedDoctorId
      ? weekGridPractitioners.filter((d) => d.id === selectedDoctorId)
      : weekGridPractitioners;
    
    const displayDates = viewMode === 'week' ? weekDates : [selectedDate];

    return (
      <div className="flex flex-col h-[600px] bg-white rounded-lg overflow-hidden border border-gray-200">
        {/* Professional Timeline Header */}
        <div className="bg-white/30 backdrop-blur-sm border-b border-dotted border-[#01b9d5]/40">
          <div className="flex">
            <div className="w-20 p-3 border-r border-dotted border-[#01b9d5]/40 bg-white/20 backdrop-blur-sm">
              <span className="text-xs font-medium text-gray-700">Time</span>
            </div>
            <div className="flex-1 flex">
              {viewMode === 'week' ? (
                displayDates.map((date, index) => (
                  <div
                    key={index}
                    className={`flex-1 p-3 border-r border-dotted border-[#01b9d5]/40 last:border-r-0 text-center
                      ${isSameDay(date, new Date()) ? 'bg-blue-100/30 backdrop-blur-sm border-dotted border-[#01b9d5]/60' : ''}`}
                  >
                    <p className="text-xs font-medium text-gray-600">{format(date, 'EEE')}</p>
                    <p className={`text-sm font-semibold ${
                      isSameDay(date, new Date()) ? 'text-blue-600' : 'text-gray-800'
                    }`}>
                      {format(date, 'd')}
                    </p>
                  </div>
                ))
              ) : (
                visibleDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="flex-1 p-3 border-r border-gray-200 last:border-r-0"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-8 h-8 bg-[#01b9d5] rounded-lg flex items-center justify-center text-white text-sm font-semibold">
                        {doctor.user_metadata?.full_name?.charAt(0) || 'D'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {doctor.user_metadata?.full_name || doctor.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-green-600">Available</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Professional Timeline Body */}
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="flex">
            <div className="w-20 bg-white/20 backdrop-blur-sm border-r border-dotted border-[#01b9d5]/40">
              {timeSlots.map((slot, index) => (
                <div
                  key={slot}
                  className="h-[60px] border-b border-dotted border-[#01b9d5]/30 p-2 text-xs font-medium text-gray-600 flex items-center"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {format(parseISO(`2000-01-01T${slot}`), 'h:mm a')}
                </div>
              ))}
            </div>
            
            <div className="flex-1 relative bg-white" ref={timelineRef}>
              {/* Current time indicator with premium style */}
              {isToday(selectedDate) && viewMode === 'day' && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                  style={{
                    top: `${((getHours(currentTime) - BUSINESS_HOURS.start) * 60 + getMinutes(currentTime)) / 60 * HOUR_HEIGHT}px`
                  }}
                >
                  <div className="absolute -top-2 -left-1 w-4 h-4 bg-red-500 rounded-full shadow-md">
                    <div className="absolute inset-0 bg-red-400 rounded-full animate-ping" />
                  </div>
                  <span className="absolute -top-3 left-6 text-xs font-medium text-red-500 bg-white px-2 rounded">
                    {format(currentTime, 'h:mm a')}
                  </span>
                </div>
              )}

              {/* Clean time grid */}
              {timeSlots.map((slot, index) => (
                <div
                  key={slot}
                  className="absolute left-0 right-0 border-b border-dotted border-[#01b9d5]/30"
                  style={{ 
                    top: `${index * HOUR_HEIGHT}px`,
                    height: `${HOUR_HEIGHT}px`
                  }}
                />
              ))}

              {/* Appointments or Day columns */}
              {viewMode === 'week' ? (
                <div className="relative h-full">
                  {displayDates.map((date, dayIndex) => {
                    const dayAppointments = filteredAppointments.filter(apt => 
                      isSameDay(parseISO(apt.date), date)
                    );

                    return (
                      <div
                        key={dayIndex}
                        className="absolute border-r border-dotted border-[#01b9d5]/30 last:border-r-0"
                        style={{
                          left: `${dayIndex * 14.285}%`,
                          width: '14.285%',
                          height: '100%'
                        }}
                      >
                        {dayAppointments.map((appointment) => {
                          const { top, height } = calculateAppointmentPosition(appointment);
                          const StatusIcon = getStatusIcon(appointment.status);

                          return (
                            <div
                              key={appointment.id}
                              className={`absolute left-1 right-1 bg-white/70 backdrop-blur-sm rounded-md shadow-sm hover:shadow-md 
                                border border-white/30 transition-shadow cursor-pointer overflow-hidden
                                ${getTypeAccent(appointment.type)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                            >
                              <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${getStatusGradient(appointment.status)}`} />
                              <div className="relative p-2 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-900">
                                    {format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a')}
                                  </span>
                                  <StatusIcon className="h-3 w-3 text-gray-500" />
                                </div>
                                <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                                  {appointment.patient.first_name} {appointment.patient.last_name}
                                </p>
                                <p className="text-xs text-gray-600 truncate capitalize">{appointment.type}</p>
                                {/* Action Buttons for Week View - only show if height allows */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready') && height >= 80 && (
                                  <div className="absolute bottom-1 right-1 flex gap-1">
                                    {appointment.status === 'scheduled' ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCheckIn(appointment.id);
                                          }}
                                          className="px-1.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] rounded shadow-sm "
                                          title="Check In"
                                        >
                                          CI
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkReady(appointment.id);
                                          }}
                                          className="px-1.5 py-0.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] rounded shadow-sm "
                                          title="Mark Ready"
                                        >
                                          R
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartVisit(appointment);
                                        }}
                                        className="px-1.5 py-0.5 bg-purple-500 hover:bg-purple-600 text-white text-[10px] rounded shadow-sm "
                                        title="Start Visit"
                                      >
                                        SV
                                      </button>
                                    )}
                                  </div>
                                )}
                                {/* Single button for smaller appointments */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready') && height >= 60 && height < 80 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (appointment.status === 'scheduled') {
                                        handleMarkReady(appointment.id);
                                      } else {
                                        handleStartVisit(appointment);
                                      }
                                    }}
                                    className={`absolute bottom-1 right-1 px-1.5 py-0.5 ${
                                      appointment.status === 'scheduled' 
                                        ? 'bg-blue-500 hover:bg-blue-600' 
                                        : 'bg-purple-500 hover:bg-purple-600'
                                    } text-white text-[10px] rounded shadow-sm `}
                                    title={appointment.status === 'scheduled' ? 'Mark Ready' : 'Start Visit'}
                                  >
                                    {appointment.status === 'scheduled' ? 'Ready' : 'Start'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Empty slot click areas */}
                        {timeSlots.map((slot, slotIndex) => (
                          <div
                            key={`${date}-${slot}`}
                            className="absolute left-0 right-0 hover:bg-[#01b9d5]/5  cursor-pointer"
                            style={{ 
                              top: `${slotIndex * HOUR_HEIGHT}px`,
                              height: `${HOUR_HEIGHT}px`
                            }}
                            onClick={() => {
                              setSelectedTimeSlot({ 
                                doctorId: selectedDoctorId || practitioners[0]?.id || '',
                                time: slot,
                                date: date 
                              });
                              setIsAddModalOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full">
                  {visibleDoctors.map((doctor) => {
                    const doctorAppointments = filteredAppointments.filter(
                      (apt) => apt.doctor_id === doctor.id
                    );

                    return (
                      <div key={doctor.id} className="flex-1 relative border-r border-dashed border-gray-300 last:border-r-0">
                        {doctorAppointments.map((appointment) => {
                          const { top, height } = calculateAppointmentPosition(appointment);
                          const StatusIcon = getStatusIcon(appointment.status);

                          return (
                            <div
                              key={appointment.id}
                              className={`absolute left-2 right-2 bg-white/70 backdrop-blur-sm rounded-md shadow-sm hover:shadow-md 
                                border border-white/30 transition-shadow cursor-pointer overflow-hidden
                                ${getTypeAccent(appointment.type)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => {
                          // Validate appointment data before opening modal
                          if (!appointment.patient_id) {
                            console.error('[PremiumAppointmentScheduler] Missing patient_id in appointment:', appointment);
                            toast.error('Cannot open visit details - patient information missing');
                            return;
                          }
                          setSelectedVisitForAction(appointment);
                          setIsActionModalOpen(true);
                        }}
                            >
                              <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${getStatusGradient(appointment.status)}`} />
                              <div className="relative p-3 h-full">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {format(parseISO(`2000-01-01T${appointment.time}`), 'h:mm a')}
                                  </span>
                                  <StatusIcon className="h-4 w-4 text-gray-500" />
                                </div>
                                <p className="text-base font-medium text-gray-900 mb-1">
                                  {appointment.patient.first_name} {appointment.patient.last_name}
                                </p>
                                <p className="text-sm text-gray-600 capitalize">{appointment.type}</p>
                                <div className={`inline-block px-2 py-1 mt-2 text-xs font-medium rounded ${getStatusColorClasses(appointment.status)}`}>
                                  {appointment.status}
                                </div>
                                {appointment.duration >= 60 && appointment.notes && (
                                  <p className="text-[10px] text-gray-500 mt-2 truncate">{appointment.notes}</p>
                                )}
                                {/* Action Buttons */}
                                {(appointment.status === 'scheduled' || appointment.status === 'ready') && (
                                  <div className="absolute bottom-2 right-2 flex gap-1">
                                    {appointment.status === 'scheduled' ? (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCheckIn(appointment.id);
                                          }}
                                          className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-md shadow-md "
                                        >
                                          Check In
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkReady(appointment.id);
                                          }}
                                          className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md shadow-md "
                                        >
                                          Ready
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartVisit(appointment);
                                        }}
                                        className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-md shadow-md "
                                      >
                                        Start Visit
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Empty slots for new appointments */}
                        {timeSlots.map((slot, index) => (
                          <div
                            key={`${doctor.id}-${slot}`}
                            className="absolute left-0 right-0 hover:bg-[#01b9d5]/5  cursor-pointer"
                            style={{ 
                              top: `${index * HOUR_HEIGHT}px`,
                              height: `${HOUR_HEIGHT}px`
                            }}
                            onClick={() => {
                              setSelectedTimeSlot({ 
                                doctorId: doctor.id, 
                                time: slot,
                                date: selectedDate 
                              });
                              setIsAddModalOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Until the user's saved default is known, so the diary does not open on the role's default and then jump
  if (isLoading || diaryDefault.status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-[#01b9d5] animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Error loading appointments</p>
          <button 
            onClick={onRefresh}
            className="mt-2 text-[#01b9d5] hover:text-[#0196be] text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Premium Header Section */}
      <div className="p-3 md:p-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-300">
        {/* Filters and Actions - Stack on mobile */}
        {/* Side by side from 1024px: on a tablet the two rows of buttons did not fit next to each other */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3 md:mb-4">
          <div className="flex items-center gap-2 w-full lg:w-auto">
          {/* Doctor Filter Button - Full width on mobile */}
          <button
            onClick={() => setShowDoctorModal(true)}
            className="flex-1 sm:flex-initial min-w-0 px-3 md:px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg
              font-medium flex items-center justify-center sm:justify-start gap-2 text-sm
              border border-gray-200 shadow-sm transition-colors"
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-none">
              {selectedPractitionerIds.length === 0 ? (
                <>
                  <span className="hidden sm:inline">Practitioner: </span>
                  <span>All practitioners</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">{selectedDoctorId ? 'Practitioner: ' : 'Practitioners: '}</span>
                  {describeDiaryView(selectedPractitionerIds, (id) => practitionerLabel(id, 'Unknown'))}
                </>
              )}
            </span>
          </button>

          {/* Day, week or month: the dashboard loads the whole range */}
          {props.onViewModeChange && (
            <div role="group" aria-label="Diary view" className="flex flex-none items-center rounded-lg border border-gray-200 bg-gray-100 p-0.5">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  onClick={() => props.onViewModeChange?.(mode)}
                  className={`rounded-md px-2.5 py-2 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 sm:px-3 sm:text-sm ${
                    viewMode === mode ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
          </div>

          {/* Right Side Actions - Row on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh appointments"
                aria-label="Refresh appointments"
              >
                <RefreshCw className="h-4 w-4 text-gray-600" />
              </button>
            )}

            {/* Block time: leave, lunch, meetings, the practice or a branch closed */}
            <button
              type="button"
              onClick={() => setIsBlockModalOpen(true)}
              className="flex-none px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 shadow-sm
                text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              title="Block time: leave, lunch, a meeting, or the practice closed"
              aria-label="Block time"
            >
              <Icon icon="solar:forbidden-circle-bold-duotone" className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <span className="hidden sm:inline">Block time</span>
            </button>

            {/* SMS reminders for a day's bookings, with a preview and a count first */}
            <button
              type="button"
              onClick={() => setIsRemindOpen(true)}
              className="flex-none px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 shadow-sm
                text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              title="Remind patients: SMS reminders for a day's bookings"
              aria-label="Remind patients"
            >
              <Icon icon="solar:bell-bing-bold-duotone" className="w-4 h-4 text-gray-500" aria-hidden="true" />
              <span className="hidden sm:inline">Remind</span>
            </button>

            <DiaryMoreMenu
              items={[
                { label: waitingList.menuLabel, icon: 'solar:hourglass-bold-duotone', onSelect: waitingList.open },
                { label: 'Diary report', icon: 'solar:chart-square-bold-duotone', onSelect: () => setIsReportOpen(true) },
                { label: 'Diary settings', icon: 'solar:settings-bold-duotone', onSelect: () => setSettingsTab('reminders') }
              ]}
            />

            {/* Schedule Appointment Button - Flex grow on mobile */}
            <button
              onClick={() => openBookingForm(null)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg 
                hover:from-purple-600 hover:to-indigo-700 font-medium 
                flex items-center justify-center gap-2 disabled:opacity-50 
                disabled:cursor-not-allowed shadow-lg text-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule</span>
            </button>
          </div>
        </div>

        {/* Appointment Status Filters - Improved mobile scrolling */}
        <div className="relative -mx-3 px-3 md:mx-0 md:px-0">
          <div className="flex items-center gap-1.5 sm:gap-1 p-1.5 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg w-full shadow-sm overflow-x-auto scrollbar-hide">
            {([
              { status: 'pending', label: 'Pending', count: statusCounts['pending'], gradient: 'from-orange-500 to-yellow-500', bg: 'bg-white', text: 'text-gray-700' },
              { status: 'scheduled', label: 'Scheduled', count: statusCounts['scheduled'], gradient: 'from-blue-500 to-blue-600', bg: 'bg-white', text: 'text-gray-700' },
              { status: 'checked-in', label: 'Checked In', count: statusCounts['checked-in'], gradient: 'from-purple-500 to-purple-600', bg: 'bg-white', text: 'text-gray-700' },
              { status: 'in-progress', label: 'In Progress', count: statusCounts['in-progress'], gradient: 'from-amber-500 to-amber-600', bg: 'bg-white', text: 'text-gray-700' },
              { status: 'completed', label: 'Completed', count: statusCounts['completed'], gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-white', text: 'text-gray-700' },
              { status: 'cancelled', label: 'Cancelled', count: statusCounts['cancelled'], gradient: 'from-red-500 to-red-600', bg: 'bg-white', text: 'text-gray-700' }
            ] as { status: StatusFilterKey; label: string; count: number; gradient: string; bg: string; text: string }[]).map((filter) => (
              <button
                key={filter.status}
                type="button"
                aria-pressed={statusFilter === filter.status}
                title={statusFilter === filter.status ? 'Show all statuses' : `Show only ${filter.label.toLowerCase()}`}
                onClick={() => setStatusFilter(prev => (prev === filter.status ? null : filter.status))}
                className={`flex-shrink-0 flex flex-col sm:flex-row items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-md ${filter.bg} ${filter.text} hover:shadow-md border min-w-[80px] sm:min-w-[100px] md:min-w-[120px] transition-all ${
                  statusFilter === filter.status
                    ? 'border-[#01b9d5] ring-2 ring-[#01b9d5]/40 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="whitespace-nowrap text-[11px] sm:text-xs">{filter.label}</span>
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${filter.gradient} text-white shadow-sm min-w-[24px]`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-gradient-to-br from-gray-50/50 via-white to-gray-50/30">
        {/* Public holiday and blocked time of the day (the week grid shows them in its columns) */}
        {viewMode === 'day' && (
          <DiaryDayNotices
            holiday={dayHoliday}
            blocks={dayBlocks}
            practitionerName={practitionerName}
            onManage={() => setIsBlockModalOpen(true)}
          />
        )}
        {/* A copied booking waits for a free time; cards and the month have none to click, so they offer the slots */}
        {copiedBooking && (
          <CopiedBookingBanner
            copied={copiedBooking}
            onCancel={() => setCopiedBooking(null)}
            onShowSlots={
              internalViewMode === 'timeline' && (viewMode === 'day' || viewMode === 'week')
                ? undefined
                : () => {
                    handleInternalViewModeChange('timeline');
                    if (viewMode !== 'day' && viewMode !== 'week') props.onViewModeChange?.('day');
                  }
            }
          />
        )}
        {viewMode === 'day' && internalViewMode === 'timeline' ? (
          // Day Timeline -> Use the drag-and-drop time grid
          <PremiumDayGridView
            // A new hour range or row length (the working hours or slots have loaded) draws the grid afresh: its
            // cards animate layout changes, and would otherwise slide from where the old range put them
            key={`${gridHours.start}-${gridHours.end}-${gridRows}`}
            selectedDate={selectedDate}
            appointments={filteredAppointments}
            doctors={dayGridColumns}
            visits={visitsWithLength}
            blocks={diaryBlocks.blocks}
            reminderStatuses={reminderStatuses}
            bookingStatuses={bookingStatuses}
            billingBadges={billingBadges}
            accountFlags={accountFlagSummaries}
            offHours={dayColumnHours.offHours}
            hoursSummaries={dayColumnHours.summaries}
            columnSlotMinutes={dayColumnHours.slots}
            onCheckMove={checkMove}
            onAppointmentClick={openBooking}
            onTimeSlotClick={(time, doctorId) => openSlot(time, format(time, 'HH:mm'), doctorId)}
            onAppointmentDrop={handleAppointmentDrop}
            onMarkReady={handleMarkReady}
            businessHours={{ start: minutesToTime(gridHours.start), end: minutesToTime(gridHours.end) }}
            slotDuration={gridRows}
            // The "Cancelled" filter (or a link to a cancelled booking) shows them; otherwise they free their time
            showCancelled={statusFilter === 'cancelled'}
          />
        ) : viewMode === 'day' && internalViewMode === 'grid' ? (
          // Day Grid -> Use card-based layout (same as month)
          <GridView />
        ) : viewMode === 'week' && internalViewMode === 'timeline' ? (
          // Week Timeline -> Use the week timeline view
          <PremiumWeekGridView
            weekDates={weekDates}
            appointments={filteredAppointments}
            doctors={weekGridPractitioners}
            blocks={diaryBlocks.blocks}
            blockPractitionerId={selectedDoctorId}
            reminderStatuses={reminderStatuses}
            bookingStatuses={bookingStatuses}
            billingBadges={billingBadges}
            accountFlags={accountFlagSummaries}
            hours={gridHours}
            slotMinutes={gridRows}
            offHours={weekOffHours}
            onAppointmentClick={openBooking}
            // The week has a column per day: a new booking starts with the practitioner shown, if only one is
            // (else the user's default practitioner, or reception chooses)
            onTimeSlotClick={(date, time, doctorId) => openSlot(date, time, doctorId || selectedDoctorId || undefined)}
            onMarkReady={handleMarkReady}
            // Dragging a booking to another day or time: the day grid's move, with the same checks
            onCheckMove={checkMove}
            onAppointmentDrop={handleAppointmentDrop}
          />
        ) : viewMode === 'week' && internalViewMode === 'grid' ? (
          // Week Grid -> Use card-based layout (same as month)
          <GridView />
        ) : viewMode === 'month' ? (
          // Month -> the calendar; a day opens in the day view
          <PremiumMonthGridView
            monthDate={selectedDate}
            appointments={filteredAppointments}
            blocks={diaryBlocks.blocks}
            blockPractitionerId={selectedDoctorId}
            selectedDate={selectedDate}
            onDayClick={(day) => {
              onDateChange(day);
              props.onViewModeChange?.('day');
            }}
          />
        ) : (
          // All -> card-based list
          <GridView />
        )}
      </div>


      {/* Add Appointment Modal */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedTimeSlot(null);
          waitingList.bookingClosed();
        }}
        title="Schedule Appointment"
      >
        {/* A free time clicked: who on the waiting list could take it */}
        {waitingList.stripFor(selectedTimeSlot)}
        <PremiumAddAppointmentForm
          key={bookingFormKey}
          initialDate={selectedTimeSlot ? selectedTimeSlot.date : selectedDate}
          initialTime={selectedTimeSlot?.time}
          initialDoctorId={selectedTimeSlot?.doctorId}
          prefill={selectedTimeSlot?.copy}
          onSuccess={(created) => {
            // A pasted copy is done once it is booked; closing the form without saving keeps it
            if (selectedTimeSlot?.pasted) setCopiedBooking(null);
            // A booking made for a waiting patient takes them off the waiting list
            waitingList.bookingSaved(created);
            setIsAddModalOpen(false);
            setSelectedTimeSlot(null);
            if (props.onRefresh) {
              props.onRefresh();
            }
          }}
          onCancel={() => {
            setIsAddModalOpen(false);
            setSelectedTimeSlot(null);
            waitingList.bookingClosed();
          }}
        />
      </FormModal>

      {/* The waiting list, who could take a cancelled time, and the SMS offer (parity B21) */}
      {waitingList.element}

      {/* Whose bookings the diary shows: one practitioner, several or everyone; "Open the diary on" keeps the choice */}
      <PractitionerFilterModal
        isOpen={showDoctorModal}
        onClose={() => setShowDoctorModal(false)}
        practitioners={practitioners}
        view={selectedPractitionerIds}
        onChange={setPickedView}
        defaultView={defaultView}
        canSaveDefault={diaryDefault.status === 'ready'}
        onSaveDefault={diaryDefault.save}
        nameOf={(id) => practitionerLabel(id, 'Unknown')}
      />
      
      {/* Visit Action Modal */}
      {selectedVisitForAction && (
        <VisitActionModal
          isOpen={isActionModalOpen}
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedVisitForAction(null);
          }}
          visit={selectedVisitForAction}
          visitStatus={toActionModalStatus(getVisitStage(selectedVisitForAction))}
          isCheckedIn={selectedVisitForAction.is_checked_in}
          onStartVisit={() => handleStartVisit(selectedVisitForAction)}
          onCompleteVisit={() => handleCompleteVisit(selectedVisitForAction.id)}
          onMoveToStage={(stage) => handleMoveToStage(selectedVisitForAction, stage)}
          onHandoffVisit={() => handleHandoffVisit(selectedVisitForAction.id)}
          onCheckIn={() => handleCheckIn(selectedVisitForAction.id)}
          onMarkReady={() => handleMarkReady(selectedVisitForAction.id)}
          onReschedule={() => {
            if (props.onEditAppointment) {
              props.onEditAppointment(selectedVisitForAction);
            }
          }}
          onCancel={() => handleCancelVisit(selectedVisitForAction.id)}
          onDelete={currentUserRole === 'admin' ? () => handleDeleteBooking(selectedVisitForAction) : undefined}
          onNoShow={() => handleNoShow(selectedVisitForAction.id)}
          onViewDetails={() => {
            if (props.onEditVisit) {
              props.onEditVisit(selectedVisitForAction);
            } else {
              onAppointmentClick(selectedVisitForAction);
            }
          }}
          onSendSMS={() => {
            setSelectedVisitForSMS(selectedVisitForAction);
            setIsSMSModalOpen(true);
          }}
          reminderStatus={reminderStatuses.get(selectedVisitForAction.id) ?? null}
          onOpenPatientFile={selectedVisitForAction.patient_id ? () => navigate(bookingLinks.patient(selectedVisitForAction.patient_id)) : undefined}
          onOpenInvoices={selectedVisitForAction.patient_id ? () => navigate(bookingLinks.invoices(selectedVisitForAction.patient_id)) : undefined}
          onBookAgain={selectedVisitForAction.patient_id ? () => void handleBookAgain(selectedVisitForAction) : undefined}
          onCopy={selectedVisitForAction.patient_id ? () => handleCopyBooking(selectedVisitForAction) : undefined}
          statusChoices={diaryStatusChoices(diaryStatuses, selectedVisitForAction)}
          currentStatus={shownDiaryStatus(diaryStatuses, selectedVisitForAction)}
          onSetStatus={(statusId) => void handleSetStatus(selectedVisitForAction, statusId)}
          onSetRecall={selectedVisitForAction.patient_id ? () => setRecallBooking(selectedVisitForAction) : undefined}
        />
      )}

      {/* Set Recall from a visit: when to call the patient back, and why (parity O3) */}
      {recallBooking?.patient_id && (
        <RecallSheet
          open
          onClose={() => setRecallBooking(null)}
          practiceId={diaryPracticeId}
          patientId={recallBooking.patient_id}
          patientName={[recallBooking.patient?.first_name, recallBooking.patient?.last_name].filter(Boolean).join(' ') || 'the patient'}
          visitId={recallBooking.id}
        />
      )}

      {/* Block time: practitioner unavailable, practice or branch closed */}
      <BlockTimeModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        practiceId={diaryPracticeId}
        practitioners={blockPractitioners}
        defaultDate={selectedDate}
        defaultPractitionerId={selectedDoctorId}
        onChanged={diaryBlocks.reload}
      />

      {/* Remind patients: a day's SMS reminders, previewed and counted before sending */}
      <RemindPatientsModal
        isOpen={isRemindOpen}
        onClose={() => setIsRemindOpen(false)}
        practiceId={diaryPracticeId}
        practitioners={blockPractitioners}
        defaultPractitionerId={selectedDoctorId}
        onOpenSettings={() => {
          setIsRemindOpen(false);
          setSettingsTab('reminders');
        }}
      />

      {/* Diary report: bookings per practitioner, no-shows, cancellations, how full the diary was */}
      <DiaryReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        practiceId={diaryPracticeId}
        practitioners={blockPractitioners}
        onOpenDay={(date, focus) => {
          const day = parseDateKey(date);
          if (day) onDateChange(day);
          props.onViewModeChange?.('day');
          showDiaryFocus(focus);
        }}
        onOpenPatient={(patientId) => navigate(bookingLinks.patient(patientId))}
      />

      {/* Diary settings: reminders, booking lengths, working hours */}
      <DiarySettingsModal
        isOpen={settingsTab !== null}
        onClose={() => setSettingsTab(null)}
        practiceId={diaryPracticeId}
        practitioners={hoursStaff}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        initialTab={settingsTab ?? 'reminders'}
        onSaved={diarySettings.reload}
      />

      {/* SMS Modal */}
      {selectedVisitForSMS && (
        <EnhancedSmsModal
          isOpen={isSMSModalOpen}
          onClose={() => {
            setIsSMSModalOpen(false);
            setSelectedVisitForSMS(null);
          }}
          patientId={selectedVisitForSMS.patient_id}
          visitId={selectedVisitForSMS.id}
          patientName={`${selectedVisitForSMS.patient?.first_name || ''} ${selectedVisitForSMS.patient?.last_name || ''}`}
          patientPhone={selectedVisitForSMS.patient?.cell_number || ''}
        />
      )}

      {/* Booking Request Modal */}
      {selectedBookingRequest && (
        <BookingRequestModal
          isOpen={isBookingRequestModalOpen}
          onClose={() => {
            setIsBookingRequestModalOpen(false);
            setSelectedBookingRequest(null);
          }}
          visit={selectedBookingRequest}
          onConfirm={() => {
            setIsBookingRequestModalOpen(false);
            setSelectedBookingRequest(null);
            // Refresh appointments
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}
    </div>
  );
};

export default PremiumAppointmentScheduler;