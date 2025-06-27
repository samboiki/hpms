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

  // Fetch timesheets
  const { data: timesheets = [], isLoading } = useQuery<Timesheet[]>({
    queryKey: ['timesheets', user?.id, selectedMonth, activeView, isTeamView],
    queryFn: async () => {
      let query = supabase
        .from('timesheets')
        .select(`
          *,
          user:users (
            full_name,
            email
          ),
          entries:timesheet_entries (*)
        `)
        .gte('period_start', monthStart.toISOString())
        .lte('period_end', monthEnd.toISOString());

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
      const { data, error } = await supabase
        .from('timesheets')
        .insert({
          user_id: selectedUserId || user?.id,
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
      toast.error(error.message || 'Failed to create timesheet');
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

  const renderCalendarView = (timesheet: Timesheet) => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const entriesMap = new Map(timesheet.entries?.map(e => [e.date, e]) || []);

    return (
      <div className="grid grid-cols-7 gap-1 mt-4">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const entry = entriesMap.get(dateStr);
          const isWeekendDay = isWeekend(day);
          
          return (
            <div
              key={dateStr}
              className={`min-h-[80px] border rounded-lg p-2 ${
                isWeekendDay ? 'bg-gray-50' : 'bg-white'
              } ${timesheet.status === 'draft' ? 'hover:bg-blue-50 cursor-pointer' : ''}`}
              onClick={() => timesheet.status === 'draft' && handleEditEntry(timesheet, dateStr)}
            >
              <div className="text-xs text-gray-500">{format(day, 'd')}</div>
              {entry && (
                <div className="mt-1">
                  <div className="text-sm font-medium text-gray-900">
                    {entry.total_hours.toFixed(1)}h
                  </div>
                  {entry.is_overtime && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-1 rounded">OT</span>
                  )}
                  {entry.is_holiday && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded ml-1">H</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
          <input
            type="month"
            value={format(selectedMonth, 'yyyy-MM')}
            onChange={(e) => setSelectedMonth(new Date(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {(!isTeamView || activeView === 'my') && (
            <Button
              onClick={() => createTimesheetMutation.mutate()}
              className="bg-teal-600 text-white hover:bg-teal-700"
              disabled={timesheets.some(t => t.user_id === (selectedUserId || user?.id))}
            >
              <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5 mr-2" />
              Create Timesheet
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
        <Card>
          <CardContent className="text-center py-8">
            <Icon icon="solar:calendar-minimalistic-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No timesheets found for {format(selectedMonth, 'MMMM yyyy')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {timesheets.map((timesheet) => (
            <Card key={timesheet.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {timesheet.user?.full_name || 'My Timesheet'} - {format(selectedMonth, 'MMMM yyyy')}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {timesheet.total_hours.toFixed(1)} total hours ({timesheet.regular_hours.toFixed(1)} regular, {timesheet.overtime_hours.toFixed(1)} overtime)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(timesheet.status)}`}>
                      {timesheet.status}
                    </span>
                    {timesheet.status === 'draft' && timesheet.user_id === user?.id && (
                      <Button
                        onClick={() => submitTimesheetMutation.mutate(timesheet.id)}
                        size="sm"
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Submit
                      </Button>
                    )}
                    {timesheet.status === 'submitted' && isTeamView && activeView === 'team' && (
                      <>
                        <Button
                          onClick={() => updateTimesheetStatusMutation.mutate({ timesheetId: timesheet.id, status: 'approved' })}
                          size="sm"
                          className="bg-green-600 text-white hover:bg-green-700"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => updateTimesheetStatusMutation.mutate({ timesheetId: timesheet.id, status: 'rejected' })}
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderCalendarView(timesheet)}
              </CardContent>
            </Card>
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