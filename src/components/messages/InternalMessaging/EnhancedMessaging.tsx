import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { format } from 'date-fns';
import { cn } from '../../../utils/cn';

export const EnhancedMessaging: React.FC<{ practiceId: string }> = ({ practiceId }) => {
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ========== ENHANCEMENT 1: User names cache ==========
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  
  // ========== ENHANCEMENT 2: Auto-scroll to bottom ==========
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // ========== ENHANCEMENT 3: Real-time subscription ==========
  const [subscription, setSubscription] = useState<any>(null);

  // Load channels
  useEffect(() => {
    loadChannels();
  }, [practiceId]);

  // ========== ENHANCEMENT 2: Scroll to bottom when messages change ==========
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_message_channels')
        .select('id, name, channel_type, created_at') // Added created_at
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false }); // ========== ENHANCEMENT 4: Sort by newest ==========

      if (error) throw error;
      setChannels(data || []);
    } catch (err: any) {
      console.error('Error loading channels:', err);
      setError(`Failed to load channels: ${err.message}`);
    }
  };

  // ========== ENHANCEMENT 1: Load user names ==========
  const loadUserNames = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', userIds);
      
      if (data) {
        const names: Record<string, string> = {};
        data.forEach(user => {
          names[user.id] = user.full_name;
        });
        setUserNames(prev => ({ ...prev, ...names }));
      }
    } catch (err) {
      console.error('Error loading user names:', err);
    }
  };

  // Load messages when channel selected
  const selectChannel = async (channelId: string) => {
    setSelectedChannelId(channelId);
    setError(null);
    setLoading(true);
    
    // ========== ENHANCEMENT 3: Clean up previous subscription ==========
    if (subscription) {
      subscription.unsubscribe();
    }

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
        
        // ========== ENHANCEMENT 1: Load names for all senders ==========
        if (msgs && msgs.length > 0) {
          const senderIds = [...new Set(msgs.map(m => m.sender_id))];
          loadUserNames(senderIds);
        }
        
        // ========== ENHANCEMENT 3: Subscribe to new messages ==========
        const newSub = supabase
          .channel(`messages:${tid}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'internal_messages',
            filter: `thread_id=eq.${tid}`
          }, (payload) => {
            console.log('Real-time message received:', payload);
            const newMessage = payload.new as any;
            // Only add if not already in the list (avoid duplicates from own messages)
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMessage.id);
              if (!exists) {
                loadUserNames([newMessage.sender_id]);
                return [...prev, newMessage];
              }
              return prev;
            });
          })
          .subscribe((status) => {
            console.log('Subscription status:', status);
          });
          
        setSubscription(newSub);
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

  // ========== ENHANCEMENT 3: Cleanup subscription on unmount ==========
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [subscription]);

  // Send message
  const sendMessage = async () => {
    if (!messageInput.trim() || !threadId) return;

    const content = messageInput.trim();
    setMessageInput('');

    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .insert({
          thread_id: threadId,
          sender_id: user?.id,
          practice_id: practiceId,
          content,
          content_type: 'text',
          mentions: [],
          importance_score: 1
        })
        .select()
        .single();

      if (error) throw error;
      
      // ========== ENHANCEMENT 3: Add message immediately for sender ==========
      // Real-time will update for other users
      if (data) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === data.id);
          if (!exists) {
            return [...prev, data];
          }
          return prev;
        });
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(`Failed to send: ${err.message}`);
      setMessageInput(content);
    }
  };
  
  // ========== ENHANCEMENT 5: Get channel icon ==========
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'direct': return 'solar:chat-round-bold-duotone';
      case 'group': return 'solar:users-group-rounded-bold-duotone';
      case 'announcement': return 'solar:megaphone-bold-duotone';
      default: return 'solar:chat-square-bold-duotone';
    }
  };

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Channels - Enhanced UI */}
      <div className="w-80 bg-gray-50 border-r border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Icon icon="solar:chat-square-bold-duotone" className="w-5 h-5 text-amber-500" />
            Messages
          </h3>
        </div>
        
        {error && (
          <div className="m-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4" />
            {error}
          </div>
        )}
        
        <div className="overflow-y-auto">
          {channels.map(channel => (
            <button
              key={channel.id}
              onClick={() => selectChannel(channel.id)}
              className={cn(
                "w-full text-left p-4 border-b border-gray-100 hover:bg-gray-100 transition-colors",
                selectedChannelId === channel.id && "bg-amber-50 border-amber-200"
              )}
            >
              <div className="flex items-center gap-3">
                {/* ========== ENHANCEMENT 5: Channel icons ==========*/}
                <div className={cn(
                  "p-2 rounded-lg",
                  selectedChannelId === channel.id 
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                    : "bg-gray-200 text-gray-600"
                )}>
                  <Icon icon={getChannelIcon(channel.channel_type)} className="w-5 h-5" />
                </div>
                <div className="flex-1">
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
      </div>

      {/* Messages - Enhanced UI */}
      <div className="flex-1 flex flex-col">
        {selectedChannelId ? (
          <>
            {/* ========== ENHANCEMENT 6: Channel header ==========*/}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <Icon 
                  icon={getChannelIcon(channels.find(c => c.id === selectedChannelId)?.channel_type || '')} 
                  className="w-5 h-5 text-amber-500" 
                />
                <h3 className="font-semibold text-gray-900">
                  {channels.find(c => c.id === selectedChannelId)?.name || 'Conversation'}
                </h3>
              </div>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <Icon icon="solar:chat-square-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => {
                    const isOwnMessage = msg.sender_id === user?.id;
                    // ========== ENHANCEMENT 7: Show date separators ==========
                    const showDate = index === 0 || 
                      new Date(msg.created_at).toDateString() !== 
                      new Date(messages[index - 1].created_at).toDateString();
                    
                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div className="flex items-center gap-4 my-4">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-500 px-2">
                              {format(new Date(msg.created_at), 'EEEE, MMMM d')}
                            </span>
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                        )}
                        
                        <div className={cn(
                          "flex gap-3",
                          isOwnMessage ? "justify-end" : "justify-start"
                        )}>
                          {/* ========== ENHANCEMENT 8: User avatars ==========*/}
                          {!isOwnMessage && (
                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                              <Icon icon="solar:user-bold-duotone" className="w-4 h-4 text-gray-600" />
                            </div>
                          )}
                          
                          <div className={cn(
                            "max-w-md space-y-1",
                            isOwnMessage && "items-end"
                          )}>
                            {/* ========== ENHANCEMENT 1: Show sender name ==========*/}
                            {!isOwnMessage && (
                              <p className="text-xs text-gray-600 font-medium px-1">
                                {userNames[msg.sender_id] || 'Unknown User'}
                              </p>
                            )}
                            
                            <div className={cn(
                              "px-4 py-2 rounded-2xl",
                              isOwnMessage 
                                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                                : "bg-white text-gray-900 shadow-sm"
                            )}>
                              <p className="text-sm">{msg.content}</p>
                            </div>
                            
                            {/* ========== ENHANCEMENT 9: Message time ==========*/}
                            <p className={cn(
                              "text-xs text-gray-500 px-1",
                              isOwnMessage && "text-right"
                            )}>
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </p>
                          </div>
                          
                          {isOwnMessage && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                              <Icon icon="solar:user-bold-duotone" className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {/* ========== ENHANCEMENT 2: Auto-scroll anchor ==========*/}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            {/* ========== ENHANCEMENT 10: Better input area ==========*/}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Icon icon="solar:paperclip-bold-duotone" className="w-5 h-5 text-gray-500" />
                </button>
                
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                
                <button
                  onClick={sendMessage}
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
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <Icon icon="solar:chat-square-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Messages</h3>
              <p className="text-gray-500">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};