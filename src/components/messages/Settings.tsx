import React, { useState, useEffect } from 'react';
import { 
  Mail,
  MessageSquare,
  Bell,
  Globe,
  Save,
  Key,
  Building,
  AlertCircle,
  Check
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';

interface PracticeSettings {
  sms_sender_id?: string;
  email_from_address?: string;
  email_from_name?: string;
  email_reply_to_address?: string;
  notification_email?: string;
  timezone?: string;
  working_hours_start?: string;
  working_hours_end?: string;
  enable_sms_replies?: boolean;
  enable_auto_responses?: boolean;
  sms_daily_limit?: number;
  email_daily_limit?: number;
}

interface ProviderConfig {
  id: string;
  provider_name: string;
  api_key?: string;
  api_secret?: string;
  is_active: boolean;
  is_default_sms_provider?: boolean;
  is_default_email_provider?: boolean;
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'practice' | 'providers' | 'notifications'>('practice');
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
    sms_sender_id: '',
    email_from_address: '',
    email_from_name: '',
    email_reply_to_address: '',
    notification_email: '',
    timezone: 'Africa/Windhoek',
    working_hours_start: '08:00',
    working_hours_end: '17:00',
    enable_sms_replies: true,
    enable_auto_responses: false,
    sms_daily_limit: 1000,
    email_daily_limit: 5000
  });
  
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errors, setErrors] = useState<any>({});

  // Mock user role - in real app, get from auth context
  const userRole = 'admin' as 'admin' | 'super_admin';

  useEffect(() => {
    fetchSettings();
    if (userRole === 'super_admin') {
      fetchProviders();
    }
  }, []);

  const fetchSettings = async () => {
    // In a real app, fetch from practices table
    // For now, using mock data
    const mockSettings = {
      sms_sender_id: 'HealthClinic',
      email_from_address: 'noreply@healthclinic.com',
      email_from_name: 'Health Clinic',
      email_reply_to_address: 'support@healthclinic.com',
      notification_email: 'admin@healthclinic.com',
      timezone: 'Africa/Windhoek',
      working_hours_start: '08:00',
      working_hours_end: '17:00',
      enable_sms_replies: true,
      enable_auto_responses: false,
      sms_daily_limit: 1000,
      email_daily_limit: 5000
    };
    setPracticeSettings(mockSettings);
  };

  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_config')
        .select('*')
        .order('provider_name');

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const validateSettings = () => {
    const newErrors: any = {};

    if (!practiceSettings.email_from_address) {
      newErrors.email_from_address = 'From email is required';
    } else if (!/\S+@\S+\.\S+/.test(practiceSettings.email_from_address)) {
      newErrors.email_from_address = 'Invalid email format';
    }

    if (!practiceSettings.email_from_name) {
      newErrors.email_from_name = 'From name is required';
    }

    if (practiceSettings.email_reply_to_address && !/\S+@\S+\.\S+/.test(practiceSettings.email_reply_to_address)) {
      newErrors.email_reply_to_address = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveSettings = async () => {
    if (!validateSettings()) return;

    setIsSaving(true);
    try {
      // In real app, save to practices table
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProviderToggle = async (providerId: string, field: 'is_active' | 'is_default_sms_provider' | 'is_default_email_provider') => {
    try {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return;

      // If setting as default, unset other defaults
      if (field === 'is_default_sms_provider' || field === 'is_default_email_provider') {
        const updates = providers.map(p => ({
          ...p,
          [field]: p.id === providerId ? true : false
        }));
        setProviders(updates);
      } else {
        const updates = providers.map(p => 
          p.id === providerId ? { ...p, [field]: !p[field] } : p
        );
        setProviders(updates);
      }

      // In real app, update database
      const { error } = await supabase
        .from('provider_config')
        .update({ [field]: !provider[field] })
        .eq('id', providerId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating provider:', error);
    }
  };

  const tabs = [
    { id: 'practice', label: 'Practice Settings', icon: Building },
    { id: 'providers', label: 'Providers', icon: Key, superAdminOnly: true },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Communication Settings</h1>
        <p className="text-gray-600 mt-1">Configure your messaging preferences and providers</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {tabs
            .filter(tab => !tab.superAdminOnly || userRole === 'super_admin')
            .map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'text-primary-600 border-primary-600'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl">
        {activeTab === 'practice' && (
          <div className="space-y-6">
            {/* Email Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900">Email Settings</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email Address
                  </label>
                  <input
                    type="email"
                    value={practiceSettings.email_from_address}
                    onChange={(e) => setPracticeSettings({ ...practiceSettings, email_from_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="noreply@example.com"
                  />
                  {errors.email_from_address && (
                    <p className="text-red-500 text-sm mt-1">{errors.email_from_address}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={practiceSettings.email_from_name}
                    onChange={(e) => setPracticeSettings({ ...practiceSettings, email_from_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Your Clinic Name"
                  />
                  {errors.email_from_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.email_from_name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reply-To Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={practiceSettings.email_reply_to_address}
                    onChange={(e) => setPracticeSettings({ ...practiceSettings, email_reply_to_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="support@example.com"
                  />
                  {errors.email_reply_to_address && (
                    <p className="text-red-500 text-sm mt-1">{errors.email_reply_to_address}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Email Limit
                  </label>
                  <input
                    type="number"
                    value={practiceSettings.email_daily_limit}
                    onChange={(e) => setPracticeSettings({ ...practiceSettings, email_daily_limit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* SMS Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-900">SMS Settings</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sender ID
                  </label>
                  <input
                    type="text"
                    value={practiceSettings.sms_sender_id}
                    onChange={(e) => setPracticeSettings({ ...practiceSettings, sms_sender_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="YourClinic"
                    maxLength={11}
                  />
                  <p className="text-xs text-gray-500 mt-1">Max 11 alphanumeric characters</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily SMS Limit
                  </label>
                  <input
                    type="number"
                    value={practiceSettings.sms_daily_limit}
                    onChange={(e) => setPracticeSettings({ ...practiceSettings, sms_daily_limit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={practiceSettings.enable_sms_replies}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, enable_sms_replies: e.target.checked })}
                      className="rounded border-gray-300 text-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Enable SMS replies (incoming messages)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* General Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value={practiceSettings.timezone}
                    onChange={(e) => setPracticeSettings({ ...practiceSettings, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Africa/Windhoek">Africa/Windhoek (GMT+2)</option>
                    <option value="Africa/Johannesburg">Africa/Johannesburg (GMT+2)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Working Hours
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={practiceSettings.working_hours_start}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, working_hours_start: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={practiceSettings.working_hours_end}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, working_hours_end: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notification Email
                  </label>
                  <input
                    type="email"
                    value={practiceSettings.notification_email}
                    onChange={(e) => setPracticeSettings({ ...practiceSettings, notification_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="admin@example.com"
                  />
                </div>
                
                <div>
                  <label className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={practiceSettings.enable_auto_responses}
                      onChange={(e) => setPracticeSettings({ ...practiceSettings, enable_auto_responses: e.target.checked })}
                      className="rounded border-gray-300 text-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Enable auto-responses outside working hours
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between">
              {saveMessage && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-2 text-sm ${
                    saveMessage.includes('success') ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {saveMessage.includes('success') ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {saveMessage}
                </motion.div>
              )}
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="ml-auto bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </motion.button>
            </div>
          </div>
        )}

        {activeTab === 'providers' && userRole === 'super_admin' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Super Admin Access Required</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Only super administrators can configure messaging providers. Changes here affect all practices.
                  </p>
                </div>
              </div>
            </div>

            {providers.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                <Key className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No providers configured</p>
                <button className="mt-3 text-primary-600 hover:text-primary-700">
                  Add your first provider
                </button>
              </div>
            ) : (
              providers.map((provider) => (
                <div key={provider.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{provider.provider_name}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {provider.provider_name.includes('SMS') ? 'SMS Provider' : 'Email Provider'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={provider.is_active}
                        onChange={() => handleProviderToggle(provider.id, 'is_active')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">API Key</p>
                        <p className="font-mono text-xs text-gray-700">••••••••••••{provider.api_key?.slice(-4) || '••••'}</p>
                      </div>
                      {provider.api_secret && (
                        <div>
                          <p className="text-gray-500">API Secret</p>
                          <p className="font-mono text-xs text-gray-700">••••••••••••{provider.api_secret.slice(-4)}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4">
                      {provider.provider_name.includes('SMS') && (
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="default_sms"
                            checked={provider.is_default_sms_provider}
                            onChange={() => handleProviderToggle(provider.id, 'is_default_sms_provider')}
                            className="text-primary-500"
                          />
                          <span className="text-sm text-gray-700">Default SMS Provider</span>
                        </label>
                      )}
                      
                      {provider.provider_name.includes('Email') && (
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="default_email"
                            checked={provider.is_default_email_provider}
                            onChange={() => handleProviderToggle(provider.id, 'is_default_email_provider')}
                            className="text-primary-500"
                          />
                          <span className="text-sm text-gray-700">Default Email Provider</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
            </div>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-gray-300 text-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Failed Message Alerts</p>
                    <p className="text-xs text-gray-500">Get notified when messages fail to deliver</p>
                  </div>
                </div>
              </label>
              
              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-gray-300 text-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Daily Summary</p>
                    <p className="text-xs text-gray-500">Receive daily communication analytics</p>
                  </div>
                </div>
              </label>
              
              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Low Balance Alerts</p>
                    <p className="text-xs text-gray-500">Alert when SMS/Email credits are low</p>
                  </div>
                </div>
              </label>
              
              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-gray-300 text-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Incoming Message Alerts</p>
                    <p className="text-xs text-gray-500">Get notified of new patient messages</p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;