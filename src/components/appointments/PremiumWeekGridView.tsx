import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isSameDay, parseISO } from 'date-fns';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  AlertCircle,
  CheckCircle2,
  Phone,
  Eye,
  Shield,
  Stethoscope,
  Activity,
  Pill,
  FileText
} from 'lucide-react';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';
import { slotForTime } from './weekGridSlots';
import { blocksOverlapping, diaryBlockDayLabel, type DiaryBlock } from '../../utils/diary/blockedTime';
import { localMoveReasons } from '../../utils/diary/bookingMove';
import { formatTimeRange, timeToMinutes } from '../../utils/diary/diaryTime';
import { layoutLanes } from '../../utils/diary/laneLayout';
import { diaryHolidayOn } from '../../utils/diary/holidays';
import type { ReminderStatus } from '../../utils/diary/reminderStatus';
import { describeOffHourSpan, gridRowTimes, shownGridRange, type GridRange, type OffHourSpan } from '../../utils/diary/gridHours';
import type { DiaryStatus } from '../../utils/diary/diaryStatuses';
import { ReminderStatusIcon } from './diary/ReminderStatusIcon';
import { VideoBookingIcon } from './diary/VideoBookingIcon';
import { DiaryStatusLabel } from './diary/DiaryStatusLabel';
import { DiaryBillingBadge } from './diary/DiaryBillingBadge';
import type { BillingBadge } from '../../utils/diary/billingBadge';
import { AccountFlagIcon } from '../finance/debtors/AccountFlagBadges';
import { OffHoursShade } from './diary/OffHoursShade';
import { useBookingMove } from './diary/useBookingMove';

// Blocked cells are striped so they read as "not available" even without colour
const BLOCKED_STRIPES = 'repeating-linear-gradient(135deg, rgba(156,163,175,0.16) 0, rgba(156,163,175,0.16) 6px, transparent 6px, transparent 12px)';
/** Pixels per half-hour; rows of another slot length keep the same scale, so a booking is as tall whatever the rows */
const ROW_HEIGHT = 80;

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

interface PremiumWeekGridViewProps {
  weekDates: Date[];
  appointments: Appointment[];
  doctors: Doctor[];
  onAppointmentClick?: (appointment: Appointment) => void;
  onTimeSlotClick?: (date: Date, time: string, doctorId?: string) => void;
  onMarkReady?: (appointmentId: string) => void;
  /** Blocked time (leave, lunch, practice closed); booking into it asks first */
  blocks?: DiaryBlock[];
  /** The practitioner the week is filtered to; null shows only practice and branch closures */
  blockPractitionerId?: string | null;
  /** Reminder / SMS confirmation status per visit id */
  reminderStatuses?: Map<string, ReminderStatus>;
  /** Per patient id: the account flags that matter for billing, as words ("Account: Cash only"); one icon on the card */
  accountFlags?: Map<string, string>;
  /** The hours to show (the practice's and practitioners' day); without it 08:00-17:00 */
  hours?: GridRange;
  /** Minutes per row: the diary slot of the practitioners shown (src/utils/diary/slotLength.ts), else half-hours */
  slotMinutes?: number;
  /** Per visit id: the practice's own status shown on the card ("Waiting for X-ray") */
  bookingStatuses?: Map<string, DiaryStatus>;
  /** Per day ('yyyy-MM-dd'): the time the practitioner shown, or else nobody, works; shaded */
  offHours?: Map<string, OffHourSpan[]>;
  /**
   * Saves a booking dragged to another day or time (it keeps its practitioner). Without it bookings cannot be dragged.
   */
  onAppointmentDrop?: (appointmentId: string, newTime: Date, newDoctorId: string) => Promise<boolean>;
  /** What reception must confirm before a moved booking lands there: the same checks as the day grid's drag */
  onCheckMove?: (appointmentId: string, time: Date, doctorId: string) => Promise<string[]>;
  /** Per visit id: "Invoiced" or "Paid" on the card (useVisitBillingBadges: one read for every card) */
  billingBadges?: Map<string, BillingBadge>;
}

// A half-hour row of a day as a date and time
const cellTime = (date: Date, time: string): Date => {
  const minutes = timeToMinutes(time) ?? 0;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60);
};

