import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';

interface LeaveTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingLeaveType?: any;
}

const COLORS = [
  { value: '#10B981', label: 'Green' },
  { value: '#EF4444', label: 'Red' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#6B7280', label: 'Gray' }
];

export default function LeaveTypeModal({ isOpen, onClose, onSuccess, existingLeaveType }: LeaveTypeModalProps) {
  const [name, setName] = useState(existingLeaveType?.name || '');
  const [code, setCode] = useState(existingLeaveType?.code || '');
  const [daysPerYear, setDaysPerYear] = useState(existingLeaveType?.days_per_year?.toString() || '');
  const [isPaid, setIsPaid] = useState(existingLeaveType?.is_paid ?? true);
  const [carryoverAllowed, setCarryoverAllowed] = useState(existingLeaveType?.carryover_allowed || false);
  const [maxCarryoverDays, setMaxCarryoverDays] = useState(existingLeaveType?.max_carryover_days?.toString() || '0');
  const [requiresApproval, setRequiresApproval] = useState(existingLeaveType?.requires_approval ?? true);
  const [minNoticeDays, setMinNoticeDays] = useState(existingLeaveType?.min_notice_days?.toString() || '1');
  const [documentsRequired, setDocumentsRequired] = useState(existingLeaveType?.supporting_documents_required || false);
  const [description, setDescription] = useState(existingLeaveType?.description || '');
  const [color, setColor] = useState(existingLeaveType?.color || '#10B981');
  const [loading, setLoading] = useState(false);

  // Update form state when existingLeaveType changes
  useEffect(() => {
    if (existingLeaveType) {
      setName(existingLeaveType.name || '');
      setCode(existingLeaveType.code || '');
      setDaysPerYear(existingLeaveType.days_per_year?.toString() || '');
      setIsPaid(existingLeaveType.is_paid ?? true);
      setCarryoverAllowed(existingLeaveType.carryover_allowed || false);
      setMaxCarryoverDays(existingLeaveType.max_carryover_days?.toString() || '0');
      setRequiresApproval(existingLeaveType.requires_approval ?? true);
      setMinNoticeDays(existingLeaveType.min_notice_days?.toString() || '1');
      setDocumentsRequired(existingLeaveType.supporting_documents_required || false);
      setDescription(existingLeaveType.description || '');
      setColor(existingLeaveType.color || '#10B981');
    } else {
      // Reset form for new leave type
      setName('');
      setCode('');
      setDaysPerYear('');
      setIsPaid(true);
      setCarryoverAllowed(false);
      setMaxCarryoverDays('0');
      setRequiresApproval(true);
      setMinNoticeDays('1');
      setDocumentsRequired(false);
      setDescription('');
      setColor('#10B981');
    }
  }, [existingLeaveType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !code || !daysPerYear) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('No authenticated user');

      // Get user's practice_id
      const { data: currentUser } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user.user.id)
        .single();

      if (!currentUser?.practice_id) throw new Error('No practice found');

      const leaveTypeData = {
        practice_id: currentUser.practice_id,
        name,
        code: code.toUpperCase(),
        days_per_year: parseFloat(daysPerYear),
        is_paid: isPaid,
        carryover_allowed: carryoverAllowed,
        max_carryover_days: carryoverAllowed ? parseFloat(maxCarryoverDays) : 0,
        requires_approval: requiresApproval,
        min_notice_days: parseInt(minNoticeDays),
        supporting_documents_required: documentsRequired,
        description,
        color,
        is_active: true
      };

      if (existingLeaveType) {
        console.log('Updating leave type:', existingLeaveType.id);
        console.log('Update data:', leaveTypeData);
        
        const { data: updateResult, error } = await supabase
          .from('leave_types')
          .update({
            ...leaveTypeData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLeaveType.id)
          .select();

        console.log('Update result:', updateResult);
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        toast.success('Leave type updated successfully');
      } else {
        const { error } = await supabase
          .from('leave_types')
          .insert(leaveTypeData);

        if (error) throw error;

        // Initialize leave balances for all active users
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('practice_id', currentUser.practice_id)
          .eq('is_active', true);

        if (users && users.length > 0) {
          const { data: newLeaveType } = await supabase
            .from('leave_types')
            .select('id')
            .eq('practice_id', currentUser.practice_id)
            .eq('code', code.toUpperCase())
            .single();

          if (newLeaveType) {
            const balances = users.map(user => ({
              user_id: user.id,
              leave_type_id: newLeaveType.id,
              year: new Date().getFullYear(),
              entitled_days: parseFloat(daysPerYear),
              used_days: 0,
              carried_over_days: 0
            }));

            await supabase.from('leave_balances').insert(balances);
          }
        }

        toast.success('Leave type created successfully');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving leave type:', error);
      toast.error(error.message || 'Failed to save leave type');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600 opacity-20 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Icon icon="solar:calendar-add-bold-duotone" className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{fontFamily: 'Poppins, sans-serif'}}>
                  {existingLeaveType ? 'Edit' : 'Add'} Leave Type
                </h2>
                <p className="text-purple-100 text-sm">Configure leave type settings and policies</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-colors"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-white">

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 -ml-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  <p className="text-sm text-gray-500">Set the basic details for this leave type</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon icon="solar:calendar-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                      placeholder="e.g., Annual Leave"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon icon="solar:code-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                      placeholder="e.g., ANNUAL"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Leave Allocation Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 -ml-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Leave Allocation</h3>
                  <p className="text-sm text-gray-500">Configure annual allocation and appearance</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days per Year <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Icon icon="solar:calendar-days-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <input
                      type="number"
                      value={daysPerYear}
                      onChange={(e) => setDaysPerYear(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                      placeholder="e.g., 21"
                      required
                      min="0"
                      step="0.5"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calendar Color
                  </label>
                  <div className="relative">
                    <Icon icon="solar:palette-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                    >
                      {COLORS.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 h-4 rounded-lg shadow-sm" style={{ backgroundColor: color }}></div>
                </div>
              </div>
            </div>

            {/* Policy Settings Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 -ml-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Policy Settings</h3>
                  <p className="text-sm text-gray-500">Configure leave policies and requirements</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon icon="solar:dollar-bold-duotone" className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-gray-700">Paid Leave</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={(e) => setIsPaid(e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon icon="solar:user-check-bold-duotone" className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Requires Approval</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={requiresApproval}
                      onChange={(e) => setRequiresApproval(e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                    />
                  </label>
                </div>
                
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon icon="solar:document-add-bold-duotone" className="w-5 h-5 text-orange-600" />
                      <span className="text-sm font-medium text-gray-700">Supporting Documents Required</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={documentsRequired}
                      onChange={(e) => setDocumentsRequired(e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon icon="solar:calendar-search-bold-duotone" className="w-5 h-5 text-indigo-600" />
                      <span className="text-sm font-medium text-gray-700">Allow Carryover to Next Year</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={carryoverAllowed}
                      onChange={(e) => setCarryoverAllowed(e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Configuration Details Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 -ml-2">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Icon icon="solar:settings-bold-duotone" className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Configuration Details</h3>
                  <p className="text-sm text-gray-500">Set specific requirements and limits</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {carryoverAllowed && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Carryover Days
                    </label>
                    <div className="relative">
                      <Icon icon="solar:calendar-add-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                      <input
                        type="number"
                        value={maxCarryoverDays}
                        onChange={(e) => setMaxCarryoverDays(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                        min="0"
                        step="0.5"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

                {requiresApproval && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Notice Days
                    </label>
                    <div className="relative">
                      <Icon icon="solar:clock-circle-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                      <input
                        type="number"
                        value={minNoticeDays}
                        onChange={(e) => setMinNoticeDays(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                        min="0"
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}

                <div className={carryoverAllowed && requiresApproval ? "md:col-span-2" : carryoverAllowed || requiresApproval ? "md:col-span-1" : "md:col-span-2"}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <div className="relative">
                    <Icon icon="solar:text-field-bold-duotone" className="absolute left-3 top-3 w-5 h-5 text-gray-400 z-10" />
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200 resize-none"
                      rows={3}
                      placeholder="Additional details about this leave type..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5" />
                    {existingLeaveType ? 'Update' : 'Create'} Leave Type
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}