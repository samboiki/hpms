// ========================================
// MESSAGING STORE
// Zustand store for internal messaging and notifications state
// ========================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  SystemNotification,
  InternalMessageChannel,
  InternalMessage,
  InternalMessageThread,
  TypingIndicator,
  UserNotificationPreferences,
  MessagingUIState,
  NotificationUIState,
  NotificationFilters,
  ChannelFilters,
  MessageFilters,
  PaginationOptions,
  MessagingError
} from '../types/internal-messaging.types';
import { internalMessagingService } from '../services/internalMessagingService';

// ========================================
// STORE STATE INTERFACE
// ========================================

interface MessagingStore {
  // ========================================
  // NOTIFICATIONS STATE
  // ========================================
  notifications: SystemNotification[];
  unreadNotificationCount: number;
  notificationFilters: NotificationFilters;
  notificationUIState: NotificationUIState;
  isLoadingNotifications: boolean;
  notificationError?: MessagingError;

  // ========================================
  // CHANNELS STATE
  // ========================================
  channels: InternalMessageChannel[];
  activeChannel: InternalMessageChannel | null;
  channelFilters: ChannelFilters;
  isLoadingChannels: boolean;
  channelError?: MessagingError;

  // ========================================
  // MESSAGES STATE
  // ========================================
  messagesByThread: Record<string, InternalMessage[]>;
  activeThread: InternalMessageThread | null;
  messageFilters: MessageFilters;
  isLoadingMessages: boolean;
  messageError?: MessagingError;

  // ========================================
  // TYPING INDICATORS
  // ========================================
  typingIndicators: Record<string, TypingIndicator[]>; // channelId -> indicators
  
  // ========================================
  // USER PREFERENCES
  // ========================================
  userPreferences: UserNotificationPreferences | null;
  isLoadingPreferences: boolean;

  // ========================================
  // UI STATE
  // ========================================
  uiState: MessagingUIState;

  // ========================================
  // NOTIFICATION ACTIONS
  // ========================================
  loadNotifications: (userId: string, practiceId: string, filters?: NotificationFilters, pagination?: PaginationOptions) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  dismissNotifications: (notificationIds: string[]) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateNotificationFilters: (filters: Partial<NotificationFilters>) => void;
  updateNotificationUIState: (state: Partial<NotificationUIState>) => void;
  addNotification: (notification: SystemNotification) => void;
  removeNotification: (notificationId: string) => void;
  getUnreadCount: () => Promise<void>;

  // ========================================
  // CHANNEL ACTIONS
  // ========================================
  loadChannels: (practiceId: string, filters?: ChannelFilters, pagination?: PaginationOptions) => Promise<void>;
  setActiveChannel: (channel: InternalMessageChannel | null) => void;
  createChannel: (practiceId: string, channelType: InternalMessageChannel['channel_type'], name?: string, participantIds?: string[]) => Promise<InternalMessageChannel>;
  createDirectMessageChannel: (practiceId: string, otherUserId: string) => Promise<InternalMessageChannel>;
  updateChannelFilters: (filters: Partial<ChannelFilters>) => void;
  addChannel: (channel: InternalMessageChannel) => void;
  updateChannel: (channelId: string, updates: Partial<InternalMessageChannel>) => void;
  removeChannel: (channelId: string) => void;

  // ========================================
  // MESSAGE ACTIONS
  // ========================================
  loadMessages: (threadId: string, filters?: MessageFilters, pagination?: PaginationOptions) => Promise<void>;
  sendMessage: (threadId: string, content: string, contentType?: InternalMessage['content_type'], mentions?: string[]) => Promise<void>;
  addMessage: (message: InternalMessage) => void;
  updateMessage: (messageId: string, updates: Partial<InternalMessage>) => void;
  deleteMessage: (messageId: string) => void;
  addMessageReaction: (messageId: string, emoji: string) => Promise<void>;
  markMessageRead: (messageId: string) => Promise<void>;
  updateMessageFilters: (filters: Partial<MessageFilters>) => void;

