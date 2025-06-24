import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { format, setHours, setMinutes, addMinutes } from 'date-fns';
import { checkAppointmentConflict } from '../../utils/appointments';
import { PremiumTimeRangePicker } from '../ui/PremiumTimeRangePicker';
import { PremiumDatePickerModal } from '../ui/PremiumDatePickerModal';
import { useAuthStore } from '../../stores/authStore';
import { debounce } from 'lodash';

interface AddAppointmentFormData {
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  end_time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  notes?: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

interface Doctor {
  id: string;
  full_name: string;
  role: string;
}

interface Props {
  onSuccess: (appointmentData?: any) => void;
  onCancel?: () => void;
  initialDate?: Date;
  initialTime?: string;
  initialDoctorId?: string;
  initialPatientId?: string;
  initialType?: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
}

const PremiumAddAppointmentForm: React.FC<Props> = ({ 
  onSuccess, 
  onCancel, 
  initialDate, 
  initialTime, 
  initialDoctorId, 
  initialPatientId, 
  initialType 
}) => {
  const { user } = useAuthStore();
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowPatientDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<AddAppointmentFormData>({
    defaultValues: {
      date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      time: initialTime || '09:00', // Will be updated when business hours load
      end_time: '',
      duration: 30,
      type: initialType || 'consultation',
      doctor_id: initialDoctorId || '',
      patient_id: initialPatientId || ''
    }
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [endTime, setEndTime] = useState<string>('');
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [businessHours, setBusinessHours] = useState<{ start: string; end: string }>({ start: '08:00', end: '18:00' });
  const [allBusinessHours, setAllBusinessHours] = useState<any>(null);
  
  const selectedPatientId = watch('patient_id');
  const selectedDate = watch('date');
  const selectedTime = watch('time');
  const selectedDoctorId = watch('doctor_id');
  const selectedDuration = watch('duration');

  // Fetch booked times when doctor or date changes
  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      fetchBookedTimes(selectedDoctorId, selectedDate);
    }
  }, [selectedDoctorId, selectedDate]);
  
  const fetchBookedTimes = async (doctorId: string, date: string) => {
    try {
      // Fetch scheduled visits excluding cancelled ones
      const { data: visits, error } = await supabase
        .from('visits')
        .select('scheduled_time, visit_time')
        .eq('doctor_id', doctorId)
        .eq('scheduled_date', date)
        .eq('is_scheduled', true)
        .eq('is_cancelled', false) // Exclude cancelled visits
        .in('status', ['scheduled', 'in-progress', 'ready']);
      
      if (error) throw error;
      
      // Generate array of booked time slots
      const bookedSlots: string[] = [];
      visits?.forEach(visit => {
        const time = visit.scheduled_time || visit.visit_time;
        if (time) {
          const [hours, minutes] = time.split(':').map(Number);
          const startTime = new Date();
          startTime.setHours(hours, minutes, 0, 0);
          
          // Mark every 15-minute slot within 30 minutes as booked
          for (let i = 0; i < 30; i += 15) {
            const slotTime = new Date(startTime.getTime() + (i * 60000));
            bookedSlots.push(format(slotTime, 'HH:mm'));
          }
        }
      });
      
      setBookedTimes(bookedSlots);
    } catch (err) {
      console.error('Error fetching booked times:', err);
      setBookedTimes([]);
    }
  };

