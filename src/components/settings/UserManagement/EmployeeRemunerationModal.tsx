import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import DateInput from '../../ui/DateInput';

interface EmployeeRemunerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

interface SalaryComponent {
  id: string;
  name: string;
  type: 'earnings' | 'deductions';
  category: string;
  is_taxable: boolean;
}

interface EmployeeSalaryComponent {
  component_id: string;
  amount: number;
  percentage?: number;
}

export default function EmployeeRemunerationModal({ isOpen, onClose, userId, userName }: EmployeeRemunerationModalProps) {
  const [basicSalary, setBasicSalary] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<Record<string, EmployeeSalaryComponent>>({});
  const [loading, setLoading] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchSalaryComponents();
      fetchCurrentSalary();
    }
  }, [isOpen, userId]);

  const fetchSalaryComponents = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: currentUser } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user.user.id)
        .single();

      if (!currentUser) return;

      const { data, error } = await supabase
        .from('salary_components')
        .select('*')
        .eq('practice_id', currentUser.practice_id)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setSalaryComponents(data || []);
    } catch (error) {
      console.error('Error fetching salary components:', error);
      toast.error('Failed to load salary components');
    } finally {
      setLoadingComponents(false);
    }
  };

  const fetchCurrentSalary = async () => {
    try {
      // Fetch current salary
      const { data: salaryData } = await supabase
        .from('employee_salaries')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (salaryData) {
        setBasicSalary(salaryData.basic_salary.toString());
      }

      // Fetch current salary components
      const { data: componentsData } = await supabase
        .from('employee_salary_components')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (componentsData) {
        const components: Record<string, EmployeeSalaryComponent> = {};
        componentsData.forEach(comp => {
          components[comp.component_id] = {
            component_id: comp.component_id,
            amount: comp.amount,
            percentage: comp.percentage
          };
        });
        setSelectedComponents(components);
      }
    } catch (error) {
      console.error('Error fetching current salary:', error);
    }
  };

  const handleComponentToggle = (componentId: string) => {
    setSelectedComponents(prev => {
      if (prev[componentId]) {
        const { [componentId]: removed, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [componentId]: {
            component_id: componentId,
            amount: 0,
            percentage: undefined
          }
        };
      }
    });
  };

  const handleComponentAmountChange = (componentId: string, amount: string) => {
    setSelectedComponents(prev => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        amount: parseFloat(amount) || 0
      }
    }));
  };

  const calculateTotalEarnings = () => {
    const basic = parseFloat(basicSalary) || 0;
    const earnings = salaryComponents
      .filter(c => c.type === 'earnings' && selectedComponents[c.id])
      .reduce((sum, c) => sum + (selectedComponents[c.id].amount || 0), 0);
    return basic + earnings;
  };

  const calculateTotalDeductions = () => {
    return salaryComponents
      .filter(c => c.type === 'deductions' && selectedComponents[c.id])
      .reduce((sum, c) => sum + (selectedComponents[c.id].amount || 0), 0);
  };

  const calculateNetSalary = () => {
    return calculateTotalEarnings() - calculateTotalDeductions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!basicSalary || parseFloat(basicSalary) <= 0) {
      toast.error('Please enter a valid basic salary');
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('No authenticated user');

      // Deactivate current salary
      await supabase
        .from('employee_salaries')
        .update({ is_active: false, effective_to: effectiveFrom })
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
          created_by: user.user.id
        });

      if (salaryError) throw salaryError;

      // Deactivate current salary components
      await supabase
        .from('employee_salary_components')
        .update({ is_active: false, effective_to: effectiveFrom })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Insert new salary components
      const componentInserts = Object.entries(selectedComponents)
        .filter(([_, comp]) => comp.amount > 0)
        .map(([componentId, comp]) => ({
          user_id: userId,
          component_id: componentId,
          amount: comp.amount,
          percentage: comp.percentage,
          effective_from: effectiveFrom,
          is_active: true
        }));

      if (componentInserts.length > 0) {
        const { error: componentsError } = await supabase
          .from('employee_salary_components')
          .insert(componentInserts);

        if (componentsError) throw componentsError;
      }

      toast.success('Employee remuneration updated successfully');
      onClose();
    } catch (error: any) {
      console.error('Error updating remuneration:', error);
      toast.error(error.message || 'Failed to update remuneration');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Employee Remuneration Setup</h2>
            <p className="text-gray-600 mt-1">{userName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Salary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Basic Salary (NAD)
            </label>
            <input
              type="number"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Enter basic salary"
              required
              min="0"
              step="0.01"
            />
          </div>

          {/* Effective Date */}
          <div>
            <DateInput
              label="Effective From"
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              placeholder="Select effective date"
              required
            />
          </div>

          {/* Benefits & Deductions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Icon icon="solar:wallet-money-bold-duotone" className="w-5 h-5 text-teal-600" />
              Benefits & Deductions
            </h3>

            {loadingComponents ? (
              <div className="text-center py-4">Loading components...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Benefits (Earnings) */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-700 text-sm uppercase tracking-wider">Benefits</h4>
                  {salaryComponents
                    .filter(c => c.type === 'earnings')
                    .map(component => (
                      <div key={component.id} className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!selectedComponents[component.id]}
                              onChange={() => handleComponentToggle(component.id)}
                              className="rounded text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{component.name}</span>
                          </label>
                          {component.is_taxable && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Taxable</span>
                          )}
                        </div>
                        {selectedComponents[component.id] && (
                          <input
                            type="number"
                            value={selectedComponents[component.id].amount || ''}
                            onChange={(e) => handleComponentAmountChange(component.id, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Amount"
                            min="0"
                            step="0.01"
                          />
                        )}
                      </div>
                    ))}
                </div>

                {/* Deductions */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-700 text-sm uppercase tracking-wider">Deductions</h4>
                  {salaryComponents
                    .filter(c => c.type === 'deductions')
                    .map(component => (
                      <div key={component.id} className="bg-red-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!selectedComponents[component.id]}
                              onChange={() => handleComponentToggle(component.id)}
                              className="rounded text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{component.name}</span>
                          </label>
                        </div>
                        {selectedComponents[component.id] && (
                          <input
                            type="number"
                            value={selectedComponents[component.id].amount || ''}
                            onChange={(e) => handleComponentAmountChange(component.id, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Amount"
                            min="0"
                            step="0.01"
                          />
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Basic Salary:</span>
              <span className="font-medium">NAD {parseFloat(basicSalary || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Benefits:</span>
              <span className="font-medium text-green-600">
                + NAD {(calculateTotalEarnings() - parseFloat(basicSalary || '0')).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Deductions:</span>
              <span className="font-medium text-red-600">- NAD {calculateTotalDeductions().toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold">Net Salary:</span>
              <span className="font-bold text-lg text-teal-600">NAD {calculateNetSalary().toFixed(2)}</span>
            </div>
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
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Remuneration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}