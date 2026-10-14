import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface QueueStatus {
  status: string;
  count: number;
  oldest: string | null;
  newest: string | null;
}

interface RecentJob {
  id: string;
  visit_id: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  result: any;
}

export default function FollowUpAutomationMonitor() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  // Fetch queue status
  const fetchQueueStatus = async () => {
    const { data, error } = await supabase
      .from('follow_up_automation_status')
      .select('*');

    if (!error && data) {
      setQueueStatus(data);
    }
  };

  // Fetch recent jobs
  const fetchRecentJobs = async () => {
    const { data, error } = await supabase
      .from('follow_up_automation_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setRecentJobs(data);
    }
  };

  // No "Process Queue" button (owner, 13 Oct 2026): the queue is run by OneHealth's scheduler every 15 minutes with
  // its service key, so a press from here was always refused

  // Set up real-time subscription
  useEffect(() => {
    fetchQueueStatus();
    fetchRecentJobs();

    // Subscribe to queue changes
    const subscription = supabase
      .channel('follow_up_automation_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_automation_queue'
        },
        () => {
          fetchQueueStatus();
          fetchRecentJobs();
        }
      )
      .subscribe();

    // Poll every 5 seconds for updates
    const interval = setInterval(() => {
      fetchQueueStatus();
      fetchRecentJobs();
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-yellow-600" />;
      case 'processing':
        return <Icon icon="solar:refresh-circle-bold-duotone" className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue Status Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Icon icon="solar:chart-bold-duotone" className="w-6 h-6 text-purple-600" />
            Automation Queue Status
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['pending', 'processing', 'completed', 'failed'].map(status => {
            const stat = queueStatus.find(s => s.status === status);
            const count = stat?.count || 0;
            
            return (
              <div key={status} className={`p-4 rounded-lg ${getStatusColor(status)} bg-opacity-10`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">{status}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  {getStatusIcon(status)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon icon="solar:history-bold-duotone" className="w-6 h-6 text-purple-600" />
          Recent Automation Jobs
        </h3>

        <div className="space-y-2">
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No automation jobs yet</p>
          ) : (
            recentJobs.map(job => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <p className="text-sm font-medium">Visit: {job.visit_id.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(job.created_at), 'd MMM, HH:mm:ss')}
                    </p>
                  </div>
                </div>
                
                {job.result && (
                  <div className="text-right">
                    {job.result.success ? (
                      <p className="text-xs text-green-600">
                        Created follow-up for {job.result.scheduled_date}
                      </p>
                    ) : (
                      <p className="text-xs text-red-600">{job.result.reason}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Real-time Indicator */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-purple-700">
          <Icon icon="solar:wi-fi-router-bold-duotone" className="w-5 h-5" />
          <span>Real-time monitoring active - Queue updates automatically</span>
        </div>
      </div>
    </div>
  );
}