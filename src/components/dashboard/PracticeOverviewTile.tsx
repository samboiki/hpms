import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  FileText,
  UserCheck,
  MessageSquare,
  Activity,
  ChevronRight,
  FlaskConical,
  Pill,
  XCircle
} from 'lucide-react';
import { format, differenceInMinutes, differenceInHours, isToday, isTomorrow } from 'date-fns';
import { useTheme } from '../../stores/themeStore';
import { cn } from '../../utils/cn';

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

interface PracticeOverviewProps {
  notifications: Notification[];
  onNotificationAction?: (notificationId: string, action: 'primary' | 'secondary') => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
}

const PracticeOverviewTile: React.FC<PracticeOverviewProps> = ({ 
  notifications, 
  onNotificationAction, 
  onMarkAsRead, 
  onMarkAllAsRead 
}) => {
  const { currentTheme } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

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

  const unreadCount = notifications.filter(n => !n.read).length;
  const urgentCount = notifications.filter(n => n.priority === 'urgent' || n.priority === 'high').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 24 }}
      className="relative overflow-hidden group"
    >
      {/* Sidebar-themed container */}
      <div className={`relative bg-gradient-to-b ${currentTheme.gradients.sidebar} backdrop-blur-md rounded-xl shadow-lg border border-white/10 overflow-hidden`}>
        
        {/* Header */}
        <div className="relative p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-white">
                Notifications
                {unreadCount > 0 && (
                  <span className="text-sm font-normal text-white/70 ml-2">
                    ({unreadCount} new)
                  </span>
                )}
              </h3>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-xs font-medium text-white/80 hover:text-white transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
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
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn(
                    "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]",
                    filter === tab.value
                      ? "bg-white/30 text-white"
                      : "bg-white/20 text-white/80"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.slice(0, 5).map((notification, index) => {
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
                      "relative border-b border-white/10 last:border-0 transition-colors",
                      !notification.read && "bg-white/5"
                    )}
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${getNotificationColor(notification.type, notification.priority)} flex-shrink-0`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-white leading-tight">
                                {notification.title}
                              </h4>
                              <p className="text-xs text-white/70 mt-1 leading-relaxed">
                                {notification.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <span className="text-xs text-white/50 whitespace-nowrap">
                                {getTimeAgo(notification.time)}
                              </span>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          {notification.actions && (
                            <div className="flex items-center gap-2 mt-2">
                              {notification.actions.primary && (
                                <button
                                  onClick={() => {
                                    notification.actions?.primary?.onClick();
                                    onNotificationAction?.(notification.id, 'primary');
                                  }}
                                  className={cn(
                                    "px-2 py-1 text-xs font-medium rounded transition-all",
                                    notification.actions.primary.variant === 'approve'
                                      ? "bg-green-500 hover:bg-green-600 text-white"
                                      : notification.actions.primary.variant === 'reject'
                                      ? "bg-red-500 hover:bg-red-600 text-white"
                                      : "bg-white/20 hover:bg-white/30 text-white"
                                  )}
                                >
                                  {notification.actions.primary.label}
                                </button>
                              )}
                              {notification.actions.secondary && (
                                <button
                                  onClick={() => {
                                    notification.actions?.secondary?.onClick();
                                    onNotificationAction?.(notification.id, 'secondary');
                                  }}
                                  className="px-2 py-1 text-xs font-medium text-white/80 hover:text-white transition-colors"
                                >
                                  {notification.actions.secondary.label}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="p-6 text-center">
                <Bell className="w-8 h-8 text-white/30 mx-auto mb-2" />
                <p className="text-sm text-white/60">No notifications</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default PracticeOverviewTile;