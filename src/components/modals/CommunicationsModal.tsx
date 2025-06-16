import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Settings, 
  Zap, 
  BarChart3,
  Inbox,
  History,
  Sparkles,
  MessageSquare,
  Mail,
  Phone,
  CheckCircle,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Clock,
  Target,
  Bell,
  FileText,
  Plus,
  ChevronRight,
  Eye,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Heart,
  UserPlus,
  Activity,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { usePracticeSettings } from '../../hooks/usePracticeSettings';
import { format, startOfDay, endOfDay } from 'date-fns';
import './CommunicationsModal.css';

// Import existing components
import Compose from '../messages/Compose';
import SmartAutomations from '../messages/SmartAutomations';
import CommunicationHistory from '../messages/CommunicationHistory';
import EmailTemplatePreview from '../messages/EmailTemplatePreview';
import EmailTemplatePreviews from '../messages/EmailTemplatePreviews';
import { professionalEmailTemplates } from '../messages/EmailTemplates';

interface CommunicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'dashboard' | 'compose' | 'automations' | 'inbox' | 'settings' | 'analytics';

interface SMSStats {
  available: number;
  assigned: number;
  used: number;
  cost: number;
}

interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
}

interface CommunicationStats {
  sms: SMSStats;
  email: EmailStats;
  messagesOut: number;
  deliveryRate: number;
  engagementRate: number;
  activeAutomations: number;
}

