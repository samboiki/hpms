import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Icon } from '@iconify/react';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getDay } from 'date-fns';
import TimesheetEntryModal from './TimesheetEntryModal';
import MonthInput from '../../ui/MonthInput';

interface TimesheetEntry {
  id: string;
  timesheet_id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  break_duration?: string;
  total_hours: number;
  project_code?: string;
  task_description?: string;
  is_overtime: boolean;
  is_holiday: boolean;
}

interface Timesheet {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  user?: {
    full_name: string;
    email: string;
  };
  entries?: TimesheetEntry[];
}

interface TimesheetManagementProps {
  selectedUserId?: string;
  isTeamView: boolean;
}

export const TimesheetManagement: React.FC<TimesheetManagementProps> = ({ selectedUserId, isTeamView }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showCreateTimesheet, setShowCreateTimesheet] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(null);
  const [activeView, setActiveView] = useState<'my' | 'team'>('my');

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Fetch timesheets with enhanced debugging
  const { data: timesheets = [], isLoading, error: queryError } = useQuery<Timesheet[]>({
    queryKey: ['timesheets', user?.id, selectedUserId, selectedMonth, activeView, isTeamView],
    queryFn: async () => {
      let query = supabase
        .from('timesheets')
        .select(`
          *,
          user:users!timesheets_user_id_fkey (
            full_name,
            email
          ),
          entries:timesheet_entries (*)
        `)
        .lte('period_start', monthEnd.toISOString().split('T')[0])
        .gte('period_end', monthStart.toISOString().split('T')[0]);

      if (activeView === 'my' || !isTeamView) {
        query = query.eq('user_id', selectedUserId || user?.id);
      }

      const { data, error } = await query.order('period_start', { ascending: false });

      if (error) throw error;
      return data as Timesheet[];
    },
    enabled: !!user?.id
  });

  // Create timesheet mutation
  const createTimesheetMutation = useMutation({
    mutationFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      
      // Check if timesheet already exists for this user and period
      const { data: existingTimesheet } = await supabase
        .from('timesheets')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('period_start', monthStart.toISOString().split('T')[0])
        .eq('period_end', monthEnd.toISOString().split('T')[0])
        .single();

      if (existingTimesheet) {
        throw new Error('Timesheet already exists for this period');
      }

      const { data, error } = await supabase
        .from('timesheets')
        .insert({
          user_id: targetUserId,
          period_start: monthStart.toISOString().split('T')[0],
          period_end: monthEnd.toISOString().split('T')[0],
          total_hours: 0,
          regular_hours: 0,
          overtime_hours: 0,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet created successfully');
      setShowCreateTimesheet(false);
    },
    onError: (error: any) => {
      console.error('Error creating timesheet:', error);
      if (error.message.includes('duplicate key value violates unique constraint') || 
          error.message.includes('already exists')) {
        toast.error('A timesheet already exists for this period');
      } else {
        toast.error(error.message || 'Failed to create timesheet');
      }
    }
  });

  // Submit timesheet mutation
  const submitTimesheetMutation = useMutation({
    mutationFn: async (timesheetId: string) => {
      const { error } = await supabase
        .from('timesheets')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', timesheetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet submitted for approval');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit timesheet');
    }
  });

  // Approve/Reject timesheet mutation
  const updateTimesheetStatusMutation = useMutation({
    mutationFn: async ({ timesheetId, status, comments }: { timesheetId: string; status: 'approved' | 'rejected'; comments?: string }) => {
      const { error } = await supabase
        .from('timesheets')
        .update({ 
          status, 
          approver_id: user?.id,
          approved_at: new Date().toISOString(),
          approver_comments: comments
        })
        .eq('id', timesheetId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(`Timesheet ${variables.status}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update timesheet');
    }
  });

  const handleEditEntry = (timesheet: Timesheet, date: string) => {
    const entry = timesheet.entries?.find(e => e.date === date);
    setSelectedTimesheet(timesheet);
    setSelectedDate(date);
    setSelectedEntry(entry || null);
    setShowEntryModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateMonthlyStats = () => {
    const myTimesheets = timesheets.filter(t => t.user_id === (selectedUserId || user?.id));
    const totalHours = myTimesheets.reduce((sum, t) => sum + (t.total_hours || 0), 0);
    const regularHours = myTimesheets.reduce((sum, t) => sum + (t.regular_hours || 0), 0);
    const overtimeHours = myTimesheets.reduce((sum, t) => sum + (t.overtime_hours || 0), 0);
    
    return { totalHours, regularHours, overtimeHours };
  };

  const stats = calculateMonthlyStats();

  const renderModernTimesheetView = (timesheet: Timesheet) => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const entriesMap = new Map(timesheet.entries?.map(e => [e.date, e]) || []);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Daily Time Entries</h3>
              <p className="text-sm text-gray-600 mt-1">
                Click on any day to {timesheet.status === 'draft' ? 'add or edit' : 'view'} time entries
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Icon icon="solar:calendar-bold-duotone" className="w-6 h-6 text-teal-600" />
              <span className="text-sm font-medium text-teal-700">
                {format(monthStart, 'MMMM yyyy')}
              </span>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-6">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-3 mb-4">
            {shortDays.map((day, index) => (
              <div key={day} className="text-center">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {day}
                </div>
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-3">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const entry = entriesMap.get(dateStr);
              const isWeekendDay = isWeekend(day);
              const dayOfWeek = getDay(day);
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              
              return (
                <div
                  key={dateStr}
                  className={`
                    relative min-h-[120px] border-2 rounded-xl p-3 transition-all duration-200
                    ${
                      isWeekendDay 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-white border-gray-200'
                    }
                    ${
                      timesheet.status === 'draft' 
                        ? 'hover:border-teal-300 hover:shadow-md cursor-pointer transform hover:scale-105' 
                        : 'cursor-default'
                    }
                    ${
                      isToday 
                        ? 'ring-2 ring-teal-200 border-teal-300' 
                        : ''
                    }
                    ${
                      entry 
                        ? 'bg-gradient-to-br from-teal-50 to-blue-50 border-teal-200' 
                        : ''
                    }
                  `}
                  onClick={() => timesheet.status === 'draft' && handleEditEntry(timesheet, dateStr)}
                >
                  {/* Date Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className={`
                      inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                      ${
                        isToday
                          ? 'bg-teal-600 text-white'
                          : entry
                          ? 'bg-teal-100 text-teal-800'
                          : isWeekendDay
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-gray-100 text-gray-700'
                      }
                    `}>
                      {format(day, 'd')}
                    </div>
                    {isToday && (
                      <span className="text-xs bg-teal-600 text-white px-2 py-1 rounded-full font-medium">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Time Entry Display */}
                  {entry ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-teal-800">
                          {entry.total_hours.toFixed(1)}h
                        </div>
                        <div className="flex gap-1">
                          {entry.is_overtime && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                              OT
                            </span>
                          )}
                          {entry.is_holiday && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                              Holiday
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {entry.start_time && entry.end_time && (
                        <div className="text-xs text-gray-600">
                          <Icon icon="solar:clock-circle-bold-duotone" className="w-3 h-3 inline mr-1" />
                          {entry.start_time} - {entry.end_time}
                        </div>
                      )}
                      
                      {entry.project_code && (
                        <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-medium">
                          {entry.project_code}
                        </div>
                      )}
                    </div>
                  ) : (
                    timesheet.status === 'draft' && !isWeekendDay && (
                      <div className="flex flex-col items-center justify-center h-16 text-gray-400">
                        <Icon icon="solar:add-circle-bold-duotone" className="w-8 h-8 mb-1" />
                        <span className="text-xs font-medium">Add Time</span>
                      </div>
                    )
                  )}

                  {/* Weekend Indicator */}
                  {isWeekendDay && !entry && (
                    <div className="flex flex-col items-center justify-center h-16 text-gray-400">
                      <Icon icon="solar:calendar-minimalistic-bold-duotone" className="w-6 h-6 mb-1" />
                      <span className="text-xs">Weekend</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{timesheet.total_hours.toFixed(1)}</div>
              <div className="text-sm text-gray-600">Total Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{timesheet.regular_hours.toFixed(1)}</div>
              <div className="text-sm text-gray-600">Regular Hours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{timesheet.overtime_hours.toFixed(1)}</div>
              <div className="text-sm text-gray-600">Overtime Hours</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          {isTeamView ? 'Team Timesheets' : 'My Timesheets'}
        </h2>
        <div className="flex items-center gap-3">
          <MonthInput
            value={format(selectedMonth, 'yyyy-MM')}
            onChange={(value) => setSelectedMonth(new Date(value + '-01'))}
            placeholder="Select month"
          />
          <Button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              queryClient.invalidateQueries({ queryKey: ['timesheets'] });
            }}
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 mr-2" />
            Refresh
          </Button>
          {(!isTeamView || activeView === 'my') && (
            <Button
              onClick={() => createTimesheetMutation.mutate()}
              className="bg-teal-600 text-white hover:bg-teal-700"
              disabled={
                createTimesheetMutation.isPending ||
                timesheets.some(t => 
                  t.user_id === (selectedUserId || user?.id) && 
                  t.period_start === monthStart.toISOString().split('T')[0] &&
                  t.period_end === monthEnd.toISOString().split('T')[0]
                )
              }
            >
              <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5 mr-2" />
              {createTimesheetMutation.isPending ? 'Creating...' : 'Create Timesheet'}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Hours</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalHours.toFixed(1)}</p>
              </div>
              <Icon icon="solar:clock-circle-bold-duotone" className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Regular Hours</p>
                <p className="text-2xl font-bold text-green-900">{stats.regularHours.toFixed(1)}</p>
              </div>
              <Icon icon="solar:calendar-check-bold-duotone" className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Overtime Hours</p>
                <p className="text-2xl font-bold text-orange-900">{stats.overtimeHours.toFixed(1)}</p>
              </div>
              <Icon icon="solar:alarm-add-bold-duotone" className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for team view */}
      {isTeamView && (
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('my')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeView === 'my'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Timesheets
          </button>
          <button
            onClick={() => setActiveView('team')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeView === 'team'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Team Timesheets
          </button>
        </div>
      )}


      {/* Timesheets List */}
      {isLoading ? (
        <div className="text-center py-8">Loading timesheets...</div>
      ) : timesheets.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-teal-50 to-blue-50 rounded-2xl border-2 border-dashed border-teal-200">
          <Icon icon="solar:calendar-add-bold-duotone" className="w-20 h-20 text-teal-400 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Timesheets Found</h3>
          <p className="text-gray-600 mb-6">
            Create your first timesheet for {format(selectedMonth, 'MMMM yyyy')} to start tracking your work hours.
          </p>
          {(!isTeamView || activeView === 'my') && (
            <Button
              onClick={() => createTimesheetMutation.mutate()}
              className="bg-teal-600 text-white hover:bg-teal-700 px-6 py-3"
              disabled={createTimesheetMutation.isPending}
            >
              <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5 mr-2" />
              {createTimesheetMutation.isPending ? 'Creating...' : 'Create Your First Timesheet'}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {timesheets.map((timesheet) => (
            <div key={timesheet.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Timesheet Header */}
              <div className="bg-gradient-to-r from-teal-600 to-blue-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <h3 className="text-xl font-bold">
                      {timesheet.user?.full_name || 'My Timesheet'}
                    </h3>
                    <p className="text-teal-100 mt-1">
                      {format(selectedMonth, 'MMMM yyyy')} • 
                      {timesheet.total_hours.toFixed(1)} total hours
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      timesheet.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      timesheet.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                      timesheet.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      <Icon icon={`solar:${
                        timesheet.status === 'draft' ? 'document-add-bold-duotone' :
                        timesheet.status === 'submitted' ? 'clock-circle-bold-duotone' :
                        timesheet.status === 'approved' ? 'check-circle-bold-duotone' :
                        'close-circle-bold-duotone'
                      }`} className="w-4 h-4 inline mr-1" />
                      {timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}
                    </span>
                    
                    {timesheet.status === 'draft' && timesheet.user_id === user?.id && (
                      <Button
                        onClick={() => submitTimesheetMutation.mutate(timesheet.id)}
                        className="bg-white text-teal-600 hover:bg-gray-50 font-semibold"
                      >
                        <Icon icon="solar:send-twice-bold-duotone" className="w-4 h-4 mr-2" />
                        Submit for Approval
                      </Button>
                    )}
                    
                    {timesheet.status === 'submitted' && isTeamView && activeView === 'team' && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateTimesheetStatusMutation.mutate({ timesheetId: timesheet.id, status: 'approved' })}
                          className="bg-green-500 text-white hover:bg-green-600"
                        >
                          <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => updateTimesheetStatusMutation.mutate({ timesheetId: timesheet.id, status: 'rejected' })}
                          className="bg-red-500 text-white hover:bg-red-600"
                        >
                          <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Timesheet Content */}
              {renderModernTimesheetView(timesheet)}
            </div>
          ))}
        </div>
      )}

      {/* Timesheet Entry Modal */}
      {showEntryModal && selectedTimesheet && (
        <TimesheetEntryModal
          isOpen={showEntryModal}
          onClose={() => {
            setShowEntryModal(false);
            setSelectedTimesheet(null);
            setSelectedDate('');
            setSelectedEntry(null);
          }}
          timesheetId={selectedTimesheet.id}
          date={selectedDate}
          existingEntry={selectedEntry}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['timesheets'] });
            setShowEntryModal(false);
            setSelectedTimesheet(null);
            setSelectedDate('');
            setSelectedEntry(null);
          }}
        />
      )}
    </div>
  );
};