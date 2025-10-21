import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon, { SolarIcons } from '../components/ui/Icon';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { useTheme } from '../stores/themeStore';
import { motion } from 'framer-motion';
import BranchManagement from '../components/settings/BranchManagement';
import { EnhancedUserManagement } from '../components/settings/EnhancedUserManagement';
import DepartmentManagement from '../components/settings/DepartmentManagement';
import PracticeExpenses from '../components/settings/PracticeExpenses';
import PracticeInventory from '../components/settings/PracticeInventory';
import { usePractice } from '../contexts/PracticeContext';
import FloatingVisitTracker from '../components/dashboard/FloatingVisitTracker';
import TimePickerModal from '../components/ui/TimePickerModal';
import { platformSettings, getPlatformDefaults } from '../config/socialPlatformSettings';
import { GmailSettingsModal } from '../components/settings/GmailSettingsModal';
import { GmailOAuthSettings } from '../components/settings/GmailOAuthSettings';
import { useSettingsBundle, useInvalidateSettings } from '../hooks/useSettingsBundle';

// Feature flag for optimized data fetching
const USE_OPTIMIZED_BUNDLE = true;

// Iconify is now handled by @iconify/react package

interface BusinessHours {
  day: string;
  hours: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

const Settings: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { currentTheme, themes, setTheme } = useTheme();

  // Use optimized bundle for all settings data
  const {
    data: bundleData,
    isLoading: bundleLoading,
    error: bundleError,
    refetch: refetchBundle
  } = useSettingsBundle();
  const invalidateSettings = useInvalidateSettings();

