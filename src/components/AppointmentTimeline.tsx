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
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:mm:ss"
  duration: number;   // in minutes
  type: string;
  status: string;     // scheduled|confirmed|cancelled|completed|in-progress
  patient: { first_name: string; last_name: string; };
  doctor?: { full_name: string; };
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
const TOTAL_SLOTS = 24;  // 8:00 → 7:00 in 30m increments

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
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [selected, setSelected] = useState<Appointment|null>(null);
  const [actionOpen, setActionOpen] = useState(false);

  // tick current time every minute
  useEffect(() => {
    const tid = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tid);
  }, []);

  // drag/drop
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const appt = appointments.find(a => a.id === active.id);
    if (!appt) return;
    // over.id is "HH:mm"
    const [h,m] = (over.id as string).split(':').map(Number);
    const newTime = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
    try { await onUpdateAppointment(appt.id, { time: newTime }); }
    catch(err){ console.error(err); }
  };

  // status → color
  const statusStyles: Record<string,string> = {
    scheduled:   'bg-blue-50 border-blue-400',
    confirmed:   'bg-green-50 border-green-400',
    'in-progress':'bg-amber-50 border-amber-400',
    cancelled:   'bg-red-50 border-red-400',
    completed:   'bg-gray-50 border-gray-300',
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => onDateChange(subDays(date,1))}>
            <ChevronLeft size={16}/>
          </Button>
          <Button size="sm" variant="outline" onClick={()=>setIsCalOpen(v=>!v)} className="flex items-center">
            <CalendarIcon size={16} className="mr-1 text-[#01b9d4]"/>
            <span className="font-medium">{format(date,'EEEE, dd MMM yyyy')}</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDateChange(addDays(date,1))}>
            <ChevronRight size={16}/>
          </Button>
        </div>
        {isCalOpen && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-white border rounded-lg shadow p-4 z-50">
            <DayPicker
              mode="single"
              selected={date}
              onSelect={d=>d && (onDateChange(d), setIsCalOpen(false))}
            />
          </div>
        )}
      </div>

      {/* ─── Timeline ─── */}
      <div className="relative flex-1 overflow-y-auto">
        <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          <div
            className="
              grid grid-cols-[auto,1fr]
              grid-rows-[repeat(24,minmax(0,1fr))]
              h-[80vh] lg:h-[70vh]
            "
          >
            {/* Time labels & grid lines */}
            {Array.from({length:TOTAL_SLOTS}).map((_,i)=>{
              const hour = START_HOUR + Math.floor(i/2);
              const min = (i%2)*30;
              const label = format(new Date().setHours(hour,min,0,0),'h:mm a');
              return (
                <React.Fragment key={i}>
                  {/* label */}
                  <div className="
                    hidden sm:flex items-center justify-end pr-4
                    text-xs text-gray-400
                  "
                    style={{ gridRow: i+1, gridColumn: 1 }}
                  >{label}</div>
                  {/* dashed line */}
                  <div className="border-t border-dashed border-gray-200 w-full h-0"
                    style={{ gridRow: i+1, gridColumn: 2 }}
                  />
                </React.Fragment>
              );
            })}

            {/* “Now” indicator */}
            {isToday(date) && (() => {
              const nowMin = (now.getHours() - START_HOUR)*60 + now.getMinutes();
              const slotF = nowMin / 30;
              const row = Math.max(1,Math.min(TOTAL_SLOTS, slotF+1));
              return (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-400 z-10"
                  style={{
                    top: `calc(${(nowMin/(TOTAL_SLOTS*30))*100}% - 1px)`
                  }}
                >
                  <div className="absolute -left-2 -top-2 w-4 h-4 bg-red-400 rounded-full"/>
                </div>
              );
            })()}

            {/* Appointments */}
            {appointments
              .filter(a=>isSameDay(parseISO(a.date), date))
              .map(appt=>{
                // compute slot and span
                const [h,m] = appt.time.split(':').map(Number);
                const startMin = (h-START_HOUR)*60 + m;
                const startRowFrac = startMin/30 + 1;
                const spanRows = Math.max(1,Math.ceil(appt.duration/30));

                return (
                  <motion.div
                    key={appt.id}
                    layout
                    initial={{ opacity:0, y:5 }}
                    animate={{ opacity:1, y:0 }}
                    exit={{ opacity:0, y:-5 }}
                    className={`
                      relative col-start-2 col-span-1
                      rounded-lg shadow-md p-4
                      border-l-4 overflow-hidden
                      ${statusStyles[appt.status]||statusStyles.scheduled}
                    `}
                    style={{
                      gridRow: `${startRowFrac} / span ${spanRows}`
                    }}
                    onClick={()=>{setSelected(appt); setActionOpen(true)}}
                  >
                    <h3 className="
                      text-sm font-semibold text-gray-900
                      truncate
                    ">
                      {appt.patient.first_name} {appt.patient.last_name}
                    </h3>
                    <div className="mt-1 flex items-center text-xs text-gray-600 space-x-2">
                      <Clock size={12} />
                      <span className="truncate">
                        {format(parseISO(`${appt.date}T${appt.time}`),'HH:mm')} • {appt.type}
                      </span>
                    </div>
                    {appt.doctor && (
                      <div className="mt-1 text-xs text-gray-600 truncate">
                        Dr. {appt.doctor.full_name}
                      </div>
                    )}
                    <Badge
                      size="xs"
                      variant="glass"
                      className="mt-2 uppercase tracking-wide truncate"
                    >
                      {appt.status}
                    </Badge>
                  </motion.div>
                );
              })
            }
          </div>
        </DndContext>

        {/* no-data / loading states */}
        {!isLoading && appointments.filter(a=>isSameDay(parseISO(a.date), date)).length===0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <Clock size={48}/>
            <p className="mt-2">No appointments scheduled</p>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        )}
      </div>

      {/* ─── Action Modal ─── */}
      {selected && (
        <AppointmentActionModal
          isOpen={actionOpen}
          appointment={selected}
          onClose={()=>setActionOpen(false)}
          onStatusChange={async s=>{
            await onUpdateAppointment(selected.id, { status: s });
            setActionOpen(false);
          }}
          onEdit={()=>{ setActionOpen(false); onView(selected); }}
          onMessage={()=>selected && onMessagePatient?.(selected)}
        />
      )}
    </div>
  );
};
