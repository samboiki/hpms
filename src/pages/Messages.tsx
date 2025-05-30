import React, { useState } from 'react';
import { 
  Send, 
  Settings, 
  FileText, 
  Zap, 
  History, 
  BarChart3,
  CheckCircle,
  XCircle,
  Plus,
  Inbox,
  BrainCircuit,
  MessageSquare,
  Mail,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import Compose from '../components/messages/Compose';
import Templates from '../components/messages/Templates';
import Workflows from '../components/messages/Workflows';
import CommunicationHistory from '../components/messages/CommunicationHistory';
import Analytics from '../components/messages/Analytics';
import InboxComponent from '../components/messages/Inbox';
import EnhancedSettings from '../components/messages/EnhancedSettings';
import AIAssistant from '../components/messages/AIAssistant';

type TabType = 'compose' | 'templates' | 'workflows' | 'history' | 'analytics' | 'inbox' | 'settings' | 'ai-assistant';

const Messages: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('compose');

  const stats = [
    {
      label: 'Messages Today',
      value: '127',
      change: '+12%',
      trend: 'up',
      icon: Send,
      gradient: 'from-blue-500 to-indigo-600'
    },
    {
      label: 'Delivery Rate',
      value: '98.5%',
      change: '+0.5%',
      trend: 'up',
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-green-600'
    },
    {
      label: 'Failed Messages',
      value: '3',
      change: '-2',
      trend: 'down',
      icon: XCircle,
      gradient: 'from-red-500 to-rose-600'
    },
    {
      label: 'Active Workflows',
      value: '8',
      change: '0',
      trend: 'neutral',
      icon: Zap,
      gradient: 'from-purple-500 to-indigo-600'
    }
  ];

  const tabs = [
    { id: 'compose', label: 'Compose', icon: Send, description: 'Send messages' },
    { id: 'inbox', label: 'Inbox', icon: Inbox, description: 'View replies' },
    { id: 'templates', label: 'Templates', icon: FileText, description: 'Message templates' },
    { id: 'workflows', label: 'Workflows', icon: Zap, description: 'Automations' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Performance' },
    { id: 'history', label: 'History', icon: History, description: 'Past messages' },
    { id: 'ai-assistant', label: 'AI Assistant', icon: BrainCircuit, description: 'Smart suggestions' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'Configuration' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-100">
      <div className="px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* Premium Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#2D3142] via-[#4F5D75] to-[#2D3142] rounded-2xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d4]/30 via-purple-600/20 to-[#01b9d4]/30"></div>
          
          {/* Animated decorative elements */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#01b9d4]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          
          {/* Floating icons background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-10 left-20 text-white/10 animate-float">
              <Send className="w-24 h-24" />
            </div>
            <div className="absolute bottom-10 right-32 text-white/10 animate-float" style={{ animationDelay: '2s' }}>
              <MessageSquare className="w-32 h-32" />
            </div>
            <div className="absolute top-20 right-40 text-white/10 animate-float" style={{ animationDelay: '3s' }}>
              <Mail className="w-20 h-20" />
            </div>
          </div>
          
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 md:mb-8">
              <div className="flex items-center gap-4 md:gap-6">
                <img 
                  src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=100&h=100&fit=crop"
                  alt="Healthcare communication"
                  className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover shadow-xl border-4 border-white/20"
                />
                <div>
                  <h1 className="text-[24px] md:text-[30px] font-bold font-heading text-white mb-1 md:mb-2">Communication Center</h1>
                  <p className="text-sm md:text-lg text-white/90 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-yellow-300" />
                    <span className="hidden md:inline">Elevate your patient engagement with intelligent messaging</span>
                    <span className="md:hidden">Smart patient messaging</span>
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full lg:w-auto bg-white/20 backdrop-blur-sm border border-white/30 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl flex items-center justify-center gap-2 md:gap-3 hover:bg-white/30 hover:shadow-xl transition-all duration-300 font-medium"
                onClick={() => setActiveTab('compose')}
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm md:text-base">Compose Message</span>
              </motion.button>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${stat.gradient} rounded-xl blur`}></div>
                  <div className="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-3 bg-gradient-to-br ${stat.gradient} rounded-lg`}>
                        <stat.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className={`text-sm font-semibold ${
                        stat.trend === 'up' ? 'text-emerald-400' : 
                        stat.trend === 'down' ? 'text-rose-400' : 
                        'text-gray-400'
                      }`}>
                        {stat.change}
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                    <p className="text-sm text-gray-300">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Premium Navigation Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`relative p-3 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-br from-[#01b9d4] to-purple-600 text-white shadow-xl scale-105'
                  : 'bg-white/80 backdrop-blur-sm hover:bg-white text-gray-700 shadow-md hover:shadow-xl border border-gray-200/50'
              }`}
            >
              <div className="flex flex-col items-center gap-1 md:gap-2">
                <tab.icon className={`w-5 h-5 md:w-6 md:h-6 ${activeTab === tab.id ? 'text-white' : 'text-gray-600'}`} />
                <span className="text-xs md:text-sm font-semibold">{tab.label}</span>
                <span className={`text-[10px] md:text-xs hidden sm:block ${activeTab === tab.id ? 'text-white/80' : 'text-gray-500'}`}>
                  {tab.description}
                </span>
              </div>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute -bottom-1 left-0 right-0 mx-auto w-8 h-1 bg-white rounded-full"
                />
              )}
            </motion.button>
          ))}
        </div>

        {/* Premium Content Area */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 p-1">
            <div className="bg-white rounded-xl">
              {activeTab === 'compose' && <Compose />}
              {activeTab === 'inbox' && <InboxComponent />}
              {activeTab === 'templates' && <Templates />}
              {activeTab === 'workflows' && <Workflows />}
              {activeTab === 'history' && <CommunicationHistory />}
              {activeTab === 'analytics' && <Analytics />}
              {activeTab === 'ai-assistant' && <AIAssistant />}
              {activeTab === 'settings' && <EnhancedSettings />}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Messages;