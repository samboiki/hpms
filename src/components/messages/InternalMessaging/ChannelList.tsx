import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { cn } from '../../../utils/cn';
import { useMessagingStore, useFilteredChannels } from '../../../stores/messagingStore';
import { InternalMessageChannel } from '../../../types/internal-messaging.types';
import { useAuthStore } from '../../../stores/authStore';
import { NewChannelModal } from './NewChannelModal';

interface ChannelListProps {
  practiceId: string;
  onChannelSelect: (channel: InternalMessageChannel) => void;
  selectedChannelId?: string;
  className?: string;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  practiceId,
  onChannelSelect,
  selectedChannelId,
  className
}) => {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  
  const {
    loadChannels,
    isLoadingChannels,
    channelError,
    updateUIState
  } = useMessagingStore();
  
  const filteredChannels = useFilteredChannels();

  useEffect(() => {
    if (practiceId) {
      loadChannels(practiceId);
    }
  }, [practiceId, loadChannels]);

  useEffect(() => {
    updateUIState({ channelSearch: searchQuery });
  }, [searchQuery, updateUIState]);

  const getChannelIcon = (channel: InternalMessageChannel) => {
    switch (channel.channel_type) {
      case 'direct':
        return 'solar:chat-round-bold-duotone';
      case 'group':
        return 'solar:users-group-rounded-bold-duotone';
      case 'department':
        return 'solar:buildings-bold-duotone';
      case 'patient_care':
        return 'solar:health-bold-duotone';
      case 'announcement':
        return 'solar:megaphone-bold-duotone';
      default:
        return 'solar:chat-square-bold-duotone';
    }
  };

  const getChannelName = (channel: InternalMessageChannel) => {
    if (channel.channel_type === 'direct' && channel.participants) {
      // Find the other participant
      const otherParticipant = channel.participants.find(p => p.user_id !== user?.id);
      return otherParticipant?.user?.full_name || otherParticipant?.user?.name || 'Direct Message';
    }
    return channel.name || 'Unnamed Channel';
  };

  const formatLastMessage = (channel: InternalMessageChannel) => {
    if (!channel.last_message) return 'No messages yet';
    
    const { content, sender, created_at } = channel.last_message;
    const senderName = sender?.id === user?.id ? 'You' : sender?.name || 'Unknown';
    const timeAgo = format(new Date(created_at), 'HH:mm');
    
    return `${senderName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''} • ${timeAgo}`;
  };

  return (
    <div className={cn("flex flex-col h-full bg-white rounded-lg shadow-sm", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Icon icon="solar:chat-square-bold-duotone" className="w-5 h-5 text-amber-500" />
            Messages
          </h3>
          <button
            onClick={() => setShowNewChannelModal(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="New conversation"
          >
            <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5 text-amber-500" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Icon 
            icon="solar:magnifer-bold-duotone" 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingChannels ? (
          <div className="flex items-center justify-center py-8">
            <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : channelError ? (
          <div className="p-4 text-center">
            <Icon icon="solar:danger-triangle-bold-duotone" className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Failed to load conversations</p>
            <button
              onClick={() => loadChannels(practiceId)}
              className="mt-2 text-xs text-amber-500 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="p-4 text-center">
            <Icon icon="solar:chat-square-bold-duotone" className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No conversations found</p>
            <button
              onClick={() => setShowNewChannelModal(true)}
              className="mt-2 text-sm text-amber-500 hover:underline flex items-center gap-1 mx-auto"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4" />
              Start a new conversation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredChannels.map((channel) => {
              const isSelected = channel.id === selectedChannelId;
              const hasUnread = channel.unread_count > 0;
              
              return (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={cn(
                    "w-full p-4 hover:bg-gray-50 transition-colors text-left relative",
                    isSelected && "bg-amber-50 hover:bg-amber-50",
                    hasUnread && "font-medium"
                  )}
                >
                  {/* Unread indicator */}
                  {hasUnread && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                  
                  <div className="flex items-start gap-3">
                    {/* Channel Icon */}
                    <div className={cn(
                      "p-2 rounded-lg flex-shrink-0",
                      isSelected ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" : "bg-gray-100 text-gray-600"
                    )}>
                      <Icon icon={getChannelIcon(channel)} className="w-5 h-5" />
                    </div>
                    
                    {/* Channel Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={cn(
                          "text-sm font-medium truncate",
                          isSelected ? "text-amber-600" : "text-gray-900"
                        )}>
                          {getChannelName(channel)}
                        </h4>
                        {channel.unread_count > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs rounded-full">
                            {channel.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {formatLastMessage(channel)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* New Channel Modal would go here */}
      {showNewChannelModal && (
        <NewChannelModal
          practiceId={practiceId}
          onClose={() => setShowNewChannelModal(false)}
          onChannelCreated={(channel) => {
            setShowNewChannelModal(false);
            onChannelSelect(channel);
          }}
        />
      )}
    </div>
  );
};