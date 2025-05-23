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
  Settings,
  MoreVertical,
  ArrowRight,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

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
    <div className="p-6 space-y-6">
      {/* Header with Welcome */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Welcome Card */}
        <Card className="lg:col-span-1 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] text-white shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Bell size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Messages & Notifications</h2>
                <p className="text-white/80">Manage patient communications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  <Send size={20} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Sent</p>
                  <div className="flex items-baseline">
                    <h3 className="text-2xl font-bold text-gray-900">{stats.totalSent}</h3>
                    <span className="ml-2 text-xs text-green-600">+12%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600">
                  <CheckCircle2 size={20} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Delivered</p>
                  <div className="flex items-baseline">
                    <h3 className="text-2xl font-bold text-gray-900">{stats.delivered}</h3>
                    <span className="ml-2 text-xs text-green-600">98.5%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                  <Clock size={20} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Scheduled</p>
                  <div className="flex items-baseline">
                    <h3 className="text-2xl font-bold text-gray-900">{stats.scheduled}</h3>
                    <span className="ml-2 text-xs text-amber-600">Pending</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: 'all', label: 'All Messages', icon: MessageSquare },
          { key: 'email', label: 'Email', icon: Mail },
          { key: 'sms', label: 'SMS', icon: Phone },
          { key: 'reminders', label: 'Reminders', icon: Clock }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-3 px-4 text-sm font-medium ${
              activeTab === key
                ? 'text-[#01b9d4] border-b-2 border-[#01b9d4]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center">
              <Icon size={16} className="mr-2" />
              {label}
            </div>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Quick Actions & Templates */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Actions Card */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-lg font-semibold flex items-center">
                <Activity size={18} className="mr-2 text-[#01b9d4]" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                  onClick={() => setShowNewMessageModal(true)}
                >
                  <Send size={16} className="mr-2 text-blue-500" />
                  Send Message
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                  onClick={() => setShowTemplateModal(true)}
                >
                  <Mail size={16} className="mr-2 text-green-500" />
                  Create Template
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
                >
                  <Users size={16} className="mr-2 text-purple-500" />
                  Bulk Send
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
                >
                  <Calendar size={16} className="mr-2 text-amber-500" />
                  Schedule Reminder
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Message Templates Card */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-lg font-semibold flex items-center">
                <Mail size={18} className="mr-2 text-green-500" />
                Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {templates.slice(0, 3).map((template) => (
                  <div key={template.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{template.name}</p>
                        <p className="text-xs text-gray-500 truncate">{template.type}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit3 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <Button 
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowTemplateModal(true)}
                >
                  <Plus size={14} className="mr-1" />
                  New Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-lg font-semibold flex items-center">
                <Clock size={18} className="mr-2 text-amber-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {messages.slice(0, 3).map((message) => (
                  <div key={message.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        message.status === 'sent' || message.status === 'delivered' ? 'bg-green-100' : 
                        message.status === 'scheduled' ? 'bg-amber-100' : 'bg-red-100'
                      }`}>
                        {message.type === 'email' ? (
                          <Mail size={14} className={`${
                            message.status === 'sent' || message.status === 'delivered' ? 'text-green-600' : 
                            message.status === 'scheduled' ? 'text-amber-600' : 'text-red-600'
                          }`} />
                        ) : (
                          <MessageSquare size={14} className={`${
                            message.status === 'sent' || message.status === 'delivered' ? 'text-green-600' : 
                            message.status === 'scheduled' ? 'text-amber-600' : 'text-red-600'
                          }`} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{message.patientName}</p>
                        <p className="text-xs text-gray-500">{message.subject}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={message.status === 'sent' || message.status === 'delivered' ? 'success' : 
                               message.status === 'scheduled' ? 'warning' : 'error'}
                      size="sm"
                    >
                      {message.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Message List */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search & Filter Bar */}
          <Card className="bg-white shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search messages or patients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-[#01b9d4] focus:border-[#01b9d4]"
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex items-center"
                  >
                    <Filter size={16} className="mr-2" />
                    Filter
                  </Button>
                  <Button 
                    onClick={() => setShowNewMessageModal(true)}
                    className="bg-[#01b9d4] text-white hover:bg-opacity-90"
                  >
                    <Plus size={16} className="mr-2" />
                    New Message
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message History */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <MessageSquare size={18} className="mr-2 text-[#01b9d4]" />
                  Message History
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs"
                >
                  View All
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs uppercase text-gray-500 bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Patient</th>
                      <th className="px-4 py-3 text-left">Subject</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMessages.map((message) => (
                      <tr key={message.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Badge
                            variant={message.type === 'email' ? 'azure' : 'purple'}
                            size="sm"
                          >
                            {message.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                              <Users size={14} className="text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{message.patientName}</p>
                              <p className="text-xs text-gray-500">{message.recipient}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs">
                            <p className="text-sm font-medium text-gray-900">{message.subject}</p>
                            <p className="text-xs text-gray-500 truncate">{message.content}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={message.status === 'sent' || message.status === 'delivered' ? 'success' : 
                                     message.status === 'scheduled' ? 'warning' : 'error'}
                            size="sm"
                          >
                            {message.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {message.sentAt || message.scheduledFor}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <RefreshCw size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredMessages.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8">
                          <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
                          <p className="text-gray-500">No messages found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">Send New Message</h3>
                <button
                  onClick={() => setShowNewMessageModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X size={24} />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#01b9d4] focus:border-[#01b9d4]"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
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
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X size={24} />
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#01b9d4] focus:border-[#01b9d4]"
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
  );
};

export default Messages;