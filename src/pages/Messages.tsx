import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { motion } from 'framer-motion';

const Messages: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms' | 'reminders'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock messages data
  const messages = [
    {
      id: '1',
      type: 'email',
      subject: 'Appointment Reminder',
      recipient: 'john.doe@example.com',
      status: 'sent',
      sentAt: '2024-03-15 09:30',
      content: 'Reminder for your appointment tomorrow at 10:00 AM'
    },
    {
      id: '2',
      type: 'sms',
      recipient: '+1234567890',
      status: 'scheduled',
      scheduledFor: '2024-03-16 08:00',
      content: 'Your prescription is ready for pickup'
    },
    // Add more mock messages
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center mb-6">
        <Bell size={28} className="text-primary-600 mr-3" />
        <div>
          <h1 className="text-[30px] font-bold text-[#494c61]">Messages & Notifications</h1>
          <p className="text-gray-600">Manage patient communications and reminders</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <Send size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sent</p>
                <h3 className="text-2xl font-bold text-gray-900">1,234</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <CheckCircle2 size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Delivered</p>
                <h3 className="text-2xl font-bold text-gray-900">1,198</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                <Clock size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <h3 className="text-2xl font-bold text-gray-900">45</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 text-red-600">
                <AlertCircle size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <h3 className="text-2xl font-bold text-gray-900">12</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'all'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All Messages
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'email'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Email
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'sms'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          SMS
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`pb-3 px-4 text-sm font-medium ${
            activeTab === 'reminders'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Reminders
        </button>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline">
                <Filter size={16} className="mr-2" />
                Filter
              </Button>
              <Button>
                <Plus size={16} className="mr-2" />
                New Message
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar size={18} className="mr-2" />
              Appointment Reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900">24h Reminder</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Reminder: Your appointment is tomorrow at {'{time}'} with Dr. {'{doctor}'}.
                </p>
                <div className="mt-3">
                  <Button variant="outline" size="sm">
                    Edit Template
                  </Button>
                </div>
              </div>
              {/* Add more templates */}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare size={18} className="mr-2" />
              Follow-up Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900">Post-Visit</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Thank you for visiting us today. How are you feeling?
                </p>
                <div className="mt-3">
                  <Button variant="outline" size="sm">
                    Edit Template
                  </Button>
                </div>
              </div>
              {/* Add more templates */}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail size={18} className="mr-2" />
              Email Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900">Welcome Email</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Welcome to our practice! Here's what you need to know...
                </p>
                <div className="mt-3">
                  <Button variant="outline" size="sm">
                    Edit Template
                  </Button>
                </div>
              </div>
              {/* Add more templates */}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message History */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Message History</CardTitle>
            <Button variant="outline" size="sm">
              <Users size={16} className="mr-2" />
              Bulk Send
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Recipient</th>
                  <th className="px-6 py-3 text-left">Subject/Content</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Sent/Scheduled</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {messages.map((message) => (
                  <motion.tr
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <Badge
                        variant={message.type === 'email' ? 'azure' : 'coral'}
                        size="sm"
                      >
                        {message.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-900">{message.recipient}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">{message.content}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          message.status === 'sent' ? 'success' :
                          message.status === 'scheduled' ? 'warning' :
                          'error'
                        }
                        size="sm"
                      >
                        {message.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">
                        {message.sentAt || message.scheduledFor}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          Resend
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Messages;