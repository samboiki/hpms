import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { PayrollService } from '../../../services/payrollService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: string[];
  onSuccess: () => void;
  month?: Date;
}

interface UserInfo {
  id: string;
  full_name: string;
  email: string;
  employee_number: string;
  department?: string;
  has_salary: boolean;
  basic_salary?: number;
  status?: 'ready' | 'missing_salary' | 'already_generated';
}

export const EnhancedPayslipGenerationModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  selectedUsers,
  onSuccess,
  month = new Date()
}) => {
  const { user } = useAuthStore();
  const [payPeriod, setPayPeriod] = useState(month);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ userId: string; success: boolean; error?: string }[]>([]);

  // Fetch users info
  const { data: users = [], isLoading } = useQuery<UserInfo[]>({
    queryKey: ['payslip-generation-users', selectedUsers, format(payPeriod, 'yyyy-MM')],
    queryFn: async () => {
      const monthStart = new Date(payPeriod.getFullYear(), payPeriod.getMonth(), 1);
      const monthEnd = new Date(payPeriod.getFullYear(), payPeriod.getMonth() + 1, 0);

      // Fetch user details
      const { data: usersData } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          employee_number,
          department,
          employee_salaries!inner(basic_salary)
        `)
        .in('id', selectedUsers)
        .eq('employee_salaries.is_active', true);

      if (!usersData) return [];

      // Check existing payslips
      const { data: existingPayslips } = await supabase
        .from('payslips')
        .select('user_id')
        .in('user_id', selectedUsers)
        .gte('pay_period_start', monthStart.toISOString())
        .lte('pay_period_end', monthEnd.toISOString());

      const existingUserIds = new Set(existingPayslips?.map(p => p.user_id) || []);

      return usersData.map(user => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        employee_number: user.employee_number,
        department: user.department,
        has_salary: user.employee_salaries && user.employee_salaries.length > 0,
        basic_salary: user.employee_salaries?.[0]?.basic_salary,
        status: existingUserIds.has(user.id) ? 'already_generated' :
                !user.employee_salaries || user.employee_salaries.length === 0 ? 'missing_salary' :
                'ready'
      }));
    },
    enabled: isOpen && selectedUsers.length > 0
  });

  const readyUsers = users.filter(u => u.status === 'ready');
  const problemUsers = users.filter(u => u.status !== 'ready');

  // Generate payslips mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const userIds = readyUsers.map(u => u.id);
      const result = await PayrollService.generatePayslips(userIds, payPeriod);
      return result;
    },
    onSuccess: (data) => {
      setResults(data.results);
      const successCount = data.results.filter(r => r.success).length;
      
      if (successCount > 0) {
        toast.success(`Generated ${successCount} payslip(s) successfully`);
        onSuccess();
      }
      
      if (data.errors.length > 0) {
        toast.error(`Failed to generate ${data.errors.length} payslip(s)`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate payslips');
    }
  });

  const handleGenerate = () => {
    if (readyUsers.length === 0) {
      toast.error('No employees ready for payslip generation');
      return;
    }

    generateMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Generate Payslips</h2>
              <p className="text-gray-600 mt-1">
                For {format(payPeriod, 'MMMM yyyy')}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <Icon icon={SolarIcons.closeCircle} className="w-6 h-6" />
            </button>
          </div>

          {/* Month selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Payroll Month
            </label>
            <input
              type="month"
              value={format(payPeriod, 'yyyy-MM')}
              onChange={(e) => setPayPeriod(new Date(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Status summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon={SolarIcons.checkCircle} className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">Ready</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{readyUsers.length}</p>
              <p className="text-xs text-green-600">Can generate payslips</p>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon={SolarIcons.infoCircle} className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">Issues</span>
              </div>
              <p className="text-2xl font-bold text-yellow-900">
                {users.filter(u => u.status === 'missing_salary').length}
              </p>
              <p className="text-xs text-yellow-600">Missing salary config</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon={SolarIcons.documentText} className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Existing</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {users.filter(u => u.status === 'already_generated').length}
              </p>
              <p className="text-xs text-blue-600">Already generated</p>
            </div>
          </div>

          {/* Employee list */}
          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-4">
                <Icon icon={SolarIcons.loading} className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
                <p className="text-gray-600 mt-2">Loading employee data...</p>
              </div>
            ) : (
              <>
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`p-3 rounded-lg border ${
                      user.status === 'ready' ? 'bg-green-50 border-green-200' :
                      user.status === 'missing_salary' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-600">
                          {user.employee_number} • {user.department || 'No department'}
                        </p>
                      </div>
                      <div className="text-right">
                        {user.status === 'ready' && (
                          <>
                            <p className="text-sm text-gray-600">Basic Salary</p>
                            <p className="font-medium">NAD {user.basic_salary?.toFixed(2)}</p>
                          </>
                        )}
                        {user.status === 'missing_salary' && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                            No salary configured
                          </span>
                        )}
                        {user.status === 'already_generated' && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            Already generated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Generation Results</h3>
              <div className="space-y-1">
                {results.map((result) => {
                  const user = users.find(u => u.id === result.userId);
                  return (
                    <div key={result.userId} className="flex items-center gap-2 text-sm">
                      {result.success ? (
                        <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 text-green-600" />
                      ) : (
                        <Icon icon={SolarIcons.closeCircle} className="w-4 h-4 text-red-600" />
                      )}
                      <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                        {user?.full_name}: {result.success ? 'Success' : result.error || 'Failed'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {readyUsers.length === 0 ? (
                <span className="text-red-600">No employees ready for payslip generation</span>
              ) : (
                <span>Ready to generate {readyUsers.length} payslip(s)</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={readyUsers.length === 0 || generateMutation.isPending}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
              >
                {generateMutation.isPending ? (
                  <>
                    <Icon icon={SolarIcons.loading} className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Icon icon={SolarIcons.documentText} className="w-4 h-4 mr-2" />
                    Generate Payslips
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};