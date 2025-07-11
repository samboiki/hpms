import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useVisitsStore } from '../../stores/visitsStore';
import { useAuthStore } from '../../stores/authStore';
import { 
  Search, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  AlertCircle, 
  Repeat,
  Bell,
  CheckSquare,
  Info,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { format, addWeeks, addMonths } from 'date-fns';
import { PremiumTimePicker } from '../ui/PremiumTimePicker';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface EnhancedAppointmentFormData {
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  notes?: string;
  is_recurring: boolean;
  recurrence_frequency?: 'daily' | 'weekly' | 'monthly';
  recurrence_interval?: number;
  recurrence_count?: number;
  recurrence_end_date?: string;
  reminder_enabled: boolean;
  reminder_timing: string[];
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  cell_number?: string;
  notification_preferences?: {
    sms: boolean;
    reminders: boolean;
  };
}

interface Doctor {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  onSuccess: () => void;
  initialDate?: Date;
  initialTime?: string;
  initialPatientId?: string;
}

const EnhancedAppointmentForm: React.FC<Props> = ({ 
  onSuccess, 
  initialDate, 
  initialTime,
  initialPatientId 
}) => {
  const { register, handleSubmit, formState: { errors }, watch, setValue, control } = useForm<EnhancedAppointmentFormData>({
    defaultValues: {
      date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      time: initialTime || format(new Date(), 'HH:mm'),
      duration: 30,
      type: 'consultation',
      is_recurring: false,
      recurrence_frequency: 'weekly',
      recurrence_interval: 1,
      recurrence_count: 4,
      reminder_enabled: true,
      reminder_timing: ['24h', '2h'],
      patient_id: initialPatientId || ''
    }
  });
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showRecurrencePreview, setShowRecurrencePreview] = useState(false);
  
  const { user } = useAuthStore();
  const { addVisit } = useVisitsStore();
  const isRecurring = watch('is_recurring');
  const reminderEnabled = watch('reminder_enabled');
  const selectedPatientId = watch('patient_id');
  const selectedDate = watch('date');
  const recurrenceFrequency = watch('recurrence_frequency');
  const recurrenceInterval = watch('recurrence_interval');
  const recurrenceCount = watch('recurrence_count');

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (patientSearchTerm) {
      const filtered = patients.filter(patient => {
        const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
        return fullName.includes(patientSearchTerm.toLowerCase());
      });
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [patientSearchTerm, patients]);

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, cell_number, notification_preferences')
        .order('last_name', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
      setFilteredPatients(data || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Failed to load patients');
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('role', 'doctor')
        .eq('practice_id', user?.practice_id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setDoctors(data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
      setError('Failed to load doctors');
    }
  };

  const calculateRecurrenceDates = () => {
    if (!isRecurring || !selectedDate) return [];
    
    const dates = [];
    const startDate = new Date(selectedDate);
    const count = recurrenceCount || 4;
    const interval = recurrenceInterval || 1;
    
    for (let i = 1; i <= count; i++) {
      let nextDate;
      switch (recurrenceFrequency) {
        case 'daily':
          nextDate = new Date(startDate);
          nextDate.setDate(startDate.getDate() + (i * interval));
          break;
        case 'weekly':
          nextDate = addWeeks(startDate, i * interval);
          break;
        case 'monthly':
          nextDate = addMonths(startDate, i * interval);
          break;
        default:
          nextDate = addWeeks(startDate, i * interval);
      }
      dates.push(nextDate);
    }
    
    return dates;
  };

  const onSubmit = async (data: EnhancedAppointmentFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Create the visit data for the visits table
      const visitData = {
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        practice_id: user?.practice_id || '',
        scheduled_date: data.date,
        scheduled_time: data.time + ':00', // Ensure seconds
        visit_date: data.date, // Same as scheduled_date for scheduled visits
        visit_time: data.time + ':00',
        visit_type: data.type,
        notes: data.notes,
        status: 'scheduled' as const,
        
        // Scheduling flags
        is_scheduled: true,
        is_confirmed: false, // Will need confirmation by practice
        is_ready: false,
        is_checked_in: false,
        is_cancelled: false,
        
        // Additional fields
        chief_complaint: data.notes || 'Scheduled appointment',
        follow_up_required: false,
      };

      // Handle single appointment
      if (!data.is_recurring) {
        await addVisit(visitData);
        
        toast.success(
          <div>
            <p className="font-semibold">Appointment scheduled successfully!</p>
            <p className="text-sm mt-1">The appointment has been added to the schedule</p>
            {data.reminder_enabled && (
              <p className="text-sm mt-1">Reminders will be sent automatically</p>
            )}
          </div>,
          { duration: 5000 }
        );
      } else {
        // Handle recurring appointments
        const count = data.recurrence_count || 4;
        const interval = data.recurrence_interval || 1;
        const startDate = new Date(data.date);
        
        // Create all recurring appointments
        for (let i = 0; i < count; i++) {
          let appointmentDate = new Date(startDate);
          
          if (i > 0) {
            switch (data.recurrence_frequency) {
              case 'daily':
                appointmentDate.setDate(startDate.getDate() + (i * interval));
                break;
              case 'weekly':
                appointmentDate = addWeeks(startDate, i * interval);
                break;
              case 'monthly':
                appointmentDate = addMonths(startDate, i * interval);
                break;
            }
          }
          
          const recurringVisitData = {
            ...visitData,
            scheduled_date: format(appointmentDate, 'yyyy-MM-dd'),
            visit_date: format(appointmentDate, 'yyyy-MM-dd'),
          };
          
          await addVisit(recurringVisitData);
        }
        
        toast.success(
          <div>
            <p className="font-semibold">Appointments scheduled successfully!</p>
            <p className="text-sm mt-1">{count} recurring appointments created</p>
            {data.reminder_enabled && (
              <p className="text-sm mt-1">Reminders will be sent automatically</p>
            )}
          </div>,
          { duration: 5000 }
        );
      }
      
      onSuccess();
    } catch (err) {
      console.error('Error creating appointment:', err);
      setError('Failed to create appointment');
      toast.error('Failed to create appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setValue('patient_id', patient.id);
    setPatientSearchTerm(`${patient.first_name} ${patient.last_name}`);
    setShowPatientDropdown(false);
    
    // Auto-configure reminders based on patient preferences
    if (!patient.notification_preferences?.reminders) {
      setValue('reminder_enabled', false);
    }
  };

  const getSelectedPatient = () => {
    return patients.find(p => p.id === selectedPatientId);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"
        >
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Patient Selection with enhanced UI */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Patient <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search patients..."
            value={patientSearchTerm}
            onChange={(e) => {
              setPatientSearchTerm(e.target.value);
              setShowPatientDropdown(true);
            }}
            onFocus={() => setShowPatientDropdown(true)}
            className="pl-10 block w-full rounded-lg border border-gray-300 px-3 py-2.5 
              focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent
              transition-all duration-200"
          />
          <input type="hidden" {...register('patient_id', { required: 'Patient is required' })} />
          
          <AnimatePresence>
            {showPatientDropdown && filteredPatients.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-lg border border-gray-200 
                  max-h-60 overflow-auto"
              >
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors
                      border-b border-gray-100 last:border-0"
                    onClick={() => handlePatientSelect(patient)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#01b9d5] to-purple-600 
                          rounded-full flex items-center justify-center text-white font-semibold">
                          {patient.first_name[0]}{patient.last_name[0]}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">
                            {patient.first_name} {patient.last_name}
                          </p>
                          {patient.cell_number && (
                            <p className="text-sm text-gray-500">{patient.cell_number}</p>
                          )}
                        </div>
                      </div>
                      {patient.notification_preferences?.reminders && (
                        <Bell className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {errors.patient_id && (
          <p className="mt-1 text-sm text-red-600">{errors.patient_id.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Doctor Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Doctor <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <select
              {...register('doctor_id', { required: 'Doctor is required' })}
              className="pl-10 block w-full rounded-lg border border-gray-300 px-3 py-2.5 
                focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
            >
              <option value="">Select doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.full_name}
                </option>
              ))}
            </select>
          </div>
          {errors.doctor_id && (
            <p className="mt-1 text-sm text-red-600">{errors.doctor_id.message}</p>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="pl-10 block w-full rounded-lg border border-gray-300 px-3 py-2.5 
                focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
            />
          </div>
          {errors.date && (
            <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
          )}
        </div>

        {/* Time */}
        <div>
          <PremiumTimePicker
            label="Time"
            value={watch('time')}
            onChange={(time) => setValue('time', time)}
            error={errors.time?.message}
            min="08:00"
            max="17:00"
            step={15}
            required
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration <span className="text-red-500">*</span>
          </label>
          <select
            {...register('duration', { required: 'Duration is required' })}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 
              focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </select>
          {errors.duration && (
            <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
          )}
        </div>

        {/* Type */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Appointment Type <span className="text-red-500">*</span>
          </label>
          <select
            {...register('type', { required: 'Type is required' })}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 
              focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
          >
            <option value="consultation">Consultation</option>
            <option value="follow-up">Follow-up</option>
            <option value="procedure">Procedure</option>
            <option value="emergency">Emergency</option>
          </select>
          {errors.type && (
            <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
          )}
        </div>
      </div>

      {/* Recurring Appointment Section */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-5 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Repeat className="h-5 w-5 text-purple-600 mr-2" />
            <h3 className="font-semibold text-gray-900">Recurring Appointment</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              {...register('is_recurring')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer 
              peer-checked:after:translate-x-full peer-checked:after:border-white 
              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
              after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all 
              peer-checked:bg-gradient-to-r peer-checked:from-[#01b9d5] peer-checked:to-purple-600">
            </div>
          </label>
        </div>

        <AnimatePresence>
          {isRecurring && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency
                  </label>
                  <select
                    {...register('recurrence_frequency')}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 
                      focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interval
                  </label>
                  <input
                    type="number"
                    {...register('recurrence_interval', { min: 1, max: 12 })}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 
                      focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="1"
                    max="12"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Occurrences
                  </label>
                  <input
                    type="number"
                    {...register('recurrence_count', { min: 1, max: 52 })}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 
                      focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="1"
                    max="52"
                  />
                </div>
              </div>

              {/* Preview recurring dates */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowRecurrencePreview(!showRecurrencePreview)}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium 
                    flex items-center gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  {showRecurrencePreview ? 'Hide' : 'Show'} recurring dates preview
                </button>
                
                <AnimatePresence>
                  {showRecurrencePreview && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 p-3 bg-white rounded-lg border border-purple-200"
                    >
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        This will create appointments on:
                      </p>
                      <div className="space-y-1">
                        {calculateRecurrenceDates().slice(0, 5).map((date, index) => (
                          <p key={index} className="text-sm text-gray-600">
                            • {format(date, 'EEEE, MMMM d, yyyy')}
                          </p>
                        ))}
                        {calculateRecurrenceDates().length > 5 && (
                          <p className="text-sm text-gray-500 italic">
                            ...and {calculateRecurrenceDates().length - 5} more
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reminder Settings */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-lg border border-green-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="font-semibold text-gray-900">Appointment Reminders</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              {...register('reminder_enabled')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer 
              peer-checked:after:translate-x-full peer-checked:after:border-white 
              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
              after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all 
              peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-emerald-600">
            </div>
          </label>
        </div>

        <AnimatePresence>
          {reminderEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {getSelectedPatient()?.notification_preferences?.sms === false && (
                <div className="mb-3 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <p className="ml-2 text-sm text-yellow-800">
                      This patient has opted out of SMS reminders. 
                      Reminders will be saved but not sent.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  When to send reminders:
                </p>
                <Controller
                  name="reminder_timing"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      {[
                        { value: '24h', label: '24 hours before' },
                        { value: '2h', label: '2 hours before' },
                        { value: '1h', label: '1 hour before' },
                        { value: '30m', label: '30 minutes before' }
                      ].map((option) => (
                        <label key={option.value} className="flex items-center">
                          <input
                            type="checkbox"
                            value={option.value}
                            checked={field.value.includes(option.value)}
                            onChange={(e) => {
                              const value = e.target.value;
                              const newValue = e.target.checked
                                ? [...field.value, value]
                                : field.value.filter(v => v !== value);
                              field.onChange(newValue);
                            }}
                            className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 
                              rounded focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-start pt-3 pointer-events-none">
            <FileText className="h-5 w-5 text-gray-400" />
          </div>
          <textarea
            {...register('notes')}
            rows={3}
            className="pl-10 block w-full rounded-lg border border-gray-300 px-3 py-2 
              focus:outline-none focus:ring-2 focus:ring-[#01b9d5] focus:border-transparent"
            placeholder="Add any relevant notes about the appointment..."
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white 
            hover:from-[#0196be] hover:to-purple-700 shadow-lg"
        >
          {isLoading ? (
            <div className="flex items-center">
              <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              Creating...
            </div>
          ) : (
            <div className="flex items-center">
              <CheckSquare className="h-4 w-4 mr-2" />
              {isRecurring ? 'Create Recurring Appointments' : 'Schedule Appointment'}
            </div>
          )}
        </Button>
      </div>
    </form>
  );
};

export default EnhancedAppointmentForm;