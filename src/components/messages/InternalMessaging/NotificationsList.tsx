import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '../../../utils/cn';
import { useMessagingStore, useFilteredNotifications } from '../../../stores/messagingStore';
import { SystemNotification } from '../../../types/internal-messaging.types';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationsListProps {
  practiceId: string;
  userId: string;
  onClose?: () => void;
  className?: string;
}

export const NotificationsList: React.FC<NotificationsListProps> = ({
  practiceId,
  userId,
  onClose,
  className
}) => {
  const [selectedTab, setSelectedTab] = useState<'all' | 'unread' | 'urgent'>('all');
  
  const {
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotifications,
    isLoadingNotifications,
    notificationError,
    unreadNotificationCount,
    updateNotificationUIState,
    updateNotificationFilters,
    notificationUIState
  } = useMessagingStore();
  
  const filteredNotifications = useFilteredNotifications();

  useEffect(() => {
    if (userId && practiceId) {
      loadNotifications(userId, practiceId);
    }
  }, [userId, practiceId, loadNotifications]);

  useEffect(() => {
    updateNotificationUIState({ 
      showOnlyUnread: selectedTab === 'unread',
      activeFilters: selectedTab === 'urgent' 
        ? { priorities: ['urgent', 'critical', 'high'] }
        : {}
    });
    // The list is filtered by notificationFilters (activeFilters above is read by nothing): Urgent showed everything
    updateNotificationFilters({ priorities: selectedTab === 'urgent' ? ['urgent', 'critical', 'high'] : undefined });
  }, [selectedTab, updateNotificationUIState, updateNotificationFilters]);

  // Other screens show every notification: the Urgent filter ends with this list
  useEffect(() => () => updateNotificationFilters({ priorities: undefined }), [updateNotificationFilters]);

  const getNotificationIcon = (type: SystemNotification['notification_type']) => {
    const iconMap: Record<string, string> = {
      'lab_results': 'solar:test-tube-bold-duotone',
      'appointment_reminder': 'solar:calendar-mark-bold-duotone',
      'prescription_renewal': 'solar:pills-3-bold-duotone',
      'patient_message': 'solar:chat-round-dots-bold-duotone',
      'system_update': 'solar:info-circle-bold-duotone',
      'visit_status': 'solar:stethoscope-bold-duotone',
      'task_assigned': 'solar:checklist-bold-duotone',
      'payment_received': 'solar:dollar-minimalistic-bold-duotone',
      'critical_result': 'solar:danger-triangle-bold-duotone',
      'follow_up': 'solar:bell-bing-bold-duotone',
      'billing_alert': 'solar:bill-list-bold-duotone'
    };
    return iconMap[type] || 'solar:notification-unread-bold-duotone';
  };

  const getNotificationColor = (priority: SystemNotification['priority']) => {
    switch (priority) {
      case 'critical':
        return 'from-red-500 to-rose-600';
      case 'urgent':
        return 'from-orange-500 to-amber-600';
      case 'high':
        return 'from-yellow-500 to-amber-500';
      case 'normal':
        return 'from-blue-500 to-indigo-600';
      case 'low':
        return 'from-gray-400 to-gray-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  const formatNotificationTime = (date: string) => {
    const notificationDate = new Date(date);
    if (isToday(notificationDate)) {
      return format(notificationDate, 'HH:mm');
    } else if (isYesterday(notificationDate)) {
      return 'Yesterday';
    } else {
      return format(notificationDate, 'd MMM');
    }
  };

  const handleNotificationClick = async (notification: SystemNotification) => {
    if (notification.status === 'pending' || notification.status === 'delivered') {
      await markNotificationRead(notification.id);
    }
    
    // Handle navigation based on notification type
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  const handleDismissSelected = async () => {
    const selectedIds = notificationUIState.selectedNotificationIds;
    if (selectedIds.length > 0) {
      await dismissNotifications(selectedIds);
    }
  };

  const tabCounts = {
    all: filteredNotifications.length,
    unread: filteredNotifications.filter(n => n.status === 'pending' || n.status === 'delivered').length,
    urgent: filteredNotifications.filter(n => ['critical', 'urgent', 'high'].includes(n.priority)).length
  };

  return (
    <div className={cn("flex flex-col h-full bg-white", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Icon icon="solar:bell-bing-bold-duotone" className="w-5 h-5 text-[#01b9d5]" />
            Notifications
            {unreadNotificationCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-[#01b9d5] text-white text-xs rounded-full">
                {unreadNotificationCount}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {unreadNotificationCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-xs text-[#01b9d5] hover:underline"
                disabled={notificationUIState.isMarkingAllAsRead}
              >
                Mark all as read
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close notifications"
                title="Close"
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {(['all', 'unread', 'urgent'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize",
                selectedTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {tab}
              {tabCounts[tab] > 0 && (
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-xs",
                  selectedTab === tab
                    ? "bg-[#01b9d5] text-white"
                    : "bg-gray-200 text-gray-600"
                )}>
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingNotifications ? (
          <div className="flex items-center justify-center py-12">
            <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : notificationError ? (
          <div className="p-6 text-center">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Failed to load notifications</p>
            <button
              onClick={() => loadNotifications(userId, practiceId)}
              className="mt-2 text-xs text-[#01b9d5] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-6 text-center">
            <Icon icon="solar:bell-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No notifications</p>
            <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((notification, index) => {
              const isUnread = notification.status === 'pending' || notification.status === 'delivered';
              // Not named `Icon`: that would shadow the Iconify component used below
              const iconName = getNotificationIcon(notification.notification_type);

              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "relative border-b border-gray-100 last:border-0 cursor-pointer transition-colors",
                    isUnread && "bg-blue-50/30",
                    "hover:bg-gray-50"
                  )}
                >
                  {/* Priority Indicator */}
                  {(notification.priority === 'critical' || notification.priority === 'urgent') && (
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1",
                      notification.priority === 'critical' ? "bg-red-500" : "bg-orange-500"
                    )} />
                  )}

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn(
                        "p-2 rounded-lg bg-gradient-to-br shadow-sm flex-shrink-0",
                        getNotificationColor(notification.priority)
                      )}>
                        <Icon icon={iconName} className="w-4 h-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={cn(
                            "text-sm font-medium text-gray-900",
                            isUnread && "font-semibold"
                          )}>
                            {notification.title}
                          </p>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatNotificationTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {notification.message}
                        </p>
                        
                        {/* Action Data Preview */}
                        {notification.action_data && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            {notification.patient_id && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                Patient
                              </span>
                            )}
                            {notification.visit_id && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded">
                                Visit
                              </span>
                            )}
                            {notification.action_data.priority && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded">
                                {notification.action_data.priority}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Actions */}
      {notificationUIState.selectedNotificationIds.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {notificationUIState.selectedNotificationIds.length} selected
            </span>
            <button
              onClick={handleDismissSelected}
              disabled={notificationUIState.isDismissingSelected}
              className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              Dismiss Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
};