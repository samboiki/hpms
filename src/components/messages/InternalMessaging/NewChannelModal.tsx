import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '../../../utils/cn';
import { supabase } from '../../../lib/supabase';
import { useMessagingStore } from '../../../stores/messagingStore';
import { useAuthStore } from '../../../stores/authStore';
import { InternalMessageChannel } from '../../../types/internal-messaging.types';

interface NewChannelModalProps {
  practiceId: string;
  onClose: () => void;
  onChannelCreated: (channel: InternalMessageChannel) => void;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar?: string;
}

export const NewChannelModal: React.FC<NewChannelModalProps> = ({
  practiceId,
  onClose,
  onChannelCreated
}) => {
  const { user: currentUser } = useAuthStore();
  const { createChannel, createDirectMessageChannel } = useMessagingStore();
  
  const [channelType, setChannelType] = useState<'direct' | 'group' | 'announcement'>('direct');
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load users from the practice
  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, role, avatar')
          .eq('practice_id', practiceId)
          .neq('id', currentUser?.id) // Exclude current user
          .order('full_name');

        if (error) throw error;
        setAvailableUsers(data || []);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, [practiceId, currentUser?.id]);

  // Filter users based on search
  const filteredUsers = availableUsers.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateChannel = async () => {
    setError(null);
    
    if (channelType === 'direct' && selectedUsers.length !== 1) {
      setError('Please select exactly one user for a direct message');
      return;
    }

    if (channelType === 'group' && selectedUsers.length < 2) {
      setError('Please select at least 2 users for a group chat');
      return;
    }

    if (channelType !== 'direct' && !channelName.trim()) {
      setError('Please enter a channel name');
      return;
    }

    setIsCreating(true);
    try {
      let newChannel: InternalMessageChannel;

      if (channelType === 'direct') {
        // Create direct message channel
        newChannel = await createDirectMessageChannel(practiceId, selectedUsers[0]);
      } else {
        // Create group or announcement channel
        const participantIds = [...selectedUsers, currentUser?.id].filter(Boolean) as string[];
        
        newChannel = await createChannel(
          practiceId,
          channelType,
          channelName.trim(),
          participantIds
        );
      }

      setSuccess(true);
      
      // Show success message briefly before closing
      setTimeout(() => {
        onChannelCreated(newChannel);
        onClose();
      }, 1500);
      
    } catch (error: any) {
      console.error('Error creating channel:', error);
      setError(error.message || 'Failed to create channel. Please try again.');
      setIsCreating(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setError(null); // Clear any existing errors
    
    if (channelType === 'direct') {
      // For direct messages, only allow one selection
      setSelectedUsers([userId]);
    } else {
      // For group/announcement, allow multiple selections
      setSelectedUsers(prev =>
        prev.includes(userId)
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">New Conversation</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Channel Type Selection */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex gap-4">
              {[
                { type: 'direct' as const, label: 'Direct Message', icon: 'solar:chat-round-bold-duotone' },
                { type: 'group' as const, label: 'Group Chat', icon: 'solar:users-group-rounded-bold-duotone' },
                { type: 'announcement' as const, label: 'Announcement', icon: 'solar:megaphone-bold-duotone' }
              ].map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => {
                    setChannelType(type);
                    setSelectedUsers([]);
                    setError(null);
                    setSuccess(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                    channelType === type
                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon icon={icon} className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Channel Details (for group/announcement) */}
          {channelType !== 'direct' && (
            <div className="px-6 py-4 border-b border-gray-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel Name *
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => {
                    setChannelName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g., Emergency Team, Front Desk"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={channelDescription}
                  onChange={(e) => {
                    setChannelDescription(e.target.value);
                    setError(null);
                  }}
                  placeholder="What's this channel about?"
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* User Selection */}
          <div className="px-6 py-3 border-b border-gray-200">
            <div className="relative">
              <Icon 
                icon="solar:magnifer-bold-duotone" 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {channelType === 'direct' 
                ? 'Select one person to start a conversation'
                : `Select team members (${selectedUsers.length} selected)`
              }
            </p>
          </div>

          {/* Users List */}
          <div className="px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Icon icon="solar:user-cross-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No users found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => toggleUserSelection(user.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
                      selectedUsers.includes(user.id)
                        ? "bg-amber-50 border-2 border-amber-500"
                        : "bg-white border-2 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="relative">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <Icon icon="solar:user-bold-duotone" className="w-5 h-5 text-gray-600" />
                        </div>
                      )}
                      {selectedUsers.includes(user.id) && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                          <Icon icon="solar:check-circle-bold" className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error/Success Messages - Fixed */}
        {(error || success) && (
          <div className="px-6 flex-shrink-0">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700">
                  {channelType === 'direct' ? 'Conversation started successfully!' : 'Channel created successfully!'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateChannel}
              disabled={
                isCreating ||
                (channelType === 'direct' && selectedUsers.length !== 1) ||
                (channelType === 'group' && selectedUsers.length < 2) ||
                (channelType !== 'direct' && !channelName.trim())
              }
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2",
                isCreating || 
                (channelType === 'direct' && selectedUsers.length !== 1) ||
                (channelType === 'group' && selectedUsers.length < 2) ||
                (channelType !== 'direct' && !channelName.trim())
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
              )}
            >
              {isCreating ? (
                <>
                  <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>{channelType === 'direct' ? 'Start Conversation' : 'Create Channel'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};