  // ========================================
  // TYPING ACTIONS
  // ========================================
  sendTypingIndicator: (channelId: string, isTyping: boolean) => Promise<void>;
  updateTypingIndicators: (channelId: string, indicators: TypingIndicator[]) => void;
  addTypingIndicator: (channelId: string, indicator: TypingIndicator) => void;
  removeTypingIndicator: (channelId: string, userId: string) => void;

  // ========================================
  // PREFERENCE ACTIONS
  // ========================================
  loadUserPreferences: (userId: string, practiceId: string) => Promise<void>;
  updateUserPreferences: (userId: string, practiceId: string, preferences: Partial<UserNotificationPreferences>) => Promise<void>;

  // ========================================
  // UI ACTIONS
  // ========================================
  updateUIState: (state: Partial<MessagingUIState>) => void;
  toggleChannelList: () => void;
  toggleNotificationPanel: () => void;
  setMobileView: (isMobile: boolean) => void;
  setConnectionStatus: (status: MessagingUIState['connectionStatus']) => void;
  clearError: (errorType: 'notification' | 'channel' | 'message') => void;
  reset: () => void;
}

// ========================================
// INITIAL STATE
// ========================================

const initialNotificationUIState: NotificationUIState = {
  groupByType: false,
  showOnlyUnread: false,
  sortBy: 'date',
  sortOrder: 'desc',
  activeFilters: {},
  selectedNotificationIds: [],
  isMarkingAllAsRead: false,
  isDismissingSelected: false
};

const initialUIState: MessagingUIState = {
  activeChannelId: undefined,
  activeThreadId: undefined,
  isChannelListOpen: true,
  isNotificationPanelOpen: false,
  isMobileView: false,
  isLoadingChannels: false,
  isLoadingMessages: false,
  isLoadingNotifications: false,
  messageInput: '',
  isTyping: false,
  mentionSuggestions: [],
  channelSearch: '',
  messageSearch: '',
  notificationFilters: {},
  connectionStatus: 'connected'
};

// ========================================
// STORE IMPLEMENTATION
// ========================================

