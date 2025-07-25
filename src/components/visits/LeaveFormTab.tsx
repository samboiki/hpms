import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import { PremiumInput, PremiumTextarea } from '../ui/PremiumInput';

interface LeaveFormData {
  from_date: string;
  to_date: string;
  diagnosis: string;
  diagnosis_code?: string;
  restrictions?: string;
  notes?: string;
}

interface LeaveFormTabProps {
  visitId: string;
  patientId: string;
  practiceId: string;
  doctorId?: string;
}

const LeaveFormTab: React.FC<LeaveFormTabProps> = ({ visitId, patientId, practiceId, doctorId }) => {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  interface LeaveForm {
    id: string;
    form_number: string;
    status: string;
    issue_date?: string;
    from_date: string;
    to_date: string;
    diagnosis?: string;
    diagnosis_code?: string;
    restrictions?: string;
    notes?: string;
  }
  
  const [leaveForm, setLeaveForm] = useState<LeaveForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty }
  } = useForm<LeaveFormData>({
    defaultValues: {
      from_date: format(new Date(), 'yyyy-MM-dd'),
      to_date: format(new Date(), 'yyyy-MM-dd')
    }
  });

  const fromDate = watch('from_date');
  const toDate = watch('to_date');

  const daysOff = fromDate && toDate 
    ? differenceInDays(new Date(toDate), new Date(fromDate)) + 1 
    : 0;

  // Load existing leave form if any
  useEffect(() => {
    loadLeaveForm();
  }, [visitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeaveForm = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('leave_forms')
        .select('*')
        .eq('visit_id', visitId)
        .maybeSingle();

      if (data) {
        setLeaveForm(data);
        reset({
          from_date: format(new Date(data.from_date), 'yyyy-MM-dd'),
          to_date: format(new Date(data.to_date), 'yyyy-MM-dd'),
          diagnosis: data.diagnosis || '',
          diagnosis_code: data.diagnosis_code || '',
          restrictions: data.restrictions || '',
          notes: data.notes || ''
        });
      }
    } catch (err) {
      console.error('Error loading leave form:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: LeaveFormData) => {
    try {
      setIsSaving(true);

      const leaveFormData = {
        visit_id: visitId,
        patient_id: patientId,
        doctor_id: doctorId || user?.id,
        practice_id: practiceId,
        from_date: data.from_date,
        to_date: data.to_date,
        diagnosis: data.diagnosis,
        diagnosis_code: data.diagnosis_code || null,
        restrictions: data.restrictions || null,
        notes: data.notes || null,
        status: 'draft',
        updated_by: user?.id
      };

      if (leaveForm) {
        // Update existing
        const { error } = await supabase
          .from('leave_forms')
          .update(leaveFormData)
          .eq('id', leaveForm.id);

        if (error) throw error;
        toast.success('Leave form updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('leave_forms')
          .insert([{
            ...leaveFormData,
            created_by: user?.id
          }]);

        if (error) throw error;
        toast.success('Leave form created successfully');
      }

      loadLeaveForm(); // Reload to get latest data
    } catch (error) {
      console.error('Error saving leave form:', error);
      toast.error('Failed to save leave form');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIssueLeaveForm = async () => {
    if (!leaveForm) {
      toast.error('Please save the leave form first');
      return;
    }

    try {
      const { error } = await supabase
        .from('leave_forms')
        .update({ 
          status: 'issued',
          issue_date: new Date().toISOString()
        })
        .eq('id', leaveForm.id);

      if (error) throw error;
      toast.success('Leave form issued successfully');
      loadLeaveForm();
    } catch (error) {
      console.error('Error issuing leave form:', error);
      toast.error('Failed to issue leave form');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="solar:spinner-bold-duotone" className="w-8 h-8 animate-spin text-[#01b9d4]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with Status */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-[#01b9d4] rounded-full"></div>
          <h3 className="text-lg font-semibold text-gray-800">Medical Leave Certificate</h3>
          {leaveForm && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              leaveForm.status === 'issued' 
                ? 'bg-green-100 text-green-700'
                : leaveForm.status === 'sent'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {leaveForm.status.charAt(0).toUpperCase() + leaveForm.status.slice(1)}
            </span>
          )}
        </div>
        {leaveForm && leaveForm.form_number && (
          <div className="text-sm text-gray-600">
            Form #: <span className="font-medium">{leaveForm.form_number}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Leave Period Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-blue-500" />
            Leave Period
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <PremiumInput
                type="date"
                {...register('from_date', { required: 'From date is required' })}
                icon="solar:calendar-bold-duotone"
                iconColor="text-blue-500"
              />
              {errors.from_date && (
                <p className="text-red-500 text-xs mt-1">{errors.from_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <PremiumInput
                type="date"
                {...register('to_date', {
                  required: 'To date is required',
                  validate: value => 
                    new Date(value) >= new Date(fromDate) || 'To date must be after from date'
                })}
                icon="solar:calendar-bold-duotone"
                iconColor="text-blue-500"
              />
              {errors.to_date && (
                <p className="text-red-500 text-xs mt-1">{errors.to_date.message}</p>
              )}
            </div>
            <div className="flex items-end">
              <div className="w-full p-3 bg-gray-100 rounded-lg text-center">
                <p className="text-sm text-gray-600">Total Days</p>
                <p className="text-2xl font-bold text-gray-700">{daysOff}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Medical Details Section */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Icon icon="solar:health-bold-duotone" className="w-5 h-5 text-purple-500" />
            Medical Details
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
                <PremiumInput
                  type="text"
                  {...register('diagnosis', { required: 'Diagnosis is required' })}
                  placeholder="e.g., Acute Upper Respiratory Infection"
                  icon="solar:health-bold-duotone"
                  iconColor="text-purple-500"
                />
                {errors.diagnosis && (
                  <p className="text-red-500 text-xs mt-1">{errors.diagnosis.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ICD-10 Code</label>
                <PremiumInput
                  type="text"
                  {...register('diagnosis_code')}
                  placeholder="e.g., J06.9"
                  icon="solar:code-bold-duotone"
                  iconColor="text-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions/Restrictions</label>
              <PremiumTextarea
                {...register('restrictions')}
                rows={3}
                placeholder="Specify any special instructions or notes for the certificate..."
                icon="solar:shield-warning-bold-duotone"
                iconColor="text-yellow-500"
              />
            </div>
          </div>
        </div>


        {/* Additional Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
          <PremiumTextarea
            {...register('notes')}
            rows={4}
            placeholder="Any additional information or special instructions..."
            icon="solar:notes-bold-duotone"
            iconColor="text-gray-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                isDirty
                  ? 'bg-[#01b9d4] text-white hover:bg-[#00a5be] shadow-lg hover:shadow-xl'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Icon icon="solar:diskette-bold-duotone" className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Leave Form'}
            </button>

            {leaveForm && leaveForm.status === 'draft' && (
              <button
                type="button"
                onClick={handleIssueLeaveForm}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Icon icon="solar:document-add-bold-duotone" className="w-5 h-5" />
                Issue Certificate
              </button>
            )}
          </div>

          {leaveForm && leaveForm.status === 'issued' && (
            <div className="flex gap-3">
              <button
                type="button"
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Icon icon="solar:letter-bold-duotone" className="w-5 h-5" />
                Send via Email
              </button>
              <button
                type="button"
                className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Icon icon="solar:printer-bold-duotone" className="w-5 h-5" />
                Print
              </button>
            </div>
          )}
        </div>
      </form>
    </motion.div>
  );
};

export default LeaveFormTab;