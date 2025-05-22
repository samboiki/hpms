import React from 'react';
import { Clock, CheckCircle2, XCircle, User } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/Card';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: string;
  notes?: string;
  patient: {
    first_name: string;
    last_name: string;
  };
  doctor?: {
    full_name: string;
  };
}

interface AppointmentTimelineProps {
  date: Date;
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  onCheckIn: (id: string) => void;
  onCancel: (id: string) => void;
  onView: (appointment: Appointment) => void;
}

export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
  date, 
  appointments, 
  isLoading, 
  error, 
  onCheckIn, 
  onCancel, 
  onView
}) => {
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 08 → 19

  return (
    <div className="flex-1 bg-white rounded-xl shadow p-4 overflow-y-auto">
      <h2 className="font-rubik font-semibold text-lg mb-6">
        {format(date, 'EEEE, dd MMM')}
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      ) : (
        <>
          {hours.map((h) => {
            const bucket = appointments.filter(
              a => a.date === format(date, 'yyyy-MM-dd') &&
                  parseInt(a.time.split(':')[0]) === h
            );

            return (
              <div key={h} className="mb-6">
                <div className="text-xs text-gray-400 mb-1">
                  {format(setMinutes(setHours(date, h), 0), 'h:00 a')}
                </div>

                {bucket.length === 0 ? (
                  <div className="h-6 rounded bg-gray-50" />
                ) : (
                  bucket.map(appt => (
                    <motion.div
                      key={appt.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`
                        flex items-center justify-between p-3 mb-2 rounded-lg shadow
                        ${appt.status === 'scheduled'   ? 'bg-blue-50'  :
                          appt.status === 'in-progress' ? 'bg-amber-50' :
                          appt.status === 'cancelled'   ? 'bg-red-50'   : 'bg-green-50'}
                      `}
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {appt.patient.first_name} {appt.patient.last_name}
                        </p>
                        <p className="flex items-center text-xs text-gray-500">
                          <Clock size={12} className="mr-1" />
                          {appt.time} • {appt.type}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1">
                        <Badge variant={
                          appt.status === 'scheduled'   ? 'azure' :
                          appt.status === 'in-progress' ? 'warning' :
                          appt.status === 'cancelled'   ? 'error'   : 'success'
                        } size="sm">
                          {appt.status}
                        </Badge>

                        {appt.status === 'scheduled' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => onCheckIn(appt.id)}
                            >
                              <CheckCircle2 size={14} />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-red-600"
                              onClick={() => onCancel(appt.id)}
                            >
                              <XCircle size={14} />
                            </Button>
                          </>
                        )}

                        {appt.status === 'in-progress' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onView(appt)}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            );
          })}

          {appointments.length === 0 && (
            <div className="text-center py-8">
              <Clock size={40} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No appointments scheduled</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};