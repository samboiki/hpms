import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Clock,
  FileText,
  UserCheck,
  MessageSquare,
  Activity,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Users,
  Stethoscope,
  Pill,
  FlaskConical
} from 'lucide-react';
import { format, differenceInMinutes, differenceInHours, isToday, isTomorrow } from 'date-fns';
import { cn } from '../../utils/cn';
import { useMessagingStore } from '../../stores/messagingStore';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationSubscription } from '../../hooks/useRealtimeMessaging';
import { SystemNotification } from '../../types/internal-messaging.types';

export interface Notification {
  id: string;
  type: 'booking' | 'lab-result' | 'follow-up' | 'prescription' | 'message' | 'system' | 'reminder';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  title: string;
  description: string;
  time: Date;
  actionRequired: boolean;
  data?: any;
  read?: boolean;
  actions?: {
    primary?: {
      label: string;
      onClick: () => void;
      variant?: 'approve' | 'reject' | 'neutral';
    };
    secondary?: {
      label: string;
      onClick: () => void;
    };
  };
}

// Helper function to convert system notifications to component format
const convertSystemNotifications = (systemNotifications: SystemNotification[]): Notification[] => {
  return systemNotifications.map(sn => {
    // Map notification types
    const typeMap: Record<string, Notification['type']> = {
      'appointment_reminder': 'booking',
      'lab_results': 'lab-result',
      'follow_up': 'follow-up',
      'prescription_renewal': 'prescription',
      'patient_message': 'message',
      'system_update': 'system',
      'task_assigned': 'reminder',
      'visit_status': 'booking'
    };
    
    return {
      id: sn.id,
      type: typeMap[sn.notification_type] || 'system',
      priority: sn.priority === 'critical' ? 'urgent' : sn.priority as Notification['priority'],
      title: sn.title,
      description: sn.message,
      time: new Date(sn.created_at),
      actionRequired: sn.action_required || false,
      data: sn.action_data,
      read: sn.status === 'read' || sn.status === 'dismissed',
      actions: sn.action_url ? {
        primary: {
          label: 'View',
          onClick: () => window.location.href = sn.action_url!,
          variant: 'neutral' as const
        }
      } : undefined
    };
  });
};

interface NotificationsPanelProps {
  notifications: Notification[];
  onNotificationAction?: (notificationId: string, action: 'primary' | 'secondary') => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  notifications: propNotifications,
  onNotificationAction,
  onMarkAsRead,
  onMarkAllAsRead
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const { user } = useAuthStore();
  
  // Connect to messaging store for real-time notifications
  const {
    notifications: systemNotifications,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead: markAllSystemNotificationsRead,
    unreadNotificationCount
  } = useMessagingStore();
  
  // Set up real-time subscription
  useNotificationSubscription(user?.id || '', user?.practice_id || '');
  
  // Load notifications on mount
  useEffect(() => {
    if (user?.id && user?.practice_id) {
      loadNotifications(user.id, user.practice_id);
    }
  }, [user?.id, user?.practice_id, loadNotifications]);
  
