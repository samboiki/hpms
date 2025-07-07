// ========================================
// INTERNAL MESSAGING & NOTIFICATIONS TYPES
// Comprehensive TypeScript interfaces for the HPMS messaging system
// ========================================

export interface SystemNotification {
  id: string;
  practice_id: string;
  user_id: string;
  notification_type: 
    | 'lab_results'
    | 'appointment_reminder'
    | 'appointment_cancelled'
    | 'appointment_rescheduled'
    | 'new_message'
    | 'task_assigned'
    | 'task_completed'
    | 'invoice_generated'
    | 'payment_received'
    | 'patient_arrived'
    | 'prescription_ready'
    | 'leave_request'
    | 'payroll_processed'
    | 'system_alert'
    | 'announcement'
    | 'emergency'
    | 'report_ready'
    | 'document_shared';
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
  status: 'pending' | 'delivered' | 'read' | 'dismissed' | 'expired';
  title: string;
  message: string;
  rich_content?: any; // JSONB
  metadata: Record<string, any>;
  
  // Related entities
  patient_id?: string;
  visit_id?: string;
  invoice_id?: string;
  lab_request_id?: string;
  imaging_request_id?: string;
  task_id?: string;
  
  // Navigation and actions
  action_url?: string;
  action_label?: string;
  requires_acknowledgment: boolean;
  auto_dismiss_hours?: number;
  
  // Timestamps
  created_at: string;
  scheduled_for?: string;
  delivered_at?: string;
  read_at?: string;
  acknowledged_at?: string;
  expires_at?: string;
  
  // Delivery tracking
  delivery_channels: string[];
  delivery_status: Record<string, any>;
  retry_count: number;
  max_retries: number;
  
  // Smart categorization
  category: string;
  tags: string[];
  importance_score: number;
}

export interface InternalMessageChannel {
  id: string;
  practice_id: string;
  channel_type: 'direct' | 'group' | 'department' | 'practice' | 'broadcast' | 'patient_care';
  name?: string;
  description?: string;
  avatar_url?: string;
  
  // Channel settings
  is_archived: boolean;
  is_muted: boolean;
  allow_replies: boolean;
  is_read_only: boolean;
  
  // Related entities
  patient_id?: string;
  department_id?: string;
  visit_id?: string;
  
  // Metadata
  metadata: Record<string, any>;
  settings: Record<string, any>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  
  // Creator
  created_by?: string;
  
  // Computed fields
  participants?: ChannelParticipant[];
  last_message?: InternalMessage;
  unread_count?: number;
  total_messages?: number;
}

export interface ChannelParticipant {
  channel_id: string;
  user_id: string;
  practice_id: string;
  
  // Role and permissions
  role: 'member' | 'admin' | 'moderator';
  can_post: boolean;
  can_invite: boolean;
  can_remove: boolean;
  
  // Notification preferences
  notification_enabled: boolean;
  mention_notifications: boolean;
  
  // Participation tracking
  joined_at: string;
  left_at?: string;
  last_read_at: string;
  last_typing_at?: string;
  
  // Activity metrics
  message_count: number;
  last_message_at?: string;
  
  // User info (joined)
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
    department?: string;
  };
}

export interface InternalMessageThread {
  id: string;
  channel_id: string;
  practice_id: string;
  
  // Thread hierarchy
  parent_message_id?: string;
  
  // Thread metadata
  title?: string;
  description?: string;
  is_locked: boolean;
  is_pinned: boolean;
  
  // Statistics
  message_count: number;
  participant_count: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  
  // Creator
  created_by?: string;
  
  // Messages (when loaded)
  messages?: InternalMessage[];
}

export interface InternalMessage {
  id: string;
  thread_id: string;
  practice_id: string;
  
  // Message content
  sender_id: string;
  content: string;
  content_type: 'text' | 'html' | 'markdown' | 'file' | 'image' | 'system';
  
  // Message metadata
  is_edited: boolean;
  is_deleted: boolean;
  is_pinned: boolean;
  is_announcement: boolean;
  
  // Smart features
  mentions: string[]; // Array of user IDs mentioned
  importance_score: number;
  
  // Threading
  reply_to_message_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  edited_at?: string;
  
  // Related entities
  patient_id?: string;
  visit_id?: string;
  
  // Message metadata
  metadata: Record<string, any>;
  
