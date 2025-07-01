import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../utils/cn';
import { ChannelList } from './ChannelList';
import { MessageThread } from './MessageThread';
import { NotificationsList } from './NotificationsList';
import { useMessagingStore } from '../../../stores/messagingStore';
import { InternalMessageChannel } from '../../../types/internal-messaging.types';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import { useRealtimeMessaging } from '../../../hooks/useRealtimeMessaging';

interface InternalMessagingViewProps {
  practiceId: string;
  className?: string;
}

export const InternalMessagingView: React.FC<InternalMessagingViewProps> = ({
  practiceId,
  className
}) => {
  const { user } = useAuthStore();
  const [selectedChannel, setSelectedChannel] = useState<InternalMessageChannel | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showChannelList, setShowChannelList] = useState(true);
  
  const {
    setActiveChannel,
    uiState,
    updateUIState,
    unreadNotificationCount,
    loadUserPreferences
  } = useMessagingStore();

  // Enable real-time messaging subscriptions
  useRealtimeMessaging({
    practiceId,
    userId: user?.id || '',
    enabled: !!user?.id && !!practiceId
  });

  // Load user preferences
  useEffect(() => {
    if (user?.id && practiceId) {
      loadUserPreferences(user.id, practiceId);
    }
  }, [user?.id, practiceId, loadUserPreferences]);

  // Handle responsive design
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      updateUIState({ isMobileView: mobile });
      
      // On mobile, hide channel list when a channel is selected
      if (mobile && selectedChannel) {
        setShowChannelList(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [selectedChannel, updateUIState]);

  const handleChannelSelect = async (channel: InternalMessageChannel) => {
    setSelectedChannel(channel);
    setActiveChannel(channel);
    
    // Get or create thread for this channel
    try {
      const { data: thread, error } = await supabase
        .rpc('get_or_create_thread', { p_channel_id: channel.id });
      
      if (!error && thread) {
        updateUIState({ activeThreadId: thread });
      } else {
        console.error('Error getting thread:', error);
      }
    } catch (err) {
      console.error('Error getting thread:', err);
    }
    
    if (isMobile) {
      setShowChannelList(false);
    }
  };

  const handleBackToChannels = () => {
    setShowChannelList(true);
    if (isMobile) {
      setSelectedChannel(null);
      setActiveChannel(null);
    }
  };

  return (
    <div className={cn("flex h-full bg-gray-50", className)}>
      {/* Sidebar - Channel List */}
      <AnimatePresence mode="wait">
        {(!isMobile || showChannelList) && (
          <motion.div
            initial={isMobile ? { x: -300 } : false}
            animate={{ x: 0 }}
            exit={isMobile ? { x: -300 } : false}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              "bg-white border-r border-gray-200",
              isMobile ? "fixed inset-y-0 left-0 z-40 w-80" : "w-80 flex-shrink-0"
            )}
          >
            <ChannelList
              practiceId={practiceId}
              onChannelSelect={handleChannelSelect}
              selectedChannelId={selectedChannel?.id}
              className="h-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile backdrop */}
      {isMobile && showChannelList && (
        <div
          className="fixed inset-0 bg-black/30 z-30"
          onClick={() => setShowChannelList(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChannel ? (
          <>
            {/* Mobile back button */}
            {isMobile && (
              <div className="bg-white border-b border-gray-200 px-4 py-2">
                <button
                  onClick={handleBackToChannels}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <Icon icon="solar:arrow-left-bold-duotone" className="w-4 h-4" />
                  Back to conversations
                </button>
              </div>
            )}
            
            {/* Message Thread */}
            <MessageThread
              channel={selectedChannel}
              threadId={uiState.activeThreadId || ''}
              className="flex-1"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <Icon 
                icon="solar:chat-square-bold-duotone" 
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
              />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Welcome to Internal Messaging
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Select a conversation from the sidebar to start messaging
              </p>
              {isMobile && (
                <button
                  onClick={() => setShowChannelList(true)}
                  className="text-sm text-amber-500 hover:underline flex items-center gap-1 mx-auto"
                >
                  <Icon icon="solar:chat-square-bold-duotone" className="w-4 h-4" />
                  View conversations
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowNotifications(false)}
            />
            
            {/* Panel */}
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-xl z-50"
            >
              <NotificationsList
                practiceId={practiceId}
                userId={user?.id || ''}
                onClose={() => setShowNotifications(false)}
                className="h-full"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Notification Button */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="fixed bottom-6 right-6 p-4 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow group"
      >
        <Icon 
          icon="solar:bell-bing-bold-duotone" 
          className="w-6 h-6 text-amber-500 group-hover:scale-110 transition-transform"
        />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
          </span>
        )}
      </button>
    </div>
  );
};