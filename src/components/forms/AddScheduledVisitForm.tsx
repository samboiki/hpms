import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar, Clock, User, Phone, MapPin, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useVisitsStore } from '../../stores/visitsStore';
import { format } from 'date-fns';
import ModernDateTimePicker from '../ui/ModernDateTimePicker';

interface AddScheduledVisitFormData {
  patient_id: string;
  doctor_id: string;
  scheduled_date: Date;
  scheduled_time: string;
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  chief_complaint: string;
  notes?: string;
  auto_confirm: boolean;
}

interface AddScheduledVisitFormProps {
  practiceId: string;
  onSuccess: () => void;
  onCancel: () => void;
  preselectedPatientId?: string;
  preselectedDoctorId?: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  cell_number?: string;
  email?: string;
}

interface Doctor {
  id: string;
  full_name: string;
  role: string;
}

export default function AddScheduledVisitForm({
  practiceId,
  onSuccess,
  onCancel,
  preselectedPatientId,
  preselectedDoctorId
}: AddScheduledVisitFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AddScheduledVisitFormData>({
    defaultValues: {
      scheduled_date: (() => {
        const now = new Date();
        now.setHours(9, 0, 0, 0); // Set to 9:00 AM
        return now;
      })(),
      scheduled_time: '09:00',
      visit_type: 'consultation',
      auto_confirm: true
    }
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const { addVisit } = useVisitsStore();

  const watchedPatientId = watch('patient_id');
  const watchedDate = watch('scheduled_date');
  const watchedTime = watch('scheduled_time');
  const watchedAutoConfirm = watch('auto_confirm');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (preselectedPatientId) {
      setValue('patient_id', preselectedPatientId);
    }
    if (preselectedDoctorId) {
      setValue('doctor_id', preselectedDoctorId);
    }
  }, [preselectedPatientId, preselectedDoctorId, setValue]);

  useEffect(() => {
    if (watchedPatientId) {
      const patient = patients.find(p => p.id === watchedPatientId);
      setSelectedPatient(patient || null);
    }
  }, [watchedPatientId, patients]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      // Fetch patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('id, first_name, last_name, cell_number, email')
        .order('first_name')
        .limit(100);

      if (patientsError) throw patientsError;

      // Fetch doctors
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('users')
        .select('id, full_name, role')
        .in('role', ['doctor', 'admin'])
        .order('full_name');

      if (doctorsError) throw doctorsError;

      setPatients(patientsData || []);
      setDoctors(doctorsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const onSubmit = async (data: AddScheduledVisitFormData) => {
    try {
      setLoading(true);

      const visitData = {
        patient_id: data.patient_id,
        doctor_id: data.doctor_id || null,
        practice_id: practiceId,
        scheduled_date: format(data.scheduled_date, 'yyyy-MM-dd'),
        scheduled_time: data.scheduled_time,
        visit_date: format(data.scheduled_date, 'yyyy-MM-dd'),
        visit_time: data.scheduled_time,
        visit_type: data.visit_type,
        chief_complaint: data.chief_complaint,
        notes: data.notes || null,
        status: 'scheduled' as const,
        
        // Scheduling flags
        is_scheduled: true,
        is_confirmed: data.auto_confirm, // Auto-confirm if requested
        is_ready: false,
        is_checked_in: false,
        is_cancelled: false,
        
        // Additional fields
        visit_number: 1, // Will be calculated by the database trigger
        follow_up_required: false,
      };

      await addVisit(visitData);
      onSuccess();
    } catch (error) {
      console.error('Error creating scheduled visit:', error);
      alert('Failed to schedule visit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-cyan-600" />
          Schedule New Visit
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Create a new scheduled visit for a patient
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Patient Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            Patient *
          </label>
          <select
            {...register('patient_id', { required: 'Please select a patient' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="">Select a patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.first_name} {patient.last_name}
                {patient.cell_number && ` • ${patient.cell_number}`}
              </option>
            ))}
          </select>
          {errors.patient_id && (
            <p className="mt-1 text-sm text-red-600">{errors.patient_id.message}</p>
          )}
          
          {/* Patient Info Display */}
          {selectedPatient && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </span>
                </div>
                {selectedPatient.cell_number && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{selectedPatient.cell_number}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Doctor Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Doctor (Optional)
          </label>
          <select
            {...register('doctor_id')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="">Assign later</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.full_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Leave blank to assign doctor during confirmation
          </p>
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date *
            </label>
            <ModernDateTimePicker
              value={watchedDate}
              onChange={(date) => {
                setValue('scheduled_date', date);
                setValue('scheduled_time', format(date, 'HH:mm'));
              }}
              showTime={true}
            />
            {errors.scheduled_date && (
              <p className="mt-1 text-sm text-red-600">{errors.scheduled_date.message}</p>
            )}
          </div>
        </div>

        {/* Visit Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Visit Type *
          </label>
          <select
            {...register('visit_type', { required: 'Please select a visit type' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="consultation">Consultation</option>
            <option value="follow-up">Follow-up</option>
            <option value="procedure">Procedure</option>
            <option value="emergency">Emergency</option>
          </select>
          {errors.visit_type && (
            <p className="mt-1 text-sm text-red-600">{errors.visit_type.message}</p>
          )}
        </div>

        {/* Chief Complaint */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="w-4 h-4 inline mr-1" />
            Chief Complaint *
          </label>
          <textarea
            {...register('chief_complaint', { required: 'Please describe the chief complaint' })}
            rows={3}
            placeholder="Describe the main reason for this visit..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          {errors.chief_complaint && (
            <p className="mt-1 text-sm text-red-600">{errors.chief_complaint.message}</p>
          )}
        </div>

        {/* Additional Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            {...register('notes')}
            rows={2}
            placeholder="Any additional information about this visit..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>

        {/* Auto-confirm option */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            {...register('auto_confirm')}
            id="auto_confirm"
            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
          />
          <label htmlFor="auto_confirm" className="text-sm text-gray-700 flex items-center gap-2">
            {watchedAutoConfirm ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-orange-500" />
            )}
            {watchedAutoConfirm ? 'Auto-confirm this visit' : 'Require manual confirmation'}
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Schedule Visit
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}