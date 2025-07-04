import { supabase } from '../lib/supabase';

class UnreadMessagesService {
  private unreadCount: number = 0;
  private listeners: Set<(count: number) => void> = new Set();
  private subscription: any = null;
  private userId: string | null = null;
  private practiceId: string | null = null;
  private activeChannelId: string | null = null;
  private channelUnreadCounts: Record<string, number> = {};
  private updateTimer: NodeJS.Timeout | null = null;
  private pendingUpdate: boolean = false;

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
        // Store individual channel counts
        this.channelUnreadCounts = {};
        unreadData.forEach((channel: any) => {
          this.channelUnreadCounts[channel.channel_id] = channel.unread_count || 0;
        });
        
        // Calculate total excluding active channel
        const totalUnread = unreadData.reduce((sum: number, channel: any) => {
          // Exclude active channel from global count
          if (this.activeChannelId && channel.channel_id === this.activeChannelId) {
            return sum;
          }
          return sum + (channel.unread_count || 0);
        }, 0);
        
        console.log('[UnreadMessagesService] Total unread count (excluding active):', totalUnread);
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
        
        // Only count if not from current user and not in active channel
        if (newMessage.sender_id !== this.userId) {
          // First, we need to find which channel this message belongs to
          const { data: channelData } = await supabase
            .from('internal_message_threads')
            .select('channel_id')
            .eq('id', newMessage.thread_id)
            .single();
            
          if (channelData) {
            const messageChannelId = channelData.channel_id;
            
            // Don't increment if message is in active channel
            if (messageChannelId !== this.activeChannelId) {
              // Update channel count
              this.channelUnreadCounts[messageChannelId] = (this.channelUnreadCounts[messageChannelId] || 0) + 1;
              this.debouncedRecalculate();
            }
          }
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
      const { error } = await supabase
        .from('internal_channel_read_status')
        .upsert({
          channel_id: channelId,
          user_id: this.userId,
          last_read_at: new Date().toISOString()
        }, {
          onConflict: 'channel_id,user_id'
        });

      if (error) {
        console.error('[UnreadMessagesService] Error updating read status:', error);
        return;
      }

      // Update local channel count immediately
      if (this.channelUnreadCounts[channelId] > 0) {
        this.channelUnreadCounts[channelId] = 0;
        this.debouncedRecalculate();
      }

      // Then reload the actual count from database in background
      this.loadUnreadCount();
    } catch (error) {
      console.error('[UnreadMessagesService] Error marking channel as read:', error);
    }
  }

  // Get unread count for a specific channel
  private async getChannelUnreadCount(channelId: string): Promise<number> {
    if (!this.userId) return 0;

    try {
      const { data } = await supabase
        .rpc('get_channel_last_messages', {
          channel_ids: [channelId],
          user_id: this.userId
        });

      if (data && data.length > 0) {
        return data[0].unread_count || 0;
      }
    } catch (error) {
      console.error('[UnreadMessagesService] Error getting channel unread count:', error);
    }
    return 0;
  }

  // Set active channel (to exclude from global count)
  setActiveChannel(channelId: string | null) {
    const previousActiveChannel = this.activeChannelId;
    this.activeChannelId = channelId;
    
    // Mark channel as read immediately when selected
    if (channelId && channelId !== previousActiveChannel) {
      this.markChannelAsRead(channelId);
    }
    
    // Debounce the recalculation to prevent flickering
    this.debouncedRecalculate();
  }
  
  // Debounced recalculation to prevent flickering
  private debouncedRecalculate() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    this.updateTimer = setTimeout(() => {
      this.recalculateTotalCount();
      this.updateTimer = null;
    }, 100); // Small delay to prevent flickering
  }
  
  // Recalculate total count excluding active channel
  private recalculateTotalCount() {
    let total = 0;
    for (const [channelId, count] of Object.entries(this.channelUnreadCounts)) {
      if (this.activeChannelId && channelId === this.activeChannelId) {
        continue; // Skip active channel
      }
      total += count;
    }
    this.setUnreadCount(total);
  }
  
  // Clean up
  destroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const unreadMessagesService = new UnreadMessagesService();