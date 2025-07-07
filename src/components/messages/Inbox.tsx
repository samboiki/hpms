import React, { useState, useEffect } from 'react';
import { 
  Inbox as InboxIcon, 
  MessageSquare,
  Search,
  Filter,
  User,
  Clock,
  Reply,
  Archive,
  Trash2,
  Star,
  StarOff,
  Phone,
  Mail,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface IncomingMessage {
  id: string;
  patient_id?: string;
  type: 'EMAIL' | 'SMS';
  sender_address: string;
  body_preview: string;
  created_at: string;
  is_read: boolean;
  is_starred: boolean;
  patient?: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  };
}

const Inbox: React.FC = () => {
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<IncomingMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<IncomingMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);

  useEffect(() => {
    fetchMessages();
    // Set up real-time subscription
    const subscription = supabase
      .channel('inbox_messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'communications_log', filter: 'direction=eq.INCOMING' },
        payload => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [messages, searchTerm, filter]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('communications_log')
        .select(`
          *,
          patient:patients(first_name, last_name, email, phone)
        `)
        .eq('direction', 'INCOMING')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Add mock read/starred status for demo
      const messagesWithStatus = data?.map(msg => ({
        ...msg,
        is_read: Math.random() > 0.3,
        is_starred: Math.random() > 0.8
      })) || [];
      
      setMessages(messagesWithStatus);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = messages;

    if (filter === 'unread') {
      filtered = filtered.filter(msg => !msg.is_read);
    } else if (filter === 'starred') {
      filtered = filtered.filter(msg => msg.is_starred);
    }

    if (searchTerm) {
      filtered = filtered.filter(msg =>
        msg.patient?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.patient?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.sender_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.body_preview.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredMessages(filtered);
  };

  const handleMarkAsRead = async (messageId: string) => {
    setMessages(messages.map(msg => 
      msg.id === messageId ? { ...msg, is_read: true } : msg
    ));
  };

  const handleToggleStar = async (messageId: string) => {
    setMessages(messages.map(msg => 
      msg.id === messageId ? { ...msg, is_starred: !msg.is_starred } : msg
    ));
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    setMessages(messages.filter(msg => msg.id !== messageId));
    if (selectedMessage?.id === messageId) {
      setSelectedMessage(null);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !selectedMessage) return;

    try {
      const { error } = await supabase
        .from('communications_log')
        .insert({
          patient_id: selectedMessage.patient_id,
          type: selectedMessage.type,
          direction: 'OUTGOING',
          sender_address: selectedMessage.type === 'EMAIL' ? 'clinic@example.com' : '+1234567890',
          recipient_address: selectedMessage.sender_address,
          body_preview: replyContent.substring(0, 200),
          status: 'SENT'
        });

      if (error) throw error;

      setReplyContent('');
      setShowReplyBox(false);
      alert('Reply sent successfully!');
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    }
  };

  const selectMessage = (message: IncomingMessage) => {
    setSelectedMessage(message);
    if (!message.is_read) {
      handleMarkAsRead(message.id);
    }
  };

  const unreadCount = messages.filter(msg => !msg.is_read).length;

  return (
    <div className="flex h-[calc(100vh-16rem)]">
      {/* Message List */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Inbox</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-600">{unreadCount} unread messages</p>
              )}
            </div>
            <InboxIcon className="w-5 h-5 text-gray-400" />
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1">
            {(['all', 'unread', 'starred'] as const).map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filter === filterType
                    ? 'bg-gradient-to-r from-[#01b9d4] to-[#01a5c1] text-white hover:from-[#01a5c1] hover:to-[#0197b5]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8">
              <InboxIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No messages found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredMessages.map((message) => (
                <motion.div
                  key={message.id}
                  whileHover={{ backgroundColor: '#f9fafb' }}
                  onClick={() => selectMessage(message)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedMessage?.id === message.id ? 'bg-gradient-to-r from-[#01b9d4]/10 to-[#01a5c1]/10' : ''
                  } ${!message.is_read ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className={`text-sm ${!message.is_read ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                          {message.patient 
                            ? `${message.patient.first_name} ${message.patient.last_name}`
                            : 'Unknown Sender'
                          }
                        </p>
                        <p className="text-xs text-gray-500">{message.sender_address}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStar(message.id);
                      }}
                      className="text-gray-400 hover:text-yellow-500"
                    >
                      {message.is_starred ? (
                        <Star className="w-4 h-4 fill-current text-yellow-500" />
                      ) : (
                        <StarOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2 mb-1">
                    {message.body_preview}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      message.type === 'SMS' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {message.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(message.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Message Detail */}
      <div className="flex-1 flex flex-col">
        {selectedMessage ? (
          <>
            {/* Message Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedMessage.patient 
                        ? `${selectedMessage.patient.first_name} ${selectedMessage.patient.last_name}`
                        : 'Unknown Sender'
                      }
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>{selectedMessage.sender_address}</span>
                      <span>•</span>
                      <span>{format(new Date(selectedMessage.created_at), 'PPp')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleToggleStar(selectedMessage.id)}
                    className="p-2 text-gray-600 hover:text-yellow-500 rounded-lg hover:bg-gray-100"
                  >
                    {selectedMessage.is_starred ? (
                      <Star className="w-5 h-5 fill-current text-yellow-500" />
                    ) : (
                      <StarOff className="w-5 h-5" />
                    )}
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Message Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-gray-800 whitespace-pre-wrap">{selectedMessage.body_preview}</p>
              </div>

              {/* Patient Info */}
              {selectedMessage.patient && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">Patient Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">
                        {selectedMessage.patient.first_name} {selectedMessage.patient.last_name}
                      </p>
                    </div>
                    {selectedMessage.patient.email && (
                      <div>
                        <p className="text-gray-500">Email</p>
                        <p className="font-medium text-gray-900">{selectedMessage.patient.email}</p>
                      </div>
                    )}
                    {selectedMessage.patient.phone && (
                      <div>
                        <p className="text-gray-500">Phone</p>
                        <p className="font-medium text-gray-900">{selectedMessage.patient.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reply Box */}
              <AnimatePresence>
                {showReplyBox && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <h4 className="font-medium text-gray-900 mb-3">Reply</h4>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`Reply via ${selectedMessage.type}...`}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
                    />
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleReply}
                        className="px-4 py-2 bg-gradient-to-r from-[#01b9d4] to-[#01a5c1] text-white rounded-lg hover:from-[#01a5c1] hover:to-[#0197b5] transition-all"
                      >
                        Send Reply
                      </motion.button>
                      <button
                        onClick={() => {
                          setShowReplyBox(false);
                          setReplyContent('');
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowReplyBox(!showReplyBox)}
                  className="flex-1 bg-gradient-to-r from-[#01b9d4] to-[#01a5c1] text-white px-4 py-2 rounded-lg hover:from-[#01a5c1] hover:to-[#0197b5] transition-all flex items-center justify-center gap-2"
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </motion.button>
                
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <InboxIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a message to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;