import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useMessagingStore } from '../stores/messagingStore';
import { 
  SystemNotification, 
  InternalMessage, 
  InternalMessageChannel,
  TypingIndicator 
} from '../types/internal-messaging.types';

interface UseRealtimeMessagingOptions {
  practiceId: string;
  userId: string;
  enabled?: boolean;
}

export const useRealtimeMessaging = ({ 
  practiceId, 
  userId, 
  enabled = true 
}: UseRealtimeMessagingOptions) => {
  const {
    addNotification,
    addMessage,
    updateMessage,
    addChannel,
    updateChannel,
    addTypingIndicator,
    removeTypingIndicator,
    setConnectionStatus,
    activeChannel,
    uiState
  } = useMessagingStore();

  const subscriptionsRef = useRef<{
    notifications?: ReturnType<typeof supabase.channel>;
    channels?: ReturnType<typeof supabase.channel>;
    messages?: ReturnType<typeof supabase.channel>;
    typing?: ReturnType<typeof supabase.channel>;
  }>({});

  useEffect(() => {
    if (!enabled || !practiceId || !userId) return;

    const setupSubscriptions = async () => {
      setConnectionStatus('connecting');

      try {
        // Subscribe to notifications
        subscriptionsRef.current.notifications = supabase
          .channel(`notifications:${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'system_notifications',
              filter: `user_id=eq.${userId}`
            },
            (payload) => {
              console.log('New notification:', payload);
              addNotification(payload.new as SystemNotification);
            }
          )
          .subscribe();

        // Subscribe to channels
        subscriptionsRef.current.channels = supabase
          .channel(`channels:${practiceId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'internal_message_channels',
              filter: `practice_id=eq.${practiceId}`
            },
            (payload) => {
              console.log('Channel update:', payload);
              if (payload.eventType === 'INSERT') {
                addChannel(payload.new as InternalMessageChannel);
              } else if (payload.eventType === 'UPDATE') {
                updateChannel(payload.new.id, payload.new as Partial<InternalMessageChannel>);
              }
            }
          )
          .subscribe();

        // Subscribe to messages in active channel
        if (activeChannel?.id) {
          subscriptionsRef.current.messages = supabase
            .channel(`messages:${activeChannel.id}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'internal_messages',
                filter: `thread_id=eq.${uiState.activeThreadId}`
              },
              (payload) => {
                console.log('New message:', payload);
                addMessage(payload.new as InternalMessage);
              }
            )
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'internal_messages',
                filter: `thread_id=eq.${uiState.activeThreadId}`
              },
              (payload) => {
                console.log('Message update:', payload);
                updateMessage(payload.new.id, payload.new as Partial<InternalMessage>);
              }
            )
            .subscribe();
        }

        // Subscribe to typing indicators
        if (activeChannel?.id) {
          subscriptionsRef.current.typing = supabase
            .channel(`typing:${activeChannel.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'typing_indicators',
                filter: `channel_id=eq.${activeChannel.id}`
              },
              (payload) => {
                console.log('Typing indicator update:', payload);
                const indicator = payload.new as TypingIndicator;
                
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  if (indicator.is_typing && indicator.user_id !== userId) {
                    addTypingIndicator(activeChannel.id, indicator);
                  } else if (!indicator.is_typing) {
                    removeTypingIndicator(activeChannel.id, indicator.user_id);
                  }
                } else if (payload.eventType === 'DELETE') {
                  removeTypingIndicator(activeChannel.id, payload.old.user_id);
                }
              }
            )
            .subscribe();
        }

        setConnectionStatus('connected');
      } catch (error) {
        console.error('Error setting up realtime subscriptions:', error);
        setConnectionStatus('error');
      }
    };

    setupSubscriptions();

    // Cleanup function
    return () => {
      Object.values(subscriptionsRef.current).forEach(subscription => {
        if (subscription) {
          supabase.removeChannel(subscription);
        }
      });
      subscriptionsRef.current = {};
    };
  }, [
    enabled, 
    practiceId, 
    userId, 
    activeChannel?.id,
    uiState.activeThreadId,
    addNotification,
    addMessage,
    updateMessage,
    addChannel,
    updateChannel,
    addTypingIndicator,
    removeTypingIndicator,
    setConnectionStatus
  ]);

  // Re-subscribe to messages when active channel changes
  useEffect(() => {
    if (!enabled || !activeChannel?.id || !uiState.activeThreadId) return;

    // Unsubscribe from previous messages channel
    if (subscriptionsRef.current.messages) {
      supabase.removeChannel(subscriptionsRef.current.messages);
    }

    // Subscribe to new messages channel
    subscriptionsRef.current.messages = supabase
      .channel(`messages:${activeChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
          filter: `thread_id=eq.${uiState.activeThreadId}`
        },
        (payload) => {
          console.log('New message in new channel:', payload);
          addMessage(payload.new as InternalMessage);
        }
      )
      .subscribe();

    // Also update typing indicators subscription
    if (subscriptionsRef.current.typing) {
      supabase.removeChannel(subscriptionsRef.current.typing);
    }

    subscriptionsRef.current.typing = supabase
      .channel(`typing:${activeChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `channel_id=eq.${activeChannel.id}`
        },
        (payload) => {
          const indicator = payload.new as TypingIndicator;
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (indicator.is_typing && indicator.user_id !== userId) {
              addTypingIndicator(activeChannel.id, indicator);
            } else if (!indicator.is_typing) {
              removeTypingIndicator(activeChannel.id, indicator.user_id);
            }
          }
        }
      )
      .subscribe();

  }, [
    enabled,
    activeChannel?.id, 
    uiState.activeThreadId,
    userId,
    addMessage,
    addTypingIndicator,
    removeTypingIndicator
  ]);
};

// Hook for notification-specific subscriptions
export const useNotificationSubscription = (userId: string, practiceId: string) => {
  const { addNotification, removeNotification, getUnreadCount } = useMessagingStore();

  useEffect(() => {
    if (!userId || !practiceId) return;

    const subscription = supabase
      .channel(`user-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          addNotification(payload.new as SystemNotification);
          getUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const notification = payload.new as SystemNotification;
          if (notification.status === 'dismissed') {
            removeNotification(notification.id);
          }
          getUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId, practiceId, addNotification, removeNotification, getUnreadCount]);
};

// Hook for channel-specific message subscriptions
export const useChannelMessageSubscription = (channelId: string, threadId: string) => {
  const { addMessage, updateMessage } = useMessagingStore();

  useEffect(() => {
    if (!channelId || !threadId) return;

    const subscription = supabase
      .channel(`channel-messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          addMessage(payload.new as InternalMessage);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          updateMessage(payload.new.id, payload.new as Partial<InternalMessage>);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channelId, threadId, addMessage, updateMessage]);
};