import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
// Removed unused imports
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { PayrollTooltips } from '../../ui/InfoTooltip';
import { ConfirmDialog } from './ConfirmDialog';
import { describeDbError, ensureRowsUpdated } from './staffUtils';

interface PayslipAdjustment {
  id: string;
  payslip_id?: string;
  user_id: string;
  type: 'benefit' | 'deduction' | 'bonus';
  component_id?: string;
  name: string;
  amount: number;
  reason?: string;
  month: number;
  year: number;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
  component?: {
    name: string;
    code?: string;
  };
}

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: number;
  year: number;
  userId?: string;
  practiceId?: string | null;
}

interface AdjustmentComponent {
  id: string;
  name: string;
  code?: string;
  value: number;
  type: string;
  base_calculation?: string | null;
}

const emptyAdjustmentForm = (userId?: string) => ({
  user_id: userId || '',
  type: 'deduction' as 'benefit' | 'deduction' | 'bonus',
  component_id: '',
  name: '',
  amount: '',
  reason: ''
});

const AdjustmentModal: React.FC<AdjustmentModalProps> = ({ isOpen, onClose, month, year, userId, practiceId }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(() => emptyAdjustmentForm(userId));

  // Fetch users if not specific user
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-adjustments', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!practiceId && !userId
  });

  // Fetch non-recurring components with full details
  const { data: availableComponents = [] } = useQuery<AdjustmentComponent[]>({
    queryKey: ['non-recurring-components', practiceId, formData.type],
    queryFn: async () => {
      const table = formData.type === 'benefit' ? 'benefits' :
                  formData.type === 'deduction' ? 'deductions' :
                  'bonus_configurations';

      // bonus_configurations has no `code` column; asking for it made the whole query fail
      const { data, error } = await supabase
        .from(table)
        .select(table === 'bonus_configurations'
          ? 'id, name, value, type, base_calculation'
          : 'id, name, code, value, type, base_calculation')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .eq('is_recurring', false)
        .order('name');

      if (error) throw error;
      return (data || []) as unknown as AdjustmentComponent[];
    },
    enabled: !!practiceId && isOpen
  });

  // Fetch user's basic salary if userId is provided for calculating percentage-based amounts
  const { data: employeeSalary } = useQuery({
    queryKey: ['employee-salary', formData.user_id || userId],
    queryFn: async () => {
      const targetUserId = formData.user_id || userId;
      if (!targetUserId) return null;
      
      // Salary history keeps old rows (is_active = false); only the current salary applies
      const { data, error } = await supabase
        .from('employee_salaries')
        .select('basic_salary')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!(formData.user_id || userId)
  });

  // Calculate amount based on component configuration
  const calculateComponentAmount = (component: {
    type: string;
    value: number;
    base_calculation?: string | null;
  }) => {
    if (!component) return '';
    
    // For fixed amounts, return the value directly
    if (component.type === 'fixed') {
      return component.value.toString();
    }
    
    // For percentage-based amounts, calculate based on basic salary
    if (component.type === 'percentage' && employeeSalary?.basic_salary) {
      const baseAmount = component.base_calculation === 'basic_salary' 
        ? employeeSalary.basic_salary 
        : 0;
      const calculatedAmount = (baseAmount * component.value) / 100;
      return calculatedAmount.toFixed(2);
    }
    
    return '';
  };

  // Handle component selection
  const handleComponentChange = (componentId: string) => {
    const selectedComponent = availableComponents.find(c => c.id === componentId);
    const calculatedAmount = selectedComponent ? calculateComponentAmount(selectedComponent) : '';
    
    setFormData({ 
      ...formData, 
      component_id: componentId,
      amount: calculatedAmount
    });
  };

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const selectedComponent = availableComponents.find(c => c.id === data.component_id);
      
      const { error } = await supabase
        .from('payslip_adjustments')
        .insert({
          user_id: data.user_id,
          type: data.type,
          component_id: data.component_id || null,
          name: data.name || selectedComponent?.name || '',
          amount: parseFloat(data.amount),
          reason: data.reason,
          month: month,
          year: year,
          is_approved: false,
          created_by: user?.id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslip-adjustments'] });
      toast.success('Adjustment added - approve it to include it in the payslip');
      setFormData(emptyAdjustmentForm(userId));
      onClose();
    },
    onError: (error) => {
      toast.error(describeDbError(error, 'Could not add the adjustment'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id) {
      toast.error('Please select an employee');
      return;
    }
    if (!formData.component_id && !formData.name.trim()) {
      toast.error('Please choose a component or enter a name');
      return;
    }
    const amount = parseFloat(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Please enter an amount greater than zero');
      return;
    }
    createAdjustmentMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Icon icon="solar:document-add-bold-duotone" className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Add Payslip Adjustment</h2>
                  <p className="text-white/80 text-sm">
                    For {format(new Date(year, month - 1), 'MMMM yyyy')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-colors"
              >
                <Icon icon={SolarIcons.closeCircle} className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {!userId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Select employee</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['benefit', 'deduction', 'bonus'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type, component_id: '' })}
                      className={`py-2 px-4 rounded-lg font-medium transition-all ${
                        formData.type === type
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Component
                </label>
                <select
                  value={formData.component_id}
                  onChange={(e) => handleComponentChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Custom (enter name below)</option>
                  {availableComponents.map((component) => (
                    <option key={component.id} value={component.id}>
                      {component.name} {component.code && `(${component.code})`}
                    </option>
                  ))}
                </select>
              </div>

              {!formData.component_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Overtime Pay, Equipment Damage"
                    required={!formData.component_id}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter amount"
                  required
                />
                {formData.component_id && (() => {
                  const selectedComponent = availableComponents.find(c => c.id === formData.component_id);
                  if (selectedComponent?.type === 'percentage') {
                    return (
                      <p className="text-sm text-gray-500 mt-1">
                        Auto-calculated: {selectedComponent.value}% of {selectedComponent.base_calculation || 'basic salary'}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason / Notes
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                  placeholder="Explain the reason for this adjustment..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                  disabled={createAdjustmentMutation.isPending}
                >
                  {createAdjustmentMutation.isPending ? (
                    <>
                      <Icon icon={SolarIcons.loader} className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 mr-2" />
                      Add Adjustment
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PayslipAdjustments: React.FC<{
  month: number;
  year: number;
  userId?: string;
  /** Practice resolved by the parent (falls back to the signed-in user's practice). */
  practiceId?: string | null;
}> = ({ month, year, userId, practiceId: practiceIdProp }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const practiceId = practiceIdProp || user?.practice_id;
  const [showAddModal, setShowAddModal] = useState(false);
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<PayslipAdjustment | null>(null);

  // Fetch adjustments for this practice's staff only
  const { data: adjustments = [], isLoading, isError, refetch } = useQuery<PayslipAdjustment[]>({
    queryKey: ['payslip-adjustments', practiceId, month, year, userId],
    queryFn: async () => {
      let query = supabase
        .from('payslip_adjustments')
        .select(`
          *,
          user:user_id!inner (
            full_name,
            email,
            practice_id
          )
        `)
        .eq('user.practice_id', practiceId)
        .eq('month', month)
        .eq('year', year)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as PayslipAdjustment[];
    },
    enabled: !!practiceId
  });

  const approveMutation = useMutation({
    mutationFn: async (adjustmentId: string) => {
      const { data, error } = await supabase
        .from('payslip_adjustments')
        .update({
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', adjustmentId)
        .select('id');

      if (error) throw error;
      ensureRowsUpdated(data, 'The adjustment');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslip-adjustments'] });
      toast.success('Adjustment approved');
    },
    onError: (error) => {
      toast.error(describeDbError(error, 'Could not approve the adjustment'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (adjustmentId: string) => {
      const { data, error } = await supabase
        .from('payslip_adjustments')
        .delete()
        .eq('id', adjustmentId)
        .select('id');

      if (error) throw error;
      ensureRowsUpdated(data, 'The adjustment');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslip-adjustments'] });
      toast.success('Adjustment deleted');
      setAdjustmentToDelete(null);
    },
    onError: (error) => {
      toast.error(describeDbError(error, 'Could not delete the adjustment'));
    }
  });

  const formatAmount = (amount: number, type: string) => {
    const prefix = type === 'deduction' ? '-' : '+';
    return `${prefix}NAD ${Math.abs(amount).toFixed(2)}`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'benefit':
        return 'text-green-600 bg-green-50';
      case 'deduction':
        return 'text-red-600 bg-red-50';
      case 'bonus':
        return 'text-yellow-600 bg-yellow-50';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">
            One-time Adjustments
          </h3>
          {PayrollTooltips.payslipAdjustments}
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
        >
          <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-1" />
          Add Adjustment
        </Button>
      </div>

      {isError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>Adjustments could not be loaded.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map(index => <div key={index} className="h-24 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : adjustments.length > 0 ? (
        <div className="space-y-3">
          {adjustments.map((adjustment) => (
            <motion.div
              key={adjustment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${
                adjustment.is_approved ? 'bg-gray-50 border-gray-200' : 'bg-white border-yellow-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium text-gray-900">{adjustment.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(adjustment.type)}`}>
                      {adjustment.type}
                    </span>
                    {adjustment.is_approved && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                        Approved
                      </span>
                    )}
                  </div>
                  {!userId && adjustment.user && (
                    <p className="text-sm text-gray-600 mb-1">
                      {adjustment.user.full_name} • {adjustment.user.email}
                    </p>
                  )}
                  {adjustment.reason && (
                    <p className="text-sm text-gray-600">{adjustment.reason}</p>
                  )}
                  <p className="text-lg font-semibold mt-2 text-gray-900">
                    {formatAmount(adjustment.amount, adjustment.type)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!adjustment.is_approved && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => approveMutation.mutate(adjustment.id)}
                      disabled={approveMutation.isPending}
                      title="Approve"
                    >
                      <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 text-green-600" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAdjustmentToDelete(adjustment)}
                    disabled={deleteMutation.isPending}
                    title="Delete"
                  >
                    <Icon icon={SolarIcons.trash} className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Icon icon={SolarIcons.documentText} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No adjustments for this period</p>
        </div>
      )}

      <AdjustmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        month={month}
        year={year}
        userId={userId}
        practiceId={practiceId}
      />

      <ConfirmDialog
        isOpen={!!adjustmentToDelete}
        tone="danger"
        title="Delete adjustment?"
        message={adjustmentToDelete ? (
          <p>
            <strong>{adjustmentToDelete.name}</strong> ({formatAmount(adjustmentToDelete.amount, adjustmentToDelete.type)})
            {adjustmentToDelete.user ? ` for ${adjustmentToDelete.user.full_name}` : ''} will be removed
            {adjustmentToDelete.is_approved ? ' and left out of payslips generated from now on' : ''}.
          </p>
        ) : null}
        confirmLabel="Delete adjustment"
        isLoading={deleteMutation.isPending}
        onConfirm={() => adjustmentToDelete && deleteMutation.mutate(adjustmentToDelete.id)}
        onCancel={() => setAdjustmentToDelete(null)}
      />
    </div>
  );
};