  // Sender info (joined)
  sender?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
    department?: string;
  };
  
  // Related data (when loaded)
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  read_receipts?: ReadReceipt[];
  replies?: InternalMessage[];
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  practice_id: string;
  
  // File details
  filename: string;
  file_size?: number;
  mime_type?: string;
  file_url: string;
  thumbnail_url?: string;
  
  // File metadata
  width?: number;
  height?: number;
  duration?: number; // For video/audio files
  
  // Upload tracking
  uploaded_by: string;
  uploaded_at: string;
  
  // Uploader info (joined)
  uploader?: {
    id: string;
    name: string;
  };
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  practice_id: string;
  
  // Reaction details
  emoji: string;
  reaction_type: 'emoji' | 'custom';
  
  // Timestamp
  created_at: string;
  
  // User info (joined)
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface ReadReceipt {
  message_id: string;
  user_id: string;
  practice_id: string;
  
  // Read tracking
  read_at: string;
  
  // Device tracking
  device_type?: string;
  user_agent?: string;
  
  // User info (joined)
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface TypingIndicator {
  id: string;
  channel_id: string;
  user_id: string;
  practice_id: string;
  
  // Typing state
  is_typing: boolean;
  started_at: string;
  expires_at: string;
  
  // User info (joined)
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface NotificationDelivery {
  id: string;
  notification_id: string;
  practice_id: string;
  
  // Delivery details
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'webhook';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  
  // Delivery tracking
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  failure_reason?: string;
  
  // Channel-specific data
  external_id?: string; // Provider-specific message ID
  recipient_info?: Record<string, any>; // Email/phone/device token
  provider_response?: Record<string, any>; // Full response from SMS/Email provider
  
  // Retry logic
  retry_count: number;
  next_retry_at?: string;
}

export interface UserNotificationPreferences {
  user_id: string;
  practice_id: string;
  
  // Global preferences
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  
  // Sound preferences
  sound_enabled: boolean;
  vibration_enabled: boolean;
  
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone: string;
  
  // Days of week for quiet hours (0=Sunday, 6=Saturday)
  quiet_days: number[];
  
  // Per-notification-type preferences
  notification_types: Record<string, {
    email: boolean;
    sms: boolean;
    in_app: boolean;
    push: boolean;
  }>;
  
  // Updated tracking
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  practice_id?: string;
  
  // Template identification
  notification_type: string;
  title_template: string;
  message_template: string;
  email_subject_template?: string;
  email_body_template?: string;
  sms_template?: string;
  
  // Template settings
  is_active: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface MessageEngagementMetrics {
  id: string;
  practice_id: string;
  user_id?: string;
  
  // Date tracking
  metric_date: string;
  
  // Messaging metrics
  messages_sent: number;
  messages_received: number;
  channels_active: number;
  
  // Notification metrics
  notifications_received: number;
  notifications_read: number;
  notifications_dismissed: number;
  
  // Engagement timing
  first_activity_at?: string;
  last_activity_at?: string;
  total_active_minutes: number;
}

// ========================================
// REQUEST/RESPONSE INTERFACES
// ========================================

export interface CreateNotificationRequest {
  practiceId: string;
  userId: string;
  notificationType: SystemNotification['notification_type'];
  priority: SystemNotification['priority'];
  title: string;
  message: string;
  metadata?: Record<string, any>;
  patientId?: string;
  visitId?: string;
  actionUrl?: string;
  channels?: ('in_app' | 'email' | 'sms' | 'push')[];
  scheduleFor?: string; // ISO date string
}

export interface CreateChannelRequest {
  practiceId: string;
  channelType: InternalMessageChannel['channel_type'];
  name?: string;
  description?: string;
  participantIds: string[];
  patientId?: string;
  visitId?: string;
  departmentId?: string;
}

export interface SendMessageRequest {
  threadId: string;
  content: string;
  contentType?: InternalMessage['content_type'];
  mentions?: string[];
  replyToMessageId?: string;
  attachments?: {
    filename: string;
    fileUrl: string;
    mimeType?: string;
    fileSize?: number;
  }[];
}

export interface MarkNotificationReadRequest {
  notificationId: string;
}

export interface UpdateChannelRequest {
  channelId: string;
  name?: string;
  description?: string;
  isArchived?: boolean;
  isMuted?: boolean;
}

export interface SendTypingIndicatorRequest {
  channelId: string;
  isTyping: boolean;
}

// ========================================
// UTILITY TYPES
// ========================================

export type NotificationType = SystemNotification['notification_type'];
export type NotificationPriority = SystemNotification['priority'];
export type NotificationStatus = SystemNotification['status'];
export type ChannelType = InternalMessageChannel['channel_type'];
export type MessageContentType = InternalMessage['content_type'];
export type DeliveryChannel = NotificationDelivery['channel'];
export type DeliveryStatus = NotificationDelivery['status'];

// ========================================
// FILTER AND SORT OPTIONS
// ========================================

export interface NotificationFilters {
  types?: NotificationType[];
  priorities?: NotificationPriority[];
  statuses?: NotificationStatus[];
  patientId?: string;
  visitId?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  search?: string;
}

export interface ChannelFilters {
  types?: ChannelType[];
  isArchived?: boolean;
  patientId?: string;
  departmentId?: string;
  search?: string;
}

export interface MessageFilters {
  threadId?: string;
  senderId?: string;
  contentTypes?: MessageContentType[];
  hasAttachments?: boolean;
  mentions?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  search?: string;
}

export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  field: string;
  order: SortOrder;
}

// ========================================
// PAGINATION
// ========================================

export interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ========================================
// REAL-TIME EVENT TYPES
// ========================================

export interface RealtimeMessageEvent {
  type: 'message_created' | 'message_updated' | 'message_deleted';
  message: InternalMessage;
  channelId: string;
  threadId: string;
}

export interface RealtimeNotificationEvent {
  type: 'notification_created' | 'notification_updated' | 'notification_read';
  notification: SystemNotification;
  userId: string;
}

export interface RealtimeTypingEvent {
  type: 'typing_start' | 'typing_stop';
  channelId: string;
  userId: string;
  userName: string;
}

export interface RealtimeChannelEvent {
  type: 'channel_updated' | 'member_added' | 'member_removed';
  channel: InternalMessageChannel;
  member?: ChannelParticipant;
}

export type RealtimeEvent = 
  | RealtimeMessageEvent 
  | RealtimeNotificationEvent 
  | RealtimeTypingEvent 
  | RealtimeChannelEvent;

// ========================================
// UI STATE INTERFACES
// ========================================

export interface MessagingUIState {
  // Active selections
  activeChannelId?: string;
  activeThreadId?: string;
  
  // UI flags
  isChannelListOpen: boolean;
  isNotificationPanelOpen: boolean;
  isMobileView: boolean;
  
  // Loading states
  isLoadingChannels: boolean;
  isLoadingMessages: boolean;
  isLoadingNotifications: boolean;
  
  // Input states
  messageInput: string;
  isTyping: boolean;
  mentionSuggestions: string[];
  
  // Search and filters
  channelSearch: string;
  messageSearch: string;
  notificationFilters: NotificationFilters;
  
  // Error states
  error?: string;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

export interface NotificationUIState {
  // Display options
  groupByType: boolean;
  showOnlyUnread: boolean;
  sortBy: 'date' | 'priority' | 'type';
  sortOrder: SortOrder;
  
  // Filters
  activeFilters: NotificationFilters;
  
  // Selection
  selectedNotificationIds: string[];
  
  // Actions
  isMarkingAllAsRead: boolean;
  isDismissingSelected: boolean;
}

// ========================================
// ANALYTICS INTERFACES
// ========================================

export interface MessagingAnalytics {
  // Message metrics
  totalMessages: number;
  messagesThisWeek: number;
  averageResponseTime: number; // in minutes
  
  // Channel metrics
  activeChannels: number;
  mostActiveChannel: {
    id: string;
    name: string;
    messageCount: number;
  };
  
  // User engagement
  activeUsers: number;
  topParticipants: {
    userId: string;
    userName: string;
    messageCount: number;
  }[];
  
  // Notification metrics
  notificationsSent: number;
  notificationsRead: number;
  readRate: number; // percentage
  
  // Delivery metrics
  deliverySuccess: {
    inApp: number;
    email: number;
    sms: number;
    push: number;
  };
}

// ========================================
// ERROR TYPES
// ========================================

export interface MessagingError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export type MessagingErrorCode = 
  | 'CHANNEL_NOT_FOUND'
  | 'THREAD_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'NOTIFICATION_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'CONNECTION_ERROR'
  | 'DELIVERY_FAILED'
  | 'TEMPLATE_NOT_FOUND';