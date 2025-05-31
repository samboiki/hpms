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
  Calendar,
  Repeat,
  TestTube,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Users,
  Sparkles,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { defaultSMSService, SMSPortalService } from '../../services/smsPortal';
import { toast } from 'react-hot-toast';

interface PracticeSettings {
  // Basic settings
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
  
  // Enhanced notification settings
  notification_settings?: {
    sms: {
      enabled: boolean;
      provider: string;
      credentials: {
        clientId?: string;
        apiSecret?: string;
      };
    };
    email: {
      enabled: boolean;
      provider: string | null;
      credentials: Record<string, any>;
    };
    reminders: {
      enabled: boolean;
      default_timing: string[];
      business_hours_only: boolean;
      templates: Record<string, any>;
    };
  };
}

interface ReminderTemplate {
  id: string;
  name: string;
  type: 'appointment_reminder' | 'waitlist_notification' | 'check_in';
  channel: 'sms' | 'email' | 'both';
  timing?: string;
  subject?: string;
  content: string;
  variables: Record<string, string>;
  is_active: boolean;
}

const EnhancedSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'practice' | 'providers' | 'notifications' | 'reminders' | 'templates'>('practice');
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
    email_daily_limit: 5000,
    notification_settings: {
      sms: {
        enabled: false,
        provider: 'smsportal',
        credentials: {
          clientId: '7c193f5e-c862-43be-baa9-73e45e676e74',
          apiSecret: 'db3defe7-b01e-4983-b28d-88f228c16301'
        }
      },
      email: {
        enabled: false,
        provider: null,
        credentials: {}
      },
      reminders: {
        enabled: true,
        default_timing: ['24h', '2h'],
        business_hours_only: true,
        templates: {}
      }
    }
  });
  
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [showCredentials, setShowCredentials] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ReminderTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  
  const { user } = useAuthStore();

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
    checkSMSBalance();
  }, [user?.practice_id]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('practices')
        .select('*')
        .eq('id', user?.practice_id)
        .single();

      if (error) throw error;
      
      if (data) {
        setPracticeSettings({
          ...data,
          notification_settings: data.notification_settings || practiceSettings.notification_settings
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('reminder_templates')
        .select('*')
        .eq('practice_id', user?.practice_id)
        .order('type', { ascending: true });

      if (error) throw error;
      
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const checkSMSBalance = async () => {
    if (!practiceSettings.notification_settings?.sms?.enabled) return;
    
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
      const { error } = await supabase
        .from('practices')
        .update({
          sms_sender_id: practiceSettings.sms_sender_id,
          email_from_address: practiceSettings.email_from_address,
          email_from_name: practiceSettings.email_from_name,
          email_reply_to_address: practiceSettings.email_reply_to_address,
          notification_email: practiceSettings.notification_email,
          timezone: practiceSettings.timezone,
          working_hours_start: practiceSettings.working_hours_start,
          working_hours_end: practiceSettings.working_hours_end,
          enable_sms_replies: practiceSettings.enable_sms_replies,
          enable_auto_responses: practiceSettings.enable_auto_responses,
          sms_daily_limit: practiceSettings.sms_daily_limit,
          email_daily_limit: practiceSettings.email_daily_limit,
          notification_settings: practiceSettings.notification_settings
        })
        .eq('id', user?.practice_id);

      if (error) throw error;
      
      setSaveMessage('Settings saved successfully!');
      toast.success('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
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

  const handleTemplateSubmit = async (template: Partial<ReminderTemplate>) => {
    try {
      if (selectedTemplate) {
        const { error } = await supabase
          .from('reminder_templates')
          .update({
            ...template,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTemplate.id);

        if (error) throw error;
        toast.success('Template updated successfully');
      } else {
        const { error } = await supabase
          .from('reminder_templates')
          .insert({
            ...template,
            practice_id: user?.practice_id
          });

        if (error) throw error;
        toast.success('Template created successfully');
      }

      setIsTemplateModalOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('reminder_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const timingOptions = [
    { value: '24h', label: '24 hours before' },
    { value: '12h', label: '12 hours before' },
    { value: '6h', label: '6 hours before' },
    { value: '2h', label: '2 hours before' },
    { value: '1h', label: '1 hour before' },
    { value: '30m', label: '30 minutes before' }
  ];

  const templateTypes = {
    appointment_reminder: { label: 'Appointment Reminder', icon: Bell, color: 'blue' },
    waitlist_notification: { label: 'Waitlist Notification', icon: Users, color: 'purple' },
    check_in: { label: 'Check-in Reminder', icon: Check, color: 'green' }
  };

  const tabs = [
    { id: 'practice', label: 'Practice Settings', icon: Building },
    { id: 'providers', label: 'SMS/Email Providers', icon: Key },
    { id: 'reminders', label: 'Appointment Reminders', icon: Calendar },
    { id: 'templates', label: 'Message Templates', icon: MessageSquare },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Communication Settings</h1>
        <p className="text-gray-600 mt-1">Configure messaging, reminders, and notification preferences</p>
      </div>

      {/* SMS Balance Card */}
      {practiceSettings.notification_settings?.sms?.enabled && (
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
                <p className="text-2xl font-bold">
                  {isLoadingBalance ? (
                    <RefreshCw className="h-5 w-5 animate-spin inline" />
                  ) : smsBalance !== null ? (
                    smsBalance.toLocaleString()
                  ) : (
                    'N/A'
                  )}
                </p>
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
      )}

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
      <div className="max-w-5xl">
        <AnimatePresence mode="wait">
          {activeTab === 'practice' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={practiceSettings.working_hours_end}
                        onChange={(e) => setPracticeSettings({ ...practiceSettings, working_hours_end: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01b9d5]"
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
            </motion.div>
          )}

          {activeTab === 'providers' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* SMS Provider Configuration */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-[#01b9d5]" />
                    <h3 className="text-lg font-semibold text-gray-900">SMS Portal Configuration</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={practiceSettings.notification_settings?.sms?.enabled || false}
                      onChange={(e) => setPracticeSettings({
                        ...practiceSettings,
                        notification_settings: {
                          ...practiceSettings.notification_settings!,
                          sms: { ...practiceSettings.notification_settings!.sms, enabled: e.target.checked }
                        }
                      })}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SMS Provider
                      </label>
                      <select
                        value={practiceSettings.notification_settings?.sms?.provider || 'smsportal'}
                        onChange={(e) => setPracticeSettings({
                          ...practiceSettings,
                          notification_settings: {
                            ...practiceSettings.notification_settings!,
                            sms: { ...practiceSettings.notification_settings!.sms, provider: e.target.value }
                          }
                        })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        disabled={!practiceSettings.notification_settings?.sms?.enabled}
                      >
                        <option value="smsportal">SMS Portal</option>
                        <option value="twilio" disabled>Twilio (Coming Soon)</option>
                        <option value="africastalking" disabled>Africa's Talking (Coming Soon)</option>
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
                          disabled={!practiceSettings.notification_settings?.sms?.enabled}
                        >
                          {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showCredentials ? 'Hide' : 'Show'} Credentials
                        </button>
                        <button
                          onClick={() => {
                            const credentials = practiceSettings.notification_settings?.sms?.credentials;
                            if (credentials) {
                              navigator.clipboard.writeText(
                                `Client ID: ${credentials.clientId || 'Not set'}\n` +
                                `API Secret: ${credentials.apiSecret || 'Not set'}`
                              );
                              toast.success('Credentials copied to clipboard');
                            }
                          }}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          disabled={!practiceSettings.notification_settings?.sms?.enabled}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {showCredentials && practiceSettings.notification_settings?.sms?.enabled && (
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
                          value={practiceSettings.notification_settings?.sms?.credentials?.clientId || ''}
                          onChange={(e) => setPracticeSettings({
                            ...practiceSettings,
                            notification_settings: {
                              ...practiceSettings.notification_settings!,
                              sms: {
                                ...practiceSettings.notification_settings!.sms,
                                credentials: { 
                                  ...practiceSettings.notification_settings!.sms.credentials, 
                                  clientId: e.target.value 
                                }
                              }
                            }
                          })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Enter SMS Portal Client ID"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          API Secret
                        </label>
                        <input
                          type="password"
                          value={practiceSettings.notification_settings?.sms?.credentials?.apiSecret || ''}
                          onChange={(e) => setPracticeSettings({
                            ...practiceSettings,
                            notification_settings: {
                              ...practiceSettings.notification_settings!,
                              sms: {
                                ...practiceSettings.notification_settings!.sms,
                                credentials: { 
                                  ...practiceSettings.notification_settings!.sms.credentials, 
                                  apiSecret: e.target.value 
                                }
                              }
                            }
                          })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Enter SMS Portal API Secret"
                        />
                      </div>
                    </motion.div>
                  )}

                  {practiceSettings.notification_settings?.sms?.enabled && (
                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
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
                  )}
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
            </motion.div>
          )}

          {activeTab === 'reminders' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-[#01b9d5]" />
                    <h3 className="text-lg font-semibold text-gray-900">Appointment Reminder Settings</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={practiceSettings.notification_settings?.reminders?.enabled || false}
                      onChange={(e) => setPracticeSettings({
                        ...practiceSettings,
                        notification_settings: {
                          ...practiceSettings.notification_settings!,
                          reminders: { 
                            ...practiceSettings.notification_settings!.reminders, 
                            enabled: e.target.checked 
                          }
                        }
                      })}
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
                      {timingOptions.map(option => (
                        <label key={option.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={practiceSettings.notification_settings?.reminders?.default_timing?.includes(option.value) || false}
                            onChange={(e) => {
                              const currentTiming = practiceSettings.notification_settings?.reminders?.default_timing || [];
                              const newTiming = e.target.checked
                                ? [...currentTiming, option.value]
                                : currentTiming.filter(t => t !== option.value);
                              setPracticeSettings({
                                ...practiceSettings,
                                notification_settings: {
                                  ...practiceSettings.notification_settings!,
                                  reminders: { 
                                    ...practiceSettings.notification_settings!.reminders, 
                                    default_timing: newTiming 
                                  }
                                }
                              });
                            }}
                            className="w-4 h-4 text-[#01b9d5] rounded focus:ring-[#01b9d5]"
                            disabled={!practiceSettings.notification_settings?.reminders?.enabled}
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
                      checked={practiceSettings.notification_settings?.reminders?.business_hours_only || false}
                      onChange={(e) => setPracticeSettings({
                        ...practiceSettings,
                        notification_settings: {
                          ...practiceSettings.notification_settings!,
                          reminders: { 
                            ...practiceSettings.notification_settings!.reminders, 
                            business_hours_only: e.target.checked 
                          }
                        }
                      })}
                      className="w-4 h-4 text-[#01b9d5] rounded focus:ring-[#01b9d5]"
                      disabled={!practiceSettings.notification_settings?.reminders?.enabled}
                    />
                    <label htmlFor="business-hours" className="ml-2 text-sm text-gray-700">
                      Send reminders during business hours only (8am - 5pm)
                    </label>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
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
            </motion.div>
          )}

          {activeTab === 'templates' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#01b9d5]" />
                    <h3 className="text-lg font-semibold text-gray-900">Message Templates</h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setIsTemplateModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#01b9d5] text-white rounded-lg hover:bg-[#0196be] flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Template
                  </button>
                </div>

                <div className="space-y-3">
                  {templates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No templates created yet</p>
                      <p className="text-sm mt-1">Create templates for appointment reminders and notifications</p>
                    </div>
                  ) : (
                    templates.map(template => {
                      const typeConfig = templateTypes[template.type];
                      const Icon = typeConfig.icon;
                      
                      return (
                        <motion.div
                          key={template.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${
                                  template.is_active ? 'bg-green-100' : 'bg-gray-100'
                                }`}>
                                  <Icon className={`h-5 w-5 ${
                                    template.is_active ? 'text-green-600' : 'text-gray-600'
                                  }`} />
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                                  <p className="text-sm text-gray-500">
                                    {typeConfig.label} • {template.channel.toUpperCase()}
                                    {template.timing && ` • ${template.timing}`}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{template.content}</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.keys(template.variables).map(variable => (
                                  <span
                                    key={variable}
                                    className="text-xs px-2 py-1 bg-gray-100 rounded-full"
                                  >
                                    {`{{${variable}}}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setIsTemplateModalOpen(true);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <Edit2 className="h-4 w-4 text-gray-600" />
                              </button>
                              <button
                                onClick={() => deleteTemplate(template.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save Button */}
        <div className="mt-6 flex items-center justify-between">
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
            className="ml-auto bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white px-6 py-3 rounded-lg 
              hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
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

      {/* Template Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <TemplateModal
            template={selectedTemplate}
            onSubmit={handleTemplateSubmit}
            onClose={() => {
              setIsTemplateModalOpen(false);
              setSelectedTemplate(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Template Modal Component
const TemplateModal: React.FC<{
  template: ReminderTemplate | null;
  onSubmit: (template: Partial<ReminderTemplate>) => void;
  onClose: () => void;
}> = ({ template, onSubmit, onClose }) => {
  const [formData, setFormData] = useState<Partial<ReminderTemplate>>(
    template || {
      name: '',
      type: 'appointment_reminder',
      channel: 'sms',
      timing: '24h',
      content: '',
      variables: {},
      is_active: true
    }
  );

  const availableVariables = {
    appointment_reminder: [
      'patient_name',
      'doctor_name',
      'appointment_date',
      'appointment_time',
      'practice_name'
    ],
    waitlist_notification: [
      'patient_name',
      'doctor_name',
      'date',
      'time'
    ],
    check_in: [
      'patient_name',
      'appointment_time',
      'check_in_url'
    ]
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {template ? 'Edit Template' : 'Create Template'}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="e.g., 24 Hour SMS Reminder"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  type: e.target.value as ReminderTemplate['type'] 
                })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="appointment_reminder">Appointment Reminder</option>
                <option value="waitlist_notification">Waitlist Notification</option>
                <option value="check_in">Check-in Reminder</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel
              </label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  channel: e.target.value as ReminderTemplate['channel'] 
                })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="sms">SMS</option>
                <option value="email" disabled>Email (Coming Soon)</option>
                <option value="both" disabled>Both (Coming Soon)</option>
              </select>
            </div>
          </div>

          {formData.type === 'appointment_reminder' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timing
              </label>
              <select
                value={formData.timing}
                onChange={(e) => setFormData({ ...formData, timing: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="24h">24 hours before</option>
                <option value="12h">12 hours before</option>
                <option value="6h">6 hours before</option>
                <option value="2h">2 hours before</option>
                <option value="1h">1 hour before</option>
                <option value="30m">30 minutes before</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message Content
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Enter your message template..."
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Character count: {formData.content?.length || 0} / 160 (1 SMS)
              </p>
              {(formData.content?.length || 0) > 160 && (
                <p className="text-xs text-orange-600">
                  Will use {Math.ceil((formData.content?.length || 0) / 153)} SMS messages
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Variables
            </label>
            <div className="flex flex-wrap gap-2">
              {availableVariables[formData.type as keyof typeof availableVariables]?.map(variable => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => {
                    const newContent = (formData.content || '') + ` {{${variable}}}`;
                    setFormData({ ...formData, content: newContent });
                  }}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 
                    rounded-full transition-colors"
                >
                  <Plus className="h-3 w-3 inline mr-1" />
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is-active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-[#01b9d5] rounded"
            />
            <label htmlFor="is-active" className="ml-2 text-sm text-gray-700">
              Template is active
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(formData)}
            className="px-4 py-2 bg-[#01b9d5] text-white rounded-lg hover:bg-[#0196be]"
          >
            {template ? 'Update' : 'Create'} Template
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EnhancedSettings;