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
  Check,
  Phone,
  TestTube,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Send,
  Calendar,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { defaultSMSService, SMSPortalService } from '../../services/smsPortal';
import { toast } from 'react-hot-toast';

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
  const [activeTab, setActiveTab] = useState<'practice' | 'providers' | 'notifications' | 'reminders'>('practice');
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
  const [showCredentials, setShowCredentials] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  const { user } = useAuthStore();

  // Mock user role - in real app, get from auth context
  const userRole = 'admin' as 'admin' | 'super_admin';

  useEffect(() => {
    fetchSettings();
    if (userRole === 'super_admin') {
      fetchProviders();
    }
    checkSMSBalance();
  }, []);

  const checkSMSBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const result = await defaultSMSService.getBalance();
      if (result.success && result.credits !== undefined) {
        setSmsBalance(result.credits);
      }
    } catch (error) {
      console.error('Error checking balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const testSMSConnection = async () => {
    if (!testPhoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    try {
      toast.loading('Sending test SMS...', { id: 'test-sms' });
      
      const result = await defaultSMSService.sendSMS({
        to: testPhoneNumber,
        content: 'Test message from HPMS. Your SMS reminders are configured correctly!',
        reference: 'test-connection'
      });

      if (result.success) {
        toast.success(`Test SMS sent successfully!`, { id: 'test-sms' });
        checkSMSBalance(); // Refresh balance
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('SMS test failed: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'test-sms' });
    }
  };

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
    { id: 'providers', label: 'SMS/Email Providers', icon: Key },
    { id: 'reminders', label: 'Appointment Reminders', icon: Calendar },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Communication Settings</h1>
        <p className="text-gray-600 mt-1">Configure your messaging preferences and providers</p>
      </div>

      {/* SMS Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 bg-gradient-to-r from-[#01b9d5] to-purple-600 rounded-xl p-4 text-white"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="h-6 w-6" />
            <div>
              <p className="text-sm opacity-90">SMS Credits Balance</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">
                  {isLoadingBalance ? (
                    <RefreshCw className="h-5 w-5 animate-spin inline" />
                  ) : smsBalance !== null ? (
                    smsBalance.toLocaleString()
                  ) : (
                    'N/A'
                  )}
                </p>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">DEMO</span>
              </div>
            </div>
          </div>
          <button
            onClick={checkSMSBalance}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            disabled={isLoadingBalance}
          >
            <RefreshCw className={`h-5 w-5 ${isLoadingBalance ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
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
                
                {/* SMS Test Section */}
                <div className="md:col-span-2 mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <TestTube className="h-5 w-5 text-blue-600" />
                    <input
                      type="tel"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                      placeholder="Enter phone number to test (e.g., +264811234567)"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <button
                      onClick={testSMSConnection}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Send Test SMS
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">Test your SMS configuration with your own phone number</p>
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

        {activeTab === 'providers' && (
          <div className="space-y-6">
            {/* SMS Portal Configuration */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-[#01b9d5]" />
                  <h3 className="text-lg font-semibold text-gray-900">SMS Portal Configuration</h3>
                </div>
                <span className="text-sm text-green-600 font-medium">✓ Active</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider
                    </label>
                    <select
                      value="smsportal"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      disabled
                    >
                      <option value="smsportal">SMS Portal</option>
                      <option value="twilio" disabled>Twilio (Coming Soon)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Credentials
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCredentials(!showCredentials)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 
                          rounded-lg hover:bg-gray-50"
                      >
                        {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showCredentials ? 'Hide' : 'Show'} Credentials
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `Client ID: 7c193f5e-c862-43be-baa9-73e45e676e74\n` +
                            `API Secret: db3defe7-b01e-4983-b28d-88f228c16301`
                          );
                          toast.success('Credentials copied to clipboard');
                        }}
                        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {showCredentials && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client ID
                      </label>
                      <input
                        type="text"
                        value="7c193f5e-c862-43be-baa9-73e45e676e74"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-100"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Secret
                      </label>
                      <input
                        type="password"
                        value="db3defe7-b01e-4983-b28d-88f228c16301"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-100"
                        readOnly
                      />
                    </div>
                  </motion.div>
                )}

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">SMS Portal Demo Mode</h4>
                      <p className="text-sm text-blue-800 mt-1">
                        Currently running in demo mode for your number (+264812222331). 
                        The system will simulate successful SMS sending for testing purposes.
                      </p>
                      <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                        <h5 className="text-xs font-medium text-blue-900 mb-1">To enable live SMS Portal:</h5>
                        <ol className="text-xs text-blue-700 space-y-1">
                          <li>1. Contact SMS Portal support to verify your credentials</li>
                          <li>2. Ensure your account has sufficient credits</li>
                          <li>3. Check if your IP address is whitelisted</li>
                          <li>4. Verify the REST API endpoint is correct</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Provider (Placeholder) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 opacity-60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900">Email Provider</h3>
                </div>
                <span className="text-sm text-gray-500">Coming Soon</span>
              </div>
              <p className="text-gray-500">Email provider integration will be available in a future update.</p>
            </div>

          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#01b9d5]" />
                <h3 className="text-lg font-semibold text-gray-900">Appointment Reminder Settings</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer 
                  peer-checked:after:translate-x-full peer-checked:after:border-white 
                  after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                  after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all 
                  peer-checked:bg-[#01b9d5]">
                </div>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Reminder Timing
                </label>
                <div className="space-y-2">
                  {[
                    { value: '24h', label: '24 hours before', checked: true },
                    { value: '12h', label: '12 hours before', checked: false },
                    { value: '6h', label: '6 hours before', checked: false },
                    { value: '2h', label: '2 hours before', checked: true },
                    { value: '1h', label: '1 hour before', checked: false },
                    { value: '30m', label: '30 minutes before', checked: false }
                  ].map(option => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="checkbox"
                        defaultChecked={option.checked}
                        className="w-4 h-4 text-[#01b9d5] rounded focus:ring-[#01b9d5]"
                      />
                      <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="business-hours"
                  defaultChecked
                  className="w-4 h-4 text-[#01b9d5] rounded focus:ring-[#01b9d5]"
                />
                <label htmlFor="business-hours" className="ml-2 text-sm text-gray-700">
                  Send reminders during business hours only (8am - 5pm)
                </label>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">How it works</h4>
                    <ul className="mt-2 space-y-1 text-sm text-blue-800">
                      <li>• Reminders are sent automatically based on your timing preferences</li>
                      <li>• Patients can opt-out of reminders at any time</li>
                      <li>• SMS reminders require SMS provider configuration</li>
                      <li>• Failed reminders are retried up to 3 times</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
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
              
              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-gray-300 text-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Appointment Reminders Sent</p>
                    <p className="text-xs text-gray-500">Confirmation when reminders are sent successfully</p>
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