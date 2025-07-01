// ========================================
// MESSAGING INTEGRATION TESTS
// Comprehensive test suite for internal messaging and notifications
// ========================================

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { supabase } from '../lib/supabase';
import { useMessagingStore } from '../stores/messagingStore';
import { InternalMessagingView } from '../components/messages/InternalMessaging/InternalMessagingView';
import { MessageThread } from '../components/messages/InternalMessaging/MessageThread';
import { ChannelList } from '../components/messages/InternalMessaging/ChannelList';
import { NotificationsList } from '../components/messages/InternalMessaging/NotificationsList';
import { useRealtimeMessaging } from '../hooks/useRealtimeMessaging';
import { internalMessagingService } from '../services/internalMessagingService';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn()
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
    rpc: vi.fn()
  }
}));

// Mock auth store
vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      role: 'doctor'
    },
    practice: {
      id: 'test-practice-id',
      name: 'Test Practice'
    }
  })
}));

describe('Messaging Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMessagingStore.getState().reset();
  });

  describe('Notification Creation and Display', () => {
    it('should create notification via edge function and display in UI', async () => {
      // Mock edge function response
      const mockNotification = {
        id: 'notif-1',
        practice_id: 'test-practice-id',
        user_id: 'test-user-id',
        notification_type: 'lab_results_uploaded',
        priority: 'high',
        title: 'New Lab Results',
        message: 'Lab results for John Doe are ready',
        status: 'pending',
        created_at: new Date().toISOString()
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: { notificationId: mockNotification.id },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockNotification,
          error: null
        })
      } as any);

      // Create notification
      const result = await internalMessagingService.createNotification({
        practiceId: 'test-practice-id',
        userId: 'test-user-id',
        notificationType: 'lab_results_uploaded',
        priority: 'high',
        title: 'New Lab Results',
        message: 'Lab results for John Doe are ready',
        triggerType: 'manual'
      });

      expect(result).toEqual(mockNotification);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('smart-notification-processor', {
        body: expect.any(Object)
      });
    });

    it('should receive real-time notifications and update store', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis()
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);

      // Set up real-time hook
      const TestComponent = () => {
        useRealtimeMessaging({
          practiceId: 'test-practice-id',
          userId: 'test-user-id',
          enabled: true
        });
        return null;
      };

      render(<TestComponent />);

      // Verify subscription setup
      expect(supabase.channel).toHaveBeenCalledWith('notifications:test-user-id');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'system_notifications',
          filter: 'user_id=eq.test-user-id'
        }),
        expect.any(Function)
      );

      // Simulate notification received
      const notificationHandler = mockChannel.on.mock.calls[0][2];
      const newNotification = {
        id: 'notif-2',
        notification_type: 'appointment_reminder',
        title: 'Appointment Tomorrow',
        status: 'pending'
      };

      notificationHandler({ new: newNotification });

      // Check store update
      const state = useMessagingStore.getState();
      expect(state.notifications).toContainEqual(newNotification);
      expect(state.unreadNotificationCount).toBe(1);
    });
  });

  describe('Message Channel Operations', () => {
    it('should create direct message channel between users', async () => {
      const mockChannel = {
        id: 'channel-1',
        practice_id: 'test-practice-id',
        channel_type: 'direct',
        created_by: 'test-user-id',
        participants: []
      };

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: mockChannel.id,
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockChannel,
          error: null
        })
      } as any);

      const result = await internalMessagingService.createDirectMessageChannel(
        'test-practice-id',
        'other-user-id'
      );

      expect(result).toEqual(mockChannel);
      expect(supabase.rpc).toHaveBeenCalledWith('create_direct_message_channel', {
        other_user_id: 'other-user-id',
        practice_uuid: 'test-practice-id'
      });
    });

    it('should load and display channels with participants', async () => {
      const mockChannels = [{
        id: 'channel-1',
        channel_type: 'direct',
        name: null,
        internal_channel_members: [{
          user_id: 'test-user-id',
          users: { name: 'Test User' }
        }, {
          user_id: 'other-user-id',
          users: { name: 'Other User' }
        }],
        internal_message_threads: [{
          id: 'thread-1',
          message_count: 5,
          internal_messages: [{
            content: 'Last message',
            created_at: new Date().toISOString()
          }]
        }]
      }];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        data: mockChannels,
        error: null,
        count: 1
      } as any);

      render(<ChannelList practiceId="test-practice-id" />);

      await waitFor(() => {
        expect(screen.getByText('Other User')).toBeInTheDocument();
        expect(screen.getByText('Last message')).toBeInTheDocument();
      });
    });
  });

  describe('Message Thread Interactions', () => {
    it('should send and display messages in thread', async () => {
      const mockThread = { id: 'thread-1' };
      const mockChannel = {
        id: 'channel-1',
        channel_type: 'direct',
        participants: []
      };

      const mockMessage = {
        id: 'msg-1',
        thread_id: 'thread-1',
        content: 'Hello world',
        sender_id: 'test-user-id',
        created_at: new Date().toISOString(),
        sender: { name: 'Test User' }
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: mockMessage,
          error: null
        })
      } as any);

      const user = userEvent.setup();
      render(
        <MessageThread 
          channel={mockChannel}
          threadId="thread-1"
        />
      );

      // Type message
      const input = screen.getByPlaceholderText('Type a message...');
      await user.type(input, 'Hello world');

      // Send message
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      // Verify message was sent
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('internal_messages');
        expect(useMessagingStore.getState().messagesByThread['thread-1']).toContainEqual(
          expect.objectContaining({ content: 'Hello world' })
        );
      });
    });

    it('should display typing indicators', async () => {
      const mockChannel = {
        id: 'channel-1',
        channel_type: 'direct',
        participants: []
      };

      // Set typing indicators in store
      useMessagingStore.getState().addTypingIndicator('channel-1', {
        channel_id: 'channel-1',
        user_id: 'other-user-id',
        is_typing: true,
        user: { name: 'Other User' }
      });

      render(
        <MessageThread 
          channel={mockChannel}
          threadId="thread-1"
        />
      );

      expect(screen.getByText('Other User typing...')).toBeInTheDocument();
    });
  });

  describe('Notification Triggers', () => {
    it('should trigger notification on visit status change', async () => {
      // Mock trigger function execution
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: true,
        error: null
      });

      // Simulate visit status update
      const visitUpdate = {
        id: 'visit-1',
        practice_id: 'test-practice-id',
        status: 'completed',
        patient_name: 'John Doe'
      };

      // This would normally be triggered by database trigger
      // Here we test the notification creation flow
      const notification = await internalMessagingService.createNotification({
        practiceId: visitUpdate.practice_id,
        userId: 'test-user-id',
        notificationType: 'visit_completed',
        title: 'Visit Completed',
        message: `Visit for ${visitUpdate.patient_name} has been completed`,
        visitId: visitUpdate.id,
        triggerType: 'automatic'
      });

      expect(notification).toBeDefined();
      expect(supabase.functions.invoke).toHaveBeenCalled();
    });
  });

  describe('UI Integration Tests', () => {
    it('should mark notification as read when clicked', async () => {
      // Set up initial notification
      const notification = {
        id: 'notif-1',
        title: 'Test Notification',
        message: 'Test message',
        status: 'pending',
        notification_type: 'general',
        priority: 'normal',
        created_at: new Date().toISOString()
      };

      useMessagingStore.getState().addNotification(notification);

      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null
      });

      const user = userEvent.setup();
      render(<NotificationsList />);

      // Click notification
      const notificationElement = screen.getByText('Test Notification');
      await user.click(notificationElement);

      // Verify marked as read
      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith('mark_notification_read', {
          notification_uuid: 'notif-1'
        });
        
        const updatedNotification = useMessagingStore.getState().notifications.find(
          n => n.id === 'notif-1'
        );
        expect(updatedNotification?.status).toBe('read');
      });
    });

    it('should show unread count in UI', () => {
      // Add unread notifications
      useMessagingStore.getState().addNotification({
        id: 'notif-1',
        status: 'pending',
        notification_type: 'general'
      });
      useMessagingStore.getState().addNotification({
        id: 'notif-2',
        status: 'delivered',
        notification_type: 'general'
      });

      const state = useMessagingStore.getState();
      expect(state.unreadNotificationCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle notification creation errors', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Network error' }
      });

      await expect(
        internalMessagingService.createNotification({
          practiceId: 'test-practice-id',
          userId: 'test-user-id',
          notificationType: 'general',
          title: 'Test',
          message: 'Test',
          triggerType: 'manual'
        })
      ).rejects.toThrow('Failed to create notification');
    });

    it('should handle message send errors', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Send failed' }
        })
      } as any);

      await expect(
        internalMessagingService.sendMessage({
          threadId: 'thread-1',
          content: 'Test message'
        })
      ).rejects.toThrow('Failed to send message');
    });
  });
});

// Real-time subscription cleanup test
describe('Real-time Subscription Cleanup', () => {
  it('should clean up subscriptions on unmount', () => {
    const { unmount } = render(
      <InternalMessagingView />
    );

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});