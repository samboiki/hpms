import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { InfoTooltip, PayrollTooltips } from '../../ui/InfoTooltip';

// These icons are not in the shared SolarIcons map (referencing them there rendered nothing)
const ITEM_ICONS = {
  benefit: 'solar:gift-bold-duotone',
  deduction: 'solar:money-bag-bold-duotone',
  bonus: 'solar:star-bold-duotone'
} as const;

interface Benefit {
  id: string;
  practice_id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  base_calculation: 'basic_salary' | 'gross_salary' | 'custom';
  is_company_contribution: boolean;
  is_active: boolean;
  is_recurring: boolean;
  description?: string;
  created_at: string;
}

interface Deduction {
  id: string;
  practice_id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  base_calculation: 'basic_salary' | 'gross_salary' | 'custom';
  is_statutory: boolean;
  is_active: boolean;
  is_recurring: boolean;
  description?: string;
  created_at: string;
}

interface BonusConfiguration {
  id: string;
  practice_id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  base_calculation: 'basic_salary' | 'annual_salary';
  period_type: 'monthly' | 'yearly' | 'birthday' | 'custom';
  period_months: number[];
  is_active: boolean;
  is_recurring: boolean;
  description?: string;
  created_at: string;
}

// Premium Modal Component
const ComponentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  type: 'benefit' | 'deduction' | 'bonus';
  onSubmit: (data: any) => void;
  editingItem?: any;
  isLoading?: boolean;
}> = ({ isOpen, onClose, type, onSubmit, editingItem, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'fixed' as 'percentage' | 'fixed',
    value: '',
    base_calculation: 'basic_salary' as 'basic_salary' | 'gross_salary' | 'custom' | 'annual_salary',
    is_company_contribution: false,
    is_statutory: false,
    is_recurring: true,
    description: '',
    period_type: 'yearly' as 'monthly' | 'yearly' | 'birthday' | 'custom',
    period_months: [] as number[]
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        name: editingItem.name || '',
        code: editingItem.code || '',
        type: editingItem.type || 'fixed',
        value: editingItem.value?.toString() || '',
        base_calculation: editingItem.base_calculation || 'basic_salary',
        is_company_contribution: editingItem.is_company_contribution || false,
        is_statutory: editingItem.is_statutory || false,
        is_recurring: editingItem.is_recurring ?? true,
        description: editingItem.description || '',
        period_type: editingItem.period_type || 'yearly',
        period_months: editingItem.period_months || []
      });
    } else {
      setFormData({
        name: '',
        code: '',
        type: 'fixed',
        value: '',
        base_calculation: 'basic_salary',
        is_company_contribution: false,
        is_statutory: false,
        is_recurring: true,
        description: '',
        period_type: 'yearly',
        period_months: []
      });
    }
  }, [editingItem, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const getIcon = () => ITEM_ICONS[type];

  const getTitle = () => {
    const action = editingItem ? 'Edit' : 'Add';
    return `${action} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  };

  const getColor = () => {
    switch (type) {
      case 'benefit':
        return 'from-green-500 to-emerald-600';
      case 'deduction':
        return 'from-red-500 to-rose-600';
      case 'bonus':
        return 'from-yellow-500 to-amber-600';
    }
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
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className={`relative bg-gradient-to-r ${getColor()} p-6 text-white`}>
            <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-black/20"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Icon icon={getIcon()} className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{getTitle()}</h2>
                  <p className="text-white/80 text-sm">Complete the information below</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-colors"
              >
                <Icon icon={SolarIcons.closeCircle} className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon icon={SolarIcons.infoCircle} className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                    <p className="text-sm text-gray-500">Configure the basic details</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder={`Enter ${type} name`}
                      required
                    />
                  </div>

                  {type !== 'bonus' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="e.g., MEAL, TAX"
                        required
                      />
                    </div>
                  )}

                  <div className={type === 'bonus' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={3}
                      placeholder={`Describe this ${type}...`}
                    />
                  </div>
                </div>
              </div>

              {/* Calculation Settings Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Icon icon="solar:calculator-bold-duotone" className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Calculation Settings</h3>
                    <p className="text-sm text-gray-500">Configure how this {type} is calculated</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder={formData.type === 'percentage' ? 'Enter percentage' : 'Enter amount'}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Base Calculation
                      {PayrollTooltips.baseCalculation}
                    </label>
                    <select
                      value={formData.base_calculation}
                      onChange={(e) => setFormData({ ...formData, base_calculation: e.target.value as any })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="basic_salary">Basic Salary</option>
                      {type !== 'bonus' && <option value="gross_salary">Gross Salary</option>}
                      {type === 'bonus' && <option value="annual_salary">Annual Salary</option>}
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {/* Recurring Flag */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_recurring}
                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Recurring {type}
                      </span>
                    </label>
                    {PayrollTooltips.recurring}
                  </div>
                </div>
              </div>

              {/* Additional Settings */}
              {type === 'benefit' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_company_contribution}
                      onChange={(e) => setFormData({ ...formData, is_company_contribution: e.target.checked })}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="font-medium text-gray-700">Company Contribution</span>
                    {PayrollTooltips.companyContribution}
                  </label>
                </div>
              )}

              {type === 'deduction' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_statutory}
                      onChange={(e) => setFormData({ ...formData, is_statutory: e.target.checked })}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="font-medium text-gray-700">Statutory Deduction</span>
                    {PayrollTooltips.statutory}
                  </label>
                </div>
              )}

              {type === 'bonus' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Icon icon={SolarIcons.calendar} className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Bonus Schedule</h3>
                      <p className="text-sm text-gray-500">When should this bonus be applied?</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Period Type
                      {PayrollTooltips.bonusPeriod}
                    </label>
                    <select
                      value={formData.period_type}
                      onChange={(e) => setFormData({ ...formData, period_type: e.target.value as any })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="birthday">Birthday Month</option>
                      <option value="custom">Custom Months</option>
                    </select>
                  </div>

                  {formData.period_type === 'custom' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Months
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                          <label key={month} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={formData.period_months.includes(month)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ 
                                    ...formData, 
                                    period_months: [...formData.period_months, month].sort((a, b) => a - b)
                                  });
                                } else {
                                  setFormData({ 
                                    ...formData, 
                                    period_months: formData.period_months.filter(m => m !== month)
                                  });
                                }
                              }}
                              className="text-purple-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm">{format(new Date(2024, month - 1), 'MMMM')}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={`bg-gradient-to-r ${getColor()} text-white`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Icon icon={SolarIcons.loader} className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 mr-2" />
                      {editingItem ? 'Update' : 'Create'} {type}
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

export const EnhancedBenefitsDeductionsManager: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'benefits' | 'deductions' | 'bonuses'>('benefits');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch queries
  const { data: benefits = [] } = useQuery<Benefit[]>({
    queryKey: ['benefits', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefits')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.practice_id
  });

  const { data: deductions = [] } = useQuery<Deduction[]>({
    queryKey: ['deductions', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deductions')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.practice_id
  });

  const { data: bonuses = [] } = useQuery<BonusConfiguration[]>({
    queryKey: ['bonus-configurations', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_configurations')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.practice_id
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async ({ type, data }: { type: string, data: any }) => {
      const table = type === 'benefit' ? 'benefits' : 
                    type === 'deduction' ? 'deductions' : 
                    'bonus_configurations';
      
      const payload = {
        practice_id: user?.practice_id,
        name: data.name,
        type: data.type,
        value: parseFloat(data.value),
        base_calculation: data.base_calculation,
        description: data.description,
        is_active: true,
        is_recurring: data.is_recurring,
        ...(type === 'benefit' && { 
          code: data.code.toUpperCase(),
          is_company_contribution: data.is_company_contribution 
        }),
        ...(type === 'deduction' && { 
          code: data.code.toUpperCase(),
          is_statutory: data.is_statutory 
        }),
        ...(type === 'bonus' && { 
          period_type: data.period_type,
          period_months: data.period_type === 'monthly' ? [1,2,3,4,5,6,7,8,9,10,11,12] :
                         data.period_type === 'yearly' ? [12] :
                         data.period_type === 'birthday' ? [] :
                         data.period_months
        })
      };

      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const key = variables.type === 'benefit' ? 'benefits' : 
                  variables.type === 'deduction' ? 'deductions' : 
                  'bonus-configurations';
      queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(`${variables.type} created successfully`);
      setShowModal(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create item');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ type, id, data }: { type: string, id: string, data: any }) => {
      const table = type === 'benefit' ? 'benefits' : 
                    type === 'deduction' ? 'deductions' : 
                    'bonus_configurations';
      
      const payload = {
        name: data.name,
        type: data.type,
        value: parseFloat(data.value),
        base_calculation: data.base_calculation,
        description: data.description,
        is_recurring: data.is_recurring,
        ...(type === 'benefit' && { 
          code: data.code.toUpperCase(),
          is_company_contribution: data.is_company_contribution 
        }),
        ...(type === 'deduction' && { 
          code: data.code.toUpperCase(),
          is_statutory: data.is_statutory 
        }),
        ...(type === 'bonus' && { 
          period_type: data.period_type,
          period_months: data.period_type === 'monthly' ? [1,2,3,4,5,6,7,8,9,10,11,12] :
                         data.period_type === 'yearly' ? [12] :
                         data.period_type === 'birthday' ? [] :
                         data.period_months
        })
      };

      const { error } = await supabase.from(table).update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const key = variables.type === 'benefit' ? 'benefits' : 
                  variables.type === 'deduction' ? 'deductions' : 
                  'bonus-configurations';
      queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(`${variables.type} updated successfully`);
      setShowModal(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update item');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, table, is_active }: { id: string, table: string, is_active: boolean }) => {
      const { error } = await supabase
        .from(table)
        .update({ is_active: !is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const key = variables.table === 'benefits' ? 'benefits' : 
                  variables.table === 'deductions' ? 'deductions' : 
                  'bonus-configurations';
      queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(variables.is_active ? 'Deactivated - no longer applied to new payslips' : 'Activated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update status');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string, table: string }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const key = variables.table === 'benefits' ? 'benefits' : 
                  variables.table === 'deductions' ? 'deductions' : 
                  'bonus-configurations';
      queryClient.invalidateQueries({ queryKey: [key] });
      toast.success('Item deleted successfully');
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete item');
    }
  });

  // 'bonuses'.slice(0, -1) is 'bonuse', which hid the bonus period fields and dropped
  // period_type from the saved row, so map each tab to its item type explicitly
  const itemType: 'benefit' | 'deduction' | 'bonus' =
    activeTab === 'benefits' ? 'benefit' : activeTab === 'deductions' ? 'deduction' : 'bonus';

  const handleSubmit = (data: any) => {
    if (editingItem) {
      updateMutation.mutate({ type: itemType, id: editingItem.id, data });
    } else {
      createMutation.mutate({ type: itemType, data });
    }
  };

  const formatValue = (type: string, value: number) => {
    return type === 'percentage' ? `${value}%` : `NAD ${Number(value).toFixed(2)}`;
  };

  // Fixed day-of-month: setMonth() on the 29th-31st rolls over (e.g. 31 Oct -> "Mar" for February)
  const getMonthName = (month: number) => format(new Date(2000, month - 1, 1), 'MMM');

  const ComponentCard: React.FC<{
    item: any;
    type: 'benefit' | 'deduction' | 'bonus';
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
  }> = ({ item, type, onEdit, onToggle, onDelete }) => {
    const getCardColor = () => {
      switch (type) {
        case 'benefit':
          return item.is_active ? 'bg-green-50 border-green-200 hover:border-green-300' : 'bg-gray-50 border-gray-300';
        case 'deduction':
          return item.is_active ? 'bg-red-50 border-red-200 hover:border-red-300' : 'bg-gray-50 border-gray-300';
        case 'bonus':
          return item.is_active ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300' : 'bg-gray-50 border-gray-300';
      }
    };

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`rounded-lg p-4 border-2 transition-all cursor-pointer ${getCardColor()} ${
          !item.is_active && 'opacity-60'
        }`}
        onClick={onEdit}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-semibold text-gray-900">{item.name}</h4>
              {item.code && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  type === 'benefit' ? 'bg-green-100 text-green-700' :
                  type === 'deduction' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {item.code}
                </span>
              )}
              {item.code === 'PAYE' && PayrollTooltips.payeInfo}
              {item.is_recurring ? (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1">
                  <Icon icon={SolarIcons.refresh} className="w-3 h-3" />
                  Recurring
                </span>
              ) : (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium flex items-center gap-1">
                  <Icon icon={SolarIcons.calendar} className="w-3 h-3" />
                  Event-based
                </span>
              )}
              {type === 'benefit' && item.is_company_contribution && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  Company
                </span>
              )}
              {type === 'deduction' && item.is_statutory && (
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                  Statutory
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-sm text-gray-600 mb-2">{item.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium">
                {formatValue(item.type, item.value)}
              </span>
              <span className="text-gray-500">
                of {item.base_calculation.replace('_', ' ')}
              </span>
            </div>
            {type === 'bonus' && item.period_months && item.period_months.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium">Applies in: </span>
                {item.period_type === 'monthly' ? 'Every month' :
                 item.period_type === 'yearly' ? 'December' :
                 item.period_type === 'birthday' ? 'Employee birthday month' :
                 item.period_months.map((m: number) => getMonthName(m)).join(', ')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              title={item.is_active ? 'Deactivate' : 'Activate'}
            >
              <Icon
                icon={item.is_active ? 'solar:pause-circle-bold-duotone' : 'solar:play-circle-bold-duotone'}
                className={`w-4 h-4 ${item.is_active ? 'text-orange-600' : 'text-green-600'}`}
              />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onEdit}
              title="Edit"
            >
              <Icon icon={SolarIcons.edit} className="w-4 h-4 text-blue-600" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Icon icon={SolarIcons.trash} className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  const currentItems = activeTab === 'benefits' ? benefits : 
                       activeTab === 'deductions' ? deductions : 
                       bonuses;

  const currentTable = activeTab === 'benefits' ? 'benefits' : 
                       activeTab === 'deductions' ? 'deductions' : 
                       'bonus_configurations';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Benefits, Deductions & Bonuses</h2>
        <Button
          onClick={() => {
            setEditingItem(null);
            setShowModal(true);
          }}
          className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
        >
          <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
          Add {activeTab === 'benefits' ? 'Benefit' : activeTab === 'deductions' ? 'Deduction' : 'Bonus'}
        </Button>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="p-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('benefits')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'benefits'
                  ? 'text-green-600 border-green-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={ITEM_ICONS.benefit} className="w-4 h-4" />
              Benefits ({benefits.length})
            </button>
            <button
              onClick={() => setActiveTab('deductions')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'deductions'
                  ? 'text-red-600 border-red-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={ITEM_ICONS.deduction} className="w-4 h-4" />
              Deductions ({deductions.length})
            </button>
            <button
              onClick={() => setActiveTab('bonuses')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'bonuses'
                  ? 'text-yellow-600 border-yellow-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={ITEM_ICONS.bonus} className="w-4 h-4" />
              Bonuses ({bonuses.length})
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardContent>
          {currentItems.length > 0 ? (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {currentItems.map((item) => (
                  <ComponentCard
                    key={item.id}
                    item={item}
                    type={itemType}
                    onEdit={() => {
                      setEditingItem(item);
                      setShowModal(true);
                    }}
                    onToggle={() => toggleStatusMutation.mutate({
                      id: item.id,
                      table: currentTable,
                      is_active: item.is_active
                    })}
                    onDelete={() => setDeleteConfirm(item.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-12">
              <Icon
                icon={ITEM_ICONS[itemType]}
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
              />
              <p className="text-gray-600 text-lg">No {activeTab} configured yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Click the "Add {itemType}" button to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <ComponentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        type={itemType}
        onSubmit={handleSubmit}
        editingItem={editingItem}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
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
              className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <Icon icon={SolarIcons.trash} className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Confirmation</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete this {itemType}? This will remove it from all future payslips.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => deleteMutation.mutate({ id: deleteConfirm, table: currentTable })}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Icon icon={SolarIcons.loader} className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Icon icon={SolarIcons.trash} className="w-4 h-4 mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};