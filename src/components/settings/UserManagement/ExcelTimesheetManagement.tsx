import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Icon } from '@iconify/react';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, parseISO, getYear } from 'date-fns';
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

// Namibia Public Holidays
const getNamibiaPublicHolidays = (year: number): string[] => {
  const baseHolidays = [
    `${year}-01-01`, // New Year's Day
    `${year}-03-21`, // Independence Day
    `${year}-05-01`, // Workers' Day
    `${year}-05-04`, // Cassinga Day
    `${year}-05-25`, // Africa Day
    `${year}-08-26`, // Heroes' Day
    `${year}-09-10`, // Day of the Namibian Child
    `${year}-12-10`, // International Human Rights Day
    `${year}-12-25`, // Christmas Day
    `${year}-12-26`, // Family Day
  ];
  
  // Add Good Friday and Easter Monday (these move each year)
  // Easter dates for different years
  const easterDates: Record<number, { goodFriday: string; easterMonday: string }> = {
    2024: { goodFriday: `${year}-03-29`, easterMonday: `${year}-04-01` },
    2025: { goodFriday: `${year}-04-18`, easterMonday: `${year}-04-21` },
    2026: { goodFriday: `${year}-04-03`, easterMonday: `${year}-04-06` },
    2027: { goodFriday: `${year}-03-26`, easterMonday: `${year}-03-29` },
    2028: { goodFriday: `${year}-04-14`, easterMonday: `${year}-04-17` },
  };
  
  if (easterDates[year]) {
    baseHolidays.push(easterDates[year].goodFriday);
    baseHolidays.push(easterDates[year].easterMonday);
  }
  
  // Add Ascension Day (39 days after Easter)
  const ascensionDates: Record<number, string> = {
    2024: `${year}-05-09`,
    2025: `${year}-05-29`,
    2026: `${year}-05-14`,
    2027: `${year}-05-06`,
    2028: `${year}-05-25`,
  };
  
  if (ascensionDates[year]) {
    baseHolidays.push(ascensionDates[year]);
  }
  
  // Process holidays and add Monday if holiday falls on Sunday
  const allHolidays = [...baseHolidays];
  
  baseHolidays.forEach(holiday => {
    const holidayDate = parseISO(holiday);
    // If holiday falls on Sunday (day 0), add the following Monday
    if (holidayDate.getDay() === 0) {
      const monday = new Date(holidayDate);
      monday.setDate(monday.getDate() + 1);
      const mondayStr = format(monday, 'yyyy-MM-dd');
      if (!allHolidays.includes(mondayStr)) {
        allHolidays.push(mondayStr);
      }
    }
  });
  
  return allHolidays;
};

