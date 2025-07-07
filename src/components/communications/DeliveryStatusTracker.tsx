import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { notificationDeliveryService, NotificationDelivery } from '../../services/notificationDeliveryService';
import { cn } from '../../utils/cn';

interface DeliveryStatusTrackerProps {
  notificationId: string;
  className?: string;
  compact?: boolean;
  showTimestamps?: boolean;
}

interface ChannelStatus {
  channel: 'in_app' | 'email' | 'sms' | 'push';
  label: string;
  icon: string;
  delivered: boolean;
  deliveredAt?: string;
  failureReason?: string;
  opened?: boolean;
  openedAt?: string;
  clicked?: boolean;
  clickedAt?: string;
}

export const DeliveryStatusTracker: React.FC<DeliveryStatusTrackerProps> = ({
  notificationId,
  className,
  compact = false,
  showTimestamps = true
}) => {
  const [delivery, setDelivery] = useState<NotificationDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial delivery status
    loadDeliveryStatus();

    // Subscribe to real-time updates
    const subscription = notificationDeliveryService.subscribeToDeliveryUpdates(
      notificationId,
      (updatedDelivery) => {
        setDelivery(updatedDelivery);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [notificationId]);

  const loadDeliveryStatus = async () => {
    try {
      setLoading(true);
      const status = await notificationDeliveryService.getDeliveryStatus(notificationId);
      setDelivery(status);
    } catch (err) {
      console.error('Error loading delivery status:', err);
      setError('Failed to load delivery status');
    } finally {
      setLoading(false);
    }
  };

  const getChannelStatuses = (): ChannelStatus[] => {
    if (!delivery) return [];

    const statuses: ChannelStatus[] = [];

    // In-app
    if (delivery.in_app_delivered !== null) {
      statuses.push({
        channel: 'in_app',
        label: 'In-App',
        icon: 'solar:notification-bold-duotone',
        delivered: delivery.in_app_delivered,
        deliveredAt: delivery.in_app_delivered_at
      });
    }

    // Email
    if (delivery.email_delivered !== null) {
      statuses.push({
        channel: 'email',
        label: 'Email',
        icon: 'solar:letter-bold-duotone',
        delivered: delivery.email_delivered,
        deliveredAt: delivery.email_delivered_at,
        failureReason: delivery.email_failure_reason,
        opened: !!delivery.email_opened_at,
        openedAt: delivery.email_opened_at,
        clicked: !!delivery.email_clicked_at,
        clickedAt: delivery.email_clicked_at
      });
    }

    // SMS
    if (delivery.sms_delivered !== null) {
      statuses.push({
        channel: 'sms',
        label: 'SMS',
        icon: 'solar:smartphone-bold-duotone',
        delivered: delivery.sms_delivered,
        deliveredAt: delivery.sms_delivered_at,
        failureReason: delivery.sms_failure_reason
      });
    }

    // Push
    if (delivery.push_delivered !== null) {
      statuses.push({
        channel: 'push',
        label: 'Push',
        icon: 'solar:bell-bing-bold-duotone',
        delivered: delivery.push_delivered,
        deliveredAt: delivery.push_delivered_at,
        failureReason: delivery.push_failure_reason,
        clicked: !!delivery.push_clicked_at,
        clickedAt: delivery.push_clicked_at
      });
    }

    return statuses;
  };

  const getStatusIcon = (status: ChannelStatus) => {
    if (status.delivered) {
      if (status.opened) return 'solar:eye-bold-duotone';
      if (status.clicked) return 'solar:cursor-square-bold-duotone';
      return 'solar:check-circle-bold-duotone';
    }
    if (status.failureReason) return 'solar:close-circle-bold-duotone';
    return 'solar:time-past-bold-duotone';
  };

  const getStatusColor = (status: ChannelStatus) => {
    if (status.delivered) {
      if (status.opened || status.clicked) return 'text-blue-600';
      return 'text-green-600';
    }
    if (status.failureReason) return 'text-red-600';
    return 'text-gray-400';
  };

  const getStatusBgColor = (status: ChannelStatus) => {
    if (status.delivered) {
      if (status.opened || status.clicked) return 'bg-blue-50';
      return 'bg-green-50';
    }
    if (status.failureReason) return 'bg-red-50';
    return 'bg-gray-50';
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <Icon icon="solar:refresh-circle-bold-duotone" className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className={cn("text-sm text-gray-500", className)}>
        {error || 'No delivery tracking available'}
      </div>
    );
  }

  const channelStatuses = getChannelStatuses();

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {channelStatuses.map((status) => (
          <div
            key={status.channel}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              getStatusBgColor(status),
              getStatusColor(status)
            )}
            title={`${status.label}: ${status.delivered ? 'Delivered' : status.failureReason || 'Pending'}`}
          >
            <Icon icon={status.icon} className="w-3 h-3" />
            <span>{status.label}</span>
            <Icon icon={getStatusIcon(status)} className="w-3 h-3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Icon icon="solar:delivery-bold-duotone" className="w-4 h-4" />
        Delivery Status
      </h4>
      
      <div className="space-y-2">
        {channelStatuses.map((status) => (
          <div
            key={status.channel}
            className={cn(
              "p-3 rounded-lg border",
              status.delivered ? 'border-green-200 bg-green-50' : 
              status.failureReason ? 'border-red-200 bg-red-50' : 
              'border-gray-200 bg-gray-50'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Icon 
                  icon={status.icon} 
                  className={cn("w-5 h-5", getStatusColor(status))}
                />
                <div>
                  <p className="font-medium text-gray-900">{status.label}</p>
                  
                  {/* Status */}
                  <div className="flex items-center gap-2 mt-1">
                    <Icon 
                      icon={getStatusIcon(status)} 
                      className={cn("w-4 h-4", getStatusColor(status))}
                    />
                    <span className={cn("text-sm", getStatusColor(status))}>
                      {status.delivered ? 'Delivered' : 
                       status.failureReason ? 'Failed' : 
                       'Pending'}
                    </span>
                    
                    {/* Additional statuses */}
                    {status.opened && (
                      <>
                        <span className="text-gray-400">•</span>
                        <Icon icon="solar:eye-bold-duotone" className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-600">Opened</span>
                      </>
                    )}
                    
                    {status.clicked && (
                      <>
                        <span className="text-gray-400">•</span>
                        <Icon icon="solar:cursor-square-bold-duotone" className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-600">Clicked</span>
                      </>
                    )}
                  </div>
                  
                  {/* Failure reason */}
                  {status.failureReason && (
                    <p className="text-xs text-red-600 mt-1">
                      {status.failureReason}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Timestamps */}
              {showTimestamps && (
                <div className="text-right text-xs text-gray-500">
                  {status.deliveredAt && (
                    <p>
                      Delivered: {format(new Date(status.deliveredAt), 'MMM d, HH:mm')}
                    </p>
                  )}
                  {status.openedAt && (
                    <p>
                      Opened: {format(new Date(status.openedAt), 'MMM d, HH:mm')}
                    </p>
                  )}
                  {status.clickedAt && (
                    <p>
                      Clicked: {format(new Date(status.clickedAt), 'MMM d, HH:mm')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Overall status summary */}
      <div className="pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Overall Status:</span>
          <span className={cn(
            "font-medium",
            channelStatuses.every(s => s.delivered) ? "text-green-600" :
            channelStatuses.some(s => s.delivered) ? "text-amber-600" :
            channelStatuses.some(s => s.failureReason) ? "text-red-600" :
            "text-gray-500"
          )}>
            {channelStatuses.every(s => s.delivered) ? "All Delivered" :
             channelStatuses.some(s => s.delivered) ? "Partially Delivered" :
             channelStatuses.some(s => s.failureReason) ? "Failed" :
             "Pending"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DeliveryStatusTracker;