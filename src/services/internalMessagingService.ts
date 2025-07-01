// ========================================
// INTERNAL MESSAGING SERVICE
// Comprehensive service layer for HPMS internal messaging and notifications
// ========================================

import { supabase } from '../lib/supabase';
import {
  SystemNotification,
  InternalMessageChannel,
  InternalMessage,
  MessageReaction,
  TypingIndicator,
  UserNotificationPreferences,
  NotificationTemplate,
  CreateNotificationRequest,
  CreateChannelRequest,
  SendMessageRequest,
  PaginatedResponse,
  NotificationFilters,
  ChannelFilters,
  MessageFilters,
  PaginationOptions,
  SortOptions,
  MessagingError
} from '../types/internal-messaging.types';

// ========================================
// MAIN SERVICE CLASS
// ========================================

export class InternalMessagingService {
  private static instance: InternalMessagingService;
  
  static getInstance(): InternalMessagingService {
    if (!InternalMessagingService.instance) {
      InternalMessagingService.instance = new InternalMessagingService();
    }
    return InternalMessagingService.instance;
  }

  // ========================================
  // NOTIFICATION MANAGEMENT
  // ========================================

  /**
   * Create a new system notification
   */
  async createNotification(request: CreateNotificationRequest): Promise<SystemNotification> {
    try {
      // Call the smart notification processor edge function
      const { data, error } = await supabase.functions.invoke('smart-notification-processor', {
        body: request
      });

      if (error) {
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      // Fetch the created notification
      const { data: notification, error: fetchError } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('id', data.notificationId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch created notification: ${fetchError.message}`);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw this.createError('NOTIFICATION_CREATE_FAILED', (error as Error).message);
    }
  }

  /**
   * Get notifications for a user with filtering and pagination
   */
  async getNotifications(
    userId: string,
    practiceId: string,
    filters?: NotificationFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedResponse<SystemNotification>> {
    try {
      let query = supabase
        .from('system_notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('practice_id', practiceId);

      // Apply filters
      if (filters) {
        if (filters.types?.length) {
          query = query.in('notification_type', filters.types);
        }
        if (filters.priorities?.length) {
          query = query.in('priority', filters.priorities);
        }
        if (filters.statuses?.length) {
          query = query.in('status', filters.statuses);
        }
        if (filters.patientId) {
          query = query.eq('patient_id', filters.patientId);
        }
        if (filters.visitId) {
          query = query.eq('visit_id', filters.visitId);
        }
        if (filters.dateRange) {
          query = query
            .gte('created_at', filters.dateRange.from)
            .lte('created_at', filters.dateRange.to);
        }
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,message.ilike.%${filters.search}%`);
        }
      }

      // Apply sorting
      const sortField = sort?.field || 'created_at';
      const sortOrder = sort?.order || 'desc';
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      // Apply pagination
      if (pagination) {
        const offset = pagination.offset || (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
      }

      return {
        data: data || [],
        total: count || 0,
        page: pagination?.page || 1,
        limit: pagination?.limit || data?.length || 0,
        hasMore: pagination ? (pagination.page * pagination.limit) < (count || 0) : false
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw this.createError('NOTIFICATION_FETCH_FAILED', (error as Error).message);
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        notification_uuid: notificationId
      });

      if (error) {
        throw new Error(`Failed to mark notification as read: ${error.message}`);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw this.createError('NOTIFICATION_UPDATE_FAILED', (error as Error).message);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadNotificationCount(userId?: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_unread_notification_count', {
        user_uuid: userId || null
      });

      if (error) {
        throw new Error(`Failed to get unread count: ${error.message}`);
      }

      return data || 0;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      throw this.createError('NOTIFICATION_COUNT_FAILED', (error as Error).message);
    }
  }

  /**
   * Dismiss multiple notifications
   */
  async dismissNotifications(notificationIds: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('system_notifications')
        .update({ status: 'dismissed' })
        .in('id', notificationIds);

      if (error) {
        throw new Error(`Failed to dismiss notifications: ${error.message}`);
      }
    } catch (error) {
      console.error('Error dismissing notifications:', error);
      throw this.createError('NOTIFICATION_DISMISS_FAILED', (error as Error).message);
    }
  }

  // ========================================
  // CHANNEL MANAGEMENT
  // ========================================

  /**
   * Get channels for a practice with participants and metadata
   */
  async getChannels(
    practiceId: string,
    filters?: ChannelFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<InternalMessageChannel>> {
    try {
      // First get channels with basic info
      let query = supabase
        .from('internal_message_channels')
        .select('*', { count: 'exact' })
        .eq('practice_id', practiceId)
        .order('updated_at', { ascending: false });

      // Apply filters
      if (filters) {
        if (filters.types?.length) {
          query = query.in('channel_type', filters.types);
        }
        if (filters.isArchived !== undefined) {
          query = query.eq('is_archived', filters.isArchived);
        }
        if (filters.patientId) {
          query = query.eq('patient_id', filters.patientId);
        }
        if (filters.departmentId) {
          query = query.eq('department_id', filters.departmentId);
        }
        if (filters.search) {
          query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }
      }

      // Apply pagination
      if (pagination) {
        const offset = pagination.offset || (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }

      const { data: channels, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch channels: ${error.message}`);
      }

      if (!channels || channels.length === 0) {
        return {
          data: [],
          total: 0,
          page: pagination?.page || 1,
          limit: pagination?.limit || 0,
          hasMore: false
        };
      }

      // Fetch participants for all channels
      const channelIds = channels.map(c => c.id);
      const { data: members, error: membersError } = await supabase
        .from('internal_channel_members')
        .select(`
          *,
          user:users!internal_channel_members_user_id_fkey(
            id,
            full_name,
            name:full_name,
            email,
            avatar,
            role
          )
        `)
        .in('channel_id', channelIds);

      if (membersError) {
        console.error('Error fetching channel members:', membersError);
      }

      // Fetch last messages for channels
      const { data: threads, error: threadsError } = await supabase
        .from('internal_message_threads')
        .select(`
          channel_id,
          id,
          message_count,
          last_message_at
        `)
        .in('channel_id', channelIds)
        .order('last_message_at', { ascending: false });

      if (threadsError) {
        console.error('Error fetching threads:', threadsError);
      }

      // Fetch last messages if threads exist
      let lastMessages: Array<InternalMessage & { sender?: { id: string; name: string; avatar?: string } }> = [];
      if (threads && threads.length > 0) {
        const threadIds = threads.map(t => t.id);
        const { data: messages, error: messagesError } = await supabase
          .from('internal_messages')
          .select(`
            *,
            sender:users!internal_messages_sender_id_fkey(
              id,
              full_name,
              name:full_name,
              avatar
            )
          `)
          .in('thread_id', threadIds)
          .order('created_at', { ascending: false })
          .limit(threads.length);

        if (!messagesError && messages) {
          lastMessages = messages;
        }
      }

      // Process channels to add computed fields
      const processedChannels = channels.map(channel => {
        // Add participants
        const participants = (members || [])
          .filter(m => m.channel_id === channel.id)
          .map(m => ({
            ...m,
            users: m.user // Keep the old field name for compatibility
          }));

        // Find last message for this channel
        const channelThreads = (threads || []).filter(t => t.channel_id === channel.id);
        const lastThread = channelThreads[0];
        let lastMessage = null;
        
        if (lastThread) {
          lastMessage = lastMessages.find(m => m.thread_id === lastThread.id) || null;
        }

        return {
          ...channel,
          participants,
          last_message: lastMessage,
          unread_count: 0, // TODO: Calculate based on last_read_at
          total_messages: channelThreads.reduce((sum, thread) => sum + (thread.message_count || 0), 0)
        };
      });

      return {
        data: processedChannels,
        total: count || 0,
        page: pagination?.page || 1,
        limit: pagination?.limit || processedChannels.length,
        hasMore: pagination ? (pagination.page * pagination.limit) < (count || 0) : false
      };
    } catch (error) {
      console.error('Error fetching channels:', error);
      throw this.createError('CHANNEL_FETCH_FAILED', (error as Error).message);
    }
  }

  /**
   * Create a new message channel
   */
  async createChannel(request: CreateChannelRequest): Promise<InternalMessageChannel> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Create the channel
      const { data: channel, error: channelError } = await supabase
        .from('internal_message_channels')
        .insert({
          practice_id: request.practiceId,
          channel_type: request.channelType,
          name: request.name,
          description: request.description,
          patient_id: request.patientId,
          visit_id: request.visitId,
          department_id: request.departmentId,
          created_by: user.id
        })
        .select()
        .single();

      if (channelError) {
        throw new Error(`Failed to create channel: ${channelError.message}`);
      }

      // Add participants
      const memberInserts = request.participantIds.map(userId => ({
        channel_id: channel.id,
        user_id: userId,
        practice_id: request.practiceId,
        role: userId === user.id ? 'admin' : 'member'
      }));

      const { error: membersError } = await supabase
        .from('internal_channel_members')
        .insert(memberInserts);

      if (membersError) {
        throw new Error(`Failed to add channel members: ${membersError.message}`);
      }

      // Create default thread
      const { error: threadError } = await supabase
        .from('internal_message_threads')
        .insert({
          channel_id: channel.id,
          practice_id: request.practiceId,
          created_by: user.id
        });

      if (threadError) {
        throw new Error(`Failed to create default thread: ${threadError.message}`);
      }

      return channel;
    } catch (error) {
      console.error('Error creating channel:', error);
      throw this.createError('CHANNEL_CREATE_FAILED', (error as Error).message);
    }
  }

  /**
   * Create or get direct message channel between two users
   */
  async createDirectMessageChannel(
    practiceId: string,
    otherUserId: string
  ): Promise<InternalMessageChannel> {
    try {
      const { data, error } = await supabase.rpc('create_direct_message_channel', {
        other_user_id: otherUserId,
        practice_uuid: practiceId
      });

      if (error) {
        throw new Error(`Failed to create direct message channel: ${error.message}`);
      }

      // Fetch the full channel data
      const { data: channel, error: fetchError } = await supabase
        .from('internal_message_channels')
        .select('*')
        .eq('id', data)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch created channel: ${fetchError.message}`);
      }

      return channel;
    } catch (error) {
      console.error('Error creating direct message channel:', error);
      throw this.createError('CHANNEL_CREATE_FAILED', (error as Error).message);
    }
  }

  // ========================================
  // MESSAGE MANAGEMENT
  // ========================================

  /**
   * Get messages for a thread with pagination
   */
  async getMessages(
    threadId: string,
    filters?: MessageFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<InternalMessage>> {
    try {
      let query = supabase
        .from('internal_messages')
        .select(`
          *,
          users!internal_messages_sender_id_fkey(
            id,
            full_name,
            name:full_name,
            email,
            avatar,
            role
          ),
          internal_message_attachments(*),
          internal_message_reactions(
            *,
            users!internal_message_reactions_user_id_fkey(
              id,
              full_name,
              name:full_name,
              avatar
            )
          ),
          internal_message_read_receipts(
            *,
            users!internal_message_read_receipts_user_id_fkey(
              id,
              full_name,
              name:full_name,
              avatar
            )
          )
        `, { count: 'exact' })
        .eq('thread_id', threadId)
        .eq('is_deleted', false);

      // Apply filters
      if (filters) {
        if (filters.senderId) {
          query = query.eq('sender_id', filters.senderId);
        }
        if (filters.contentTypes?.length) {
          query = query.in('content_type', filters.contentTypes);
        }
        if (filters.hasAttachments !== undefined) {
          if (filters.hasAttachments) {
            query = query.not('internal_message_attachments', 'is', null);
          } else {
            query = query.is('internal_message_attachments', null);
          }
        }
        if (filters.mentions?.length) {
          query = query.overlaps('mentions', filters.mentions);
        }
        if (filters.dateRange) {
          query = query
            .gte('created_at', filters.dateRange.from)
            .lte('created_at', filters.dateRange.to);
        }
        if (filters.search) {
          query = query.ilike('content', `%${filters.search}%`);
        }
      }

      // Default sorting by created_at desc (newest first)
      query = query.order('created_at', { ascending: false });

      // Apply pagination
      if (pagination) {
        const offset = pagination.offset || (pagination.page - 1) * pagination.limit;
        query = query.range(offset, offset + pagination.limit - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      // Process messages to have correct sender field
      const processedMessages = (data || []).map(message => {
        const processed = { ...message };
        
        // Fix sender field
        if (processed.users) {
          processed.sender = processed.users;
          delete processed.users;
        }
        
        // Fix reactions
        if (processed.internal_message_reactions) {
          processed.reactions = processed.internal_message_reactions.map(reaction => ({
            ...reaction,
            user: reaction.users
          }));
        }
        
        // Fix read receipts
        if (processed.internal_message_read_receipts) {
          processed.read_receipts = processed.internal_message_read_receipts.map(receipt => ({
            ...receipt,
            user: receipt.users
          }));
        }
        
        return processed;
      });

      return {
        data: processedMessages.reverse(), // Reverse to show oldest first in UI
        total: count || 0,
        page: pagination?.page || 1,
        limit: pagination?.limit || data?.length || 0,
        hasMore: pagination ? (pagination.page * pagination.limit) < (count || 0) : false
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw this.createError('MESSAGE_FETCH_FAILED', (error as Error).message);
    }
  }

  /**
   * Send a new message
   */
  async sendMessage(request: SendMessageRequest): Promise<InternalMessage> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get thread's practice_id
      const { data: thread, error: threadError } = await supabase
        .from('internal_message_threads')
        .select('practice_id')
        .eq('id', request.threadId)
        .single();

      if (threadError || !thread) {
        throw new Error('Thread not found');
      }

      const { data: message, error } = await supabase
        .from('internal_messages')
        .insert({
          thread_id: request.threadId,
          sender_id: user.id,
          practice_id: thread.practice_id,
          content: request.content,
          content_type: request.contentType || 'text',
          mentions: request.mentions || [],
          reply_to_message_id: request.replyToMessageId,
          importance_score: 1
        })
        .select(`
          *,
          sender:users!internal_messages_sender_id_fkey(
            id,
            full_name,
            name:full_name,
            email,
            avatar,
            role
          )
        `)
        .single();

      if (error) {
        throw new Error(`Failed to send message: ${error.message}`);
      }

      // Message already has correct sender field from the select alias

      // Handle attachments if provided
      if (request.attachments?.length) {
        const attachmentInserts = request.attachments.map(attachment => ({
          message_id: message.id,
          practice_id: message.practice_id,
          filename: attachment.filename,
          file_url: attachment.fileUrl,
          mime_type: attachment.mimeType,
          file_size: attachment.fileSize,
          uploaded_by: message.sender_id
        }));

        const { error: attachmentError } = await supabase
          .from('internal_message_attachments')
          .insert(attachmentInserts);

        if (attachmentError) {
          console.error('Failed to save attachments:', attachmentError);
        }
      }

      // Update thread and channel activity
      await this.updateThreadActivity(request.threadId);

      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw this.createError('MESSAGE_SEND_FAILED', (error as Error).message);
    }
  }

  /**
   * React to a message
   */
  async addMessageReaction(
    messageId: string,
    emoji: string
  ): Promise<MessageReaction> {
    try {
      const { data: reaction, error } = await supabase
        .from('internal_message_reactions')
        .upsert({
          message_id: messageId,
          emoji,
          reaction_type: 'emoji'
        })
        .select(`
          *,
          users!internal_message_reactions_user_id_fkey(
            id,
            name,
            avatar
          )
        `)
        .single();

      if (error) {
        throw new Error(`Failed to add reaction: ${error.message}`);
      }

      // Process reaction to have correct user field
      if (reaction.users) {
        reaction.user = reaction.users;
        delete reaction.users;
      }

      return reaction;
    } catch (error) {
      console.error('Error adding message reaction:', error);
      throw this.createError('REACTION_ADD_FAILED', (error as Error).message);
    }
  }

  /**
   * Mark message as read
   */
  async markMessageRead(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('internal_message_read_receipts')
        .upsert({
          message_id: messageId,
          read_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to mark message as read: ${error.message}`);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw this.createError('MESSAGE_READ_FAILED', (error as Error).message);
    }
  }

  // ========================================
  // TYPING INDICATORS
  // ========================================

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(
    channelId: string,
    isTyping: boolean = true
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('send_typing_indicator', {
        channel_uuid: channelId,
        typing_status: isTyping
      });

      if (error) {
        throw new Error(`Failed to send typing indicator: ${error.message}`);
      }
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      throw this.createError('TYPING_INDICATOR_FAILED', (error as Error).message);
    }
  }

  /**
   * Get typing indicators for a channel
   */
  async getTypingIndicators(channelId: string): Promise<TypingIndicator[]> {
    try {
      const { data, error } = await supabase
        .from('typing_indicators')
        .select(`
          *,
          users!typing_indicators_user_id_fkey(
            id,
            full_name,
            name:full_name,
            avatar
          )
        `)
        .eq('channel_id', channelId)
        .eq('is_typing', true)
        .gt('expires_at', new Date().toISOString());

      if (error) {
        throw new Error(`Failed to fetch typing indicators: ${error.message}`);
      }

      // Process typing indicators to have correct user field
      const processedIndicators = (data || []).map(indicator => {
        if (indicator.users) {
          indicator.user = indicator.users;
          delete indicator.users;
        }
        return indicator;
      });

      return processedIndicators;
    } catch (error) {
      console.error('Error fetching typing indicators:', error);
      throw this.createError('TYPING_INDICATOR_FETCH_FAILED', (error as Error).message);
    }
  }

  // ========================================
  // USER PREFERENCES
  // ========================================

  /**
   * Get user notification preferences
   */
  async getUserPreferences(
    userId: string,
    practiceId: string
  ): Promise<UserNotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('practice_id', practiceId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch user preferences: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw this.createError('PREFERENCES_FETCH_FAILED', (error as Error).message);
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    practiceId: string,
    preferences: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: userId,
          practice_id: practiceId,
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update user preferences: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw this.createError('PREFERENCES_UPDATE_FAILED', (error as Error).message);
    }
  }

  // ========================================
  // TEMPLATES
  // ========================================

  /**
   * Get notification templates
   */
  async getNotificationTemplates(
    practiceId?: string
  ): Promise<NotificationTemplate[]> {
    try {
      let query = supabase
        .from('internal_notification_templates')
        .select('*')
        .eq('is_active', true)
        .order('notification_type');

      if (practiceId) {
        query = query.or(`practice_id.eq.${practiceId},practice_id.is.null`);
      } else {
        query = query.is('practice_id', null);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch templates: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching notification templates:', error);
      throw this.createError('TEMPLATE_FETCH_FAILED', (error as Error).message);
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Update thread activity timestamp
   */
  private async updateThreadActivity(threadId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Update thread
      await supabase
        .from('internal_message_threads')
        .update({ 
          last_message_at: now,
          updated_at: now
        })
        .eq('id', threadId);

      // Update channel
      await supabase
        .from('internal_message_channels')
        .update({ 
          last_activity_at: now,
          updated_at: now
        })
        .eq('id', threadId);
    } catch (error) {
      console.error('Error updating thread activity:', error);
    }
  }

  /**
   * Create standardized error
   */
  private createError(code: string, message: string): MessagingError {
    return {
      code,
      message,
      timestamp: new Date().toISOString()
    };
  }
}

// ========================================
// EXPORT SINGLETON INSTANCE
// ========================================

export const internalMessagingService = InternalMessagingService.getInstance();
export default internalMessagingService;

// ========================================
// CONVENIENCE EXPORTS
// ========================================

export const {
  createNotification,
  getNotifications,
  markNotificationRead,
  getUnreadNotificationCount,
  dismissNotifications,
  getChannels,
  createChannel,
  createDirectMessageChannel,
  getMessages,
  sendMessage,
  addMessageReaction,
  markMessageRead,
  sendTypingIndicator,
  getTypingIndicators,
  getUserPreferences,
  updateUserPreferences,
  getNotificationTemplates
} = internalMessagingService;