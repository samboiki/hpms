import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Icon } from '@iconify/react';
import Button from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, parseISO, getYear } from 'date-fns';
import TimesheetPDFGeneratorFixed from './TimesheetPDFGeneratorFixed';
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
  pdf_url?: string;
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
  scheduledHours: number; // Practice operating hours for this day
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
  const [activeTab, setActiveTab] = useState<'timesheet' | 'list'>('list');
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [standardHours, setStandardHours] = useState({ start: '08:00', end: '17:00' });
  const [currentTimesheet, setCurrentTimesheet] = useState<Timesheet | null>(null);
  const [practiceHours, setPracticeHours] = useState<{ start: string; end: string } | null>(null);
  const [practiceBusinessHours, setPracticeBusinessHours] = useState<Record<string, { open?: string; close?: string; closed?: boolean }> | null>(null);
  const [showPDFGenerator, setShowPDFGenerator] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Enhanced logging for debugging
  console.log('🚀 ExcelTimesheetManagement mounted', {
    user: user?.email,
    selectedUserId,
    currentMonth: format(selectedMonth, 'yyyy-MM')
  });

  // Set up real-time subscription for timesheets
  useEffect(() => {
    if (!user?.id) return;

    const targetUserId = selectedUserId || user?.id;
    
    // Subscribe to timesheets table changes
    const subscription = supabase
      .channel('timesheets-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'timesheets',
          filter: `user_id=eq.${targetUserId}`
        },
        (payload) => {
          console.log('📡 Real-time update received:', payload);
          // Immediately refetch both queries
          queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
          queryClient.invalidateQueries({ queryKey: ['current-timesheet'] });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, selectedUserId, queryClient]);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Get all days in month
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch user's branch and practice hours
  const { data: userPracticeInfo } = useQuery({
    queryKey: ['user-practice-hours', selectedUserId || user?.id],
    queryFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      
      // First try to get user's practice directly from users table
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
          totalHours,
          scheduledHours: totalHours // Store the scheduled hours
        };
      } else {
        return {
          date: format(day, 'yyyy-MM-dd'),
          timeIn: '',
          timeOut: '',
          comments: '',
          totalHours: 0,
          scheduledHours: 0
        };
      }
    });
    console.log('📊 DEBUG: Total entries created:', entries.length);
    console.log('📊 DEBUG: Entries with hours:', entries.filter(e => e.totalHours > 0).length);
    setDayEntries(entries);
  }, [selectedMonth, practiceBusinessHours]);

  // Fetch current timesheet with enhanced logging
  const { data: timesheet } = useQuery<Timesheet>({
    queryKey: ['current-timesheet', user?.id, selectedUserId, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      const periodStart = monthStart.toISOString().split('T')[0];
      const periodEnd = monthEnd.toISOString().split('T')[0];
      
      console.log('📊 Fetching timesheet for:', {
        userId: targetUserId,
        periodStart,
        periodEnd,
        month: format(selectedMonth, 'MMMM yyyy')
      });
      
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
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Timesheet fetch error:', error);
        throw error;
      }
      
      if (data) {
        console.log('✅ Timesheet found:', {
          id: data.id,
          entries: data.entries?.length || 0,
          period: `${data.period_start} to ${data.period_end}`
        });
      } else {
        console.log('⚠️ No timesheet found for this period');
      }
      
      return data as Timesheet;
    },
    enabled: !!user?.id
  });

  // Update day entries when timesheet loads
  useEffect(() => {
    if (timesheet) {
      const updatedEntries = daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayName = format(day, 'EEEE').toLowerCase();
        const dayHours = practiceBusinessHours?.[dayName];
        const isClosed = dayHours?.closed === true;
        const isOpen = !isClosed && dayHours?.open && dayHours?.close;
        
        const existingEntry = timesheet.entries?.find(e => e.date === dateStr);
        if (existingEntry) {
          return {
            date: dateStr,
            timeIn: existingEntry.start_time || '',
            timeOut: existingEntry.end_time || '',
            comments: existingEntry.task_description || '',
            totalHours: existingEntry.total_hours,
            scheduledHours: isOpen && dayHours?.open && dayHours?.close ? calculateTotalHours(dayHours.open, dayHours.close) : 0
          };
        }
        
        if (isOpen && dayHours?.open && dayHours?.close) {
          return {
            date: dateStr,
            timeIn: dayHours.open,
            timeOut: dayHours.close,
            comments: '',
            totalHours: calculateTotalHours(dayHours.open, dayHours.close),
            scheduledHours: calculateTotalHours(dayHours.open, dayHours.close)
          };
        } else {
          return {
            date: dateStr,
            timeIn: '',
            timeOut: '',
            comments: '',
            totalHours: 0,
            scheduledHours: 0
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
      // Prevent double-clicks
      if (isSaving) return;
      setIsSaving(true);
      
      try {
      const targetUserId = selectedUserId || user?.id;
      
      // Check for existing timesheet for this month
      let timesheetId = currentTimesheet?.id;
      
      if (!timesheetId) {
        // Check if there's already a timesheet for this month
        const { data: existingTimesheet } = await supabase
          .from('timesheets')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('period_start', monthStart.toISOString().split('T')[0])
          .eq('period_end', monthEnd.toISOString().split('T')[0])
          .single();
        
        if (existingTimesheet) {
          timesheetId = existingTimesheet.id;
        } else {
          // Create new timesheet only if none exists
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
          is_overtime: entry.totalHours > (entry.scheduledHours || 0),
          is_holiday: false
        }));

      // For team view, check if current user is admin/doctor to handle RLS properly
      const isAdminOrDoctor = user?.role === 'admin' || user?.role === 'doctor';
      const isEditingOtherUser = selectedUserId && selectedUserId !== user?.id;
      
      if (isEditingOtherUser && !isAdminOrDoctor) {
        throw new Error('You do not have permission to edit timesheets for other users');
      }

      // Get all dates that should have entries
      const entryDates = entries.map(e => e.date);
      
      // First, delete entries that are no longer needed (dates not in current entries)
      if (currentTimesheet?.entries && currentTimesheet.entries.length > 0) {
        const existingDates = currentTimesheet.entries.map(e => e.date);
        const datesToDelete = existingDates.filter(date => !entryDates.includes(date));
        
        if (datesToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('timesheet_entries')
            .delete()
            .eq('timesheet_id', timesheetId)
            .in('date', datesToDelete);
            
          if (deleteError) throw deleteError;
        }
      }

      // Then upsert all entries in a single batch using the correct syntax
      if (entries.length > 0) {
        const { error: upsertError } = await supabase
          .from('timesheet_entries')
          .upsert(entries, { 
            onConflict: 'timesheet_id,date',
            ignoreDuplicates: false 
          });
          
        if (upsertError) throw upsertError;
      }

      // Update timesheet totals
      const totalHours = entries.reduce((sum, e) => sum + e.total_hours, 0);
      // Calculate regular and overtime based on scheduled hours for each day
      let regularHours = 0;
      let overtimeHours = 0;
      
      dayEntries.forEach((dayEntry) => {
        const entry = entries.find(e => e.date === dayEntry.date);
        if (entry) {
          const scheduled = dayEntry.scheduledHours || 0;
          regularHours += Math.min(entry.total_hours, scheduled);
          overtimeHours += Math.max(entry.total_hours - scheduled, 0);
        }
      });

      await supabase
        .from('timesheets')
        .update({
          total_hours: totalHours,
          regular_hours: regularHours,
          overtime_hours: overtimeHours
        })
        .eq('id', timesheetId);

      return timesheetId;
      } finally {
        setIsSaving(false);
      }
    },
    onSuccess: () => {
      // Invalidate both current timesheet and list to ensure immediate updates
      queryClient.invalidateQueries({ queryKey: ['current-timesheet'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
      toast.success('Timesheet saved successfully');
    },
    onError: (error: Error) => {
      console.error('Timesheet save error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('duplicate key')) {
        toast.error('There was a conflict saving the timesheet. Please refresh and try again.');
      } else if (error.message.includes('permission')) {
        toast.error('You do not have permission to save this timesheet.');
      } else if (error.message.includes('row-level security')) {
        toast.error('Access denied. Please check your permissions.');
      } else {
        toast.error(error.message || 'Failed to save timesheet');
      }
    }
  });

  const calculateTotalHours = (timeIn: string, timeOut: string): number => {
    if (!timeIn || !timeOut) return 0;
    
    const start = new Date(`2000-01-01T${timeIn}`);
    const end = new Date(`2000-01-01T${timeOut}`);
    let diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight
    
    const totalHours = diffMinutes / 60;
    // Return total hours without subtracting lunch break
    // The practice operating hours are the regular hours employees work
    return Math.max(0, Math.round(totalHours * 100) / 100);
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
          totalHours: calculateTotalHours(dayHours.open, dayHours.close),
          scheduledHours: calculateTotalHours(dayHours.open, dayHours.close)
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
      totalHours: 0,
      scheduledHours: entry.scheduledHours || 0
    }));
    setDayEntries(newEntries);
  };

  const totalHours = dayEntries.reduce((sum, entry) => sum + entry.totalHours, 0);
  // Regular hours: up to scheduled hours per day, overtime is anything above scheduled
  const regularHours = dayEntries.reduce((sum, entry) => {
    const scheduled = entry.scheduledHours || 0;
    return sum + Math.min(entry.totalHours, scheduled);
  }, 0);
  const overtimeHours = dayEntries.reduce((sum, entry) => {
    const scheduled = entry.scheduledHours || 0;
    return sum + Math.max(entry.totalHours - scheduled, 0);
  }, 0);

  // Fetch all timesheets for list view - always enabled for immediate updates
  const { data: allTimesheets = [], refetch: refetchTimesheets } = useQuery<Timesheet[]>({
    queryKey: ['all-timesheets', user?.id, selectedUserId],
    queryFn: async () => {
      const targetUserId = selectedUserId || user?.id;
      console.log('📋 Fetching all timesheets for user:', targetUserId);
      
      const { data, error } = await supabase
        .from('timesheets')
        .select(`
          *,
          user:users!timesheets_user_id_fkey (
            full_name,
            email
          ),
          entries:timesheet_entries (
            id,
            date,
            start_time,
            end_time,
            total_hours,
            task_description,
            is_overtime,
            is_holiday
          )
        `)
        .eq('user_id', targetUserId)
        .order('period_start', { ascending: false });

      if (error) {
        console.error('❌ Error fetching timesheets:', error);
        throw error;
      }
      
      console.log(`✅ Found ${data?.length || 0} timesheets`);
      return data as Timesheet[];
    },
    enabled: !!user?.id, // Always enabled for real-time updates
    refetchInterval: false // Temporarily disabled for debugging
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

  // Handle timesheet card click to navigate to entry
  const handleTimesheetCardClick = (timesheet: Timesheet) => {
    // Show loading toast
    toast.loading('Loading timesheet...', { id: 'loading-timesheet' });
    
    // Set the selected month based on the timesheet period
    const timesheetMonth = parseISO(timesheet.period_start);
    setSelectedMonth(timesheetMonth);
    
    // Switch to the timesheet entry tab
    setActiveTab('timesheet');
    
    // Scroll to top of page for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Dismiss loading toast after a short delay
    setTimeout(() => {
      toast.dismiss('loading-timesheet');
    }, 500);
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
            { id: 'list', name: 'Timesheet List', icon: 'solar:list-bold-duotone' },
            { id: 'timesheet', name: 'Timesheet Entry', icon: 'solar:calendar-add-bold-duotone' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'timesheet' | 'list')}
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
                                entry.totalHours > entry.scheduledHours && entry.scheduledHours > 0
                                  ? 'text-orange-600' 
                                  : entry.totalHours > 0 
                                  ? 'text-teal-600' 
                                  : 'text-gray-400'
                              }`}>
                                <span className="text-xl">{Math.floor(entry.totalHours)}</span>
                                <span className="text-sm">.{Math.round((entry.totalHours % 1) * 10)}h</span>
                              </div>
                              {entry.totalHours > entry.scheduledHours && entry.scheduledHours > 0 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                                  <Icon icon="solar:alarm-bold-duotone" className="w-3 h-3 mr-1" />
                                  {(entry.totalHours - entry.scheduledHours).toFixed(1)}h OT
                                </span>
                              )}
                              {entry.totalHours > 0 && entry.totalHours <= entry.scheduledHours && (
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
                    onClick={() => !isSaving && saveTimesheetMutation.mutate()}
                    disabled={saveTimesheetMutation.isPending || isSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm transition-all duration-200 hover:shadow-xl"
                  >
                    <Icon 
                      icon={saveTimesheetMutation.isPending || isSaving ? "solar:refresh-bold-duotone" : "solar:floppy-disk-bold-duotone"} 
                      className={`w-4 h-4 ${(saveTimesheetMutation.isPending || isSaving) ? 'animate-spin' : ''}`} 
                    />
                    <span>{(saveTimesheetMutation.isPending || isSaving) ? 'Saving...' : 'Save Timesheet'}</span>
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
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon icon="solar:list-bold-duotone" className="w-5 h-5" />
                  Timesheet History
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* Real-time indicator */}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live updates</span>
                  </div>
                  <Button
                    onClick={() => refetchTimesheets()}
                    size="sm"
                    variant="outline"
                    className="border-gray-300"
                  >
                    <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
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
                    <div 
                      key={ts.id} 
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-all duration-200 hover:shadow-md"
                      onClick={() => handleTimesheetCardClick(ts)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 text-lg">
                            {/* Show month based on majority of entries or period end */}
                            {format(parseISO(ts.period_end), 'MMMM yyyy')}
                            {ts.entries?.length === 0 && ' (Empty)'}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {format(parseISO(ts.period_start), 'MMM dd')} - {format(parseISO(ts.period_end), 'MMM dd, yyyy')}
                            {ts.entries?.length > 0 && ` • ${ts.entries.length} entries`}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-sm">
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:clock-bold-duotone" className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">{ts.total_hours.toFixed(1)}h</span> total
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:calendar-mark-bold-duotone" className="w-4 h-4 text-teal-500" />
                              <span className="font-medium">{ts.regular_hours.toFixed(1)}h</span> regular
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:alarm-bold-duotone" className="w-4 h-4 text-orange-500" />
                              <span className="font-medium">{ts.overtime_hours.toFixed(1)}h</span> overtime
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ts.status)}`}>
                            {ts.status.charAt(0).toUpperCase() + ts.status.slice(1)}
                          </span>
                          {ts.pdf_url && (
                            <Button
                              onClick={() => window.open(ts.pdf_url, '_blank')}
                              size="sm"
                              variant="ghost"
                              className="text-purple-600 hover:text-purple-700"
                              title="View generated PDF"
                            >
                              <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />
                            </Button>
                          )}
                          {ts.status === 'draft' && (
                            <Button
                              onClick={() => submitTimesheetMutation.mutate(ts.id)}
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                              Submit
                            </Button>
                          )}
                          <button
                            onClick={() => {
                              console.log('🎯 Premium PDF clicked for timesheet:', {
                                id: ts.id,
                                period: `${ts.period_start} to ${ts.period_end}`,
                                entries: ts.entries?.length || 0,
                                entriesData: ts.entries
                              });
                              setSelectedTimesheet(ts);
                              setShowPDFGenerator(true);
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 font-medium text-sm flex items-center gap-2"
                          >
                            <Icon icon="solar:document-medicine-bold-duotone" className="w-4 h-4" />
                            Premium PDF
                          </button>
                          <button
                            onClick={() => handleDeleteTimesheet(
                              ts.id,
                              format(parseISO(ts.period_start), 'MMMM yyyy')
                            )}
                            className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 border bg-white px-3 py-1.5 text-sm animate-scale-in text-red-600 border-red-600 hover:bg-red-50"
                            disabled={deleteTimesheetMutation.isPending}
                          >
                            <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4 mr-1" />
                            {deleteTimesheetMutation.isPending ? 'Deleting...' : 'Delete'}
                          </button>
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


      {/* PDF Generator Modal */}
      {showPDFGenerator && selectedTimesheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Icon icon="solar:document-medicine-bold-duotone" className="w-6 h-6 text-purple-600" />
                Generate Premium Timesheet PDF
              </h2>
              <button
                onClick={() => {
                  setShowPDFGenerator(false);
                  setSelectedTimesheet(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <TimesheetPDFGeneratorFixed
                timesheet={selectedTimesheet}
                onGenerating={(generating) => {
                  if (!generating) {
                    // Refresh timesheet list after generation
                    queryClient.invalidateQueries({ queryKey: ['all-timesheets'] });
                  }
                }}
                onGenerated={() => {
                  setShowPDFGenerator(false);
                  setSelectedTimesheet(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};