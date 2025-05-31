import React, { useState } from 'react';
import { 
  Send, 
  Settings, 
  Zap, 
  BarChart3,
  CheckCircle,
  XCircle,
  Plus,
  MessageSquare,
  Mail,
  Sparkles,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { motion } from 'framer-motion';
import CommunicationHub from '../components/messages/CommunicationHub';
import SmartAutomations from '../components/messages/SmartAutomations';
import Analytics from '../components/messages/Analytics';
import InboxComponent from '../components/messages/Inbox';
import SettingsComponent from '../components/messages/Settings';

type TabType = 'hub' | 'automations' | 'inbox' | 'performance' | 'settings';

const Messages: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('hub');

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
    { id: 'hub', label: 'Communication Hub', icon: Sparkles, description: 'Dashboard & Quick Setup' },
    { id: 'automations', label: 'Smart Automations', icon: Zap, description: 'Templates & Workflows' },
    { id: 'inbox', label: 'Inbox', icon: Inbox, description: 'View Replies' },
    { id: 'performance', label: 'Performance', icon: BarChart3, description: 'Analytics' },
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
          
          <div className="relative p-4 md:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 md:gap-4">
                <img 
                  src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=100&h=100&fit=crop"
                  alt="Healthcare communication"
                  className="w-12 h-12 md:w-16 md:h-16 rounded-xl object-cover shadow-lg border-2 border-white/20"
                />
                <div>
                  <h1 className="text-[20px] md:text-[24px] font-bold font-heading text-white mb-1">Communication Center</h1>
                  <p className="text-xs md:text-sm text-white/90 flex items-center gap-2">
                    <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-yellow-300" />
                    <span className="hidden md:inline">Smart patient messaging</span>
                    <span className="md:hidden">Patient messaging</span>
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full lg:w-auto bg-white/20 backdrop-blur-sm border border-white/30 text-white px-3 md:px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-white/30 hover:shadow-lg transition-all duration-300 font-medium text-sm"
                onClick={() => setActiveTab('hub')}
              >
                <Plus className="w-4 h-4" />
                <span>Compose Message</span>
              </motion.button>
            </div>

            {/* Compact Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-3 hover:bg-white/15 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 bg-gradient-to-br ${stat.gradient} rounded-md`}>
                      <stat.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className={`text-xs font-semibold ${
                      stat.trend === 'up' ? 'text-emerald-400' : 
                      stat.trend === 'down' ? 'text-rose-400' : 
                      'text-gray-400'
                    }`}>
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-lg md:text-xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-300">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Premium Navigation Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`relative p-4 md:p-6 rounded-xl md:rounded-2xl transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-br from-[#01b9d4] to-purple-600 text-white shadow-xl scale-105'
                  : 'bg-white/80 backdrop-blur-sm hover:bg-white text-gray-700 shadow-md hover:shadow-xl border border-gray-200/50'
              }`}
            >
              <div className="flex flex-col items-center gap-2 md:gap-3 text-center">
                <tab.icon className={`w-6 h-6 md:w-8 md:h-8 ${activeTab === tab.id ? 'text-white' : 'text-gray-600'}`} />
                <div>
                  <span className="text-sm md:text-base font-semibold block">{tab.label}</span>
                  <span className={`text-xs ${activeTab === tab.id ? 'text-white/80' : 'text-gray-500'} block mt-1`}>
                    {tab.description}
                  </span>
                </div>
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
              {activeTab === 'hub' && <CommunicationHub />}
              {activeTab === 'automations' && <SmartAutomations />}
              {activeTab === 'inbox' && <InboxComponent />}
              {activeTab === 'performance' && <Analytics />}
              {activeTab === 'settings' && <SettingsComponent />}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Messages;