export const PremiumWeekGridView: React.FC<PremiumWeekGridViewProps> = ({
  weekDates,
  appointments,
  doctors,
  onAppointmentClick,
  onTimeSlotClick,
  onMarkReady,
  blocks = [],
  blockPractitionerId = null,
  reminderStatuses,
  accountFlags,
  hours,
  slotMinutes = 30,
  bookingStatuses,
  offHours,
  onAppointmentDrop,
  onCheckMove,
  billingBadges
}) => {
  const slot = Math.max(5, Math.round(slotMinutes));
  // Rows keep the half-hour scale: a 15-minute row is half as tall
  const rowHeight = (slot / 30) * ROW_HEIGHT;
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  // Dragging a booking to another day or time: the day grid's move (useBookingMove), the practitioner unchanged
  const move = useBookingMove<Appointment>({
    onDrop: onAppointmentDrop,
    onCheckMove,
    localReasons: (booking, time, practitionerId) =>
      localMoveReasons({
        blocks,
        time,
        minutes: booking.duration || 30,
        practitionerId,
        practitionerName: (id) => doctors.find((doctor) => doctor.id === id)?.user_metadata?.full_name ?? null
      })
  });
  const canMove = !!onAppointmentDrop;

  // Group appointments by date
  const appointmentsByDate = weekDates.reduce((acc, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    acc[dateStr] = appointments.filter(apt => apt.date === dateStr);
    return acc;
  }, {} as Record<string, Appointment[]>);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'from-blue-400 to-blue-600';
      case 'in-progress': return 'from-amber-400 to-orange-600';
      case 'completed': return 'from-gray-400 to-gray-600';
      case 'cancelled': return 'from-gray-300 to-gray-500';
      case 'pending': return 'from-purple-400 to-indigo-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return Stethoscope;
      case 'follow-up': return CheckCircle2;
      case 'procedure': return Activity;
      case 'emergency': return AlertCircle;
      default: return Calendar;
    }
  };

  // Rows for the hours shown, widened so every booking lands in a visible row to its end
  // (a hidden booking makes its slot look free, and reception could book on top of it)
  const range = shownGridRange(
    hours ? [{ open: hours.start, close: hours.end }] : [],
    appointments.map(apt => ({ start: timeToMinutes(apt.time), minutes: apt.duration || 30 })),
    slot
  );
  const timeSlots = gridRowTimes(range, slot);
  const gridStart = range.start;
  // The shaded time a cell touches, for its tooltip
  const offHourAt = (dateStr: string, time: string): OffHourSpan | undefined => {
    const start = timeToMinutes(time);
    return start === null ? undefined : offHours?.get(dateStr)?.find(span => span.start < start + slot && span.end > start);
  };

  // Public holidays of the week, shown in the day headers
  const holidayByDate = weekDates.reduce((acc, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    acc[dateStr] = diaryHolidayOn(dateStr)?.name ?? null;
    return acc;
  }, {} as Record<string, string | null>);

  // Blocked time greyed on an empty cell (cells with a booking show the booking)
  const blockForCell = (dateStr: string, time: string, hasAppointments: boolean): DiaryBlock | undefined => {
    const start = timeToMinutes(time);
    if (hasAppointments || start === null) return undefined;
    return blocksOverlapping(blocks, dateStr, start, start + slot, blockPractitionerId)[0];
  };

  return (
    <div className="h-full flex flex-col bg-white/40 backdrop-blur-lg rounded-xl shadow-sm overflow-hidden border border-white/20">
      {/* Header */}
      <div className="bg-white/50 backdrop-blur-lg border-b border-dotted border-gray-400/40">
        <div className="flex">
          <div className="flex-none w-12 sm:w-20 p-1 sm:p-3 border-r border-dotted border-gray-400/40 bg-white/30 backdrop-blur-md">
            <span className="text-xs font-semibold text-gray-700">Time</span>
          </div>
          {weekDates.map((date, index) => (
            <div
              key={index}
              className={cn(
                "flex-1 min-w-0 p-3 border-r border-dotted border-gray-400/30 last:border-r-0 text-center",
                isSameDay(date, new Date()) && "bg-[#01b9d5]/10 backdrop-blur-sm"
              )}
            >
              <p className="text-xs font-medium text-gray-500">{format(date, 'EEE')}</p>
              <p className={cn(
                "text-lg font-semibold",
                isSameDay(date, new Date()) ? "text-[#01b9d5]" : "text-gray-700"
              )}>
                {format(date, 'd')}
              </p>
              {holidayByDate[format(date, 'yyyy-MM-dd')] && (
                <p
                  className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-medium text-amber-700"
                  title={`${holidayByDate[format(date, 'yyyy-MM-dd')]}: public holiday`}
                >
                  <Icon icon="solar:flag-bold-duotone" className="h-3 w-3 flex-none" aria-hidden="true" />
                  <span className="truncate">{holidayByDate[format(date, 'yyyy-MM-dd')]}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Time Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="flex">
          {/* Time Column */}
          <div className="flex-shrink-0 w-12 sm:w-20 bg-white/20 backdrop-blur-sm">
            {timeSlots.map((time, index) => (
              <div
                key={index}
                className="border-b border-dotted border-gray-200 px-2 py-1"
                style={{ height: `${rowHeight}px` }}
              >
                <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
                  {format(parseISO(`2000-01-01T${time}`), 'h:mm a')}
                </span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDates.map((date, dayIndex) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayAppointments = appointmentsByDate[dateStr] || [];

            const appointmentsInRow = (time: string) =>
              dayAppointments.filter(apt => (apt.time ? slotForTime(apt.time, slot) === time : false));
            // Each booking is drawn as long as it is; overlapping ones sit side by side
            const dayLanes = layoutLanes(
              dayAppointments.map(apt => {
                const start = timeToMinutes(apt.time) ?? gridStart;
                return { id: apt.id, start, end: start + (apt.duration || 30) };
              })
            );

            return (
              <div
                key={dayIndex}
                className={cn(
                  "relative flex-1 min-w-0 border-r border-dotted border-gray-400/30 last:border-r-0 bg-white/20 backdrop-blur-sm",
                  holidayByDate[dateStr] && "bg-amber-50/40"
                )}
              >
                {timeSlots.map((time, timeIndex) => {
                  const slotKey = `${dateStr}-${time}`;
                  // An appointment at e.g. 09:15 shows in the 09:00 row instead of disappearing
                  const slotAppointments = appointmentsInRow(time);
                  // Blocked time stays clickable: the booking form names the block and asks first
                  const block = blockForCell(dateStr, time, slotAppointments.length > 0);
                  const previous = timeIndex > 0 ? timeSlots[timeIndex - 1] : null;
                  const showBlockLabel = !!block && (!previous || blockForCell(dateStr, previous, appointmentsInRow(previous).length > 0)?.id !== block.id);
                  const offHour = block ? undefined : offHourAt(dateStr, time);
                  // A booking dragged here starts at this row's time, with its own practitioner
                  const target = cellTime(date, time);
                  const isDropTarget = move.isDragging && move.dropTarget?.time.getTime() === target.getTime();

                  return (
                    <div
                      key={timeIndex}
                      data-slot={slotKey}
                      className={cn(
                        "border-b border-dotted border-gray-400/30 p-1 relative transition-colors",
                        hoveredSlot === slotKey && "bg-white/30 backdrop-blur-md",
                        "hover:bg-white/30 backdrop-blur-md cursor-pointer",
                        block && "bg-gray-100/70",
                        isDropTarget && "bg-[#01b9d5]/20"
                      )}
                      style={{ height: `${rowHeight}px`, ...(block ? { backgroundImage: BLOCKED_STRIPES } : {}) }}
                      title={block ? `${diaryBlockDayLabel(block, doctors.find(d => d.id === block.doctorId)?.user_metadata?.full_name)}. Booking here asks first.` : offHour ? describeOffHourSpan(offHour) : undefined}
                      onMouseEnter={() => setHoveredSlot(slotKey)}
                      onMouseLeave={() => setHoveredSlot(null)}
                      onClick={() => !slotAppointments.length && onTimeSlotClick?.(date, time)}
                      onDragOver={canMove ? (e) => move.dragOver(e, target, move.dragged?.doctor_id ?? '') : undefined}
                      onDrop={canMove ? (e) => move.drop(e, target, move.dragged?.doctor_id ?? '') : undefined}
                    >
                      {/* Blocked time: the reason, once at the top of each blocked stretch */}
                      {/* Positioned, so a long reason can never widen the day's column */}
                      {showBlockLabel && block && (
                        <div className="absolute inset-x-1 top-1 flex items-center gap-1 text-[10px] font-medium text-gray-500 pointer-events-none">
                          <Icon icon="solar:forbidden-circle-bold-duotone" className="h-3 w-3 flex-none" aria-hidden="true" />
                          <span className="truncate">{block.reason}</span>
                        </div>
                      )}
                      {/* Add appointment indicator */}
                      {!slotAppointments.length && hoveredSlot === slotKey && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <div className="bg-white/40 backdrop-blur-lg rounded-lg p-2 border border-dotted border-gray-400/40">
                            <Calendar className="w-4 h-4 text-gray-400" />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}

                {/* Not working: shaded by the minute; clicks reach the cell below */}
                {(offHours?.get(dateStr) ?? []).map(span => (
                  <OffHoursShade
                    key={`off-${span.start}`}
                    span={span}
                    top={((span.start - gridStart) / 30) * ROW_HEIGHT}
                    height={((span.end - span.start) / 30) * ROW_HEIGHT}
                  />
                ))}

                {/* The bookings, as long as they are booked; overlapping ones side by side */}
                {dayAppointments.map((appointment) => {
                  const TypeIcon = getTypeIcon(appointment.type);
                  const start = timeToMinutes(appointment.time) ?? gridStart;
                  const length = appointment.duration || 30;
                  const placement = dayLanes.get(appointment.id) ?? { lane: 0, lanes: 1 };
                  const top = ((start - gridStart) / 30) * ROW_HEIGHT + 2;
                  const height = Math.max((length / 30) * ROW_HEIGHT - 4, 28);

                  return (
                    <motion.div
                      key={appointment.id}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.02 }}
                      className="group absolute z-10 cursor-pointer hover:z-30"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${(placement.lane / placement.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / placement.lanes}% - 4px)`
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick?.(appointment);
                      }}
                    >
                      {/* The card body is what is dragged: it fills the card */}
                      <div
                        className={cn(
                          "relative h-full p-1 sm:p-1.5 rounded-lg border border-white/30 text-xs overflow-hidden",
                          "bg-white/80 backdrop-blur-sm hover:shadow-md transition-all",
                          appointment.status === 'pending' && "border-purple-300 bg-purple-50",
                          appointment.status === 'scheduled' && "border-blue-200 bg-blue-50",
                          appointment.status === 'completed' && "border-gray-200 bg-gray-50",
                          canMove && "cursor-move",
                          move.dragged?.id === appointment.id && "opacity-50"
                        )}
                        draggable={canMove}
                        onDragStart={canMove ? (e) => move.dragStart(e, appointment) : undefined}
                        onDragEnd={canMove ? move.dragEnd : undefined}
                      >
                        {/* Status bar */}
                        <div className={cn(
                          "absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b",
                          getStatusColor(appointment.status)
                        )} />

                        {/* Content */}
                        <div className="pl-2">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <TypeIcon className="hidden sm:block w-3 h-3 text-gray-500 flex-shrink-0" />
                              <p className="font-medium text-gray-900 truncate">
                                {appointment.patient?.first_name} {appointment.patient?.last_name?.charAt(0)}.
                              </p>
                            </div>
                            <AccountFlagIcon summary={accountFlags?.get(appointment.patient_id)} />
                            <VideoBookingIcon link={appointment.video_link} />
                            <ReminderStatusIcon status={reminderStatuses?.get(appointment.id)} />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentClick?.(appointment);
                              }}
                              className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                              title="View details"
                              aria-label="View details"
                            >
                              <Eye className="w-3 h-3 text-gray-400 hover:text-[#01b9d5]" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-500 tabular-nums">
                              {formatTimeRange(start, start + length)}
                            </span>
                            {appointment.patient?.medical_aid_details?.provider && (
                              <div className="flex items-center gap-0.5 min-w-0">
                                <Shield className="w-2.5 h-2.5 text-gray-400 flex-none" />
                                <span className="text-[10px] text-gray-500 truncate">
                                  {appointment.patient.medical_aid_details.provider}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Invoiced or paid (parity B13), then the practice's own status ("Waiting for X-ray"), in words and colour */}
                          <DiaryBillingBadge badge={billingBadges?.get(appointment.id)} className="mt-0.5 mr-1" />
                          <DiaryStatusLabel status={bookingStatuses?.get(appointment.id)} className="mt-0.5" />
                        </div>

                        {/* Hover actions */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {appointment.status === 'pending' && (
                            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" title="Not confirmed yet" />
                          )}
                          {appointment.status === 'scheduled' && onMarkReady && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkReady(appointment.id);
                              }}
                              className="px-1.5 py-0.5 bg-[#01b8d8] hover:bg-[#01a8c7] text-white text-[10px] rounded shadow-sm transition-colors font-medium"
                              title="Mark Ready"
                            >
                              Ready
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};