export const useMessagingStore = create<MessagingStore>()(subscribeWithSelector((set, get) => ({
  // ========================================
  // INITIAL STATE
  // ========================================
  notifications: [],
  unreadNotificationCount: 0,
  notificationFilters: {},
  notificationUIState: initialNotificationUIState,
  isLoadingNotifications: false,
  
  channels: [],
  activeChannel: null,
  channelFilters: {},
  isLoadingChannels: false,
  
  messagesByThread: {},
  activeThread: null,
  messageFilters: {},
  isLoadingMessages: false,
  
  typingIndicators: {},
  
  userPreferences: null,
  isLoadingPreferences: false,
  
  uiState: initialUIState,

  // ========================================
  // NOTIFICATION ACTIONS
  // ========================================
  
  loadNotifications: async (userId: string, practiceId: string, filters?: NotificationFilters, pagination?: PaginationOptions) => {
    set({ isLoadingNotifications: true, notificationError: undefined });
    
    try {
      const response = await internalMessagingService.getNotifications(
        userId,
        practiceId,
        filters,
        pagination
      );
      
      set(state => ({
        notifications: pagination?.page === 1 ? response.data : [...state.notifications, ...response.data],
        isLoadingNotifications: false
      }));
      
      // Also update unread count
      get().getUnreadCount();
    } catch (error) {
      set({ 
        isLoadingNotifications: false, 
        notificationError: error as MessagingError
      });
    }
  },

  markNotificationRead: async (notificationId: string) => {
    try {
      await internalMessagingService.markNotificationRead(notificationId);
      
      set(state => ({
        notifications: state.notifications.map(n => 
          n.id === notificationId 
            ? { ...n, status: 'read', read_at: new Date().toISOString() }
            : n
        ),
        unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1)
      }));
    } catch (error) {
      set({ notificationError: error as MessagingError });
    }
  },

  dismissNotifications: async (notificationIds: string[]) => {
    set(state => ({ 
      notificationUIState: { ...state.notificationUIState, isDismissingSelected: true }
    }));
    
    try {
      await internalMessagingService.dismissNotifications(notificationIds);
      
      set(state => ({
        notifications: state.notifications.filter(n => !notificationIds.includes(n.id)),
        notificationUIState: { 
          ...state.notificationUIState, 
          isDismissingSelected: false,
          selectedNotificationIds: []
        }
      }));
    } catch (error) {
      set(state => ({
        notificationError: error as MessagingError,
        notificationUIState: { ...state.notificationUIState, isDismissingSelected: false }
      }));
    }
  },

  markAllNotificationsRead: async () => {
    const { notifications } = get();
    const unreadIds = notifications.filter(n => n.status === 'pending' || n.status === 'delivered').map(n => n.id);
    
    if (unreadIds.length === 0) return;
    
    set(state => ({ 
      notificationUIState: { ...state.notificationUIState, isMarkingAllAsRead: true }
    }));
    
    try {
      // Mark all as read individually (could be optimized with bulk operation)
      await Promise.all(unreadIds.map(id => internalMessagingService.markNotificationRead(id)));
      
      set(state => ({
        notifications: state.notifications.map(n => 
          unreadIds.includes(n.id)
            ? { ...n, status: 'read', read_at: new Date().toISOString() }
            : n
        ),
        unreadNotificationCount: 0,
        notificationUIState: { ...state.notificationUIState, isMarkingAllAsRead: false }
      }));
    } catch (error) {
      set(state => ({
        notificationError: error as MessagingError,
        notificationUIState: { ...state.notificationUIState, isMarkingAllAsRead: false }
      }));
    }
  },

  updateNotificationFilters: (filters: Partial<NotificationFilters>) => {
    set(state => ({
      notificationFilters: { ...state.notificationFilters, ...filters }
    }));
  },

  updateNotificationUIState: (state: Partial<NotificationUIState>) => {
    set(currentState => ({
      notificationUIState: { ...currentState.notificationUIState, ...state }
    }));
  },

  addNotification: (notification: SystemNotification) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadNotificationCount: notification.status === 'pending' || notification.status === 'delivered' 
        ? state.unreadNotificationCount + 1 
        : state.unreadNotificationCount
    }));
  },

  removeNotification: (notificationId: string) => {
    set(state => {
      const notification = state.notifications.find(n => n.id === notificationId);
      const wasUnread = notification && (notification.status === 'pending' || notification.status === 'delivered');
      
      return {
        notifications: state.notifications.filter(n => n.id !== notificationId),
        unreadNotificationCount: wasUnread 
          ? Math.max(0, state.unreadNotificationCount - 1)
          : state.unreadNotificationCount
      };
    });
  },

  getUnreadCount: async () => {
    try {
      const count = await internalMessagingService.getUnreadNotificationCount();
      set({ unreadNotificationCount: count });
    } catch (error) {
      console.error('Failed to get unread notification count:', error);
    }
  },

  // ========================================
  // CHANNEL ACTIONS
  // ========================================
  
  loadChannels: async (practiceId: string, filters?: ChannelFilters, pagination?: PaginationOptions) => {
    set({ isLoadingChannels: true, channelError: undefined });
    
    try {
      const response = await internalMessagingService.getChannels(
        practiceId,
        filters,
        pagination
      );
      
      set(state => {
        if (pagination?.page === 1 || !pagination) {
          return {
            channels: response.data,
            isLoadingChannels: false
          };
        } else {
          // Filter out duplicates when appending
          const existingIds = new Set(state.channels.map(c => c.id));
          const newChannels = response.data.filter(c => !existingIds.has(c.id));
          return {
            channels: [...state.channels, ...newChannels],
            isLoadingChannels: false
          };
        }
      });
    } catch (error) {
      set({ 
        isLoadingChannels: false, 
        channelError: error as MessagingError
      });
    }
  },

  setActiveChannel: (channel: InternalMessageChannel | null) => {
    set(state => ({
      activeChannel: channel,
      uiState: {
        ...state.uiState,
        activeChannelId: channel?.id,
        activeThreadId: undefined // Reset active thread when changing channels
      }
    }));
    
    // Load messages for the channel's default thread
    if (channel) {
      // Find the default thread or create one
      // This would typically be handled by loading threads first
    }
  },

  createChannel: async (practiceId: string, channelType: InternalMessageChannel['channel_type'], name?: string, participantIds: string[] = []) => {
    try {
      const channel = await internalMessagingService.createChannel({
        practiceId,
        channelType,
        name,
        participantIds
      });
      
      set(state => ({
        channels: [channel, ...state.channels]
      }));
      
      return channel;
    } catch (error) {
      set({ channelError: error as MessagingError });
      throw error;
    }
  },

  createDirectMessageChannel: async (practiceId: string, otherUserId: string) => {
    try {
      const channel = await internalMessagingService.createDirectMessageChannel(practiceId, otherUserId);
      
      // Check if channel already exists in state
      const { channels } = get();
      const existingChannel = channels.find(c => c.id === channel.id);
      
      if (!existingChannel) {
        set(state => ({
          channels: [channel, ...state.channels]
        }));
      }
      
      return channel;
    } catch (error) {
      set({ channelError: error as MessagingError });
      throw error;
    }
  },

  updateChannelFilters: (filters: Partial<ChannelFilters>) => {
    set(state => ({
      channelFilters: { ...state.channelFilters, ...filters }
    }));
  },

  addChannel: (channel: InternalMessageChannel) => {
    set(state => ({
      channels: [channel, ...state.channels]
    }));
  },

  updateChannel: (channelId: string, updates: Partial<InternalMessageChannel>) => {
    set(state => ({
      channels: state.channels.map(c => 
        c.id === channelId ? { ...c, ...updates } : c
      ),
      activeChannel: state.activeChannel?.id === channelId 
        ? { ...state.activeChannel, ...updates }
        : state.activeChannel
    }));
  },

  removeChannel: (channelId: string) => {
    set(state => ({
      channels: state.channels.filter(c => c.id !== channelId),
      activeChannel: state.activeChannel?.id === channelId ? null : state.activeChannel
    }));
  },

  // ========================================
  // MESSAGE ACTIONS
  // ========================================
  
  loadMessages: async (threadId: string, filters?: MessageFilters, pagination?: PaginationOptions) => {
    set({ isLoadingMessages: true, messageError: undefined });
    
    try {
      const response = await internalMessagingService.getMessages(
        threadId,
        filters,
        pagination
      );
      
      set(state => ({
        messagesByThread: {
          ...state.messagesByThread,
          [threadId]: pagination?.page === 1 
            ? response.data 
            : [...(state.messagesByThread[threadId] || []), ...response.data]
        },
        isLoadingMessages: false
      }));
    } catch (error) {
      set({ 
        isLoadingMessages: false, 
        messageError: error as MessagingError
      });
    }
  },

  sendMessage: async (threadId: string, content: string, contentType?: InternalMessage['content_type'], mentions?: string[]) => {
    try {
      const message = await internalMessagingService.sendMessage({
        threadId,
        content,
        contentType,
        mentions
      });
      
      get().addMessage(message);
    } catch (error) {
      set({ messageError: error as MessagingError });
      throw error;
    }
  },

  addMessage: (message: InternalMessage) => {
    set(state => ({
      messagesByThread: {
        ...state.messagesByThread,
        [message.thread_id]: [
          ...(state.messagesByThread[message.thread_id] || []),
          message
        ]
      }
    }));
  },

  updateMessage: (messageId: string, updates: Partial<InternalMessage>) => {
    set(state => {
      const newMessagesByThread = { ...state.messagesByThread };
      
      Object.keys(newMessagesByThread).forEach(threadId => {
        newMessagesByThread[threadId] = newMessagesByThread[threadId].map(m => 
          m.id === messageId ? { ...m, ...updates } : m
        );
      });
      
      return { messagesByThread: newMessagesByThread };
    });
  },

  deleteMessage: (messageId: string) => {
    get().updateMessage(messageId, { is_deleted: true });
  },

  addMessageReaction: async (messageId: string, emoji: string) => {
    try {
      const reaction = await internalMessagingService.addMessageReaction(messageId, emoji);
      
      // Update message with new reaction
      set(state => {
        const newMessagesByThread = { ...state.messagesByThread };
        
        Object.keys(newMessagesByThread).forEach(threadId => {
          newMessagesByThread[threadId] = newMessagesByThread[threadId].map(m => {
            if (m.id === messageId) {
              const existingReactions = m.reactions || [];
              const updatedReactions = [...existingReactions, reaction];
              return { ...m, reactions: updatedReactions };
            }
            return m;
          });
        });
        
        return { messagesByThread: newMessagesByThread };
      });
    } catch (error) {
      set({ messageError: error as MessagingError });
    }
  },

  markMessageRead: async (messageId: string) => {
    try {
      await internalMessagingService.markMessageRead(messageId);
      // The read receipt will be handled by real-time updates
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  },

  updateMessageFilters: (filters: Partial<MessageFilters>) => {
    set(state => ({
      messageFilters: { ...state.messageFilters, ...filters }
    }));
  },

  // ========================================
  // TYPING ACTIONS
  // ========================================
  
  sendTypingIndicator: async (channelId: string, isTyping: boolean) => {
    try {
      await internalMessagingService.sendTypingIndicator(channelId, isTyping);
      
      set(state => ({
        uiState: { ...state.uiState, isTyping }
      }));
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  },

  updateTypingIndicators: (channelId: string, indicators: TypingIndicator[]) => {
    set(state => ({
      typingIndicators: {
        ...state.typingIndicators,
        [channelId]: indicators
      }
    }));
  },

  addTypingIndicator: (channelId: string, indicator: TypingIndicator) => {
    set(state => {
      const currentIndicators = state.typingIndicators[channelId] || [];
      const filteredIndicators = currentIndicators.filter(i => i.user_id !== indicator.user_id);
      
      return {
        typingIndicators: {
          ...state.typingIndicators,
          [channelId]: [...filteredIndicators, indicator]
        }
      };
    });
  },

  removeTypingIndicator: (channelId: string, userId: string) => {
    set(state => ({
      typingIndicators: {
        ...state.typingIndicators,
        [channelId]: (state.typingIndicators[channelId] || []).filter(i => i.user_id !== userId)
      }
    }));
  },

  // ========================================
  // PREFERENCE ACTIONS
  // ========================================
  
  loadUserPreferences: async (userId: string, practiceId: string) => {
    set({ isLoadingPreferences: true });
    
    try {
      const preferences = await internalMessagingService.getUserPreferences(userId, practiceId);
      set({ userPreferences: preferences, isLoadingPreferences: false });
    } catch (error) {
      set({ isLoadingPreferences: false });
      console.error('Failed to load user preferences:', error);
    }
  },

  updateUserPreferences: async (userId: string, practiceId: string, preferences: Partial<UserNotificationPreferences>) => {
    try {
      const updatedPreferences = await internalMessagingService.updateUserPreferences(
        userId,
        practiceId,
        preferences
      );
      
      set({ userPreferences: updatedPreferences });
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      throw error;
    }
  },

  // ========================================
  // UI ACTIONS
  // ========================================
  
  updateUIState: (state: Partial<MessagingUIState>) => {
    set(currentState => ({
      uiState: { ...currentState.uiState, ...state }
    }));
  },

  toggleChannelList: () => {
    set(state => ({
      uiState: {
        ...state.uiState,
        isChannelListOpen: !state.uiState.isChannelListOpen
      }
    }));
  },

  toggleNotificationPanel: () => {
    set(state => ({
      uiState: {
        ...state.uiState,
        isNotificationPanelOpen: !state.uiState.isNotificationPanelOpen
      }
    }));
  },

  setMobileView: (isMobile: boolean) => {
    set(state => ({
      uiState: { ...state.uiState, isMobileView: isMobile }
    }));
  },

  setConnectionStatus: (status: MessagingUIState['connectionStatus']) => {
    set(state => ({
      uiState: { ...state.uiState, connectionStatus: status }
    }));
  },

  clearError: (errorType: 'notification' | 'channel' | 'message') => {
    set(() => {
      const updates: Partial<MessagingStore> = {};
      
      switch (errorType) {
        case 'notification':
          updates.notificationError = undefined;
          break;
        case 'channel':
          updates.channelError = undefined;
          break;
        case 'message':
          updates.messageError = undefined;
          break;
      }
      
      return updates;
    });
  },

  reset: () => {
    set({
      notifications: [],
      unreadNotificationCount: 0,
      notificationFilters: {},
      notificationUIState: initialNotificationUIState,
      isLoadingNotifications: false,
      notificationError: undefined,
      
      channels: [],
      activeChannel: null,
      channelFilters: {},
      isLoadingChannels: false,
      channelError: undefined,
      
      messagesByThread: {},
      activeThread: null,
      messageFilters: {},
      isLoadingMessages: false,
      messageError: undefined,
      
      typingIndicators: {},
      
      userPreferences: null,
      isLoadingPreferences: false,
      
      uiState: initialUIState
    });
  }
})));

