import { supabase } from '../lib/supabase';

class UnreadMessagesService {
  private unreadCount: number = 0;
  private listeners: Set<(count: number) => void> = new Set();
  private subscription: any = null;
  private userId: string | null = null;
  private practiceId: string | null = null;

  // Initialize the service
  async initialize(userId: string, practiceId: string) {
    console.log('[UnreadMessagesService] Initializing with userId:', userId, 'practiceId:', practiceId);
    this.userId = userId;
    this.practiceId = practiceId;
    
    // Load initial unread count
    await this.loadUnreadCount();
    
    // Set up real-time subscription
    this.setupSubscription();
  }

  // Load unread count from database
  async loadUnreadCount() {
    if (!this.userId || !this.practiceId) return;

    console.log('[UnreadMessagesService] Loading unread count...');
    try {
      // Get all channels user is member of
      const { data: channels, error: channelsError } = await supabase
        .from('internal_channel_members')
        .select(`
          channel_id,
          internal_message_channels!inner(id)
        `)
        .eq('user_id', this.userId)
        .eq('practice_id', this.practiceId);

      if (channelsError) {
        console.error('[UnreadMessagesService] Error loading channels:', channelsError);
        return;
      }

      console.log('[UnreadMessagesService] Found channels:', channels?.length || 0);

      if (!channels || channels.length === 0) {
        this.setUnreadCount(0);
        return;
      }

      const channelIds = channels.map(c => c.channel_id);

      // Get unread counts using the RPC function
      const { data: unreadData, error: rpcError } = await supabase
        .rpc('get_channel_last_messages', {
          channel_ids: channelIds,
          user_id: this.userId
        });

      if (rpcError) {
        console.error('[UnreadMessagesService] RPC error:', rpcError);
        return;
      }

      console.log('[UnreadMessagesService] RPC response:', unreadData);

      if (unreadData) {
        const totalUnread = unreadData.reduce((sum: number, channel: any) => 
          sum + (channel.unread_count || 0), 0
        );
        console.log('[UnreadMessagesService] Total unread count:', totalUnread);
        this.setUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error('[UnreadMessagesService] Error loading unread count:', error);
    }
  }

  // Set up real-time subscription
  private setupSubscription() {
    if (!this.practiceId) return;

    // Clean up existing subscription
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    // Subscribe to new messages
    this.subscription = supabase
      .channel(`unread-messages-${this.practiceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'internal_messages',
        filter: `practice_id=eq.${this.practiceId}`
      }, async (payload) => {
        const newMessage = payload.new;
        
        // Only count if not from current user
        if (newMessage.sender_id !== this.userId) {
          // Increment unread count
          this.setUnreadCount(this.unreadCount + 1);
        }
      })
      .subscribe();
  }

  // Update unread count and notify listeners
  private setUnreadCount(count: number) {
    this.unreadCount = count;
    this.notifyListeners();
  }

  // Subscribe to unread count changes
  subscribe(callback: (count: number) => void) {
    this.listeners.add(callback);
    // Immediately call with current count
    callback(this.unreadCount);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Notify all listeners of count change
  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.unreadCount));
  }

  // Get current unread count
  getUnreadCount(): number {
    return this.unreadCount;
  }

  // Mark channel as read
  async markChannelAsRead(channelId: string) {
    if (!this.userId) return;

    try {
      // Update read status
      await supabase
        .from('internal_channel_read_status')
        .upsert({
          channel_id: channelId,
          user_id: this.userId,
          last_read_at: new Date().toISOString()
        }, {
          onConflict: 'channel_id,user_id'
        });

      // Reload unread count
      await this.loadUnreadCount();
    } catch (error) {
      console.error('Error marking channel as read:', error);
    }
  }

  // Clean up
  destroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const unreadMessagesService = new UnreadMessagesService();