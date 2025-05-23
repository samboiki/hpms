import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Filter, 
  Plus,
  Mail,
  MessageSquare,
  Calendar,
  Send,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit3,
  Trash2,
  Eye,
  RefreshCw,
  X,
  Save,
  Phone,
  Settings
} from 'lucide-react';

const Messages = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'email',
      subject: 'Appointment Reminder',
      recipient: 'john.doe@example.com',
      patientName: 'John Doe',
      status: 'sent',
      sentAt: '2024-03-15 09:30',
      content: 'Reminder for your appointment tomorrow at 10:00 AM with Dr. Smith'
    },
    {
      id: '2',
      type: 'sms',
      subject: 'Prescription Ready',
      recipient: '+1 (555) 123-4567',
      patientName: 'Sarah Johnson',
      status: 'scheduled',
      scheduledFor: '2024-03-16 08:00',
      content: 'Your prescription is ready for pickup at our pharmacy'
    },
    {
      id: '3',
      type: 'email',
      subject: 'Test Results Available',
      recipient: 'mike.wilson@email.com',
      patientName: 'Mike Wilson',
      status: 'delivered',
      sentAt: '2024-03-14 14:22',
      content: 'Your recent test results are now available in your patient portal'
    },
    {
      id: '4',
      type: 'sms',
      subject: 'Follow-up Reminder',
      recipient: '+1 (555) 987-6543',
      patientName: 'Emily Davis',
      status: 'failed',
      sentAt: '2024-03-13 11:15',
      content: 'Time for your follow-up appointment. Please call to schedule.'
    }
  ]);

  const [templates, setTemplates] = useState([
    {
      id: '1',
      name: '24h Appointment Reminder',
      type: 'appointment',
      subject: 'Appointment Reminder - Tomorrow',
      content: 'Dear {patientName}, this is a reminder that you have an appointment tomorrow at {time} with Dr. {doctor}. Please arrive 15 minutes early.',
      variables: ['patientName', 'time', 'doctor']
    },
    {
      id: '2',
      name: 'Prescription Ready',
      type: 'prescription',
      subject: 'Your Prescription is Ready',
      content: 'Hello {patientName}, your prescription for {medication} is ready for pickup at our pharmacy.',
      variables: ['patientName', 'medication']
    },
    {
      id: '3',
      name: 'Welcome New Patient',
      type: 'welcome',
      subject: 'Welcome to Our Practice',
      content: 'Welcome {patientName}! We\'re excited to have you as a patient. Here\'s everything you need to know about your first visit.',
      variables: ['patientName']
    }
  ]);

  const [newMessage, setNewMessage] = useState({
    type: 'email',
    recipient: '',
    patientName: '',
    subject: '',
    content: '',
    scheduleFor: ''
  });

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'appointment',
    subject: '',
    content: '',
    variables: []
  });

  const stats = {
    totalSent: messages.filter(m => m.status === 'sent' || m.status === 'delivered').length,
    delivered: messages.filter(m => m.status === 'delivered').length,
    scheduled: messages.filter(m => m.status === 'scheduled').length,
    failed: messages.filter(m => m.status === 'failed').length
  };

  const filteredMessages = messages.filter(message => {
    const matchesTab = activeTab === 'all' || message.type === activeTab || 
      (activeTab === 'reminders' && message.subject.toLowerCase().includes('reminder'));
    const matchesSearch = message.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const messageId = Date.now().toString();
    const newMsg = {
      ...newMessage,
      id: messageId,
      status: newMessage.scheduleFor ? 'scheduled' : 'sent',
      sentAt: newMessage.scheduleFor || new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    
    setMessages(prev => [newMsg, ...prev]);
    setNewMessage({
      type: 'email',
      recipient: '',
      patientName: '',
      subject: '',
      content: '',
      scheduleFor: ''
    });
    setShowNewMessageModal(false);
  };

  const handleSaveTemplate = (e) => {
    e.preventDefault();
    const templateId = selectedTemplate?.id || Date.now().toString();
    const templateData = {
      ...newTemplate,
      id: templateId,
      variables: newTemplate.content.match(/\{(\w+)\}/g)?.map(v => v.slice(1, -1)) || []
    };

    if (selectedTemplate) {
      setTemplates(prev => prev.map(t => t.id === templateId ? templateData : t));
    } else {
      setTemplates(prev => [...prev, templateData]);
    }

    setNewTemplate({
      name: '',
      type: 'appointment',
      subject: '',
      content: '',
      variables: []
    });
    setSelectedTemplate(null);
    setShowTemplateModal(false);
  };

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setNewTemplate(template);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = (templateId) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'scheduled':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'email':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sms':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Bell size={28} className="text-white" />
            </div>
            <div className="ml-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                Messages & Notifications
              </h1>
              <p className="text-gray-600 mt-1">Manage patient communications and automated reminders</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <Send size={24} className="text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sent</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.totalSent}</h3>
                <p className="text-xs text-green-600 mt-1">+12% from last week</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
                <CheckCircle2 size={24} className="text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Delivered</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.delivered}</h3>
                <p className="text-xs text-green-600 mt-1">98.5% success rate</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
                <Clock size={24} className="text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.scheduled}</h3>
                <p className="text-xs text-blue-600 mt-1">Next in 2 hours</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                <AlertCircle size={24} className="text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.failed}</h3>
                <p className="text-xs text-red-600 mt-1">Needs attention</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 mb-8">
          <div className="flex border-b border-gray-200/50">
            {[
              { key: 'all', label: 'All Messages', icon: MessageSquare },
              { key: 'email', label: 'Email', icon: Mail },
              { key: 'sms', label: 'SMS', icon: Phone },
              { key: 'reminders', label: 'Reminders', icon: Clock }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center px-6 py-4 text-sm font-medium transition-all duration-200 ${
                  activeTab === key
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                }`}
              >
                <Icon size={16} className="mr-2" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Actions */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search messages, patients, or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 w-full rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
              />
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-3 bg-white/80 hover:bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:text-gray-900 transition-all duration-200 flex items-center shadow-sm">
                <Filter size={16} className="mr-2" />
                Filter
              </button>
              <button className="px-4 py-3 bg-white/80 hover:bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:text-gray-900 transition-all duration-200 flex items-center shadow-sm">
                <Settings size={16} className="mr-2" />
                Templates
              </button>
              <button 
                onClick={() => setShowNewMessageModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center shadow-lg hover:shadow-xl"
              >
                <Plus size={16} className="mr-2" />
                New Message
              </button>
            </div>
          </div>
        </div>

        {/* Message Templates */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {[
            { title: 'Appointment Reminders', icon: Calendar, color: 'from-blue-500 to-blue-600', count: templates.filter(t => t.type === 'appointment').length },
            { title: 'Follow-up Messages', icon: MessageSquare, color: 'from-purple-500 to-purple-600', count: templates.filter(t => t.type === 'followup').length },
            { title: 'General Templates', icon: Mail, color: 'from-emerald-500 to-emerald-600', count: templates.filter(t => t.type === 'general').length }
          ].map(({ title, icon: Icon, color, count }) => (
            <div key={title} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <h3 className="ml-3 text-lg font-semibold text-gray-900">{title}</h3>
                  </div>
                  <span className="text-sm text-gray-500">{count} templates</span>
                </div>
                
                <div className="space-y-3">
                  {templates.slice(0, 2).map((template) => (
                    <div key={template.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all duration-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-1">{template.name}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{template.content.substring(0, 80)}...</p>
                        </div>
                        <div className="flex gap-1 ml-3">
                          <button 
                            onClick={() => handleEditTemplate(template)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => setShowTemplateModal(true)}
                  className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 rounded-xl font-medium transition-all duration-200 flex items-center justify-center"
                >
                  <Plus size={16} className="mr-2" />
                  Add Template
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Message History */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
          <div className="p-6 border-b border-gray-200/50">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Message History</h3>
                <p className="text-gray-600 mt-1">Recent communications and their status</p>
              </div>
              <button className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 flex items-center shadow-lg">
                <Users size={16} className="mr-2" />
                Bulk Send
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMessages.map((message, index) => (
                  <tr key={message.id} className="hover:bg-gray-50/50 transition-all duration-200" style={{ animationDelay: `${index * 50}ms` }}>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(message.type)}`}>
                        {message.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{message.patientName}</div>
                        <div className="text-sm text-gray-500">{message.recipient}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-sm">
                        <div className="font-medium text-gray-900">{message.subject}</div>
                        <div className="text-sm text-gray-500 truncate">{message.content}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(message.status)}`}>
                        {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {message.sentAt || message.scheduledFor}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200">
                          <Eye size={16} />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200">
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Message Modal */}
        {showNewMessageModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900">Send New Message</h3>
                  <button
                    onClick={() => setShowNewMessageModal(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSendMessage} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
                    <select
                      value={newMessage.type}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Patient Name</label>
                    <input
                      type="text"
                      value={newMessage.patientName}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, patientName: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter patient name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {newMessage.type === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  <input
                    type={newMessage.type === 'email' ? 'email' : 'tel'}
                    value={newMessage.recipient}
                    onChange={(e) => setNewMessage(prev => ({ ...prev, recipient: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={newMessage.type === 'email' ? 'patient@example.com' : '+1 (555) 123-4567'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <input
                    type="text"
                    value={newMessage.subject}
                    onChange={(e) => setNewMessage(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter message subject"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
                  <textarea
                    value={newMessage.content}
                    onChange={(e) => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your message content..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule for Later (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={newMessage.scheduleFor}
                    onChange={(e) => setNewMessage(prev => ({ ...prev, scheduleFor: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewMessageModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center"
                  >
                    <Send size={16} className="mr-2" />
                    {newMessage.scheduleFor ? 'Schedule Message' : 'Send Now'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedTemplate ? 'Edit Template' : 'Create New Template'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowTemplateModal(false);
                      setSelectedTemplate(null);
                      setNewTemplate({
                        name: '',
                        type: 'appointment',
                        subject: '',
                        content: '',
                        variables: []
                      });
                    }}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSaveTemplate} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter template name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Template Type</label>
                    <select
                      value={newTemplate.type}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="appointment">Appointment</option>
                      <option value="prescription">Prescription</option>
                      <option value="followup">Follow-up</option>
                      <option value="welcome">Welcome</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
                  <input
                    type="text"
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter subject line"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Content
                    <span className="text-xs text-gray-500 ml-2">Use {'{variableName}'} for dynamic content</span>
                  </label>
                  <textarea
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter template content with variables like {patientName}, {date}, {time}..."
                    required
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Available Variables</h4>
                  <div className="text-sm text-blue-700">
                    <p className="mb-1">Common variables: {'{patientName}'}, {'{date}'}, {'{time}'}, {'{doctor}'}, {'{medication}'}</p>
                    <p>Variables will be automatically detected from your content.</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplateModal(false);
                      setSelectedTemplate(null);
                      setNewTemplate({
                        name: '',
                        type: 'appointment',
                        subject: '',
                        content: '',
                        variables: []
                      });
                    }}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center"
                  >
                    <Save size={16} className="mr-2" />
                    {selectedTemplate ? 'Update Template' : 'Save Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;