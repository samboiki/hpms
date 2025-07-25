import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import { PremiumInput, PremiumTextarea } from '../ui/PremiumInput';
import ModernDatePicker from '../ui/ModernDatePicker';

interface LeaveFormData {
  from_date: string;
  to_date: string;
  diagnosis: string;
  diagnosis_code?: string;
}

interface LeaveFormTabProps {
  visitId: string;
  patientId: string;
  practiceId: string;
  doctorId?: string;
}

interface LeaveForm {
  id: string;
  form_number: string;
  status: string;
  issue_date?: string;
  from_date: string;
  to_date: string;
  diagnosis?: string;
  diagnosis_code?: string;
  days_off?: number;
  created_at: string;
}

const LeaveFormTab: React.FC<LeaveFormTabProps> = ({ visitId, patientId, practiceId, doctorId }) => {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [leaveForms, setLeaveForms] = useState<LeaveForm[]>([]);
  const [editingForm, setEditingForm] = useState<LeaveForm | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
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

  // Load all leave forms for this visit
  useEffect(() => {
    loadLeaveForms();
  }, [visitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeaveForms = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('leave_forms')
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeaveForms(data || []);
    } catch (err) {
      console.error('Error loading leave forms:', err);
      toast.error('Failed to load leave forms');
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
        status: 'draft',
        updated_by: user?.id
      };

      if (editingForm) {
        // Update existing
        const { error } = await supabase
          .from('leave_forms')
          .update(leaveFormData)
          .eq('id', editingForm.id);

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

      // Reset form and reload
      setEditingForm(null);
      setIsFormOpen(false);
      reset({
        from_date: format(new Date(), 'yyyy-MM-dd'),
        to_date: format(new Date(), 'yyyy-MM-dd'),
        diagnosis: '',
        diagnosis_code: ''
      });
      loadLeaveForms();
    } catch (error) {
      console.error('Error saving leave form:', error);
      toast.error('Failed to save leave form');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (form: LeaveForm) => {
    setEditingForm(form);
    reset({
      from_date: format(new Date(form.from_date), 'yyyy-MM-dd'),
      to_date: format(new Date(form.to_date), 'yyyy-MM-dd'),
      diagnosis: form.diagnosis || '',
      diagnosis_code: form.diagnosis_code || ''
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this leave form?')) return;

    try {
      const { error } = await supabase
        .from('leave_forms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Leave form deleted successfully');
      loadLeaveForms();
    } catch (error) {
      console.error('Error deleting leave form:', error);
      toast.error('Failed to delete leave form');
    }
  };

  const handleIssueLeaveForm = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leave_forms')
        .update({ 
          status: 'issued',
          issue_date: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Leave form issued successfully');
      loadLeaveForms();
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Icon icon="solar:document-medicine-bold-duotone" className="w-6 h-6 text-[#01b9d4]" />
          <h3 className="text-lg font-semibold text-gray-800">Medical Leave Certificates</h3>
        </div>
        <button
          onClick={() => {
            setEditingForm(null);
            reset({
              from_date: format(new Date(), 'yyyy-MM-dd'),
              to_date: format(new Date(), 'yyyy-MM-dd'),
              diagnosis: '',
              diagnosis_code: ''
            });
            setIsFormOpen(!isFormOpen);
          }}
          className="px-4 py-2 bg-[#01b9d4] text-white rounded-lg font-medium hover:bg-[#00a5be] transition-all flex items-center gap-2"
        >
          <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
          Add Leave Form
        </button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Leave Period Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-blue-500" />
                Leave Period
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <ModernDatePicker
                    value={fromDate}
                    onChange={(date) => {
                      register('from_date').onChange({ target: { value: date } });
                    }}
                    label="From Date"
                    error={errors.from_date?.message}
                  />
                </div>
                <div>
                  <ModernDatePicker
                    value={toDate}
                    onChange={(date) => {
                      register('to_date').onChange({ target: { value: date } });
                    }}
                    label="To Date"
                    minDate={fromDate ? new Date(fromDate) : undefined}
                    error={errors.to_date?.message}
                  />
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
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Icon icon="solar:health-bold-duotone" className="w-5 h-5 text-purple-500" />
                Medical Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
                  <PremiumInput
                    type="text"
                    {...register('diagnosis')}
                    placeholder="e.g., Acute Upper Respiratory Infection"
                    icon="solar:health-bold-duotone"
                    iconColor="text-purple-500"
                  />
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
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#01b9d4] text-white rounded-lg font-medium hover:bg-[#00a5be] transition-all flex items-center gap-2"
              >
                <Icon icon="solar:diskette-bold-duotone" className="w-5 h-5" />
                {isSaving ? 'Saving...' : editingForm ? 'Update Leave Form' : 'Save Leave Form'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingForm(null);
                }}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Leave Forms Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Form #</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Period</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Days</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Diagnosis</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaveForms.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No leave forms created yet
                </td>
              </tr>
            ) : (
              leaveForms.map((form) => (
                <tr key={form.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {form.form_number || `LF-${form.id.substring(0, 8).toUpperCase()}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {format(new Date(form.from_date), 'dd/MM/yyyy')} - {format(new Date(form.to_date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{form.days_off || daysOff}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {form.diagnosis}
                    {form.diagnosis_code && (
                      <span className="ml-2 text-gray-500">({form.diagnosis_code})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      form.status === 'issued' 
                        ? 'bg-green-100 text-green-700'
                        : form.status === 'sent'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {form.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleEdit(form)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleIssueLeaveForm(form.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Issue Certificate"
                          >
                            <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(form.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default LeaveFormTab;