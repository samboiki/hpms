import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { notificationDeliveryService } from '../../services/notificationDeliveryService';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';

interface DeliveryStatsDashboardProps {
  practiceId: string;
  dateRange?: { from: string; to: string };
  className?: string;
}

export const DeliveryStatsDashboard: React.FC<DeliveryStatsDashboardProps> = ({
  practiceId,
  dateRange = {
    // created_at is a timestamp: a bare 'yyyy-MM-dd' as "to" left out everything sent today
    from: startOfDay(subDays(new Date(), 7)).toISOString(),
    to: endOfDay(new Date()).toISOString()
  },
  className
}) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Depend on the date strings: the default dateRange is a new object on every render, which
  // reloaded the statistics in an endless loop
  useEffect(() => {
    loadStatistics();
  }, [practiceId, dateRange.from, dateRange.to]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      const statistics = await notificationDeliveryService.getDeliveryStatistics(
        practiceId,
        dateRange
      );
      setStats(statistics);
    } catch (err) {
      console.error('Error loading delivery statistics:', err);
      setError('Failed to load delivery statistics');
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'inApp': return 'solar:notification-bold-duotone';
      case 'email': return 'solar:letter-bold-duotone';
      case 'sms': return 'solar:smartphone-bold-duotone';
      case 'push': return 'solar:bell-bing-bold-duotone';
      default: return 'solar:notification-bold-duotone';
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'inApp': return 'from-blue-500 to-blue-600';
      case 'email': return 'from-purple-500 to-purple-600';
      case 'sms': return 'from-green-500 to-green-600';
      case 'push': return 'from-amber-500 to-amber-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={cn("text-center p-8 text-gray-500", className)}>
        {error || 'No statistics available'}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon="solar:delivery-bold-duotone" className="w-8 h-8 text-blue-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
          </div>
          <p className="text-sm text-gray-600">Total Notifications</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.byStatus.successful}</span>
          </div>
          <p className="text-sm text-gray-600">Fully Delivered</p>
          <p className="text-xs text-green-600 mt-1">
            {stats.total > 0 ? Math.round((stats.byStatus.successful / stats.total) * 100) : 0}% success rate
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon="solar:notification-unread-bold-duotone" className="w-8 h-8 text-amber-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.byStatus.partial}</span>
          </div>
          <p className="text-sm text-gray-600">Partially Delivered</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <Icon icon="solar:close-circle-bold-duotone" className="w-8 h-8 text-red-500" />
            <span className="text-2xl font-bold text-gray-900">{stats.byStatus.failed}</span>
          </div>
          <p className="text-sm text-gray-600">Failed</p>
        </div>
      </div>

      {/* Channel Statistics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Icon icon="solar:chart-bold-duotone" className="w-5 h-5" />
          Channel Performance
        </h3>

        <div className="space-y-4">
          {stats.total === 0 && (
            <p className="text-sm text-gray-500">No notifications were sent in this period.</p>
          )}
          {Object.entries(stats.byChannel).map(([channel, channelStats]: [string, any]) => {
            if (channelStats.sent === 0) return null;
            
            const deliveryRate = (channelStats.delivered / channelStats.sent) * 100;
            const engagementRate = channel === 'email' 
              ? (channelStats.opened / channelStats.delivered) * 100 || 0
              : channel === 'push' 
              ? (channelStats.clicked / channelStats.delivered) * 100 || 0
              : 0;

            return (
              <div key={channel} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg bg-gradient-to-r flex items-center justify-center",
                      getChannelColor(channel)
                    )}>
                      <Icon icon={getChannelIcon(channel)} className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {channel === 'inApp' ? 'In-App' : channel === 'sms' ? 'SMS' : channel.charAt(0).toUpperCase() + channel.slice(1)}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {channelStats.sent} sent
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.round(deliveryRate)}%
                    </p>
                    <p className="text-xs text-gray-500">Delivery Rate</p>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="space-y-2">
                  {/* Delivery rate */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Delivered</span>
                      <span>{channelStats.delivered} / {channelStats.sent}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                        style={{ width: `${deliveryRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Engagement rate for email */}
                  {channel === 'email' && channelStats.delivered > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Opened</span>
                        <span>{channelStats.opened} / {channelStats.delivered}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${engagementRate}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Click rate for email and push */}
                  {(channel === 'email' || channel === 'push') && channelStats.clicked > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Clicked</span>
                        <span>{channelStats.clicked}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-500"
                          style={{ width: `${(channelStats.clicked / channelStats.delivered) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Failure rate */}
                  {channelStats.failureRate > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Failed</span>
                        <span>{channelStats.sent - channelStats.delivered} / {channelStats.sent}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-500"
                          style={{ width: `${channelStats.failureRate}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Icon icon="solar:lightbulb-bold-duotone" className="w-5 h-5 text-blue-600" />
          Delivery Insights
        </h3>
        
        <div className="space-y-2 text-sm text-gray-700">
          {/* Just the measured rate: the "above industry average" verdict came from a made-up 25% benchmark */}
          {stats.byChannel.email.delivered > 0 && stats.byChannel.email.opened > 0 && (
            <p className="flex items-start gap-2">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
              <span>
                Email open rate is{' '}
                <strong>{Math.round((stats.byChannel.email.opened / stats.byChannel.email.delivered) * 100)}%</strong>
                {' '}of delivered emails.
              </span>
            </p>
          )}
          
          {stats.byChannel.sms.failureRate > 10 && (
            <p className="flex items-start gap-2">
              <Icon icon="solar:danger-circle-bold" className="w-4 h-4 text-amber-600 mt-0.5" />
              <span>
                High SMS failure rate ({Math.round(stats.byChannel.sms.failureRate)}%) - 
                Check phone number validity and SMS credits
              </span>
            </p>
          )}
          
          {stats.byStatus.partial > stats.byStatus.successful && (
            <p className="flex items-start gap-2">
              <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-blue-600 mt-0.5" />
              <span>
                Most notifications are partially delivered - 
                Consider using fewer channels or verifying contact information
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryStatsDashboard;