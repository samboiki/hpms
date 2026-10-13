import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMinutes, startOfDay, differenceInMinutes, isSameDay } from 'date-fns';
import { 
  Clock, 
  User, 
  Calendar, 
  MapPin, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  ChevronDown,
  Sparkles,
  Zap,
  Activity,
  Eye,
  Shield
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import { blocksOverlapping, describeDiaryBlock, type DiaryBlock } from '../../utils/diary/blockedTime';
import { localMoveReasons } from '../../utils/diary/bookingMove';
import { timeToMinutes, toDateKey } from '../../utils/diary/diaryTime';
import { layoutLanes, type LanePlacement } from '../../utils/diary/laneLayout';
import type { ReminderStatus } from '../../utils/diary/reminderStatus';
import { NO_PRACTITIONER_ID } from '../../utils/diary/diaryPractitioners';
import { columnCells, describeOffHourSpan, type OffHourSpan } from '../../utils/diary/gridHours';
import type { DiaryStatus } from '../../utils/diary/diaryStatuses';
import { ReminderStatusIcon } from './diary/ReminderStatusIcon';
import { VideoBookingIcon } from './diary/VideoBookingIcon';
import { DiaryStatusLabel } from './diary/DiaryStatusLabel';
import { DiaryBillingBadge } from './diary/DiaryBillingBadge';
import type { BillingBadge } from '../../utils/diary/billingBadge';
import { AccountFlagIcon } from '../finance/debtors/AccountFlagBadges';
import { OffHoursShade } from './diary/OffHoursShade';
import { useBookingMove } from './diary/useBookingMove';
import { PatientAvatar } from '../patients/photo/PatientAvatar';

// Blocked slots are striped so they read as "not available" even without colour
const BLOCKED_STRIPES = 'repeating-linear-gradient(135deg, rgba(156,163,175,0.16) 0, rgba(156,163,175,0.16) 6px, transparent 6px, transparent 12px)';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  /** A video consultation's room link; null = seen in the rooms */
  video_link?: string | null;
  patient?: {
    first_name: string;
    last_name: string;
    cell_number?: string;
    medical_aid_details?: {
      provider?: string;
      scheme_name?: string;
      member_number?: string;
    };
  };
  doctor?: {
    full_name: string;
  };
}

interface Doctor {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
    role: string;
  };
}

interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_date: string;
  scheduled_time: string;
  visit_date?: string;
  visit_time?: string;
  status: string;
  is_cancelled: boolean;
  /** Minutes the visit takes (its booked length, else its type's default); 30 when unknown */
  duration?: number;
}

interface PremiumDayGridViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  doctors: Doctor[];
  visits?: Visit[];
  onAppointmentClick?: (appointment: Appointment) => void;
  onTimeSlotClick?: (time: Date, doctorId: string) => void;
  onAppointmentDrop?: (appointmentId: string, newTime: Date, newDoctorId: string) => Promise<boolean>;
  onMarkReady?: (appointmentId: string) => void;
  businessHours?: { start: string; end: string };
  slotDuration?: number;
  /** Blocked time (leave, lunch, practice closed): greyed per practitioner; booking into it asks first */
  blocks?: DiaryBlock[];
  /** Reminder / SMS confirmation status per visit id */
  reminderStatuses?: Map<string, ReminderStatus>;
  /** Per patient id: the account flags that matter for billing, as words ("Account: Cash only"); one icon on the card */
  accountFlags?: Map<string, string>;
  /**
   * What reception must confirm before a moved booking lands there (clashes, blocked time, holidays,
   * working hours). Without it only blocked time and holidays are checked here.
   */
  onCheckMove?: (appointmentId: string, time: Date, doctorId: string) => Promise<string[]>;
  /**
   * Per column: the time its practitioner is not working (outside their hours, breaks, a day off),
   * shaded. Booking there still works, with the booking form's warning.
   */
  offHours?: Map<string, OffHourSpan[]>;
  /** Per column: the practitioner's hours that day, under their name ("08:00-17:00, break 13:00-14:00") */
  hoursSummaries?: Map<string, string>;
  /** Per visit id: the practice's own status shown on the card ("Waiting for X-ray") */
  bookingStatuses?: Map<string, DiaryStatus>;
  /**
   * Per column: the practitioner's own slot when it is longer than the rows (slotDuration is the shortest slot
   * shown): that column's free slots are drawn at its own length (src/utils/diary/slotLength.ts)
   */
  columnSlotMinutes?: Map<string, number>;
  /** Per visit id: "Invoiced" or "Paid" on the card (useVisitBillingBadges: one read for every card) */
  billingBadges?: Map<string, BillingBadge>;
  /**
   * Draw cancelled bookings too: the diary's "Cancelled" filter, or a link to a cancelled booking. Otherwise they are
   * left out, as their time is free again.
   */
  showCancelled?: boolean;
}