  // Merge prop notifications with system notifications if needed
  const notifications = propNotifications || convertSystemNotifications(systemNotifications);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'booking': return Calendar;
      case 'lab-result': return FlaskConical;
      case 'follow-up': return UserCheck;
      case 'prescription': return Pill;
      case 'message': return MessageSquare;
      case 'reminder': return Clock;
      case 'system': return Activity;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: Notification['type'], priority: Notification['priority']) => {
    if (priority === 'urgent') return 'from-red-500 to-rose-600';
    if (priority === 'high') return 'from-amber-500 to-orange-600';
    
    switch (type) {
      case 'booking': return 'from-blue-500 to-indigo-600';
      case 'lab-result': return 'from-purple-500 to-indigo-600';
      case 'follow-up': return 'from-emerald-500 to-green-600';
      case 'prescription': return 'from-cyan-500 to-blue-600';
      case 'message': return 'from-gray-500 to-gray-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMinutes = differenceInMinutes(now, date);
    const diffHours = differenceInHours(now, date);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (isToday(date)) return format(date, 'h:mm a');
    if (isTomorrow(date)) return `Tomorrow ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notif.read;
    if (filter === 'urgent') return notif.priority === 'urgent' || notif.priority === 'high';
    return true;
  });

  const unreadCount = propNotifications ? notifications.filter(n => !n.read).length : unreadNotificationCount;
  const urgentCount = notifications.filter(n => n.priority === 'urgent' || n.priority === 'high').length;
  
  // Handle mark as read - use system notifications if available
  const handleMarkAsRead = async (notificationId: string) => {
    if (!propNotifications && systemNotifications.length > 0) {
      await markNotificationRead(notificationId);
    } else if (onMarkAsRead) {
      onMarkAsRead(notificationId);
    }
  };
  
  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    if (!propNotifications && systemNotifications.length > 0) {
      await markAllSystemNotificationsRead();
    } else if (onMarkAllAsRead) {
      onMarkAllAsRead();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 md:p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-[#01b9d5]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            Notifications
            {unreadCount > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({unreadCount} new)
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-medium text-[#01b9d5] hover:text-[#0197a4] transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { value: 'all', label: 'All', count: notifications.length },
            { value: 'unread', label: 'Unread', count: unreadCount },
            { value: 'urgent', label: 'Urgent', count: urgentCount }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                filter === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]",
                  filter === tab.value
                    ? "bg-[#01b9d5] text-white"
                    : "bg-gray-200 text-gray-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification, index) => {
              const Icon = getNotificationIcon(notification.type);
              const isExpanded = expandedId === notification.id;
              
              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "relative border-b border-gray-100 last:border-0 transition-colors",
                    !notification.read && "bg-blue-50/30",
                    "hover:bg-gray-50"
                  )}
                >
                  {/* Priority Indicator */}
                  {(notification.priority === 'urgent' || notification.priority === 'high') && (
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1",
                      notification.priority === 'urgent' ? "bg-red-500" : "bg-amber-500"
                    )} />
                  )}

                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : notification.id);
                      if (!notification.read) {
                        handleMarkAsRead(notification.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn(
                        "p-2 rounded-lg bg-gradient-to-br shadow-sm flex-shrink-0",
                        getNotificationColor(notification.type, notification.priority)
                      )}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm font-medium text-gray-900",
                              !notification.read && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                              {notification.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">
                              {getTimeAgo(notification.time)}
                            </span>
                            <ChevronRight className={cn(
                              "w-4 h-4 text-gray-400 transition-transform",
                              isExpanded && "rotate-90"
                            )} />
                          </div>
                        </div>

                        {/* Expanded Content & Actions */}
                        <AnimatePresence>
                          {isExpanded && notification.actions && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                  {notification.actions.primary && (
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        notification.actions!.primary!.onClick();
                                        if (onNotificationAction) {
                                          onNotificationAction(notification.id, 'primary');
                                        }
                                      }}
                                      className={cn(
                                        "px-4 py-1.5 text-xs font-medium rounded-lg transition-all",
                                        notification.actions.primary.variant === 'approve'
                                          ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm"
                                          : notification.actions.primary.variant === 'reject'
                                          ? "bg-red-500 text-white hover:bg-red-600 shadow-sm"
                                          : "bg-[#01b9d5] text-white hover:bg-[#0197a4] shadow-sm"
                                      )}
                                    >
                                      {notification.actions.primary.label}
                                    </motion.button>
                                  )}
                                  {notification.actions.secondary && (
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        notification.actions!.secondary!.onClick();
                                        if (onNotificationAction) {
                                          onNotificationAction(notification.id, 'secondary');
                                        }
                                      }}
                                      className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                                    >
                                      {notification.actions.secondary.label}
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">No notifications</p>
              <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer with Stats */}
      {filteredNotifications.length > 0 && (
        <div className="p-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {filteredNotifications.filter(n => n.actionRequired).length} require action
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {filteredNotifications.filter(n => isToday(n.time)).length} today
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};