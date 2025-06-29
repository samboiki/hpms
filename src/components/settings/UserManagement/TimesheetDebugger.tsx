import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Icon } from '@iconify/react';

interface TimesheetDebuggerProps {
  userId: string;
}

interface DebugEntry {
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
}

interface TimesheetDebugData {
  id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  status: string;
  entry_count: number;
  entries: DebugEntry[];
}

interface DebugInfo {
  user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  timesheets: TimesheetDebugData[];
  orphanedEntries: any[];
  summary: {
    totalTimesheets: number;
    timesheetsWithEntries: number;
    emptyTimesheets: number;
  };
}

const TimesheetDebugger: React.FC<TimesheetDebuggerProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [debugData, setDebugData] = useState<DebugInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        console.log('🔍 DEBUG: Starting comprehensive timesheet debug for user:', userId);
        
        // 1. Get all timesheets for the user
        const { data: timesheets, error: timesheetsError } = await supabase
          .from('timesheets')
          .select('id, period_start, period_end, total_hours, status')
          .eq('user_id', userId)
          .order('period_start', { ascending: false });

        if (timesheetsError) throw timesheetsError;

        // 2. Get entry counts for each timesheet
        const timesheetData = await Promise.all(
          (timesheets || []).map(async (timesheet) => {
            const { count, error: countError } = await supabase
              .from('timesheet_entries')
              .select('*', { count: 'exact', head: true })
              .eq('timesheet_id', timesheet.id);

            if (countError) {
              console.error('Error counting entries:', countError);
              return { ...timesheet, entry_count: 0, entries: [] };
            }

            // Get sample entries
            const { data: entries, error: entriesError } = await supabase
              .from('timesheet_entries')
              .select('date, start_time, end_time, total_hours')
              .eq('timesheet_id', timesheet.id)
              .order('date')
              .limit(5);

            return {
              ...timesheet,
              entry_count: count || 0,
              entries: entries || []
            };
          })
        );

        // 3. Check for orphaned entries
        const { data: allEntries, error: allEntriesError } = await supabase
          .from('timesheet_entries')
          .select('timesheet_id, date, total_hours')
          .eq('timesheet_id', userId) // This will likely return nothing, but checking
          .limit(10);

        if (allEntriesError) {
          console.error('Error fetching entries:', allEntriesError);
        }

        // 4. Get user info
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', userId)
          .single();

        if (userError) {
          console.error('Error fetching user:', userError);
        }

        const debug = {
          user: userData,
          timesheets: timesheetData,
          orphanedEntries: allEntries || [],
          summary: {
            totalTimesheets: timesheets?.length || 0,
            timesheetsWithEntries: timesheetData.filter(t => t.entry_count > 0).length,
            emptyTimesheets: timesheetData.filter(t => t.entry_count === 0).length
          }
        };

        console.log('🔍 DEBUG DATA:', debug);
        setDebugData(debug);
      } catch (err) {
        console.error('Debug error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDebugData();
  }, [userId]);

  if (loading) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 animate-spin text-yellow-600" />
          <span className="text-yellow-800">Loading debug data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-red-600" />
          <span className="text-red-800">Debug Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon icon="solar:bug-bold-duotone" className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-blue-900">Timesheet Debug Information</h3>
      </div>

      {/* User Info */}
      <div className="bg-white p-3 rounded border border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2">User</h4>
        <div className="text-sm space-y-1">
          <div>Name: {debugData?.user?.full_name}</div>
          <div>Email: {debugData?.user?.email}</div>
          <div>ID: {debugData?.user?.id}</div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white p-3 rounded border border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2">Summary</h4>
        <div className="text-sm space-y-1">
          <div>Total Timesheets: {debugData?.summary?.totalTimesheets}</div>
          <div className="text-green-600">With Entries: {debugData?.summary?.timesheetsWithEntries}</div>
          <div className="text-red-600">Empty: {debugData?.summary?.emptyTimesheets}</div>
        </div>
      </div>

      {/* Timesheets */}
      <div className="bg-white p-3 rounded border border-blue-200">
        <h4 className="font-semibold text-blue-800 mb-2">Timesheets</h4>
        <div className="space-y-3">
          {debugData?.timesheets?.map((timesheet) => (
            <div key={timesheet.id} className={`p-2 rounded ${timesheet.entry_count > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-sm font-mono mb-1">ID: {timesheet.id}</div>
              <div className="text-sm">
                Period: {timesheet.period_start} to {timesheet.period_end}
              </div>
              <div className="text-sm">
                Status: {timesheet.status} | Total Hours: {timesheet.total_hours}
              </div>
              <div className={`text-sm font-semibold ${timesheet.entry_count > 0 ? 'text-green-600' : 'text-red-600'}`}>
                Entries: {timesheet.entry_count}
              </div>
              {timesheet.entries.length > 0 && (
                <div className="mt-2 text-xs">
                  <div className="font-semibold">Sample entries:</div>
                  {timesheet.entries.map((entry, idx) => (
                    <div key={idx} className="ml-2">
                      {entry.date}: {entry.start_time} - {entry.end_time} ({entry.total_hours}h)
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimesheetDebugger;