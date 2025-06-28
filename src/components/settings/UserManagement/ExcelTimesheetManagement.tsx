import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Icon } from '@iconify/react';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, parseISO } from 'date-fns';
import { downloadTimesheetPDF } from './TimesheetPDF';
import MonthInput from '../../ui/MonthInput';
import TimeInput from '../../ui/TimeInput';

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

interface ExcelTimesheetManagementProps {
  selectedUserId?: string;
  isTeamView: boolean;
}

interface DayEntry {
  date: string;
  timeIn: string;
  timeOut: string;
  comments: string;
  totalHours: number;
}

export const ExcelTimesheetManagement: React.FC<ExcelTimesheetManagementProps> = ({ 
  selectedUserId, 
  isTeamView 
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'timesheet' | 'list' | 'pdf'>('timesheet');
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [standardHours, setStandardHours] = useState({ start: '08:00', end: '17:00' });
  const [currentTimesheet, setCurrentTimesheet] = useState<Timesheet | null>(null);
  const [practiceHours, setPracticeHours] = useState<{ start: string; end: string } | null>(null);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Get all days in month
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch user's practice hours
  const { data: userPracticeInfo } = useQuery({
    queryKey: ['user-practice-hours', selectedUserId || user?.id],
    queryFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      const { data, error } = await supabase
        .from('practice_staff')
        .select(`
          practice_id,
          practices!inner (
            name,
            business_hours
          )
        `)
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!user?.id
  });

  // Set practice hours when data loads
  useEffect(() => {
    if (userPracticeInfo?.practices?.business_hours) {
      const businessHours = userPracticeInfo.practices.business_hours as Record<string, { open?: string; close?: string }>;
      if (businessHours.monday?.open && businessHours.monday?.close) {
        const practiceStart = businessHours.monday.open;
        const practiceEnd = businessHours.monday.close;
        setPracticeHours({ start: practiceStart, end: practiceEnd });
        setStandardHours({ start: practiceStart, end: practiceEnd });
      }
    }
  }, [userPracticeInfo]);

  // Initialize day entries for the month
  useEffect(() => {
    const entries: DayEntry[] = daysInMonth.map(day => ({
      date: format(day, 'yyyy-MM-dd'),
      timeIn: isWeekend(day) ? '' : standardHours.start,
      timeOut: isWeekend(day) ? '' : standardHours.end,
      comments: '',
      totalHours: isWeekend(day) ? 0 : 8
    }));
    setDayEntries(entries);
  }, [selectedMonth, standardHours, daysInMonth]);

  // Fetch current timesheet
  const { data: timesheet } = useQuery<Timesheet>({
    queryKey: ['current-timesheet', user?.id, selectedUserId, selectedMonth],
    queryFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      const { data, error } = await supabase
        .from('timesheets')
        .select(`
          *,
          user:users!timesheets_user_id_fkey (
            full_name,
            email
          ),
          entries:timesheet_entries (*)
        `)
        .eq('user_id', targetUserId)
        .eq('period_start', monthStart.toISOString().split('T')[0])
        .eq('period_end', monthEnd.toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as Timesheet;
    },
    enabled: !!user?.id
  });

  // Update day entries when timesheet loads
  useEffect(() => {
    if (timesheet?.entries) {
      const updatedEntries = dayEntries.map(entry => {
        const existingEntry = timesheet.entries?.find(e => e.date === entry.date);
        if (existingEntry) {
          return {
            ...entry,
            timeIn: existingEntry.start_time || '',
            timeOut: existingEntry.end_time || '',
            comments: existingEntry.task_description || '',
            totalHours: existingEntry.total_hours
          };
        }
        return entry;
      });
      setDayEntries(updatedEntries);
      setCurrentTimesheet(timesheet);
    }
  }, [timesheet, dayEntries]);

  // Create/Update timesheet mutation
  const saveTimesheetMutation = useMutation({
    mutationFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      
      // Create or get timesheet
      let timesheetId = currentTimesheet?.id;
      if (!timesheetId) {
        const { data: newTimesheet, error: timesheetError } = await supabase
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

        if (timesheetError) throw timesheetError;
        timesheetId = newTimesheet.id;
      }

      // Save entries
      const entries = dayEntries
        .filter(entry => entry.timeIn && entry.timeOut)
        .map(entry => ({
          timesheet_id: timesheetId,
          date: entry.date,
          start_time: entry.timeIn,
          end_time: entry.timeOut,
          total_hours: entry.totalHours,
          task_description: entry.comments || null,
          is_overtime: entry.totalHours > 8,
          is_holiday: false
        }));

      // Delete existing entries
      await supabase
        .from('timesheet_entries')
        .delete()
        .eq('timesheet_id', timesheetId);

      // Insert new entries
      if (entries.length > 0) {
        const { error: entriesError } = await supabase
          .from('timesheet_entries')
          .insert(entries);

        if (entriesError) throw entriesError;
      }

      // Update timesheet totals
      const totalHours = entries.reduce((sum, e) => sum + e.total_hours, 0);
      const overtimeHours = entries.reduce((sum, e) => sum + (e.total_hours > 8 ? e.total_hours - 8 : 0), 0);
      const regularHours = totalHours - overtimeHours;

      await supabase
        .from('timesheets')
        .update({
          total_hours: totalHours,
          regular_hours: regularHours,
          overtime_hours: overtimeHours
        })
        .eq('id', timesheetId);

      return timesheetId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-timesheet'] });
      toast.success('Timesheet saved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save timesheet');
    }
  });

  const calculateTotalHours = (timeIn: string, timeOut: string): number => {
    if (!timeIn || !timeOut) return 0;
    
    const start = new Date(`2000-01-01T${timeIn}`);
    const end = new Date(`2000-01-01T${timeOut}`);
    let diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight
    
    const hours = (diffMinutes - 60) / 60; // Subtract 1 hour lunch break
    return Math.max(0, Math.round(hours * 100) / 100);
  };

  const updateDayEntry = (index: number, field: keyof DayEntry, value: string | number) => {
    const newEntries = [...dayEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    
    // Auto-calculate hours if time fields change
    if (field === 'timeIn' || field === 'timeOut') {
      const entry = newEntries[index];
      newEntries[index].totalHours = calculateTotalHours(entry.timeIn, entry.timeOut);
    }
    
    setDayEntries(newEntries);
  };

  const applyToAllWeekdays = () => {
    const newEntries = dayEntries.map(entry => {
      const date = parseISO(entry.date);
      if (!isWeekend(date)) {
        return {
          ...entry,
          timeIn: standardHours.start,
          timeOut: standardHours.end,
          totalHours: calculateTotalHours(standardHours.start, standardHours.end)
        };
      }
      return entry;
    });
    setDayEntries(newEntries);
  };

  const clearAllEntries = () => {
    const newEntries = dayEntries.map(entry => ({
      ...entry,
      timeIn: '',
      timeOut: '',
      comments: '',
      totalHours: 0
    }));
    setDayEntries(newEntries);
  };

  const totalHours = dayEntries.reduce((sum, entry) => sum + entry.totalHours, 0);
  const regularHours = dayEntries.reduce((sum, entry) => sum + Math.min(entry.totalHours, 8), 0);
  const overtimeHours = totalHours - regularHours;

  // Fetch all timesheets for list view
  const { data: allTimesheets = [] } = useQuery<Timesheet[]>({
    queryKey: ['all-timesheets', user?.id, selectedUserId],
    queryFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      const { data, error } = await supabase
        .from('timesheets')
        .select(`
          *,
          user:users!timesheets_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq('user_id', targetUserId)
        .order('period_start', { ascending: false });

      if (error) throw error;
      return data as Timesheet[];
    },
    enabled: !!user?.id && activeTab === 'list'
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
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['current-timesheet'] });
      toast.success('Timesheet submitted for approval');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit timesheet');
    }
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {isTeamView ? 'Team Timesheets' : 'My Timesheets'}
        </h2>
        <div className="flex items-center gap-3">
          <MonthInput
            value={format(selectedMonth, 'yyyy-MM')}
            onChange={(value) => setSelectedMonth(new Date(value + '-01'))}
            placeholder="Select month"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'timesheet', name: 'Timesheet Entry', icon: 'solar:calendar-add-bold-duotone' },
            { id: 'list', name: 'Timesheet List', icon: 'solar:list-bold-duotone' },
            { id: 'pdf', name: 'Export PDF', icon: 'solar:download-bold-duotone' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'timesheet' | 'list' | 'pdf')}
              className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon icon={tab.icon} className="w-5 h-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'timesheet' && (
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="solar:settings-bold-duotone" className="w-5 h-5" />
                Quick Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              {practiceHours && (
                <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-teal-800">
                    <Icon icon="solar:buildings-2-bold-duotone" className="w-4 h-4" />
                    <span className="font-medium">Practice Hours:</span>
                    <span>{practiceHours.start} - {practiceHours.end}</span>
                    <span className="text-teal-600">({userPracticeInfo?.practices?.name})</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <TimeInput
                  label="Standard Start Time"
                  value={standardHours.start}
                  onChange={(value) => setStandardHours(prev => ({ ...prev, start: value }))}
                  placeholder="Select start time"
                />
                <TimeInput
                  label="Standard End Time"
                  value={standardHours.end}
                  onChange={(value) => setStandardHours(prev => ({ ...prev, end: value }))}
                  placeholder="Select end time"
                />
                <div className="flex items-end">
                  <Button
                    onClick={applyToAllWeekdays}
                    className="w-full bg-teal-600 text-white hover:bg-teal-700"
                  >
                    <Icon icon="solar:copy-bold-duotone" className="w-4 h-4 mr-2" />
                    Apply to Weekdays
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={clearAllEntries}
                    variant="outline"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <Icon icon="solar:trash-bin-2-bold-duotone" className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Premium Timesheet Grid */}
          <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-gray-50">
            <CardHeader className="bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Icon icon="solar:calendar-bold-duotone" className="w-6 h-6" />
                  </div>
                  {format(selectedMonth, 'MMMM yyyy')} Timesheet
                </CardTitle>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <div className="text-sm font-medium">
                    <div className="flex items-center gap-4">
                      <span>Total: {totalHours.toFixed(1)}h</span>
                      <span>Regular: {regularHours.toFixed(1)}h</span>
                      <span>Overtime: {overtimeHours.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Premium Table Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <div className="grid grid-cols-12 gap-4 px-6 py-4">
                      <div className="col-span-3 font-semibold text-gray-700 text-sm uppercase tracking-wide">
                        <Icon icon="solar:calendar-date-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Date
                      </div>
                      <div className="col-span-2 font-semibold text-gray-700 text-sm uppercase tracking-wide">
                        <Icon icon="solar:login-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Time In
                      </div>
                      <div className="col-span-2 font-semibold text-gray-700 text-sm uppercase tracking-wide">
                        <Icon icon="solar:logout-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Time Out
                      </div>
                      <div className="col-span-3 font-semibold text-gray-700 text-sm uppercase tracking-wide">
                        <Icon icon="solar:chat-round-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Comments
                      </div>
                      <div className="col-span-2 font-semibold text-gray-700 text-sm uppercase tracking-wide text-center">
                        <Icon icon="solar:clock-circle-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Total Hours
                      </div>
                    </div>
                  </div>

                  {/* Premium Table Body */}
                  <div className="divide-y divide-gray-100">
                    {dayEntries.map((entry, index) => {
                      const date = parseISO(entry.date);
                      const isWeekendDay = isWeekend(date);
                      const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      
                      return (
                        <div 
                          key={entry.date} 
                          className={`grid grid-cols-12 gap-4 px-6 py-4 transition-all duration-200 hover:bg-teal-50 ${
                            isWeekendDay 
                              ? 'bg-gray-50/50' 
                              : isToday 
                              ? 'bg-teal-50 border-l-4 border-teal-500' 
                              : 'bg-white'
                          }`}
                        >
                          {/* Date Column */}
                          <div className="col-span-3 flex items-center">
                            <div className={`flex items-center gap-3 ${isToday ? 'font-semibold text-teal-700' : ''}`}>
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                                isToday 
                                  ? 'bg-teal-100 text-teal-700 ring-2 ring-teal-200'
                                  : isWeekendDay 
                                  ? 'bg-gray-100 text-gray-500' 
                                  : 'bg-blue-50 text-blue-700'
                              }`}>
                                {format(date, 'd')}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {format(date, 'EEEE')}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {format(date, 'MMM dd, yyyy')}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Time In Column */}
                          <div className="col-span-2 flex items-center">
                            {!isWeekendDay ? (
                              <TimeInput
                                value={entry.timeIn}
                                onChange={(value) => updateDayEntry(index, 'timeIn', value)}
                                placeholder="Start time"
                                className="w-full"
                                size="sm"
                              />
                            ) : (
                              <div className="text-gray-400 text-sm font-medium">Weekend</div>
                            )}
                          </div>

                          {/* Time Out Column */}
                          <div className="col-span-2 flex items-center">
                            {!isWeekendDay ? (
                              <TimeInput
                                value={entry.timeOut}
                                onChange={(value) => updateDayEntry(index, 'timeOut', value)}
                                placeholder="End time"
                                className="w-full"
                                size="sm"
                              />
                            ) : (
                              <div className="text-gray-400 text-sm font-medium">—</div>
                            )}
                          </div>

                          {/* Comments Column */}
                          <div className="col-span-3 flex items-center">
                            <input
                              type="text"
                              value={entry.comments}
                              onChange={(e) => updateDayEntry(index, 'comments', e.target.value)}
                              className={`w-full px-3 py-2 rounded-lg border-2 transition-all duration-200 text-sm ${
                                isWeekendDay
                                  ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-white border-gray-200 hover:border-teal-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'
                              }`}
                              placeholder={isWeekendDay ? 'Weekend' : 'Add your notes...'}
                              disabled={isWeekendDay}
                            />
                          </div>

                          {/* Total Hours Column */}
                          <div className="col-span-2 flex items-center justify-center">
                            <div className="text-center">
                              <div className={`text-lg font-bold ${
                                entry.totalHours > 8 
                                  ? 'text-orange-600' 
                                  : entry.totalHours > 0 
                                  ? 'text-teal-600' 
                                  : 'text-gray-400'
                              }`}>
                                {entry.totalHours.toFixed(1)}h
                              </div>
                              {entry.totalHours > 8 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                                  <Icon icon="solar:alarm-bold-duotone" className="w-3 h-3 mr-1" />
                                  Overtime
                                </span>
                              )}
                              {entry.totalHours > 0 && entry.totalHours <= 8 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800 mt-1">
                                  <Icon icon="solar:check-circle-bold-duotone" className="w-3 h-3 mr-1" />
                                  Regular
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {/* Premium Footer */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 px-6 py-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-6">
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <Icon icon="solar:keyboard-bold-duotone" className="w-4 h-4" />
                      Use Tab key for efficient navigation
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                        <span className="text-gray-600">Regular Hours</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-gray-600">Overtime</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => saveTimesheetMutation.mutate()}
                    disabled={saveTimesheetMutation.isPending}
                    className="bg-gradient-to-r from-teal-600 to-blue-600 text-white hover:from-teal-700 hover:to-blue-700 px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Icon icon="solar:floppy-disk-bold-duotone" className="w-5 h-5 mr-2" />
                    {saveTimesheetMutation.isPending ? 'Saving...' : 'Save Timesheet'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="solar:list-bold-duotone" className="w-5 h-5" />
                Timesheet History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allTimesheets.length === 0 ? (
                <div className="text-center py-8">
                  <Icon icon="solar:calendar-minimalistic-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No timesheets found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allTimesheets.map((ts) => (
                    <div key={ts.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {format(parseISO(ts.period_start), 'MMMM yyyy')}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {format(parseISO(ts.period_start), 'MMM dd')} - {format(parseISO(ts.period_end), 'MMM dd, yyyy')}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span>Total: {ts.total_hours.toFixed(1)}h</span>
                            <span>Regular: {ts.regular_hours.toFixed(1)}h</span>
                            <span>Overtime: {ts.overtime_hours.toFixed(1)}h</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ts.status)}`}>
                            {ts.status.charAt(0).toUpperCase() + ts.status.slice(1)}
                          </span>
                          {ts.status === 'draft' && (
                            <Button
                              onClick={() => submitTimesheetMutation.mutate(ts.id)}
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                              Submit
                            </Button>
                          )}
                          <Button
                            onClick={() => downloadTimesheetPDF(ts)}
                            size="sm"
                            variant="outline"
                            className="border-gray-300"
                          >
                            <Icon icon="solar:download-bold-duotone" className="w-4 h-4 mr-2" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'pdf' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="solar:download-bold-duotone" className="w-5 h-5" />
                Export Timesheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentTimesheet ? (
                <div className="space-y-6">
                  {/* Preview Card */}
                  <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                    <h3 className="font-medium text-gray-900 mb-4">Current Timesheet Preview</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Period:</span>
                        <div className="font-medium">{format(parseISO(currentTimesheet.period_start), 'MMM yyyy')}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Hours:</span>
                        <div className="font-medium">{currentTimesheet.total_hours.toFixed(1)}h</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Regular Hours:</span>
                        <div className="font-medium">{currentTimesheet.regular_hours.toFixed(1)}h</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Overtime Hours:</span>
                        <div className="font-medium">{currentTimesheet.overtime_hours.toFixed(1)}h</div>
                      </div>
                    </div>
                  </div>

                  {/* Export Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <Icon icon="solar:document-bold-duotone" className="w-6 h-6 text-red-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">Download PDF</h4>
                            <p className="text-sm text-gray-600">Professional timesheet document</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => downloadTimesheetPDF(currentTimesheet)}
                          className="w-full bg-red-600 text-white hover:bg-red-700"
                        >
                          <Icon icon="solar:download-bold-duotone" className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Icon icon="solar:printer-bold-duotone" className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">Print Timesheet</h4>
                            <p className="text-sm text-gray-600">Print-friendly format</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            downloadTimesheetPDF(currentTimesheet).then(pdf => {
                              pdf.output('dataurlnewwindow');
                            });
                          }}
                          variant="outline"
                          className="w-full border-green-300 text-green-600 hover:bg-green-50"
                        >
                          <Icon icon="solar:printer-bold-duotone" className="w-4 h-4 mr-2" />
                          Print Preview
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* PDF Features */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">PDF Features</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Professional timesheet layout with practice branding</li>
                      <li>• Detailed daily time entries with totals</li>
                      <li>• Summary of regular and overtime hours</li>
                      <li>• Signature sections for employee and supervisor</li>
                      <li>• Print-optimized formatting</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Icon icon="solar:document-add-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No timesheet data available for the selected month</p>
                  <Button
                    onClick={() => setActiveTab('timesheet')}
                    className="bg-teal-600 text-white hover:bg-teal-700"
                  >
                    Create Timesheet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};