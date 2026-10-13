import React, { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { blocksOnDay, type DiaryBlock } from '../../utils/diary/blockedTime';
import { formatDiaryDate, parseDateKey, toDateKey } from '../../utils/diary/diaryTime';
import { monthGridWeeks } from '../../utils/diary/diaryRange';
import { diaryHolidayOn } from '../../utils/diary/holidays';
import { cn } from '../../utils/cn';

/** The fields of a diary booking the month grid shows */
export interface MonthAppointment {
  id: string;
  /** 'yyyy-MM-dd' */
  date: string;
  time: string;
  status: string;
  is_cancelled?: boolean;
  patient?: { first_name?: string | null; last_name?: string | null };
}

interface PremiumMonthGridViewProps {
  /** Any day of the month to show */
  monthDate: Date;
  appointments: MonthAppointment[];
  /** Blocked time of the month: whole-day closures and leave show on the day */
  blocks?: DiaryBlock[];
  /** The practitioner the diary is filtered to (null: practice and branch closures only) */
  blockPractitionerId?: string | null;
  selectedDate?: Date;
  /** Opens the day in the day view */
  onDayClick: (date: Date) => void;
}

const WEEKDAY_HEADERS = [
  { short: 'Mon', long: 'Monday' },
  { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' },
  { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' },
  { short: 'Sat', long: 'Saturday' },
  { short: 'Sun', long: 'Sunday' }
];
const NAMES_SHOWN = 3;

const isActive = (appointment: MonthAppointment) => !appointment.is_cancelled && !['cancelled', 'no-show'].includes(appointment.status);

const shortName = (appointment: MonthAppointment) => {
  const first = appointment.patient?.first_name?.trim() ?? '';
  const last = appointment.patient?.last_name?.trim() ?? '';
  return first || last ? `${first ? `${first.charAt(0)}. ` : ''}${last}`.trim() : 'Patient';
};

/**
 * The month at a glance: how many bookings each day has, the first few by time, public holidays and
 * whole-day closures. A day opens in the day view, where bookings are made and moved.
 */
export const PremiumMonthGridView: React.FC<PremiumMonthGridViewProps> = ({
  monthDate,
  appointments,
  blocks = [],
  blockPractitionerId = null,
  selectedDate,
  onDayClick
}) => {
  const weeks = useMemo(() => monthGridWeeks(monthDate), [monthDate]);
  const todayKey = toDateKey(new Date());
  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;

  const byDay = useMemo(() => {
    const days = new Map<string, MonthAppointment[]>();
    for (const appointment of appointments) {
      if (!isActive(appointment)) continue;
      const list = days.get(appointment.date) ?? [];
      list.push(appointment);
      days.set(appointment.date, list);
    }
    for (const list of days.values()) list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return days;
  }, [appointments]);

  return (
    <div className="p-2 sm:p-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50" aria-hidden="true">
          {WEEKDAY_HEADERS.map((day) => (
            <div key={day.short} className="px-1 py-2 text-center text-xs font-semibold text-gray-500">
              {day.short}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map(({ date, inMonth }) => {
            const day = parseDateKey(date);
            if (!day) return null;
            const list = byDay.get(date) ?? [];
            const holiday = diaryHolidayOn(date);
            const wholeDay = blocksOnDay(blocks, date, blockPractitionerId).find((block) => block.startMinutes === null);
            const isToday = date === todayKey;
            const isSelected = date === selectedKey;
            const label = [
              `${WEEKDAY_HEADERS[(day.getDay() + 6) % 7].long} ${formatDiaryDate(date)}`,
              list.length === 0 ? 'no bookings' : `${list.length} booking${list.length === 1 ? '' : 's'}`,
              holiday ? `${holiday.name}, public holiday` : null,
              wholeDay ? `${wholeDay.reason}, blocked all day` : null
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={date}
                type="button"
                onClick={() => onDayClick(day)}
                aria-label={`${label}. Open the day.`}
                aria-current={isToday ? 'date' : undefined}
                className={cn(
                  'relative flex min-h-[4.5rem] flex-col items-stretch gap-1 border-b border-r border-gray-100 p-1 text-left transition-colors sm:min-h-[7rem] sm:p-2',
                  'hover:bg-purple-50/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500',
                  !inMonth && 'bg-gray-50/70 text-gray-400',
                  holiday && inMonth && 'bg-amber-50/60',
                  isSelected && 'ring-2 ring-inset ring-purple-300'
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold sm:text-sm',
                      isToday ? 'bg-[#01b9d5] text-white' : inMonth ? 'text-gray-800' : 'text-gray-400'
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {list.length > 0 && (
                    <span className="min-w-0 truncate rounded-full bg-purple-100 px-1 text-[10px] font-bold text-purple-700 sm:px-1.5 sm:text-xs" aria-hidden="true">
                      {list.length}
                    </span>
                  )}
                </span>
                {holiday && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700" aria-hidden="true">
                    <Icon icon="solar:flag-bold-duotone" className="h-3 w-3 flex-none" />
                    <span className="hidden truncate sm:inline">{holiday.name}</span>
                  </span>
                )}
                {wholeDay && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-gray-500" aria-hidden="true">
                    <Icon icon="solar:forbidden-circle-bold-duotone" className="h-3 w-3 flex-none" />
                    <span className="hidden truncate sm:inline">{wholeDay.reason}</span>
                  </span>
                )}
                {/* Names only where there is room: on a phone the count says enough */}
                <span className="hidden min-w-0 flex-col gap-0.5 sm:flex" aria-hidden="true">
                  {list.slice(0, NAMES_SHOWN).map((appointment) => (
                    <span key={appointment.id} className="truncate text-[11px] text-gray-600">
                      <span className="font-medium tabular-nums text-gray-800">{(appointment.time || '').slice(0, 5)}</span> {shortName(appointment)}
                    </span>
                  ))}
                  {list.length > NAMES_SHOWN && <span className="text-[11px] font-medium text-purple-700">+{list.length - NAMES_SHOWN} more</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">Choose a day to see its bookings and book or move appointments.</p>
    </div>
  );
};

export default PremiumMonthGridView;
