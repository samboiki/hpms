import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Bell, 
  Globe, 
  HardDrive,
  CheckCircle2,
  Lock,
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Calendar,
  Users,
  Edit3,
  Image,
  Sparkles,
  Palette,
  Save,
  Camera
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../stores/themeStore';
import { motion } from 'framer-motion';

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const { currentTheme, themes, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'themes' | 'system' | 'practice'>('account');

  const tabIcons = {
    account: User,
    security: Shield,
    themes: Palette,
    system: Globe,
    practice: Building2
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Premium Header with Glassmorphic Design */}
        <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-sm border border-gray-100/50">
          <div className="p-4 md:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-[#01b9d5] to-cyan-600 rounded-xl shadow-md">
                  <SettingsIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">Settings</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Manage your account and application preferences</p>
                </div>
              </div>
              {user && (
                <div className="relative group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300`}></div>
                  <div className={`absolute -inset-1 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full opacity-50`}></div>
                  <div className="relative h-14 w-14 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                    <img 
                      src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                      alt={user.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`;
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Premium Navigation Tabs */}
        <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-gray-100/50 overflow-hidden">
          <div className="grid grid-cols-5 gap-0 w-full">
            {(['account', 'security', 'themes', 'system', 'practice'] as const).map((tab, index) => {
              const Icon = tabIcons[tab];
              const isActive = activeTab === tab;
              const tabLabel = tab === 'themes' ? 'Themes' : tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200 capitalize min-h-[60px] ${
                    isActive
                      ? `bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white shadow-md`
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                  <span className="truncate text-center sm:text-left">{tabLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Now shows additional info */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              {/* User Quick Info Card */}
              {user && (
                <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative group">
                        <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full blur-md opacity-30`}></div>
                        <div className="relative h-16 w-16 rounded-full overflow-hidden border-3 border-white shadow-lg">
                          <img 
                            src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                            alt={user.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <button className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-md hover:shadow-lg transition-all">
                          <Camera className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mt-3">{user.name}</h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white`}>
                        {user.role}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Quick Actions Card */}
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2">
                    <button className="w-full text-left p-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Export Settings
                    </button>
                    <button className="w-full text-left p-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Theme Preview
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="min-h-[600px]">
          {activeTab === 'account' && (
            <div className="space-y-6">
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-600" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center mb-6">
                    <div className="mb-4 sm:mb-0 sm:mr-6">
                      {user?.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.name} 
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                          <User size={32} className="text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{user?.name}</h3>
                      <p className="text-gray-500">{user?.email}</p>
                      <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Change Avatar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        className="px-3 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                        defaultValue={user?.name}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        className="px-3 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                        defaultValue={user?.email}
                      />
                    </div>
                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <select
                        id="role"
                        className="px-3 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
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
                    <Button>Save Changes</Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-gray-600" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Dark Mode</h4>
                        <p className="text-xs text-gray-500">Switch between light and dark mode</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Show Online Status</h4>
                        <p className="text-xs text-gray-500">Allow others to see when you're online</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Appointment Notification Sounds</h4>
                        <p className="text-xs text-gray-500">Play sounds for appointment notifications</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button>Save Preferences</Button>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
          
          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-gray-600" />
                    Change Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="current-password"
                        className="px-3 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="new-password"
                        className="px-3 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        id="confirm-password"
                        className="px-3 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button>Update Password</Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-gray-600" />
                    Two-Factor Authentication
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-0.5">
                      <CheckCircle2 size={20} className="text-success-500" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-900">Two-factor authentication is enabled</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Two-factor authentication adds an extra layer of security to your account.
                        In addition to your password, you'll need to enter a code that we text to your phone.
                      </p>
                      <div className="mt-3">
                        <Button variant="outline" size="sm">
                          <Lock size={14} className="mr-2" />
                          Manage 2FA Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-gray-600" />
                    Login Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 px-4 bg-green-50 border border-green-100 rounded-md">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-full">
                          <CheckCircle2 size={16} className="text-green-600" />
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
                    
                    <div className="flex justify-between items-center py-3 px-4 border border-gray-200 rounded-md">
                      <div className="flex items-center">
                        <div className="p-2 bg-gray-100 rounded-full">
                          <HardDrive size={16} className="text-gray-600" />
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
                    <Button variant="outline" className="text-error-600 hover:text-error-700 border-error-300 hover:border-error-400 hover:bg-error-50">
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
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-gray-600" />
                    Color Themes
                  </CardTitle>
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
                              ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-white shadow-2xl ring-4 ring-blue-100'
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
                                    ? 'text-blue-600' 
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
                              className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-xl ring-4 ring-white"
                            >
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </motion.div>
                          )}
                          
                          {/* Hover Glow Effect */}
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </motion.div>
                      ))}
                    </div>
                    
                    {/* Premium Theme Information */}
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 mt-8 border border-blue-100">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-blue-100 rounded-xl">
                          <Sparkles className="w-6 h-6 text-blue-600" />
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
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-gray-600" />
                    Theme Preview
                  </CardTitle>
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
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-gray-600" />
                    System Information
                  </CardTitle>
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
                        <CheckCircle2 size={14} className="mr-1" />
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
              
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-gray-600" />
                    Data Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Backup Settings</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-700">Automatic Backups</p>
                          <p className="text-xs text-gray-500">Daily backups of your data</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Data Retention</h3>
                      <select className="px-3 py-2 w-full rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500">
                        <option value="7">7 days</option>
                        <option value="30">30 days</option>
                        <option value="90">90 days</option>
                        <option value="365" selected>1 year</option>
                        <option value="forever">Forever</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        How long to keep system logs and audit trails
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex space-x-3">
                    <Button>
                      Save Settings
                    </Button>
                    <Button variant="outline">
                      Manual Backup
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-gray-600" />
                    Compliance Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">HIPAA Audit Logging</h4>
                        <p className="text-xs text-gray-500">Log all data access for compliance</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Data Encryption</h4>
                        <p className="text-xs text-gray-500">End-to-end encryption for all data</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Session Timeout</h4>
                        <p className="text-xs text-gray-500">Auto-logout after inactivity</p>
                      </div>
                      <select className="px-3 py-1 rounded-md border border-gray-300 focus:ring-primary-500 focus:border-primary-500 text-sm">
                        <option value="5">5 minutes</option>
                        <option value="15" selected>15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">60 minutes</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button>
                      Save Compliance Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {activeTab === 'practice' && (
            <PracticeProfileContent />
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Practice Profile Component
const PracticeProfileContent: React.FC = () => {
  const [practiceTab, setPracticeTab] = useState<'profile' | 'staff' | 'hours'>('profile');
  
  // Mock practice data
  const practiceData = {
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
    ],
    staff: [
      { 
        id: 'd1',
        name: 'Dr. Jane Smith', 
        role: 'Lead Physician', 
        specialty: 'Family Medicine',
        avatar: 'https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=200',
      },
      { 
        id: 'd2',
        name: 'Dr. Michael Chen', 
        role: 'Physician', 
        specialty: 'Internal Medicine',
        avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=200',
      },
      { 
        id: 'd3',
        name: 'Dr. Sarah Johnson', 
        role: 'Physician', 
        specialty: 'Pediatrics',
        avatar: 'https://images.pexels.com/photos/5215024/pexels-photo-5215024.jpeg?auto=compress&cs=tinysrgb&w=200',
      },
      { 
        id: 's1',
        name: 'Emily Wilson', 
        role: 'Nurse Practitioner', 
        specialty: 'Family Medicine',
        avatar: 'https://images.pexels.com/photos/5214961/pexels-photo-5214961.jpeg?auto=compress&cs=tinysrgb&w=200',
      },
      { 
        id: 's2',
        name: 'Robert Brown', 
        role: 'Medical Assistant', 
        specialty: 'General',
        avatar: 'https://images.pexels.com/photos/5490276/pexels-photo-5490276.jpeg?auto=compress&cs=tinysrgb&w=200',
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Practice Profile Header */}
      <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-br from-[#01b9d5] to-cyan-600 rounded-lg shadow-md">
                <Building2 size={20} className="text-white" />
              </div>
              <div className="ml-3">
                <CardTitle>Practice Management</CardTitle>
                <p className="text-sm text-gray-600">Manage your practice information, staff, and settings</p>
              </div>
            </div>
            <Button variant="outline" className="hover:bg-white/50">
              <Globe size={16} className="mr-2" />
              Preview Website
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Practice Tabs */}
      <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
        <CardContent className="p-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setPracticeTab('profile')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                practiceTab === 'profile'
                  ? 'text-primary-600 border-primary-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Practice Info
            </button>
            <button
              onClick={() => setPracticeTab('staff')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                practiceTab === 'staff'
                  ? 'text-primary-600 border-primary-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Staff
            </button>
            <button
              onClick={() => setPracticeTab('hours')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                practiceTab === 'hours'
                  ? 'text-primary-600 border-primary-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Hours & Availability
            </button>
          </div>

          <div className="p-6">
            {/* Practice Info Tab */}
            {practiceTab === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center">
                        {practiceData.logo ? (
                          <img 
                            src={practiceData.logo} 
                            alt={practiceData.name}
                            className="w-24 h-24 rounded-full object-cover mb-4"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                            <Building2 size={40} className="text-gray-400" />
                          </div>
                        )}
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                          {practiceData.name}
                        </h2>
                        <div className="space-y-2 w-full mt-4">
                          <div className="flex items-center py-2">
                            <MapPin size={16} className="text-gray-400 mr-3" />
                            <span className="text-sm text-gray-700">{practiceData.address}</span>
                          </div>
                          <div className="flex items-center py-2">
                            <Phone size={16} className="text-gray-400 mr-3" />
                            <span className="text-sm text-gray-700">{practiceData.phone}</span>
                          </div>
                          <div className="flex items-center py-2">
                            <Mail size={16} className="text-gray-400 mr-3" />
                            <span className="text-sm text-gray-700">{practiceData.email}</span>
                          </div>
                          <div className="flex items-center py-2">
                            <Globe size={16} className="text-gray-400 mr-3" />
                            <span className="text-sm text-gray-700">{practiceData.website}</span>
                          </div>
                        </div>
                        <Button variant="outline" className="mt-4 w-full">
                          <Edit3 size={16} className="mr-2" />
                          Edit Practice Info
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="mt-6 bg-white/90 backdrop-blur-md border border-gray-100/50">
                    <CardHeader>
                      <CardTitle>Hours of Operation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {practiceData.hours.map((day, idx) => (
                          <div key={idx} className="flex justify-between py-2 text-sm">
                            <span className="font-medium text-gray-700">{day.day}</span>
                            <span className="text-gray-600">{day.hours}</span>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="mt-4 w-full">
                        <Clock size={14} className="mr-2" />
                        Manage Hours
                      </Button>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="lg:col-span-2">
                  <Card className="mb-6 bg-white/90 backdrop-blur-md border border-gray-100/50">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Practice Description</CardTitle>
                        <Button variant="ghost" size="sm">
                          <Edit3 size={16} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{practiceData.description}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="mb-6 bg-white/90 backdrop-blur-md border border-gray-100/50">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Specialties & Services</CardTitle>
                        <Button variant="ghost" size="sm">
                          <Edit3 size={16} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {practiceData.specialties.map((specialty, idx) => (
                          <span 
                            key={idx}
                            className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="mt-4">
                        Add Specialty
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Website Appearance</CardTitle>
                        <Button variant="ghost" size="sm">
                          <Edit3 size={16} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Logo & Branding</h4>
                          <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center">
                            <Image size={40} className="text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">Upload your practice logo</p>
                            <Button size="sm" className="mt-3">
                              Upload
                            </Button>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Color Scheme</h4>
                          <div className="space-y-3">
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded bg-primary-500 mr-3"></div>
                              <span className="text-sm text-gray-700">Primary Color</span>
                            </div>
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded bg-secondary-500 mr-3"></div>
                              <span className="text-sm text-gray-700">Secondary Color</span>
                            </div>
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded bg-accent-500 mr-3"></div>
                              <span className="text-sm text-gray-700">Accent Color</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            {/* Staff Tab */}
            {practiceTab === 'staff' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-medium text-gray-900">Practice Staff</h2>
                  <Button>
                    <Users size={16} className="mr-2" />
                    Add Staff Member
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {practiceData.staff.map((staff) => (
                    <Card key={staff.id} className="bg-white/90 backdrop-blur-md border border-gray-100/50 hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex flex-col items-center text-center">
                          {staff.avatar ? (
                            <img 
                              src={staff.avatar} 
                              alt={staff.name}
                              className="w-20 h-20 rounded-full object-cover mb-3"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                              <User size={32} className="text-gray-400" />
                            </div>
                          )}
                          <h3 className="text-lg font-bold text-gray-900">
                            {staff.name}
                          </h3>
                          <p className="text-primary-600 font-medium">
                            {staff.role}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {staff.specialty}
                          </p>
                          <div className="flex mt-4 space-x-2">
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm">
                              Remove
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Add New Staff Card */}
                  <Card className="border-2 border-dashed border-gray-300 bg-gray-50/50 backdrop-blur-md hover:bg-gray-100/50 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center justify-center text-center h-full py-8">
                        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                          <Users size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-700">
                          Add Team Member
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 mb-4">
                          Add a new doctor or staff member
                        </p>
                        <Button>
                          Add Staff
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            {/* Hours Tab */}
            {practiceTab === 'hours' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Hours of Operation</CardTitle>
                      <Button variant="ghost" size="sm">
                        <Edit3 size={16} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {practiceData.hours.map((day, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="font-medium text-gray-700">{day.day}</span>
                          <div className="flex items-center">
                            <span className="text-gray-600 mr-4">{day.hours}</span>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/90 backdrop-blur-md border border-gray-100/50">
                  <CardHeader>
                    <div className="flex items-center">
                      <Users className="w-5 h-5 text-primary-600 mr-2" />
                      <CardTitle>Staff Availability</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {practiceData.staff
                        .filter(s => s.role.includes('Physician') || s.role.includes('Doctor'))
                        .map((staff) => (
                          <div 
                            key={staff.id}
                            className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center">
                              {staff.avatar ? (
                                <img 
                                  src={staff.avatar} 
                                  alt={staff.name}
                                  className="w-12 h-12 rounded-full object-cover mr-3 border-2 border-primary-200"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                                  <User size={20} className="text-white" />
                                </div>
                              )}
                              <div>
                                <h4 className="font-medium text-gray-900">{staff.name}</h4>
                                <p className="text-sm text-gray-500">{staff.specialty}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-xs text-green-600">Available</span>
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              <Calendar className="w-4 h-4 mr-2" />
                              Schedule
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                    
                    <div className="text-center mt-6">
                      <Button className="w-full">
                        Manage All Schedules
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;