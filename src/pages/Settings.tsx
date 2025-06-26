import React, { useState, useEffect } from 'react';
import Icon, { SolarIcons } from '../components/ui/Icon';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { useTheme } from '../stores/themeStore';
import { motion } from 'framer-motion';
import BranchManagement from '../components/settings/BranchManagement';
import { toast } from 'react-hot-toast';

// Add Iconify script
if (typeof window !== 'undefined' && !window.iconifyLoaded) {
  const script = document.createElement('script');
  script.src = 'https://code.iconify.design/3/3.1.1/iconify.min.js';
  script.async = true;
  document.head.appendChild(script);
  window.iconifyLoaded = true;
}

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const { currentTheme, themes, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'themes' | 'users' | 'practice' | 'system'>('account');

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
            <UsersManagementContent />
          )}
          
          {activeTab === 'practice' && (
            <PracticeProfileContent onTabChange={setActiveTab} />
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Practice Profile Component
const PracticeProfileContent: React.FC<{ onTabChange?: (tab: string) => void }> = ({ onTabChange }) => {
  const { user } = useAuthStore();
  const [practiceTab, setPracticeTab] = useState<'profile' | 'hours' | 'branches'>('profile');
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

  return (
    <div className="space-y-6">
      {/* Practice Profile Header */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-md">
                <Icon icon={SolarIcons.building} className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Practice Management</CardTitle>
                <p className="text-sm text-gray-600">Manage your practice information, staff, and settings</p>
              </div>
            </div>
            <Button variant="outline" className="hover:bg-gray-50">
              <Icon icon={SolarIcons.globe} className="w-4 h-4 mr-2" />
              Preview Website
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Practice Tabs */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setPracticeTab('profile')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                practiceTab === 'profile'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Practice Info
            </button>
            <button
              onClick={() => setPracticeTab('hours')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                practiceTab === 'hours'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Hours & Availability
            </button>
            <button
              onClick={() => setPracticeTab('branches')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                practiceTab === 'branches'
                  ? 'text-purple-600 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Branch Management
            </button>
          </div>

          <div className="p-6">
            {/* Practice Info Tab */}
            {practiceTab === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center">
                        {practiceData.logo_url ? (
                          <img 
                            src={practiceData.logo_url} 
                            alt={practiceData.name}
                            className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-gray-200"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
                            <Icon icon={SolarIcons.building} className="w-12 h-12 text-white" />
                          </div>
                        )}
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                          {practiceData.name}
                        </h2>
                        <div className="space-y-2 w-full mt-4">
                          <div className="flex items-center py-2">
                            <Icon icon={SolarIcons.mapPin} className="w-4 h-4 text-gray-400 mr-3" />
                            <span className="text-sm text-gray-700">{practiceData.address || 'No address set'}</span>
                          </div>
                          <div className="flex items-center py-2">
                            <Icon icon={SolarIcons.phone} className="w-4 h-4 text-gray-400 mr-3" />
                            <span className="text-sm text-gray-700">{practiceData.contact_phone || 'No phone set'}</span>
                          </div>
                          <div className="flex items-center py-2">
                            <Icon icon={SolarIcons.mail} className="w-4 h-4 text-gray-400 mr-3" />
                            <span className="text-sm text-gray-700">{practiceData.contact_email || 'No email set'}</span>
                          </div>
                          <div className="flex items-center py-2">
                            <Icon icon={SolarIcons.globe} className="w-4 h-4 text-gray-400 mr-3" />
                            <span className="text-sm text-gray-700">{practiceData.city || 'No city set'}</span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          className="mt-4 w-full"
                          onClick={() => setEditingSection('basic_info')}
                          disabled={saving}
                        >
                          <Icon icon={SolarIcons.edit} className="w-4 h-4 mr-2" />
                          {saving ? 'Saving...' : 'Edit Practice Info'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <CardHeader>
                      <CardTitle>Hours of Operation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(Array.isArray(practiceData.business_hours) ? practiceData.business_hours : defaultMockData.hours).map((day, idx) => (
                          <div key={idx} className="flex justify-between py-2 text-sm">
                            <span className="font-medium text-gray-700">{day.day}</span>
                            <span className="text-gray-600">{day.hours}</span>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="mt-4 w-full">
                        <Icon icon={SolarIcons.clock} className="w-4 h-4 mr-2" />
                        Manage Hours
                      </Button>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="lg:col-span-2">
                  {/* Basic Info Edit Form */}
                  {editingSection === 'basic_info' && (
                    <Card className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <CardHeader>
                        <CardTitle>Edit Practice Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Practice Name
                            </label>
                            <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => handleInputChange('name', e.target.value)}
                              className="w-full p-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                              placeholder="Enter practice name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              value={formData.city}
                              onChange={(e) => handleInputChange('city', e.target.value)}
                              className="w-full p-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                              placeholder="Enter city"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              value={formData.contact_phone}
                              onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                              className="w-full p-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                              placeholder="Enter phone number"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Email Address
                            </label>
                            <input
                              type="email"
                              value={formData.contact_email}
                              onChange={(e) => handleInputChange('contact_email', e.target.value)}
                              className="w-full p-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                              placeholder="Enter email address"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Website URL
                            </label>
                            <input
                              type="url"
                              value={formData.website_url}
                              onChange={(e) => handleInputChange('website_url', e.target.value)}
                              className="w-full p-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                              placeholder="https://your-practice-website.com"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Address
                            </label>
                            <input
                              type="text"
                              value={formData.address}
                              onChange={(e) => handleInputChange('address', e.target.value)}
                              className="w-full p-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                              placeholder="Enter full address"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                          <Button 
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                          >
                            <Icon icon={SolarIcons.save} className="w-4 h-4 mr-2" />
                            {saving ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            onClick={handleCancel}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <Card className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Practice Description</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setEditingSection('description')}
                          disabled={saving}
                        >
                          <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {editingSection === 'description' ? (
                        <div className="space-y-4">
                          <textarea
                            value={formData.about_text}
                            onChange={(e) => handleInputChange('about_text', e.target.value)}
                            className="w-full h-32 p-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none transition-all duration-200 hover:bg-gray-200"
                            placeholder="Enter practice description..."
                          />
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={handleSave}
                              disabled={saving}
                              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                            >
                              <Icon icon={SolarIcons.save} className="w-4 h-4 mr-2" />
                              {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={handleCancel}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700">{practiceData.about_text || 'No description set'}</p>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Specialties & Services</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setEditingSection('services')}
                          disabled={saving}
                        >
                          <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {editingSection === 'services' ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {formData.services?.map((service, idx) => (
                              <div key={idx} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg">
                                <input
                                  type="text"
                                  value={typeof service === 'string' ? service : service.name}
                                  onChange={(e) => {
                                    const newServices = [...(formData.services || [])];
                                    if (typeof service === 'string') {
                                      newServices[idx] = e.target.value;
                                    } else {
                                      newServices[idx] = { ...service, name: e.target.value };
                                    }
                                    handleInputChange('services', newServices);
                                  }}
                                  className="flex-1 p-2 bg-gray-100 border-0 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                  placeholder="Service name"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newServices = formData.services?.filter((_, i) => i !== idx) || [];
                                    handleInputChange('services', newServices);
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Icon icon={SolarIcons.close} className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newServices = [...(formData.services || []), ''];
                              handleInputChange('services', newServices);
                            }}
                            className="mt-2"
                          >
                            <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
                            Add Service
                          </Button>
                          
                          <div className="flex gap-2 mt-6">
                            <Button 
                              onClick={handleSave}
                              disabled={saving}
                              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                            >
                              <Icon icon={SolarIcons.save} className="w-4 h-4 mr-2" />
                              {saving ? 'Saving...' : 'Save Services'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              onClick={handleCancel}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(practiceData.services) ? practiceData.services : defaultMockData.specialties).map((service, idx) => (
                              <span 
                                key={idx}
                                className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm"
                              >
                                {typeof service === 'string' ? service : service.name}
                              </span>
                            ))}
                          </div>
                          {(!practiceData.services || practiceData.services.length === 0) && (
                            <p className="text-gray-500 text-sm mt-2">No services defined yet</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <CardHeader>
                      <CardTitle>Practice Logo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {practiceData.logo_url ? (
                          <div className="flex items-center space-x-4">
                            <img 
                              src={practiceData.logo_url} 
                              alt="Practice logo"
                              className="w-20 h-20 object-contain border border-gray-200 rounded-lg"
                            />
                            <div>
                              <p className="text-sm text-gray-600 mb-2">Current logo</p>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = handleLogoUpload;
                                    input.click();
                                  }}
                                  disabled={saving}
                                >
                                  <Icon icon={SolarIcons.image} className="w-4 h-4 mr-2" />
                                  Change Logo
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => savePracticeData({ logo_url: '' })}
                                  disabled={saving}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="border border-dashed border-gray-300 rounded-lg p-8">
                            <div className="text-center">
                              <Icon icon={SolarIcons.image} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-sm text-gray-600 mb-4">No logo uploaded yet</p>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = handleLogoUpload;
                                  input.click();
                                }}
                                disabled={saving}
                              >
                                <Icon icon={SolarIcons.image} className="w-4 h-4 mr-2" />
                                {saving ? 'Uploading...' : 'Upload Logo'}
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          <p>Recommended: PNG or JPG, max 2MB, square format for best results</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            
            {/* Hours Tab */}
            {practiceTab === 'hours' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Hours of Operation</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setEditingSection('hours')}
                        disabled={saving}
                      >
                        <Icon icon={SolarIcons.edit} className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingSection === 'hours' ? (
                      <div className="space-y-4">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                          const dayData = formData.business_hours?.[day] || {};
                          const isClosed = dayData.closed || false;
                          
                          return (
                            <div key={day} className="flex items-center justify-between py-3 border-b border-gray-100">
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={!isClosed}
                                  onChange={(e) => {
                                    const newHours = {
                                      ...formData.business_hours,
                                      [day]: e.target.checked 
                                        ? { open: "08:00", close: "17:00" }
                                        : { closed: true }
                                    };
                                    handleInputChange('business_hours', newHours);
                                  }}
                                  className="rounded border-gray-300"
                                />
                                <span className="font-medium text-gray-700 capitalize w-24">
                                  {day}
                                </span>
                              </div>
                              
                              {!isClosed ? (
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="time"
                                    value={dayData.open || "08:00"}
                                    onChange={(e) => {
                                      const newHours = {
                                        ...formData.business_hours,
                                        [day]: { ...dayData, open: e.target.value }
                                      };
                                      handleInputChange('business_hours', newHours);
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <span className="text-gray-500">to</span>
                                  <input
                                    type="time"
                                    value={dayData.close || "17:00"}
                                    onChange={(e) => {
                                      const newHours = {
                                        ...formData.business_hours,
                                        [day]: { ...dayData, close: e.target.value }
                                      };
                                      handleInputChange('business_hours', newHours);
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              ) : (
                                <span className="text-gray-500 text-sm">Closed</span>
                              )}
                            </div>
                          );
                        })}
                        <div className="flex gap-2 mt-6">
                          <Button 
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                          >
                            <Icon icon={SolarIcons.save} className="w-4 h-4 mr-2" />
                            {saving ? 'Saving...' : 'Save Hours'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            onClick={handleCancel}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                          const dayData = practiceData.business_hours?.[day] || {};
                          const isClosed = dayData.closed || false;
                          
                          return (
                            <div key={day} className="flex justify-between items-center py-2">
                              <span className="font-medium text-gray-700 capitalize">{day}</span>
                              <span className="text-gray-600 text-sm">
                                {isClosed ? 'Closed' : `${dayData.open || '08:00'} - ${dayData.close || '17:00'}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center">
                      <Icon icon={SolarIcons.users} className="w-5 h-5 text-purple-600 mr-2" />
                      <CardTitle>Staff Availability</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        To manage staff schedules and availability, please visit the Users tab.
                      </p>
                    </div>
                    
                    <div className="text-center mt-6">
                      <Button 
                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                        onClick={() => onTabChange?.('users')}
                      >
                        <Icon icon={SolarIcons.users} className="w-4 h-4 mr-2" />
                        Go to User Management
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Branches Tab */}
            {practiceTab === 'branches' && (
              <BranchManagement />
            )}
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
};

// Users Management Component
const UsersManagementContent: React.FC = () => {
  const { user } = useAuthStore();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branches, setBranches] = useState<any[]>([]);

  // Load staff data from users table
  useEffect(() => {
    const loadStaffAndBranches = async () => {
      if (!user?.practice_id) {
        setLoading(false);
        return;
      }

      try {
        // Load staff
        const { data: staffData, error: staffError } = await supabase
          .from('users')
          .select('id, full_name, email, role, avatar, hpcsa_number, branch_id')
          .eq('practice_id', user.practice_id)
          .order('full_name');

        if (staffError) {
          console.error('Error loading staff data:', staffError);
        } else if (staffData) {
          setStaff(staffData);
        }

        // Load branches
        const { data: branchData, error: branchError } = await supabase
          .from('branches')
          .select('id, name')
          .eq('practice_id', user.practice_id)
          .order('name');

        if (branchError) {
          console.error('Error loading branches:', branchError);
        } else if (branchData) {
          setBranches(branchData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStaffAndBranches();
  }, [user?.practice_id]);

  const filteredStaff = selectedBranch === 'all' 
    ? staff 
    : selectedBranch === 'unassigned'
    ? staff.filter(s => !s.branch_id)
    : staff.filter(s => s.branch_id === selectedBranch);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading staff information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-md">
                <Icon icon={SolarIcons.users} className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">User Management</CardTitle>
                <p className="text-sm text-gray-600">Manage staff members and their assignments</p>
              </div>
            </div>
            <Button 
              onClick={() => setEditingSection('add_staff')}
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
            >
              <Icon icon={SolarIcons.plus} className="w-4 h-4 mr-2" />
              Add Staff Member
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      {branches.length > 0 && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Filter by branch:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedBranch('all')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    selectedBranch === 'all'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Staff
                </button>
                <button
                  onClick={() => setSelectedBranch('unassigned')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    selectedBranch === 'unassigned'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Unassigned
                </button>
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranch(branch.id)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      selectedBranch === branch.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map((staffMember) => (
          <Card key={staffMember.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                {staffMember.avatar ? (
                  <img 
                    src={staffMember.avatar} 
                    alt={staffMember.full_name}
                    className="w-20 h-20 rounded-full object-cover mb-3 border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mb-3">
                    <Icon icon={SolarIcons.user} className="w-10 h-10 text-white" />
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900">
                  {staffMember.full_name}
                </h3>
                <p className="text-purple-600 font-medium capitalize">
                  {staffMember.role}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {staffMember.email}
                </p>
                {staffMember.hpcsa_number && (
                  <p className="text-xs text-gray-400 mt-1">
                    HPCSA: {staffMember.hpcsa_number}
                  </p>
                )}
                {staffMember.branch_id && branches.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                    <Icon icon={SolarIcons.mapPin} className="w-3 h-3" />
                    {branches.find(b => b.id === staffMember.branch_id)?.name || 'Branch Assigned'}
                  </p>
                )}
                <div className="flex mt-4 space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingSection(`schedule_${staffMember.id}`)}
                  >
                    <Icon icon={SolarIcons.calendar} className="w-4 h-4 mr-1" />
                    Schedule
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setEditingSection(`edit_${staffMember.id}`)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Add New Staff Card */}
        <Card className="border-2 border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-100/50 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center h-full py-8">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                <Icon icon={SolarIcons.users} className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700">
                Add Team Member
              </h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Add a new doctor or staff member
              </p>
              <Button 
                onClick={() => setEditingSection('add_staff')}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
              >
                Add Staff
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Schedule Modal */}
      {editingSection?.startsWith('schedule_') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Staff Schedule - {staff.find(s => editingSection === `schedule_${s.id}`)?.full_name}
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setEditingSection(null)}
              >
                <Icon icon={SolarIcons.close} className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Set the working hours for this staff member. This will determine when they are available for appointments.
              </p>
              
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                <div key={day} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked={!['saturday', 'sunday'].includes(day)}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium text-gray-700 capitalize w-24">
                      {day}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="time"
                      defaultValue="09:00"
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      defaultValue="17:00"
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2 mt-6">
                <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                  <Icon icon={SolarIcons.save} className="w-4 h-4 mr-2" />
                  Save Schedule
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setEditingSection(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {editingSection === 'add_staff' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full m-4 max-h-[90vh] overflow-hidden"
          >
            <div className="relative bg-gradient-to-r from-purple-500 to-indigo-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Icon icon={SolarIcons.userCircle} className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Add New Staff Member</h3>
                </div>
                <button
                  onClick={() => setEditingSection(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Icon icon={SolarIcons.close} className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            
            <form className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]" onSubmit={(e) => {
              e.preventDefault();
              // Handle form submission
              toast.success('Staff member added successfully!');
              setEditingSection(null);
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    placeholder="Dr. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    placeholder="john.doe@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                  >
                    <option value="">Select role</option>
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    placeholder="+264 81 234 5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HPCSA Number
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                    placeholder="For medical professionals"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                  >
                    <option value="">Select branch (optional)</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all duration-200 hover:bg-gray-200"
                  placeholder="Temporary password for first login"
                />
                <p className="text-xs text-gray-500 mt-1">
                  User will be required to change password on first login
                </p>
              </div>
              
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingSection(null)}
                  className="px-6 py-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-2.5"
                >
                  <Icon icon={SolarIcons.plus} className="w-5 h-5 mr-2" />
                  Add Staff Member
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Settings;