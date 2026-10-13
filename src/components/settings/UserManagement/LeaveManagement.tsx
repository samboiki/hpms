import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import Icon, { SolarIcons } from '../../ui/Icon';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import { RECORDS_BUCKET, openRecord, recordPath } from '../../../services/recordFiles';
import toast from 'react-hot-toast';
import { format, isWeekend } from 'date-fns';
import LeaveTypeModal from './LeaveTypeModal';
import CarryoverProcessingModal from './CarryoverProcessingModal';
import DateInput from '../../ui/DateInput';
import MonthInput from '../../ui/MonthInput';
import { ConfirmDialog } from './ConfirmDialog';
import {
  countLeaveDays,
  daysOfNotice,
  describeDbError,
  ensureRowsUpdated,
  getMonthGridCells,
  isDayWithinRange,
  isStaffAdmin,
  parseDateOnly,
  parseMonthValue
} from './staffUtils';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';

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
  user_id: string;
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
  approver_comments?: string | null;
  /** Path of the document attached to the request (a medical certificate), opened with a short-lived link */
  supporting_document_url?: string | null;
  created_at: string;
}

/** Opens the document attached to a leave request; says so when the link cannot be made */
const LeaveDocumentLink: React.FC<{ path: string }> = ({ path }) => (
  <div className="flex items-center gap-2">
    <Icon icon={SolarIcons.document} className="w-4 h-4" />
    <button
      type="button"
      className="font-medium text-purple-600 hover:underline"
      onClick={() => {
        openRecord(path).catch(() => toast.error('The supporting document could not be opened. Please try again.'));
      }}
    >
      Open the supporting document
    </button>
  </div>
);

type LeaveView = 'my-leave' | 'team-leave' | 'calendar' | 'settings';
type LeaveAction =
  | { type: 'approve' | 'reject' | 'cancel'; request: LeaveRequest }
  | { type: 'deactivate-type'; leaveType: LeaveType };

interface LeaveManagementProps {
  selectedUserId?: string;
  isTeamView: boolean;
  /** Practice resolved by the parent (falls back to the signed-in user's practice). */
  practiceId?: string | null;
  initialView?: 'calendar';
}

const emptyLeaveRequestForm = () => ({
  leave_type_id: '',
  start_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: format(new Date(), 'yyyy-MM-dd'),
  reason: '',
  is_half_day: false,
  half_day_period: 'morning',
  supporting_document_url: null as string | null
});

const formatRange = (start: string, end: string) =>
  `${format(parseDateOnly(start), 'dd MMM yyyy')} - ${format(parseDateOnly(end), 'dd MMM yyyy')}`;

