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
import { toast } from 'react-hot-toast';
import FormModal from '../modals/FormModal';
import AddPatientForm, { type CreatedPatient } from './AddPatientForm';
import { errorMessage } from './formErrors';

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
  initialDuration?: number;
  initialNotes?: string;
  editingAppointmentId?: string;
}

const PremiumAddAppointmentForm: React.FC<Props> = ({ 
  onSuccess, 
  onCancel, 
  initialDate, 
  initialTime, 
  initialDoctorId, 
  initialPatientId, 
  initialType,
  initialDuration,
  initialNotes,
  editingAppointmentId
}) => {
  const { user } = useAuthStore();
  const [dataFetched, setDataFetched] = useState(false);
  
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
  
  const { register, handleSubmit, formState: { errors }, watch, setValue, reset, clearErrors } = useForm<AddAppointmentFormData>({
    defaultValues: {
      date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      time: initialTime || '09:00', // Will be updated when business hours load
      end_time: '',
      duration: initialDuration || 30,
      type: initialType || 'consultation',
      doctor_id: initialDoctorId || '',
      patient_id: initialPatientId || '',
      notes: initialNotes || ''
    }
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  // Remove this state - we'll use the memoized value directly
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [endTime, setEndTime] = useState<string>('');
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [businessHours, setBusinessHours] = useState<{ start: string; end: string }>({ start: '08:00', end: '18:00' });
  const [allBusinessHours, setAllBusinessHours] = useState<any>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  // Weekday name when the chosen date falls on a day the practice is closed
  const [closedDay, setClosedDay] = useState<string | null>(null);
  const walkInSelectedRef = useRef(false);
  
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
      // Only fetch from visits table
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select('scheduled_time, visit_time')
        .eq('doctor_id', doctorId)
        .eq('scheduled_date', date)
        .eq('is_cancelled', false);
      
      if (visitsError) throw visitsError;
      
      // Generate array of booked time slots
      const bookedSlots: string[] = [];
      
      // Process visits
      visits?.forEach(visit => {
        if (visit.scheduled_time) {
          const [hours, minutes] = visit.scheduled_time.split(':').map(Number);
          const startTime = new Date();
          startTime.setHours(hours, minutes, 0, 0);
          
          // Mark slots for 30 minute duration (default visit length)
          const duration = 30;
          for (let i = 0; i < duration; i += 15) {
            const slotTime = new Date(startTime.getTime() + (i * 60000));
            bookedSlots.push(format(slotTime, 'HH:mm'));
          }
        }
      });
      
      // Remove duplicates
      const uniqueBookedSlots = [...new Set(bookedSlots)];
      setBookedTimes(uniqueBookedSlots);
    } catch (err) {
      console.error('Error fetching booked times:', err);
      setBookedTimes([]);
      // With no booked times every slot looks free, so say that the list is incomplete
      toast.error(`Couldn't load the doctor's booked times, so taken slots aren't marked: ${errorMessage(err)}`);
    }
  };

  // Calculate end time whenever start time changes
  useEffect(() => {
    if (selectedTime && !endTime) {
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
  }, [selectedTime, setValue, endTime]);

  // Fetch all data in parallel on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Early return if no user or already fetched
        if (!user?.id) {
          console.log('Waiting for user authentication...');
          return;
        }
        
        if (dataFetched) {
          console.log('Data already fetched, skipping...');
          return;
        }

        // Get practice_id once
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('practice_id')
          .eq('id', user.id)
          .single();

        if (userError) {
          console.error('Error fetching user data:', userError);
          throw userError;
        }
        
        const practiceId = userData?.practice_id;
        if (!practiceId) {
          console.error('No practice_id found for user');
          toast.error("Your account isn't linked to a practice, so patients and doctors can't be loaded.");
          setIsLoadingPatients(false);
          setIsLoadingDoctors(false);
          return;
        }

        // Start loading states
        setIsLoadingPatients(true);
        setIsLoadingDoctors(true);

        // Fetch all data in parallel
        const [patientsResult, doctorsResult, practiceResult] = await Promise.all([
          // Fetch patients
          supabase
            .from('patients')
            .select('id, first_name, last_name')
            .eq('practice_id', practiceId)
            .order('last_name', { ascending: true }),
          
          // Fetch doctors
          supabase
            .from('users')
            .select('id, full_name, role')
            .eq('role', 'doctor')
            .eq('practice_id', practiceId)
            // Deactivated doctors can't take new bookings
            .or('is_active.is.null,is_active.eq.true')
            .order('full_name', { ascending: true }),
          
          // Fetch practice for business hours
          supabase
            .from('practices')
            .select('business_hours')
            .eq('id', practiceId)
            .single()
        ]);

        // Process patients
        if (!patientsResult.error) {
          setPatients(patientsResult.data || []);
          console.log('Loaded patients:', patientsResult.data?.length);
        } else {
          console.error('Error loading patients:', patientsResult.error);
          // Otherwise the search says "No patients found" and invites registering a duplicate
          toast.error(`Couldn't load the patient list: ${errorMessage(patientsResult.error)}`);
        }
        setIsLoadingPatients(false);

        // Process doctors
        if (!doctorsResult.error) {
          setDoctors(doctorsResult.data || []);
          console.log('Loaded doctors:', doctorsResult.data?.length);
        } else {
          console.error('Error loading doctors:', doctorsResult.error);
          toast.error(`Couldn't load the list of doctors: ${errorMessage(doctorsResult.error)}`);
        }
        setIsLoadingDoctors(false);

        // Process business hours
        if (!practiceResult.error && practiceResult.data?.business_hours) {
          const hours = practiceResult.data.business_hours;
          setAllBusinessHours(hours);
          
          // Set initial business hours
          const today = new Date();
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const currentDay = dayNames[today.getDay()];
          
          let dayHours = hours[currentDay];
          if (!dayHours || dayHours.closed) {
            dayHours = hours.monday || Object.values(hours).find((h: any) => h && !h.closed && h.open && h.close);
          }
          
          if (dayHours && dayHours.open && dayHours.close) {
            setBusinessHours({
              start: dayHours.open,
              end: dayHours.close
            });
          }
        }
        
        // Mark data as fetched
        setDataFetched(true);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast.error(`Couldn't load the appointment form: ${errorMessage(error)}`);
        setIsLoadingPatients(false);
        setIsLoadingDoctors(false);
      }
    };

    fetchAllData();
  }, [user, dataFetched]);

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
        setClosedDay(null);
        setBusinessHours({
          start: dayHours.open,
          end: dayHours.close
        });
      } else {
        // If selected day is closed, show a message or use default hours
        console.log(`Practice is closed on ${dayName}`);
        setClosedDay(dayName);
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

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(patientSearchTerm);
    }, 100); // Fast debounce for responsive feel
    
    return () => clearTimeout(timer);
  }, [patientSearchTerm]);

  // Optimized patient filtering with memoization
  const filteredPatients = useMemo(() => {
    if (!debouncedSearchTerm || selectedPatientId) {
      return patients.slice(0, 10); // Show limited results initially
    }
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    const searchTerms = searchLower.split(' ').filter(Boolean);
    
    return patients
      .filter(patient => {
        const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
        // Check if all search terms match
        return searchTerms.every(term => fullName.includes(term));
      })
      .slice(0, 20); // Limit results for performance
  }, [debouncedSearchTerm, patients, selectedPatientId]);

  // Remove individual fetch functions - they're now handled in the parallel fetch

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

      // New appointments booked for today cannot start earlier than now
      const now = new Date();
      if (!editingAppointmentId && data.date === format(now, 'yyyy-MM-dd') && data.time < format(now, 'HH:mm')) {
        setError('The selected start time has already passed. Please choose a later time.');
        return;
      }

      // Check for conflicting appointments (exclude current appointment if editing)
      const appointmentTime = setMinutes(setHours(new Date(data.date), startHours), startMinutes);
      const hasConflict = await checkAppointmentConflict(
        data.doctor_id,
        appointmentTime,
        durationMinutes,
        editingAppointmentId // Pass the current appointment ID to exclude it from conflict check
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

      if (editingAppointmentId) {
        // Update existing visit
        const { data: updatedVisit, error: updateError } = await supabase
          .from('visits')
          .update({
            patient_id: data.patient_id,
            doctor_id: data.doctor_id,
            visit_date: data.date,
            visit_time: data.time,
            scheduled_date: data.date,
            scheduled_time: data.time,
            visit_type: data.type,
            chief_complaint: data.notes || '',
            notes: `Appointment scheduled for ${format(new Date(data.date), 'dd MMM yyyy')} at ${data.time} - ${data.end_time}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAppointmentId)
          .select(`
            *,
            doctor:users!doctor_id(id, full_name),
            patient:patients!visits_patient_id_fkey(id, first_name, last_name)
          `)
          .single();

        if (updateError) throw updateError;

        console.log('✅ Updated visit:', updatedVisit);
        toast.success(`Appointment moved to ${format(new Date(data.date), 'dd MMM yyyy')} at ${data.time}`);
        onSuccess(updatedVisit);
      } else {
        // A booking without a practice is invisible on the practice's calendar
        if (!practiceId) {
          setError("Your account isn't linked to a practice, so the appointment can't be booked. Ask an administrator to link your account.");
          return;
        }
        // Create a new scheduled visit
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
            notes: `Appointment scheduled for ${format(new Date(data.date), 'dd MMM yyyy')} at ${data.time} - ${data.end_time}`,
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
        toast.success(`Appointment booked for ${format(new Date(data.date), 'dd MMM yyyy')} at ${data.time}`);
        onSuccess(newVisit);
      }
    } catch (err) {
      console.error('Error saving appointment:', err);
      setError(`${editingAppointmentId ? 'Failed to update appointment' : 'Failed to create appointment'}: ${errorMessage(err)}`);
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

  // Walk-in: the registration form handed back the new patient, so select them straight away
  const handleWalkInCreated = useCallback((patient: CreatedPatient) => {
    walkInSelectedRef.current = true;
    setPatients(prev => (prev.some(p => p.id === patient.id) ? prev : [...prev, patient]));
    handlePatientSelect(patient);
  }, [handlePatientSelect]);

  const reloadPatients = async () => {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('practice_id')
      .eq('id', user?.id)
      .single();
    if (userError || !userData?.practice_id) {
      console.error('Error loading practice for patient reload:', userError);
      toast.error("Couldn't refresh the patient list. Close and reopen the form to find the new patient.");
      return;
    }

    const { data, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .eq('practice_id', userData.practice_id)
      .order('last_name', { ascending: true });
    if (patientsError) {
      console.error('Error reloading patients:', patientsError);
      toast.error(`Couldn't refresh the patient list: ${errorMessage(patientsError)}`);
      return;
    }
    setPatients(data || []);
  };

  const handleWalkInRegistered = async () => {
    setIsAddPatientOpen(false);
    if (walkInSelectedRef.current) {
      walkInSelectedRef.current = false;
      toast.success('Patient registered and selected');
      return;
    }
    // The registration form did not hand back the new patient: reload the list so they can be picked
    await reloadPatients();
    setShowPatientDropdown(true);
    toast.success('Patient registered. Select them from the list.');
  };

  const handleCancelAppointment = async () => {
    if (!editingAppointmentId) return;
    const patientName = patientSearchTerm.trim() || 'this patient';
    if (!window.confirm(`Cancel the appointment for ${patientName}? It will be marked as cancelled.`)) return;

    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'cancelled',
          is_cancelled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingAppointmentId);

      if (error) throw error;
      
      console.log('✅ Appointment cancelled');
      toast.success('Appointment cancelled successfully');
      onSuccess(); // Close the modal after cancelling
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setError('Failed to cancel appointment');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading only when actively fetching, not on initial mount
  const isInitialLoading = isLoadingPatients || isLoadingDoctors;
  
  // Don't render form until user is loaded
  if (!user?.id) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Icon icon="solar:refresh-circle-bold-duotone" className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading appointment form...</p>
        </div>
      </div>
    );
  }

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
                  aria-label="Clear the selected patient"
                  title="Clear the selected patient"
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
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setShowPatientDropdown(false);
                          setIsAddPatientOpen(true);
                        }}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg
                          hover:from-purple-600 hover:to-indigo-700 text-sm font-medium shadow-md"
                      >
                        <Icon icon="solar:user-plus-bold-duotone" className="w-4 h-4" aria-hidden="true" />
                        Add new patient
                      </motion.button>
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
                  // The onChange goes through register: a separate onChange prop replaced react-hook-form's
                  // own handler, so the form never saw the chosen doctor and every booking failed with
                  // "Doctor is required" in practices with more than one doctor.
                  {...register('doctor_id', {
                    required: 'Doctor is required',
                    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                      const doctor = doctors.find(d => d.id === e.target.value);
                      if (doctor) setSelectedDoctor(doctor);
                    }
                  })}
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
          ) : selectedDoctor ? (
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
          ) : (
            // Without a doctor the booking fails with a database error, so say what is missing
            dataFetched && !isLoadingDoctors && doctors.length === 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Doctor</label>
                <p className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  No doctors could be found for your practice, so appointments can't be booked. An administrator can add a doctor under Settings &gt; Users.
                </p>
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
            {closedDay && (
              <p className="mt-2 text-sm text-amber-700 flex items-center gap-1">
                <Icon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                The practice is closed on {closedDay.charAt(0).toUpperCase() + closedDay.slice(1)}s. Choose another date unless the doctor is working that day.
              </p>
            )}
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
            date={selectedDate}
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

      {/* Action Buttons: stay in view at the bottom of the scrolling modal and wrap on a phone */}
      <motion.div
        className="sticky bottom-0 z-10 flex flex-wrap justify-between items-center gap-3 py-3 bg-white border-t border-gray-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        {/* Cancel Appointment button - only show when editing */}
        <div>
          {editingAppointmentId && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              type="button"
              onClick={handleCancelAppointment}
              disabled={isLoading}
              className="px-4 sm:px-6 py-2.5bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg 
                hover:from-red-600 hover:to-red-700 transition-all duration-200 font-medium 
                flex items-center gap-2 disabled:opacity-50 
                disabled:cursor-not-allowed shadow-lg"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
              Cancel Appointment
            </motion.button>
          )}
        </div>

        {/* Right side buttons */}
        <div className="flex flex-wrap justify-end gap-3 ml-auto">
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
            className="px-4 sm:px-6 py-2.5text-gray-700 bg-white border border-gray-300 rounded-lg 
              hover:bg-gray-50 transition-all duration-200 font-medium flex items-center gap-2"
          >
            Close
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            type="submit"
            disabled={isLoading}
            className="px-4 sm:px-6 py-2.5bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg 
              hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 font-medium 
              flex items-center gap-2 disabled:opacity-50 
              disabled:cursor-not-allowed shadow-lg"
          >
          {isLoading ? (
            <>
              <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 animate-spin" />
              {editingAppointmentId ? 'Updating...' : 'Scheduling...'}
            </>
          ) : (
            <>
              <Icon icon={editingAppointmentId ? "solar:pen-bold-duotone" : "solar:calendar-add-bold-duotone"} className="w-5 h-5" />
              {editingAppointmentId ? 'Update Appointment' : 'Schedule Appointment'}
            </>
          )}
        </motion.button>
        </div>
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

      {/* Walk-in registration - outside the form so its submit doesn't bubble into this one */}
      <FormModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        title="Register New Patient"
        icon="solar:user-plus-bold-duotone"
      >
        <AddPatientForm
          onCreated={handleWalkInCreated}
          onSuccess={handleWalkInRegistered}
        />
      </FormModal>
    </>
  );
};

export default PremiumAddAppointmentForm;