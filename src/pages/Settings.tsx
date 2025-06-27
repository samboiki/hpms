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
import { toast } from 'react-hot-toast';
import { usePractice } from '../contexts/PracticeContext';
import FloatingVisitTracker from '../components/dashboard/FloatingVisitTracker';

// Iconify is now handled by @iconify/react package

const Settings: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { currentTheme, themes, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'themes' | 'users' | 'practice' | 'system'>('account');
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const { practiceId } = usePractice();

  const tabIcons = {
    account: SolarIcons.user,
    security: SolarIcons.shield,
    themes: SolarIcons.palette,
    users: SolarIcons.users,
    practice: SolarIcons.building,
    system: SolarIcons.globe
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">

        {/* Header Section */}
        <div className="backdrop-blur-md rounded-xl shadow-sm border border-gray-100/50 bg-white">
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
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="h-14 w-14 rounded-full overflow-hidden border-3 border-white shadow-lg">
                                <img 
                                  src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                                  alt={user.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-semibold text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
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
            {(['account', 'security', 'themes', 'users', 'practice', 'system'] as const).map((tab, index) => {
              const iconName = tabIcons[tab];
              const isActive = activeTab === tab;
              const tabLabel = tab === 'themes' ? 'Themes' : tab;
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
                <div className="space-y-6">
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
                          <Button variant="outline" size="sm" className="mt-2">
                            <Icon icon={SolarIcons.camera} className="w-4 h-4 mr-2" />
                            Change Avatar
                          </Button>
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
                      
                      <div className="mt-6">
                        <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                          <Icon icon={SolarIcons.save} className="w-5 h-5 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
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
                </div>
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
          
          {activeTab === 'themes' && (
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
          )}
          
          {activeTab === 'system' && (
            <div className="space-y-6">
              <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3 -ml-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon icon={SolarIcons.globe} className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">System Information</CardTitle>
                      <p className="text-sm text-gray-500">View system details and status</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-500">System Version</span>
                      <span className="text-sm text-gray-900">HealthCare 2.5.0</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-500">Last Updated</span>
                      <span className="text-sm text-gray-900">October 15, 2023</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-500">Database Status</span>
                      <span className="text-sm text-green-600 flex items-center">
                        <Icon icon={SolarIcons.checkCircle} className="w-4 h-4 mr-1" />
                        Connected
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-500">Storage Usage</span>
                      <span className="text-sm text-gray-900">1.2 GB / 10 GB</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex space-x-3">
                    <Button variant="outline">
                      Check for Updates
                    </Button>
                    <Button variant="outline">
                      System Diagnostics
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
                      <CardTitle className="text-lg font-semibold text-gray-900">Compliance Settings</CardTitle>
                      <p className="text-sm text-gray-500">Manage security and compliance</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">HIPAA Audit Logging</h4>
                        <p className="text-xs text-gray-500">Log all data access for compliance</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Data Encryption</h4>
                        <p className="text-xs text-gray-500">End-to-end encryption for all data</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Session Timeout</h4>
                        <p className="text-xs text-gray-500">Auto-logout after inactivity</p>
                      </div>
                      <select className="px-3 py-2 rounded-lg bg-white border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm">
                        <option value="5">5 minutes</option>
                        <option value="15" selected>15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">60 minutes</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                      <Icon icon={SolarIcons.save} className="w-5 h-5 mr-2" />
                      Save Compliance Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {activeTab === 'users' && (
            <EnhancedUserManagement />
          )}
          
          {activeTab === 'practice' && (
            <PracticeProfileContent onTabChange={setActiveTab} />
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

// Practice Profile Component
const PracticeProfileContent: React.FC<{ onTabChange?: (tab: string) => void }> = ({ onTabChange }) => {
  const { user } = useAuthStore();
  const { currentTheme } = useTheme();
  const [practiceTab, setPracticeTab] = useState<'profile' | 'hours' | 'branches' | 'departments'>('profile');
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

  // Load practice data from database
  useEffect(() => {
    const loadPracticeData = async () => {
      if (!user?.practice_id) {
        setLoading(false);
        return;
      }

      try {
        console.log('📊 Loading practice data for ID:', user.practice_id);
        
        const { data: practice, error } = await supabase
          .from('practices')
          .select('*')
          .eq('id', user.practice_id)
          .single();

        if (error) {
          console.error('❌ Error loading practice data:', error);
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
            business_hours: practice.business_hours || defaultMockData.hours,
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
    };

    loadPracticeData();
  }, [user?.practice_id]);

  // Save practice data to database
  const savePracticeData = async (updates: Partial<typeof practiceData>) => {
    if (!user?.practice_id || saving) return;

    try {
      setSaving(true);
      console.log('💾 Saving practice data...', updates);
      
      const { error } = await supabase
        .from('practices')
        .update({
          ...updates,
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

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    try {
      setSaving(true);
      console.log('📤 Uploading logo...', file.name);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${practiceData.id}/logo_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('practice-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        alert('Failed to upload logo. Please try again.');
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('practice-assets')
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
    { id: 'hours' as const, label: 'Business Hours', icon: SolarIcons.clock },
    { id: 'branches' as const, label: 'Branches', icon: SolarIcons.buildings },
    { id: 'departments' as const, label: 'Departments', icon: SolarIcons.folder }
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
              </div>
            )}

            {/* Business Hours Tab */}
            {practiceTab === 'hours' && (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Icon icon={SolarIcons.clock} className="w-5 h-5 text-purple-600" />
                      Business Hours
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info('Business hours editing coming soon!')}
                    >
                      <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-1" />
                      Edit Hours
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(Array.isArray(practiceData.business_hours) ? practiceData.business_hours : defaultMockData.hours).map((day, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                        <span className="font-medium text-gray-900">{day.day}</span>
                        <span className="text-gray-600">{day.hours}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Branches Tab */}
            {practiceTab === 'branches' && (
              <BranchManagement />
            )}

            {/* Departments Tab */}
            {practiceTab === 'departments' && (
              <DepartmentManagement />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
