import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '../../../utils/cn';
import { useMessagingStore, useActiveThreadMessages, useActiveChannelTypingIndicators } from '../../../stores/messagingStore';
import { InternalMessageChannel } from '../../../types/internal-messaging.types';
import { useAuthStore } from '../../../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageThreadProps {
  channel: InternalMessageChannel;
  threadId: string;
  className?: string;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
  channel,
  threadId,
  className
}) => {
  const { user } = useAuthStore();
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  
  const {
    loadMessages,
    sendMessage,
    isLoadingMessages,
    sendTypingIndicator
  } = useMessagingStore();
  
  const messages = useActiveThreadMessages();
  const typingIndicators = useActiveChannelTypingIndicators();

  useEffect(() => {
    if (threadId) {
      loadMessages(threadId);
    }
  }, [threadId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle typing indicator
  useEffect(() => {
    if (isTyping) {
      sendTypingIndicator(channel.id, true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendTypingIndicator(channel.id, false);
      }, 3000);
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isTyping, channel.id, sendTypingIndicator]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    
    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    try {
      await sendMessage(threadId, messageInput.trim());
      setMessageInput('');
      setIsTyping(false);
      sendTypingIndicator(channel.id, false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, 'HH:mm');
    } else if (isYesterday(messageDate)) {
      return `Yesterday ${format(messageDate, 'HH:mm')}`;
    } else {
      return format(messageDate, 'MMM d, HH:mm');
    }
  };

  const renderDateSeparator = (date: string) => {
    const messageDate = new Date(date);
    let dateText = '';
    
    if (isToday(messageDate)) {
      dateText = 'Today';
    } else if (isYesterday(messageDate)) {
      dateText = 'Yesterday';
    } else {
      dateText = format(messageDate, 'EEEE, MMMM d, yyyy');
    }
    
    return (
      <div className="flex items-center gap-4 my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-500 px-2">{dateText}</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    );
  };

  const getChannelName = () => {
    if (channel.channel_type === 'direct') {
      const otherParticipant = channel.participants?.find(p => p.user_id !== user?.id);
      return otherParticipant?.user?.full_name || otherParticipant?.user?.name || 'Direct Message';
    }
    return channel.name || 'Unnamed Channel';
  };

  return (
    <div className={cn("flex flex-col h-full bg-white", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#01b9d5] text-white rounded-lg">
              <Icon icon="solar:chat-round-bold-duotone" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{getChannelName()}</h3>
              {channel.channel_type === 'direct' && (
                <p className="text-xs text-gray-500">Direct Message</p>
              )}
              {channel.channel_type === 'group' && channel.participants && (
                <p className="text-xs text-gray-500">{channel.participants.length} members</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Icon icon="solar:chat-square-bold-duotone" className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500">No messages yet</p>
            <p className="text-sm text-gray-400">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwnMessage = message.sender_id === user?.id;
              const showDateSeparator = index === 0 || 
                new Date(messages[index - 1].created_at).toDateString() !== new Date(message.created_at).toDateString();
              
              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && renderDateSeparator(message.created_at)}
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3",
                      isOwnMessage ? "justify-end" : "justify-start"
                    )}
                  >
                    {!isOwnMessage && (
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <Icon icon="solar:user-bold-duotone" className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                    
                    <div className={cn(
                      "max-w-[70%] space-y-1",
                      isOwnMessage && "items-end"
                    )}>
                      {!isOwnMessage && (
                        <p className="text-xs text-gray-600 font-medium">
                          {message.sender?.full_name || message.sender?.name || 'Unknown User'}
                        </p>
                      )}
                      
                      <div className={cn(
                        "px-4 py-2 rounded-2xl",
                        isOwnMessage 
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" 
                          : "bg-gray-100 text-gray-900"
                      )}>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                      
                      <p className={cn(
                        "text-xs",
                        isOwnMessage ? "text-gray-500 text-right" : "text-gray-500"
                      )}>
                        {formatMessageTime(message.created_at)}
                        {isOwnMessage && message.read_receipts?.length > 0 && (
                          <Icon icon="solar:double-alt-arrow-right-bold-duotone" className="w-3 h-3 inline ml-1 text-amber-500" />
                        )}
                      </p>
                    </div>
                    
                    {isOwnMessage && (
                      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                        <Icon icon="solar:user-bold-duotone" className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </motion.div>
                </React.Fragment>
              );
            })}
            
            {/* Typing Indicators */}
            <AnimatePresence>
              {typingIndicators.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-2"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <Icon icon="solar:user-bold-duotone" className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl px-4 py-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {typingIndicators.map(t => t.user?.full_name || t.user?.name).filter(Boolean).join(', ')} typing...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex items-end gap-3">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <Icon icon="solar:paperclip-bold-duotone" className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className={cn(
              "p-2 rounded-lg transition-all flex-shrink-0",
              messageInput.trim() 
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600" 
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            <Icon icon="solar:plain-bold-duotone" className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};