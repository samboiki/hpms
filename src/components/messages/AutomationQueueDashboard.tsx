import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { automationQueueService } from '../../services/automationQueueService';
import { cn } from '../../utils/cn';

interface QueueStats {
  status: string;
  count: number;
  overdue_count: number;
  avg_processing_ms: number;
  max_processing_ms: number;
  oldest_scheduled: string;
  practices_count: number;
  retry_count: number;
}

export default function AutomationQueueDashboard() {
  const [queueStats, setQueueStats] = useState<QueueStats[]>([]);
  const [workerStats, setWorkerStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      // Get queue statistics from view
      const { data: stats, error } = await supabase
        .from('automation_queue_dashboard')
        .select('*');
      
      if (!error && stats) {
        setQueueStats(stats);
      }

      // Get worker statistics
      const workerData = await automationQueueService.getQueueStats();
      if (workerData) {
        setWorkerStats(workerData.worker);
      }
    } catch (error) {
      console.error('Error loading queue stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'text-blue-600 bg-blue-50';
      case 'processing': return 'text-yellow-600 bg-yellow-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'retrying': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return 'solar:clock-circle-bold-duotone';
      case 'processing': return 'solar:refresh-circle-bold-duotone';
      case 'completed': return 'solar:check-circle-bold-duotone';
      case 'failed': return 'solar:close-circle-bold-duotone';
      case 'retrying': return 'solar:restart-circle-bold-duotone';
      default: return 'solar:info-circle-bold-duotone';
    }
  };

  const totalQueued = queueStats.find(s => s.status === 'queued')?.count || 0;
  const totalProcessing = queueStats.find(s => s.status === 'processing')?.count || 0;
  const totalCompleted = queueStats.find(s => s.status === 'completed')?.count || 0;
  const totalFailed = queueStats.find(s => s.status === 'failed')?.count || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
            <Icon icon="solar:layers-bold-duotone" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Automation Queue Monitor</h3>
            <p className="text-sm text-gray-600">Real-time queue processing status</p>
          </div>
        </div>
        
        <motion.button
          onClick={() => automationQueueService.triggerProcessing()}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Icon icon="solar:play-circle-bold" className="w-4 h-4" />
          <span>Process Now</span>
        </motion.button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          className="bg-white rounded-xl p-4 border border-gray-200"
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Queued</p>
              <p className="text-2xl font-bold text-gray-900">{totalQueued}</p>
            </div>
            <Icon icon="solar:clock-circle-bold-duotone" className="w-8 h-8 text-blue-500" />
          </div>
        </motion.div>

        <motion.div
          className="bg-white rounded-xl p-4 border border-gray-200"
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-gray-900">{totalProcessing}</p>
            </div>
            <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-yellow-500" />
          </div>
        </motion.div>

        <motion.div
          className="bg-white rounded-xl p-4 border border-gray-200"
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{totalCompleted}</p>
            </div>
            <Icon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-500" />
          </div>
        </motion.div>

        <motion.div
          className="bg-white rounded-xl p-4 border border-gray-200"
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-gray-900">{totalFailed}</p>
            </div>
            <Icon icon="solar:close-circle-bold-duotone" className="w-8 h-8 text-red-500" />
          </div>
        </motion.div>
      </div>

      {/* Detailed Stats */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Queue Details</h4>
        </div>
        
        <div className="divide-y divide-gray-200">
          {queueStats.map((stat) => (
            <div key={stat.status} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", getStatusColor(stat.status))}>
                    <Icon icon={getStatusIcon(stat.status)} className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{stat.status}</p>
                    <p className="text-sm text-gray-600">
                      {stat.count} items
                      {stat.overdue_count > 0 && ` (${stat.overdue_count} overdue)`}
                      {stat.retry_count > 0 && ` (${stat.retry_count} retries)`}
                    </p>
                  </div>
                </div>
                
                {stat.avg_processing_ms && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Avg processing</p>
                    <p className="font-medium text-gray-900">{Math.round(stat.avg_processing_ms)}ms</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Worker Status */}
      {workerStats && (
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon icon="solar:cpu-bolt-bold-duotone" className="w-6 h-6 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Queue Worker Status</p>
                <p className="text-sm text-gray-600">
                  Worker ID: {workerStats.id}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-600">Processed:</span>
                <span className="ml-2 font-medium text-green-600">{workerStats.processed}</span>
              </div>
              <div>
                <span className="text-gray-600">Failed:</span>
                <span className="ml-2 font-medium text-red-600">{workerStats.failed}</span>
              </div>
              <div>
                <span className="text-gray-600">Uptime:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {Math.round(workerStats.uptime / 1000 / 60)}m
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}