  // Calculate end time whenever start time changes
  useEffect(() => {
    if (selectedTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      
      // Default 30 minutes duration
      const endDate = addMinutes(startDate, 30);
      const calculatedEndTime = format(endDate, 'HH:mm');
      setEndTime(calculatedEndTime);
      setValue('end_time', calculatedEndTime);
      setValue('duration', 30);
    }
  }, [selectedTime, setValue]);

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
    fetchBusinessHours();
  }, []);

  // Update default time when business hours are loaded
  useEffect(() => {
    if (!initialTime && businessHours.start !== '08:00') {
      // Only update if no initial time was provided and business hours have been fetched
      setValue('time', businessHours.start);
    }
  }, [businessHours, initialTime, setValue]);

  // Update business hours when selected date changes
  useEffect(() => {
    if (selectedDate && allBusinessHours) {
      const date = new Date(selectedDate);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[date.getDay()];
      
      const dayHours = allBusinessHours[dayName];
      
      if (dayHours && !dayHours.closed && dayHours.open && dayHours.close) {
        setBusinessHours({
          start: dayHours.open,
          end: dayHours.close
        });
      } else {
        // If selected day is closed, show a message or use default hours
        console.log(`Practice is closed on ${dayName}`);
        // You might want to show an error or warning to the user
        // For now, let's use the default working hours
        const defaultDay = allBusinessHours.monday || allBusinessHours.tuesday || 
                          allBusinessHours.wednesday || allBusinessHours.thursday || 
                          allBusinessHours.friday;
        if (defaultDay && defaultDay.open && defaultDay.close) {
          setBusinessHours({
            start: defaultDay.open,
            end: defaultDay.close
          });
        }
      }
    }
  }, [selectedDate, allBusinessHours]);

  // Auto-select doctor if only one available or if initial doctor provided
  useEffect(() => {
    if (doctors.length === 0) return;
    
    // If initial doctor ID is provided, use it
    if (initialDoctorId) {
      const doctor = doctors.find(d => d.id === initialDoctorId);
      if (doctor) {
        setValue('doctor_id', initialDoctorId);
        setSelectedDoctor(doctor);
      }
    }
    // If only one doctor available and no doctor selected yet
    else if (doctors.length === 1 && !selectedDoctorId) {
      setValue('doctor_id', doctors[0].id);
      setSelectedDoctor(doctors[0]);
    }
    // Update selected doctor object when ID changes
    else if (selectedDoctorId) {
      const doctor = doctors.find(d => d.id === selectedDoctorId);
      if (doctor) setSelectedDoctor(doctor);
    }
  }, [doctors, initialDoctorId, selectedDoctorId, setValue]);

  // Set initial patient
  useEffect(() => {
    if (initialPatientId && patients.length > 0 && !patientSearchTerm) {
      const selectedPatient = patients.find(p => p.id === initialPatientId);
      if (selectedPatient) {
        setPatientSearchTerm(`${selectedPatient.first_name} ${selectedPatient.last_name}`);
        setValue('patient_id', initialPatientId);
      }
    }
  }, [initialPatientId, patients, patientSearchTerm, setValue]);

  // Debounce search term with reduced delay for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(patientSearchTerm);
    }, 150); // Reduced from 300ms to 150ms
    
    return () => clearTimeout(timer);
  }, [patientSearchTerm]);

  // Memoize filtered patients for better performance
  const filteredPatientsResult = useMemo(() => {
    if (!debouncedSearchTerm || selectedPatientId) {
      return patients.slice(0, 10); // Show limited results initially
    }
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return patients
      .filter(patient => {
        const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
        return fullName.includes(searchLower) || 
               patient.first_name.toLowerCase().startsWith(searchLower) || 
               patient.last_name.toLowerCase().startsWith(searchLower);
      })
      .slice(0, 20); // Limit results for performance
  }, [debouncedSearchTerm, patients, selectedPatientId]);

  useEffect(() => {
    setFilteredPatients(filteredPatientsResult);
  }, [filteredPatientsResult]);

  const fetchPatients = async () => {
    try {
      setIsLoadingPatients(true);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user?.id)
        .single();

      if (userError) throw userError;
      const practiceId = userData?.practice_id || user?.practice_id;

      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .eq('practice_id', practiceId)
        .order('last_name', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
      setFilteredPatients(data || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      setIsLoadingDoctors(true);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user?.id)
        .single();

      if (userError) throw userError;
      const practiceId = userData?.practice_id || user?.practice_id;

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('role', 'doctor')
        .eq('practice_id', practiceId)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setDoctors(data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  const fetchBusinessHours = async () => {
    try {
      // Get user's practice_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user?.id)
        .single();

      if (userError) throw userError;
      const practiceId = userData?.practice_id || user?.practice_id;

      // Fetch practice business hours
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('business_hours')
        .eq('id', practiceId)
        .single();

      if (practiceError) throw practiceError;

      if (practiceData?.business_hours) {
        // Store all business hours for later use
        setAllBusinessHours(practiceData.business_hours);
        
        // Business hours structure: { monday: { open: "08:00", close: "17:00" }, ... }
        const hours = practiceData.business_hours;
        
        // Get the current day or use Monday as default for appointment scheduling
        const today = new Date();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = dayNames[today.getDay()];
        
        // Try to get today's hours first, fallback to Monday, or find any open day
        let dayHours = hours[currentDay];
        
        if (!dayHours || dayHours.closed) {
          // If today is closed, try Monday
          dayHours = hours.monday;
          
          // If Monday is also closed, find the first open day
          if (!dayHours || dayHours.closed) {
            for (const day of dayNames) {
              if (hours[day] && !hours[day].closed && hours[day].open && hours[day].close) {
                dayHours = hours[day];
                break;
              }
            }
          }
        }
        
        // Set the business hours if we found valid hours
        if (dayHours && dayHours.open && dayHours.close) {
          setBusinessHours({
            start: dayHours.open,
            end: dayHours.close
          });
          console.log('Business hours set:', dayHours.open, '-', dayHours.close);
        }
      }
    } catch (err) {
      console.error('Error fetching business hours:', err);
      // Keep default hours if fetch fails
    }
  };

  const onSubmit = async (data: AddAppointmentFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate duration from start and end times
      const [startHours, startMinutes] = data.time.split(':').map(Number);
      const [endHours, endMinutes] = data.end_time.split(':').map(Number);
      
      const startDate = new Date();
      startDate.setHours(startHours, startMinutes, 0, 0);
      
      const endDate = new Date();
      endDate.setHours(endHours, endMinutes, 0, 0);
      
      const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

      // Check for conflicting appointments
      const appointmentTime = setMinutes(setHours(new Date(data.date), startHours), startMinutes);
      const hasConflict = await checkAppointmentConflict(
        data.doctor_id,
        appointmentTime,
        durationMinutes
      );

      if (hasConflict) {
        setError('This time slot conflicts with an existing appointment');
        return;
      }

      // Get practice_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user?.id)
        .single();

      if (userError) throw userError;
      const practiceId = userData?.practice_id || user?.practice_id;

      // Create a scheduled visit
      const { data: newVisit, error: visitError } = await supabase
        .from('visits')
        .insert([{
          patient_id: data.patient_id,
          doctor_id: data.doctor_id,
          visit_date: data.date,
          visit_time: data.time,
          scheduled_date: data.date,
          scheduled_time: data.time,
          visit_type: data.type,
          chief_complaint: data.notes || '',
          notes: `Appointment scheduled for ${format(new Date(data.date), 'PPP')} at ${data.time} - ${data.end_time}`,
          practice_id: practiceId,
          is_scheduled: true,
          is_confirmed: true,
          is_checked_in: false,
          is_ready: false,
          is_cancelled: false,
          status: 'scheduled',
          created_at: new Date().toISOString()
        }])
        .select(`
          *,
          doctor:users!doctor_id(id, full_name),
          patient:patients!visits_patient_id_fkey(id, first_name, last_name)
        `)
        .single();

      if (visitError) throw visitError;

      console.log('✅ Created scheduled visit:', newVisit);
      onSuccess(newVisit);
    } catch (err) {
      console.error('Error creating appointment:', err);
      setError('Failed to create appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientSelect = useCallback((patient: Patient) => {
    setValue('patient_id', patient.id);
    setPatientSearchTerm(`${patient.first_name} ${patient.last_name}`);
    setShowPatientDropdown(false);
  }, [setValue]);

  const clearPatient = useCallback(() => {
    setValue('patient_id', '');
    setPatientSearchTerm('');
    setShowPatientDropdown(false);
  }, [setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Patient Selection */}
        <div className="col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Patient</label>
          <div className="relative">
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Icon 
                icon="solar:user-rounded-bold-duotone" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" 
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search patients..."
                value={patientSearchTerm}
                onChange={(e) => {
                  if (!initialPatientId) {
                    setPatientSearchTerm(e.target.value);
                    setShowPatientDropdown(true);
                  }
                }}
                onFocus={() => !initialPatientId && !selectedPatientId && setShowPatientDropdown(true)}
                disabled={!!initialPatientId}
                className={`w-full pl-10 ${selectedPatientId && !initialPatientId ? 'pr-12' : 'pr-4'} py-3 bg-white border border-gray-200 rounded-xl 
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 
                  transition-all duration-200 text-gray-700 font-medium
                  ${initialPatientId ? 'bg-gray-50 cursor-not-allowed' : ''}
                  hover:border-gray-300`}
              />
              {selectedPatientId && !initialPatientId && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={clearPatient}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-all duration-200 z-10 flex items-center justify-center"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </motion.button>
              )}
            </motion.div>
            <input type="hidden" {...register('patient_id', { required: 'Patient is required' })} />
            
            <AnimatePresence>
              {showPatientDropdown && !selectedPatientId && (
                <motion.div 
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-auto"
                  style={{ zIndex: 9999 }}
                >
                  {isLoadingPatients ? (
                    <div className="px-4 py-8 text-center">
                      <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading patients...</p>
                    </div>
                  ) : filteredPatients.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No patients found</p>
                    </div>
                  ) : (
                    filteredPatients.map((patient) => (
                      <motion.div
                        key={patient.id}
                        whileHover={{ backgroundColor: '#f3f4f6' }}
                        onClick={() => handlePatientSelect(patient)}
                        className="px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors"
                      >
                        <Icon icon="solar:user-circle-bold-duotone" className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-700">
                          {patient.first_name} {patient.last_name}
                        </span>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {errors.patient_id && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 text-sm text-red-600 flex items-center gap-1"
            >
              <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
              {errors.patient_id.message}
            </motion.p>
          )}
        </div>

        {/* Doctor Selection - Only show if more than one doctor */}
        {doctors.length > 1 ? (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Doctor</label>
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Icon 
                icon="solar:stethoscope-bold-duotone" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
              />
              <select
                {...register('doctor_id', { required: 'Doctor is required' })}
                onChange={(e) => {
                  const doctor = doctors.find(d => d.id === e.target.value);
                  if (doctor) setSelectedDoctor(doctor);
                }}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl 
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 
                  transition-all duration-200 text-gray-700 font-medium appearance-none
                  hover:border-gray-300"
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.full_name}
                  </option>
                ))}
              </select>
              <Icon 
                icon="solar:alt-arrow-down-bold-duotone" 
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
              />
            </motion.div>
            {errors.doctor_id && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-1 text-sm text-red-600 flex items-center gap-1"
              >
                <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
                {errors.doctor_id.message}
              </motion.p>
            )}
          </div>
        ) : (
          selectedDoctor && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Doctor</label>
              <div className="px-4 py-3 bg-cyan-50/50 border border-cyan-200 rounded-xl flex items-center gap-3">
                <Icon icon="solar:stethoscope-bold-duotone" className="w-5 h-5 text-cyan-600" />
                <span className="font-medium text-gray-700">{selectedDoctor.full_name}</span>
              </div>
            </div>
          )
        )}

        {/* Date - Premium Modal Date Picker */}
        <div>
          <PremiumDatePickerModal
            value={watch('date')}
            onChange={(date) => setValue('date', date)}
            label="Date"
            error={errors.date?.message}
            min={new Date()}
          />
        </div>

        {/* Time Range Selection */}
        <div className="col-span-2">
          <PremiumTimeRangePicker
            startTime={watch('time') || '09:00'}
            endTime={endTime}
            min={businessHours.start}
            max={businessHours.end}
            onStartTimeChange={(time) => {
              setValue('time', time);
              // Auto-calculate end time for 30 min default
              if (!endTime) {
                const [hours, minutes] = time.split(':').map(Number);
                const startDate = new Date();
                startDate.setHours(hours, minutes, 0, 0);
                const endDate = addMinutes(startDate, 30);
                const calculatedEndTime = format(endDate, 'HH:mm');
                setEndTime(calculatedEndTime);
                setValue('end_time', calculatedEndTime);
                setValue('duration', 30);
              }
            }}
            onEndTimeChange={(time) => {
              setEndTime(time);
              setValue('end_time', time);
              
              // Calculate duration
              const startTime = watch('time');
              if (startTime) {
                const [startHours, startMinutes] = startTime.split(':').map(Number);
                const [endHours, endMinutes] = time.split(':').map(Number);
                
                const startDate = new Date();
                startDate.setHours(startHours, startMinutes, 0, 0);
                
                const endDate = new Date();
                endDate.setHours(endHours, endMinutes, 0, 0);
                
                if (endDate > startDate) {
                  const durationMs = endDate.getTime() - startDate.getTime();
                  const durationMinutes = Math.round(durationMs / 60000);
                  setValue('duration', durationMinutes);
                }
              }
            }}
            error={errors.time?.message || errors.end_time?.message}
            bookedTimes={bookedTimes}
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Appointment Type</label>
          <motion.div 
            className="relative"
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Icon 
              icon="solar:clipboard-heart-bold-duotone" 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
            />
            <select
              {...register('type', { required: 'Type is required' })}
              disabled={!!initialType}
              className={`w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl 
                focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 
                transition-all duration-200 text-gray-700 font-medium appearance-none
                hover:border-gray-300
                ${initialType ? 'bg-gray-50 cursor-not-allowed' : ''}`}
            >
              <option value="consultation">Consultation</option>
              <option value="follow-up">Follow-up</option>
              <option value="procedure">Procedure</option>
              <option value="emergency">Emergency</option>
            </select>
            <Icon 
              icon="solar:alt-arrow-down-bold-duotone" 
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
            />
          </motion.div>
          {errors.type && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 text-sm text-red-600 flex items-center gap-1"
            >
              <Icon icon="solar:danger-circle-bold" className="w-4 h-4" />
              {errors.type.message}
            </motion.p>
          )}
        </div>

        {/* Notes */}
        <div className="col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
          <motion.div 
            className="relative"
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Icon 
              icon="solar:notes-bold-duotone" 
              className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" 
            />
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Add any additional notes..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl 
                focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 
                transition-all duration-200 text-gray-700 font-medium resize-none
                hover:border-gray-300"
            />
          </motion.div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (onCancel) {
              onCancel();
            } else {
              onSuccess();
            }
          }}
          className="px-6 py-3 text-gray-700 bg-white border border-gray-200 rounded-xl 
            hover:bg-gray-50 transition-all duration-200 font-semibold flex items-center gap-2"
        >
          <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
          Cancel
        </motion.button>
        
        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl 
            hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 font-semibold 
            flex items-center gap-2 shadow-lg shadow-cyan-500/25 disabled:opacity-50 
            disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5" />
              Schedule Appointment
            </>
          )}
        </motion.button>
      </div>
    </form>
  );
};

export default PremiumAddAppointmentForm;