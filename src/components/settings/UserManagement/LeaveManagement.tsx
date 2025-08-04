import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, differenceInDays } from 'date-fns';
import LeaveTypeModal from './LeaveTypeModal';
import CarryoverProcessingModal from './CarryoverProcessingModal';
import DateInput from '../../ui/DateInput';
import MonthInput from '../../ui/MonthInput';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_per_year: number;
  is_paid: boolean;
  color: string;
  requires_approval: boolean;
  supporting_documents_required: boolean;
  carryover_allowed: boolean;
  max_carryover_days: number;
  min_notice_days: number;
  accrual_rate?: number;
  accrual_frequency?: string;
}

interface LeaveBalance {
  id: string;
  leave_type: LeaveType;
  year: number;
  entitled_days: number;
  used_days: number;
  carried_over_days: number;
  balance_days: number;
}

interface LeaveRequest {
  id: string;
  user: {
    full_name: string;
    email: string;
    avatar?: string;
  };
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
}

interface LeaveManagementProps {
  selectedUserId?: string;
  isTeamView: boolean;
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ selectedUserId, isTeamView }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'my-leave' | 'team-leave' | 'calendar' | 'settings'>(isTeamView ? 'team-leave' : 'my-leave');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAddLeaveType, setShowAddLeaveType] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [showCarryoverModal, setShowCarryoverModal] = useState(false);
  const [leaveRequestForm, setLeaveRequestForm] = useState({
    leave_type_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
    is_half_day: false,
    half_day_period: 'morning',
    supporting_document_url: null as string | null
  });
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isManager = user?.role === 'admin' || user?.role === 'doctor';
  const currentYear = new Date().getFullYear();

  // Fetch leave types
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types', user?.practice_id],
    queryFn: async () => {
      console.log('Fetching leave types for practice:', user?.practice_id);
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Leave types query error:', error);
        throw error;
      }
      console.log('Leave types fetched:', data?.length || 0, 'records');
      return data as LeaveType[];
    },
    enabled: !!user?.practice_id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0, // Consider data immediately stale
    cacheTime: 1000 * 60 * 5, // Cache for 5 minutes
    onError: (error) => {
      console.error('Error fetching leave types:', error);
      toast.error('Failed to load leave types');
    }
  });

  // Fetch user's leave balances
  const { data: myBalances = [] } = useQuery({
    queryKey: ['my-leave-balances', selectedUserId || user?.id, currentYear],
    queryFn: async () => {
      const userId = selectedUserId || user?.id;
      const { data, error } = await supabase
        .from('leave_balances')
        .select(`
          *,
          leave_type:leave_type_id (*)
        `)
        .eq('user_id', userId)
        .eq('year', currentYear);

      if (error) throw error;
      return data as LeaveBalance[];
    },
    enabled: !!(selectedUserId || user?.id),
    onError: (error) => {
      console.error('Error fetching leave balances:', error);
      toast.error('Failed to load leave balances');
    }
  });

  // Fetch leave requests
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests', user?.practice_id, activeView, selectedUserId, isTeamView],
    queryFn: async () => {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          user:user_id (
            full_name,
            email,
            avatar,
            practice_id
          ),
          leave_type:leave_type_id (*)
        `)
        .order('created_at', { ascending: false });

      if (activeView === 'my-leave') {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by practice after fetching
      const filteredData = (data || []).filter(request => 
        request.user?.practice_id === user?.practice_id
      );
      
      return filteredData as LeaveRequest[];
    },
    enabled: !!user?.practice_id,
    onError: (error) => {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    }
  });

  // Calculate leave summary
  const leaveSummary = {
    totalEntitled: myBalances.reduce((sum, b) => sum + b.entitled_days + b.carried_over_days, 0),
    totalUsed: myBalances.reduce((sum, b) => sum + b.used_days, 0),
    totalBalance: myBalances.reduce((sum, b) => sum + b.balance_days, 0),
    pendingRequests: leaveRequests.filter(r => r.status === 'pending').length,
  };

  // Generate calendar days
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get leave requests for calendar
  const calendarLeaves = leaveRequests.filter(request => {
    if (request.status !== 'approved') return false;
    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    return start <= monthEnd && end >= monthStart;
  });

  const getLeaveStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate leave days between dates
  const calculateLeaveDays = (startDate: string, endDate: string, isHalfDay: boolean) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let days = 0;
    
    const current = new Date(start);
    while (current <= end) {
      if (!isWeekend(current)) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return isHalfDay ? days - 0.5 : days;
  };

  // Validate leave request form
  const validateLeaveRequest = (data: typeof leaveRequestForm, selectedLeaveType: LeaveType | undefined) => {
    const errors: Record<string, string> = {};

    if (!data.leave_type_id) {
      errors.leave_type_id = 'Please select a leave type';
    }

    if (!data.start_date) {
      errors.start_date = 'Please select a start date';
    }

    if (!data.end_date) {
      errors.end_date = 'Please select an end date';
    }

    if (!data.reason || data.reason.trim().length < 10) {
      errors.reason = 'Please provide a detailed reason (minimum 10 characters)';
    }

    if (data.start_date && data.end_date && new Date(data.start_date) > new Date(data.end_date)) {
      errors.end_date = 'End date must be after start date';
    }

    // Validate minimum notice days
    if (selectedLeaveType && data.start_date) {
      const startDate = new Date(data.start_date);
      const today = new Date();
      const daysDifference = differenceInDays(startDate, today);
      
      if (daysDifference < selectedLeaveType.min_notice_days) {
        errors.start_date = `This leave type requires at least ${selectedLeaveType.min_notice_days} days notice`;
      }
    }

    // Validate supporting documents
    if (selectedLeaveType && selectedLeaveType.supporting_documents_required && !data.supporting_document_url) {
      errors.supporting_document_url = 'Supporting document is required for this leave type';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle document upload
  const handleDocumentUpload = async (file: File) => {
    if (!file) return;

    setUploadingDocument(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `leave-documents/${user?.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        setLeaveRequestForm(prev => ({
          ...prev,
          supporting_document_url: urlData.publicUrl
        }));
        toast.success('Document uploaded successfully');
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  // Submit leave request mutation
  const submitLeaveRequest = useMutation({
    mutationFn: async (data: typeof leaveRequestForm) => {
      // Get selected leave type for validation and auto-approval logic
      const selectedLeaveType = leaveTypes.find(lt => lt.id === data.leave_type_id);
      
      // Validate the form
      if (!validateLeaveRequest(data, selectedLeaveType)) {
        throw new Error('Please fix the validation errors');
      }

      const days = calculateLeaveDays(data.start_date, data.end_date, data.is_half_day);
      
      // Determine initial status based on leave type requirements
      const initialStatus = selectedLeaveType?.requires_approval ? 'pending' : 'approved';
      const approvalData = selectedLeaveType?.requires_approval ? {} : {
        approver_id: user?.id,
        approved_at: new Date().toISOString(),
        approver_comments: 'Auto-approved (no approval required)'
      };

      const { data: insertedRequest, error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: selectedUserId || user?.id,
          leave_type_id: data.leave_type_id,
          start_date: data.start_date,
          end_date: data.end_date,
          days_requested: days,
          reason: data.reason,
          is_half_day: data.is_half_day,
          half_day_period: data.is_half_day ? data.half_day_period : null,
          supporting_document_url: data.supporting_document_url,
          status: initialStatus,
          ...approvalData
        })
        .select()
        .single();
      
      if (error) throw error;

      // If auto-approved, trigger leave balance update
      if (initialStatus === 'approved') {
        const { error: balanceError } = await supabase.rpc('update_leave_balance', {
          p_user_id: selectedUserId || user?.id,
          p_leave_type_id: data.leave_type_id,
          p_days_used: days,
          p_operation: 'approve'
        });

        if (balanceError) {
          console.error('Error updating leave balance:', balanceError);
          // Don't throw error as the request was still created successfully
        }
      }

      return { ...insertedRequest, initialStatus };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
      
      const message = result?.initialStatus === 'approved' 
        ? 'Leave request auto-approved successfully!' 
        : 'Leave request submitted successfully!';
      
      toast.success(message);
      setShowRequestForm(false);
      setLeaveRequestForm({
        leave_type_id: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd'),
        reason: '',
        is_half_day: false,
        half_day_period: 'morning',
        supporting_document_url: null
      });
      setValidationErrors({});
    },
    onError: (error: any) => {
      console.error('Error submitting leave request:', error);
      toast.error(error.message || 'Failed to submit leave request');
    }
  });

  // Delete leave type mutation
  const deleteLeaveType = useMutation({
    mutationFn: async (leaveTypeId: string) => {
      // First check if there are any leave requests or balances using this type
      const { data: requests } = await supabase
        .from('leave_requests')
        .select('id')
        .eq('leave_type_id', leaveTypeId)
        .limit(1);
      
      if (requests && requests.length > 0) {
        throw new Error('Cannot delete leave type with existing leave requests');
      }
      
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('leave_types')
        .update({ is_active: false })
        .eq('id', leaveTypeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      toast.success('Leave type deactivated successfully');
    },
    onError: (error: any) => {
      console.error('Error deleting leave type:', error);
      toast.error(error.message || 'Failed to delete leave type');
    }
  });

  // Approve/Reject leave request mutations
  const updateLeaveStatus = useMutation({
    mutationFn: async ({ requestId, status, comments }: { requestId: string; status: 'approved' | 'rejected'; comments?: string }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          approver_id: user?.id,
          approved_at: new Date().toISOString(),
          approver_comments: comments
        })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
      toast.success(`Leave request ${variables.status}`);
    },
    onError: (error: any) => {
      console.error('Error updating leave status:', error);
      toast.error(error.message || 'Failed to update leave request');
    }
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100/30 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Leave Days</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {leaveSummary.totalEntitled}
                </p>
                <p className="text-xs text-blue-600 mt-1">For {currentYear}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Icon icon={SolarIcons.calendar} className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100/30 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Days Available</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {leaveSummary.totalBalance}
                </p>
                <p className="text-xs text-green-600 mt-1">Can be used</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Icon icon={SolarIcons.checkCircle} className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100/30 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Days Used</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {leaveSummary.totalUsed}
                </p>
                <p className="text-xs text-orange-600 mt-1">This year</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Icon icon={SolarIcons.plane} className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100/30 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Pending Requests</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {leaveSummary.pendingRequests}
                </p>
                <p className="text-xs text-purple-600 mt-1">Awaiting approval</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Icon icon={SolarIcons.clock} className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveView('my-leave')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'my-leave'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={SolarIcons.user} className="w-4 h-4" />
              My Leave
            </button>
            {isManager && (
              <button
                onClick={() => setActiveView('team-leave')}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeView === 'team-leave'
                    ? 'text-purple-600 border-purple-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon icon={SolarIcons.users} className="w-4 h-4" />
                Team Leave
              </button>
            )}
            <button
              onClick={() => setActiveView('calendar')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'calendar'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon icon={SolarIcons.calendar} className="w-4 h-4" />
              Leave Calendar
            </button>
            {isManager && (
              <button
                onClick={() => setActiveView('settings')}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeView === 'settings'
                    ? 'text-purple-600 border-purple-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon icon={SolarIcons.settings} className="w-4 h-4" />
                Leave Settings
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {activeView === 'my-leave' && (
        <div className="space-y-6">
          {/* Leave Balances */}
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My Leave Balances</CardTitle>
                <Button
                  onClick={() => setShowRequestForm(true)}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                  Request Leave
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myBalances.map((balance) => (
                  <div
                    key={balance.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: balance.leave_type?.color || '#6B7280' }}
                        />
                        <h4 className="font-semibold text-gray-900">
                          {balance.leave_type?.name || 'Unknown Leave Type'}
                        </h4>
                      </div>
                      {balance.leave_type?.is_paid && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          Paid
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Entitled:</span>
                        <span className="font-medium">{balance.entitled_days} days</span>
                      </div>
                      {balance.carried_over_days > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Carried Over:</span>
                          <span className="font-medium">{balance.carried_over_days} days</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Used:</span>
                        <span className="font-medium text-orange-600">{balance.used_days} days</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between">
                          <span className="text-gray-900 font-medium">Balance:</span>
                          <span className="font-bold text-green-600">{balance.balance_days} days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* My Leave Requests */}
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>My Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.filter((r: any) => r.user_id === user?.id).map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: request.leave_type?.color || '#6B7280' }}
                          />
                          <h4 className="font-semibold text-gray-900">
                            {request.leave_type?.name || 'Unknown Leave Type'}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLeaveStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon icon={SolarIcons.calendar} className="w-4 h-4" />
                            <span>
                              {format(new Date(request.start_date), 'dd MMM yyyy')} - 
                              {format(new Date(request.end_date), 'dd MMM yyyy')}
                            </span>
                            <span className="text-gray-900 font-medium">
                              ({request.days_requested} days)
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Icon icon={SolarIcons.messageText} className="w-4 h-4 mt-0.5" />
                            <span>{request.reason}</span>
                          </div>
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <Button variant="ghost" size="sm">
                          <Icon icon={SolarIcons.closeCircle} className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {leaveRequests.filter(r => r.user_id === user?.id).length === 0 && (
                  <div className="text-center py-8">
                    <Icon icon={SolarIcons.document} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No leave requests yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowRequestForm(true)}
                    >
                      Request Your First Leave
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === 'team-leave' && isManager && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Team Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaveRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-start gap-4">
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                      {request.user.avatar ? (
                        <img
                          src={request.user.avatar}
                          alt={request.user.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                          <Icon icon={SolarIcons.user} className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Request Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{request.user.full_name}</h4>
                          <p className="text-sm text-gray-600">{request.user.email}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLeaveStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </div>

                      {request.leave_type && (
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: request.leave_type.color || '#6B7280' }}
                          />
                          <span className="font-medium text-gray-900">{request.leave_type.name}</span>
                        </div>
                      )}

                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon icon={SolarIcons.calendar} className="w-4 h-4" />
                          <span>
                            {format(new Date(request.start_date), 'dd MMM yyyy')} - 
                            {format(new Date(request.end_date), 'dd MMM yyyy')}
                          </span>
                          <span className="text-gray-900 font-medium">
                            ({request.days_requested} days)
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Icon icon={SolarIcons.messageText} className="w-4 h-4 mt-0.5" />
                          <span>{request.reason}</span>
                        </div>
                      </div>

                      {/* Actions for pending requests */}
                      {request.status === 'pending' && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => updateLeaveStatus.mutate({ requestId: request.id, status: 'approved' })}
                            disabled={updateLeaveStatus.isPending}
                          >
                            <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-gray-50"
                            onClick={() => updateLeaveStatus.mutate({ requestId: request.id, status: 'rejected' })}
                            disabled={updateLeaveStatus.isPending}
                          >
                            <Icon icon={SolarIcons.closeCircle} className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {leaveRequests.length === 0 && (
                <div className="text-center py-8">
                  <Icon icon={SolarIcons.checkCircle} className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">No pending leave requests</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'calendar' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Leave Calendar - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
              <MonthInput
                value={format(selectedMonth, 'yyyy-MM')}
                onChange={(value) => setSelectedMonth(new Date(value + '-01'))}
                placeholder="Select month"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {/* Weekday headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {calendarDays.map((day) => {
                const dayLeaves = calendarLeaves.filter(leave => {
                  const start = new Date(leave.start_date);
                  const end = new Date(leave.end_date);
                  return day >= start && day <= end;
                });

                const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const isWeekendDay = isWeekend(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`bg-white p-2 min-h-[100px] ${
                      isWeekendDay ? 'bg-gray-50' : ''
                    } ${isToday ? 'ring-2 ring-purple-500' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isWeekendDay ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayLeaves.slice(0, 3).map((leave, idx) => (
                        <div
                          key={`${leave.id}-${idx}`}
                          className="text-xs p-1 rounded truncate"
                          style={{
                            backgroundColor: (leave.leave_type?.color || '#6B7280') + '20',
                            color: leave.leave_type?.color || '#6B7280'
                          }}
                        >
                          {leave.user.full_name.split(' ')[0]}
                        </div>
                      ))}
                      {dayLeaves.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayLeaves.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'settings' && isManager && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Leave Type Configuration</CardTitle>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowCarryoverModal(true)}
                  variant="outline"
                  className="border-orange-300 text-orange-600 hover:bg-orange-50"
                >
                  <Icon icon={SolarIcons.refresh} className="w-4 h-4 mr-2" />
                  Process Year-End Carryover
                </Button>
                <Button 
                  onClick={() => setShowAddLeaveType(true)}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                  Add Leave Type
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leaveTypes.map((type) => (
                <div
                  key={type.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 hover:shadow-md"
                  onClick={() => setEditingLeaveType(type)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: type.color }}
                      />
                      <h4 className="font-semibold text-gray-900">{type.name}</h4>
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                        {type.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button 
                        variant="ghost" 
                        size="md"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLeaveType(type);
                        }}
                        className="hover:bg-blue-100 hover:text-blue-600 transition-colors"
                      >
                        <Icon icon={SolarIcons.edit} className="w-5 h-5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="md"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to deactivate the "${type.name}" leave type?`)) {
                            deleteLeaveType.mutate(type.id);
                          }
                        }}
                        className="hover:bg-red-100 hover:text-red-600 transition-colors"
                      >
                        <Icon icon={SolarIcons.trash} className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Days per year:</span>
                      <span className="font-medium">{type.days_per_year}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {type.is_paid && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Icon icon={SolarIcons.checkCircle} className="w-4 h-4" />
                          Paid
                        </span>
                      )}
                      {type.requires_approval && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Icon icon={SolarIcons.userCheck} className="w-4 h-4" />
                          Requires Approval
                        </span>
                      )}
                    </div>
                    {type.min_notice_days > 0 && (
                      <div className="text-gray-600">
                        Min. {type.min_notice_days} days notice required
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leave Request Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Leave</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type *
                  </label>
                  <select
                    value={leaveRequestForm.leave_type_id}
                    onChange={(e) => {
                      setLeaveRequestForm({ ...leaveRequestForm, leave_type_id: e.target.value });
                      // Clear validation errors when selection changes
                      if (validationErrors.leave_type_id) {
                        setValidationErrors(prev => ({ ...prev, leave_type_id: '' }));
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                      validationErrors.leave_type_id ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select leave type</option>
                    {leaveTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.days_per_year} days/year)
                        {!type.is_paid && ' - Unpaid'}
                        {type.requires_approval ? ' - Requires Approval' : ' - Auto-Approved'}
                      </option>
                    ))}
                  </select>
                  {validationErrors.leave_type_id && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.leave_type_id}</p>
                  )}
                  
                  {/* Display leave type requirements */}
                  {leaveRequestForm.leave_type_id && (() => {
                    const selectedType = leaveTypes.find(lt => lt.id === leaveRequestForm.leave_type_id);
                    return selectedType && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-700">
                          <div className="font-medium mb-1">Leave Type Requirements:</div>
                          <ul className="space-y-1 text-xs">
                            <li className="flex items-center gap-1">
                              <Icon icon={SolarIcons.clock} className="w-3 h-3" />
                              Minimum notice: {selectedType.min_notice_days} days
                            </li>
                            {selectedType.supporting_documents_required && (
                              <li className="flex items-center gap-1">
                                <Icon icon={SolarIcons.documentText} className="w-3 h-3" />
                                Supporting document required
                              </li>
                            )}
                            {!selectedType.requires_approval && (
                              <li className="flex items-center gap-1">
                                <Icon icon={SolarIcons.checkCircle} className="w-3 h-3" />
                                Auto-approved (no manager approval needed)
                              </li>
                            )}
                            {!selectedType.is_paid && (
                              <li className="flex items-center gap-1">
                                <Icon icon={SolarIcons.warning} className="w-3 h-3" />
                                Unpaid leave (will not receive salary)
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <DateInput
                      label="Start Date"
                      value={leaveRequestForm.start_date}
                      onChange={(value) => setLeaveRequestForm({ ...leaveRequestForm, start_date: value })}
                      minDate={format(new Date(), 'yyyy-MM-dd')}
                      required
                      placeholder="Select start date"
                      className={validationErrors.start_date ? 'error' : ''}
                    />
                    {validationErrors.start_date && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.start_date}</p>
                    )}
                  </div>
                  
                  <div>
                    <DateInput
                      label="End Date"
                      value={leaveRequestForm.end_date}
                      onChange={(value) => setLeaveRequestForm({ ...leaveRequestForm, end_date: value })}
                      minDate={leaveRequestForm.start_date}
                      required
                      placeholder="Select end date"
                      className={validationErrors.end_date ? 'error' : ''}
                    />
                    {validationErrors.end_date && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.end_date}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={leaveRequestForm.is_half_day}
                      onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, is_half_day: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Half day leave</span>
                  </label>
                  
                  {leaveRequestForm.is_half_day && (
                    <div className="mt-2 ml-6">
                      <select
                        value={leaveRequestForm.half_day_period}
                        onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, half_day_period: e.target.value as any })}
                        className="px-3 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Leave *
                  </label>
                  <textarea
                    value={leaveRequestForm.reason}
                    onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, reason: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                      validationErrors.reason ? 'border-red-500' : 'border-gray-300'
                    }`}
                    rows={3}
                    placeholder="Please provide a detailed reason for your leave request (minimum 10 characters)"
                  />
                  {validationErrors.reason && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.reason}</p>
                  )}
                </div>

                {/* Supporting Document Upload */}
                {leaveRequestForm.leave_type_id && leaveTypes.find(lt => lt.id === leaveRequestForm.leave_type_id)?.supporting_documents_required && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supporting Document *
                      <span className="text-xs text-gray-500 ml-2">
                        (Medical certificate, proof, etc.)
                      </span>
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                      {!leaveRequestForm.supporting_document_url ? (
                        <label className="cursor-pointer block">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleDocumentUpload(file);
                              }
                            }}
                            className="hidden"
                          />
                          <div className="text-center">
                            <Icon 
                              icon={uploadingDocument ? SolarIcons.loading : SolarIcons.upload} 
                              className={`w-8 h-8 mx-auto text-gray-400 mb-2 ${uploadingDocument ? 'animate-spin' : ''}`} 
                            />
                            <p className="text-sm text-gray-600">
                              {uploadingDocument ? 'Uploading...' : 'Click to upload supporting document'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              PDF, JPG, PNG, Word documents (max 10MB)
                            </p>
                          </div>
                        </label>
                      ) : (
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Icon icon={SolarIcons.documentText} className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-green-800">Document uploaded successfully</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setLeaveRequestForm(prev => ({ ...prev, supporting_document_url: null }))}
                          >
                            <Icon icon={SolarIcons.trash} className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {validationErrors.supporting_document_url && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.supporting_document_url}</p>
                    )}
                  </div>
                )}

                {/* Display calculated days */}
                {leaveRequestForm.start_date && leaveRequestForm.end_date && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">
                      Total days requested: {' '}
                      <span className="font-semibold">
                        {calculateLeaveDays(leaveRequestForm.start_date, leaveRequestForm.end_date, leaveRequestForm.is_half_day)} days
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-6">
                <Button
                  onClick={() => submitLeaveRequest.mutate(leaveRequestForm)}
                  disabled={!leaveRequestForm.leave_type_id || !leaveRequestForm.reason || submitLeaveRequest.isPending}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  {submitLeaveRequest.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRequestForm(false);
                    setLeaveRequestForm({
                      leave_type_id: '',
                      start_date: format(new Date(), 'yyyy-MM-dd'),
                      end_date: format(new Date(), 'yyyy-MM-dd'),
                      reason: '',
                      is_half_day: false,
                      half_day_period: 'morning',
                      supporting_document_url: null
                    });
                    setValidationErrors({});
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Leave Type Modal */}
      {(showAddLeaveType || editingLeaveType) && (
        <LeaveTypeModal
          isOpen={showAddLeaveType || !!editingLeaveType}
          onClose={() => {
            setShowAddLeaveType(false);
            setEditingLeaveType(null);
          }}
          onSuccess={async () => {
            console.log('Leave type modal onSuccess called, invalidating queries...');
            
            // Invalidate and refetch queries
            await queryClient.invalidateQueries({ queryKey: ['leave-types', user?.practice_id] });
            await queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
            await queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
            
            // Force a refetch of the leave types
            await queryClient.refetchQueries({ queryKey: ['leave-types', user?.practice_id] });
            
            console.log('Queries refreshed, closing modal...');
            
            // Small delay to ensure the UI has updated before closing
            setTimeout(() => {
              setShowAddLeaveType(false);
              setEditingLeaveType(null);
            }, 100);
          }}
          existingLeaveType={editingLeaveType}
        />
      )}

      {/* Year-End Carryover Processing Modal */}
      <CarryoverProcessingModal
        isOpen={showCarryoverModal}
        onClose={() => setShowCarryoverModal(false)}
      />
    </div>
  );
};