export const PremiumDayGridView: React.FC<PremiumDayGridViewProps> = ({
  selectedDate,
  appointments,
  doctors,
  visits = [],
  onAppointmentClick,
  onTimeSlotClick,
  onAppointmentDrop,
  onMarkReady,
  businessHours = { start: '08:00', end: '17:00' },
  slotDuration = 30,
  blocks = [],
  reminderStatuses,
  accountFlags,
  onCheckMove,
  offHours,
  hoursSummaries,
  bookingStatuses,
  columnSlotMinutes,
  billingBadges,
  showCancelled = false
}) => {
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate time slots
  const timeSlots: Date[] = [];
  const [startHour, startMinute] = businessHours.start.split(':').map(Number);
  const [endHour, endMinute] = businessHours.end.split(':').map(Number);
  const startTime = new Date(selectedDate);
  startTime.setHours(startHour, startMinute, 0, 0);
  const endTime = new Date(selectedDate);
  endTime.setHours(endHour, endMinute, 0, 0);

  let currentTime = new Date(startTime);
  while (currentTime < endTime) {
    timeSlots.push(new Date(currentTime));
    currentTime = addMinutes(currentTime, slotDuration);
  }

  // Get appointments for a specific time and doctor
  const getAppointmentForSlot = (time: Date, doctorId: string) => {
    return appointments.find(apt => {
      if (apt.doctor_id !== doctorId) return false;
      const aptTime = new Date(`${apt.date}T${apt.time}`);
      return isSameDay(aptTime, time) && 
             aptTime.getHours() === time.getHours() && 
             aptTime.getMinutes() === time.getMinutes();
    });
  };

  // Calculate appointment height based on duration
  const getAppointmentHeight = (duration: number) => {
    return (duration / slotDuration) * 60; // 60px per slot
  };

  // Get appointment position
  const getAppointmentTop = (appointment: Appointment) => {
    const aptTime = new Date(`${appointment.date}T${appointment.time}`);
    const minutesFromStart = differenceInMinutes(aptTime, startTime);
    return (minutesFromStart / slotDuration) * 60;
  };

  const doctorNameOf = (doctorId: string | null) =>
    doctorId ? doctors.find(doctor => doctor.id === doctorId)?.user_metadata?.full_name ?? null : null;

  // The practitioner's blocked time at a slot (whole-day blocks first), if any
  const dayKey = toDateKey(selectedDate);
  const blockForSlot = (time: Date, doctorId: string, minutes = slotDuration): DiaryBlock | undefined => {
    const start = time.getHours() * 60 + time.getMinutes();
    return blocksOverlapping(blocks, dayKey, start, start + minutes, doctorId)[0];
  };

  // Shaded time of a column, placed by the minute from the top of the grid
  const gridStartMinutes = startHour * 60 + startMinute;
  const offHourAt = (time: Date, doctorId: string, minutes = slotDuration): OffHourSpan | undefined => {
    const start = time.getHours() * 60 + time.getMinutes();
    return offHours?.get(doctorId)?.find((span) => span.start < start + minutes && span.end > start);
  };

  // A column's free slots: the rows, or its practitioner's own longer slots (each starting on its length since
  // midnight, so a 20-minute practitioner's slots meet the hour beside a 15-minute colleague's)
  const dayStart = startOfDay(selectedDate);
  const cellsFor = (doctorId: string): Array<{ time: Date; minutes: number; filler: boolean }> => {
    const own = columnSlotMinutes?.get(doctorId) ?? slotDuration;
    if (own === slotDuration) return timeSlots.map((time) => ({ time, minutes: slotDuration, filler: false }));
    return columnCells({ start: gridStartMinutes, end: endHour * 60 + endMinute }, own).map((cell) => ({
      time: addMinutes(dayStart, cell.start),
      minutes: cell.minutes,
      filler: cell.filler
    }));
  };

  // Dragging a booking to another time or practitioner (shared with the week grid): a started visit
  // stays, and a clash, blocked time, a public holiday or time outside the practitioner's hours is
  // confirmed first (the full booking checks when the diary passes them in)
  const move = useBookingMove<Appointment>({
    onDrop: onAppointmentDrop,
    onCheckMove,
    localReasons: (booking, time, practitionerId) =>
      localMoveReasons({ blocks, time, minutes: booking.duration || slotDuration, practitionerId, practitionerName: doctorNameOf })
  });

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'from-blue-400 to-blue-600';
      case 'in-progress': return 'from-amber-400 to-orange-600';
      case 'completed': return 'from-green-400 to-emerald-600';
      case 'cancelled': return 'from-gray-400 to-gray-600';
      case 'pending': return 'from-purple-400 to-indigo-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return User;
      case 'follow-up': return CheckCircle2;
      case 'procedure': return Activity;
      case 'emergency': return AlertCircle;
      default: return Calendar;
    }
  };

  // Check if slot is available
  const isSlotAvailable = (time: Date, doctorId: string, minutes = slotDuration) => {
    const slotEnd = addMinutes(time, minutes);
    
    // Only check visits table
    const hasVisit = visits.some(visit => {
      if (visit.doctor_id !== doctorId || visit.is_cancelled) return false;
      
      // Check scheduled time
      if (visit.scheduled_date && visit.scheduled_time) {
        const visitStart = new Date(`${visit.scheduled_date}T${visit.scheduled_time}`);
        // Each visit takes its own length (booked, else its type's default)
        const visitEnd = addMinutes(visitStart, visit.duration ?? 30);
        
        if (isSameDay(visitStart, time)) {
          return (
            (visitStart >= time && visitStart < slotEnd) ||
            (visitEnd > time && visitEnd <= slotEnd) ||
            (visitStart <= time && visitEnd >= slotEnd)
          );
        }
      }
      
      return false;
    });
    
    return !hasVisit;
  };

  // The block greyed on an empty slot (slots holding a booking show the booking instead)
  const displayedBlock = (time: Date, doctorId: string, minutes = slotDuration): DiaryBlock | undefined =>
    !getAppointmentForSlot(time, doctorId) && isSlotAvailable(time, doctorId, minutes) ? blockForSlot(time, doctorId, minutes) : undefined;

  // A double booking ("Book anyway") sits side by side in the practitioner's column, so neither
  // patient is hidden behind the other
  const placements = new Map<string, LanePlacement>();
  for (const doctor of doctors) {
    const own = appointments.filter((apt) => apt.doctor_id === doctor.id && (showCancelled || apt.status !== 'cancelled'));
    layoutLanes(
      own.map((apt) => {
        const start = timeToMinutes(apt.time) ?? 0;
        return { id: apt.id, start, end: start + (apt.duration || slotDuration) };
      })
    ).forEach((placement, id) => placements.set(id, placement));
  }

  return (
    <div className="h-full flex flex-col bg-white/40 backdrop-blur-lg rounded-xl shadow-sm border border-white/20">

      {/* Grid Container */}
      <div className="flex-1 overflow-auto custom-scrollbar" ref={gridRef}>
        <div className="flex">
          {/* Time Column */}
          <div className="flex-shrink-0 w-20 bg-white/30 backdrop-blur-md border-r border-dotted border-gray-400/40">
            <div className="sticky top-0 bg-white/50 backdrop-blur-lg z-20 h-12 border-b border-dotted border-gray-400/40" />
            {timeSlots.map((time, index) => (
              <div
                key={index}
                className="h-[60px] border-b border-dotted border-gray-400/30 px-2 py-1 relative"
              >
                <span className="text-sm text-gray-800 font-medium">
                  {format(time, 'h:mm a')}
                </span>
                {/* Current time indicator */}
                {isSameDay(time, new Date()) && 
                 time.getHours() === new Date().getHours() && 
                 Math.abs(time.getMinutes() - new Date().getMinutes()) < slotDuration && (
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-red-500"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    style={{ 
                      top: `${((new Date().getMinutes() - time.getMinutes()) / slotDuration) * 60}px` 
                    }}
                  >
                    <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Doctor Columns */}
          <div className="flex-1 flex bg-white/20 backdrop-blur-md">
            {doctors.map((doctor) => {
              // Bookings without a practitioner: shown here so none is hidden, but nothing new is booked
              // into this column (open a booking to assign it, or drag it onto a practitioner)
              const bookable = doctor.id !== NO_PRACTITIONER_ID;
              const summary = bookable ? hoursSummaries?.get(doctor.id) : 'Open a booking to assign it';
              return (
              <div key={doctor.id || 'no-practitioner'} className="flex-1 min-w-[200px] border-r border-dotted border-gray-400/30 last:border-r-0">
                {/* Doctor Header */}
                <div className="sticky top-0 bg-white/60 backdrop-blur-lg z-20 h-12 border-b border-dotted border-gray-400/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 flex-none rounded-full flex items-center justify-center', bookable ? 'bg-gradient-to-br from-[#01b9d5] to-[#0197a4]' : 'bg-gray-400')}>
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm leading-tight font-medium text-gray-800 truncate">
                        {doctor.user_metadata.full_name}
                      </p>
                      {summary && (
                        <p className="text-[11px] leading-tight text-gray-500 truncate" title={summary}>
                          {summary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Time Slots: the rows, or this practitioner's own longer slots */}
                <div className="relative">
                  {cellsFor(doctor.id).map((cell, index, cells) => {
                    const { time, minutes } = cell;
                    const height = (minutes / slotDuration) * 60;
                    // Before this practitioner's first slot (the grid starts earlier for a colleague): nothing to book
                    if (cell.filler) {
                      return <div key={index} className="border-b border-dotted border-gray-400/30" style={{ height: `${height}px` }} aria-hidden="true" />;
                    }
                    const appointment = getAppointmentForSlot(time, doctor.id);
                    const isAvailable = isSlotAvailable(time, doctor.id, minutes);
                    const isDropTarget = move.dropTarget?.practitionerId === doctor.id &&
                                       move.dropTarget.time.getTime() === time.getTime();
                    // Blocked time stays clickable: the booking form names the block and asks first
                    const block = displayedBlock(time, doctor.id, minutes);
                    const previous = index > 0 && !cells[index - 1].filler ? cells[index - 1] : null;
                    const showBlockLabel = !!block && (!previous || displayedBlock(previous.time, doctor.id, previous.minutes)?.id !== block.id);
                    const offHour = block ? undefined : offHourAt(time, doctor.id, minutes);

                    return (
                      <div
                        key={index}
                        className={cn(
                          minutes === slotDuration && "h-[60px]",
                          "border-b border-dotted border-gray-400/30 relative transition-all duration-200",
                          isDropTarget && move.isDragging && "bg-[#01b9d5]/20 border-[#01b9d5] backdrop-blur-sm",
                          bookable && !appointment && isAvailable && "hover:bg-white/30 backdrop-blur-sm cursor-pointer",
                          block && "bg-gray-100/70",
                          !appointment && !isAvailable && "bg-gray-100/50 opacity-40"
                        )}
                        style={{ height: `${height}px`, ...(block ? { backgroundImage: BLOCKED_STRIPES } : {}) }}
                        title={block ? `${describeDiaryBlock(block, doctorNameOf(block.doctorId))}. Booking here asks first.` : offHour ? describeOffHourSpan(offHour) : undefined}
                        onDragOver={bookable ? (e) => isAvailable && move.dragOver(e, time, doctor.id) : undefined}
                        onDrop={bookable ? (e) => isAvailable && move.drop(e, time, doctor.id) : undefined}
                        onClick={() => bookable && !appointment && isAvailable && onTimeSlotClick?.(time, doctor.id)}
                      >
                        {/* Blocked time: the reason, once at the top of each blocked stretch */}
                        {showBlockLabel && block && (
                          <div className="absolute inset-x-1 top-1 flex items-center gap-1 text-[11px] font-medium text-gray-500 pointer-events-none">
                            <Icon icon="solar:forbidden-circle-bold-duotone" className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                            <span className="truncate">{block.reason}</span>
                          </div>
                        )}
                        {/* Add slot indicator */}
                        {bookable && !appointment && isAvailable && !block && (
                          <motion.div
                            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                            whileHover={{ scale: 1.1 }}
                          >
                            <div className="w-8 h-8 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center border border-dotted border-gray-500/40">
                              <Zap className="w-4 h-4 text-gray-400" />
                            </div>
                          </motion.div>
                        )}
                        {/* Show unavailable indicator */}
                        {!appointment && !isAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-px bg-gray-400/40"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Not working: shaded by the minute; clicks reach the slot below */}
                  {(offHours?.get(doctor.id) ?? []).map((span) => (
                    <OffHoursShade
                      key={`off-${span.start}`}
                      span={span}
                      top={((span.start - gridStartMinutes) / slotDuration) * 60}
                      height={((span.end - span.start) / slotDuration) * 60}
                    />
                  ))}

                  {/* Appointments */}
                  {appointments
                    .filter(apt => apt.doctor_id === doctor.id && (showCancelled || apt.status !== 'cancelled'))
                    .map((appointment) => {
                      const TypeIcon = getTypeIcon(appointment.type);
                      const isExpanded = expandedAppointment === appointment.id;
                      const height = getAppointmentHeight(appointment.duration);
                      const top = getAppointmentTop(appointment);
                      const placement = placements.get(appointment.id) ?? { lane: 0, lanes: 1 };
                      const sideBySide = placement.lanes > 1;
                      // A short booking (15 minutes) keeps a thinner margin so its name still shows
                      const inset = height < 40 ? 2 : 4;

                      return (
                        <motion.div
                          key={appointment.id}
                          className={cn(
                            "absolute bg-white/60 backdrop-blur-lg rounded-lg shadow-sm border border-white/40 cursor-move overflow-hidden",
                            !sideBySide && "left-1 right-1",
                            "hover:shadow-lg hover:z-30 hover:bg-white/70 transition-all duration-200",
                            move.dragged?.id === appointment.id && "opacity-50"
                          )}
                          style={{
                            ...(sideBySide
                              ? { left: `calc(${(placement.lane / placement.lanes) * 100}% + 2px)`, width: `calc(${100 / placement.lanes}% - 4px)` }
                              : {}),
                            height: isExpanded ? 'auto' : `${height - inset * 2}px`,
                            minHeight: `${height - inset * 2}px`,
                            top: `${top + inset}px`
                          }}
                          draggable
                          onDragStart={(e) => move.dragStart(e, appointment)}
                          onDragEnd={move.dragEnd}
                          onClick={() => onAppointmentClick?.(appointment)}
                          whileHover={{ scale: 1.02 }}
                          layout
                        >
                          {/* Status gradient bar */}
                          <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b",
                            getStatusColor(appointment.status)
                          )} />

                          {/* Content */}
                          <div className="p-2 pl-3">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex-1 min-w-0">
                                {/* The patient's photo, only when the file has one (parity A12) */}
                                <PatientAvatar patientId={appointment.patient_id} className="float-left mr-1.5 h-6 w-6 rounded-full" />
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {appointment.patient?.first_name} {appointment.patient?.last_name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <TypeIcon className="w-3 h-3 text-gray-700" />
                                  <span className="text-xs text-gray-700">{appointment.type}</span>
                                  <span className="text-xs text-gray-600">
                                    {appointment.duration}min
                                  </span>
                                </div>
                                {/* Invoiced or paid (parity B13), then the practice's own status ("Waiting for X-ray"), in words and colour */}
                                <DiaryBillingBadge badge={billingBadges?.get(appointment.id)} className="mt-0.5 mr-1" />
                                <DiaryStatusLabel status={bookingStatuses?.get(appointment.id)} className="mt-0.5" />
                              </div>
                              <div className="flex items-center gap-1">
                                <AccountFlagIcon summary={accountFlags?.get(appointment.patient_id)} />
                                <VideoBookingIcon link={appointment.video_link} />
                                <ReminderStatusIcon status={reminderStatuses?.get(appointment.id)} />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAppointmentClick?.(appointment);
                                  }}
                                  className="p-1 hover:bg-[#01b9d5]/20 rounded transition-all group"
                                  title="View details"
                                  aria-label="View details"
                                >
                                  <Eye className="w-3 h-3 text-gray-300 group-hover:text-[#01b9d5]" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedAppointment(isExpanded ? null : appointment.id);
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  title={isExpanded ? 'Show less' : 'Show more'}
                                  aria-label={isExpanded ? 'Show less' : 'Show more'}
                                  aria-expanded={isExpanded}
                                >
                                  <ChevronDown className={cn(
                                    "w-3 h-3 text-gray-600 transition-transform",
                                    isExpanded && "rotate-180"
                                  )} />
                                </button>
                              </div>
                            </div>

                            {/* Expanded content */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="mt-2 pt-2 border-t border-dotted border-gray-400"
                                >
                                  {appointment.patient?.cell_number && (
                                    <div className="flex items-center gap-1 text-xs text-gray-300 mb-1">
                                      <Phone className="w-3 h-3" />
                                      {appointment.patient.cell_number}
                                    </div>
                                  )}
                                  {appointment.patient?.medical_aid_details && (
                                    <div className="flex items-center gap-1 text-xs text-gray-300 mb-1">
                                      <Shield className="w-3 h-3" />
                                      <span className="font-medium">
                                        {appointment.patient.medical_aid_details.provider}
                                      </span>
                                      {appointment.patient.medical_aid_details.scheme_name && (
                                        <span className="text-gray-400">
                                          • {appointment.patient.medical_aid_details.scheme_name}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {appointment.notes && (
                                    <p className="text-xs text-gray-300 line-clamp-2 mt-1">
                                      {appointment.notes}
                                    </p>
                                  )}
                                  
                                  {/* Mark Ready button for scheduled appointments */}
                                  {appointment.status === 'scheduled' && onMarkReady && (
                                    <div className="mt-2 pt-2 border-t border-dotted border-gray-400">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onMarkReady(appointment.id);
                                        }}
                                        className="w-full px-2 py-1 bg-[#01b8d8] hover:bg-[#01a8c7] text-white text-xs rounded-md font-medium shadow-sm transition-colors flex items-center justify-center gap-1"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        Mark Ready
                                      </button>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Loading indicator for pending */}
                          {appointment.status === 'pending' && (
                            <div className="absolute top-1 right-1" title="Not confirmed yet">
                              <Loader2 className="w-3 h-3 text-purple-500 animate-spin" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};