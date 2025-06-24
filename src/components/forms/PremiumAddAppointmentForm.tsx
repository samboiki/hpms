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
import { AppointmentTypeModal } from '../ui/AppointmentTypeModal';
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
  const [showTypeModal, setShowTypeModal] = useState(false);
  
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
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center gap-3">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Patient Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
      >
        <motion.div 
          className="flex items-center gap-3 mb-6 -ml-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon icon="solar:user-rounded-bold-duotone" className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
            <p className="text-sm text-gray-500">Select the patient for this appointment</p>
          </div>
        </motion.div>
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient
            </label>
            <motion.div 
              className="relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
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
                className={`w-full pl-10 ${selectedPatientId && !initialPatientId ? 'pr-12' : 'pr-4'} py-3 bg-gray-100 border-0 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-purple-500 
                  transition-all duration-200 text-gray-700
                  ${initialPatientId ? 'bg-gray-200 cursor-not-allowed' : ''}
                  hover:bg-gray-200`}
              />
              {selectedPatientId && !initialPatientId && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 500,
                    damping: 25
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={clearPatient}
                  className="absolute right-3 inset-y-0 m-auto h-8 w-8 hover:bg-gray-200 rounded-full transition-all duration-200 z-10 flex items-center justify-center"
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
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ 
                    duration: 0.2,
                    ease: [0.23, 1, 0.32, 1]
                  }}
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
                    filteredPatients.map((patient, index) => (
                      <motion.div
                        key={patient.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ 
                          backgroundColor: 'rgba(243, 244, 246, 0.8)',
                          x: 4,
                          transition: { duration: 0.15, ease: "easeOut" }
                        }}
                        onClick={() => handlePatientSelect(patient)}
                        className="px-4 py-3 cursor-pointer flex items-center gap-3 transition-all duration-200"
                      >
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <Icon icon="solar:user-circle-bold-duotone" className="w-5 h-5 text-gray-400" />
                        </motion.div>
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
      </motion.div>

      {/* Appointment Details Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
      >
        <motion.div 
          className="flex items-center gap-3 mb-6 -ml-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="p-2 bg-purple-100 rounded-lg">
            <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>
            <p className="text-sm text-gray-500">Configure the appointment settings</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Doctor Selection - Only show if more than one doctor */}
          {doctors.length > 1 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Doctor
              </label>
              <div className="relative">
                <select
                  {...register('doctor_id', { required: 'Doctor is required' })}
                  onChange={(e) => {
                    const doctor = doctors.find(d => d.id === e.target.value);
                    if (doctor) setSelectedDoctor(doctor);
                  }}
                  className="w-full px-4 pr-10 py-3 bg-gray-100 border-0 rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-purple-500 
                    transition-all duration-200 text-gray-700 appearance-none
                    hover:bg-gray-200"
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
              </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Icon icon="solar:stethoscope-bold-duotone" className="w-4 h-4 text-purple-500" />
                  Doctor
                </label>
                <div className="px-4 py-3 bg-gray-200 border-0 rounded-lg flex items-center gap-3">
                  <Icon icon="solar:stethoscope-bold-duotone" className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-700">{selectedDoctor.full_name}</span>
                </div>
              </div>
            )
          )}

          {/* Appointment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Appointment Type
            </label>
            <div className="relative">
              <Icon 
                icon="solar:clipboard-heart-bold-duotone" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
              />
              <input
                type="hidden"
                {...register('type', { required: 'Type is required' })}
              />
              <button
                type="button"
                onClick={() => !initialType && setShowTypeModal(true)}
                disabled={!!initialType}
                className={`w-full pl-10 pr-10 py-3 bg-gray-100 border-0 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-purple-500 
                  transition-all duration-200 text-gray-700 text-left
                  hover:bg-gray-200
                  ${initialType ? 'bg-gray-200 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {watch('type') ? (
                  <span className="capitalize">{watch('type').replace('-', ' ')}</span>
                ) : (
                  <span className="text-gray-500">Select type</span>
                )}
              </button>
              <Icon 
                icon="solar:alt-arrow-down-bold-duotone" 
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
              />
            </div>
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

        </div>

        {/* Date and Time Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <PremiumDatePickerModal
              value={watch('date')}
              onChange={(date) => setValue('date', date)}
              error={errors.date?.message}
              min={new Date()}
            />
          </div>
        </div>

        {/* Time Range Selection */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Selection
          </label>
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
      </motion.div>

      {/* Notes Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
      >
        <motion.div 
          className="flex items-center gap-3 mb-6 -ml-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="p-2 bg-green-100 rounded-lg">
            <Icon icon="solar:notes-bold-duotone" className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Additional Notes</h3>
            <p className="text-sm text-gray-500">Add any special instructions or concerns</p>
          </div>
        </motion.div>

        {/* Notes */}
        <div>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Add any special instructions or notes..."
            className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-cyan-500 
              transition-all duration-200 text-gray-700 resize-none
              hover:bg-gray-200"
          />
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div 
        className="flex justify-end gap-3 pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          type="button"
          onClick={() => {
            if (onCancel) {
              onCancel();
            } else {
              onSuccess();
            }
          }}
          className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg 
            hover:bg-gray-50 transition-all duration-200 font-medium flex items-center gap-2"
        >
          Cancel
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg 
            hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 font-medium 
            flex items-center gap-2 disabled:opacity-50 
            disabled:cursor-not-allowed shadow-lg"
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
      </motion.div>
      </form>

      {/* Appointment Type Modal - Outside form to prevent submission */}
      <AppointmentTypeModal
        isOpen={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        onSelect={(type) => {
          setValue('type', type);
          if (errors.type) {
            clearErrors('type');
          }
        }}
        selectedType={watch('type')}
      />
    </>
  );
};

export default PremiumAddAppointmentForm;