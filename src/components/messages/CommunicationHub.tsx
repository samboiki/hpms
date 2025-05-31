import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Calendar,
  Gift,
  Heart,
  DollarSign,
  Users,
  Zap,
  TrendingUp,
  CheckCircle,
  Clock,
  MessageSquare,
  Mail,
  Target,
  ArrowRight,
  Plus,
  Settings,
  BarChart3,
  AlertCircle,
  Lightbulb,
  Sparkles,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Compose from './Compose';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  status: 'not_setup' | 'active' | 'inactive';
  setupTime: string;
  impact: string;
  onClick: () => void;
}

interface TodaysMessage {
  id: string;
  patient: string;
  type: 'SMS' | 'EMAIL';
  campaign: string;
  status: 'sent' | 'delivered' | 'failed';
  time: string;
}

interface SmartSuggestion {
  id: string;
  title: string;
  description: string;
  impact: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

const CommunicationHub: React.FC = () => {
  const [todaysMessages, setTodaysMessages] = useState<TodaysMessage[]>([]);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<Record<string, 'not_setup' | 'active' | 'inactive'>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showCompose, setShowCompose] = useState(false);

  // Quick Setup Actions
  const quickActions: QuickAction[] = [
    {
      id: 'appointment-reminders',
      title: 'Appointment Reminders',
      description: 'Reduce no-shows with automated 24h and 2h reminders',
      icon: Calendar,
      color: 'blue',
      gradient: 'from-blue-500 to-indigo-600',
      status: setupStatus['appointment-reminders'] || 'not_setup',
      setupTime: '2 minutes',
      impact: '50% fewer no-shows',
      onClick: () => handleQuickSetup('appointment-reminders')
    },
    {
      id: 'birthday-greetings',
      title: 'Birthday Greetings',
      description: 'Send personalized birthday wishes with checkup reminders',
      icon: Gift,
      color: 'pink',
      gradient: 'from-pink-500 to-rose-600',
      status: setupStatus['birthday-greetings'] || 'not_setup',
      setupTime: '1 minute',
      impact: '25% more annual visits',
      onClick: () => handleQuickSetup('birthday-greetings')
    },
    {
      id: 'follow-up-care',
      title: 'Follow-up Care',
      description: 'Ensure patients follow treatment plans and medications',
      icon: Heart,
      color: 'red',
      gradient: 'from-red-500 to-pink-600',
      status: setupStatus['follow-up-care'] || 'not_setup',
      setupTime: '3 minutes',
      impact: 'Better health outcomes',
      onClick: () => handleQuickSetup('follow-up-care')
    },
    {
      id: 'payment-reminders',
      title: 'Payment Reminders',
      description: 'Gentle reminders for outstanding balances',
      icon: DollarSign,
      color: 'green',
      gradient: 'from-green-500 to-emerald-600',
      status: setupStatus['payment-reminders'] || 'not_setup',
      setupTime: '2 minutes',
      impact: '30% faster payments',
      onClick: () => handleQuickSetup('payment-reminders')
    }
  ];

  // Today's messages - starts empty
  const sampleMessages: TodaysMessage[] = [];

  // Smart suggestions
  const smartSuggestions: SmartSuggestion[] = [
    {
      id: '1',
      title: 'Enable Birthday Campaigns',
      description: 'You have 23 patients with birthdays this month. Set up birthday greetings to increase engagement.',
      impact: '+25% annual visits',
      action: 'Quick Setup',
      priority: 'high'
    },
    {
      id: '2',
      title: 'Payment Reminder Automation',
      description: 'You have R 12,340 in outstanding payments. Automate gentle reminders to improve cash flow.',
      impact: '+30% collection rate',
      action: 'Enable Now',
      priority: 'high'
    },
    {
      id: '3',
      title: 'Follow-up Care Messages',
      description: 'Patients who visited last week could benefit from follow-up care messages.',
      impact: 'Better outcomes',
      action: 'Set up',
      priority: 'medium'
    }
  ];

  useEffect(() => {
    setTodaysMessages(sampleMessages);
    setSuggestions(smartSuggestions);
  }, []);

  const handleQuickSetup = (campaignId: string) => {
    setSelectedCampaign(campaignId);
    setShowSetupModal(true);
  };

