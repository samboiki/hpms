import React, { useState } from 'react';
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
        const { error } = await supabase
          .from('leave_types')
          .update(leaveTypeData)
          .eq('id', existingLeaveType.id);

        if (error) throw error;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {existingLeaveType ? 'Edit' : 'Add'} Leave Type
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Leave Type Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Annual Leave"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., ANNUAL"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Days per Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={daysPerYear}
                onChange={(e) => setDaysPerYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., 21"
                required
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Calendar Color
              </label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {COLORS.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="mt-1 h-4 rounded" style={{ backgroundColor: color }}></div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Paid Leave</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Requires Approval</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={documentsRequired}
                onChange={(e) => setDocumentsRequired(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Supporting Documents Required</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={carryoverAllowed}
                onChange={(e) => setCarryoverAllowed(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Allow Carryover to Next Year</span>
            </label>
          </div>

          {carryoverAllowed && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Carryover Days
              </label>
              <input
                type="number"
                value={maxCarryoverDays}
                onChange={(e) => setMaxCarryoverDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                min="0"
                step="0.5"
              />
            </div>
          )}

          {requiresApproval && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Notice Days
              </label>
              <input
                type="number"
                value={minNoticeDays}
                onChange={(e) => setMinNoticeDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                min="0"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={3}
              placeholder="Additional details about this leave type..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5" />
              {loading ? 'Saving...' : existingLeaveType ? 'Update' : 'Create'} Leave Type
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}