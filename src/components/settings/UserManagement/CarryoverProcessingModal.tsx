import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { PayrollService } from '../../../services/payrollService';

interface CarryoverProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CarryoverResult {
  userId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  fromYear: number;
  toYear: number;
  remainingBalance: number;
  maxAllowed: number;
  carriedOver: number;
  action: 'created' | 'updated';
}

interface CarryoverError {
  userId: string;
  leaveTypeId: string;
  error: string;
}

export const CarryoverProcessingModal: React.FC<CarryoverProcessingModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedFromYear, setSelectedFromYear] = useState(new Date().getFullYear() - 1);
  const [selectedToYear, setSelectedToYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<CarryoverResult[]>([]);
  const [errors, setErrors] = useState<CarryoverError[]>([]);

  // Get available years (last 3 years and next year)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Fetch practice statistics
  const { data: practiceStats, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['practice-carryover-stats', user?.practice_id, selectedFromYear],
    queryFn: async () => {
      if (!user?.practice_id) return null;

      // Get total users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('practice_id', user.practice_id)
        .eq('is_active', true);

      if (usersError) throw usersError;

      // Get leave types that allow carryover
      const { data: leaveTypes, error: leaveTypesError } = await supabase
        .from('leave_types')
        .select('*')
        .eq('practice_id', user.practice_id)
        .eq('is_active', true)
        .eq('carryover_allowed', true);

      if (leaveTypesError) throw leaveTypesError;

      // Get existing balances for the from year
      const { data: existingBalances, error: balancesError } = await supabase
        .from('leave_balances')
        .select('*, leave_type:leave_types!inner(name), user:users!inner(full_name)')
        .eq('year', selectedFromYear)
        .in('leave_type_id', leaveTypes.map(lt => lt.id))
        .gt('entitled_days', 0); // Only consider users with entitlements

      if (balancesError) throw balancesError;

      // Calculate users with unused leave
      const usersWithUnusedLeave = existingBalances?.filter(balance => {
        const remaining = parseFloat(balance.entitled_days) - parseFloat(balance.used_days);
        return remaining > 0;
      }) || [];

      return {
        totalUsers: users?.length || 0,
        carryoverEligibleLeaveTypes: leaveTypes?.length || 0,
        usersWithUnusedLeave: usersWithUnusedLeave.length,
        totalUnusedDays: usersWithUnusedLeave.reduce((sum, balance) => {
          const remaining = parseFloat(balance.entitled_days) - parseFloat(balance.used_days);
          return sum + remaining;
        }, 0),
        userDetails: users || [],
        leaveTypeDetails: leaveTypes || [],
        unusedLeaveDetails: usersWithUnusedLeave
      };
    },
    enabled: !!user?.practice_id && isOpen
  });

  // Process carryover mutation
  const processCarryoverMutation = useMutation({
    mutationFn: async () => {
      if (!user?.practice_id) throw new Error('No practice found');
      
      const result = await PayrollService.validateAndProcessCarryover(
        user.practice_id,
        selectedFromYear,
        selectedToYear
      );
      
      return result;
    },
    onSuccess: (data) => {
      setResults(data.results || []);
      setErrors(data.errors || []);
      setShowResults(true);
      toast.success(`Carryover processing completed! ${data.results?.length || 0} records processed.`);
      
      // Refresh any related queries
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['practice-carryover-stats'] });
    },
    onError: (error: any) => {
      console.error('Carryover processing error:', error);
      toast.error(error.message || 'Failed to process carryover');
    },
    onSettled: () => {
      setProcessing(false);
    }
  });

  const handleProcessCarryover = async () => {
    setProcessing(true);
    setShowResults(false);
    processCarryoverMutation.mutate();
  };

  const handleClose = () => {
    setShowResults(false);
    setResults([]);
    setErrors([]);
    onClose();
  };

  // Show people and leave types by name rather than raw database ids
  const staffName = (userId: string) =>
    practiceStats?.userDetails.find(member => member.id === userId)?.full_name ?? 'Former staff member';
  const leaveTypeName = (leaveTypeId: string) =>
    practiceStats?.leaveTypeDetails.find(type => type.id === leaveTypeId)?.name ?? 'Leave type';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-indigo-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Icon icon="solar:calendar-add-bold-duotone" className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Year-End Leave Carryover Processing</h2>
                  <p className="text-purple-100 text-sm">Process leave balance carryover from one year to the next</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {!showResults ? (
              <div className="space-y-6">
                {/* Configuration Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:settings-bold-duotone" className="w-5 h-5 text-purple-600" />
                      Processing Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          From Year (Source)
                        </label>
                        <select
                          value={selectedFromYear}
                          onChange={(e) => {
                            const fromYear = parseInt(e.target.value);
                            setSelectedFromYear(fromYear);
                            // Keep the target year after the source year
                            if (selectedToYear <= fromYear) setSelectedToYear(fromYear + 1);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          To Year (Target)
                        </label>
                        <select
                          value={selectedToYear}
                          onChange={(e) => setSelectedToYear(parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          {availableYears.filter(year => year > selectedFromYear).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Statistics Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon icon="solar:chart-square-bold-duotone" className="w-5 h-5 text-blue-600" />
                      Practice Statistics ({selectedFromYear})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {practiceStats ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{practiceStats.totalUsers}</div>
                          <div className="text-sm text-blue-600">Total Active Users</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{practiceStats.carryoverEligibleLeaveTypes}</div>
                          <div className="text-sm text-purple-600">Carryover-Eligible Leave Types</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{practiceStats.usersWithUnusedLeave}</div>
                          <div className="text-sm text-green-600">Users with Unused Leave</div>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-amber-600">{practiceStats.totalUnusedDays.toFixed(1)}</div>
                          <div className="text-sm text-amber-600">Total Unused Days</div>
                        </div>
                      </div>
                    ) : statsError ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <span>Practice leave statistics could not be loaded.</span>
                        <Button size="sm" variant="outline" onClick={() => refetchStats()}>Try again</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Warning Section */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:danger-triangle-bold-duotone" className="w-6 h-6 text-amber-600 mt-1" />
                    <div>
                      <h3 className="font-semibold text-amber-800">Important Notes</h3>
                      <ul className="text-sm text-amber-700 mt-2 space-y-1">
                        <li>• This process will create or update leave balances for {selectedToYear}</li>
                        <li>• Only leave types with "carryover allowed" will be processed</li>
                        <li>• Maximum carryover limits will be respected</li>
                        <li>• Existing balances for {selectedToYear} will be updated with carryover amounts</li>
                        <li>• This operation cannot be easily undone - please verify your settings</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Action Section */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={processing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleProcessCarryover}
                    disabled={processing || !practiceStats || practiceStats.usersWithUnusedLeave === 0}
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                  >
                    {processing ? (
                      <>
                        <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:play-bold-duotone" className="w-5 h-5 mr-2" />
                        Process Carryover
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* Results Section */
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <Icon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Carryover Processing Complete</h3>
                  <p className="text-gray-600">
                    Processed carryover from {selectedFromYear} to {selectedToYear}
                  </p>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{results.length}</div>
                    <div className="text-sm text-green-600">Successful Carryovers</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">{errors.length}</div>
                    <div className="text-sm text-red-600">Errors</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {results.reduce((sum, r) => sum + r.carriedOver, 0).toFixed(1)}
                    </div>
                    <div className="text-sm text-blue-600">Total Days Carried Over</div>
                  </div>
                </div>

                {/* Successful Results */}
                {results.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-600">
                        <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />
                        Successful Carryovers ({results.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-60 overflow-y-auto">
                        <div className="space-y-2">
                          {results.map((result, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                              <div>
                                <div className="font-medium text-green-800">{staffName(result.userId)}</div>
                                <div className="text-sm text-green-600">
                                  {result.leaveTypeName} • balance {result.action}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-700">{result.carriedOver} days</div>
                                <div className="text-xs text-green-600">
                                  {result.remainingBalance} remaining → {result.maxAllowed} max allowed
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Errors */}
                {errors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-600">
                        <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5" />
                        Errors ({errors.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-60 overflow-y-auto">
                        <div className="space-y-2">
                          {errors.map((error, index) => (
                            <div key={index} className="p-3 bg-red-50 rounded-lg">
                              <div className="font-medium text-red-800">{staffName(error.userId)}</div>
                              <div className="text-sm text-red-600">{leaveTypeName(error.leaveTypeId)}</div>
                              <div className="text-sm text-red-700 mt-1">{error.error}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Section */}
                <div className="flex justify-end gap-3">
                  <Button
                    onClick={() => setShowResults(false)}
                    variant="outline"
                  >
                    Process Another Year
                  </Button>
                  <Button
                    onClick={handleClose}
                    className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CarryoverProcessingModal;