  const handleActivateCampaign = () => {
    if (!selectedCampaign) return;
    
    // Update status to active
    setSetupStatus(prev => ({ ...prev, [selectedCampaign]: 'active' }));
    
    // Close modal
    setShowSetupModal(false);
    
    // Show success message
    const campaignName = quickActions.find(a => a.id === selectedCampaign)?.title || '';
    setSuccessMessage(`✅ ${campaignName} has been activated successfully!`);
    setShowSuccess(true);
    
    // Hide success message after 5 seconds
    setTimeout(() => {
      setShowSuccess(false);
    }, 5000);
    
    setSelectedCampaign(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'sent': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_setup': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Success Notification */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 right-4 z-50"
          >
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-lg max-w-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-900">{successMessage}</p>
                  <p className="text-sm text-green-700 mt-1">Messages will be sent automatically based on your settings.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-bold font-heading text-[#494c61] flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-[#01b9d5]" />
            Communication Hub
          </h1>
          <p className="text-gray-600 mt-1">Your complete patient communication dashboard</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCompose(true)}
            className="bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:shadow-lg transition-all duration-300"
          >
            <Send className="w-4 h-4" />
            Compose Message
          </motion.button>
        </div>
      </div>

      {/* Quick Setup Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#01b9d5]" />
          Quick Setup - Get Started in Minutes
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
              >
                <div className={`h-1 bg-gradient-to-r ${action.gradient}`}></div>
                
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 bg-gradient-to-br ${action.gradient} rounded-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(action.status)}`}>
                      {action.status === 'not_setup' ? 'Not Set Up' : action.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-1">{action.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{action.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Setup time:</span>
                      <span className="font-medium">{action.setupTime}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Expected impact:</span>
                      <span className="font-medium text-green-600">{action.impact}</span>
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={action.onClick}
                    className={`w-full py-2 px-3 rounded-lg font-medium transition-all duration-300 ${
                      action.status === 'not_setup'
                        ? `bg-gradient-to-r ${action.gradient} text-white hover:shadow-lg`
                        : action.status === 'active'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {action.status === 'not_setup' ? 'Quick Setup' : 
                     action.status === 'active' ? 'Active ✓' : 'Manage'}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Messages */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#01b9d5]" />
                Today's Messages
              </h3>
              <span className="text-sm text-gray-500">Last updated: just now</span>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {todaysMessages.length > 0 ? (
                todaysMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {message.type === 'SMS' ? (
                          <Phone className="w-4 h-4 text-purple-600" />
                        ) : (
                          <Mail className="w-4 h-4 text-blue-600" />
                        )}
                        {getStatusIcon(message.status)}
                      </div>
                      
                      <div>
                        <p className="font-medium text-gray-900">{message.patient}</p>
                        <p className="text-sm text-gray-600">{message.campaign}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{message.time}</p>
                      <p className={`text-xs ${
                        message.status === 'delivered' ? 'text-green-600' :
                        message.status === 'sent' ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {message.status}
                      </p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No messages sent today</p>
                  <p className="text-sm text-gray-400 mt-1">Messages will appear here once campaigns are active</p>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2 text-center text-[#01b9d5] hover:text-[#01a3c7] font-medium flex items-center justify-center gap-2"
              >
                View All Messages
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Smart Suggestions */}
        <div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Smart Suggestions
            </h3>
            
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border ${getPriorityColor(suggestion.priority)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      suggestion.priority === 'high' ? 'bg-red-100 text-red-700' :
                      suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {suggestion.priority}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-600 font-medium">{suggestion.impact}</span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (suggestion.id === '1') handleQuickSetup('birthday-greetings');
                        else if (suggestion.id === '2') handleQuickSetup('payment-reminders');
                        else if (suggestion.id === '3') handleQuickSetup('follow-up-care');
                      }}
                      className="px-3 py-1 bg-[#01b9d5] text-white rounded-lg text-sm font-medium hover:bg-[#01a3c7] transition-colors"
                    >
                      {suggestion.action}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#01b9d5]" />
            Performance Overview
          </h3>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="text-[#01b9d5] hover:text-[#01a3c7] font-medium flex items-center gap-2"
          >
            View Detailed Analytics
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Messages Sent', value: '0', change: '', trend: 'neutral', icon: Send },
            { label: 'Delivery Rate', value: '-', change: '', trend: 'neutral', icon: Target },
            { label: 'No-show Rate', value: '-', change: '', trend: 'neutral', icon: Calendar },
            { label: 'Engagement', value: '-', change: '', trend: 'neutral', icon: TrendingUp },
            { label: 'Time Saved', value: '0h', change: '', trend: 'neutral', icon: Clock },
            { label: 'ROI', value: '-', change: '', trend: 'neutral', icon: DollarSign }
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-4 bg-gray-50 rounded-lg"
              >
                <Icon className="w-6 h-6 text-[#01b9d5] mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <span className={`text-xs font-medium ${
                  stat.trend === 'up' ? 'text-green-600' : 
                  stat.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {stat.change}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Quick Setup Modal */}
      <AnimatePresence>
        {showSetupModal && selectedCampaign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSetupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-br ${
                  selectedCampaign === 'appointment-reminders' ? 'from-blue-500 to-indigo-600' :
                  selectedCampaign === 'birthday-greetings' ? 'from-pink-500 to-rose-600' :
                  selectedCampaign === 'follow-up-care' ? 'from-red-500 to-pink-600' :
                  'from-green-500 to-emerald-600'
                } rounded-2xl flex items-center justify-center`}>
                  {selectedCampaign === 'appointment-reminders' && <Calendar className="w-8 h-8 text-white" />}
                  {selectedCampaign === 'birthday-greetings' && <Gift className="w-8 h-8 text-white" />}
                  {selectedCampaign === 'follow-up-care' && <Heart className="w-8 h-8 text-white" />}
                  {selectedCampaign === 'payment-reminders' && <DollarSign className="w-8 h-8 text-white" />}
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Quick Setup: {quickActions.find(a => a.id === selectedCampaign)?.title}
                </h3>
                <p className="text-gray-600">
                  {quickActions.find(a => a.id === selectedCampaign)?.description}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    What's Included:
                  </h4>
                  <ul className="space-y-2 text-sm text-green-800">
                    {selectedCampaign === 'appointment-reminders' && (
                      <>
                        <li>• 24-hour SMS reminder before appointments</li>
                        <li>• 2-hour SMS reminder on appointment day</li>
                        <li>• Email confirmation when appointment is booked</li>
                        <li>• Automatic rescheduling notifications</li>
                      </>
                    )}
                    {selectedCampaign === 'birthday-greetings' && (
                      <>
                        <li>• Personalized birthday SMS at 9 AM</li>
                        <li>• Birthday email with special offer</li>
                        <li>• 15% discount on annual checkup</li>
                        <li>• Automatic yearly recurrence</li>
                      </>
                    )}
                    {selectedCampaign === 'follow-up-care' && (
                      <>
                        <li>• Post-visit follow-up email (next day)</li>
                        <li>• Medication reminder SMS</li>
                        <li>• Care instruction reminders</li>
                        <li>• Next appointment notifications</li>
                      </>
                    )}
                    {selectedCampaign === 'payment-reminders' && (
                      <>
                        <li>• Gentle reminder after 7 days</li>
                        <li>• Follow-up reminder after 14 days</li>
                        <li>• Final notice after 30 days</li>
                        <li>• Payment confirmation messages</li>
                      </>
                    )}
                  </ul>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Expected Impact:
                  </h4>
                  <p className="text-blue-800 font-medium">
                    {quickActions.find(a => a.id === selectedCampaign)?.impact}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSetupModal(false)}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Customize First
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleActivateCampaign}
                  className={`flex-1 py-3 px-4 bg-gradient-to-r ${
                    selectedCampaign === 'appointment-reminders' ? 'from-blue-500 to-indigo-600' :
                    selectedCampaign === 'birthday-greetings' ? 'from-pink-500 to-rose-600' :
                    selectedCampaign === 'follow-up-care' ? 'from-red-500 to-pink-600' :
                    'from-green-500 to-emerald-600'
                  } text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300`}
                >
                  Activate Now
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}>
          <Compose onClose={() => setShowCompose(false)} />
        </div>
      )}
    </div>
  );
};

export default CommunicationHub;