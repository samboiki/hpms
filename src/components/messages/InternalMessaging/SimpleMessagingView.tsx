import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { cn } from '../../../utils/cn';

interface Channel {
  id: string;
  name: string;
  channel_type: string;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: {
    full_name: string;
  };
}

export const SimpleMessagingView: React.FC<{ practiceId: string }> = ({ practiceId }) => {
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load channels
  useEffect(() => {
    const loadChannels = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('internal_message_channels')
          .select('*')
          .eq('practice_id', practiceId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setChannels(data || []);
      } catch (err: any) {
        console.error('Error loading channels:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadChannels();
  }, [practiceId]);

  // Load messages when channel is selected
  useEffect(() => {
    if (!selectedChannel || !threadId) return;

    const loadMessages = async () => {
      try {
        // First get messages
        const { data: messages, error: messagesError } = await supabase
          .from('internal_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        // Then get sender names separately
        if (messages && messages.length > 0) {
          const senderIds = [...new Set(messages.map(m => m.sender_id))];
          const { data: users } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', senderIds);

          // Map sender names to messages
          const messagesWithSenders = messages.map(msg => ({
            ...msg,
            sender: users?.find(u => u.id === msg.sender_id)
          }));

          setMessages(messagesWithSenders);
        } else {
          setMessages([]);
        }
      } catch (err: any) {
        console.error('Error loading messages:', err);
      }
    };

    loadMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages:${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'internal_messages',
        filter: `thread_id=eq.${threadId}`
      }, (payload) => {
        loadMessages();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [threadId]);

  // Handle channel selection
  const handleChannelSelect = async (channel: Channel) => {
    setSelectedChannel(channel);
    setError(null);
    
    try {
      // Get or create thread
      const { data: thread, error } = await supabase
        .rpc('get_or_create_thread', { p_channel_id: channel.id });
      
      if (error) throw error;
      setThreadId(thread);
    } catch (err: any) {
      console.error('Error getting thread:', err);
      setError('Failed to load conversation');
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !threadId || !selectedChannel) return;

    const content = messageInput.trim();
    setMessageInput('');

    try {
      // Get thread's practice_id
      const { data: thread } = await supabase
        .from('internal_message_threads')
        .select('practice_id')
        .eq('id', threadId)
        .single();

      const { error } = await supabase
        .from('internal_messages')
        .insert({
          thread_id: threadId,
          sender_id: user?.id,
          practice_id: thread?.practice_id || practiceId,
          content,
          content_type: 'text',
          mentions: [],
          importance_score: 1
        });

      if (error) throw error;
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      setMessageInput(content); // Restore input on error
    }
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Channel List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Icon icon="solar:chat-square-bold-duotone" className="w-5 h-5 text-amber-500" />
            Messages
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelSelect(channel)}
                  className={cn(
                    "w-full p-4 hover:bg-gray-50 text-left transition-colors",
                    selectedChannel?.id === channel.id && "bg-amber-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      selectedChannel?.id === channel.id 
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white" 
                        : "bg-gray-100 text-gray-600"
                    )}>
                      <Icon 
                        icon={
                          channel.channel_type === 'direct' 
                            ? "solar:chat-round-bold-duotone"
                            : channel.channel_type === 'group'
                            ? "solar:users-group-rounded-bold-duotone"
                            : "solar:megaphone-bold-duotone"
                        } 
                        className="w-5 h-5" 
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {channel.name || 'Unnamed Channel'}
                      </h4>
                      <p className="text-xs text-gray-500 capitalize">
                        {channel.channel_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <h3 className="font-semibold text-gray-900">
                {selectedChannel.name || 'Conversation'}
              </h3>
              {error && (
                <p className="text-sm text-red-500 mt-1">{error}</p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No messages yet</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.sender_id === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        isOwnMessage ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[70%] space-y-1",
                        isOwnMessage && "items-end"
                      )}>
                        {!isOwnMessage && (
                          <p className="text-xs text-gray-600 font-medium">
                            {message.sender?.full_name || 'Unknown'}
                          </p>
                        )}
                        <div className={cn(
                          "px-4 py-2 rounded-2xl",
                          isOwnMessage 
                            ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white" 
                            : "bg-gray-100 text-gray-900"
                        )}>
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    messageInput.trim() 
                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700" 
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  )}
                >
                  <Icon icon="solar:plain-bold-duotone" className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Icon icon="solar:chat-square-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};