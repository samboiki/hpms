import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { format } from 'date-fns';
import { cn } from '../../../utils/cn';

export const EnhancedMessagingV2: React.FC<{ practiceId: string }> = ({ practiceId }) => {
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ========== ENHANCEMENT 1: User names and avatars cache ==========
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  
  // ========== ENHANCEMENT 2: Auto-scroll to bottom ==========
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadChannelMap = useRef<Record<string, string>>({});
  
  // ========== ENHANCEMENT 3: Real-time subscription ==========
  const [subscription, setSubscription] = useState<any>(null);
  const [allChannelsSubscription, setAllChannelsSubscription] = useState<any>(null);
  
  // ========== ENHANCEMENT 11: Edit/Delete message states ==========
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  
  // ========== ENHANCEMENT 12: Add users to group ==========
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const [showAddMembersSection, setShowAddMembersSection] = useState(false);
  
  // Track unread messages and last messages
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, { content: string; sender_id: string; created_at: string }>>({});
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, string>>({});
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentChannelCreator, setCurrentChannelCreator] = useState<string | null>(null);
  const [showManageGroupModal, setShowManageGroupModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  
  // ========== ENHANCEMENT 13: Create channel modal ==========
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [newChannelType, setNewChannelType] = useState<'direct' | 'group' | 'announcement'>('group');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);

  // Load channels and set up real-time
  useEffect(() => {
    if (!user?.id || !practiceId) return;
    
    loadChannels();
    
    // Single subscription for all real-time updates
    const channelSub = supabase
      .channel(`messaging-${practiceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'internal_messages',
        filter: `practice_id=eq.${practiceId}`
      }, handleMessageChange)
      .subscribe();
      
    return () => {
      channelSub.unsubscribe();
    };
  }, [practiceId, user?.id]);

  // ========== ENHANCEMENT 2: Scroll to bottom when messages change ==========
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChannels = async () => {
    setChannelsLoading(true);
    try {
      // Only load channels where the user is a member
      const { data, error } = await supabase
        .from('internal_channel_members')
        .select(`
          channel_id,
          internal_message_channels!inner(
            id,
            name,
            channel_type,
            created_at,
            created_by
          )
        `)
        .eq('user_id', user?.id)
        .eq('practice_id', practiceId)
        .order('internal_message_channels(created_at)', { ascending: false });

      if (error) throw error;
      
      // Extract channel data and remove duplicates
      const channelMap = new Map();
      data?.forEach(item => {
        if (item.internal_message_channels) {
          channelMap.set(item.internal_message_channels.id, item.internal_message_channels);
        }
      });
      const channelData = Array.from(channelMap.values());
      
      // For direct messages, load the other user's info
      const enhancedChannels = await Promise.all(channelData.map(async (channel) => {
        if (channel.channel_type === 'direct') {
          // Get all members of this direct channel
          const { data: members } = await supabase
            .from('internal_channel_members')
            .select('user_id')
            .eq('channel_id', channel.id);
          
          // Find the other user (not current user)
          const otherUserId = members?.find(m => m.user_id !== user?.id)?.user_id;
          
          if (otherUserId) {
            // Get other user's info
            const { data: otherUser } = await supabase
              .from('users')
              .select('full_name, avatar')
              .eq('id', otherUserId)
              .single();
            
            if (otherUser) {
              // Update channel name to show other user's name
              channel.name = otherUser.full_name;
              channel.directUserId = otherUserId;
              channel.directUserAvatar = otherUser.avatar;
            }
          }
        }
        return channel;
      }));
      
      setChannels(enhancedChannels);
      
      // Load all users in the practice at once
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, full_name, avatar')
        .eq('practice_id', practiceId);
        
      if (allUsers) {
        const namesMap: Record<string, string> = {};
        const avatarsMap: Record<string, string> = {};
        allUsers.forEach(user => {
          namesMap[user.id] = user.full_name;
          if (user.avatar) avatarsMap[user.id] = user.avatar;
        });
        setUserNames(prev => ({ ...prev, ...namesMap }));
        setUserAvatars(prev => ({ ...prev, ...avatarsMap }));
      }
      
      // Load last messages and unread counts in a single query
      const channelIds = enhancedChannels.map(c => c.id);
      if (channelIds.length > 0) {
        const { data: lastMessagesData } = await supabase
          .rpc('get_channel_last_messages', { 
            channel_ids: channelIds,
            user_id: user?.id 
          });
          
        if (lastMessagesData) {
          const newLastMessages: Record<string, any> = {};
          const newUnreadCounts: Record<string, number> = {};
          
          lastMessagesData.forEach((item: any) => {
            if (item.last_message) {
              newLastMessages[item.channel_id] = {
                content: item.last_message.content,
                sender_id: item.last_message.sender_id,
                created_at: item.last_message.created_at
              };
            }
            newUnreadCounts[item.channel_id] = item.unread_count || 0;
          });
          
          setLastMessages(newLastMessages);
          setUnreadCounts(newUnreadCounts);
        }
      }
    } catch (err: any) {
      console.error('Error loading channels:', err);
      setError(`Failed to load channels: ${err.message}`);
    } finally {
      setChannelsLoading(false);
    }
  };
  
  // Handle real-time message changes
  const handleMessageChange = async (payload: any) => {
    if (payload.eventType === 'INSERT') {
      const newMessage = payload.new;
      
      // Quick channel lookup from thread
      const channelId = threadChannelMap.current[newMessage.thread_id];
      if (!channelId) return;
      
      // Update last message immediately
      setLastMessages(prev => ({
        ...prev,
        [channelId]: {
          content: newMessage.content,
          sender_id: newMessage.sender_id,
          created_at: newMessage.created_at
        }
      }));
      
      // Update unread count if not from current user and not in current channel
      if (newMessage.sender_id !== user?.id && selectedChannelId !== channelId) {
        setUnreadCounts(prev => ({
          ...prev,
          [channelId]: (prev[channelId] || 0) + 1
        }));
      }
      
      // If in current channel, add to messages
      if (selectedChannelId === channelId && threadId === newMessage.thread_id) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMessage.id);
          return exists ? prev : [...prev, newMessage];
        });
      }
    }
  };

  // ========== ENHANCEMENT 1: Load user names and avatars ==========
  const loadUserNames = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, avatar')
        .in('id', userIds);
      
      if (data) {
        const names: Record<string, string> = {};
        const avatars: Record<string, string> = {};
        data.forEach(user => {
          names[user.id] = user.full_name;
          if (user.avatar) {
            avatars[user.id] = user.avatar;
          }
        });
        setUserNames(prev => ({ ...prev, ...names }));
        setUserAvatars(prev => ({ ...prev, ...avatars }));
      }
    } catch (err) {
      console.error('Error loading user names:', err);
    }
  };

  // ========== ENHANCEMENT 12: Load channel members ==========
  const loadChannelMembers = async (channelId: string) => {
    try {
      const { data } = await supabase
        .from('internal_channel_members')
        .select('user_id')
        .eq('channel_id', channelId);
      
      if (data) {
        const memberIds = data.map(m => m.user_id);
        setChannelMembers(memberIds);
        loadUserNames(memberIds);
      }
    } catch (err) {
      console.error('Error loading channel members:', err);
    }
  };

  // ========== ENHANCEMENT 12: Load available users for adding ==========
  const loadAvailableUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('practice_id', practiceId)
        .not('id', 'in', `(${channelMembers.join(',')})`);
      
      setAvailableUsers(data || []);
    } catch (err) {
      console.error('Error loading available users:', err);
    }
  };

  // Load messages when channel selected
  const selectChannel = async (channelId: string) => {
    setSelectedChannelId(channelId);
    setError(null);
    setLoading(true);
    setMessageMenuId(null);
    setEditingMessageId(null);
    
    // Get channel creator info
    const selectedChannel = channels.find(c => c.id === channelId);
    setCurrentChannelCreator(selectedChannel?.created_by || null);
    
    // Load channel members
    await loadChannelMembers(channelId);
    
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
        
        // Store thread-channel mapping
        threadChannelMap.current[tid] = channelId;

        // Load messages
        const { data: msgs } = await supabase
          .from('internal_messages')
          .select('id, content, sender_id, created_at, updated_at, is_deleted')
          .eq('thread_id', tid)
          .order('created_at');

        setMessages(msgs || []);
        
        // ========== ENHANCEMENT 1: Load names for all senders ==========
        if (msgs && msgs.length > 0) {
          const senderIds = [...new Set(msgs.map(m => m.sender_id))];
          loadUserNames(senderIds);
        }
        
        // Mark channel as read
        setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
        
        // Update read status in database
        supabase
          .from('internal_channel_read_status')
          .upsert({
            channel_id: channelId,
            user_id: user?.id,
            last_read_at: new Date().toISOString()
          }, {
            onConflict: 'channel_id,user_id'
          })
          .then(() => {});
        
        // ========== ENHANCEMENT 3: Subscribe to new messages ==========
        const newSub = supabase
          .channel(`messages:${tid}`)
          .on('postgres_changes', {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'internal_messages',
            filter: `thread_id=eq.${tid}`
          }, (payload) => {
            console.log('Real-time event:', payload);
            
            if (payload.eventType === 'INSERT') {
              const newMessage = payload.new as any;
              setMessages(prev => {
                const exists = prev.some(m => m.id === newMessage.id);
                if (!exists) {
                  loadUserNames([newMessage.sender_id]);
                  
                  // Only process if message is in current thread
                  if (threadId === tid) {
                    // Update last message for this channel
                    setLastMessages(prev => ({
                      ...prev,
                      [channelId]: {
                        content: newMessage.content,
                        sender_id: newMessage.sender_id,
                        created_at: newMessage.created_at
                      }
                    }));
                  }
                  
                  return [...prev, newMessage];
                }
                return prev;
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedMessage = payload.new as any;
              setMessages(prev => prev.map(m => 
                m.id === updatedMessage.id ? updatedMessage : m
              ));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setMessages(prev => prev.filter(m => m.id !== deletedId));
            }
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
      
      // Add message immediately for sender
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
  
  // ========== ENHANCEMENT 11: Edit message ==========
  const startEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
    setMessageMenuId(null);
  };
  
  const saveEditMessage = async () => {
    if (!editingContent.trim() || !editingMessageId) return;
    
    try {
      const { error } = await supabase
        .from('internal_messages')
        .update({
          content: editingContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMessageId);
      
      if (error) throw error;
      
      setEditingMessageId(null);
      setEditingContent('');
    } catch (err: any) {
      console.error('Error editing message:', err);
      setError(`Failed to edit: ${err.message}`);
    }
  };
  
  // ========== ENHANCEMENT 11: Delete message (soft delete) ==========
  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('internal_messages')
        .update({
          is_deleted: true,
          content: '[Message deleted]',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      if (error) throw error;
      
      setMessageMenuId(null);
    } catch (err: any) {
      console.error('Error deleting message:', err);
      setError(`Failed to delete: ${err.message}`);
    }
  };
  
  // ========== ENHANCEMENT 12: Add users to group ==========
  const addUsersToGroup = async () => {
    if (!selectedChannelId || selectedUsers.length === 0) return;
    
    try {
      const membersToAdd = selectedUsers.map(userId => ({
        channel_id: selectedChannelId,
        user_id: userId,
        practice_id: practiceId,
        added_by: user?.id
      }));
      
      const { error } = await supabase
        .from('internal_channel_members')
        .insert(membersToAdd);
      
      if (error) throw error;
      
      // Reload channel members
      await loadChannelMembers(selectedChannelId);
      
      // Send system message about new members
      const newMemberNames = availableUsers
        .filter(u => selectedUsers.includes(u.id))
        .map(u => u.full_name)
        .join(', ');
      
      await supabase
        .from('internal_messages')
        .insert({
          thread_id: threadId,
          sender_id: user?.id,
          practice_id: practiceId,
          content: `Added ${newMemberNames} to the group`,
          content_type: 'system',
          mentions: [],
          importance_score: 1
        });
      
      setShowAddUsersModal(false);
      setSelectedUsers([]);
    } catch (err: any) {
      console.error('Error adding users:', err);
      setError(`Failed to add users: ${err.message}`);
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
  
  // ========== ENHANCEMENT 13: Create new channel ==========
  const createNewChannel = async () => {
    if (!newChannelName.trim() && newChannelType !== 'direct') {
      setError('Channel name is required');
      return;
    }
    
    if (newChannelMembers.length === 0) {
      setError('Please select at least one member');
      return;
    }
    
    try {
      // For direct messages, check if conversation already exists
      if (newChannelType === 'direct' && newChannelMembers.length === 1) {
        const otherUserId = newChannelMembers[0];
        
        // Check if we already have a direct message with this user
        const { data: existingChannels } = await supabase
          .from('internal_channel_members')
          .select(`
            channel_id,
            internal_message_channels!inner(
              id,
              channel_type
            )
          `)
          .eq('user_id', user?.id)
          .eq('internal_message_channels.channel_type', 'direct');
        
        // Check if any of these channels also have the other user
        for (const channelMember of existingChannels || []) {
          const { data: otherMember } = await supabase
            .from('internal_channel_members')
            .select('user_id')
            .eq('channel_id', channelMember.channel_id)
            .eq('user_id', otherUserId)
            .single();
          
          if (otherMember) {
            // Direct message already exists, just select it
            setShowCreateChannelModal(false);
            setNewChannelMembers([]);
            await loadChannels();
            setSelectedChannelId(channelMember.channel_id);
            selectChannel(channelMember.channel_id);
            return;
          }
        }
      }
      
      // Create the channel
      const { data: newChannel, error: channelError } = await supabase
        .from('internal_message_channels')
        .insert({
          practice_id: practiceId,
          name: newChannelName.trim() || 'Direct Message',
          description: newChannelDescription.trim(),
          channel_type: newChannelType,
          created_by: user?.id
        })
        .select()
        .single();
      
      if (channelError) throw channelError;
      
      // Add members including the creator
      const allMembers = [...new Set([...newChannelMembers, user?.id])].filter(Boolean);
      const memberInserts = allMembers.map(userId => ({
        channel_id: newChannel.id,
        user_id: userId,
        practice_id: practiceId,
        added_by: user?.id
      }));
      
      const { error: membersError } = await supabase
        .from('internal_channel_members')
        .insert(memberInserts);
      
      if (membersError) throw membersError;
      
      // Create initial thread
      const { data: thread, error: threadError } = await supabase
        .from('internal_message_threads')
        .insert({
          channel_id: newChannel.id,
          practice_id: practiceId,
          created_by: user?.id
        })
        .select()
        .single();
      
      if (threadError) throw threadError;
      
      // Send system message (only for non-direct messages)
      if (newChannelType !== 'direct') {
        await supabase
          .from('internal_messages')
          .insert({
            thread_id: thread.id,
            sender_id: user?.id,
            practice_id: practiceId,
            content: `Created ${newChannelType} "${newChannelName}"`,
            content_type: 'system',
            mentions: [],
            importance_score: 1
          });
      }
      
      // Reset form and close modal
      setShowCreateChannelModal(false);
      setNewChannelName('');
      setNewChannelDescription('');
      setNewChannelMembers([]);
      setNewChannelType('group');
      
      // Reload channels and select the new one
      await loadChannels();
      
      // Small delay to ensure channels are loaded
      setTimeout(() => {
        setSelectedChannelId(newChannel.id);
        selectChannel(newChannel.id);
      }, 100);
    } catch (err: any) {
      console.error('Error creating channel:', err);
      setError(`Failed to create channel: ${err.message}`);
    }
  };
  
  // Load all practice users for channel creation
  const loadAllPracticeUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, avatar')
        .eq('practice_id', practiceId)
        .neq('id', user?.id); // Exclude current user
      
      return data || [];
    } catch (err) {
      console.error('Error loading practice users:', err);
      return [];
    }
  };
  
  // Remove member from group
  const removeMemberFromGroup = async (memberId: string) => {
    if (!selectedChannelId || !memberId) return;
    
    try {
      const { error } = await supabase
        .from('internal_channel_members')
        .delete()
        .eq('channel_id', selectedChannelId)
        .eq('user_id', memberId);
      
      if (error) throw error;
      
      // Send system message
      const memberName = userNames[memberId] || 'A member';
      await supabase
        .from('internal_messages')
        .insert({
          thread_id: threadId,
          sender_id: user?.id,
          practice_id: practiceId,
          content: `${memberName} was removed from the group`,
          content_type: 'system',
          mentions: [],
          importance_score: 1
        });
      
      // Reload members
      await loadChannelMembers(selectedChannelId);
      setMemberToRemove(null);
    } catch (err: any) {
      console.error('Error removing member:', err);
      setError(`Failed to remove member: ${err.message}`);
    }
  };
  
  // Delete group (only for creators)
  const deleteGroup = async () => {
    if (!selectedChannelId || currentChannelCreator !== user?.id) return;
    
    const confirmDelete = window.confirm('Are you sure you want to delete this group? This action cannot be undone.');
    if (!confirmDelete) return;
    
    try {
      // Use the cascade delete function from the database
      const { error } = await supabase
        .rpc('delete_channel_cascade', { p_channel_id: selectedChannelId });
      
      if (error) throw error;
      
      // Reset UI
      setSelectedChannelId(null);
      setShowManageGroupModal(false);
      
      // Reload channels
      await loadChannels();
    } catch (err: any) {
      console.error('Error deleting group:', err);
      setError(`Failed to delete group: ${err.message}`);
    }
  };
  
  // Delete direct message conversation
  const deleteDirectMessage = async () => {
    if (!selectedChannelId) return;
    
    const selectedChannel = channels.find(c => c.id === selectedChannelId);
    const otherUserName = selectedChannel?.name || 'this user';
    
    const confirmDelete = window.confirm(`Are you sure you want to delete your conversation with ${otherUserName}? This will remove the conversation from your view only.`);
    if (!confirmDelete) return;
    
    try {
      // Remove current user from channel members
      await supabase
        .from('internal_channel_members')
        .delete()
        .eq('channel_id', selectedChannelId)
        .eq('user_id', user?.id);
      
      // Check if other user is still in the channel
      const { data: remainingMembers } = await supabase
        .from('internal_channel_members')
        .select('user_id')
        .eq('channel_id', selectedChannelId);
      
      // If no members left, delete everything
      if (!remainingMembers || remainingMembers.length === 0) {
        // Delete all messages
        const { data: threads } = await supabase
          .from('internal_message_threads')
          .select('id')
          .eq('channel_id', selectedChannelId);
        
        if (threads) {
          for (const thread of threads) {
            await supabase
              .from('internal_messages')
              .delete()
              .eq('thread_id', thread.id);
          }
        }
        
        // Delete threads
        await supabase
          .from('internal_message_threads')
          .delete()
          .eq('channel_id', selectedChannelId);
        
        // Delete channel
        await supabase
          .from('internal_message_channels')
          .delete()
          .eq('id', selectedChannelId);
      }
      
      // Reset UI
      setSelectedChannelId(null);
      
      // Reload channels
      await loadChannels();
    } catch (err: any) {
      console.error('Error deleting direct message:', err);
      setError(`Failed to delete conversation: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-12 h-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Groups/Direct Messages List - col-3 */}
      <div className="col-span-3 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Icon icon="solar:chat-square-bold-duotone" className="w-5 h-5 text-amber-500" />
              Messages
            </h3>
            <button
              onClick={() => setShowCreateChannelModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="New conversation"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5 text-amber-600" />
            </button>
          </div>
          
          {/* New Conversation Button */}
          <button
            onClick={() => setShowCreateChannelModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all shadow-sm"
          >
            <Icon icon="solar:add-square-bold-duotone" className="w-5 h-5" />
            <span className="font-medium">New Conversation</span>
          </button>
        </div>
        
        {error && (
          <div className="m-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4" />
            {error}
          </div>
        )}
        
        <div className="overflow-y-auto flex-1">
          {channelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Icon icon="solar:chat-square-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No conversations yet</p>
              <p className="text-xs text-gray-400 mt-1">Start a new conversation above</p>
            </div>
          ) : (
            <>
              {channels.map(channel => {
            // Get basic channel info
            const isSelected = selectedChannelId === channel.id;
            const channelMemberIds = isSelected ? channelMembers : [];
            
            return (
              <button
                key={channel.id}
                onClick={() => selectChannel(channel.id)}
                className={cn(
                  "w-full text-left p-4 border-b border-gray-100 hover:bg-gray-100 transition-colors",
                  isSelected && "bg-amber-50 border-amber-200"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* ========== ENHANCEMENT 5: Channel icons or user avatar for direct messages ==========*/}
                  {channel.channel_type === 'direct' && channel.directUserAvatar ? (
                    <img
                      src={channel.directUserAvatar}
                      alt={channel.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : channel.channel_type === 'direct' ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold">
                        {channel.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  ) : (
                    <div className={cn(
                      "p-2 rounded-lg flex-shrink-0",
                      isSelected 
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        : "bg-gray-200 text-gray-600"
                    )}>
                      <Icon icon={getChannelIcon(channel.channel_type)} className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 truncate">
                        {channel.name || 'Unnamed Channel'}
                      </h4>
                      {unreadCounts[channel.id] > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          {unreadCounts[channel.id]}
                        </span>
                      )}
                    </div>
                    {lastMessages[channel.id] ? (
                      <div className="mt-1">
                        <p className="text-xs text-gray-600 truncate">
                          {lastMessages[channel.id].sender_id === user?.id ? (
                            <span className="font-medium">You: </span>
                          ) : (
                            <span className="font-medium">
                              {userNames[lastMessages[channel.id].sender_id] || 'Someone'}: 
                            </span>
                          )}
                          {lastMessages[channel.id].content}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        {channel.channel_type === 'direct' ? 'Direct message' : 'Group conversation'}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
            </>
          )}
        </div>
      </div>

      {/* Conversation Area - col-9 */}
      <div className="col-span-9 flex flex-col">
        {selectedChannelId ? (
          <>
            {/* ========== ENHANCEMENT 6: Channel header with add users button ==========*/}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon 
                    icon={getChannelIcon(channels.find(c => c.id === selectedChannelId)?.channel_type || '')} 
                    className="w-5 h-5 text-amber-500" 
                  />
                  <h3 className="font-semibold text-gray-900">
                    {channels.find(c => c.id === selectedChannelId)?.name || 'Conversation'}
                  </h3>
                  
                  {/* Member avatars */}
                  <div className="flex items-center -space-x-2">
                    {channelMembers.slice(0, 3).map((memberId, idx) => (
                      userAvatars[memberId] ? (
                        <img
                          key={memberId}
                          src={userAvatars[memberId]}
                          alt={userNames[memberId] || 'Unknown'}
                          className="w-8 h-8 rounded-full object-cover border-2 border-white"
                          style={{ zIndex: 3 - idx }}
                          title={userNames[memberId] || 'Unknown'}
                        />
                      ) : (
                        <div
                          key={memberId}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center border-2 border-white"
                          style={{ zIndex: 3 - idx }}
                          title={userNames[memberId] || 'Unknown'}
                        >
                          <span className="text-white text-xs font-semibold">
                            {userNames[memberId]?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )
                    ))}
                    {channelMembers.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center border-2 border-white">
                        <span className="text-gray-700 text-xs font-semibold">
                          +{channelMembers.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowAddUsersModal(true);
                      loadAvailableUsers();
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {channelMembers.length} members
                  </button>
                </div>
                
                {/* Enhanced buttons */}
                <div className="flex items-center gap-2">
                  {channels.find(c => c.id === selectedChannelId)?.channel_type === 'group' && currentChannelCreator === user?.id && (
                    <button
                      onClick={() => setShowManageGroupModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors"
                      title="Manage group members"
                    >
                      <Icon icon="solar:settings-bold-duotone" className="w-5 h-5" />
                      <span className="font-medium">Manage Members</span>
                    </button>
                  )}
                  
                  {/* Delete button for direct messages */}
                  {channels.find(c => c.id === selectedChannelId)?.channel_type === 'direct' && (
                    <button
                      onClick={() => deleteDirectMessage()}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      title="Delete conversation"
                    >
                      <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5" />
                    </button>
                  )}
                </div>
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
                    const showDate = index === 0 || 
                      new Date(msg.created_at).toDateString() !== 
                      new Date(messages[index - 1].created_at).toDateString();
                    const isEditing = editingMessageId === msg.id;
                    const isSystemMessage = msg.content_type === 'system';
                    
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
                        
                        {isSystemMessage ? (
                          // System message for user additions
                          <div className="flex justify-center">
                            <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-full text-sm">
                              {msg.content}
                            </div>
                          </div>
                        ) : (
                          <div className={cn(
                            "flex gap-3 group",
                            isOwnMessage ? "justify-end" : "justify-start"
                          )}>
                            {!isOwnMessage && (
                              userAvatars[msg.sender_id] ? (
                                <img 
                                  src={userAvatars[msg.sender_id]} 
                                  alt={userNames[msg.sender_id] || 'User'}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-sm font-semibold">
                                    {userNames[msg.sender_id]?.[0]?.toUpperCase() || '?'}
                                  </span>
                                </div>
                              )
                            )}
                            
                            <div className={cn(
                              "max-w-md space-y-1",
                              isOwnMessage && "items-end"
                            )}>
                              {!isOwnMessage && (
                                <p className="text-xs text-gray-600 font-medium px-1">
                                  {userNames[msg.sender_id] || 'Unknown User'}
                                </p>
                              )}
                              
                              <div className="relative">
                                {isEditing ? (
                                  // Edit mode
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editingContent}
                                      onChange={(e) => setEditingContent(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEditMessage();
                                        if (e.key === 'Escape') {
                                          setEditingMessageId(null);
                                          setEditingContent('');
                                        }
                                      }}
                                      className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                      autoFocus
                                    />
                                    <button
                                      onClick={saveEditMessage}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                                    >
                                      <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingMessageId(null);
                                        setEditingContent('');
                                      }}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                                    >
                                      <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
                                    </button>
                                  </div>
                                ) : (
                                  // Display mode
                                  <div 
                                    className={cn(
                                      "px-4 py-2 rounded-2xl",
                                      isOwnMessage 
                                        ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white cursor-pointer hover:from-amber-600 hover:to-orange-700 transition-all"
                                        : "bg-white text-gray-900 shadow-sm",
                                      msg.is_deleted && "opacity-60 italic"
                                    )}
                                    onClick={() => {
                                      if (isOwnMessage && !msg.is_deleted) {
                                        setMessageMenuId(msg.id);
                                      }
                                    }}
                                  >
                                    <p className="text-sm">{msg.content}</p>
                                    {msg.updated_at && msg.updated_at !== msg.created_at && !msg.is_deleted && (
                                      <p className="text-xs opacity-70 mt-1">(edited)</p>
                                    )}
                                  </div>
                                )}
                                
                                {/* ========== ENHANCEMENT 11: Message menu ==========*/}
                                {isOwnMessage && !msg.is_deleted && !isEditing && (
                                  <div className="absolute -left-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setMessageMenuId(msg.id)}
                                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                      <Icon icon="solar:menu-dots-bold-duotone" className="w-4 h-4 text-gray-500" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              
                              <p className={cn(
                                "text-xs text-gray-500 px-1",
                                isOwnMessage && "text-right"
                              )}>
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </p>
                            </div>
                            
                            {isOwnMessage && (
                              userAvatars[user?.id || ''] ? (
                                <img 
                                  src={userAvatars[user?.id || '']} 
                                  alt="You"
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-sm font-semibold">
                                    {userNames[user?.id || '']?.[0]?.toUpperCase() || 'Y'}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
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
      
      
      {/* ========== ENHANCEMENT 13: Create Channel Modal ==========*/}
      {showCreateChannelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[600px] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">New Conversation</h3>
                <button
                  onClick={() => {
                    setShowCreateChannelModal(false);
                    setNewChannelName('');
                    setNewChannelDescription('');
                    setNewChannelMembers([]);
                    setNewChannelType('group');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* Message Type Selection */}
            <div className="p-6 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Type</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNewChannelType('direct')}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all",
                    newChannelType === 'direct'
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Icon icon="solar:chat-round-bold-duotone" className="w-6 h-6 mx-auto mb-1 text-amber-600" />
                  <p className="text-sm font-medium">Direct Message</p>
                </button>
                <button
                  onClick={() => setNewChannelType('group')}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all",
                    newChannelType === 'group'
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Icon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6 mx-auto mb-1 text-amber-600" />
                  <p className="text-sm font-medium">Group</p>
                </button>
              </div>
            </div>
            
            {/* Group Details */}
            {newChannelType !== 'direct' && (
              <div className="p-6 border-b border-gray-200">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Group Name *
                    </label>
                    <input
                      type="text"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="e.g. Front Desk Team"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={newChannelDescription}
                      onChange={(e) => setNewChannelDescription(e.target.value)}
                      placeholder="What is this group about?"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Member Selection */}
            <div className="flex-1 overflow-y-auto p-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                {newChannelType === 'direct' ? 'Select User' : 'Add Members *'}
              </h4>
              <CreateChannelMembersList
                practiceId={practiceId}
                currentUserId={user?.id || ''}
                selectedMembers={newChannelMembers}
                onMembersChange={setNewChannelMembers}
                isDirectMessage={newChannelType === 'direct'}
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateChannelModal(false);
                    setNewChannelName('');
                    setNewChannelDescription('');
                    setNewChannelMembers([]);
                    setNewChannelType('group');
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewChannel}
                  disabled={newChannelMembers.length === 0 || (!newChannelName.trim() && newChannelType !== 'direct')}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-lg transition-all font-medium",
                    newChannelMembers.length > 0 && (newChannelName.trim() || newChannelType === 'direct')
                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-lg"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  )}
                >
                  Create {newChannelType === 'direct' ? 'Direct Message' : 'Channel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ========== Manage Group Modal ==========*/}
      {showManageGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[700px] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <Icon icon="solar:users-group-rounded-bold-duotone" className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Manage</h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {channels.find(c => c.id === selectedChannelId)?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowManageGroupModal(false);
                    setMemberToRemove(null);
                    setShowAddMembersSection(false);
                    setSelectedUsers([]);
                  }}
                  className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* Members List */}
            <div className="flex-1 overflow-y-auto">
              {/* Tab Navigation */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 pt-4">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setShowAddMembersSection(false)}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
                      !showAddMembersSection 
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5 inline mr-2" />
                    Current Members ({channelMembers.length})
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMembersSection(true);
                      loadAvailableUsers();
                    }}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
                      showAddMembersSection 
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    <Icon icon="solar:user-plus-bold-duotone" className="w-5 h-5 inline mr-2" />
                    Add Members
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {!showAddMembersSection ? (
                  /* Current Members List */
                  <div className="space-y-2">
                {channelMembers.map(memberId => {
                  const isCreator = memberId === currentChannelCreator;
                  const isCurrentUser = memberId === user?.id;
                  
                  return (
                    <div key={memberId} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        {userAvatars[memberId] ? (
                          <img
                            src={userAvatars[memberId]}
                            alt={userNames[memberId] || 'Unknown'}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-2 ring-gray-100">
                            <span className="text-white font-semibold text-lg">
                              {userNames[memberId]?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 text-base">
                            {userNames[memberId] || 'Unknown'}
                            {isCurrentUser && <span className="text-gray-500"> (You)</span>}
                          </p>
                          {isCreator && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Icon icon="solar:crown-bold-duotone" className="w-4 h-4 text-amber-500" />
                              <p className="text-xs text-amber-600 font-medium">Group Owner</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {!isCreator && !isCurrentUser && currentChannelCreator === user?.id && (
                        <button
                          onClick={() => setMemberToRemove(memberId)}
                          className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          title="Remove member"
                        >
                          <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                  </div>
                ) : (
                  /* Add Members Section */
                  <div>
                    <div className="mb-4">
                      <div className="relative">
                        <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search team members..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          onChange={(e) => {
                            // Filter available users based on search
                            const searchTerm = e.target.value.toLowerCase();
                            // Implementation for search would go here
                          }}
                        />
                      </div>
                    </div>
                    
                    {availableUsers.length === 0 ? (
                      <div className="text-center py-12">
                        <Icon icon="solar:users-group-rounded-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">All team members are already in this group</p>
                        <p className="text-sm text-gray-400 mt-1">Everyone from your practice is part of this conversation</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {availableUsers.map(user => {
                          const isSelected = selectedUsers.includes(user.id);
                          const initial = user.full_name?.[0]?.toUpperCase() || '?';
                          const colors = [
                            'from-blue-400 to-blue-600',
                            'from-green-400 to-green-600',
                            'from-purple-400 to-purple-600',
                            'from-pink-400 to-pink-600',
                            'from-indigo-400 to-indigo-600'
                          ];
                          const colorIndex = user.id.charCodeAt(0) % colors.length;
                          
                          return (
                            <div
                              key={user.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                } else {
                                  setSelectedUsers([...selectedUsers, user.id]);
                                }
                              }}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all",
                                isSelected 
                                  ? "border-amber-500 bg-amber-50" 
                                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center ring-2 ring-white shadow-md`}>
                                  <span className="text-white font-semibold text-lg">{initial}</span>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{user.full_name}</p>
                                  <p className="text-xs text-gray-500">Team Member</p>
                                </div>
                              </div>
                              
                              <div className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                                isSelected 
                                  ? "bg-amber-500 border-amber-500" 
                                  : "bg-white border-gray-300"
                              )}>
                                {isSelected && (
                                  <Icon icon="solar:check-bold" className="w-4 h-4 text-white" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {selectedUsers.length > 0 && (
                      <div className="mt-6 flex gap-3">
                        <button
                          onClick={() => setSelectedUsers([])}
                          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                        >
                          Clear Selection
                        </button>
                        <button
                          onClick={addUsersToGroup}
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all font-medium shadow-lg"
                        >
                          Add {selectedUsers.length} Member{selectedUsers.length > 1 ? 's' : ''}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Delete Group Section */}
            {currentChannelCreator === user?.id && (
              <div className="p-6 border-t border-gray-200 bg-red-50">
                <h4 className="text-sm font-medium text-red-900 mb-2">Danger Zone</h4>
                <p className="text-sm text-red-700 mb-3">
                  Deleting this group will permanently remove all messages and cannot be undone.
                </p>
                <button
                  onClick={deleteGroup}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                >
                  Delete Group
                </button>
              </div>
            )}
            
            {/* Modal Footer - Only show if not creator */}
            {currentChannelCreator !== user?.id && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    setShowManageGroupModal(false);
                    setMemberToRemove(null);
                  }}
                  className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Remove Member Confirmation */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Member</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove {userNames[memberToRemove]} from this group?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMemberToRemove(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMemberFromGroup(memberToRemove)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Glassmorphic Message Action Modal */}
      {messageMenuId && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setMessageMenuId(null)}>
          <div 
            className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-1 min-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-white/60 to-white/40 rounded-xl p-1">
              <button
                onClick={() => {
                  const msg = messages.find(m => m.id === messageMenuId);
                  if (msg) {
                    startEditMessage(msg.id, msg.content);
                    setMessageMenuId(null);
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/60 rounded-lg transition-all group"
              >
                <div className="p-2 bg-amber-100/80 rounded-lg group-hover:bg-amber-200/80 transition-colors">
                  <Icon icon="solar:pen-bold-duotone" className="w-5 h-5 text-amber-700" />
                </div>
                <span className="font-medium text-gray-800">Edit Message</span>
              </button>
              
              <div className="h-px bg-gradient-to-r from-transparent via-gray-300/50 to-transparent my-1" />
              
              <button
                onClick={() => {
                  deleteMessage(messageMenuId);
                  setMessageMenuId(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50/60 rounded-lg transition-all group"
              >
                <div className="p-2 bg-red-100/80 rounded-lg group-hover:bg-red-200/80 transition-colors">
                  <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5 text-red-700" />
                </div>
                <span className="font-medium text-red-700">Delete Message</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for member selection in create channel modal
const CreateChannelMembersList: React.FC<{
  practiceId: string;
  currentUserId: string;
  selectedMembers: string[];
  onMembersChange: (members: string[]) => void;
  isDirectMessage: boolean;
}> = ({ practiceId, currentUserId, selectedMembers, onMembersChange, isDirectMessage }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadUsers();
  }, [practiceId]);
  
  const loadUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, avatar')
        .eq('practice_id', practiceId)
        .neq('id', currentUserId)
        .order('full_name');
      
      setUsers(data || []);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }
  
  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <Icon icon="solar:users-group-rounded-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No team members available</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {users.map(user => {
        const isSelected = selectedMembers.includes(user.id);
        
        return (
          <label
            key={user.id}
            className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <input
              type={isDirectMessage ? "radio" : "checkbox"}
              checked={isSelected}
              onChange={(e) => {
                if (isDirectMessage) {
                  onMembersChange([user.id]);
                } else {
                  if (e.target.checked) {
                    onMembersChange([...selectedMembers, user.id]);
                  } else {
                    onMembersChange(selectedMembers.filter(id => id !== user.id));
                  }
                }
              }}
              className={cn(
                "text-amber-600 border-gray-300 focus:ring-amber-500",
                isDirectMessage ? "w-4 h-4" : "w-5 h-5 rounded"
              )}
            />
            <div className="flex items-center gap-3 flex-1">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.full_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {user.full_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">{user.full_name}</p>
                <p className="text-xs text-gray-500">Team Member</p>
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
};