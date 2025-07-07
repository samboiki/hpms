import React, { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Phone,
  Mail,
  Settings,
  Save,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  TestTube,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { communicationService } from '../../services/communicationService';
import Button from '../ui/Button';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

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

interface NotificationSettings {
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
}

const ReminderSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    sms: {
      enabled: false,
      provider: 'smsportal',
      credentials: {}
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
  });
  
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReminderTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  
  const { user } = useAuthStore();

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
  }, [user?.practice_id]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('practices')
        .select('notification_settings')
        .eq('id', user?.practice_id)
        .single();

      if (error) throw error;
      
      if (data?.notification_settings) {
        setSettings(data.notification_settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
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

  const saveSettings = async () => {
    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('practices')
        .update({ notification_settings: settings })
        .eq('id', user?.practice_id);

      if (error) throw error;
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
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
      const practiceId = user?.practice_id || localStorage.getItem('currentPracticeId');
      
      if (!practiceId) {
        throw new Error('Practice ID not found');
      }

      // Check subscription status first
      const subscriptionStatus = await communicationService.checkSubscriptionStatus(practiceId as string);
      
      if (!subscriptionStatus.sms.active) {
        throw new Error('No active SMS subscription');
      }

      const result = await communicationService.sendSMS({
        practiceId: practiceId as string,
        recipientPhone: testPhoneNumber,
        messageContent: 'Test message from HPMS. Your SMS reminders are configured correctly!',
        messageType: 'system',
        metadata: {
          source: 'ReminderSettings_TestConnection',
          sentBy: user?.email || 'Unknown'
        }
      });

      if (result.success) {
        toast.success(`Test SMS sent successfully! Credits remaining: ${subscriptionStatus.sms.remaining}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('SMS test failed:', error);
      toast.error('SMS test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleTemplateSubmit = async (template: Partial<ReminderTemplate>) => {
    try {
      if (selectedTemplate) {
        // Update existing template
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
        // Create new template
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
    appointment_reminder: { label: 'Appointment Reminder', icon: Bell },
    waitlist_notification: { label: 'Waitlist Notification', icon: Users },
    check_in: { label: 'Check-in Reminder', icon: CheckCircle }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-[#01b9d5]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SMS Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-[#01b9d5]" />
              SMS Configuration
            </CardTitle>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.sms.enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  sms: { ...settings.sms, enabled: e.target.checked }
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMS Provider
              </label>
              <select
                value={settings.sms.provider}
                onChange={(e) => setSettings({
                  ...settings,
                  sms: { ...settings.sms, provider: e.target.value }
                })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                disabled={!settings.sms.enabled}
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
                  disabled={!settings.sms.enabled}
                >
                  {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showCredentials ? 'Hide' : 'Show'} Credentials
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Client ID: ${settings.sms.credentials.clientId || 'Not set'}\n` +
                      `API Secret: ${settings.sms.credentials.apiSecret || 'Not set'}`
                    );
                    toast.success('Credentials copied to clipboard');
                  }}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={!settings.sms.enabled}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {showCredentials && settings.sms.enabled && (
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
                  value={settings.sms.credentials.clientId || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    sms: {
                      ...settings.sms,
                      credentials: { ...settings.sms.credentials, clientId: e.target.value }
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
                  value={settings.sms.credentials.apiSecret || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    sms: {
                      ...settings.sms,
                      credentials: { ...settings.sms.credentials, apiSecret: e.target.value }
                    }
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Enter SMS Portal API Secret"
                />
              </div>
            </motion.div>
          )}

          {settings.sms.enabled && (
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
              <TestTube className="h-5 w-5 text-blue-600" />
              <input
                type="tel"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                placeholder="Enter phone number to test"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
              />
              <Button
                onClick={testSMSConnection}
                size="sm"
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Send Test SMS
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminder Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#01b9d5]" />
              Reminder Settings
            </CardTitle>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reminders.enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  reminders: { ...settings.reminders, enabled: e.target.checked }
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Reminder Timing
            </label>
            <div className="space-y-2">
              {timingOptions.map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.reminders.default_timing.includes(option.value)}
                    onChange={(e) => {
                      const timing = e.target.checked
                        ? [...settings.reminders.default_timing, option.value]
                        : settings.reminders.default_timing.filter(t => t !== option.value);
                      setSettings({
                        ...settings,
                        reminders: { ...settings.reminders, default_timing: timing }
                      });
                    }}
                    className="w-4 h-4 text-[#01b9d5] rounded focus:ring-[#01b9d5]"
                    disabled={!settings.reminders.enabled}
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
              checked={settings.reminders.business_hours_only}
              onChange={(e) => setSettings({
                ...settings,
                reminders: { ...settings.reminders, business_hours_only: e.target.checked }
              })}
              className="w-4 h-4 text-[#01b9d5] rounded focus:ring-[#01b9d5]"
              disabled={!settings.reminders.enabled}
            />
            <label htmlFor="business-hours" className="ml-2 text-sm text-gray-700">
              Send reminders during business hours only (8am - 5pm)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#01b9d5]" />
              Message Templates
            </CardTitle>
            <Button
              onClick={() => {
                setSelectedTemplate(null);
                setIsTemplateModalOpen(true);
              }}
              size="sm"
              className="bg-[#01b9d5] text-white hover:bg-[#0196be]"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveSettings}
          disabled={isSaving}
          className="bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white"
        >
          {isSaving ? (
            <>
              <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
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
            <p className="text-xs text-gray-500 mt-1">
              Character count: {formData.content?.length || 0} / 160 (1 SMS)
            </p>
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(formData)}
            className="bg-[#01b9d5] text-white hover:bg-[#0196be]"
          >
            {template ? 'Update' : 'Create'} Template
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ReminderSettings;