const CommunicationsModal: React.FC<CommunicationsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const { settings: practiceSettings, loading: settingsLoading } = usePracticeSettings();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentPracticeData, setCurrentPracticeData] = useState<any>(null);
  const [stats, setStats] = useState<CommunicationStats>({
    sms: { available: 0, assigned: 0, used: 0, cost: 0 },
    email: { sent: 0, delivered: 0, opened: 0, failed: 0 },
    messagesOut: 0,
    deliveryRate: 0,
    engagementRate: 0,
    activeAutomations: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [dateRange, setDateRange] = useState<'30d' | '3m' | '6m' | '12m'>('30d');
  
  const toggleMaximize = () => {
    setIsMaximized(prev => !prev);
  };
  
  const [automationSettings, setAutomationSettings] = useState({
    appointmentReminders: { 
      enabled: false, 
      timing: ['24h', '2h'], 
      method: 'email',
      template: `Dear {{patientName}},

This is a friendly reminder about your upcoming appointment scheduled for {{appointmentDate}} at {{appointmentTime}} with Dr. {{doctorName}}.

APPOINTMENT DETAILS:
• Date: {{appointmentDate}}
• Time: {{appointmentTime}}
• Doctor: Dr. {{doctorName}}
• Location: {{practiceName}}

WHAT TO BRING:
• Valid ID document
• Medical aid card (if applicable)
• Any previous medical records
• List of current medications

Please arrive 15 minutes early for check-in. If you need to reschedule or cancel, please contact us as soon as possible at {{practicePhone}}.

We look forward to seeing you soon!

Best regards,
The {{practiceName}} Team`
    },
    birthdayMessages: { 
      enabled: false, 
      method: 'email',
      includeOffer: true,
      template: `Dear {{patientName}},

Happy Birthday! 🎉

On this special day, the entire team at {{practiceName}} wants to wish you a year filled with good health, happiness, and wonderful memories.

BIRTHDAY SPECIAL OFFER:
As our gift to you, we're offering 15% off your next preventive health screening or consultation.

This offer includes:
• 15% off comprehensive health check-up
• Complimentary wellness consultation
• Priority booking for the next 30 days

To book your appointment, simply call us at {{practicePhone}} or visit {{practiceWebsite}}. Mention "Birthday2024" to receive your special discount.

Wishing you the happiest of birthdays and a healthy year ahead!

Warm regards,
The {{practiceName}} Team`
    },
    followUpCare: { 
      enabled: false, 
      timing: ['3d', '7d'], 
      method: 'sms',
      template: 'Hi {{patientName}}, we hope you\'re feeling better after your recent visit. Please remember to {{followUpInstructions}}. If you have any concerns, call us at {{practicePhone}}.'
    },
    paymentReminders: { 
      enabled: false, 
      sequence: ['7d', '14d', '30d'], 
      method: 'email',
      template: 'Dear {{patientName}}, this is a friendly reminder that your invoice #{{invoiceNumber}} of {{amount}} is due on {{dueDate}}. You can pay online at {{paymentLink}} or call us at {{practicePhone}}.'
    },
    invoiceDelivery: { 
      enabled: false, 
      method: 'email',
      timing: ['immediately'],
      template: `Dear {{patientName}},

Thank you for visiting {{practiceName}} on {{visitDate}}. We hope you had a positive experience with our healthcare services.

INVOICE DETAILS:
• Invoice Number: {{invoiceNumber}}
• Amount: {{amount}}
• Due Date: {{dueDate}}
• Service Date: {{visitDate}}

PAYMENT OPTIONS:
1. Online Payment (Recommended): {{paymentLink}}
2. Bank Transfer: Details provided in attached invoice
3. In-person: Visit our reception during business hours
4. Phone Payment: Call {{practicePhone}}

Your health is our priority, and we appreciate your trust in our services. If you have any questions about this invoice, please don't hesitate to contact our billing department.

Thank you for choosing {{practiceName}}.

Best regards,
{{practiceName}} Billing Department`
    },
    thankYouMessages: { 
      enabled: false, 
      timing: ['2h'], 
      method: 'sms',
      template: 'Thank you for visiting us today, {{patientName}}! Please follow these care instructions: {{careInstructions}}. If you have questions, call {{practicePhone}}.'
    },
    healthScreenings: {
      enabled: false,
      timing: ['annually', '6months'],
      method: 'email',
      template: 'Hi {{patientName}}, it\'s time for your regular health screening! Based on your age ({{patientAge}}) and medical history, we recommend scheduling: {{recommendedScreenings}}. Book online or call {{practicePhone}}.'
    },
    welcomeNewPatients: {
      enabled: false,
      timing: ['immediately'],
      method: 'email',
      template: 'Welcome to {{practiceName}}, {{patientName}}! We\'re excited to be part of your healthcare journey. Your patient portal is ready at {{portalLink}}. For appointments, call {{practicePhone}} or visit {{practiceWebsite}}.'
    }
  });

  // Get practice ID from logged-in user
  const practiceId = user?.practice_id;

  // Load current practice data
  useEffect(() => {
    const loadPracticeData = async () => {
      if (!practiceId) return;
      
      try {
        const { data: practice, error } = await supabase
          .from('practices')
          .select('*')
          .eq('id', practiceId)
          .single();
          
        if (error) throw error;
        setCurrentPracticeData(practice);
      } catch (error) {
        console.error('Error loading practice data:', error);
      }
    };
    
    if (practiceId) {
      loadPracticeData();
    }
  }, [practiceId]);

  useEffect(() => {
    if (isOpen && practiceId) {
      loadRecentMessages();
      loadAutomationSettings();
    }
  }, [isOpen, practiceId]);

  // Load communication stats only after practice settings are available
  useEffect(() => {
    if (isOpen && practiceId && practiceSettings && !settingsLoading) {
      loadCommunicationStats();
    }
  }, [isOpen, practiceId, practiceSettings, settingsLoading]);

  // Update available services count when automation settings change
  useEffect(() => {
    const totalAvailableServices = Object.keys(automationSettings).length; // Total number of services available
    setStats(prevStats => ({
      ...prevStats,
      activeAutomations: totalAvailableServices
    }));
  }, [automationSettings]);

  const loadCommunicationStats = async () => {
    try {
      setIsLoading(true);
      const today = new Date();
      const startOfToday = startOfDay(today).toISOString();
      const endOfToday = endOfDay(today).toISOString();

      console.log('📊 Loading communication stats for practice:', practiceId);
      console.log('🔧 Practice settings available:', !!practiceSettings);
      console.log('📱 SMS Limits - Available:', practiceSettings?.smsRemaining, 'Used:', practiceSettings?.smsUsed, 'Total:', practiceSettings?.smsLimit);
      console.log('📧 Email Limits - Available:', practiceSettings?.emailRemaining, 'Used:', practiceSettings?.emailUsed, 'Total:', practiceSettings?.emailLimit);

      // Load SMS usage
      const { data: smsUsage, error: smsError } = await supabase
        .from('sms_usage_logs')
        .select('*')
        .eq('practice_id', practiceId)
        .gte('sent_at', startOfToday)
        .lte('sent_at', endOfToday);

      if (smsError) {
        console.error('SMS usage error:', smsError);
      }

      // Load email stats
      const { data: emailStats, error: emailError } = await supabase
        .from('communications_log')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('type', 'EMAIL')
        .gte('created_at', startOfToday)
        .lte('created_at', endOfToday);

      if (emailError) {
        console.error('Email stats error:', emailError);
      }

      // Load overall communications
      const { data: allComms, error: allCommsError } = await supabase
        .from('communications_log')
        .select('*')
        .eq('practice_id', practiceId)
        .gte('created_at', startOfToday)
        .lte('created_at', endOfToday);

      if (allCommsError) {
        console.error('All communications error:', allCommsError);
      }

      // Use real practice settings for stats - ensure we have valid numbers
      const smsStats = {
        available: Math.max(0, practiceSettings?.smsRemaining || 0),
        assigned: Math.max(0, practiceSettings?.smsLimit || 0),
        used: Math.max(0, practiceSettings?.smsUsed || 0),
        cost: smsUsage?.reduce((sum: number, msg: any) => sum + (msg.cost || 0), 0) || 0
      };

      const emailStatsCalculated = {
        available: Math.max(0, practiceSettings?.emailRemaining || 0),
        assigned: Math.max(0, practiceSettings?.emailLimit || 0),
        used: Math.max(0, practiceSettings?.emailUsed || 0),
        delivered: emailStats?.filter((e: any) => e.status === 'SENT' || e.status === 'DELIVERED').length || 0,
        opened: emailStats?.filter((e: any) => e.opened_at).length || 0,
        failed: emailStats?.filter((e: any) => e.status === 'FAILED').length || 0
      };

      // Calculate available communication services (total number of services)
      const totalAvailableServices = Object.keys(automationSettings).length; // 8 services total

      console.log('📊 Final stats calculated:', {
        sms: smsStats,
        email: emailStatsCalculated,
        totalServices: totalAvailableServices
      });

      setStats({
        sms: smsStats,
        email: emailStatsCalculated,
        messagesOut: allComms?.length || 0,
        deliveryRate: allComms?.length > 0 ? 
          (allComms.filter((c: any) => c.status === 'SENT' || c.status === 'DELIVERED').length / allComms.length) * 100 : 0,
        engagementRate: 75, // Mock for now
        activeAutomations: totalAvailableServices
      });
    } catch (error) {
      console.error('Error loading communication stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentMessages = async () => {
    try {
      const { data } = await supabase
        .from('communications_log')
        .select(`
          *,
          patients (first_name, last_name)
        `)
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentMessages(data || []);
    } catch (error) {
      console.error('Error loading recent messages:', error);
    }
  };

  const loadAutomationSettings = async () => {
    try {
      const { data } = await supabase
        .from('practice_automation_settings')
        .select('*')
        .eq('practice_id', practiceId)
        .single();

      if (data) {
        setAutomationSettings(data.settings || automationSettings);
      }
    } catch (error) {
      console.error('Error loading automation settings:', error);
    }
  };

  const updateAutomationSetting = async (key: string, value: any) => {
    try {
      const newSettings = { ...automationSettings, [key]: value };
      setAutomationSettings(newSettings);

      const { error } = await supabase
        .from('practice_automation_settings')
        .upsert({
          practice_id: practiceId,
          settings: newSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating automation settings:', error);
    }
  };

  const renderServiceCard = (serviceKey: string, config: any) => {
    const service = automationSettings[serviceKey as keyof typeof automationSettings];
    const isExpanded = expandedService === serviceKey;
    const Icon = config.icon;
    
    const colorClasses = {
      blue: 'from-blue-500 to-blue-600 border-blue-200 bg-blue-50',
      pink: 'from-pink-500 to-pink-600 border-pink-200 bg-pink-50',
      green: 'from-green-500 to-green-600 border-green-200 bg-green-50',
      indigo: 'from-indigo-500 to-indigo-600 border-indigo-200 bg-indigo-50',
      emerald: 'from-emerald-500 to-emerald-600 border-emerald-200 bg-emerald-50',
      purple: 'from-purple-500 to-purple-600 border-purple-200 bg-purple-50',
      orange: 'from-orange-500 to-orange-600 border-orange-200 bg-orange-50',
      cyan: 'from-cyan-500 to-cyan-600 border-cyan-200 bg-cyan-50'
    };

    return (
      <motion.div
        key={serviceKey}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 communications-modal-card"
      >
        {/* Service Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[config.color as keyof typeof colorClasses].split(' ')[0]} ${colorClasses[config.color as keyof typeof colorClasses].split(' ')[1]} shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{config.title}</h3>
                <p className="text-gray-600 text-sm">{config.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {service.enabled && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  Active
                </span>
              )}
              
              {/* Premium Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={service.enabled}
                  onChange={(e) => {
                    updateAutomationSetting(serviceKey, {
                      ...service,
                      enabled: e.target.checked
                    });
                    if (e.target.checked && !isExpanded) {
                      setExpandedService(serviceKey);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-blue-600 shadow-lg"></div>
              </label>
              
              {service.enabled && (
                <button
                  onClick={() => setExpandedService(isExpanded ? null : serviceKey)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expanded Configuration */}
        <AnimatePresence>
          {service.enabled && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 space-y-6 bg-gray-50">
                {/* Delivery Method */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Delivery Methods
                  </label>
                  <div className="flex gap-3">
                    {['sms', 'email'].map((method) => (
                      <label key={method} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(service.method) ? service.method.includes(method) : service.method === method}
                          onChange={(e) => {
                            let newMethods;
                            const currentMethods = Array.isArray(service.method) ? service.method : [service.method];
                            
                            if (e.target.checked) {
                              newMethods = [...currentMethods, method];
                            } else {
                              newMethods = currentMethods.filter(m => m !== method);
                            }
                            
                            // Ensure at least one method is selected
                            if (newMethods.length === 0) {
                              newMethods = [method === 'sms' ? 'email' : 'sms'];
                            }
                            
                            updateAutomationSetting(serviceKey, {
                              ...service,
                              method: newMethods.length === 1 ? newMethods[0] : newMethods
                            });
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm font-medium">
                          {method === 'sms' ? <MessageSquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                          {method.toUpperCase()}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    You can select both methods to send via SMS and Email
                  </p>
                </div>

                {/* Timing Configuration */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Send Timing
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {config.timingOptions.map((option: any) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={service.timing?.includes(option.value)}
                          onChange={(e) => {
                            const currentTiming = service.timing || [];
                            const newTiming = e.target.checked
                              ? [...currentTiming, option.value]
                              : currentTiming.filter((t: string) => t !== option.value);
                            updateAutomationSetting(serviceKey, {
                              ...service,
                              timing: newTiming
                            });
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Message Template */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-gray-900">
                      Message Template ({Array.isArray(service.method) ? service.method.map(m => m.toUpperCase()).join(' & ') : service.method?.toUpperCase()})
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowEmailPreview(serviceKey)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Preview Email
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(service.template);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      value={service.template}
                      onChange={(e) => updateAutomationSetting(serviceKey, {
                        ...service,
                        template: e.target.value
                      })}
                      className="w-full h-32 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm leading-relaxed"
                      placeholder={`Enter your ${service.method} template...`}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                      {service.template?.length || 0} characters
                    </div>
                  </div>
                </div>

                {/* Available Variables */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Available Variables
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {config.variables.map((variable: string) => {
                      // Show preview values for variables with real practice data
                      const previewValue = {
                        '{{patientName}}': 'John Smith',
                        '{{practicePhone}}': currentPracticeData?.contact_phone || '+264 61 123 4567',
                        '{{practiceName}}': currentPracticeData?.name || 'Your Practice Name',
                        '{{practiceWebsite}}': currentPracticeData?.website_url || currentPracticeData?.domain || 'www.yourpractice.com',
                        '{{appointmentDate}}': 'March 15, 2024',
                        '{{appointmentTime}}': '2:30 PM',
                        '{{doctorName}}': 'Dr. Johnson',
                        '{{invoiceNumber}}': 'INV-2024-001',
                        '{{amount}}': 'N$450.00',
                        '{{dueDate}}': 'March 30, 2024',
                        '{{visitDate}}': 'March 10, 2024',
                        '{{paymentLink}}': `${window.location.origin}/pay/invoice`,
                        '{{portalLink}}': `${window.location.origin}/portal`
                      }[variable] || variable;

                      return (
                        <button
                          key={variable}
                          onClick={() => {
                            const textarea = document.querySelector(`textarea`) as HTMLTextAreaElement;
                            if (textarea) {
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const newText = service.template.substring(0, start) + variable + service.template.substring(end);
                              updateAutomationSetting(serviceKey, {
                                ...service,
                                template: newText
                              });
                              // Focus and set cursor position
                              setTimeout(() => {
                                textarea.focus();
                                textarea.setSelectionRange(start + variable.length, start + variable.length);
                              }, 0);
                            }
                          }}
                          className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded-lg hover:bg-blue-200 transition-colors border border-blue-200 group relative"
                          title={`Preview: ${previewValue}`}
                        >
                          {variable}
                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            {previewValue}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Click variables to insert them at cursor position
                  </p>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Preview
                  </label>
                  <div className={`p-4 rounded-xl border-2 border-dashed ${colorClasses[config.color as keyof typeof colorClasses].split(' ')[2]} ${colorClasses[config.color as keyof typeof colorClasses].split(' ')[3]}`}>
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {service.template?.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
                        const previews: { [key: string]: string } = {
                          patientName: 'John Smith',
                          appointmentDate: 'March 15, 2024',
                          appointmentTime: '2:30 PM',
                          doctorName: 'Dr. Johnson',
                          practicePhone: currentPracticeData?.contact_phone || '+264 61 123 4567',
                          practiceName: currentPracticeData?.name || 'Your Practice Name',
                          practiceWebsite: currentPracticeData?.website_url || currentPracticeData?.domain || 'www.yourpractice.com',
                          invoiceNumber: 'INV-2024-001',
                          amount: 'N$450.00',
                          dueDate: 'March 30, 2024',
                          visitDate: 'March 10, 2024',
                          careInstructions: 'Take medication twice daily',
                          patientAge: '45',
                          recommendedScreenings: 'Blood pressure check, cholesterol test',
                          paymentLink: `${window.location.origin}/pay/invoice`,
                          portalLink: `${window.location.origin}/portal`
                        };
                        return previews[variable] || `[${variable}]`;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Sparkles, description: 'Overview & Stats' },
    { id: 'compose', label: 'Compose', icon: Send, description: 'Send Messages' },
    { id: 'automations', label: 'Automations', icon: Zap, description: 'Smart Workflows' },
    { id: 'inbox', label: 'Inbox', icon: Inbox, description: 'Replies & History' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Performance' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'Configuration' }
  ];

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[99997] ${
      isMaximized 
        ? 'bg-black/20 p-0' 
        : 'bg-black/60 backdrop-blur-sm flex items-center justify-center p-4'
    }`} 
         style={{ scrollBehavior: 'smooth', willChange: 'transform' }}
         onClick={onClose}>
      <motion.div
        initial={{ 
          opacity: 0, 
          scale: isMaximized ? 1 : 0.95, 
          y: isMaximized ? 0 : 20 
        }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ 
          opacity: 0, 
          scale: isMaximized ? 1 : 0.95, 
          y: isMaximized ? 0 : 20 
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`relative bg-white shadow-2xl overflow-hidden w-full overflow-y-auto transition-all duration-300 flex flex-col ${
          isMaximized 
            ? 'h-screen max-w-none max-h-none rounded-none' 
            : 'max-w-7xl h-[90vh] rounded-2xl'
        }`}
        style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Communications Center</h2>
                <p className="text-white/90">Messages sent out by this practice</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                <Filter className="w-4 h-4" />
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                  className="bg-transparent border-none text-white text-sm focus:outline-none"
                >
                  <option value="30d" className="text-gray-900">30 Days</option>
                  <option value="3m" className="text-gray-900">3 Months</option>
                  <option value="6m" className="text-gray-900">6 Months</option>
                  <option value="12m" className="text-gray-900">12 Months</option>
                </select>
              </div>
              <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={toggleMaximize}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isMaximized ? 'Minimize' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Premium Overview stats with icons and animations */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            {/* SMS Available Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              {/* Premium Background Icon */}
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <MessageSquare className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">SMS Available</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  {settingsLoading ? '...' : stats.sms.available}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">of {settingsLoading ? '...' : stats.sms.assigned} assigned</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">SMS</div>
                </div>
              </div>
            </motion.div>

            {/* Email Sent Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              {/* Premium Background Icon */}
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Mail className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">Available Emails</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">
                  {settingsLoading ? '...' : stats.email.available}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">{settingsLoading ? '...' : stats.email.assigned} assigned</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">EMAIL</div>
                </div>
              </div>
            </motion.div>

            {/* Delivery Rate Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              {/* Premium Background Icon */}
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <TrendingUp className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">Delivery Rate</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">{stats.deliveryRate.toFixed(1)}%</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">last 30 days</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">RATE</div>
                </div>
              </div>
            </motion.div>

            {/* Active Automations Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="bg-gradient-to-br from-white/15 to-white/5 rounded-xl p-4 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-200 group relative overflow-hidden"
            >
              {/* Premium Background Icon */}
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                <Zap className="w-20 h-20 text-white transform rotate-12" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium mb-1">Communication Services</p>
                <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">{stats.activeAutomations}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/60">services available</p>
                  <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">AUTO</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-[#01b9d5] border-[#01b9d5]'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto communications-modal-scroll"
            >
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && (
                <div className="p-6 space-y-6">
                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Premium Message Volume Chart */}
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="bg-gradient-to-br from-white via-orange-50/30 to-amber-50/50 rounded-2xl shadow-xl border border-orange-100/50 p-6 backdrop-blur-sm hover:shadow-2xl transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg shadow-lg">
                            <BarChart3 className="w-5 h-5 text-white" />
                          </div>
                          Message Volume
                        </h3>
                        <div className="text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full font-medium">
                          Last 7 Days
                        </div>
                      </div>
                      <div className="h-64 flex items-end justify-between bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100/50">
                        {[12, 8, 15, 22, 18, 25, 30].map((value, index) => {
                          const height = (value / 30) * 100;
                          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                          return (
                            <div key={index} className="flex flex-col items-center gap-2 group">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: `${height}%`, opacity: 1 }}
                                transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
                                whileHover={{ scale: 1.05 }}
                                className="bg-gradient-to-t from-amber-500 via-orange-500 to-orange-600 rounded-t-lg w-8 min-h-[6px] shadow-lg group-hover:shadow-xl transition-all duration-300 cursor-pointer relative overflow-hidden"
                                title={`${value} messages`}
                              >
                                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </motion.div>
                              <span className="text-xs font-medium text-gray-600 group-hover:text-orange-600 transition-colors duration-300">{days[index]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>

                    {/* Premium Message Types Distribution */}
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                      className="bg-gradient-to-br from-white via-orange-50/30 to-amber-50/50 rounded-2xl shadow-xl border border-orange-100/50 p-6 backdrop-blur-sm hover:shadow-2xl transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg shadow-lg">
                            <Target className="w-5 h-5 text-white" />
                          </div>
                          Message Types
                        </h3>
                        <div className="text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full font-medium">
                          Distribution
                        </div>
                      </div>
                      <div className="flex items-center justify-center h-64">
                        <div className="relative w-48 h-48 group">
                          {/* Premium Animated Pie Chart */}
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="#f3f4f6"
                              strokeWidth="8"
                              fill="transparent"
                              className="opacity-30"
                            />
                            {/* SMS segment (65%) with animation */}
                            <motion.circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="url(#orangeGradient)"
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray="163 88"
                              initial={{ strokeDashoffset: 251 }}
                              animate={{ strokeDashoffset: 0 }}
                              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                              className="opacity-90 drop-shadow-lg"
                            />
                            {/* Email segment (35%) with animation */}
                            <motion.circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="url(#amberGradient)"
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray="88 163"
                              initial={{ strokeDashoffset: -75 }}
                              animate={{ strokeDashoffset: -163 }}
                              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
                              className="opacity-90 drop-shadow-lg"
                            />
                            <defs>
                              <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f97316" />
                                <stop offset="100%" stopColor="#ea580c" />
                              </linearGradient>
                              <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#d97706" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6, duration: 0.3 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <div className="text-center bg-white/80 backdrop-blur-sm rounded-full p-4 shadow-lg">
                              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">{stats.messagesOut}</div>
                              <div className="text-sm text-gray-600 font-medium">Total</div>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                      <div className="flex justify-center gap-6 mt-6">
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8, duration: 0.2 }}
                          className="flex items-center gap-3 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full shadow-md"
                        >
                          <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full shadow-sm"></div>
                          <span className="text-sm font-medium text-gray-700">SMS (65%)</span>
                        </motion.div>
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.9, duration: 0.2 }}
                          className="flex items-center gap-3 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full shadow-md"
                        >
                          <div className="w-3 h-3 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full shadow-sm"></div>
                          <span className="text-sm font-medium text-gray-700">Email (35%)</span>
                        </motion.div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Additional Premium Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Engagement Rate Chart */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="bg-gradient-to-br from-white via-orange-50/30 to-amber-50/50 rounded-2xl shadow-xl border border-orange-100/50 p-6 backdrop-blur-sm hover:shadow-2xl transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <div className="p-1.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-white" />
                          </div>
                          Engagement
                        </h4>
                      </div>
                      <div className="relative">
                        <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">78.5%</div>
                        <div className="text-sm text-gray-600 mb-4">Click-through rate</div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "78.5%" }}
                            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full shadow-sm"
                          />
                        </div>
                      </div>
                    </motion.div>

                    {/* Response Time Chart */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25, duration: 0.3 }}
                      className="bg-gradient-to-br from-white via-orange-50/30 to-amber-50/50 rounded-2xl shadow-xl border border-orange-100/50 p-6 backdrop-blur-sm hover:shadow-2xl transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <div className="p-1.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg">
                            <Clock className="w-4 h-4 text-white" />
                          </div>
                          Response Time
                        </h4>
                      </div>
                      <div className="relative">
                        <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">2.3s</div>
                        <div className="text-sm text-gray-600 mb-4">Average delivery</div>
                        <div className="flex items-end gap-1 h-12">
                          {[85, 92, 78, 95, 88, 90].map((height, index) => (
                            <motion.div
                              key={index}
                              initial={{ height: 0 }}
                              animate={{ height: `${height}%` }}
                              transition={{ delay: 0.5 + index * 0.05, duration: 0.4, ease: "easeOut" }}
                              className="flex-1 bg-gradient-to-t from-amber-500 to-orange-600 rounded-t min-h-[2px] shadow-sm"
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>

                    {/* Success Rate Chart */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                      className="bg-gradient-to-br from-white via-orange-50/30 to-amber-50/50 rounded-2xl shadow-xl border border-orange-100/50 p-6 backdrop-blur-sm hover:shadow-2xl transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <div className="p-1.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                          Success Rate
                        </h4>
                      </div>
                      <div className="relative">
                        <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">94.2%</div>
                        <div className="text-sm text-gray-600 mb-4">Delivery success</div>
                        <div className="relative w-16 h-16 mx-auto">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="#f3f4f6"
                              strokeWidth="8"
                              fill="transparent"
                            />
                            <motion.circle
                              cx="50"
                              cy="50"
                              r="40"
                              stroke="url(#successGradient)"
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray="251.2 251.2"
                              initial={{ strokeDashoffset: 251.2 }}
                              animate={{ strokeDashoffset: 14.57 }}
                              transition={{ delay: 0.6, duration: 1, ease: "easeOut" }}
                              className="drop-shadow-sm"
                            />
                            <defs>
                              <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#ea580c" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      Performance Trends (Last 30 Days)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Delivery Rate Trend */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-emerald-600 mb-2">{stats.deliveryRate.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600 mb-3">Average Delivery Rate</div>
                        <div className="h-16 flex items-end justify-between bg-gray-50 rounded p-2">
                          {[95, 97, 94, 98, 96, 99, 97].map((rate, index) => (
                            <div
                              key={index}
                              className="bg-emerald-500 w-2 rounded-t"
                              style={{ height: `${rate}%` }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Response Rate */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-2">{stats.engagementRate}%</div>
                        <div className="text-sm text-gray-600 mb-3">Engagement Rate</div>
                        <div className="h-16 flex items-end justify-between bg-gray-50 rounded p-2">
                          {[70, 72, 75, 78, 74, 76, 80].map((rate, index) => (
                            <div
                              key={index}
                              className="bg-blue-500 w-2 rounded-t"
                              style={{ height: `${rate}%` }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Cost Efficiency */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600 mb-2">N${stats.sms.cost.toFixed(2)}</div>
                        <div className="text-sm text-gray-600 mb-3">SMS Costs Today</div>
                        <div className="h-16 flex items-end justify-between bg-gray-50 rounded p-2">
                          {[45, 52, 38, 41, 47, 39, 43].map((cost, index) => (
                            <div
                              key={index}
                              className="bg-purple-500 w-2 rounded-t"
                              style={{ height: `${(cost / 60) * 100}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions & Recent Messages */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                      <div className="space-y-3">
                        <button
                          onClick={() => setActiveTab('compose')}
                          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <Send className="w-5 h-5" />
                            <span className="font-medium">Compose Message</span>
                          </div>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => setActiveTab('automations')}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-purple-600" />
                            <span className="font-medium text-gray-900">Setup Automations</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>

                        <button
                          onClick={() => setActiveTab('settings')}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Settings className="w-5 h-5 text-gray-600" />
                            <span className="font-medium text-gray-900">Communication Settings</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    {/* Recent Messages */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Recent Messages</h3>
                        <button
                          onClick={() => setActiveTab('inbox')}
                          className="text-[#01b9d5] hover:text-[#01a3c7] text-sm font-medium"
                        >
                          View All
                        </button>
                      </div>
                      
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {recentMessages.length > 0 ? (
                          recentMessages.map((message) => (
                            <div key={message.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <div className="p-2 bg-white rounded-lg">
                                {message.type === 'SMS' ? (
                                  <MessageSquare className="w-4 h-4 text-purple-600" />
                                ) : (
                                  <Mail className="w-4 h-4 text-blue-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {message.patients ? 
                                    `${message.patients.first_name} ${message.patients.last_name}` : 
                                    message.recipient_address
                                  }
                                </p>
                                <p className="text-sm text-gray-600 truncate">{message.body_preview}</p>
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(new Date(message.created_at), 'HH:mm')}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No messages sent today</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Compose Tab */}
              {activeTab === 'compose' && (
                <div className="h-full">
                  <Compose />
                </div>
              )}

              {/* Automations Tab */}
              {activeTab === 'automations' && (
                <div className="h-full">
                  <SmartAutomations />
                </div>
              )}

              {/* Inbox/History Tab */}
              {activeTab === 'inbox' && (
                <div className="h-full">
                  <CommunicationHistory />
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div className="p-6">
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics Dashboard</h3>
                    <p className="text-gray-600">Detailed communication analytics coming soon.</p>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="p-6" style={{ scrollBehavior: 'smooth' }}>
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Communication Services</h2>
                    <p className="text-gray-600">Configure automated messaging services with custom templates and timing</p>
                  </div>

                  <div 
                    className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto communications-modal-scroll"
                  >
                    {/* Service Configuration Cards */}
                    {renderServiceCard('appointmentReminders', {
                      title: 'Appointment Reminders',
                      description: 'Send automated reminders before scheduled appointments',
                      icon: Bell,
                      color: 'blue',
                      timingOptions: [
                        { value: '24h', label: '24 hours before' },
                        { value: '2h', label: '2 hours before' },
                        { value: '30m', label: '30 minutes before' }
                      ],
                      variables: [
                        '{{patientName}}', '{{appointmentDate}}', '{{appointmentTime}}', 
                        '{{doctorName}}', '{{practicePhone}}', '{{practiceName}}', '{{practiceWebsite}}'
                      ]
                    })}

                    {renderServiceCard('birthdayMessages', {
                      title: 'Birthday Messages',
                      description: 'Send personalized birthday greetings with special offers',
                      icon: Heart,
                      color: 'pink',
                      timingOptions: [
                        { value: 'morning', label: 'Morning of birthday' },
                        { value: 'afternoon', label: 'Afternoon of birthday' }
                      ],
                      variables: [
                        '{{patientName}}', '{{practicePhone}}', '{{practiceName}}', '{{practiceWebsite}}', '{{specialOffer}}'
                      ]
                    })}

                    {renderServiceCard('paymentReminders', {
                      title: 'Payment Reminders',
                      description: 'Automated reminders for overdue payments and invoices',
                      icon: DollarSign,
                      color: 'green',
                      timingOptions: [
                        { value: '7d', label: '7 days after due date' },
                        { value: '14d', label: '14 days after due date' },
                        { value: '30d', label: '30 days after due date' }
                      ],
                      variables: [
                        '{{patientName}}', '{{invoiceNumber}}', '{{amount}}', 
                        '{{dueDate}}', '{{paymentLink}}', '{{practicePhone}}'
                      ]
                    })}

                    {renderServiceCard('invoiceDelivery', {
                      title: 'Invoice Delivery',
                      description: 'Automatically send invoices after completed visits',
                      icon: FileText,
                      color: 'indigo',
                      timingOptions: [
                        { value: 'immediately', label: 'Immediately after visit' },
                        { value: '1h', label: '1 hour after visit' },
                        { value: '24h', label: '24 hours after visit' }
                      ],
                      variables: [
                        '{{patientName}}', '{{visitDate}}', '{{invoiceNumber}}', 
                        '{{amount}}', '{{dueDate}}', '{{paymentLink}}'
                      ]
                    })}

                    {renderServiceCard('thankYouMessages', {
                      title: 'Thank You Messages',
                      description: 'Post-visit thank you with care instructions',
                      icon: CheckCircle,
                      color: 'emerald',
                      timingOptions: [
                        { value: '2h', label: '2 hours after visit' },
                        { value: '4h', label: '4 hours after visit' },
                        { value: '24h', label: '24 hours after visit' }
                      ],
                      variables: [
                        '{{patientName}}', '{{careInstructions}}', '{{practicePhone}}', 
                        '{{doctorName}}', '{{visitDate}}'
                      ]
                    })}

                    {renderServiceCard('followUpCare', {
                      title: 'Follow-up Care',
                      description: 'Check-in messages with medication and care reminders',
                      icon: Users,
                      color: 'purple',
                      timingOptions: [
                        { value: '3d', label: '3 days after visit' },
                        { value: '7d', label: '1 week after visit' },
                        { value: '14d', label: '2 weeks after visit' }
                      ],
                      variables: [
                        '{{patientName}}', '{{followUpInstructions}}', '{{practicePhone}}', 
                        '{{medicationReminders}}', '{{nextAppointment}}'
                      ]
                    })}

                    {renderServiceCard('healthScreenings', {
                      title: 'Health Screenings',
                      description: 'Remind patients about due health screenings based on age and history',
                      icon: Activity,
                      color: 'orange',
                      timingOptions: [
                        { value: 'annually', label: 'Annually' },
                        { value: '6months', label: 'Every 6 months' },
                        { value: '2years', label: 'Every 2 years' }
                      ],
                      variables: [
                        '{{patientName}}', '{{patientAge}}', '{{recommendedScreenings}}', 
                        '{{practicePhone}}', '{{lastScreeningDate}}'
                      ]
                    })}

                    {renderServiceCard('welcomeNewPatients', {
                      title: 'Welcome New Patients',
                      description: 'Welcome message with portal access and practice information',
                      icon: UserPlus,
                      color: 'cyan',
                      timingOptions: [
                        { value: 'immediately', label: 'Immediately after registration' },
                        { value: '1h', label: '1 hour after registration' },
                        { value: '24h', label: '24 hours after registration' }
                      ],
                      variables: [
                        '{{patientName}}', '{{practiceName}}', '{{portalLink}}', 
                        '{{practicePhone}}', '{{practiceWebsite}}', '{{welcomeBonus}}'
                      ]
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Email Template Preview Modal */}
      {previewTemplate && (
        <EmailTemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          practiceData={currentPracticeData}
        />
      )}

      {/* Professional Email Preview Modal */}
      {showEmailPreview && (
        <EmailTemplatePreviews
          isOpen={!!showEmailPreview}
          onClose={() => setShowEmailPreview(null)}
          serviceName={showEmailPreview}
          practiceData={currentPracticeData}
        />
      )}
    </div>
  );
};

export default CommunicationsModal;