import React, { useState, useEffect } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  parseISO,
  isToday,
  isSameDay,
} from 'date-fns';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { motion } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import Button from './ui/Button';
import Badge from './ui/Badge';
import AppointmentActionModal from './modals/AppointmentActionModal';

interface Appointment {
  id: string;
  date: string;     // ISO date, e.g. "2025-05-22"
  time: string;     // "HH:mm:ss"
  duration: number; // minutes
  type: string;
  status: string;
  patient: { first_name: string; last_name: string };
  doctor?: { full_name: string };
}

interface Props {
  date: Date;
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  onDateChange: (d: Date) => void;
  onUpdateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  onView: (appt: Appointment) => void;
  onMessagePatient?: (appt: Appointment) => void;
}

const START_HOUR = 8;
const TOTAL_MINUTES = 11 * 60; // from 8:00→19:00

export const AppointmentTimeline: React.FC<Props> = ({
  date,
  appointments,
  isLoading,
  error,
  onDateChange,
  onUpdateAppointment,
  onView,
  onMessagePatient,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [actionOpen, setActionOpen] = useState(false);

  // 24 half-hour slots
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const h = START_HOUR + Math.floor(i / 2);
    const m = (i % 2) * 30;
    const slot = new Date(date);
    slot.setHours(h, m, 0, 0);
    return slot;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // tick current time
  useEffect(() => {
    const tid = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(tid);
  }, []);

  // drag handler
  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const appt = appointments.find(a => a.id === active.id);
    if (!appt) return;
    // over.id is "HH:mm"
    const [h, m] = (over.id as string).split(':').map(Number);
    const newTime = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    try {
      await onUpdateAppointment(appt.id, { time: newTime });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white rounded-2xl shadow overflow-hidden">
      {/* ─────── Header ─────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => onDateChange(subDays(date, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsCalendarOpen(v => !v)}>
            <CalendarIcon size={16} className="mr-1 text-[#01b9d4]" />
            <span className="font-medium">{format(date, 'EEEE, dd MMM yyyy')}</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDateChange(addDays(date, 1))}>
            <ChevronRight size={14} />
          </Button>
        </div>
        {isCalendarOpen && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-white border rounded-lg shadow-lg p-4 z-50">
            <DayPicker
              mode="single"
              selected={date}
              onSelect={d => { if (d) { onDateChange(d); setIsCalendarOpen(false); } }}
            />
          </div>
        )}
      </div>

      {/* ─────── Timeline ─────── */}
      <div className="relative flex-1 overflow-y-auto">
        {/** Use a percentage-based container so the grid always fills **/}
        <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
            {/** — Grid lines & labels — **/}
            {timeSlots.map((slot, i) => {
              const percent = (i / (timeSlots.length - 1)) * 100;
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-center text-gray-300 text-xs select-none"
                  style={{ top: `${percent}%` }}
                >
                  <div className="w-16 text-right pr-4">{format(slot, 'h:mm a')}</div>
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>
              );
            })}

            {/** — “Now” indicator — **/}
            {isToday(date) && (() => {
              const nowMin = (currentTime.getHours() - START_HOUR) * 60 + currentTime.getMinutes();
              const nowPerc = (nowMin / TOTAL_MINUTES) * 100;
              return (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-400"
                  style={{ top: `${nowPerc}%` }}
                >
                  <div className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-red-400" />
                </div>
              );
            })()}

            {/** — Appointments — **/}
            {appointments
              .filter(a => isSameDay(parseISO(a.date), date))
              .map(appt => {
                // compute percent-position & height
                const [h, m,s] = appt.time.split(':').map(Number);
                const startMin = (h - START_HOUR) * 60 + m;
                const topPerc = (startMin / TOTAL_MINUTES) * 100;
                const heightPerc = (appt.duration / TOTAL_MINUTES) * 100;

                // pastel background by status
                const statusBg: Record<string,string> = {
                  scheduled: 'bg-blue-50 border-blue-400',
                  confirmed: 'bg-green-50 border-green-400',
                  cancelled: 'bg-red-50 border-red-400',
                  completed: 'bg-gray-50 border-gray-300',
                  'in-progress': 'bg-amber-50 border-amber-400',
                };
                const colour = statusBg[appt.status] || 'bg-gray-50 border-gray-300';

                return (
                  <motion.div
                    key={appt.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={`absolute left-20 right-6 border-l-4 rounded-lg p-4 shadow hover:shadow-lg cursor-pointer transition ${colour}`}
                    style={{
                      top:    `${topPerc}%`,
                      height: `${heightPerc}%`,
                    }}
                    onClick={() => { setSelected(appt); setActionOpen(true); }}
                  >
                    <h3 className="text-sm font-semibold text-gray-900">
                      {appt.patient.first_name} {appt.patient.last_name}
                    </h3>
                    <div className="flex items-center text-xs text-gray-600 mt-1">
                      <Clock size={12} className="mr-1" />
                      <span>{format(parseISO(`${appt.date}T${appt.time}`), 'HH:mm')} • {appt.type}</span>
                      {appt.doctor && <span className="ml-2">• Dr. {appt.doctor.full_name}</span>}
                    </div>
                    <Badge variant="glass" size="xs" className="mt-2 uppercase tracking-wide">
                      {appt.status}
                    </Badge>
                  </motion.div>
                );
              })}
          </div>
        </DndContext>

        {/** — Empty & Loading States — **/}
        {!isLoading && appointments.filter(a => isSameDay(parseISO(a.date), date)).length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <Clock size={48} />
            <p className="mt-2">No appointments scheduled</p>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="animate-spin h-8 w-8 text-primary-500"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* ─────── Action Modal ─────── */}
      {selected && (
        <AppointmentActionModal
          isOpen={actionOpen}
          appointment={selected}
          onClose={() => setActionOpen(false)}
          onStatusChange={async s => {
            await onUpdateAppointment(selected.id, { status: s });
            setActionOpen(false);
          }}
          onEdit={() => { setActionOpen(false); onView(selected); }}
          onMessage={() => onMessagePatient && onMessagePatient(selected)}
        />
      )}
    </div>
  );
};