const getHolidayName = (date: string): string | null => {
  const monthDay = date.substring(5);
  const year = parseInt(date.substring(0, 4));
  
  const holidayMap: Record<string, string> = {
    '01-01': "New Year's Day",
    '03-21': 'Independence Day',
    '05-01': "Workers' Day",
    '05-04': 'Cassinga Day',
    '05-25': 'Africa Day',
    '08-26': "Heroes' Day",
    '09-10': 'Day of the Namibian Child',
    '12-10': 'International Human Rights Day',
    '12-25': 'Christmas Day',
    '12-26': 'Family Day',
  };
  
  // Handle moveable holidays
  const moveableHolidays: Record<number, Record<string, string>> = {
    2024: { '03-29': 'Good Friday', '04-01': 'Easter Monday', '05-09': 'Ascension Day' },
    2025: { '04-18': 'Good Friday', '04-21': 'Easter Monday', '05-29': 'Ascension Day' },
    2026: { '04-03': 'Good Friday', '04-06': 'Easter Monday', '05-14': 'Ascension Day' },
    2027: { '03-26': 'Good Friday', '03-29': 'Easter Monday', '05-06': 'Ascension Day' },
    2028: { '04-14': 'Good Friday', '04-17': 'Easter Monday', '05-25': 'Ascension Day' },
  };
  
  if (moveableHolidays[year] && moveableHolidays[year][monthDay]) {
    return moveableHolidays[year][monthDay];
  }
  
  // Check if this is a Monday following a Sunday holiday
  const currentDate = parseISO(date);
  if (currentDate.getDay() === 1) { // Monday
    const sunday = new Date(currentDate);
    sunday.setDate(sunday.getDate() - 1);
    const sundayStr = format(sunday, 'yyyy-MM-dd');
    const sundayMonthDay = sundayStr.substring(5);
    
    // Check if Sunday was a holiday
    if (holidayMap[sundayMonthDay]) {
      return holidayMap[sundayMonthDay] + ' (Observed)';
    }
    if (moveableHolidays[year] && moveableHolidays[year][sundayMonthDay]) {
      return moveableHolidays[year][sundayMonthDay] + ' (Observed)';
    }
  }
  
  return holidayMap[monthDay] || null;
};

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
  const [practiceBusinessHours, setPracticeBusinessHours] = useState<Record<string, { open?: string; close?: string; closed?: boolean }> | null>(null);
  
  console.log('🚀 DEBUG: ExcelTimesheetManagement mounted', {
    user: user?.email,
    selectedUserId,
    currentMonth: format(selectedMonth, 'yyyy-MM')
  });

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Get all days in month
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch user's branch and practice hours
  const { data: userPracticeInfo } = useQuery({
    queryKey: ['user-practice-hours', selectedUserId || user?.id],
    queryFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      
      // First try to get user's practice through practice_staff
      const { data: staffData, error: staffError } = await supabase
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

      if (!staffError && staffData) {
        return staffData;
      }
      
      // If no practice_staff record, try to get user's practice_id directly
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', targetUserId)
        .single();
        
      if (userError || !userData?.practice_id) {
        console.log('⚠️ DEBUG: No practice found for user');
        return null;
      }
      
      // Get practice details
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('name, business_hours')
        .eq('id', userData.practice_id)
        .single();
        
      if (practiceError) {
        console.log('❌ DEBUG: Error fetching practice:', practiceError);
        return null;
      }
      
      return {
        practice_id: userData.practice_id,
        practices: practiceData
      };
    },
    enabled: !!user?.id
  });

  // Set practice/branch hours when data loads
  useEffect(() => {
    console.log('🔍 DEBUG: userPracticeInfo changed:', userPracticeInfo);
    let businessHours = null;
    
    // Check for branch hours first
    if (userPracticeInfo?.branches?.business_hours) {
      console.log('✅ DEBUG: Found branch business hours:', userPracticeInfo.branches.business_hours);
      businessHours = userPracticeInfo.branches.business_hours as Record<string, { open?: string; close?: string; closed?: boolean }>;
    } 
    // Otherwise use practice hours
    else if (userPracticeInfo?.practices?.business_hours) {
      console.log('✅ DEBUG: Found practice business hours:', userPracticeInfo.practices.business_hours);
      businessHours = userPracticeInfo.practices.business_hours as Record<string, { open?: string; close?: string; closed?: boolean }>;
    } else {
      console.log('❌ DEBUG: No business hours found in userPracticeInfo');
    }
    
    if (businessHours) {
      console.log('🔧 DEBUG: Setting practiceBusinessHours:', businessHours);
      setPracticeBusinessHours(businessHours);
      // Set standard hours based on most common weekday hours (Monday)
      if (businessHours.monday?.open && businessHours.monday?.close) {
        const start = businessHours.monday.open;
        const end = businessHours.monday.close;
        console.log('🕐 DEBUG: Setting standard hours from Monday:', { start, end });
        setPracticeHours({ start, end });
        setStandardHours({ start, end });
      } else {
        console.log('⚠️ DEBUG: No Monday hours found in businessHours');
      }
    }
  }, [userPracticeInfo]);

  // Initialize day entries for the month
  useEffect(() => {
    console.log('📅 DEBUG: Initializing day entries. practiceBusinessHours:', practiceBusinessHours);
    const entries: DayEntry[] = daysInMonth.map(day => {
      const dayName = format(day, 'EEEE').toLowerCase();
      const dayHours = practiceBusinessHours?.[dayName];
      
      console.log(`📆 DEBUG: Day ${format(day, 'yyyy-MM-dd')} (${dayName}):`, {
        dayName,
        dayHours,
        hasDayHours: !!dayHours,
        hasOpen: !!dayHours?.open,
        hasClose: !!dayHours?.close,
        openValue: dayHours?.open,
        closeValue: dayHours?.close
      });
      
      // Check if the practice is open on this day
      // Handle both formats: { closed: true } or { open: "...", close: "..." }
      const isClosed = dayHours?.closed === true;
      const isOpen = !isClosed && dayHours?.open && dayHours?.close;
      
      console.log(`${isOpen ? '✅' : '❌'} DEBUG: Day ${dayName} is ${isOpen ? 'OPEN' : 'CLOSED'} (isClosed: ${isClosed})`);
      
      if (isOpen && dayHours?.open && dayHours?.close) {
        const start = dayHours.open;
        const end = dayHours.close;
        const totalHours = calculateTotalHours(start, end);
        console.log(`⏱️ DEBUG: ${dayName} hours: ${start} - ${end} = ${totalHours}h`);
        return {
          date: format(day, 'yyyy-MM-dd'),
          timeIn: start,
          timeOut: end,
          comments: '',
          totalHours
        };
      } else {
        return {
          date: format(day, 'yyyy-MM-dd'),
          timeIn: '',
          timeOut: '',
          comments: '',
          totalHours: 0
        };
      }
    });
    console.log('📊 DEBUG: Total entries created:', entries.length);
    console.log('📊 DEBUG: Entries with hours:', entries.filter(e => e.totalHours > 0).length);
    setDayEntries(entries);
  }, [selectedMonth, practiceBusinessHours]);

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
    if (timesheet) {
      const updatedEntries = daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const existingEntry = timesheet.entries?.find(e => e.date === dateStr);
        if (existingEntry) {
          return {
            date: dateStr,
            timeIn: existingEntry.start_time || '',
            timeOut: existingEntry.end_time || '',
            comments: existingEntry.task_description || '',
            totalHours: existingEntry.total_hours
          };
        }
        const dayName = format(day, 'EEEE').toLowerCase();
        const dayHours = practiceBusinessHours?.[dayName];
        const isClosed = dayHours?.closed === true;
        const isOpen = !isClosed && dayHours?.open && dayHours?.close;
        
        if (isOpen && dayHours?.open && dayHours?.close) {
          return {
            date: dateStr,
            timeIn: dayHours.open,
            timeOut: dayHours.close,
            comments: '',
            totalHours: calculateTotalHours(dayHours.open, dayHours.close)
          };
        } else {
          return {
            date: dateStr,
            timeIn: '',
            timeOut: '',
            comments: '',
            totalHours: 0
          };
        }
      });
      setDayEntries(updatedEntries);
      setCurrentTimesheet(timesheet);
    } else {
      // No timesheet exists for this month, reset to default entries
      setCurrentTimesheet(null);
    }
  }, [timesheet, selectedMonth, practiceBusinessHours]);

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
    
    const totalHours = diffMinutes / 60;
    // Only subtract lunch break if working 6+ hours
    const hours = totalHours >= 6 ? totalHours - 1 : totalHours;
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
      const dayName = format(date, 'EEEE').toLowerCase();
      const dayHours = practiceBusinessHours?.[dayName];
      
      // Apply practice hours for each specific day
      const isClosed = dayHours?.closed === true;
      const isOpen = !isClosed && dayHours?.open && dayHours?.close;
      
      if (isOpen && dayHours?.open && dayHours?.close) {
        return {
          ...entry,
          timeIn: dayHours.open,
          timeOut: dayHours.close,
          totalHours: calculateTotalHours(dayHours.open, dayHours.close)
        };
      }
      // Keep existing values if practice is closed on this day
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

  // Delete timesheet mutation
  const deleteTimesheetMutation = useMutation({
    mutationFn: async (timesheetId: string) => {
      // First, delete all related timesheet entries
      const { error: entriesError } = await supabase
        .from('timesheet_entries')
        .delete()
        .eq('timesheet_id', timesheetId);

      if (entriesError) throw entriesError;

      // Then delete the timesheet itself
      const { error: timesheetError } = await supabase
        .from('timesheets')
        .delete()
        .eq('id', timesheetId);

      if (timesheetError) throw timesheetError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['current-timesheet'] });
      toast.success('Timesheet deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete timesheet');
    }
  });

  const handleDeleteTimesheet = async (timesheetId: string, period: string) => {
    const confirmMessage = `Are you sure you want to delete the timesheet for ${period}? This will permanently delete all time entries for this period.`;
    
    if (confirm(confirmMessage)) {
      deleteTimesheetMutation.mutate(timesheetId);
    }
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
                    <span className="font-medium">Default Hours (Monday):</span>
                    <span>{practiceHours.start} - {practiceHours.end}</span>
                    <span className="text-teal-600">({userPracticeInfo?.branches?.name || userPracticeInfo?.practices?.name})</span>
                  </div>
                  {practiceBusinessHours && (
                    <div className="mt-2 text-xs text-teal-700">
                      <details>
                        <summary className="cursor-pointer font-medium">View all practice hours</summary>
                        <div className="mt-1 space-y-1">
                          {Object.entries(practiceBusinessHours).map(([day, hours]) => (
                            <div key={day} className="capitalize">
                              {day}: {hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
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
                    onClick={() => {
                      console.log('🔄 DEBUG: Apply to Weekdays clicked');
                      applyToAllWeekdays();
                    }}
                    className="w-full bg-teal-600 text-white hover:bg-teal-700"
                  >
                    <Icon icon="solar:copy-bold-duotone" className="w-4 h-4 mr-2" />
                    Apply Practice Hours
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
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <Icon icon="solar:calendar-bold-duotone" className="w-6 h-6 text-teal-600" />
                  {format(selectedMonth, 'MMMM yyyy')} Timesheet
                </CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">Total: <span className="font-semibold text-gray-900">{totalHours.toFixed(1)}h</span></span>
                  <span className="text-gray-600">Regular: <span className="font-semibold text-gray-900">{regularHours.toFixed(1)}h</span></span>
                  <span className="text-gray-600">Overtime: <span className="font-semibold text-orange-600">{overtimeHours.toFixed(1)}h</span></span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Premium Table Header */}
                  <div className="border-b border-gray-200">
                    <div className="grid grid-cols-12 gap-4 px-6 py-4">
                      <div className="col-span-3 font-semibold text-gray-700 text-sm uppercase tracking-wide" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <Icon icon="solar:calendar-date-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Date
                      </div>
                      <div className="col-span-2 font-semibold text-gray-700 text-sm uppercase tracking-wide" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <Icon icon="solar:login-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Time In
                      </div>
                      <div className="col-span-2 font-semibold text-gray-700 text-sm uppercase tracking-wide" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <Icon icon="solar:logout-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Time Out
                      </div>
                      <div className="col-span-3 font-semibold text-gray-700 text-sm uppercase tracking-wide" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <Icon icon="solar:chat-round-bold-duotone" className="w-4 h-4 inline mr-2" />
                        Comments
                      </div>
                      <div className="col-span-2 font-semibold text-gray-700 text-sm uppercase tracking-wide text-center" style={{ fontFamily: 'Rubik, sans-serif' }}>
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
                      const holidays = getNamibiaPublicHolidays(getYear(date));
                      const isHoliday = holidays.includes(entry.date);
                      
                      return (
                        <div 
                          key={entry.date} 
                          className={`grid grid-cols-12 gap-4 px-6 py-4 transition-all duration-200 hover:bg-teal-50 ${
                            isHoliday
                              ? 'bg-blue-50'
                              : isWeekendDay 
                              ? 'bg-gray-50/50' 
                              : isToday 
                              ? 'bg-teal-50 border-l-4 border-teal-500' 
                              : 'bg-purple-50/30'
                          }`}
                        >
                          {/* Date Column */}
                          <div className="col-span-3 flex items-center">
                            <div className={`flex items-center gap-3 ${isToday ? 'font-semibold text-teal-700' : ''}`}>
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                                isToday 
                                  ? 'bg-teal-100 text-teal-700 ring-2 ring-teal-200'
                                  : isHoliday
                                  ? 'bg-blue-100 text-blue-700'
                                  : isWeekendDay 
                                  ? 'bg-gray-100 text-gray-500' 
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {format(date, 'd')}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                  {format(date, 'EEEE')}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {format(date, 'MMM dd, yyyy')}
                                  {isHoliday && (
                                    <span className="ml-2 text-purple-600 font-medium">
                                      • {getHolidayName(entry.date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Time In Column */}
                          <div className="col-span-2 flex items-center">
                            {entry.timeIn && !isHoliday ? (
                              <TimeInput
                                value={entry.timeIn}
                                onChange={(value) => updateDayEntry(index, 'timeIn', value)}
                                placeholder="Start time"
                                className="w-full"
                                size="sm"
                              />
                            ) : (
                              <div className="text-gray-400 text-sm font-medium">
                                {isHoliday ? 'Holiday' : 'Closed'}
                              </div>
                            )}
                          </div>

                          {/* Time Out Column */}
                          <div className="col-span-2 flex items-center">
                            {entry.timeOut && !isHoliday ? (
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
                                isWeekendDay || isHoliday
                                  ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-white border-gray-200 hover:border-teal-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'
                              }`}
                              placeholder={isHoliday ? getHolidayName(entry.date) || 'Holiday' : isWeekendDay ? 'Weekend' : 'Add your notes...'}
                              disabled={isWeekendDay || isHoliday}
                            />
                          </div>

                          {/* Total Hours Column */}
                          <div className="col-span-2 flex items-center justify-center">
                            <div className="text-center">
                              <div className={`font-bold ${
                                entry.totalHours > 8 
                                  ? 'text-orange-600' 
                                  : entry.totalHours > 0 
                                  ? 'text-teal-600' 
                                  : 'text-gray-400'
                              }`}>
                                <span className="text-xl">{Math.floor(entry.totalHours)}</span>
                                <span className="text-sm">.{Math.round((entry.totalHours % 1) * 10)}h</span>
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
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-600">Public Holiday</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => saveTimesheetMutation.mutate()}
                    disabled={saveTimesheetMutation.isPending}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
                  >
                    <Icon icon="solar:floppy-disk-bold-duotone" className="w-4 h-4" />
                    <span>{saveTimesheetMutation.isPending ? 'Saving...' : 'Save Timesheet'}</span>
                  </button>
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
                          <Button
                            onClick={() => handleDeleteTimesheet(
                              ts.id,
                              format(parseISO(ts.period_start), 'MMMM yyyy')
                            )}
                            size="sm"
                            className="bg-red-600 text-white hover:bg-red-700"
                            disabled={deleteTimesheetMutation.isPending}
                          >
                            <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4 mr-2" />
                            {deleteTimesheetMutation.isPending ? 'Deleting...' : 'Delete'}
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
                            downloadTimesheetPDF(currentTimesheet, true);
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