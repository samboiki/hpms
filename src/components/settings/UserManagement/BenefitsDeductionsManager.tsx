import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

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
  description?: string;
  created_at: string;
}

export const BenefitsDeductionsManager: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'benefits' | 'deductions' | 'bonuses'>('benefits');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'fixed' as 'percentage' | 'fixed',
    value: '',
    base_calculation: 'basic_salary' as 'basic_salary' | 'gross_salary' | 'custom' | 'annual_salary',
    is_company_contribution: false,
    is_statutory: false,
    description: '',
    period_type: 'yearly' as 'monthly' | 'yearly' | 'birthday' | 'custom',
    period_months: [] as number[]
  });

  // Fetch benefits
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

  // Fetch deductions
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

  // Fetch bonus configurations
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

  // Add benefit mutation
  const addBenefitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('benefits')
        .insert({
          practice_id: user?.practice_id,
          name: data.name,
          code: data.code.toUpperCase(),
          type: data.type,
          value: parseFloat(data.value),
          base_calculation: data.base_calculation,
          is_company_contribution: data.is_company_contribution,
          description: data.description,
          is_active: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benefits'] });
      toast.success('Benefit added successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add benefit');
    }
  });

  // Add deduction mutation
  const addDeductionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('deductions')
        .insert({
          practice_id: user?.practice_id,
          name: data.name,
          code: data.code.toUpperCase(),
          type: data.type,
          value: parseFloat(data.value),
          base_calculation: data.base_calculation,
          is_statutory: data.is_statutory,
          description: data.description,
          is_active: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deductions'] });
      toast.success('Deduction added successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add deduction');
    }
  });

  // Add bonus configuration mutation
  const addBonusMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('bonus_configurations')
        .insert({
          practice_id: user?.practice_id,
          name: data.name,
          type: data.type,
          value: parseFloat(data.value),
          base_calculation: data.base_calculation as 'basic_salary' | 'annual_salary',
          period_type: data.period_type,
          period_months: data.period_months,
          description: data.description,
          is_active: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-configurations'] });
      toast.success('Bonus configuration added successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add bonus configuration');
    }
  });

  // Toggle active status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, table, is_active }: { id: string; table: string; is_active: boolean }) => {
      const { error } = await supabase
        .from(table)
        .update({ is_active: !is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.table.replace('_', '-')] });
      toast.success('Status updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update status');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'fixed',
      value: '',
      base_calculation: 'basic_salary',
      is_company_contribution: false,
      is_statutory: false,
      description: '',
      period_type: 'yearly',
      period_months: []
    });
    setShowAddModal(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingItem) {
        // Update existing item
        const table = activeTab === 'benefits' ? 'benefits' : 
                     activeTab === 'deductions' ? 'deductions' : 
                     'bonus_configurations';
        
        const updateData: any = {
          name: formData.name,
          type: formData.type,
          value: parseFloat(formData.value),
          base_calculation: formData.base_calculation,
          description: formData.description
        };
        
        if (activeTab === 'benefits') {
          updateData.is_company_contribution = formData.is_company_contribution;
        } else if (activeTab === 'deductions') {
          updateData.is_statutory = formData.is_statutory;
        } else if (activeTab === 'bonuses') {
          updateData.period_type = formData.period_type;
          updateData.period_months = formData.period_months;
        }
        
        if (formData.code) {
          updateData.code = formData.code;
        }
        
        const { error } = await supabase
          .from(table)
          .update(updateData)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        
        queryClient.invalidateQueries({ queryKey: [activeTab] });
        toast.success(`${activeTab.slice(0, -1)} updated successfully`);
        resetForm();
      } else {
        // Add new item
        if (activeTab === 'benefits') {
          addBenefitMutation.mutate(formData);
        } else if (activeTab === 'deductions') {
          addDeductionMutation.mutate(formData);
        } else if (activeTab === 'bonuses') {
          addBonusMutation.mutate(formData);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    }
  };

  const formatValue = (type: string, value: number) => {
    return type === 'percentage' ? `${value}%` : `NAD ${value.toFixed(2)}`;
  };

  const getMonthName = (month: number) => {
    const date = new Date();
    date.setMonth(month - 1);
    return format(date, 'MMMM');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Benefits, Deductions & Bonuses</h2>
        <Button
          onClick={() => setShowAddModal(true)}
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
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={SolarIcons.gift} className="w-4 h-4" />
              Benefits ({benefits.length})
            </button>
            <button
              onClick={() => setActiveTab('deductions')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'deductions'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={SolarIcons.moneyBag} className="w-4 h-4" />
              Deductions ({deductions.length})
            </button>
            <button
              onClick={() => setActiveTab('bonuses')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'bonuses'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={SolarIcons.star} className="w-4 h-4" />
              Bonuses ({bonuses.length})
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardContent>
          {activeTab === 'benefits' && (
            <div className="space-y-4">
              {benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className={`bg-green-50 rounded-lg p-4 border ${
                    benefit.is_active ? 'border-green-200' : 'border-gray-300 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{benefit.name}</h4>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          {benefit.code}
                        </span>
                        {benefit.is_company_contribution && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            Company Contribution
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{benefit.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">
                          {formatValue(benefit.type, benefit.value)}
                        </span>
                        <span className="text-gray-500">
                          of {benefit.base_calculation.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatusMutation.mutate({
                          id: benefit.id,
                          table: 'benefits',
                          is_active: benefit.is_active
                        })}
                      >
                        <Icon 
                          icon={benefit.is_active ? SolarIcons.pauseCircle : SolarIcons.playCircle} 
                          className={`w-4 h-4 ${benefit.is_active ? 'text-orange-600' : 'text-green-600'}`} 
                        />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingItem(benefit);
                          setFormData({
                            name: benefit.name,
                            code: benefit.code,
                            type: benefit.type,
                            value: benefit.value.toString(),
                            base_calculation: benefit.base_calculation,
                            is_company_contribution: benefit.is_company_contribution,
                            is_statutory: false,
                            description: benefit.description || '',
                            period_type: 'yearly',
                            period_months: []
                          });
                          setShowAddModal(true);
                        }}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {benefits.length === 0 && (
                <div className="text-center py-8">
                  <Icon icon={SolarIcons.gift} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No benefits configured yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deductions' && (
            <div className="space-y-4">
              {deductions.map((deduction) => (
                <div
                  key={deduction.id}
                  className={`bg-red-50 rounded-lg p-4 border ${
                    deduction.is_active ? 'border-red-200' : 'border-gray-300 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{deduction.name}</h4>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                          {deduction.code}
                        </span>
                        {deduction.is_statutory && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                            Statutory
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{deduction.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">
                          {formatValue(deduction.type, deduction.value)}
                        </span>
                        <span className="text-gray-500">
                          of {deduction.base_calculation.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatusMutation.mutate({
                          id: deduction.id,
                          table: 'deductions',
                          is_active: deduction.is_active
                        })}
                      >
                        <Icon 
                          icon={deduction.is_active ? SolarIcons.pauseCircle : SolarIcons.playCircle} 
                          className={`w-4 h-4 ${deduction.is_active ? 'text-orange-600' : 'text-green-600'}`} 
                        />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingItem(deduction);
                          setFormData({
                            name: deduction.name,
                            code: deduction.code,
                            type: deduction.type,
                            value: deduction.value.toString(),
                            base_calculation: deduction.base_calculation,
                            is_company_contribution: false,
                            is_statutory: deduction.is_statutory,
                            description: deduction.description || '',
                            period_type: 'yearly',
                            period_months: []
                          });
                          setShowAddModal(true);
                        }}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {deductions.length === 0 && (
                <div className="text-center py-8">
                  <Icon icon={SolarIcons.moneyBag} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No deductions configured yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bonuses' && (
            <div className="space-y-4">
              {bonuses.map((bonus) => (
                <div
                  key={bonus.id}
                  className={`bg-yellow-50 rounded-lg p-4 border ${
                    bonus.is_active ? 'border-yellow-200' : 'border-gray-300 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{bonus.name}</h4>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                          {bonus.period_type === 'birthday' ? 'Birthday Month' : 
                           bonus.period_type === 'yearly' ? 'Annual' :
                           bonus.period_type === 'monthly' ? 'Monthly' : 'Custom'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{bonus.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">
                          {formatValue(bonus.type, bonus.value)}
                        </span>
                        <span className="text-gray-500">
                          of {bonus.base_calculation.replace('_', ' ')}
                        </span>
                      </div>
                      {bonus.period_months && bonus.period_months.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Applies in: </span>
                          {bonus.period_months.map(month => getMonthName(month)).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatusMutation.mutate({
                          id: bonus.id,
                          table: 'bonus_configurations',
                          is_active: bonus.is_active
                        })}
                      >
                        <Icon 
                          icon={bonus.is_active ? SolarIcons.pauseCircle : SolarIcons.playCircle} 
                          className={`w-4 h-4 ${bonus.is_active ? 'text-orange-600' : 'text-green-600'}`} 
                        />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingItem(bonus);
                          setFormData({
                            name: bonus.name,
                            code: '',
                            type: bonus.type,
                            value: bonus.value.toString(),
                            base_calculation: bonus.base_calculation,
                            is_company_contribution: false,
                            is_statutory: false,
                            description: bonus.description || '',
                            period_type: bonus.period_type,
                            period_months: bonus.period_months || []
                          });
                          setShowAddModal(true);
                        }}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {bonuses.length === 0 && (
                <div className="text-center py-8">
                  <Icon icon={SolarIcons.star} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No bonus configurations yet</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingItem ? 'Edit' : 'Add'} {activeTab === 'benefits' ? 'Benefit' : activeTab === 'deductions' ? 'Deduction' : 'Bonus Configuration'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder={activeTab === 'benefits' ? 'e.g., Housing Allowance' : 
                               activeTab === 'deductions' ? 'e.g., Income Tax' : 
                               'e.g., Year-End Bonus'}
                    required
                  />
                </div>

                {activeTab !== 'bonuses' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder={activeTab === 'benefits' ? 'e.g., HOUSE' : 'e.g., TAX'}
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percentage' | 'fixed' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder={formData.type === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Calculation
                  </label>
                  <select
                    value={formData.base_calculation}
                    onChange={(e) => setFormData({ ...formData, base_calculation: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="basic_salary">Basic Salary</option>
                    <option value="gross_salary">Gross Salary</option>
                    {activeTab === 'bonuses' && <option value="annual_salary">Annual Salary</option>}
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {activeTab === 'bonuses' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Period Type
                      </label>
                      <select
                        value={formData.period_type}
                        onChange={(e) => setFormData({ ...formData, period_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="yearly">Annual (December)</option>
                        <option value="birthday">Birthday Month</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom Months</option>
                      </select>
                    </div>

                    {formData.period_type === 'custom' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select Months
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[...Array(12)].map((_, i) => {
                            const month = i + 1;
                            const monthName = getMonthName(month);
                            return (
                              <label key={month} className="flex items-center gap-1 text-sm">
                                <input
                                  type="checkbox"
                                  checked={formData.period_months.includes(month)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({ ...formData, period_months: [...formData.period_months, month] });
                                    } else {
                                      setFormData({ ...formData, period_months: formData.period_months.filter(m => m !== month) });
                                    }
                                  }}
                                  className="rounded text-purple-600 focus:ring-purple-500"
                                />
                                {monthName.slice(0, 3)}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    placeholder="Brief description..."
                  />
                </div>

                {activeTab === 'benefits' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_company_contribution}
                      onChange={(e) => setFormData({ ...formData, is_company_contribution: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Company Contribution (not deducted from employee)</span>
                  </label>
                )}

                {activeTab === 'deductions' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_statutory}
                      onChange={(e) => setFormData({ ...formData, is_statutory: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Statutory Deduction</span>
                  </label>
                )}

                <div className="flex items-center gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={
                      activeTab === 'benefits' ? addBenefitMutation.isPending :
                      activeTab === 'deductions' ? addDeductionMutation.isPending :
                      addBonusMutation.isPending
                    }
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                  >
                    {(activeTab === 'benefits' ? addBenefitMutation.isPending :
                      activeTab === 'deductions' ? addDeductionMutation.isPending :
                      addBonusMutation.isPending) ? 'Adding...' : 'Add'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};