import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';

interface Benefit {
  id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  base_calculation: string;
  is_company_contribution: boolean;
}

interface Deduction {
  id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  base_calculation: string;
  is_statutory: boolean;
}

interface BonusConfiguration {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  base_calculation: string;
  period_type: string;
  period_months: number[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export const EnhancedEmployeeRemunerationModal: React.FC<Props> = ({ isOpen, onClose, userId, userName }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [basicSalary, setBasicSalary] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBenefits, setSelectedBenefits] = useState<Record<string, { value?: number; enabled: boolean }>>({});
  const [selectedDeductions, setSelectedDeductions] = useState<Record<string, { value?: number; enabled: boolean }>>({});
  const [selectedBonuses, setSelectedBonuses] = useState<string[]>([]);
  const [bankDetails, setBankDetails] = useState({
    bank_name: '',
    account_number: '',
    branch_code: '',
    swift_code: '',
    account_type: 'savings'
  });

  // Fetch user data
  const { data: userData } = useQuery({
    queryKey: ['user-details', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!userId
  });

  // Fetch current salary
  const { data: currentSalary } = useQuery({
    queryKey: ['current-salary', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_salaries')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!userId
  });

  // Fetch benefits
  const { data: benefits = [] } = useQuery<Benefit[]>({
    queryKey: ['benefits', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefits')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!user?.practice_id
  });

  // Fetch deductions
  const { data: deductions = [] } = useQuery<Deduction[]>({
    queryKey: ['deductions', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deductions')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!user?.practice_id
  });

  // Fetch bonus configurations
  const { data: bonuses = [] } = useQuery<BonusConfiguration[]>({
    queryKey: ['bonus-configurations', user?.practice_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_configurations')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!user?.practice_id
  });

  // Initialize form with user data
  useEffect(() => {
    if (userData) {
      setBankDetails({
        bank_name: userData.bank_name || '',
        account_number: userData.account_number || '',
        branch_code: userData.branch_code || '',
        swift_code: userData.swift_code || '',
        account_type: userData.account_type || 'savings'
      });
    }
    
    if (currentSalary) {
      setBasicSalary(currentSalary.basic_salary.toString());
    }
  }, [userData, currentSalary]);

  // Fetch current salary configurations
  useEffect(() => {
    const fetchConfigurations = async () => {
      if (!isOpen || !userId) return;

      const { data: configs } = await supabase
        .from('employee_salary_configurations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (configs) {
        const benefitConfigs: Record<string, { value?: number; enabled: boolean }> = {};
        const deductionConfigs: Record<string, { value?: number; enabled: boolean }> = {};
        const bonusConfigs: string[] = [];

        configs.forEach(config => {
          if (config.benefit_id) {
            benefitConfigs[config.benefit_id] = {
              value: config.custom_value,
              enabled: true
            };
          } else if (config.deduction_id) {
            deductionConfigs[config.deduction_id] = {
              value: config.custom_value,
              enabled: true
            };
          } else if (config.bonus_configuration_id) {
            bonusConfigs.push(config.bonus_configuration_id);
          }
        });

        setSelectedBenefits(benefitConfigs);
        setSelectedDeductions(deductionConfigs);
        setSelectedBonuses(bonusConfigs);
      }
    };

    fetchConfigurations();
  }, [isOpen, userId]);

  // Calculate values
  const calculateValue = (type: 'percentage' | 'fixed', value: number, base: string) => {
    const baseSalary = parseFloat(basicSalary) || 0;
    if (type === 'fixed') return value;
    if (base === 'basic_salary') return (baseSalary * value) / 100;
    // For gross_salary, we'd need to calculate iteratively
    return (baseSalary * value) / 100;
  };

  const calculateTotalEarnings = () => {
    const basic = parseFloat(basicSalary) || 0;
    const benefitsTotal = benefits.reduce((sum, benefit) => {
      if (selectedBenefits[benefit.id]?.enabled && !benefit.is_company_contribution) {
        const customValue = selectedBenefits[benefit.id]?.value;
        const value = customValue || calculateValue(benefit.type, benefit.value, benefit.base_calculation);
        return sum + value;
      }
      return sum;
    }, 0);
    return basic + benefitsTotal;
  };

  const calculateTotalDeductions = () => {
    return deductions.reduce((sum, deduction) => {
      if (selectedDeductions[deduction.id]?.enabled) {
        const customValue = selectedDeductions[deduction.id]?.value;
        const value = customValue || calculateValue(deduction.type, deduction.value, deduction.base_calculation);
        return sum + value;
      }
      return sum;
    }, 0);
  };

  const calculateNetSalary = () => {
    return calculateTotalEarnings() - calculateTotalDeductions();
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Update user banking details
      const { error: userError } = await supabase
        .from('users')
        .update({
          bank_name: bankDetails.bank_name,
          account_number: bankDetails.account_number,
          branch_code: bankDetails.branch_code,
          swift_code: bankDetails.swift_code,
          account_type: bankDetails.account_type
        })
        .eq('id', userId);

      if (userError) throw userError;

      // Deactivate current salary
      await supabase
        .from('employee_salaries')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Create new salary record
      const { error: salaryError } = await supabase
        .from('employee_salaries')
        .insert({
          user_id: userId,
          basic_salary: parseFloat(basicSalary),
          effective_from: effectiveFrom,
          is_active: true,
          created_by: user?.id
        });

      if (salaryError) throw salaryError;

      // Deactivate current configurations
      await supabase
        .from('employee_salary_configurations')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Insert new configurations
      const configs = [];

      // Benefits
      Object.entries(selectedBenefits).forEach(([benefitId, config]) => {
        if (config.enabled) {
          configs.push({
            user_id: userId,
            benefit_id: benefitId,
            custom_value: config.value,
            is_active: true
          });
        }
      });

      // Deductions
      Object.entries(selectedDeductions).forEach(([deductionId, config]) => {
        if (config.enabled) {
          configs.push({
            user_id: userId,
            deduction_id: deductionId,
            custom_value: config.value,
            is_active: true
          });
        }
      });

      // Bonuses
      selectedBonuses.forEach(bonusId => {
        configs.push({
          user_id: userId,
          bonus_configuration_id: bonusId,
          is_active: true
        });
      });

      if (configs.length > 0) {
        const { error: configError } = await supabase
          .from('employee_salary_configurations')
          .insert(configs);

        if (configError) throw configError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-salaries'] });
      queryClient.invalidateQueries({ queryKey: ['user-details'] });
      toast.success('Employee remuneration updated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update remuneration');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Configure Employee Salary</h2>
              <p className="text-gray-600 mt-1">{userName}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <Icon icon={SolarIcons.closeCircle} className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Icon icon={SolarIcons.wallet} className="w-5 h-5 text-purple-600" />
                Basic Salary & Banking Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Basic Salary (NAD)
                  </label>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter basic salary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective From
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankDetails.bank_name}
                    onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Bank Windhoek"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={bankDetails.account_number}
                    onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., 62242346415"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch Code
                  </label>
                  <input
                    type="text"
                    value={bankDetails.branch_code}
                    onChange={(e) => setBankDetails({ ...bankDetails, branch_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., 280972"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type
                  </label>
                  <select
                    value={bankDetails.account_type}
                    onChange={(e) => setBankDetails({ ...bankDetails, account_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="savings">Savings</option>
                    <option value="cheque">Cheque</option>
                    <option value="current">Current</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Icon icon={SolarIcons.gift} className="w-5 h-5 text-green-600" />
                Benefits & Allowances
              </h3>

              <div className="space-y-3">
                {benefits.map((benefit) => {
                  const isSelected = selectedBenefits[benefit.id]?.enabled;
                  const customValue = selectedBenefits[benefit.id]?.value;
                  const calculatedValue = calculateValue(benefit.type, benefit.value, benefit.base_calculation);
                  const displayValue = customValue || calculatedValue;

                  return (
                    <div key={benefit.id} className="bg-white rounded-lg p-3 border border-green-200">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          onChange={(e) => {
                            setSelectedBenefits({
                              ...selectedBenefits,
                              [benefit.id]: { enabled: e.target.checked }
                            });
                          }}
                          className="mt-1 rounded text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="font-medium text-gray-900">{benefit.name}</label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-600">
                                  {benefit.type === 'percentage' ? `${benefit.value}%` : `NAD ${benefit.value}`}
                                  {' of '}
                                  {benefit.base_calculation.replace('_', ' ')}
                                </span>
                                {benefit.is_company_contribution && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                    Company Contribution
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="text-right">
                                <p className="text-sm text-gray-600">Amount</p>
                                <p className="font-semibold text-green-600">
                                  NAD {displayValue.toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                          {isSelected && benefit.type === 'percentage' && (
                            <div className="mt-2">
                              <label className="text-xs text-gray-600">Override amount (optional)</label>
                              <input
                                type="number"
                                value={customValue || ''}
                                onChange={(e) => {
                                  setSelectedBenefits({
                                    ...selectedBenefits,
                                    [benefit.id]: {
                                      enabled: true,
                                      value: e.target.value ? parseFloat(e.target.value) : undefined
                                    }
                                  });
                                }}
                                className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder={`Default: ${calculatedValue.toFixed(2)}`}
                                step="0.01"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deductions */}
            <div className="bg-red-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Icon icon={SolarIcons.moneyBag} className="w-5 h-5 text-red-600" />
                Deductions
              </h3>

              <div className="space-y-3">
                {deductions.map((deduction) => {
                  const isSelected = selectedDeductions[deduction.id]?.enabled;
                  const customValue = selectedDeductions[deduction.id]?.value;
                  const calculatedValue = calculateValue(deduction.type, deduction.value, deduction.base_calculation);
                  const displayValue = customValue || calculatedValue;

                  return (
                    <div key={deduction.id} className="bg-white rounded-lg p-3 border border-red-200">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          onChange={(e) => {
                            setSelectedDeductions({
                              ...selectedDeductions,
                              [deduction.id]: { enabled: e.target.checked }
                            });
                          }}
                          className="mt-1 rounded text-red-600 focus:ring-red-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="font-medium text-gray-900">{deduction.name}</label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-600">
                                  {deduction.type === 'percentage' ? `${deduction.value}%` : `NAD ${deduction.value}`}
                                  {' of '}
                                  {deduction.base_calculation.replace('_', ' ')}
                                </span>
                                {deduction.is_statutory && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                    Statutory
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="text-right">
                                <p className="text-sm text-gray-600">Amount</p>
                                <p className="font-semibold text-red-600">
                                  NAD {displayValue.toFixed(2)}
                                </p>
                              </div>
                            )}
                          </div>
                          {isSelected && deduction.type === 'percentage' && (
                            <div className="mt-2">
                              <label className="text-xs text-gray-600">Override amount (optional)</label>
                              <input
                                type="number"
                                value={customValue || ''}
                                onChange={(e) => {
                                  setSelectedDeductions({
                                    ...selectedDeductions,
                                    [deduction.id]: {
                                      enabled: true,
                                      value: e.target.value ? parseFloat(e.target.value) : undefined
                                    }
                                  });
                                }}
                                className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder={`Default: ${calculatedValue.toFixed(2)}`}
                                step="0.01"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bonuses */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Icon icon={SolarIcons.star} className="w-5 h-5 text-yellow-600" />
                Bonus Eligibility
              </h3>

              <div className="space-y-3">
                {bonuses.map((bonus) => {
                  const isSelected = selectedBonuses.includes(bonus.id);

                  return (
                    <div key={bonus.id} className="bg-white rounded-lg p-3 border border-yellow-200">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBonuses([...selectedBonuses, bonus.id]);
                            } else {
                              setSelectedBonuses(selectedBonuses.filter(id => id !== bonus.id));
                            }
                          }}
                          className="mt-1 rounded text-yellow-600 focus:ring-yellow-500"
                        />
                        <div className="flex-1">
                          <label className="font-medium text-gray-900">{bonus.name}</label>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600">
                              {bonus.type === 'percentage' ? `${bonus.value}%` : `NAD ${bonus.value}`}
                              {' of '}
                              {bonus.base_calculation.replace('_', ' ')}
                            </span>
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                              {bonus.period_type === 'birthday' ? 'Birthday Month' : 
                               bonus.period_type === 'yearly' ? 'Annual' :
                               bonus.period_type === 'monthly' ? 'Monthly' : 'Custom'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-100 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Salary Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Basic Salary:</span>
                  <span className="font-medium">NAD {parseFloat(basicSalary || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Benefits:</span>
                  <span className="font-medium text-green-600">
                    + NAD {(calculateTotalEarnings() - parseFloat(basicSalary || '0')).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Deductions:</span>
                  <span className="font-medium text-red-600">
                    - NAD {calculateTotalDeductions().toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">Net Salary:</span>
                  <span className="font-bold text-lg text-purple-600">
                    NAD {calculateNetSalary().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!basicSalary || saveMutation.isPending}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};