// ========================================
// SELECTORS
// ========================================

// Get messages for the active thread
export const useActiveThreadMessages = () => {
  return useMessagingStore(state => {
    const activeThreadId = state.uiState.activeThreadId;
    return activeThreadId ? state.messagesByThread[activeThreadId] || [] : [];
  });
};

// Get unread notifications
export const useUnreadNotifications = () => {
  return useMessagingStore(state => 
    state.notifications.filter(n => n.status === 'pending' || n.status === 'delivered')
  );
};

// Get typing indicators for active channel
export const useActiveChannelTypingIndicators = () => {
  return useMessagingStore(state => {
    const activeChannelId = state.uiState.activeChannelId;
    return activeChannelId ? state.typingIndicators[activeChannelId] || [] : [];
  });
};

// Get filtered channels
export const useFilteredChannels = () => {
  return useMessagingStore(state => {
    let filtered = state.channels;
    const filters = state.channelFilters;
    const search = state.uiState.channelSearch;
    
    if (filters.types?.length) {
      filtered = filtered.filter(c => filters.types!.includes(c.channel_type));
    }
    
    if (filters.isArchived !== undefined) {
      filtered = filtered.filter(c => c.is_archived === filters.isArchived);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  });
};

// Get filtered notifications
export const useFilteredNotifications = () => {
  return useMessagingStore(state => {
    let filtered = state.notifications;
    const filters = state.notificationFilters;
    const uiState = state.notificationUIState;
    
    if (uiState.showOnlyUnread) {
      filtered = filtered.filter(n => n.status === 'pending' || n.status === 'delivered');
    }
    
    if (filters.types?.length) {
      filtered = filtered.filter(n => filters.types!.includes(n.notification_type));
    }
    
    if (filters.priorities?.length) {
      filtered = filtered.filter(n => filters.priorities!.includes(n.priority));
    }
    
    // Sort notifications
    const sortField = uiState.sortBy;
    const sortOrder = uiState.sortOrder;

    // Sort a copy: with no filters active, `filtered` is the store's own array
    return [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'priority': {
          const priorityOrder = { critical: 5, urgent: 4, high: 3, normal: 2, low: 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        }
        case 'type':
          aValue = a.notification_type;
          bValue = b.notification_type;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  });
};

export default useMessagingStore;