import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';

export const BasicMessaging: React.FC<{ practiceId: string }> = ({ practiceId }) => {
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load channels
  useEffect(() => {
    loadChannels();
  }, [practiceId]);

  const loadChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_message_channels')
        .select('id, name, channel_type')
        .eq('practice_id', practiceId);

      if (error) throw error;
      setChannels(data || []);
    } catch (err: any) {
      console.error('Error loading channels:', err);
      setError(`Failed to load channels: ${err.message}`);
    }
  };

  // Load messages when channel selected
  const selectChannel = async (channelId: string) => {
    setSelectedChannelId(channelId);
    setError(null);
    setLoading(true);

    try {
      // Get thread for this channel
      const { data: threads } = await supabase
        .from('internal_message_threads')
        .select('id')
        .eq('channel_id', channelId)
        .limit(1);

      if (threads && threads.length > 0) {
        const tid = threads[0].id;
        setThreadId(tid);

        // Load messages
        const { data: msgs } = await supabase
          .from('internal_messages')
          .select('id, content, sender_id, created_at')
          .eq('thread_id', tid)
          .order('created_at');

        setMessages(msgs || []);
      } else {
        // Create thread if none exists
        const { data: newThread } = await supabase
          .from('internal_message_threads')
          .insert({
            channel_id: channelId,
            practice_id: practiceId,
            created_by: user?.id
          })
          .select()
          .single();

        if (newThread) {
          setThreadId(newThread.id);
          setMessages([]);
        }
      }
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(`Failed to load messages: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!messageInput.trim() || !threadId) return;

    const content = messageInput.trim();
    setMessageInput('');

    try {
      const { error } = await supabase
        .from('internal_messages')
        .insert({
          thread_id: threadId,
          sender_id: user?.id,
          practice_id: practiceId,
          content,
          content_type: 'text',
          mentions: [],
          importance_score: 1
        });

      if (error) throw error;

      // Reload messages
      if (selectedChannelId) {
        selectChannel(selectedChannelId);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(`Failed to send: ${err.message}`);
      setMessageInput(content);
    }
  };

  return (
    <div className="flex h-full">
      {/* Channels */}
      <div className="w-64 bg-gray-100 p-4">
        <h3 className="font-bold mb-4">Channels</h3>
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 text-sm rounded">
            {error}
          </div>
        )}
        {channels.map(channel => (
          <button
            key={channel.id}
            onClick={() => selectChannel(channel.id)}
            className={`w-full text-left p-2 mb-2 rounded ${
              selectedChannelId === channel.id ? 'bg-amber-500 text-white' : 'bg-white'
            }`}
          >
            {channel.name || 'Unnamed'}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        {selectedChannelId ? (
          <>
            <div className="flex-1 p-4 overflow-y-auto">
              {loading ? (
                <p>Loading...</p>
              ) : messages.length === 0 ? (
                <p className="text-gray-500">No messages yet</p>
              ) : (
                messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`mb-2 p-2 rounded ${
                      msg.sender_id === user?.id ? 'bg-amber-100 ml-auto' : 'bg-gray-100'
                    } max-w-md`}
                  >
                    {msg.content}
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 p-2 border rounded"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-amber-500 text-white rounded"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a channel to start messaging
          </div>
        )}
      </div>
    </div>
  );
};