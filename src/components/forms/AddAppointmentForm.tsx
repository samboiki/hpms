import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { Search, Calendar, Clock, User, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface AddAppointmentFormData {
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
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
  onSuccess: () => void;
}

const AddAppointmentForm: React.FC<Props> = ({ onSuccess }) => {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<AddAppointmentFormData>({
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      duration: 30,
      type: 'consultation'
    }
  });
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  
  const selectedPatientId = watch('patient_id');
  const selectedDate = watch('date');
  const selectedTime = watch('time');
  const selectedDoctorId = watch('doctor_id');

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
        .select('id, first_name, last_name')
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
        .order('full_name', { ascending: true });

      if (error) throw error;
      setDoctors(data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
      setError('Failed to load doctors');
    }
  };

  const onSubmit = async (data: AddAppointmentFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check for conflicting appointments
      const { data: conflicts, error: conflictError } = await supabase
        .from('appointments')
        .select('id')
        .eq('date', data.date)
        .eq('doctor_id', data.doctor_id)
        .or(`time.gte.${data.time},time.lt.${addMinutesToTime(data.time, data.duration)}`);

      if (conflictError) throw conflictError;

      if (conflicts && conflicts.length > 0) {
        setError('This time slot conflicts with an existing appointment');
        return;
      }

      // Create the appointment
      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert([{
          patient_id: data.patient_id,
          doctor_id: data.doctor_id,
          date: data.date,
          time: data.time,
          duration: data.duration,
          type: data.type,
          status: 'scheduled',
          notes: data.notes
        }]);

      if (appointmentError) throw appointmentError;

      onSuccess();
    } catch (err) {
      console.error('Error creating appointment:', err);
      setError('Failed to create appointment');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to add minutes to a time string (HH:MM)
  const addMinutesToTime = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins);
    date.setMinutes(date.getMinutes() + minutes);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const handlePatientSelect = (patient: Patient) => {
    setValue('patient_id', patient.id);
    setPatientSearchTerm(`${patient.first_name} ${patient.last_name}`);
    setShowPatientDropdown(false);
  };

  const getSelectedPatientName = () => {
    if (!selectedPatientId) return '';
    const patient = patients.find(p => p.id === selectedPatientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : '';
  };

  const getSelectedDoctorName = () => {
    if (!selectedDoctorId) return '';
    const doctor = doctors.find(d => d.id === selectedDoctorId);
    return doctor ? doctor.full_name : '';
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Patient Selection */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
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
              className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
            />
            <input
              type="hidden"
              {...register('patient_id', { required: 'Patient is required' })}
            />
            {showPatientDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-1 text-base overflow-auto max-h-60">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="cursor-pointer hover:bg-gray-100 px-4 py-2"
                      onClick={() => handlePatientSelect(patient)}
                    >
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-3" />
                        <span>{patient.first_name} {patient.last_name}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500">
                    No patients found
                  </div>
                )}
              </div>
            )}
          </div>
          {errors.patient_id && (
            <p className="mt-1 text-sm text-red-600">{errors.patient_id.message}</p>
          )}
          {selectedPatientId && (
            <div className="mt-2 text-sm text-brand-primary">
              Selected: {getSelectedPatientName()}
            </div>
          )}
        </div>

        {/* Doctor Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <select
              {...register('doctor_id', { required: 'Doctor is required' })}
              className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
            />
          </div>
          {errors.date && (
            <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
          )}
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="time"
              {...register('time', { required: 'Time is required' })}
              className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
            />
          </div>
          {errors.time && (
            <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
          <select
            {...register('duration', { required: 'Duration is required' })}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
          {errors.duration && (
            <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            {...register('type', { required: 'Type is required' })}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
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

        {/* Notes */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-start pt-3 pointer-events-none">
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
            <textarea
              {...register('notes')}
              rows={3}
              className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
              placeholder="Add any relevant notes about the appointment..."
            />
          </div>
        </div>
      </div>

      {/* Appointment Summary */}
      {selectedPatientId && selectedDoctorId && selectedDate && selectedTime && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-6">
          <h3 className="font-medium text-gray-900 mb-2">Appointment Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Patient</p>
              <p className="font-medium">{getSelectedPatientName()}</p>
            </div>
            <div>
              <p className="text-gray-500">Doctor</p>
              <p className="font-medium">{getSelectedDoctorName()}</p>
            </div>
            <div>
              <p className="text-gray-500">Date & Time</p>
              <p className="font-medium">
                {format(new Date(selectedDate), 'MMMM d, yyyy')} at {selectedTime}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Duration</p>
              <p className="font-medium">{watch('duration')} minutes</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading}
          style={{ backgroundColor: '#01b9d4' }}
          className="text-white hover:bg-opacity-90"
        >
          {isLoading ? 'Scheduling...' : 'Schedule Appointment'}
        </Button>
      </div>
    </form>
  );
};

export default AddAppointmentForm;