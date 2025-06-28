import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import TimeInput from '../../ui/TimeInput';

interface TimesheetEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  timesheetId: string;
  date: string;
  onSuccess: () => void;
  existingEntry?: any;
}

export default function TimesheetEntryModal({ 
  isOpen, 
  onClose, 
  timesheetId, 
  date, 
  onSuccess,
  existingEntry 
}: TimesheetEntryModalProps) {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakDuration, setBreakDuration] = useState('60');
  const [projectCode, setProjectCode] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isOvertime, setIsOvertime] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingEntry) {
      setStartTime(existingEntry.start_time || '09:00');
      setEndTime(existingEntry.end_time || '17:00');
      
      // Parse break_duration from interval format (e.g., "00:60:00" or "60 minutes")
      let breakMinutes = '60';
      if (existingEntry.break_duration) {
        const breakStr = existingEntry.break_duration.toString();
        if (breakStr.includes(':')) {
          // Format: "00:60:00"
          const parts = breakStr.split(':');
          breakMinutes = parts[1] || '60';
        } else if (breakStr.includes('minutes')) {
          // Format: "60 minutes"
          breakMinutes = breakStr.replace(/\D/g, '') || '60';
        } else {
          // Assume it's just a number
          breakMinutes = breakStr || '60';
        }
      }
      setBreakDuration(breakMinutes);
      
      setProjectCode(existingEntry.project_code || '');
      setTaskDescription(existingEntry.task_description || '');
      setIsOvertime(existingEntry.is_overtime || false);
      setIsHoliday(existingEntry.is_holiday || false);
    }
  }, [existingEntry]);

  const calculateTotalHours = () => {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const breakMinutes = parseInt(breakDuration) || 0;
    
    let diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight shifts
    
    const totalHours = (diffMinutes - breakMinutes) / 60;
    return Math.max(0, totalHours);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalHours = calculateTotalHours();
    if (totalHours <= 0) {
      toast.error('Total hours must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      const entryData = {
        timesheet_id: timesheetId,
        date: date,
        start_time: startTime,
        end_time: endTime,
        break_duration: `00:${String(breakDuration).padStart(2, '0')}:00`,
        total_hours: totalHours,
        project_code: projectCode || null,
        task_description: taskDescription || null,
        is_overtime: isOvertime,
        is_holiday: isHoliday
      };

      if (existingEntry) {
        // Update existing entry
        const { error } = await supabase
          .from('timesheet_entries')
          .update(entryData)
          .eq('id', existingEntry.id);

        if (error) throw error;
        toast.success('Timesheet entry updated successfully');
      } else {
        // Create new entry
        const { error } = await supabase
          .from('timesheet_entries')
          .insert(entryData);

        if (error) throw error;
        toast.success('Timesheet entry created successfully');
      }

      // Update timesheet totals
      await updateTimesheetTotals(timesheetId);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving timesheet entry:', error);
      toast.error(error.message || 'Failed to save timesheet entry');
    } finally {
      setLoading(false);
    }
  };

  const updateTimesheetTotals = async (timesheetId: string) => {
    try {
      // Get all entries for this timesheet
      const { data: entries, error } = await supabase
        .from('timesheet_entries')
        .select('total_hours, is_overtime')
        .eq('timesheet_id', timesheetId);

      if (error) throw error;

      const totalHours = entries?.reduce((sum, entry) => sum + (entry.total_hours || 0), 0) || 0;
      const overtimeHours = entries?.reduce((sum, entry) => 
        sum + (entry.is_overtime ? (entry.total_hours || 0) : 0), 0) || 0;
      const regularHours = totalHours - overtimeHours;

      // Update timesheet totals
      await supabase
        .from('timesheets')
        .update({
          total_hours: totalHours,
          regular_hours: regularHours,
          overtime_hours: overtimeHours
        })
        .eq('id', timesheetId);
    } catch (error) {
      console.error('Error updating timesheet totals:', error);
    }
  };

  if (!isOpen) return null;

  const totalHours = calculateTotalHours();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {existingEntry ? 'Edit' : 'Add'} Time Entry - {new Date(date).toLocaleDateString()}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TimeInput
              label="Start Time"
              value={startTime}
              onChange={setStartTime}
              placeholder="Select start time"
              required
            />
            <TimeInput
              label="End Time"
              value={endTime}
              onChange={setEndTime}
              placeholder="Select end time"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Break Duration (minutes)
            </label>
            <input
              type="number"
              value={breakDuration}
              onChange={(e) => setBreakDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Code (Optional)
            </label>
            <input
              type="text"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., PROJ-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Description
            </label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={3}
              placeholder="Describe the work performed..."
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isOvertime}
                onChange={(e) => setIsOvertime(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Mark as Overtime</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isHoliday}
                onChange={(e) => setIsHoliday(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Holiday/Public Holiday</span>
            </label>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Hours:</span>
              <span className="font-semibold text-lg text-teal-600">
                {totalHours.toFixed(2)} hours
              </span>
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
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5" />
              {loading ? 'Saving...' : existingEntry ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}