export const LeaveManagement: React.FC<LeaveManagementProps> = ({
  selectedUserId,
  isTeamView,
  practiceId: practiceIdProp,
  initialView
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const practiceId = practiceIdProp || user?.practice_id;
  // Approvals and leave settings are administrator actions; everyone can manage their own leave
  const isManager = isStaffAdmin(user);
  // The person whose balances/requests the "my leave" view shows (a selected staff member, or me)
  const targetUserId = selectedUserId || user?.id;
  const isViewingOtherStaff = !!selectedUserId && selectedUserId !== user?.id;

  const [activeView, setActiveView] = useState<LeaveView>(
    initialView ?? (isTeamView && isManager ? 'team-leave' : 'my-leave')
  );
  const [teamFilter, setTeamFilter] = useState<'pending' | 'all'>('pending');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAddLeaveType, setShowAddLeaveType] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [showCarryoverModal, setShowCarryoverModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<LeaveAction | null>(null);
  const [leaveRequestForm, setLeaveRequestForm] = useState(emptyLeaveRequestForm);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const currentYear = new Date().getFullYear();

  // Fetch leave types
  const {
    data: leaveTypes = [],
    isError: leaveTypesError,
    refetch: refetchLeaveTypes
  } = useQuery({
    queryKey: ['leave-types', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as LeaveType[];
    },
    enabled: !!practiceId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Fetch the target user's leave balances
  const {
    data: myBalances = [],
    isLoading: isLoadingBalances,
    isError: balancesError,
    refetch: refetchBalances
  } = useQuery({
    queryKey: ['my-leave-balances', targetUserId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_balances')
        .select(`
          *,
          leave_type:leave_type_id (*)
        `)
        .eq('user_id', targetUserId)
        .eq('year', currentYear);

      if (error) throw error;
      return data as LeaveBalance[];
    },
    enabled: !!targetUserId
  });

  // Fetch leave requests, scoped to this practice on the server
  const requestsScope = activeView === 'my-leave' ? targetUserId : 'team';
  const {
    data: leaveRequests = [],
    isLoading: isLoadingRequests,
    isError: requestsError,
    refetch: refetchRequests
  } = useQuery({
    queryKey: ['leave-requests', practiceId, requestsScope],
    queryFn: async () => {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          user:user_id!inner (
            full_name,
            email,
            avatar,
            practice_id
          ),
          leave_type:leave_type_id (*)
        `)
        .eq('user.practice_id', practiceId)
        .order('created_at', { ascending: false });

      if (activeView === 'my-leave') {
        query = query.eq('user_id', targetUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as LeaveRequest[];
    },
    enabled: !!practiceId && !!targetUserId
  });

  const hasLoadError = leaveTypesError || balancesError || requestsError;

  // Calculate leave summary
  const leaveSummary = {
    totalEntitled: myBalances.reduce((sum, b) => sum + Number(b.entitled_days) + Number(b.carried_over_days || 0), 0),
    totalUsed: myBalances.reduce((sum, b) => sum + Number(b.used_days || 0), 0),
    totalBalance: myBalances.reduce((sum, b) => sum + Number(b.balance_days || 0), 0),
    pendingRequests: leaveRequests.filter(r => r.status === 'pending').length,
  };

  // Calendar cells (leading blanks keep each date under its weekday header)
  const calendarCells = getMonthGridCells(selectedMonth);
  const monthStartKey = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1), 'yyyy-MM-dd');
  const monthEndKey = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

  // Approved leave overlapping the selected month
  const calendarLeaves = leaveRequests.filter(request =>
    request.status === 'approved' && request.start_date <= monthEndKey && request.end_date >= monthStartKey
  );

  const teamRequests = [...leaveRequests]
    .filter(request => teamFilter === 'all' || request.status === 'pending')
    .sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return b.start_date.localeCompare(a.start_date);
    });
  const teamPendingCount = leaveRequests.filter(r => r.status === 'pending').length;

  const getLeaveStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

    if (data.start_date && data.end_date && data.start_date > data.end_date) {
      errors.end_date = 'End date must be on or after the start date';
    }

    if (data.start_date && data.end_date && countLeaveDays(data.start_date, data.end_date, data.is_half_day) <= 0) {
      errors.end_date = 'The selected dates contain no working days';
    }

    // Validate minimum notice days
    if (selectedLeaveType && data.start_date && !errors.start_date) {
      const minNotice = selectedLeaveType.min_notice_days ?? 0;
      if (daysOfNotice(data.start_date) < minNotice) {
        errors.start_date = `This leave type requires at least ${minNotice} day${minNotice === 1 ? '' : 's'} notice`;
      }
    }
      
    // Prevent double-booking the same person
    if (data.start_date && data.end_date && !errors.start_date && !errors.end_date) {
      const overlapping = leaveRequests.find(request =>
        request.user_id === targetUserId &&
        (request.status === 'pending' || request.status === 'approved') &&
        request.start_date <= data.end_date &&
        request.end_date >= data.start_date
      );
      if (overlapping) {
        errors.start_date = `Overlaps ${overlapping.status} leave (${formatRange(overlapping.start_date, overlapping.end_date)})`;
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Document must be smaller than 10MB');
      return;
    }

    setUploadingDocument(true);
    try {
      // Generate unique filename: a staff record, so the private bucket in the practice's folder
      const fileExt = file.name.split('.').pop();
      const fileName = recordPath(practiceId, 'leave-documents', targetUserId ?? '', `${Date.now()}.${fileExt}`);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(RECORDS_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // The request keeps the path, never a link: a short-lived link is made when the document is opened
      setLeaveRequestForm(prev => ({
        ...prev,
        supporting_document_url: fileName
      }));
      setValidationErrors(prev => ({ ...prev, supporting_document_url: '' }));
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const invalidateLeaveData = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
    queryClient.invalidateQueries({ queryKey: ['team-stats'] });
    queryClient.invalidateQueries({ queryKey: ['user-stats'] });
  };

  // Submit leave request mutation
  const submitLeaveRequest = useMutation({
    mutationFn: async (data: typeof leaveRequestForm) => {
      const selectedLeaveType = leaveTypes.find(lt => lt.id === data.leave_type_id);
      const days = countLeaveDays(data.start_date, data.end_date, data.is_half_day);

      const { data: insertedRequest, error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: targetUserId,
          leave_type_id: data.leave_type_id,
          start_date: data.start_date,
          end_date: data.end_date,
          days_requested: days,
          reason: data.reason.trim(),
          is_half_day: data.is_half_day,
          half_day_period: data.is_half_day ? data.half_day_period : null,
          supporting_document_url: data.supporting_document_url,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) throw error;

      let finalStatus: 'pending' | 'approved' = 'pending';
      if (selectedLeaveType && selectedLeaveType.requires_approval === false) {
        // Approve with an UPDATE so update_leave_balance_trigger deducts the days. Inserting as
        // 'approved' skipped the trigger (and the old rpc does not exist), so balances never moved.
        const { data: approvedRows, error: approveError } = await supabase
          .from('leave_requests')
          .update({
            status: 'approved',
            approver_id: user?.id,
            approved_at: new Date().toISOString(),
            approver_comments: 'Auto-approved (no approval required)'
          })
          .eq('id', insertedRequest.id)
          .select('id');

        if (!approveError && approvedRows && approvedRows.length > 0) {
          finalStatus = 'approved';
        } else {
          console.warn('Auto-approval not permitted; request left pending for a manager', approveError);
        }
      }

      return { ...insertedRequest, finalStatus };
    },
    onSuccess: (result) => {
      invalidateLeaveData();
      toast.success(
        result?.finalStatus === 'approved'
          ? 'Leave approved automatically and deducted from the balance'
          : 'Leave request submitted for approval'
      );
      setShowRequestForm(false);
      setLeaveRequestForm(emptyLeaveRequestForm());
      setValidationErrors({});
    },
    onError: (error) => {
      console.error('Error submitting leave request:', error);
      toast.error(describeDbError(error, 'Could not submit the leave request'));
    }
  });

  const handleSubmitLeaveRequest = () => {
    const selectedLeaveType = leaveTypes.find(lt => lt.id === leaveRequestForm.leave_type_id);
    if (!validateLeaveRequest(leaveRequestForm, selectedLeaveType)) {
      toast.error('Please correct the highlighted fields');
      return;
    }
    submitLeaveRequest.mutate(leaveRequestForm);
  };

  const closeRequestForm = () => {
    setShowRequestForm(false);
    setLeaveRequestForm(emptyLeaveRequestForm());
    setValidationErrors({});
  };
  // Escape closes the leave request form, as its X does
  useEscapeToClose(showRequestForm, closeRequestForm);

  // Deactivate leave type mutation (soft delete keeps history)
  const deactivateLeaveType = useMutation({
    mutationFn: async (leaveTypeId: string) => {
      const { count, error: pendingError } = await supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('leave_type_id', leaveTypeId)
        .eq('status', 'pending');
      
      if (pendingError) throw pendingError;
      if ((count ?? 0) > 0) {
        throw new Error(`Approve or reject the ${count} pending request${count === 1 ? '' : 's'} for this leave type first`);
      }
      
      const { data, error } = await supabase
        .from('leave_types')
        .update({ is_active: false })
        .eq('id', leaveTypeId)
        .select('id');
      
      if (error) throw error;
      ensureRowsUpdated(data, 'The leave type');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
      toast.success('Leave type deactivated');
      setPendingAction(null);
    },
    onError: (error) => {
      console.error('Error deactivating leave type:', error);
      toast.error(describeDbError(error, 'Could not deactivate the leave type'));
    }
  });

  // Approve / reject / cancel leave request
  const updateLeaveStatus = useMutation({
    mutationFn: async ({ requestId, status, comments }: { requestId: string; status: 'approved' | 'rejected' | 'cancelled'; comments?: string }) => {
      const updates = status === 'cancelled'
        ? { status, updated_at: new Date().toISOString() }
        : {
            status,
            approver_id: user?.id,
            approved_at: new Date().toISOString(),
            approver_comments: comments || null,
            updated_at: new Date().toISOString()
          };

      const { data, error } = await supabase
        .from('leave_requests')
        .update(updates)
        .eq('id', requestId)
        .select('id');
      
      if (error) throw error;
      ensureRowsUpdated(data, 'The leave request');
    },
    onSuccess: (_, variables) => {
      invalidateLeaveData();
      toast.success(variables.status === 'cancelled' ? 'Leave request cancelled' : `Leave request ${variables.status}`);
      setPendingAction(null);
    },
    onError: (error) => {
      console.error('Error updating leave status:', error);
      toast.error(describeDbError(error, 'Could not update the leave request'));
    }
  });

  const handleConfirmAction = (comment: string) => {
    if (!pendingAction) return;
    if (pendingAction.type === 'deactivate-type') {
      deactivateLeaveType.mutate(pendingAction.leaveType.id);
      return;
    }
    const status = pendingAction.type === 'approve' ? 'approved' : pendingAction.type === 'reject' ? 'rejected' : 'cancelled';
    updateLeaveStatus.mutate({ requestId: pendingAction.request.id, status, comments: comment });
  };

  const renderRequestSkeleton = () => (
    <div className="space-y-4" aria-busy="true">
      {[0, 1, 2].map(index => (
        <div key={index} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  );

  const selectedRequestType = leaveTypes.find(lt => lt.id === leaveRequestForm.leave_type_id);

  return (
    <div className="space-y-6">
      {hasLoadError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <Icon icon={SolarIcons.dangerCircle} className="w-5 h-5" />
            Some leave information could not be loaded.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchLeaveTypes();
              refetchBalances();
              refetchRequests();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100/30 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Leave Days</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {isLoadingBalances ? '…' : leaveSummary.totalEntitled}
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
                  {isLoadingBalances ? '…' : leaveSummary.totalBalance}
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
                  {isLoadingBalances ? '…' : leaveSummary.totalUsed}
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
                  {isLoadingRequests ? '…' : leaveSummary.pendingRequests}
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
              {isViewingOtherStaff ? 'Staff Leave' : 'My Leave'}
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
                <CardTitle>{isViewingOtherStaff ? 'Leave Balances' : 'My Leave Balances'}</CardTitle>
                <Button
                  onClick={() => setShowRequestForm(true)}
                  disabled={leaveTypes.length === 0}
                  title={leaveTypes.length === 0 ? (isManager ? 'Add a leave type in Leave Settings first' : 'Ask your practice administrator to add the leave types first') : undefined}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                  {isViewingOtherStaff ? 'Record Leave' : 'Request Leave'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBalances ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
                  {[0, 1, 2].map(index => (
                    <div key={index} className="h-32 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : myBalances.length === 0 ? (
                <div className="text-center py-6">
                  <Icon icon={SolarIcons.calendar} className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No leave balances for {currentYear} yet.</p>
                  <p className="text-sm text-gray-500 mt-1">Balances are created when a leave type is added or carry-over is processed.</p>
                </div>
              ) : (
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
              )}
            </CardContent>
          </Card>

          {/* Leave Requests for the target user */}
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>{isViewingOtherStaff ? 'Leave Requests' : 'My Leave Requests'}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRequests ? renderRequestSkeleton() : (
                <div className="space-y-4">
                  {leaveRequests.map((request) => (
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
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getLeaveStatusColor(request.status)}`}>
                              {request.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-2">
                              <Icon icon={SolarIcons.calendar} className="w-4 h-4" />
                              <span>{formatRange(request.start_date, request.end_date)}</span>
                              <span className="text-gray-900 font-medium">
                                ({request.days_requested} days)
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Icon icon={SolarIcons.messageText} className="w-4 h-4 mt-0.5" />
                              <span>{request.reason}</span>
                            </div>
                            {request.supporting_document_url && <LeaveDocumentLink path={request.supporting_document_url} />}
                            {request.approver_comments && request.status !== 'pending' && (
                              <div className="flex items-start gap-2 text-gray-500">
                                <Icon icon={SolarIcons.userCheck} className="w-4 h-4 mt-0.5" />
                                <span>Manager note: {request.approver_comments}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {request.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setPendingAction({ type: 'cancel', request })}
                          >
                            <Icon icon={SolarIcons.closeCircle} className="w-4 h-4 mr-1" />
                            Cancel request
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {leaveRequests.length === 0 && (
                    <div className="text-center py-8">
                      <Icon icon={SolarIcons.document} className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No leave requests yet</p>
                      {leaveTypes.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => setShowRequestForm(true)}
                        >
                          {isViewingOtherStaff ? 'Record leave' : 'Request your first leave'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === 'team-leave' && isManager && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Team Leave Requests</CardTitle>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {(['pending', 'all'] as const).map(filter => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTeamFilter(filter)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      teamFilter === filter ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {filter === 'pending' ? `Pending (${teamPendingCount})` : `All (${leaveRequests.length})`}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingRequests ? renderRequestSkeleton() : (
              <div className="space-y-4">
                {teamRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-start gap-4">
                      {/* User Avatar */}
                      <div className="flex-shrink-0">
                        {request.user?.avatar ? (
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
                            <h4 className="font-semibold text-gray-900">{request.user?.full_name}</h4>
                            <p className="text-sm text-gray-600">{request.user?.email}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getLeaveStatusColor(request.status)}`}>
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
                            <span>{formatRange(request.start_date, request.end_date)}</span>
                            <span className="text-gray-900 font-medium">
                              ({request.days_requested} days)
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Icon icon={SolarIcons.messageText} className="w-4 h-4 mt-0.5" />
                            <span>{request.reason}</span>
                          </div>
                          {/* The certificate or letter the person attached: the approver reads it before deciding */}
                          {request.supporting_document_url && <LeaveDocumentLink path={request.supporting_document_url} />}
                          {request.approver_comments && request.status !== 'pending' && (
                            <div className="flex items-start gap-2 text-gray-500">
                              <Icon icon={SolarIcons.userCheck} className="w-4 h-4 mt-0.5" />
                              <span>Note: {request.approver_comments}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions for pending requests */}
                        {request.status === 'pending' && (
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => setPendingAction({ type: 'approve', request })}
                              disabled={updateLeaveStatus.isPending}
                            >
                              <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-gray-50"
                              onClick={() => setPendingAction({ type: 'reject', request })}
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

                {teamRequests.length === 0 && (
                  <div className="text-center py-8">
                    <Icon icon={SolarIcons.checkCircle} className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-gray-600">
                      {teamFilter === 'pending' ? 'No leave requests are waiting for approval' : 'No leave requests yet'}
                    </p>
                  </div>
                )}
              </div>
            )}
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
                onChange={(value) => {
                  const month = parseMonthValue(value);
                  if (month) setSelectedMonth(month);
                }}
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
              {calendarCells.map((day, cellIndex) => {
                if (!day) {
                  return <div key={`blank-${cellIndex}`} className="bg-gray-50/60 min-h-[100px]" aria-hidden="true" />;
                }

                const dayLeaves = calendarLeaves.filter(leave => isDayWithinRange(day, leave.start_date, leave.end_date));
                const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const isWeekendDay = isWeekend(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`p-2 min-h-[100px] ${
                      isWeekendDay ? 'bg-gray-50' : 'bg-white'
                    } ${isToday ? 'ring-2 ring-purple-500' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isWeekendDay ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayLeaves.slice(0, 3).map((leave) => (
                        <div
                          key={leave.id}
                          className="text-xs p-1 rounded truncate"
                          title={`${leave.user?.full_name} - ${leave.leave_type?.name ?? 'Leave'}`}
                          style={{
                            backgroundColor: (leave.leave_type?.color || '#6B7280') + '20',
                            color: leave.leave_type?.color || '#6B7280'
                          }}
                        >
                          {leave.user?.full_name?.split(' ')[0]}
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
            {!isLoadingRequests && calendarLeaves.length === 0 && (
              <p className="text-sm text-gray-500 text-center mt-4">No approved leave in {format(selectedMonth, 'MMMM yyyy')}.</p>
            )}
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
            {leaveTypes.length === 0 ? (
              <div className="text-center py-8">
                <Icon icon={SolarIcons.settings} className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No leave types configured yet</p>
                <p className="text-sm text-gray-500 mt-1">Add Annual, Sick and other leave types so staff can request leave.</p>
              </div>
            ) : (
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
                          title="Edit leave type"
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
                          title="Deactivate leave type"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingAction({ type: 'deactivate-type', leaveType: type });
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Leave Request Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {isViewingOtherStaff ? 'Record Leave' : 'Request Leave'}
              </h3>
              
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
                        {type.requires_approval === false ? ' - Auto-Approved' : ' - Requires Approval'}
                      </option>
                    ))}
                  </select>
                  {validationErrors.leave_type_id && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.leave_type_id}</p>
                  )}
                  
                  {/* Display leave type requirements */}
                  {selectedRequestType && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-700">
                        <div className="font-medium mb-1">Leave Type Requirements:</div>
                        <ul className="space-y-1 text-xs">
                          <li className="flex items-center gap-1">
                            <Icon icon={SolarIcons.clock} className="w-3 h-3" />
                            Minimum notice: {selectedRequestType.min_notice_days ?? 0} days
                          </li>
                          {selectedRequestType.supporting_documents_required && (
                            <li className="flex items-center gap-1">
                              <Icon icon={SolarIcons.documentText} className="w-3 h-3" />
                              Supporting document required
                            </li>
                          )}
                          {selectedRequestType.requires_approval === false && (
                            <li className="flex items-center gap-1">
                              <Icon icon={SolarIcons.checkCircle} className="w-3 h-3" />
                              Auto-approved (no manager approval needed)
                            </li>
                          )}
                          {!selectedRequestType.is_paid && (
                            <li className="flex items-center gap-1">
                              <Icon icon="solar:danger-triangle-bold-duotone" className="w-3 h-3" />
                              Unpaid leave (deducted from salary)
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <DateInput
                      label="Start Date"
                      value={leaveRequestForm.start_date}
                      onChange={(value) => setLeaveRequestForm({ ...leaveRequestForm, start_date: value })}
                      minDate={isManager ? undefined : format(new Date(), 'yyyy-MM-dd')}
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
                        onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, half_day_period: e.target.value })}
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
                    onChange={(e) => {
                      setLeaveRequestForm({ ...leaveRequestForm, reason: e.target.value });
                      if (validationErrors.reason) setValidationErrors(prev => ({ ...prev, reason: '' }));
                    }}
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
                {selectedRequestType?.supporting_documents_required && (
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
                            disabled={uploadingDocument}
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
                              icon={uploadingDocument ? SolarIcons.loader : SolarIcons.upload}
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
                            title="Remove document"
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
                      Working days requested: {' '}
                      <span className="font-semibold">
                        {countLeaveDays(leaveRequestForm.start_date, leaveRequestForm.end_date, leaveRequestForm.is_half_day)} days
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-6">
                <Button
                  onClick={handleSubmitLeaveRequest}
                  disabled={submitLeaveRequest.isPending || uploadingDocument}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                >
                  {submitLeaveRequest.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
                <Button
                  variant="outline"
                  onClick={closeRequestForm}
                  disabled={submitLeaveRequest.isPending}
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
            await queryClient.invalidateQueries({ queryKey: ['leave-types'] });
            await queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
            setShowAddLeaveType(false);
            setEditingLeaveType(null);
          }}
          existingLeaveType={editingLeaveType}
        />
      )}

      {/* Year-End Carryover Processing Modal */}
      <CarryoverProcessingModal
        isOpen={showCarryoverModal}
        onClose={() => setShowCarryoverModal(false)}
      />

      {/* Confirmations */}
      <ConfirmDialog
        isOpen={!!pendingAction}
        tone={
          pendingAction?.type === 'approve' ? 'success'
            : pendingAction?.type === 'deactivate-type' ? 'warning'
            : 'danger'
        }
        title={
          pendingAction?.type === 'approve' ? 'Approve leave request?'
            : pendingAction?.type === 'reject' ? 'Reject leave request?'
            : pendingAction?.type === 'cancel' ? 'Cancel leave request?'
            : 'Deactivate leave type?'
        }
        message={
          pendingAction && pendingAction.type !== 'deactivate-type' ? (
            <p>
              {pendingAction.request.user?.full_name ? <strong>{pendingAction.request.user.full_name}: </strong> : null}
              {pendingAction.request.leave_type?.name ?? 'Leave'}, {formatRange(pendingAction.request.start_date, pendingAction.request.end_date)} ({pendingAction.request.days_requested} days).
              {pendingAction.type === 'approve' && ' The days will be deducted from their leave balance.'}
            </p>
          ) : pendingAction?.type === 'deactivate-type' ? (
            <p>
              <strong>{pendingAction.leaveType.name}</strong> will no longer be available for new requests. Existing balances and history are kept.
            </p>
          ) : null
        }
        confirmLabel={
          pendingAction?.type === 'approve' ? 'Approve'
            : pendingAction?.type === 'reject' ? 'Reject'
            : pendingAction?.type === 'cancel' ? 'Cancel request'
            : 'Deactivate'
        }
        commentLabel={
          pendingAction?.type === 'reject' ? 'Reason for rejection'
            : pendingAction?.type === 'approve' ? 'Note to staff member (optional)'
            : undefined
        }
        commentPlaceholder={pendingAction?.type === 'reject' ? 'e.g. Clinic is short-staffed that week' : undefined}
        commentRequired={pendingAction?.type === 'reject'}
        isLoading={updateLeaveStatus.isPending || deactivateLeaveType.isPending}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