  // Check URL params to determine initial tab
  const getInitialTab = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['account', 'users', 'practice', 'documents', 'social', 'system'].includes(tabParam)) {
      return tabParam as any;
    }
    // If we have OAuth code, default to social tab
    if (urlParams.get('code')) {
      return 'social';
    }
    return 'account';
  };

  const [activeTab, setActiveTab] = useState<'account' | 'users' | 'practice' | 'documents' | 'social' | 'system'>(getInitialTab());
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const { practiceId } = usePractice();

  const tabIcons = {
    account: SolarIcons.user,
    users: SolarIcons.users,
    practice: SolarIcons.building,
    documents: SolarIcons.document,
    social: SolarIcons.globe,
    system: SolarIcons.settings
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">

        {/* Header Section */}
        <div className="rounded-xl">
          <div className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              {/* Page Title and Icon */}
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                  <Icon icon="solar:settings-bold-duotone" className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">Settings</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Manage your practice and account settings</p>
                </div>
              </div>

              {/* User Avatar with Dropdown */}
              {user && (
                <div className="relative">
                  <button
                    ref={avatarButtonRef}
                    onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                    className="relative group focus:outline-none"
                  >
                    {/* Pulsating outer ring */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300`}></div>
                    <div className={`absolute -inset-1 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full opacity-50`}></div>
                    
                    {/* Avatar circle */}
                    <div className="relative h-16 w-16 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                      <img 
                        src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                        alt={user.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`;
                        }}
                      />
                    </div>
                  </button>

                  {/* Premium Dropdown Modal - Using Portal for maximum z-index control */}
                  {isAvatarDropdownOpen && createPortal(
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998] animate-in fade-in duration-200" 
                        onClick={() => setIsAvatarDropdownOpen(false)}
                      />
                      
                      {/* Premium Modal Dropdown */}
                      <div 
                        style={{
                          position: 'fixed',
                          top: avatarButtonRef.current ? avatarButtonRef.current.getBoundingClientRect().bottom + 16 : 0,
                          right: avatarButtonRef.current ? window.innerWidth - avatarButtonRef.current.getBoundingClientRect().right : 0,
                          zIndex: 99999
                        }}
                        className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-[320px] animate-in fade-in slide-in-from-top-3 duration-300"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
                          <button 
                            onClick={() => setIsAvatarDropdownOpen(false)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
                          </button>
                        </div>
                        
                        {/* User Info Card */}
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6">
                          <div className="flex items-start gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="h-14 w-14 rounded-full overflow-hidden border-3 border-white shadow-lg">
                                <img 
                                  src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                                  alt={user.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-base font-semibold text-gray-900 truncate">{user.name}</p>
                              <p className="text-sm text-gray-500 break-words" style={{ wordBreak: 'break-word' }}>{user.email}</p>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white mt-1">
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Logout Button */}
                        <button
                          onClick={() => {
                            setIsAvatarDropdownOpen(false);
                            logout();
                          }}
                          className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <Icon icon="solar:logout-3-bold-duotone" className="w-5 h-5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Premium Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-6 gap-0 w-full">
            {(['account', 'users', 'practice', 'documents', 'social', 'system'] as const).map((tab, index) => {
              const iconName = tabIcons[tab];
              const isActive = activeTab === tab;
              const tabLabel = tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200 capitalize min-h-[60px] ${
                    isActive
                      ? `bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg`
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon icon={iconName} className={`w-5 h-5 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                  <span className="truncate text-center sm:text-left">{tabLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div>
          {/* Content */}
          <div>
            <div className="min-h-[600px]">
              {activeTab === 'account' && (
                <AccountTabContent />
              )}
          
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <CardHeader>
                      <div className="flex items-center gap-3 -ml-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <Icon icon={SolarIcons.lock} className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold text-gray-900">Change Password</CardTitle>
                          <p className="text-sm text-gray-500">Update your security credentials</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <Icon icon={SolarIcons.lock} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="password"
                          id="current-password"
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-purple-500 
                            transition-all duration-200 text-gray-700
                            hover:bg-gray-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <Icon icon={SolarIcons.lock} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="password"
                          id="new-password"
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-purple-500 
                            transition-all duration-200 text-gray-700
                            hover:bg-gray-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Icon icon={SolarIcons.lock} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="password"
                          id="confirm-password"
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-purple-500 
                            transition-all duration-200 text-gray-700
                            hover:bg-gray-200"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                      <Icon icon={SolarIcons.shield} className="w-5 h-5 mr-2" />
                      Update Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3 -ml-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Icon icon={SolarIcons.shield} className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Two-Factor Authentication</CardTitle>
                      <p className="text-sm text-gray-500">Add an extra layer of security</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon icon={SolarIcons.checkCircle} className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-900">Two-factor authentication is enabled</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Two-factor authentication adds an extra layer of security to your account.
                        In addition to your password, you'll need to enter a code that we text to your phone.
                      </p>
                      <div className="mt-3">
                        <Button variant="outline" size="sm">
                          <Icon icon={SolarIcons.settings} className="w-4 h-4 mr-2" />
                          Manage 2FA Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3 -ml-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon icon={SolarIcons.hardDrive} className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Login Sessions</CardTitle>
                      <p className="text-sm text-gray-500">Manage your active sessions</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 px-4 bg-green-50 border border-green-100 rounded-lg">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-full">
                          <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">Current Session</p>
                          <p className="text-xs text-gray-500">This device • 42.122.144.55 • San Francisco, USA</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" disabled>
                        Active
                      </Button>
                    </div>
                    
                    <div className="flex justify-between items-center py-3 px-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="p-2 bg-gray-100 rounded-full">
                          <Icon icon={SolarIcons.hardDrive} className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">Mac OS • Chrome</p>
                          <p className="text-xs text-gray-500">34.232.123.55 • New York, USA • 3 days ago</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        End Session
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button variant="outline" className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 hover:bg-red-50">
                      Log Out of All Sessions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          
          {activeTab === 'system' && (
            <div className="space-y-4">
              {/* System Information Section */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Icon icon={SolarIcons.server} className="w-5 h-5 text-purple-600" />
                    System Information
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <Icon icon={SolarIcons.checkCircle} className="w-3 h-3" />
                      All Systems Operational
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">System Version</label>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900 font-medium">HealthCare 2.5.0</p>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">Latest</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                      <p className="text-gray-900">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                      <p className="text-gray-900">Production</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Database Status</label>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-gray-900">Connected - PostgreSQL 15.3</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Storage Usage</label>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Used: 1.2 GB</span>
                          <span className="text-gray-600">Total: 10 GB</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full" style={{ width: '12%' }}></div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API Status</label>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-gray-900">Active - 99.9% Uptime</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4" />
                    Check for Updates
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Icon icon="solar:chart-bold-duotone" className="w-4 h-4" />
                    System Diagnostics
                  </Button>
                </div>
              </div>
              
              {/* Company Information Section */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Icon icon={SolarIcons.building} className="w-5 h-5 text-purple-600" />
                    Company Information
                  </h3>
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:verified-check-bold-duotone" className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">Verified Provider</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                      <p className="text-gray-900 font-medium">OneHealth Systems</p>
                      <p className="text-sm text-gray-500">Healthcare Practice Management Solutions</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                      <a href="tel:081222331" className="text-gray-900 hover:text-purple-600 transition-colors">
                        081 222 331
                      </a>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                      <a href="mailto:support@onehealthsystems.com" className="text-gray-900 hover:text-purple-600 transition-colors">
                        support@onehealthsystems.com
                      </a>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <a href="https://onehealthsystems.com" target="_blank" rel="noopener noreferrer" 
                         className="text-gray-900 hover:text-purple-600 transition-colors flex items-center gap-1">
                        onehealthsystems.com
                        <Icon icon="solar:square-arrow-right-up-line-duotone" className="w-4 h-4" />
                      </a>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Headquarters</label>
                      <p className="text-gray-900">South Africa</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">License</label>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900">Enterprise License</p>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">Active</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Support Resources</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Icon icon="solar:chat-line-bold-duotone" className="w-4 h-4" />
                      Live Chat
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Icon icon="solar:book-bold-duotone" className="w-4 h-4" />
                      Documentation
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Icon icon="solar:ticket-bold-duotone" className="w-4 h-4" />
                      Support Ticket
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Icon icon="solar:phone-calling-bold-duotone" className="w-4 h-4" />
                      Call Support
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Security & Compliance Section */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Icon icon={SolarIcons.shield} className="w-5 h-5 text-purple-600" />
                    Security & Compliance
                  </h3>
                  <Button size="sm" className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                    <Icon icon={SolarIcons.save} className="w-4 h-4 mr-1" />
                    Save Settings
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">HIPAA Audit Logging</h4>
                        <p className="text-sm text-gray-500 mt-0.5">Log all data access and modifications for compliance</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">Data Encryption</h4>
                        <p className="text-sm text-gray-500 mt-0.5">End-to-end encryption for all patient data</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
                        <p className="text-sm text-gray-500 mt-0.5">Require 2FA for all user accounts</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">Session Timeout</h4>
                        <p className="text-sm text-gray-500 mt-0.5">Auto-logout after inactivity period</p>
                      </div>
                      <select className="px-3 py-2 rounded-lg bg-white border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm">
                        <option value="5">5 minutes</option>
                        <option value="15" selected>15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">60 minutes</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">Password Policy</h4>
                        <p className="text-sm text-gray-500 mt-0.5">Enforce strong password requirements</p>
                      </div>
                      <span className="text-sm text-gray-700">Min. 12 characters</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Compliance Status</p>
                      <p className="text-sm text-blue-700 mt-1">Your practice meets all HIPAA compliance requirements. Last audit: October 2023</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Theme Settings Section */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Icon icon="solar:palette-bold-duotone" className="w-5 h-5 text-purple-600" />
                    Color Themes
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Choose your preferred color scheme</span>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-6">
                      Select a color theme to personalize the appearance of your dashboard and sidebar. 
                      Changes are applied immediately and saved automatically.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {themes.map((theme, index) => (
                      <motion.div
                        key={theme.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`group relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-300 ${
                          currentTheme.id === theme.id
                            ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-white shadow-2xl ring-4 ring-purple-100'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-xl bg-gradient-to-br from-white to-gray-50'
                        }`}
                        onClick={() => setTheme(theme.id, practiceId || undefined)}
                      >
                        {/* Theme Preview */}
                        <div className="space-y-3">
                          {/* Enhanced Gradient Preview with Glass Effect */}
                          <div className={`h-10 rounded-xl bg-gradient-to-r ${theme.gradients.sidebar} shadow-lg relative overflow-hidden border border-white/20`}>
                            <div className="absolute inset-0 bg-white/20 backdrop-blur-sm"></div>
                            <div className="absolute bottom-1 left-2 right-2 h-0.5 bg-white/40 rounded-full"></div>
                            <div className="absolute top-1 left-2 w-8 h-0.5 bg-white/60 rounded-full"></div>
                          </div>
                          
                          {/* Theme Info */}
                          <div>
                            <h5 className="text-sm font-bold text-gray-900 group-hover:text-gray-800">{theme.name}</h5>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{theme.description}</p>
                          </div>
                          
                          {/* Enhanced Color Palette */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded-full border-2 border-white shadow-lg ring-1 ring-gray-200"
                                style={{ backgroundColor: theme.colors.primary.from }}
                              ></div>
                              <div
                                className="w-5 h-5 rounded-full border-2 border-white shadow-lg ring-1 ring-gray-200"
                                style={{ backgroundColor: theme.colors.primary.to }}
                              ></div>
                              {theme.colors.primary.via && (
                                <div
                                  className="w-5 h-5 rounded-full border-2 border-white shadow-lg ring-1 ring-gray-200"
                                  style={{ backgroundColor: theme.colors.primary.via }}
                                ></div>
                              )}
                              {theme.colors.accent && (
                                <div
                                  className="w-5 h-5 rounded-full border-2 border-white shadow-lg ring-1 ring-gray-200"
                                  style={{ backgroundColor: theme.colors.accent.from }}
                                ></div>
                              )}
                            </div>
                            <div className="text-right">
                              <span className={`text-xs font-bold tracking-wide ${
                                currentTheme.id === theme.id 
                                  ? 'text-purple-600' 
                                  : 'text-gray-400 group-hover:text-gray-500'
                              }`}>
                                {currentTheme.id === theme.id ? 'ACTIVE' : 'SELECT'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Premium Selected Indicator */}
                        {currentTheme.id === theme.id && (
                          <motion.div 
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", duration: 0.6 }}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-xl ring-4 ring-white"
                          >
                            <Icon icon="solar:check-bold-duotone" className="w-4 h-4 text-white" />
                          </motion.div>
                        )}
                        
                        {/* Hover Glow Effect */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Premium Theme Information */}
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 mt-8 border border-purple-100">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-purple-100 rounded-xl">
                        <Icon icon="solar:star-bold-duotone" className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h5 className="text-lg font-bold text-gray-900 mb-2">
                          Active: {currentTheme.name}
                        </h5>
                        <p className="text-sm text-gray-700 mb-3">
                          {currentTheme.description}
                        </p>
                        <div className="flex items-center gap-6 text-xs text-gray-600">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            Applied System-wide
                          </span>
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            {themes.length} Themes Available
                          </span>
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                            Auto-saved
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'users' && (
            <EnhancedUserManagement />
          )}
          
          {activeTab === 'practice' && (
            <PracticeProfileContent
              onTabChange={setActiveTab}
              bundleData={bundleData}
              bundleLoading={bundleLoading}
            />
          )}
          
          {activeTab === 'documents' && (
            <PracticeDocumentsContent
              bundleData={bundleData}
              bundleLoading={bundleLoading}
            />
          )}
          
          {activeTab === 'social' && (
            <PracticeSocialAccountsContent />
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Visit Tracker */}
      {practiceId && <FloatingVisitTracker practiceId={practiceId} />}
    </div>
  );
};

// Helper function to convert 24hr time to 12hr format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Helper function to convert object format to array format for UI
interface BusinessHoursData {
  [key: string]: {
    open?: string;
    close?: string;
    closed?: boolean;
  };
}

const convertBusinessHoursObjectToArray = (hoursObj: BusinessHoursData | BusinessHours[]): BusinessHours[] => {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // Day key mapping removed - not used
  
  if (!hoursObj || typeof hoursObj !== 'object') {
    // Return default hours if no data
    return daysOfWeek.map(day => ({
      day,
      hours: day === 'Saturday' || day === 'Sunday' ? 'Closed' : '8:00 AM - 5:00 PM',
      isOpen: day !== 'Saturday' && day !== 'Sunday',
      openTime: day !== 'Saturday' && day !== 'Sunday' ? '08:00' : '',
      closeTime: day !== 'Saturday' && day !== 'Sunday' ? '17:00' : ''
    }));
  }
  
  // If it's already an array, return it
  if (Array.isArray(hoursObj)) {
    return hoursObj;
  }
  
  // Convert object format to array format
  return daysOfWeek.map(day => {
    const dayKey = day.toLowerCase();
    const dayData = hoursObj[dayKey];
    
    if (!dayData || dayData.closed) {
      return {
        day,
        hours: 'Closed',
        isOpen: false,
        openTime: '',
        closeTime: ''
      };
    }
    
    const openTime = dayData.open || '09:00';
    const closeTime = dayData.close || '17:00';
    
    return {
      day,
      hours: `${formatTime12Hour(openTime)} - ${formatTime12Hour(closeTime)}`,
      isOpen: true,
      openTime,
      closeTime
    };
  });
};

// Practice Profile Component
const PracticeProfileContent: React.FC<{
  onTabChange?: (tab: string) => void;
  bundleData?: any;
  bundleLoading?: boolean;
}> = ({ bundleData, bundleLoading }) => {
  const { user } = useAuthStore();
  const { currentTheme } = useTheme();
  const [practiceTab, setPracticeTab] = useState<'profile' | 'hours' | 'branches' | 'expenses' | 'departments' | 'inventory'>('profile');
  const [practiceData, setPracticeData] = useState({
    id: '',
    name: '',
    logo_url: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Namibia',
    contact_phone: '',
    contact_email: '',
    about_text: '',
    website_url: '',
    business_hours: {} as any,
    services: [] as any[],
    social_links: {} as any,
    primary_color: '#01b9d5',
    secondary_color: '#0196be',
    hero_title: '',
    hero_subtitle: '',
    license_number: '',
    practice_number: '',
    tax_number: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [formData, setFormData] = useState(practiceData);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timePickerConfig, setTimePickerConfig] = useState<{
    dayIndex: number;
    field: string;
  } | null>(null);
  
  // Default mock data structure (keeping for reference)
  const defaultMockData = {
    name: 'HealthCare Medical Center',
    logo: 'https://images.pexels.com/photos/5412/water-blue-ocean.jpg?auto=compress&cs=tinysrgb&w=300',
    address: '123 Main Street, Suite 100, Anytown, CA 94321',
    phone: '(555) 123-4567',
    email: 'info@healthcaremedical.com',
    website: 'www.healthcaremedical.com',
    description: 'HealthCare Medical Center is dedicated to providing comprehensive healthcare services with a focus on patient comfort and cutting-edge medical technology. Our team of experienced healthcare professionals is committed to delivering personalized care to meet the unique needs of each patient.',
    specialties: ['Family Medicine', 'Internal Medicine', 'Pediatrics', 'Cardiology'],
    hours: [
      { day: 'Monday', hours: '8:00 AM - 6:00 PM' },
      { day: 'Tuesday', hours: '8:00 AM - 6:00 PM' },
      { day: 'Wednesday', hours: '8:00 AM - 6:00 PM' },
      { day: 'Thursday', hours: '8:00 AM - 6:00 PM' },
      { day: 'Friday', hours: '8:00 AM - 5:00 PM' },
      { day: 'Saturday', hours: '9:00 AM - 1:00 PM' },
      { day: 'Sunday', hours: 'Closed' },
    ]
  };

  // Load practice data from bundle or database
  useEffect(() => {
    const loadPracticeData = async () => {
      if (!user?.practice_id) {
        setLoading(false);
        return;
      }

      // Use bundled data if available and feature flag is enabled
      if (USE_OPTIMIZED_BUNDLE && bundleData?.practice) {
        console.log('⚡ Using optimized bundle data for practice');
        const practice = bundleData.practice;

        if (practice) {
          console.log('✅ Practice data loaded from bundle:', practice.name);

          const practiceInfo = {
            id: practice.id,
            name: practice.name || '',
            logo_url: practice.logo_url || '',
            address: practice.address || '',
            city: practice.city || '',
            postal_code: practice.postal_code || '',
            country: practice.country || 'Namibia',
            contact_phone: practice.contact_phone || '',
            contact_email: practice.contact_email || '',
            about_text: practice.about_text || '',
            website_url: practice.website_url || practice.domain || '',
            business_hours: convertBusinessHoursObjectToArray(practice.business_hours),
            services: practice.services || defaultMockData.specialties,
            social_links: practice.social_links || {},
            primary_color: practice.primary_color || '#01b9d5',
            secondary_color: practice.secondary_color || '#0196be',
            hero_title: practice.hero_title || '',
            hero_subtitle: practice.hero_subtitle || '',
            license_number: practice.license_number || '',
            practice_number: practice.practice_number || '',
            tax_number: practice.tax_number || ''
          };

          setPracticeData(practiceInfo);
          setFormData(practiceInfo);
        }
        setLoading(false);
      } else if (!USE_OPTIMIZED_BUNDLE) {
        // Fallback to direct Supabase call if feature flag is disabled
        try {
          console.log('📊 Loading practice data for ID:', user.practice_id);

          const { data: practice, error } = await supabase
            .from('practices')
            .select('*')
            .eq('id', user.practice_id)
            .single();

          if (error) {
            console.error('❌ Error loading practice data:', error);
            setLoading(false);
            return;
          }

          if (practice) {
            console.log('✅ Practice data loaded:', practice.name);

            const practiceInfo = {
              id: practice.id,
              name: practice.name || '',
              logo_url: practice.logo_url || '',
              address: practice.address || '',
              city: practice.city || '',
              postal_code: practice.postal_code || '',
              country: practice.country || 'Namibia',
              contact_phone: practice.contact_phone || '',
              contact_email: practice.contact_email || '',
              about_text: practice.about_text || '',
              website_url: practice.website_url || practice.domain || '',
              business_hours: convertBusinessHoursObjectToArray(practice.business_hours),
              services: practice.services || defaultMockData.specialties,
              social_links: practice.social_links || {},
              primary_color: practice.primary_color || '#01b9d5',
              secondary_color: practice.secondary_color || '#0196be',
              hero_title: practice.hero_title || '',
              hero_subtitle: practice.hero_subtitle || '',
              license_number: practice.license_number || '',
              practice_number: practice.practice_number || '',
              tax_number: practice.tax_number || ''
            };

            setPracticeData(practiceInfo);
            setFormData(practiceInfo);
          }
        } catch (error) {
          console.error('❌ Error loading practice data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        // Bundle is still loading
        setLoading(bundleLoading || false);
      }
    };

    loadPracticeData();
  }, [user?.practice_id, bundleData, bundleLoading]);

  // Helper function to convert array format to object format for practices table
  const convertBusinessHoursArrayToObject = (hoursArray: BusinessHours[]) => {
    const hoursObject: Record<string, { open?: string; close?: string; closed?: boolean }> = {};
    const dayMap: Record<string, string> = {
      'Monday': 'monday',
      'Tuesday': 'tuesday',
      'Wednesday': 'wednesday',
      'Thursday': 'thursday',
      'Friday': 'friday',
      'Saturday': 'saturday',
      'Sunday': 'sunday'
    };
    
    hoursArray.forEach((schedule) => {
      const dayKey = dayMap[schedule.day];
      if (dayKey) {
        if (schedule.isOpen && schedule.openTime && schedule.closeTime) {
          hoursObject[dayKey] = {
            open: schedule.openTime,
            close: schedule.closeTime
          };
        } else {
          hoursObject[dayKey] = { closed: true };
        }
      }
    });
    
    return hoursObject;
  };

  // Save practice data to database
  const savePracticeData = async (updates: Partial<typeof practiceData>) => {
    if (!user?.practice_id || saving) return;

    try {
      setSaving(true);
      console.log('💾 Saving practice data...', updates);
      
      // Convert business_hours array format to object format if present
      const processedUpdates = { ...updates };
      if (updates.business_hours && Array.isArray(updates.business_hours)) {
        processedUpdates.business_hours = convertBusinessHoursArrayToObject(updates.business_hours);
      }
      
      const { error } = await supabase
        .from('practices')
        .update({
          ...processedUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.practice_id);

      if (error) {
        console.error('❌ Error saving practice data:', error);
        alert('Failed to save changes. Please try again.');
        return;
      }

      // Update local state
      setPracticeData(prev => ({ ...prev, ...updates }));
      setFormData(prev => ({ ...prev, ...updates }));
      setEditingSection(null);
      setEditMode(false);
      
      console.log('✅ Practice data saved successfully');
      
      // Show success message
      const successDiv = document.createElement('div');
      successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successDiv.textContent = 'Changes saved successfully!';
      document.body.appendChild(successDiv);
      setTimeout(() => {
        document.body.removeChild(successDiv);
      }, 3000);
      
    } catch (error) {
      console.error('❌ Error saving practice data:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const updates = Object.keys(formData).reduce((acc, key) => {
      if (formData[key as keyof typeof formData] !== practiceData[key as keyof typeof practiceData]) {
        acc[key] = formData[key as keyof typeof formData];
      }
      return acc;
    }, {} as any);
    
    console.log('🔍 Debug handleSave:', {
      editingSection,
      updates,
      formData_about_text: formData.about_text,
      practiceData_about_text: practiceData.about_text,
      hasUpdates: Object.keys(updates).length > 0
    });
    
    if (Object.keys(updates).length > 0) {
      savePracticeData(updates);
    } else {
      setEditingSection(null);
    }
  };

  const handleCancel = () => {
    setFormData(practiceData);
    setEditingSection(null);
  };

  const handleLogoUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    try {
      setSaving(true);
      console.log('📤 Uploading logo...', file.name);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `practice-logos/${practiceData.id}/logo_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        alert('Failed to upload logo. Please try again.');
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        // Save logo URL to database
        await savePracticeData({ logo_url: urlData.publicUrl });
        console.log('✅ Logo uploaded and saved:', urlData.publicUrl);
      }

    } catch (error) {
      console.error('❌ Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading practice information...</p>
        </div>
      </div>
    );
  }

  // Tab configuration
  const tabs = [
    { id: 'profile' as const, label: 'Practice Profile', icon: SolarIcons.building },
    { id: 'expenses' as const, label: 'Practice Overhead', icon: SolarIcons.wallet },
    { id: 'branches' as const, label: 'Branches', icon: SolarIcons.buildings },
    { id: 'departments' as const, label: 'Departments', icon: SolarIcons.folder },
    { id: 'inventory' as const, label: 'Inventory', icon: 'solar:box-bold-duotone' }
  ];

  return (
    <div className="flex gap-6">
      {/* Left Sidebar - Practice Navigation */}
      <div className="w-80 shrink-0">
        <Card className="bg-white border border-gray-200 shadow-sm sticky top-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                <Icon icon={SolarIcons.building} className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-gray-900">Practice Settings</CardTitle>
                <p className="text-xs text-gray-500">Configure your practice</p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Loading...</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {/* Practice Info */}
                <div className="px-4 py-3 bg-purple-50 border-l-2 border-purple-500">
                  {practiceData.logo_url ? (
                    <img
                      src={practiceData.logo_url}
                      alt={practiceData.name}
                      className="w-12 h-12 rounded-lg object-cover mb-2"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center mb-2">
                      <Icon icon={SolarIcons.building} className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-900">{practiceData.name || 'Practice Name'}</p>
                  <p className="text-xs text-gray-500">{practiceData.city || 'Location'}</p>
                </div>

                {/* Navigation Buttons */}
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start hover:bg-gray-50"
                    onClick={() => window.open(`https://${practiceData.website_url}`, '_blank')}
                  >
                    <Icon icon={SolarIcons.globe} className="w-4 h-4 mr-2" />
                    Preview Website
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Column - Main Content */}
      <div className="flex-1 space-y-4">
        {/* Header with Tabs */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {practiceData.name || 'Practice Management'}
                </h2>
                <p className="text-sm text-gray-600">
                  Manage your practice information and settings
                </p>
              </div>
              {editMode && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
            
            {/* Compact Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPracticeTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    practiceTab === tab.id
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon={tab.icon} className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tab Content */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <motion.div
            key={practiceTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            {/* Practice Info Tab */}
            {practiceTab === 'profile' && (
              <div className="space-y-6">
                {/* Practice Logo Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Icon icon={SolarIcons.image} className="w-5 h-5 text-purple-600" />
                      Practice Logo
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex-shrink-0">
                      {practiceData.logo_url ? (
                        <img
                          src={practiceData.logo_url}
                          alt={`${practiceData.name} logo`}
                          className="w-32 h-32 object-contain rounded-lg border-2 border-gray-200"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(practiceData.name || 'Practice')}&size=128&background=6366f1&color=ffffff`;
                          }}
                        />
                      ) : (
                        <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <Icon icon={SolarIcons.building} className="w-16 h-16 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Upload Logo</h4>
                      <p className="text-sm text-gray-500 mb-4">
                        Recommended size: 512x512px. Maximum file size: 10MB. Supported formats: JPG, PNG, SVG
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          id="logo-upload"
                          accept="image/*"
                          onChange={(e) => handleLogoUpload(e as unknown as Event)}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('logo-upload')?.click()}
                          disabled={saving}
                        >
                          <Icon icon={SolarIcons.upload} className="w-4 h-4 mr-2" />
                          {practiceData.logo_url ? 'Replace Logo' : 'Upload Logo'}
                        </Button>
                        {practiceData.logo_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => savePracticeData({ logo_url: '' })}
                            disabled={saving}
                          >
                            <Icon icon={SolarIcons.trash} className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Information Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Icon icon={SolarIcons.info} className="w-5 h-5 text-purple-600" />
                      Basic Information
                    </h3>
                    {editingSection !== 'basic_info' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingSection('basic_info')}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Practice Name</label>
                      {editingSection === 'basic_info' ? (
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{practiceData.name || 'Not set'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                      {editingSection === 'basic_info' ? (
                        <input
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => handleInputChange('contact_email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{practiceData.contact_email || 'Not set'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                      {editingSection === 'basic_info' ? (
                        <input
                          type="tel"
                          value={formData.contact_phone}
                          onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{practiceData.contact_phone || 'Not set'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      {editingSection === 'basic_info' ? (
                        <input
                          type="text"
                          value={formData.website_url}
                          onChange={(e) => handleInputChange('website_url', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{practiceData.website_url || 'Not set'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address Information Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Icon icon={SolarIcons.mapPin} className="w-5 h-5 text-purple-600" />
                      Address Information
                    </h3>
                    {editingSection !== 'address' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingSection('address')}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                      {editingSection === 'address' ? (
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{practiceData.address || 'Not set'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      {editingSection === 'address' ? (
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{practiceData.city || 'Not set'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      {editingSection === 'address' ? (
                        <input
                          type="text"
                          value={formData.postal_code}
                          onChange={(e) => handleInputChange('postal_code', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="text-gray-900">{practiceData.postal_code || 'Not set'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* About Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Icon icon={SolarIcons.document} className="w-5 h-5 text-purple-600" />
                      About Practice
                    </h3>
                    {editingSection !== 'about' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingSection('about')}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    {editingSection === 'about' ? (
                      <textarea
                        value={formData.about_text}
                        onChange={(e) => handleInputChange('about_text', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Tell us about your practice..."
                      />
                    ) : (
                      <p className="text-gray-900 whitespace-pre-wrap">
                        {practiceData.about_text || 'No description provided'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Business Hours Section */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Icon icon={SolarIcons.clock} className="w-5 h-5 text-purple-600" />
                      Business Hours
                    </h3>
                    {editingSection !== 'business_hours' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingSection('business_hours')}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {(Array.isArray(practiceData.business_hours) ? practiceData.business_hours : defaultMockData.hours).map((day, idx) => {
                      const schedule = formData.business_hours?.[idx] || day;
                      const isOpen = schedule.hours !== 'Closed';
                      
                      // Parse existing hours to get open/close times
                      let openTime = '09:00';
                      let closeTime = '17:00';
                      if (isOpen && schedule.hours && schedule.hours.includes('-')) {
                        const parts = schedule.hours.split('-').map(s => s.trim());
                        // Convert to 24hr format for time inputs
                        // This is simplified - in production you'd parse AM/PM properly
                        openTime = schedule.openTime || '09:00';
                        closeTime = schedule.closeTime || '17:00';
                      }
                      
                      return (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">{day.day}</span>
                            {editingSection === 'business_hours' && (
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isOpen}
                                  onChange={(e) => {
                                    const updatedHours = [...(formData.business_hours || practiceData.business_hours || defaultMockData.hours)];
                                    updatedHours[idx] = {
                                      ...updatedHours[idx],
                                      hours: e.target.checked ? `${formatTime12Hour(openTime)} - ${formatTime12Hour(closeTime)}` : 'Closed',
                                      isOpen: e.target.checked,
                                      openTime: e.target.checked ? openTime : '',
                                      closeTime: e.target.checked ? closeTime : ''
                                    };
                                    handleInputChange('business_hours', updatedHours);
                                  }}
                                  className="sr-only"
                                />
                                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  isOpen ? 'bg-purple-600' : 'bg-gray-300'
                                }`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    isOpen ? 'translate-x-6' : 'translate-x-1'
                                  }`} />
                                </div>
                                <span className="ml-2 text-sm text-gray-600">
                                  {isOpen ? 'Open' : 'Closed'}
                                </span>
                              </label>
                            )}
                          </div>
                          
                          {editingSection === 'business_hours' && isOpen ? (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setTimePickerConfig({ dayIndex: idx, field: 'open' });
                                  setTimePickerOpen(true);
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all group"
                              >
                                <Icon icon={SolarIcons.sunrise} className="w-4 h-4 text-purple-500 group-hover:text-purple-600" />
                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                  {formatTime12Hour(openTime)}
                                </span>
                              </button>
                              
                              <div className="flex items-center gap-2">
                                <div className="h-px w-6 bg-gray-300"></div>
                                <span className="text-sm text-gray-500 font-medium">to</span>
                                <div className="h-px w-6 bg-gray-300"></div>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setTimePickerConfig({ dayIndex: idx, field: 'close' });
                                  setTimePickerOpen(true);
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all group"
                              >
                                <Icon icon={SolarIcons.sunset} className="w-4 h-4 text-indigo-500 group-hover:text-indigo-600" />
                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                  {formatTime12Hour(closeTime)}
                                </span>
                              </button>
                            </div>
                          ) : (
                            !editingSection && <span className="text-sm text-gray-600">{day.hours}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Branches Tab */}
            {practiceTab === 'branches' && (
              <BranchManagement />
            )}

            {/* Expenses Tab */}
            {practiceTab === 'expenses' && (
              <PracticeExpenses />
            )}

            {/* Departments Tab */}
            {practiceTab === 'departments' && (
              <DepartmentManagement />
            )}

            {practiceTab === 'inventory' && (
              <PracticeInventory />
            )}
          </motion.div>
        </div>
      </div>
      
      {/* Time Picker Modal */}
      <TimePickerModal
        isOpen={timePickerOpen}
        onClose={() => {
          setTimePickerOpen(false);
          setTimePickerConfig(null);
        }}
        onConfirm={(time) => {
          if (timePickerConfig) {
            const updatedHours = [...(formData.business_hours || practiceData.business_hours || defaultMockData.hours)];
            const { dayIndex, field } = timePickerConfig;
            
            const currentSchedule = updatedHours[dayIndex];
            const openTime = field === 'open' ? time : (currentSchedule.openTime || '09:00');
            const closeTime = field === 'close' ? time : (currentSchedule.closeTime || '17:00');
            
            updatedHours[dayIndex] = {
              ...currentSchedule,
              openTime,
              closeTime,
              hours: `${formatTime12Hour(openTime)} - ${formatTime12Hour(closeTime)}`
            };
            
            handleInputChange('business_hours', updatedHours);
          }
        }}
        initialTime={
          timePickerConfig
            ? timePickerConfig.field === 'open'
              ? (formData.business_hours?.[timePickerConfig.dayIndex]?.openTime || '09:00')
              : (formData.business_hours?.[timePickerConfig.dayIndex]?.closeTime || '17:00')
            : '09:00'
        }
        title={
          timePickerConfig
            ? `Select ${timePickerConfig.field === 'open' ? 'Opening' : 'Closing'} Time`
            : 'Select Time'
        }
      />
    </div>
  );
};

// Account Tab Content Component with Security Integration
const AccountTabContent: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const [accountTab, setAccountTab] = useState<'profile' | 'preferences' | 'security'>('profile');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const accountTabs = [
    { id: 'profile' as const, label: 'Profile', icon: SolarIcons.userCircle },
    { id: 'preferences' as const, label: 'Preferences', icon: SolarIcons.settingsMinimalistic },
    { id: 'security' as const, label: 'Security', icon: SolarIcons.lock }
  ];

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setIsUploading(true);

    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Update user profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state
      updateUser({ avatar: publicUrl });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file size (max 2MB for signatures)
    if (file.size > 2 * 1024 * 1024) {
      // Show error modal
      const errorModal = document.createElement('div');
      errorModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
      errorModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
          <div class="p-6">
            <div class="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
              <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 text-center mb-2">File Too Large</h3>
            <p class="text-gray-600 text-center mb-6">Signature file size must be less than 2MB. Please choose a smaller image.</p>
            <button onclick="this.closest('.fixed').remove()" class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium">
              OK
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(errorModal);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      // Show error modal
      const errorModal = document.createElement('div');
      errorModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
      errorModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
          <div class="p-6">
            <div class="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
              <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 text-center mb-2">Invalid File Type</h3>
            <p class="text-gray-600 text-center mb-6">Please select an image file (PNG, JPG, or JPEG) for your signature.</p>
            <button onclick="this.closest('.fixed').remove()" class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium">
              OK
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(errorModal);
      return;
    }

    setIsUploadingSignature(true);

    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-signature-${Date.now()}.${fileExt}`;
      const filePath = `signatures/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Update user profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ signature_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state
      updateUser({ signature_url: publicUrl });

      // Reset file input
      if (signatureInputRef.current) {
        signatureInputRef.current.value = '';
      }

      // Show success modal
      const successModal = document.createElement('div');
      successModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
      successModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
          <div class="p-6">
            <div class="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 text-center mb-2">Signature Uploaded Successfully!</h3>
            <p class="text-gray-600 text-center mb-6">Your digital signature has been saved and will be automatically included in generated documents.</p>
            <button onclick="this.closest('.fixed').remove()" class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium">
              Done
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(successModal);
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        if (document.body.contains(successModal)) {
          successModal.remove();
        }
      }, 5000);
    } catch (error) {
      console.error('Error uploading signature:', error);
      // Show error modal
      const errorModal = document.createElement('div');
      errorModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
      errorModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
          <div class="p-6">
            <div class="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
              <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 text-center mb-2">Upload Failed</h3>
            <p class="text-gray-600 text-center mb-6">Failed to upload signature. Please try again.</p>
            <button onclick="this.closest('.fixed').remove()" class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium">
              OK
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(errorModal);
    } finally {
      setIsUploadingSignature(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Navigation Tabs */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {accountTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAccountTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  accountTab === tab.id
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon icon={tab.icon} className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Profile Tab */}
      {accountTab === 'profile' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3 -ml-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Icon icon={SolarIcons.userCircle} className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Profile Information</CardTitle>
                <p className="text-sm text-gray-500">Update your personal details</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center mb-6">
              <div className="mb-4 sm:mb-0 sm:mr-6">
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.name} 
                    className="w-20 h-20 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Icon icon={SolarIcons.user} className="w-10 h-10 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">{user?.name}</h3>
                <p className="text-gray-500">{user?.email}</p>
                <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Icon icon={isUploading ? SolarIcons.loader : SolarIcons.camera} className={`w-4 h-4 mr-2 ${isUploading ? 'animate-spin' : ''}`} />
                    {isUploading ? 'Uploading...' : 'Change Avatar'}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  className="w-full pl-4 pr-4 py-3 bg-gray-100 border-0 rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-purple-500 
                    transition-all duration-200 text-gray-700
                    hover:bg-gray-200"
                  defaultValue={user?.name}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full pl-4 pr-4 py-3 bg-gray-100 border-0 rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-purple-500 
                    transition-all duration-200 text-gray-700
                    hover:bg-gray-200"
                  defaultValue={user?.email}
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  id="role"
                  className="w-full pl-4 pr-4 py-3 bg-gray-200 border-0 rounded-lg 
                    transition-all duration-200 text-gray-700 cursor-not-allowed"
                  defaultValue={user?.role}
                  disabled
                >
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="receptionist">Receptionist</option>
                </select>
              </div>
            </div>
            
            {/* E-Signature Section */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Icon icon={SolarIcons.pen} className="w-5 h-5 text-purple-600" />
                Digital Signature
              </h3>
              <div className="space-y-4">
                {user?.signature_url ? (
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-2">Current signature:</p>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <img 
                          src={user.signature_url} 
                          alt="E-signature" 
                          className="max-h-20 object-contain"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => signatureInputRef.current?.click()}
                        disabled={isUploadingSignature}
                      >
                        <Icon icon={isUploadingSignature ? SolarIcons.loader : SolarIcons.upload} 
                          className={`w-4 h-4 mr-2 ${isUploadingSignature ? 'animate-spin' : ''}`} />
                        {isUploadingSignature ? 'Uploading...' : 'Replace'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (confirm('Are you sure you want to remove your signature?')) {
                            try {
                              const { error } = await supabase
                                .from('users')
                                .update({ signature_url: null })
                                .eq('id', user.id);
                              
                              if (error) throw error;
                              updateUser({ signature_url: null });
                              // Show success modal
                              const successModal = document.createElement('div');
                              successModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
                              successModal.innerHTML = `
                                <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
                                  <div class="p-6">
                                    <div class="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
                                      <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                      </svg>
                                    </div>
                                    <h3 class="text-xl font-semibold text-gray-900 text-center mb-2">Signature Removed</h3>
                                    <p class="text-gray-600 text-center mb-6">Your digital signature has been removed successfully.</p>
                                    <button onclick="this.closest('.fixed').remove()" class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium">
                                      Done
                                    </button>
                                  </div>
                                </div>
                              `;
                              document.body.appendChild(successModal);
                              setTimeout(() => {
                                if (document.body.contains(successModal)) {
                                  successModal.remove();
                                }
                              }, 3000);
                            } catch (error) {
                              console.error('Error removing signature:', error);
                              // Show error modal
                              const errorModal = document.createElement('div');
                              errorModal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
                              errorModal.innerHTML = `
                                <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
                                  <div class="p-6">
                                    <div class="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                                      <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                      </svg>
                                    </div>
                                    <h3 class="text-xl font-semibold text-gray-900 text-center mb-2">Failed to Remove Signature</h3>
                                    <p class="text-gray-600 text-center mb-6">Could not remove your signature. Please try again.</p>
                                    <button onclick="this.closest('.fixed').remove()" class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium">
                                      OK
                                    </button>
                                  </div>
                                </div>
                              `;
                              document.body.appendChild(errorModal);
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Icon icon={SolarIcons.trash} className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Icon icon={SolarIcons.pen} className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-4">
                      Upload your digital signature to automatically include it in generated documents
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={isUploadingSignature}
                    >
                      <Icon icon={isUploadingSignature ? SolarIcons.loader : SolarIcons.upload} 
                        className={`w-4 h-4 mr-2 ${isUploadingSignature ? 'animate-spin' : ''}`} />
                      {isUploadingSignature ? 'Uploading...' : 'Upload Signature'}
                    </Button>
                  </div>
                )}
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSignatureUpload}
                />
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>Tip:</strong> For best results, upload a signature on a white background as a PNG or JPG file (max 2MB).
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                <Icon icon={SolarIcons.save} className="w-5 h-5 mr-2" />
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preferences Tab */}
      {accountTab === 'preferences' && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3 -ml-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon icon={SolarIcons.settingsMinimalistic} className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Preferences</CardTitle>
                <p className="text-sm text-gray-500">Manage your app settings</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Dark Mode</h4>
                  <p className="text-xs text-gray-500">Switch between light and dark mode</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Show Online Status</h4>
                  <p className="text-xs text-gray-500">Allow others to see when you're online</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Appointment Notification Sounds</h4>
                  <p className="text-xs text-gray-500">Play sounds for appointment notifications</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                </label>
              </div>
            </div>
            
            <div className="mt-6">
              <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                <Icon icon={SolarIcons.save} className="w-5 h-5 mr-2" />
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Tab (moved from main tabs) */}
      {accountTab === 'security' && (
        <div className="space-y-6">
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3 -ml-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Icon icon={SolarIcons.lock} className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Change Password</CardTitle>
                  <p className="text-sm text-gray-500">Update your security credentials</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <Icon icon={SolarIcons.lock} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      id="current-password"
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg 
                        focus:outline-none focus:ring-2 focus:ring-purple-500 
                        transition-all duration-200 text-gray-700
                        hover:bg-gray-200"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Icon icon={SolarIcons.lock} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      id="new-password"
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg 
                        focus:outline-none focus:ring-2 focus:ring-purple-500 
                        transition-all duration-200 text-gray-700
                        hover:bg-gray-200"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Icon icon={SolarIcons.lock} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      id="confirm-password"
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg 
                        focus:outline-none focus:ring-2 focus:ring-purple-500 
                        transition-all duration-200 text-gray-700
                        hover:bg-gray-200"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                  <Icon icon={SolarIcons.shield} className="w-5 h-5 mr-2" />
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3 -ml-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Icon icon={SolarIcons.shield} className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Two-Factor Authentication</CardTitle>
                  <p className="text-sm text-gray-500">Add an extra layer of security</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5">
                  <Icon icon={SolarIcons.checkCircle} className="w-6 h-6 text-green-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Two-factor authentication is enabled</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Two-factor authentication adds an extra layer of security to your account.
                    In addition to your password, you'll need to enter a code that we text to your phone.
                  </p>
                  <div className="mt-3">
                    <Button variant="outline" size="sm">
                      <Icon icon={SolarIcons.settings} className="w-4 h-4 mr-2" />
                      Manage 2FA Settings
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3 -ml-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Icon icon={SolarIcons.hardDrive} className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Login Sessions</CardTitle>
                  <p className="text-sm text-gray-500">Manage your active sessions</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 px-4 bg-green-50 border border-green-100 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">Current Session</p>
                      <p className="text-xs text-gray-500">This device • 42.122.144.55 • San Francisco, USA</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" disabled>
                    Active
                  </Button>
                </div>
                
                <div className="flex justify-between items-center py-3 px-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <Icon icon={SolarIcons.hardDrive} className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">Mac OS • Chrome</p>
                      <p className="text-xs text-gray-500">34.232.123.55 • New York, USA • 3 days ago</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    End Session
                  </Button>
                </div>
              </div>
              
              <div className="mt-6">
                <Button variant="outline" className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 hover:bg-red-50">
                  Log Out of All Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Practice Documents Content Component
const PracticeDocumentsContent: React.FC<{
  bundleData?: any;
  bundleLoading?: boolean;
}> = ({ bundleData, bundleLoading }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const { user } = useAuthStore();
  const { practiceId } = usePractice();
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentCategories = [
    { value: 'certificate', label: 'Health Certificates', icon: SolarIcons.document, color: 'bg-green-100 text-green-600' },
    { value: 'license', label: 'Practice License', icon: SolarIcons.shield, color: 'bg-blue-100 text-blue-600' },
    { value: 'policy', label: 'Policies & Procedures', icon: SolarIcons.folder, color: 'bg-purple-100 text-purple-600' },
    { value: 'contract', label: 'Contracts & Agreements', icon: SolarIcons.handshake, color: 'bg-orange-100 text-orange-600' },
    { value: 'form', label: 'Forms & Templates', icon: SolarIcons.documentText, color: 'bg-indigo-100 text-indigo-600' },
    { value: 'insurance', label: 'Insurance Documents', icon: SolarIcons.shield, color: 'bg-red-100 text-red-600' },
    { value: 'other', label: 'Other Documents', icon: SolarIcons.document, color: 'bg-gray-100 text-gray-600' }
  ];

  const loadDocuments = async () => {
    if (!practiceId) return;

    // Use bundled data if available and feature flag is enabled
    if (USE_OPTIMIZED_BUNDLE && bundleData?.documents) {
      console.log('⚡ Using optimized bundle data for documents');
      setDocuments(bundleData.documents);
      setLoading(false);
      return;
    }

    // Fallback to direct Supabase call if feature flag is disabled
    if (!USE_OPTIMIZED_BUNDLE) {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('practice_documents')
          .select(`
            *,
            uploaded_by_user:users!practice_documents_uploaded_by_fkey(
              full_name,
              email
            )
          `)
          .eq('practice_id', practiceId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDocuments(data || []);
      } catch (error) {
        console.error('Error loading documents:', error);
      } finally {
        setLoading(false);
      }
    } else {
      // Bundle is still loading
      setLoading(bundleLoading || false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [practiceId, bundleData, bundleLoading]);

  const handleFileUpload = async (files: FileList) => {
    if (!practiceId || !files.length) return;

    try {
      setUploading(true);
      
      for (const file of Array.from(files)) {
        // Validate file
        if (file.size > 50 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Maximum size is 50MB.`);
          continue;
        }

        // Upload to storage
        const fileName = `${practiceId}/documents/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save to database
        const { error: dbError } = await supabase
          .from('practice_documents')
          .insert({
            practice_id: practiceId,
            name: file.name.split('.').slice(0, -1).join('.'),
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            document_type: 'other',
            is_active: true,
            uploaded_by: user?.id
          });

        if (dbError) throw dbError;
      }

      await loadDocuments();
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload some files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.document_type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadDocument = async (doc: any) => {
    try {
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(doc.file_path);
      
      const link = document.createElement('a');
      link.href = data.publicUrl;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon icon={SolarIcons.document} className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Practice Documents</CardTitle>
                <p className="text-sm text-gray-500">Manage certificates, policies, and other practice documents</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
              >
                <Icon icon={viewMode === 'grid' ? SolarIcons.list : SolarIcons.grid} className="w-4 h-4 mr-2" />
                {viewMode === 'grid' ? 'Table' : 'Grid'}
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
              >
                <Icon icon={SolarIcons.upload} className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Documents'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Dropzone */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div
            ref={dropzoneRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon icon={SolarIcons.cloudUpload} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Drop files here or click to upload</h3>
            <p className="text-gray-500">Support for PDFs, images, and documents up to 50MB</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Icon icon={SolarIcons.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {documentCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      {loading ? (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading documents...</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardContent className="p-0">
            {filteredDocuments.length === 0 ? (
              <div className="p-8 text-center">
                <Icon icon={SolarIcons.documentEmpty} className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
                <p className="text-gray-500">Upload your first practice document to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDocuments.map((doc) => {
                      const category = documentCategories.find(cat => cat.value === doc.document_type) || documentCategories[documentCategories.length - 1];
                      return (
                        <tr key={doc.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`p-2 rounded-lg ${category.color} mr-3`}>
                                <Icon icon={category.icon} className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                                <div className="text-sm text-gray-500">{doc.file_path.split('/').pop()}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${category.color}`}>
                              {category.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatFileSize(doc.file_size)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadDocument(doc)}
                              >
                                <Icon icon={SolarIcons.download} className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Icon icon={SolarIcons.trash} className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Practice Social Accounts Content Component
const PracticeSocialAccountsContent: React.FC = () => {
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);
  const [oauthApps, setOauthApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [showGmailModal, setShowGmailModal] = useState(false);
  
  // Listen for navigate-to-oauth event
  useEffect(() => {
    const handleNavigateToOAuth = () => {
      setShowGmailModal(false);
      // Navigate to OAuth Applications tab
      const oauthTab = document.querySelector('[data-tab="system"]');
      if (oauthTab instanceof HTMLElement) {
        oauthTab.click();
      }
    };

    window.addEventListener('navigate-to-oauth', handleNavigateToOAuth);
    return () => window.removeEventListener('navigate-to-oauth', handleNavigateToOAuth);
  }, []);
  
  const [formData, setFormData] = useState({
    platform: '',
    account_name: '',
    profile_url: '',
    username: '',
    description: '',
    is_business_account: false,
    
    // OAuth and API Integration
    app_id: '',
    client_id: '',
    client_secret: '', // Added to store temporarily for OAuth setup
    access_token: '',
    refresh_token: '',
    token_expires_at: '',
    auth_scope: '',
    page_id: '',
    
    // Broadcasting Capabilities
    can_post_text: true,
    can_post_images: true,
    can_post_videos: false,
    can_schedule_posts: false,
    can_delete_posts: false,
    can_edit_posts: false,
    can_reply_comments: false,
    can_moderate_comments: false,
    
    // Rate Limiting
    rate_limit_posts_per_hour: 0,
    rate_limit_posts_per_day: 0,
    rate_limit_requests_per_hour: 0,
    rate_limit_window_minutes: 0,
    
    // Content Limits
    max_text_length: 0,
    max_hashtags: 0,
    image_max_size_mb: 0,
    video_max_size_mb: 0,
    max_images_per_post: 0,
    max_videos_per_post: 0,
    video_max_duration_seconds: 0,
    
    // Platform Features
    supports_stories: false,
    supports_polls: false,
    supports_link_preview: true,
    supports_mentions: false,
    supports_hashtags: true,
    supports_analytics: false,
    supports_scheduling: false,
    
    // Content Adaptation
    auto_resize_images: true,
    auto_crop_images: false,
    auto_compress_videos: true,
    content_template: '',
    hashtag_strategy: 'smart',
    mention_strategy: 'manual',
    
    // Status and Health
    is_active: true,
    last_sync_at: '',
    sync_status: 'pending',
    error_count: 0,
    last_error: '',
    health_check_interval_hours: 24
  });
  const { user } = useAuthStore();
  const { practiceId } = usePractice();

  const socialPlatforms = [
    { value: 'gmail', label: 'Gmail', icon: 'logos:google-gmail', color: 'bg-red-50 text-red-600', description: 'Send automated emails from your practice Gmail account' },
    { value: 'facebook', label: 'Facebook', icon: 'devicon:facebook', color: 'bg-blue-100 text-blue-600', description: 'Connect with patients and share practice updates' },
    { value: 'instagram', label: 'Instagram', icon: 'skill-icons:instagram', color: 'bg-pink-100 text-pink-600', description: 'Share visual content and practice highlights' },
    { value: 'twitter', label: 'Twitter/X', icon: 'garden:twitter-fill-12', color: 'bg-sky-100 text-sky-600', description: 'Share quick updates and health tips' },
    { value: 'linkedin', label: 'LinkedIn', icon: 'logos:linkedin-icon', color: 'bg-blue-100 text-blue-600', description: 'Professional networking and practice promotion' },
    { value: 'tiktok', label: 'TikTok', icon: 'logos:tiktok-icon', color: 'bg-black text-black', description: 'Engage younger audience with health content' },
    { value: 'youtube', label: 'YouTube', icon: 'logos:youtube-icon', color: 'bg-red-100 text-red-600', description: 'Educational videos and practice content' },
    { value: 'whatsapp_business', label: 'WhatsApp Business', icon: 'logos:whatsapp-icon', color: 'bg-green-100 text-green-600', description: 'Direct patient communication' },
  ];

  const loadSocialAccounts = async () => {
    if (!practiceId) return;
    
    try {
      setLoading(true);
      
      // Load social accounts, OAuth apps, and check Gmail connection
      const [socialAccountsResponse, oauthAppsResponse, oauthCredsResponse] = await Promise.all([
        supabase
          .from('practice_social_accounts')
          .select('*')
          .eq('practice_id', practiceId)
          .order('created_at', { ascending: false }),
        supabase
          .from('practice_oauth_apps')
          .select('*')
          .eq('practice_id', practiceId),
        supabase
          .from('practice_oauth_credentials')
          .select('*')
          .eq('practice_id', practiceId)
          .eq('provider', 'google')
          .single()
      ]);

      if (socialAccountsResponse.error) throw socialAccountsResponse.error;
      if (oauthAppsResponse.error) throw oauthAppsResponse.error;
      // oauthCredsResponse error is ok - it just means no credentials yet
      
      setSocialAccounts(socialAccountsResponse.data || []);
      setOauthApps(oauthAppsResponse.data || []);
      setGmailConnected(!!oauthCredsResponse.data);
      
      // If Gmail is connected, add it to social accounts with email
      if (oauthCredsResponse.data) {
        setSocialAccounts(prev => {
          const hasGmail = prev.some(acc => acc.platform === 'gmail');
          if (!hasGmail) {
            return [...prev, {
              id: `gmail-oauth-${practiceId}`, // Use consistent ID based on practice
              platform: 'gmail',
              account_name: oauthCredsResponse.data.email,
              username: oauthCredsResponse.data.email,
              profile_url: '',
              is_connected: true
            }];
          }
          return prev.map(acc => 
            acc.platform === 'gmail' 
              ? { ...acc, account_name: oauthCredsResponse.data.email, username: oauthCredsResponse.data.email }
              : acc
          );
        });
      }
    } catch (error) {
      console.error('Error loading social accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSocialAccounts();
    
    // Check for Gmail OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && (state === 'gmail_oauth_social' || state === 'gmail_oauth_connect')) {
      handleGmailOAuthCallback(code, state);
    }
    
    // Listen for Gmail connection success
    const handleGmailConnected = (event: CustomEvent) => {
      setGmailConnected(true);
      // Optionally update the social accounts list with Gmail info
      setSocialAccounts(prev => {
        const gmailAccount = prev.find(acc => acc.platform === 'gmail');
        if (gmailAccount) {
          return prev.map(acc => 
            acc.platform === 'gmail' 
              ? { ...acc, account_name: event.detail.email, username: event.detail.email }
              : acc
          );
        } else {
          // Add Gmail to social accounts if not already there
          return [...prev, {
            id: `gmail-oauth-${practiceId}`, // Use consistent ID based on practice
            platform: 'gmail',
            account_name: event.detail.email,
            username: event.detail.email,
            profile_url: '',
            is_connected: true
          }];
        }
      });
      
      // Show success animation
      const gmailCard = document.querySelector('[data-platform="gmail"]');
      if (gmailCard) {
        // Add success styles
        gmailCard.classList.add('ring-2', 'ring-green-500', 'ring-offset-2', 'bg-green-50', 'transition-all');
        
        // Remove animation after delay
        setTimeout(() => {
          gmailCard.classList.add('transition-all', 'duration-1000');
          gmailCard.classList.remove('ring-2', 'ring-green-500', 'ring-offset-2', 'bg-green-50');
        }, 3000);
      }
      
      // Close the modal if it's open
      setShowGmailModal(false);
    };
    
    window.addEventListener('gmail-connected', handleGmailConnected as EventListener);
    
    // Listen for Gmail disconnection
    const handleGmailDisconnected = () => {
      setGmailConnected(false);
      // Remove Gmail from social accounts or update its status
      setSocialAccounts(prev => prev.filter(acc => acc.platform !== 'gmail'));
      
      // Close the modal if it's open
      setShowGmailModal(false);
    };
    
    window.addEventListener('gmail-disconnected', handleGmailDisconnected);
    
    return () => {
      window.removeEventListener('gmail-connected', handleGmailConnected as EventListener);
      window.removeEventListener('gmail-disconnected', handleGmailDisconnected);
    };
  }, [practiceId]);
  
  const handleGmailOAuthCallback = async (code: string, state: string) => {
    try {
      // Call edge function to exchange code for tokens
      const { data, error } = await supabase.functions.invoke('gmail-oauth-callback', {
        body: {
          code,
          redirect_uri: `${window.location.origin}/settings`,
          practice_id: practiceId
        }
      });
      
      if (error) throw error;
      
      if (state === 'gmail_oauth_social') {
        // Creating new social account - retrieve stored form data
        const storedData = sessionStorage.getItem('gmailOAuthFormData');
        if (!storedData) {
          console.error('No stored form data found');
          return;
        }
        
        const savedFormData = JSON.parse(storedData);
        sessionStorage.removeItem('gmailOAuthFormData');
        
        // Update form data with OAuth info
        setFormData({
          ...savedFormData,
          username: data.email,
          access_token: 'connected', // We don't expose the actual token
          client_id: data.email, // Store email as client_id for reference
          auth_scope: 'gmail.send gmail.compose'
        });
        
        // Open the modal with updated data
        setShowAddModal(true);
      } else if (state === 'gmail_oauth_connect' || state === 'gmail_oauth_setup') {
        // OAuth connected successfully
        // Show success notification
        alert(`Gmail connected successfully! Email: ${data.email}`);
        
        // Reload OAuth apps to show updated status
        await loadSocialAccounts();
      }
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, '/settings');
    } catch (error) {
      console.error('OAuth callback error:', error);
      alert('Failed to connect Gmail account. Please try again.');
    }
  };

  const handleAddAccount = async (accountData: any) => {
    if (!practiceId) return;

    try {
      // For Gmail, ONLY save OAuth credentials to practice_oauth_apps
      if (accountData.platform === 'gmail' && accountData.client_id && accountData.client_secret) {
        // Save OAuth credentials to practice_oauth_apps table
        const { error: oauthError } = await supabase
          .from('practice_oauth_apps')
          .upsert({
            practice_id: practiceId,
            provider: 'google',
            client_id: accountData.client_id,
            client_secret: accountData.client_secret,
            redirect_uri: `${window.location.origin}/settings,https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/gmail-oauth-callback`
          });

        if (oauthError) throw oauthError;
        
        // For Gmail, store the OAuth app ID for the connect flow
        const savedApp = await supabase
          .from('practice_oauth_apps')
          .select('id')
          .eq('practice_id', practiceId)
          .eq('provider', 'google')
          .single();
        
        // For Gmail, we're done - don't save to practice_social_accounts
        setShowAddModal(false);
        setShowSuccessModal(true);
        // Store the app ID for the connect button
        if (savedApp.data) {
          sessionStorage.setItem('gmailOAuthAppId', savedApp.data.id);
        }
        return;
      }

      // For other platforms, save to practice_social_accounts
      const { client_secret, ...socialAccountData } = accountData;

      const { error } = await supabase
        .from('practice_social_accounts')
        .insert({
          practice_id: practiceId,
          created_by: user?.id,
          ...socialAccountData
        });

      if (error) throw error;
      await loadSocialAccounts();
      setShowAddModal(false);
      
      // Reset form data
      setFormData({
        platform: '',
        account_name: '',
        profile_url: '',
        username: '',
        description: '',
        is_business_account: false,
        app_id: '',
        client_id: '',
        client_secret: '',
        access_token: '',
        refresh_token: '',
        token_expires_at: '',
        auth_scope: '',
        page_id: '',
        can_post_text: true,
        can_post_images: true,
        can_post_videos: false,
        can_schedule_posts: false,
        can_delete_posts: false,
        can_edit_posts: false,
        can_reply_comments: false,
        can_moderate_comments: false,
        rate_limit_posts_per_hour: 0,
        rate_limit_posts_per_day: 0,
        rate_limit_requests_per_hour: 0,
        rate_limit_window_minutes: 0,
        max_text_length: 0,
        max_hashtags: 0,
        image_max_size_mb: 0,
        video_max_size_mb: 0,
        max_images_per_post: 0,
        max_videos_per_post: 0,
        video_max_duration_seconds: 0,
        supports_stories: false,
        supports_polls: false,
        supports_link_preview: true,
        supports_mentions: false,
        supports_hashtags: true,
        supports_analytics: false,
        supports_scheduling: false,
        auto_resize_images: true,
        auto_crop_images: false,
        auto_compress_videos: true,
        content_template: '',
        hashtag_strategy: 'smart',
        mention_strategy: 'manual',
        is_active: true,
        last_sync_at: '',
        sync_status: 'pending',
        error_count: 0,
        last_error: '',
        health_check_interval_hours: 24
      });
    } catch (error) {
      console.error('Error adding social account:', error);
      alert('Failed to add social account. Please try again.');
    }
  };

  const handleUpdateAccount = async (accountId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('practice_social_accounts')
        .update({
          ...updates,
          updated_by: user?.id
        })
        .eq('id', accountId);

      if (error) throw error;
      await loadSocialAccounts();
      setEditingAccount(null);
    } catch (error) {
      console.error('Error updating social account:', error);
      alert('Failed to update social account. Please try again.');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this social media account?')) return;

    try {
      const { error } = await supabase
        .from('practice_social_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
      await loadSocialAccounts();
    } catch (error) {
      console.error('Error deleting social account:', error);
      alert('Failed to delete social account. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Icon icon={SolarIcons.globe} className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Social Media Accounts</CardTitle>
                <p className="text-sm text-gray-500">Manage practice social media presence for future broadcasting</p>
              </div>
            </div>
            <Button
              onClick={() => {
                // Reset form data when clicking Add Account
                setFormData({
                  platform: '',
                  account_name: '',
                  profile_url: '',
                  username: '',
                  description: '',
                  is_business_account: false,
                  app_id: '',
                  client_id: '',
                  client_secret: '',
                  access_token: '',
                  refresh_token: '',
                  token_expires_at: '',
                  auth_scope: '',
                  page_id: '',
                  can_post_text: true,
                  can_post_images: true,
                  can_post_videos: false,
                  can_schedule_posts: false,
                  can_delete_posts: false,
                  can_edit_posts: false,
                  can_reply_comments: false,
                  can_moderate_comments: false,
                  rate_limit_posts_per_hour: 0,
                  rate_limit_posts_per_day: 0,
                  rate_limit_requests_per_hour: 0,
                  rate_limit_window_minutes: 0,
                  max_text_length: 0,
                  max_hashtags: 0,
                  image_max_size_mb: 0,
                  video_max_size_mb: 0,
                  max_images_per_post: 0,
                  max_videos_per_post: 0,
                  video_max_duration_seconds: 0,
                  supports_stories: false,
                  supports_polls: false,
                  supports_link_preview: true,
                  supports_mentions: false,
                  supports_hashtags: true,
                  supports_analytics: false,
                  supports_scheduling: false,
                  auto_resize_images: true,
                  auto_crop_images: false,
                  auto_compress_videos: true,
                  content_template: '',
                  hashtag_strategy: 'smart',
                  mention_strategy: 'manual',
                  is_active: true,
                  last_sync_at: '',
                  sync_status: 'pending',
                  error_count: 0,
                  last_error: '',
                  health_check_interval_hours: 24
                });
                setEditingAccount(null);
                setShowAddModal(true);
              }}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
            >
              <Icon icon={SolarIcons.add} className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </div>
        </CardHeader>
      </Card>


      {/* Available Platforms Overview */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">Supported Platforms</CardTitle>
          <p className="text-sm text-gray-500">Connect your practice social media accounts for unified content management</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {socialPlatforms.map((platform) => {
              // For Gmail, check OAuth apps; for others, check social accounts
              const connectedAccount = platform.value === 'gmail' 
                ? oauthApps.find(app => app.provider === 'google')
                : socialAccounts.find(acc => acc.platform === platform.value);
              const isConnected = !!connectedAccount;
              
              return (
                <div 
                  key={platform.value} 
                  data-platform={platform.value}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    if (platform.value === 'gmail') {
                      // Show Gmail-specific modal
                      setShowGmailModal(true);
                    } else {
                      // When clicking the card, show the modal for that platform
                      const defaults = getPlatformDefaults(platform.value) || {};
                      setFormData({
                        platform: platform.value,
                        account_name: '',
                        profile_url: '',
                        username: '',
                        description: '',
                        is_business_account: false,
                        app_id: '',
                        client_id: '',
                        client_secret: '',
                        access_token: '',
                        refresh_token: '',
                        token_expires_at: '',
                        auth_scope: '',
                        page_id: '',
                        ...defaults
                      });
                      setEditingAccount(null);
                      setShowAddModal(true);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${platform.color} group-hover:scale-110 transition-transform`}>
                        <Icon icon={platform.icon} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">{platform.label}</h3>
                        <p className="text-xs text-gray-500">{platform.description}</p>
                      </div>
                    </div>
                    {isConnected && (platform.value === 'gmail' ? gmailConnected : true) ? (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-600 font-medium">Connected</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline" 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (platform.value === 'gmail') {
                            setShowGmailModal(true);
                          } else {
                            // Button click also opens modal
                            const defaults = getPlatformDefaults(platform.value) || {};
                            setFormData({
                              platform: platform.value,
                              account_name: '',
                              profile_url: '',
                              username: '',
                              description: '',
                              is_business_account: false,
                              app_id: '',
                              client_id: '',
                              client_secret: '',
                              access_token: '',
                              refresh_token: '',
                              token_expires_at: '',
                              auth_scope: '',
                              page_id: '',
                              ...defaults
                            });
                            setEditingAccount(null);
                            setShowAddModal(true);
                          }
                        }}
                      >
                        <Icon icon={SolarIcons.add} className="w-3 h-3 mr-1" />
                        Setup
                      </Button>
                    )}
                  </div>
                  {isConnected && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {platform.value === 'gmail' ? (
                        <>
                          {gmailConnected ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-600 flex items-center gap-1">
                                  <Icon icon="solar:mail-bold" className="w-3 h-3 text-green-500" />
                                  {connectedAccount?.account_name || connectedAccount?.username || 'Gmail account'}
                                </p>
                                <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
                                  <Icon icon="solar:check-circle-bold" className="w-3 h-3 text-green-600" />
                                  <span className="text-xs font-medium text-green-700">Active</span>
                                </div>
                              </div>
                              <div className="bg-green-50 rounded-md p-2">
                                <p className="text-xs text-green-700 flex items-center gap-1">
                                  <Icon icon="solar:shield-check-bold" className="w-3 h-3" />
                                  Ready to send automated emails
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Click to configure</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-sm">{connectedAccount.account_name}</p>
                          <p className="text-xs text-gray-500">{connectedAccount.username}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      {loading ? (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading social accounts...</p>
          </CardContent>
        </Card>
      ) : socialAccounts.length > 0 ? (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Connected Accounts</CardTitle>
            <p className="text-sm text-gray-500">Manage your connected social media accounts</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connected</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {socialAccounts.map((account) => {
                    const platform = socialPlatforms.find(p => p.value === account.platform);
                    return (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-lg ${platform?.color || 'bg-gray-100 text-gray-600'} mr-3`}>
                              <Icon icon={platform?.icon || SolarIcons.globe} className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{platform?.label || account.platform}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{account.account_name}</div>
                            <div className="text-sm text-gray-500">{account.username}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(account.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {account.platform === 'gmail' && !account.access_token && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  // Get OAuth credentials from practice_oauth_apps
                                  const { data: oauthApp } = await supabase
                                    .from('practice_oauth_apps')
                                    .select('client_id')
                                    .eq('practice_id', practiceId)
                                    .eq('provider', 'google')
                                    .single();

                                  if (oauthApp) {
                                    // Store the social account ID to update after OAuth
                                    sessionStorage.setItem('gmailOAuthSocialAccountId', account.id);
                                    
                                    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                                    authUrl.searchParams.append('client_id', oauthApp.client_id);
                                    authUrl.searchParams.append('redirect_uri', `${window.location.origin}/settings`);
                                    authUrl.searchParams.append('response_type', 'code');
                                    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/userinfo.email');
                                    authUrl.searchParams.append('access_type', 'offline');
                                    authUrl.searchParams.append('prompt', 'consent');
                                    authUrl.searchParams.append('state', 'gmail_oauth_connect');
                                    
                                    window.location.href = authUrl.toString();
                                  } else {
                                    alert('OAuth credentials not found. Please check the OAuth Apps Management section.');
                                  }
                                }}
                              >
                                <Icon icon="logos:google-icon" className="w-4 h-4 mr-1" />
                                Connect
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingAccount(account)}
                            >
                              <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteAccount(account.id)}
                            >
                              <Icon icon={SolarIcons.trash} className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Icon icon={SolarIcons.globe} className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No social accounts connected</h3>
            <p className="text-gray-500 mb-4">Connect your social media accounts to enable unified content broadcasting.</p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
            >
              <Icon icon={SolarIcons.add} className="w-4 h-4 mr-2" />
              Add First Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Account Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] pointer-events-auto flex flex-col overflow-hidden">
            {/* Gradient Header */}
            <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600 opacity-20 backdrop-blur-sm"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Icon icon={SolarIcons.globe} className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{fontFamily: 'Poppins, sans-serif'}}>
                      {formData.platform === 'gmail' ? 'Configure Gmail OAuth' : 'Add Social Media Account'}
                    </h2>
                    <p className="text-blue-100 text-sm">
                      {formData.platform === 'gmail' ? 'Set up Gmail for automated emails' : 'Connect your practice social media account'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({
                      platform: '', account_name: '', profile_url: '', username: '', description: '', is_business_account: false,
                      app_id: '', client_id: '', client_secret: '', access_token: '', refresh_token: '', token_expires_at: '', auth_scope: '', page_id: '',
                      can_post_text: true, can_post_images: true, can_post_videos: false, can_schedule_posts: false,
                      can_delete_posts: false, can_edit_posts: false, can_reply_comments: false, can_moderate_comments: false,
                      rate_limit_posts_per_hour: 0, rate_limit_posts_per_day: 0, rate_limit_requests_per_hour: 0, rate_limit_window_minutes: 0,
                      max_text_length: 0, max_hashtags: 0, image_max_size_mb: 0, video_max_size_mb: 0,
                      max_images_per_post: 0, max_videos_per_post: 0, video_max_duration_seconds: 0,
                      supports_stories: false, supports_polls: false, supports_link_preview: true,
                      supports_mentions: false, supports_hashtags: true, supports_analytics: false, supports_scheduling: false,
                      auto_resize_images: true, auto_crop_images: false, auto_compress_videos: true,
                      content_template: '', hashtag_strategy: 'smart', mention_strategy: 'manual',
                      is_active: true, last_sync_at: '', sync_status: 'pending', error_count: 0, last_error: '', health_check_interval_hours: 24
                    });
                  }}
                  className="p-2 bg-white/20 hover:bg-red-500/30 rounded-xl transition-colors"
                >
                  <Icon icon={SolarIcons.close} className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6 bg-white">
              {(
                // For other platforms, show the regular form
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleAddAccount(formData);
                }} className="space-y-6">
                  {/* Account Information Section */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 -ml-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Icon icon={SolarIcons.globe} className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
                        <p className="text-sm text-gray-500">Basic details about your social media account</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.settings} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <select
                          value={formData.platform}
                          onChange={(e) => {
                            const platform = e.target.value;
                            const defaults = getPlatformDefaults(platform);
                            setFormData({ 
                              ...formData, 
                              platform,
                              ...defaults
                            });
                          }}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          required
                        >
                          <option value="">Select a platform</option>
                          {socialPlatforms.map(platform => (
                            <option key={platform.value} value={platform.value}>{platform.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.user} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="text"
                          value={formData.account_name}
                          onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="Your Practice Name"
                          required
                        />
                      </div>
                    </div>

                    {formData.platform !== 'gmail' && (
                      <>
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Profile URL</label>
                          <div className="relative">
                            <Icon icon={SolarIcons.link} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                            <input
                              type="url"
                              value={formData.profile_url}
                              onChange={(e) => setFormData({ ...formData, profile_url: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                              placeholder="https://facebook.com/yourpractice"
                              required
                            />
                          </div>
                        </div>

                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Username/Handle</label>
                          <div className="relative">
                            <Icon icon={SolarIcons.at} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                            <input
                              type="text"
                              value={formData.username}
                              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                              placeholder="@yourpractice"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {formData.platform !== 'gmail' && (
                    <>
                      <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <div className="relative">
                          <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full pl-4 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                            rows={3}
                            placeholder="Brief description of your account"
                          />
                        </div>
                      </div>

                      <div className="mt-6 flex items-center">
                        <input
                          type="checkbox"
                          id="business_account"
                          checked={formData.is_business_account}
                          onChange={(e) => setFormData({ ...formData, is_business_account: e.target.checked })}
                          className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                        />
                        <label htmlFor="business_account" className="ml-2 text-sm font-medium text-gray-700">
                          This is a business account
                        </label>
                      </div>
                    </>
                  )}
                </div>

                {/* OAuth & API Integration Section - Show for Gmail to enter credentials */}
                {formData.platform === 'gmail' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 -ml-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon icon={SolarIcons.key} className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Gmail OAuth Configuration</h3>
                      <p className="text-sm text-gray-500">Enter your Google OAuth credentials</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">OAuth Client ID</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.code} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="text"
                          value={formData.client_id}
                          onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="xxxxx.apps.googleusercontent.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">OAuth Client Secret</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.key} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="password"
                          value={formData.client_secret || ''}
                          onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="GOCSPX-xxxxxxxxxxxx"
                          required
                        />
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="flex-1 text-sm text-gray-700">
                          <p className="font-medium text-gray-900 mb-1">How to get these credentials:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                            <li>Create a project and enable Gmail API</li>
                            <li>Configure OAuth consent screen (choose Internal for Google Workspace)</li>
                            <li>Create OAuth 2.0 credentials (Web application)</li>
                            <li>Add redirect URI: <code className="bg-blue-100 px-1 rounded">{window.location.origin}/settings</code></li>
                            <li>Copy the Client ID and Client Secret here</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    {/* Test Connection Button */}
                    {formData.client_id && formData.client_secret && (
                      <div className="flex justify-end mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.functions.invoke('test-gmail-connection', {
                                body: {
                                  practiceId,
                                  clientId: formData.client_id,
                                  clientSecret: formData.client_secret
                                }
                              });

                              if (error) throw error;

                              if (data.success) {
                                // Show success toast
                                const successDiv = document.createElement('div');
                                successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
                                successDiv.innerHTML = `
                                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  ${data.message}
                                `;
                                document.body.appendChild(successDiv);
                                setTimeout(() => document.body.removeChild(successDiv), 5000);
                              } else {
                                // Show error toast
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                                errorDiv.textContent = data.error || 'Connection test failed';
                                document.body.appendChild(errorDiv);
                                setTimeout(() => document.body.removeChild(errorDiv), 5000);
                              }
                            } catch (error) {
                              console.error('Test connection error:', error);
                              // Show error toast
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                              errorDiv.textContent = 'Failed to test connection';
                              document.body.appendChild(errorDiv);
                              setTimeout(() => document.body.removeChild(errorDiv), 5000);
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <Icon icon="solar:test-tube-bold-duotone" className="w-4 h-4" />
                          Test Connection
                        </Button>
                      </div>
                    )}

                    {/* Save Reminder - show when credentials are entered but not saved */}
                    {formData.client_id && formData.client_secret && (
                      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-amber-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">
                              <strong>Important:</strong> Click "Add Account" below to save your OAuth credentials. 
                              After saving, you can connect your Gmail account for automation.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                  {/* Only show API fields if platform requires them */}
                  {formData.platform && platformSettings[formData.platform]?.apiFields && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-6 -ml-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Icon icon={SolarIcons.key} className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">API Configuration</h3>
                          <p className="text-sm text-gray-500">Platform-specific API credentials</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {platformSettings[formData.platform].apiFields?.includes('app_id') && (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">App ID</label>
                          <div className="relative">
                            <Icon icon={SolarIcons.code} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                            <input
                              type="text"
                              value={formData.app_id}
                              onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                              placeholder="Platform App ID"
                            />
                          </div>
                        </div>
                      )}

                      {platformSettings[formData.platform].apiFields?.includes('client_id') && (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Client ID</label>
                          <div className="relative">
                            <Icon icon={SolarIcons.id} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                            <input
                              type="text"
                              value={formData.client_id}
                              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                              placeholder="OAuth Client ID"
                            />
                          </div>
                        </div>
                      )}

                      {platformSettings[formData.platform].apiFields?.includes('client_secret') && (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Client Secret</label>
                          <div className="relative">
                            <Icon icon={SolarIcons.key} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                            <input
                              type="password"
                              value={formData.client_secret || ''}
                              onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                              placeholder="OAuth Client Secret"
                            />
                          </div>
                        </div>
                      )}

                      {platformSettings[formData.platform].apiFields?.includes('page_id') && (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Page ID</label>
                          <div className="relative">
                            <Icon icon={SolarIcons.hashtag} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                            <input
                              type="text"
                              value={formData.page_id}
                              onChange={(e) => setFormData({ ...formData, page_id: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                              placeholder="Facebook Page ID"
                            />
                          </div>
                        </div>
                      )}

                      {platformSettings[formData.platform].apiFields?.includes('account_id') && (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Account ID</label>
                          <div className="relative">
                            <Icon icon={SolarIcons.hashtag} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                            <input
                              type="text"
                              value={formData.account_id || ''}
                              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                              placeholder="Instagram Account ID"
                            />
                          </div>
                        </div>
                      )}

                      {platformSettings[formData.platform].apiFields?.includes('channel_id') && (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Channel ID</label>
                          <div className="relative">
                            <Icon icon={SolarIcons.hashtag} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                            <input
                              type="text"
                              value={formData.channel_id || ''}
                              onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                              placeholder="YouTube Channel ID"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                {/* Broadcasting Capabilities Section - Hide for Gmail */}
                {formData.platform !== 'gmail' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 -ml-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Icon icon={SolarIcons.broadcast} className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Broadcasting Capabilities</h3>
                      <p className="text-sm text-gray-500">Define what content types this account can broadcast</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="can_post_text"
                        checked={formData.can_post_text}
                        onChange={(e) => setFormData({ ...formData, can_post_text: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="can_post_text" className="ml-2 text-sm font-medium text-gray-700">
                        Post Text
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="can_post_images"
                        checked={formData.can_post_images}
                        onChange={(e) => setFormData({ ...formData, can_post_images: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="can_post_images" className="ml-2 text-sm font-medium text-gray-700">
                        Post Images
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="can_post_videos"
                        checked={formData.can_post_videos}
                        onChange={(e) => setFormData({ ...formData, can_post_videos: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="can_post_videos" className="ml-2 text-sm font-medium text-gray-700">
                        Post Videos
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="can_schedule_posts"
                        checked={formData.can_schedule_posts}
                        onChange={(e) => setFormData({ ...formData, can_schedule_posts: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="can_schedule_posts" className="ml-2 text-sm font-medium text-gray-700">
                        Schedule Posts
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="can_delete_posts"
                        checked={formData.can_delete_posts}
                        onChange={(e) => setFormData({ ...formData, can_delete_posts: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="can_delete_posts" className="ml-2 text-sm font-medium text-gray-700">
                        Delete Posts
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="can_edit_posts"
                        checked={formData.can_edit_posts}
                        onChange={(e) => setFormData({ ...formData, can_edit_posts: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="can_edit_posts" className="ml-2 text-sm font-medium text-gray-700">
                        Edit Posts
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="can_reply_comments"
                        checked={formData.can_reply_comments}
                        onChange={(e) => setFormData({ ...formData, can_reply_comments: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="can_reply_comments" className="ml-2 text-sm font-medium text-gray-700">
                        Reply to Comments
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="can_moderate_comments"
                        checked={formData.can_moderate_comments}
                        onChange={(e) => setFormData({ ...formData, can_moderate_comments: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="can_moderate_comments" className="ml-2 text-sm font-medium text-gray-700">
                        Moderate Comments
                      </label>
                    </div>
                  </div>
                </div>
                )}

                {/* Rate Limiting Section - Hide for Gmail */}
                {formData.platform !== 'gmail' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 -ml-2">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Icon icon={SolarIcons.timer} className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Rate Limiting</h3>
                      <p className="text-sm text-gray-500">Platform-specific posting and API request limits</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Posts per Hour</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.clock} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.rate_limit_posts_per_hour}
                          onChange={(e) => setFormData({ ...formData, rate_limit_posts_per_hour: parseInt(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Posts per Day</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.calendar} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.rate_limit_posts_per_day}
                          onChange={(e) => setFormData({ ...formData, rate_limit_posts_per_day: parseInt(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">API Requests per Hour</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.server} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.rate_limit_requests_per_hour}
                          onChange={(e) => setFormData({ ...formData, rate_limit_requests_per_hour: parseInt(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rate Window (minutes)</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.stopwatch} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.rate_limit_window_minutes}
                          onChange={(e) => setFormData({ ...formData, rate_limit_window_minutes: parseInt(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Content Limits Section - Hide for Gmail */}
                {formData.platform !== 'gmail' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 -ml-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Icon icon={SolarIcons.document} className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Content Limits</h3>
                      <p className="text-sm text-gray-500">Platform-specific content size and format restrictions</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Text Length</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.text} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.max_text_length}
                          onChange={(e) => setFormData({ ...formData, max_text_length: parseInt(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="280"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Hashtags</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.hashtag} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.max_hashtags}
                          onChange={(e) => setFormData({ ...formData, max_hashtags: parseInt(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="10"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Image Max Size (MB)</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.gallery} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.image_max_size_mb}
                          onChange={(e) => setFormData({ ...formData, image_max_size_mb: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="10"
                          min="0"
                          step="0.1"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Video Max Size (MB)</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.videocamera} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.video_max_size_mb}
                          onChange={(e) => setFormData({ ...formData, video_max_size_mb: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="100"
                          min="0"
                          step="0.1"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Images per Post</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.layers} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.max_images_per_post}
                          onChange={(e) => setFormData({ ...formData, max_images_per_post: parseInt(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="10"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Video Duration (seconds)</label>
                      <div className="relative">
                        <Icon icon={SolarIcons.play} className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                        <input
                          type="number"
                          value={formData.video_max_duration_seconds}
                          onChange={(e) => setFormData({ ...formData, video_max_duration_seconds: parseInt(e.target.value) || 0 })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                          placeholder="300"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Platform Features Section - Hide for Gmail */}
                {formData.platform !== 'gmail' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 -ml-2">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Icon icon={SolarIcons.sparkles} className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Platform Features</h3>
                      <p className="text-sm text-gray-500">Available features for this social media platform</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="supports_stories"
                        checked={formData.supports_stories}
                        onChange={(e) => setFormData({ ...formData, supports_stories: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="supports_stories" className="ml-2 text-sm font-medium text-gray-700">
                        Stories
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="supports_polls"
                        checked={formData.supports_polls}
                        onChange={(e) => setFormData({ ...formData, supports_polls: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="supports_polls" className="ml-2 text-sm font-medium text-gray-700">
                        Polls
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="supports_link_preview"
                        checked={formData.supports_link_preview}
                        onChange={(e) => setFormData({ ...formData, supports_link_preview: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="supports_link_preview" className="ml-2 text-sm font-medium text-gray-700">
                        Link Previews
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="supports_mentions"
                        checked={formData.supports_mentions}
                        onChange={(e) => setFormData({ ...formData, supports_mentions: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="supports_mentions" className="ml-2 text-sm font-medium text-gray-700">
                        Mentions
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="supports_hashtags"
                        checked={formData.supports_hashtags}
                        onChange={(e) => setFormData({ ...formData, supports_hashtags: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="supports_hashtags" className="ml-2 text-sm font-medium text-gray-700">
                        Hashtags
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="supports_analytics"
                        checked={formData.supports_analytics}
                        onChange={(e) => setFormData({ ...formData, supports_analytics: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="supports_analytics" className="ml-2 text-sm font-medium text-gray-700">
                        Analytics
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="supports_scheduling"
                        checked={formData.supports_scheduling}
                        onChange={(e) => setFormData({ ...formData, supports_scheduling: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="supports_scheduling" className="ml-2 text-sm font-medium text-gray-700">
                        Post Scheduling
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
                        Account Active
                      </label>
                    </div>
                  </div>
                </div>
                )}

                {/* Content Adaptation Section - Hide for Gmail */}
                {formData.platform !== 'gmail' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 -ml-2">
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <Icon icon={SolarIcons.magic} className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Content Adaptation</h3>
                      <p className="text-sm text-gray-500">Automatic content optimization for this platform</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="auto_resize_images"
                        checked={formData.auto_resize_images}
                        onChange={(e) => setFormData({ ...formData, auto_resize_images: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="auto_resize_images" className="ml-2 text-sm font-medium text-gray-700">
                        Auto-resize Images
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="auto_crop_images"
                        checked={formData.auto_crop_images}
                        onChange={(e) => setFormData({ ...formData, auto_crop_images: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="auto_crop_images" className="ml-2 text-sm font-medium text-gray-700">
                        Auto-crop Images
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="auto_compress_videos"
                        checked={formData.auto_compress_videos}
                        onChange={(e) => setFormData({ ...formData, auto_compress_videos: e.target.checked })}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                      />
                      <label htmlFor="auto_compress_videos" className="ml-2 text-sm font-medium text-gray-700">
                        Auto-compress Videos
                      </label>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Hashtag Strategy</label>
                      <select
                        value={formData.hashtag_strategy}
                        onChange={(e) => setFormData({ ...formData, hashtag_strategy: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                      >
                        <option value="smart">Smart (AI-generated)</option>
                        <option value="manual">Manual only</option>
                        <option value="template">Template-based</option>
                        <option value="none">No hashtags</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Content Template</label>
                    <textarea
                      value={formData.content_template}
                      onChange={(e) => setFormData({ ...formData, content_template: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-700 hover:bg-gray-200"
                      rows={3}
                      placeholder="Template for post content (use {title}, {description}, {hashtags} as placeholders)"
                    />
                  </div>
                </div>
                )}

                {/* Broadcasting Notice - Show appropriate info based on platform */}
                {formData.platform && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Icon icon={SolarIcons.broadcast} className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      {formData.platform === 'gmail' ? (
                        <>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">📧 Gmail Integration for Automations</h4>
                          <p className="text-sm text-gray-700 mb-3">
                            Once connected, your Gmail account will be used to send automated emails for:
                          </p>
                          <ul className="space-y-1 text-sm text-gray-600">
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              Welcome emails to new patients
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              Appointment confirmations and reminders
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              Lab results and medical reports
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              Follow-up care instructions
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              Birthday greetings and special offers
                            </li>
                          </ul>
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">🔧 What's Needed for Concurrent Broadcasting</h4>
                          <p className="text-sm text-gray-700 mb-3">
                            With these comprehensive settings, you'll be able to broadcast to multiple platforms simultaneously. 
                            <strong>Next steps for full implementation:</strong>
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <p className="font-medium mb-2">✅ Field Alignment for Broadcasting:</p>
                              <ul className="space-y-1">
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                  Rate limits ensure no API violations
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                  Content limits auto-adapt posts per platform
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                  Feature flags enable/disable per platform
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                  Content templates ensure brand consistency
                                </li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium mb-2">🚀 Implementation Requirements:</p>
                              <ul className="space-y-1">
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                  OAuth flow for each platform
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                  Token refresh automation
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                  Broadcasting service/API
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                  Queue management for rate limiting
                                </li>
                              </ul>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({
                      platform: '', account_name: '', profile_url: '', username: '', description: '', is_business_account: false,
                      app_id: '', client_id: '', access_token: '', refresh_token: '', token_expires_at: '', auth_scope: '', page_id: '',
                      can_post_text: true, can_post_images: true, can_post_videos: false, can_schedule_posts: false,
                      can_delete_posts: false, can_edit_posts: false, can_reply_comments: false, can_moderate_comments: false,
                      rate_limit_posts_per_hour: 0, rate_limit_posts_per_day: 0, rate_limit_requests_per_hour: 0, rate_limit_window_minutes: 0,
                      max_text_length: 0, max_hashtags: 0, image_max_size_mb: 0, video_max_size_mb: 0,
                      max_images_per_post: 0, max_videos_per_post: 0, video_max_duration_seconds: 0,
                      supports_stories: false, supports_polls: false, supports_link_preview: true,
                      supports_mentions: false, supports_hashtags: true, supports_analytics: false, supports_scheduling: false,
                      auto_resize_images: true, auto_crop_images: false, auto_compress_videos: true,
                      content_template: '', hashtag_strategy: 'smart', mention_strategy: 'manual',
                      is_active: true, last_sync_at: '', sync_status: 'pending', error_count: 0, last_error: '', health_check_interval_hours: 24
                    });
                    }}
                    className="flex-1 py-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Icon icon={SolarIcons.add} className="w-5 h-5 mr-2" />
                    {formData.platform === 'gmail' ? 'Save OAuth Credentials' : 'Add Account'}
                  </Button>
                </div>
              </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Future Broadcasting Note */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon icon={SolarIcons.broadcast} className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon: Unified Broadcasting</h3>
              <p className="text-gray-700 mb-3">
                Once you've connected your social media accounts, you'll be able to create and broadcast 
                promotional messages across all platforms simultaneously from the Communications tab.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  <Icon icon={SolarIcons.broadcast} className="w-3 h-3 mr-1" />
                  Multi-platform posting
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  <Icon icon={SolarIcons.calendar} className="w-3 h-3 mr-1" />
                  Scheduled posts
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Icon icon={SolarIcons.analytics} className="w-3 h-3 mr-1" />
                  Analytics tracking
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success Modal for Gmail OAuth */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon="solar:check-circle-bold-duotone" className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Success!</h2>
              <p className="text-green-100">Gmail OAuth Configured</p>
            </div>
            
            {/* Success Content */}
            <div className="p-6">
              <div className="text-center mb-6">
                <p className="text-gray-700 mb-4">
                  Gmail OAuth credentials saved successfully! You can now use Gmail for automated emails.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-green-900 mb-2">What's Next?</h3>
                  <ul className="space-y-2 text-sm text-green-800">
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
                      <span>Automated appointment reminders</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
                      <span>Invoice and statement emails</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
                      <span>Follow-up communications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
                      <span>Automated welcome emails</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowSuccessModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Connect Later
                </Button>
                <Button
                  onClick={async () => {
                    setShowSuccessModal(false);
                    // Get OAuth credentials from practice_oauth_apps
                    const { data: oauthApp } = await supabase
                      .from('practice_oauth_apps')
                      .select('client_id')
                      .eq('practice_id', practiceId)
                      .eq('provider', 'google')
                      .single();

                    if (oauthApp) {
                      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                      authUrl.searchParams.append('client_id', oauthApp.client_id);
                      authUrl.searchParams.append('redirect_uri', `${window.location.origin}/settings`);
                      authUrl.searchParams.append('response_type', 'code');
                      authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/userinfo.email');
                      authUrl.searchParams.append('access_type', 'offline');
                      authUrl.searchParams.append('prompt', 'consent');
                      authUrl.searchParams.append('state', 'gmail_oauth_setup');
                      
                      window.location.href = authUrl.toString();
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700"
                >
                  Connect Gmail Now
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Gmail Settings Modal */}
      <GmailSettingsModal
        isOpen={showGmailModal}
        onClose={() => setShowGmailModal(false)}
        onConnectionChange={() => {
          loadSocialAccounts();
        }}
      />
      
      {/* Gmail OAuth Settings - handles OAuth callbacks automatically */}
      {/* This component is hidden but processes OAuth codes when present */}
      <div style={{ display: 'none' }}>
        <GmailOAuthSettings />
      </div>
    </div>
  );
};

// Practice Themes Content Component (moved from main tabs)
const PracticeThemesContent: React.FC = () => {
  const { currentTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Premium Theme Selection Card */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3 -ml-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Icon icon={SolarIcons.palette} className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Color Themes</CardTitle>
              <p className="text-sm text-gray-500">Choose your preferred color scheme</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Choose your preferred color theme</h4>
              <p className="text-sm text-gray-500 mb-6">
                Select a color theme to personalize the appearance of your dashboard and sidebar. 
                Changes are applied immediately and saved automatically.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {themes.map((theme, index) => (
                <motion.div
                  key={theme.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-300 ${
                    currentTheme.id === theme.id
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-white shadow-2xl ring-4 ring-purple-100'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-xl bg-gradient-to-br from-white to-gray-50'
                  }`}
                  onClick={() => setTheme(theme.id)}
                >
                  {/* Theme Preview */}
                  <div className="space-y-3">
                    {/* Enhanced Gradient Preview with Glass Effect */}
                    <div className={`h-10 rounded-xl bg-gradient-to-r ${theme.gradients.sidebar} shadow-lg relative overflow-hidden border border-white/20`}>
                      <div className="absolute inset-0 bg-white/20 backdrop-blur-sm"></div>
                      <div className="absolute bottom-1 left-2 right-2 h-0.5 bg-white/40 rounded-full"></div>
                      <div className="absolute top-1 left-2 w-8 h-0.5 bg-white/60 rounded-full"></div>
                    </div>
                    
                    {/* Theme Info */}
                    <div>
                      <h5 className="text-sm font-bold text-gray-900 group-hover:text-gray-800">{theme.name}</h5>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{theme.description}</p>
                    </div>
                    
                    {/* Enhanced Color Palette */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full border-2 border-white shadow-lg ring-1 ring-gray-200"
                          style={{ backgroundColor: theme.colors.primary.from }}
                        ></div>
                        <div
                          className="w-5 h-5 rounded-full border-2 border-white shadow-lg ring-1 ring-gray-200"
                          style={{ backgroundColor: theme.colors.primary.to }}
                        ></div>
                        {theme.colors.primary.via && (
                          <div
                            className="w-5 h-5 rounded-full border-2 border-white shadow-lg ring-1 ring-gray-200"
                            style={{ backgroundColor: theme.colors.primary.via }}
                          ></div>
                        )}
                        {theme.colors.accent && (
                          <div
                            className="w-5 h-5 rounded-full border-2 border-white shadow-lg ring-1 ring-gray-200"
                            style={{ backgroundColor: theme.colors.accent.from }}
                          ></div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold tracking-wide ${
                          currentTheme.id === theme.id 
                            ? 'text-purple-600' 
                            : 'text-gray-400 group-hover:text-gray-500'
                        }`}>
                          {currentTheme.id === theme.id ? 'ACTIVE' : 'SELECT'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Premium Selected Indicator */}
                  {currentTheme.id === theme.id && (
                    <motion.div 
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", duration: 0.6 }}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-xl ring-4 ring-white"
                    >
                      <Icon icon={SolarIcons.check} className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                  
                  {/* Hover Glow Effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </motion.div>
              ))}
            </div>
            
            {/* Premium Theme Information */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 mt-8 border border-purple-100">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <Icon icon={SolarIcons.sparkles} className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h5 className="text-lg font-bold text-gray-900 mb-2">
                    Active: {currentTheme.name}
                  </h5>
                  <p className="text-sm text-gray-700 mb-3">
                    {currentTheme.description}
                  </p>
                  <div className="flex items-center gap-6 text-xs text-gray-600">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      Applied System-wide
                    </span>
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      {themes.length} Themes Available
                    </span>
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      Auto-saved
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Preview Card */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3 -ml-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Icon icon={SolarIcons.palette} className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Theme Preview</CardTitle>
              <p className="text-sm text-gray-500">See how your theme looks</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">See how your theme looks</h4>
              <p className="text-xs text-gray-500 mb-4">
                Preview your selected theme with sample UI components
              </p>
            </div>
            
            {/* Theme Preview Components */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sample Button */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Primary Button</label>
                <button className={`w-full px-4 py-2 rounded-lg bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white font-medium shadow-md hover:shadow-lg transition-all`}>
                  Sample Button
                </button>
              </div>
              
              {/* Sample Sidebar */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Sidebar Style</label>
                <div className={`w-full h-12 rounded-lg bg-gradient-to-r ${currentTheme.gradients.sidebar} flex items-center px-3 shadow-md`}>
                  <div className="w-6 h-6 bg-white/20 rounded-md mr-2"></div>
                  <span className="text-white text-sm font-medium">Navigation</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
