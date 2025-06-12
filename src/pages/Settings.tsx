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
  Image
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuthStore } from '../stores/authStore';

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'notifications' | 'system' | 'practice'>('account');

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="animate-fade-in">
      <div className="flex items-center mb-6">
        <SettingsIcon size={28} className="text-primary-600 mr-3" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and application preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('account')}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                    activeTab === 'account'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <User size={18} className="mr-3" />
                  Account
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                    activeTab === 'security'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Shield size={18} className="mr-3" />
                  Security
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                    activeTab === 'notifications'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Bell size={18} className="mr-3" />
                  Notifications
                </button>
                <button
                  onClick={() => setActiveTab('system')}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                    activeTab === 'system'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Globe size={18} className="mr-3" />
                  System
                </button>
                <button
                  onClick={() => setActiveTab('practice')}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md w-full ${
                    activeTab === 'practice'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Building2 size={18} className="mr-3" />
                  Practice
                </button>
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          {activeTab === 'account' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
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
              
              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
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
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
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
              
              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
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
              
              <Card>
                <CardHeader>
                  <CardTitle>Login Sessions</CardTitle>
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
          
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Appointment Notifications</h3>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          id="appointment-created"
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          defaultChecked
                        />
                        <label htmlFor="appointment-created" className="ml-3 text-sm text-gray-700">
                          New appointment created
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="appointment-reminder"
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          defaultChecked
                        />
                        <label htmlFor="appointment-reminder" className="ml-3 text-sm text-gray-700">
                          Appointment reminders (1 day before)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="appointment-cancelled"
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          defaultChecked
                        />
                        <label htmlFor="appointment-cancelled" className="ml-3 text-sm text-gray-700">
                          Cancelled appointments
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Patient Notifications</h3>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          id="patient-new"
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          defaultChecked
                        />
                        <label htmlFor="patient-new" className="ml-3 text-sm text-gray-700">
                          New patient registration
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="patient-updated"
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="patient-updated" className="ml-3 text-sm text-gray-700">
                          Patient information updated
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">System Notifications</h3>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          id="system-updates"
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          defaultChecked
                        />
                        <label htmlFor="system-updates" className="ml-3 text-sm text-gray-700">
                          System updates and maintenance
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="security-alerts"
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          defaultChecked
                        />
                        <label htmlFor="security-alerts" className="ml-3 text-sm text-gray-700">
                          Security alerts
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Notification Methods</h3>
                    <div className="mt-2 space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                          <p className="text-xs text-gray-500">Receive notifications via email</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">SMS Notifications</h4>
                          <p className="text-xs text-gray-500">Receive notifications via SMS</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Browser Notifications</h4>
                          <p className="text-xs text-gray-500">Receive notifications in browser</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button>Save Notification Settings</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {activeTab === 'system' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
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
              
              <Card>
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
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
              
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Settings</CardTitle>
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Building2 size={24} className="text-primary-600 mr-3" />
              <div>
                <CardTitle>Practice Management</CardTitle>
                <p className="text-sm text-gray-600">Manage your practice information, staff, and settings</p>
              </div>
            </div>
            <Button variant="outline">
              <Globe size={16} className="mr-2" />
              Preview Website
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Practice Tabs */}
      <Card>
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
                  <Card>
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
                  
                  <Card className="mt-6">
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
                  <Card className="mb-6">
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
                  
                  <Card className="mb-6">
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
                  
                  <Card>
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
                    <Card key={staff.id}>
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
                  <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
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
                <Card>
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
                
                <Card>
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