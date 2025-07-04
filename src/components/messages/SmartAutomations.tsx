import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';
import { Stepper } from '../ui/Stepper';
import { TimingPicker, TimingOption } from '../ui/TimingPicker';
import { triggerAutomationEngine } from '../../utils/automationTrigger';
import { TemplateSelector } from '../ui/TemplateSelector';

interface AutomationCard {
  id: string;
  name: string;
  category: 'appointment' | 'engagement' | 'health' | 'billing' | 'marketing';
  description: string;
  icon: string;
  defaultChannels: ChannelConfig[];
  defaultTimings: TimingOption[];
  isActive: boolean;
  stats?: {
    sent: number;
    delivered: number;
    success_rate: number;
  };
}

interface ChannelConfig {
  type: 'SMS' | 'EMAIL' | 'BOTH';
  enabled: boolean;
  template?: {
    subject?: string;
    body: string;
  };
}


// Simplified Automation Cards
const automationCards: AutomationCard[] = [
  // Appointment & Visit Related
  {
    id: 'appointment-reminder',
    name: 'Appointment Reminder',
    category: 'appointment',
    description: 'Never let patients miss their appointments',
    icon: 'solar:calendar-check-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'BOTH',
        enabled: true,
        template: {
          subject: 'Appointment Reminder - {{practiceName}}',
          body: 'Hi {{patientName}}, this is a reminder about your appointment on {{appointmentDate}} at {{appointmentTime}}. Reply CONFIRM or call {{practicePhone}} if you need to reschedule.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '24 hours before', value: 24, unit: 'hours', when: 'before', enabled: true },
      { id: '2', label: '2 hours before', value: 2, unit: 'hours', when: 'before', enabled: true }
    ],
    stats: {
      sent: 15420,
      delivered: 15380,
      success_rate: 98.7
    }
  },
  {
    id: 'appointment-confirmation',
    name: 'Appointment Confirmation',
    category: 'appointment',
    description: 'Instantly confirm new appointments',
    icon: 'solar:check-square-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'BOTH',
        enabled: true,
        template: {
          subject: 'Appointment Confirmed - {{practiceName}}',
          body: 'Hi {{patientName}}, your appointment with {{doctorName}} is confirmed for {{appointmentDate}} at {{appointmentTime}}. Save this confirmation: {{confirmationCode}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Immediately', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },
  {
    id: 'no-show-followup',
    name: 'No-Show Follow-up',
    category: 'appointment',
    description: 'Reach out to patients who missed appointments',
    icon: 'solar:calendar-remove-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, we missed you at your appointment today. Please call {{practicePhone}} to reschedule. We care about your health!'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '30 mins after', value: 30, unit: 'minutes', when: 'after', enabled: true }
    ]
  },

  // Health & Care Related
  {
    id: 'follow-up',
    name: 'Follow-up Care',
    category: 'health',
    description: 'Ensure patients complete their treatment plans',
    icon: 'solar:health-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Follow-up Care Instructions',
          body: 'Dear {{patientName}}, your recent visit requires follow-up care. Please remember to {{followUpInstructions}}. Contact us at {{practicePhone}} if you have questions.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '1 day after', value: 1, unit: 'days', when: 'after', enabled: true },
      { id: '2', label: '1 week after', value: 7, unit: 'days', when: 'after', enabled: true }
    ]
  },
  {
    id: 'medication-reminder',
    name: 'Medication Reminder',
    category: 'health',
    description: 'Help patients stay on track with medications',
    icon: 'solar:pills-2-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, time to take your {{medicationName}}. Remember: {{dosageInstructions}}. Questions? Call {{practicePhone}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Daily at 9am', value: 9, unit: 'hours', when: 'after', enabled: true },
      { id: '2', label: 'Daily at 6pm', value: 18, unit: 'hours', when: 'after', enabled: true }
    ]
  },
  {
    id: 'lab-results',
    name: 'Lab Results Ready',
    category: 'health',
    description: 'Notify when test results are available',
    icon: 'solar:test-tube-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Your Lab Results Are Ready',
          body: 'Dear {{patientName}}, your lab results from {{testDate}} are now available. Please log in to your patient portal at {{portalLink}} or call {{practicePhone}} to discuss with your doctor.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Immediately', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },

  // Billing & Payment Related
  {
    id: 'payment-reminder',
    name: 'Payment Reminder',
    category: 'billing',
    description: 'Gentle reminders for outstanding payments',
    icon: 'solar:wallet-money-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, you have an outstanding balance of {{amount}}. Please visit {{paymentLink}} to pay securely online or call {{practicePhone}}.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '7 days after due', value: 7, unit: 'days', when: 'after', enabled: true },
      { id: '2', label: '14 days after due', value: 14, unit: 'days', when: 'after', enabled: true }
    ]
  },
  {
    id: 'payment-confirmation',
    name: 'Payment Confirmation',
    category: 'billing',
    description: 'Confirm successful payments',
    icon: 'solar:check-read-broken-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Payment Received - Thank You!',
          body: 'Dear {{patientName}}, we have received your payment of {{amount}} on {{paymentDate}}. Transaction ID: {{transactionId}}. Thank you for your prompt payment!'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Immediately', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },
  {
    id: 'insurance-claim-update',
    name: 'Insurance Claim Updates',
    category: 'billing',
    description: 'Keep patients informed about claim status',
    icon: 'solar:shield-check-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Insurance Claim Update - {{claimStatus}}',
          body: 'Dear {{patientName}}, your insurance claim #{{claimNumber}} has been {{claimStatus}}. {{claimDetails}}. Questions? Contact us at {{practicePhone}}.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'When updated', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },

  // Engagement & Marketing
  {
    id: 'birthday-wishes',
    name: 'Birthday Wishes',
    category: 'engagement',
    description: 'Send personalized birthday greetings',
    icon: 'solar:gift-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Happy Birthday from {{practiceName}}! 🎉',
          body: 'Dear {{patientName}}, the entire team at {{practiceName}} wishes you a very happy birthday! As a gift, enjoy {{birthdayOffer}} on your next visit. We appreciate you choosing us for your healthcare needs!'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Birthday morning', value: 9, unit: 'hours', when: 'after', enabled: true }
    ]
  },
  {
    id: 'welcome-new-patient',
    name: 'Welcome New Patients',
    category: 'engagement',
    description: 'Make new patients feel welcome',
    icon: 'solar:hand-shake-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Welcome to {{practiceName}}!',
          body: 'Dear {{patientName}}, welcome to our practice! We are excited to be your healthcare partner. Access your patient portal at {{portalLink}} to manage appointments, view records, and more. Questions? Call {{practicePhone}}.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'After registration', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },
  {
    id: 'health-tips',
    name: 'Health Tips & Newsletter',
    category: 'engagement',
    description: 'Share health tips and practice news',
    icon: 'solar:heart-pulse-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Health Tip of the Month - {{tipTitle}}',
          body: 'Dear {{patientName}}, {{healthTipContent}}. Stay healthy and remember we are here for all your healthcare needs. Visit {{practiceWebsite}} for more tips!'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Monthly', value: 1, unit: 'months', when: 'after', enabled: true }
    ]
  },
  {
    id: 'referral-request',
    name: 'Referral Request',
    category: 'marketing',
    description: 'Ask satisfied patients for referrals',
    icon: 'solar:users-group-two-rounded-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Love Our Service? Share with Friends!',
          body: 'Dear {{patientName}}, thank you for trusting {{practiceName}} with your healthcare. If you are satisfied with our service, we would appreciate you referring friends and family. They will receive {{referralBonus}} on their first visit!'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '2 weeks after visit', value: 14, unit: 'days', when: 'after', enabled: true }
    ]
  },
  {
    id: 'review-request',
    name: 'Review Request',
    category: 'marketing',
    description: 'Request online reviews from happy patients',
    icon: 'solar:star-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, thank you for visiting {{practiceName}}! If you had a great experience, please leave us a review: {{reviewLink}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '3 days after visit', value: 3, unit: 'days', when: 'after', enabled: true }
    ]
  },
  {
    id: 'seasonal-campaign',
    name: 'Seasonal Health Campaigns',
    category: 'marketing',
    description: 'Promote seasonal health services',
    icon: 'solar:sun-2-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: '{{seasonalTitle}} - Special Offer Inside!',
          body: 'Dear {{patientName}}, {{seasonalMessage}}. Book your {{serviceType}} today and receive {{seasonalDiscount}}! Call {{practicePhone}} or book online.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Campaign start', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },
  
  // Additional 10 Templates
  {
    id: 'vaccine-reminder',
    name: 'Vaccine Reminder',
    category: 'health',
    description: 'Remind patients about due vaccinations',
    icon: 'solar:syringe-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'BOTH',
        enabled: true,
        template: {
          subject: 'Vaccine Reminder - {{vaccineName}}',
          body: 'Hi {{patientName}}, you are due for your {{vaccineName}} vaccine. Please schedule an appointment at {{practicePhone}} to stay protected.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '1 month before due', value: 1, unit: 'months', when: 'before', enabled: true },
      { id: '2', label: '1 week before due', value: 1, unit: 'weeks', when: 'before', enabled: true }
    ]
  },
  {
    id: 'prescription-refill',
    name: 'Prescription Refill Reminder',
    category: 'health',
    description: 'Alert patients when prescriptions need refilling',
    icon: 'solar:pills-3-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, your {{medicationName}} prescription is running low. Contact {{practicePhone}} for a refill. Reply STOP to opt out.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '5 days before empty', value: 5, unit: 'days', when: 'before', enabled: true }
    ]
  },
  {
    id: 'annual-checkup',
    name: 'Annual Check-up Reminder',
    category: 'health',
    description: 'Yearly health examination reminders',
    icon: 'solar:health-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Time for Your Annual Check-up!',
          body: 'Dear {{patientName}},\n\nIt has been a year since your last comprehensive health check-up. Regular check-ups help detect health issues early.\n\nPlease call {{practicePhone}} to schedule your annual examination.\n\nStay healthy!\n{{practiceName}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '11 months after last visit', value: 11, unit: 'months', when: 'after', enabled: true }
    ]
  },
  {
    id: 'test-results-follow-up',
    name: 'Test Results Follow-up',
    category: 'health',
    description: 'Follow up on abnormal test results',
    icon: 'solar:test-tube-minimalistic-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'BOTH',
        enabled: true,
        template: {
          subject: 'Important: Follow-up Required for Your Test Results',
          body: 'Hi {{patientName}}, your recent test results require a follow-up consultation. Please contact {{practicePhone}} to schedule an appointment with {{doctorName}}.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Immediately', value: 0, unit: 'minutes', when: 'after', enabled: true },
      { id: '2', label: '2 days after', value: 2, unit: 'days', when: 'after', enabled: true }
    ]
  },
  {
    id: 'surgery-pre-op',
    name: 'Pre-Surgery Instructions',
    category: 'appointment',
    description: 'Pre-operative preparation reminders',
    icon: 'solar:scissors-square-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Important Pre-Surgery Instructions',
          body: 'Dear {{patientName}},\n\nYour surgery is scheduled for {{surgeryDate}}. Please follow these important instructions:\n\n- No food or drink after midnight\n- Arrange transportation home\n- Bring your medical aid card and ID\n- Wear comfortable clothing\n\nQuestions? Call {{practicePhone}}\n\n{{practiceName}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '1 week before', value: 1, unit: 'weeks', when: 'before', enabled: true },
      { id: '2', label: '1 day before', value: 1, unit: 'days', when: 'before', enabled: true }
    ]
  },
  {
    id: 'post-procedure-care',
    name: 'Post-Procedure Care',
    category: 'health',
    description: 'After-care instructions and check-ins',
    icon: 'solar:bandage-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, how are you feeling after your procedure? Remember: {{careInstructions}}. If you have concerns, call {{practicePhone}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '1 day after', value: 1, unit: 'days', when: 'after', enabled: true },
      { id: '2', label: '3 days after', value: 3, unit: 'days', when: 'after', enabled: true }
    ]
  },
  {
    id: 'chronic-condition-monitoring',
    name: 'Chronic Condition Check-in',
    category: 'health',
    description: 'Regular monitoring for chronic conditions',
    icon: 'solar:pulse-2-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'BOTH',
        enabled: true,
        template: {
          subject: 'Time for Your {{conditionType}} Check-up',
          body: 'Hi {{patientName}}, it\'s time for your regular {{conditionType}} monitoring. Regular check-ups help us manage your condition effectively. Please schedule your appointment at {{practicePhone}}.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '3 months interval', value: 3, unit: 'months', when: 'after', enabled: true }
    ]
  },
  {
    id: 'wellness-program',
    name: 'Wellness Program Updates',
    category: 'engagement',
    description: 'Health and wellness program communications',
    icon: 'solar:running-round-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'New Wellness Program: {{programName}}',
          body: 'Dear {{patientName}},\n\nJoin our new {{programName}} program starting {{programDate}}!\n\n{{programDescription}}\n\nBenefits:\n- Professional guidance\n- Group support\n- Track your progress\n\nRegister: {{practicePhone}}\n\n{{practiceName}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Program launch', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },
  {
    id: 'insurance-verification',
    name: 'Insurance Verification',
    category: 'billing',
    description: 'Verify insurance before appointments',
    icon: 'solar:shield-check-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, please bring your updated medical aid card to your appointment on {{appointmentDate}}. Call {{practicePhone}} if your insurance has changed.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '3 days before', value: 3, unit: 'days', when: 'before', enabled: true }
    ]
  },
  {
    id: 'practice-announcements',
    name: 'Practice Announcements',
    category: 'engagement',
    description: 'Important practice updates and news',
    icon: 'solar:megaphone-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Important Update from {{practiceName}}',
          body: 'Dear {{patientName}},\n\n{{announcementContent}}\n\nThank you for your continued trust in our practice.\n\nBest regards,\n{{practiceName}}\n{{practicePhone}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Send immediately', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  }
];

const SmartAutomations: React.FC = () => {
  const { user } = useAuthStore();
  const [cards, setCards] = useState<AutomationCard[]>(automationCards);
  const [activeView, setActiveView] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCard, setSelectedCard] = useState<AutomationCard | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentStep, setCurrentStep] = useState(0);
  const [setupData, setSetupData] = useState({
    channels: { sms: true, email: true },
    timings: [] as TimingOption[],
    smsTemplate: { body: '' },
    emailTemplate: { subject: '', body: '' },
    smsTemplateId: null as string | null,
    emailTemplateId: null as string | null,
    smsTemplateVariables: [] as string[],
    emailTemplateVariables: [] as string[],
    testMode: true
  });
  const [customTimingTemplates, setCustomTimingTemplates] = useState<TimingOption[]>([]);
  const [showCreateAutomation, setShowCreateAutomation] = useState(false);
  const [customAutomations, setCustomAutomations] = useState<AutomationCard[]>([]);
  const [newAutomation, setNewAutomation] = useState({
    name: '',
    category: 'health' as AutomationCard['category'],
    description: '',
    icon: 'solar:star-bold-duotone',
    trigger: 'appointment' as 'appointment' | 'birthday' | 'lab_result' | 'medication' | 'custom',
    channels: {
      sms: { enabled: false, template: '' },
      email: { enabled: false, subject: '', template: '' }
    },
    timing: [] as TimingOption[]
  });

  // Professional stepper configuration
  const steps = [
    { 
      id: 'channels',
      label: 'Channels', 
      icon: 'solar:chat-round-bold-duotone',
      description: 'Choose communication methods'
    },
    { 
      id: 'timing',
      label: 'Timing', 
      icon: 'solar:clock-circle-bold-duotone',
      description: 'Set reminder schedule'
    },
    { 
      id: 'customize',
      label: 'Customize', 
      icon: 'solar:pen-bold-duotone',
      description: 'Personalize messages'
    },
    { 
      id: 'review',
      label: 'Review', 
      icon: 'solar:check-circle-bold-duotone',
      description: 'Confirm settings'
    }
  ];

  // Load user's active automations
  useEffect(() => {
    loadActiveAutomations();
  }, [user?.practice_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActiveAutomations = async () => {
    if (!user?.practice_id) return;
    
    try {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('practice_id', user.practice_id);
      
      if (error) {
        console.error('Error loading automations:', error);
        // Table might not exist yet, continue with defaults
        return;
      }
      
      // Update cards with saved settings
      const updatedCards = automationCards.map(card => {
        const settings = data?.find(s => s.automation_id === card.id);
        return {
          ...card,
          isActive: settings?.is_active || false,
          defaultChannels: settings?.channels || card.defaultChannels,
          defaultTimings: settings?.timings || card.defaultTimings
        };
      });
      
      // Load custom automations from database
      const customCards = data
        ?.filter(s => s.automation_id.startsWith('custom-'))
        ?.map(s => ({
          id: s.automation_id,
          name: s.name,
          category: s.category || 'custom',
          description: s.description || '',
          icon: s.icon || 'solar:star-bold-duotone',
          isActive: s.is_active,
          defaultChannels: s.channels || [],
          defaultTimings: s.timings || []
        })) || [];
      
      setCards(updatedCards);
      setCustomAutomations(customCards);
    } catch (error) {
      console.error('Error loading automations:', error);
    }
  };

  const toggleCardActivation = async (card: AutomationCard) => {
    try {
      const newStatus = !card.isActive;
      
      const { error } = await supabase
        .from('automation_settings')
        .upsert({
          practice_id: user?.practice_id,
          automation_id: card.id,
          name: card.name,
          description: card.description,
          category: card.category,
          icon: card.icon,
          is_active: newStatus,
          channels: card.defaultChannels,
          timings: card.defaultTimings,
          updated_at: new Date().toISOString(),
          created_by: user?.id
        }, {
          onConflict: 'practice_id,automation_id'
        });
      
      if (error) throw error;
      
      toast.success(`${card.name} ${newStatus ? 'activated' : 'deactivated'}`);
      loadActiveAutomations();
    } catch (error) {
      console.error('Error toggling automation:', error);
      toast.error('Failed to update automation. Please try again.');
    }
  };

  const handleCardClick = async (card: AutomationCard) => {
    setSelectedCard(card);
    
    // Initialize setup data with card defaults
    const defaultChannel = card.defaultChannels[0];
    
    // Default setup data
    let setupDataToUse = {
      channels: { 
        sms: defaultChannel.type === 'SMS' || defaultChannel.type === 'BOTH',
        email: defaultChannel.type === 'EMAIL' || defaultChannel.type === 'BOTH'
      },
      timings: card.defaultTimings,
      smsTemplate: { 
        body: defaultChannel.type !== 'EMAIL' ? defaultChannel.template?.body || '' : 'Hi {{patientName}}, {{message}}' 
      },
      emailTemplate: { 
        subject: defaultChannel.template?.subject || '',
        body: defaultChannel.type !== 'SMS' ? defaultChannel.template?.body || '' : 'Dear {{patientName}},\n\n{{message}}\n\nBest regards,\n{{practiceName}}'
      },
      smsTemplateId: null as string | null,
      emailTemplateId: null as string | null,
      smsTemplateVariables: [] as string[],
      emailTemplateVariables: [] as string[],
      testMode: !card.isActive
    };
    
    // Try to load existing settings from database
    if (user?.practice_id) {
      try {
        const { data, error } = await supabase
          .from('automation_settings')
          .select('*')
          .eq('practice_id', user.practice_id)
          .eq('automation_id', card.id)
          .single();
          
        if (!error && data) {
          // Update setup data with saved settings
          setupDataToUse = {
            channels: {
              sms: data.channels?.some((c: ChannelConfig) => c.type === 'SMS' || c.type === 'BOTH') || false,
              email: data.channels?.some((c: ChannelConfig) => c.type === 'EMAIL' || c.type === 'BOTH') || false
            },
            timings: data.timings || card.defaultTimings,
            smsTemplate: data.sms_template || setupDataToUse.smsTemplate,
            emailTemplate: data.email_template || setupDataToUse.emailTemplate,
            smsTemplateId: data.sms_template_id || null,
            emailTemplateId: data.email_template_id || null,
            smsTemplateVariables: data.variables?.filter((v: string) => v.includes('sms')) || [],
            emailTemplateVariables: data.variables?.filter((v: string) => v.includes('email')) || [],
            testMode: !data.is_active
          };
        }
      } catch (error) {
        console.error('Error loading automation settings:', error);
      }
    }
    
    setSetupData(setupDataToUse);
    setCurrentStep(0);
    setShowSetupWizard(true);
  };

  // Combine default and custom automations
  const allAutomations = [...cards, ...customAutomations];
  
  const filteredCards = allAutomations.filter(card => {
    const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         card.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || card.category === categoryFilter;
    const matchesView = activeView === 'all' || 
                       (activeView === 'active' && card.isActive) ||
                       (activeView === 'inactive' && !card.isActive);
    
    return matchesSearch && matchesCategory && matchesView;
  });

  const categories = [
    { id: 'all', label: 'All Categories', icon: 'solar:widget-add-bold-duotone' },
    { id: 'appointment', label: 'Appointments', icon: 'solar:calendar-bold-duotone' },
    { id: 'health', label: 'Health', icon: 'solar:shield-plus-bold-duotone' },
    { id: 'billing', label: 'Billing', icon: 'solar:dollar-minimalistic-bold-duotone' }
  ];

  const getCategoryStyle = (category?: string) => {
    switch(category) {
      case 'appointment': return { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: 'solar:calendar-check-bold-duotone' };
      case 'engagement': return { color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', icon: 'solar:heart-bold-duotone' };
      case 'health': return { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', icon: 'solar:shield-plus-bold-duotone' };
      case 'billing': return { color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: 'solar:dollar-minimalistic-bold-duotone' };
      case 'marketing': return { color: 'text-pink-600', bgColor: 'bg-pink-50', borderColor: 'border-pink-200', icon: 'solar:megaphone-bold-duotone' };
      default: return { color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', icon: 'solar:automation-bold-duotone' };
    }
  };

  const deleteCustomAutomation = async (automationId: string) => {
    const automation = customAutomations.find(a => a.id === automationId);
    if (!automation) return;
    
    if (window.confirm(`Are you sure you want to delete "${automation.name}"?`)) {
      try {
        const { error } = await supabase
          .from('automation_settings')
          .delete()
          .eq('practice_id', user?.practice_id)
          .eq('automation_id', automationId);
        
        if (error) throw error;
        
        setCustomAutomations(customAutomations.filter(a => a.id !== automationId));
        toast.success('Custom automation deleted successfully');
      } catch (error) {
        console.error('Error deleting automation:', error);
        toast.error('Failed to delete automation');
      }
    }
  };

  const createCustomAutomation = async () => {
    if (!newAutomation.name || !newAutomation.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!newAutomation.channels.sms.enabled && !newAutomation.channels.email.enabled) {
      toast.error('Please enable at least one channel');
      return;
    }

    if (newAutomation.timing.length === 0) {
      toast.error('Please add at least one timing');
      return;
    }

    // Create the automation card
    const customCard: AutomationCard = {
      id: `custom-${Date.now()}`,
      name: newAutomation.name,
      category: newAutomation.category,
      description: newAutomation.description,
      icon: newAutomation.icon,
      isActive: false,
      defaultChannels: [],
      defaultTimings: newAutomation.timing
    };

    // Build channels array
    if (newAutomation.channels.sms.enabled && newAutomation.channels.email.enabled) {
      customCard.defaultChannels.push({
        type: 'BOTH',
        enabled: true,
        template: {
          subject: newAutomation.channels.email.subject,
          body: newAutomation.channels.sms.template // Use SMS template for BOTH
        }
      });
    } else if (newAutomation.channels.sms.enabled) {
      customCard.defaultChannels.push({
        type: 'SMS',
        enabled: true,
        template: {
          body: newAutomation.channels.sms.template
        }
      });
    } else if (newAutomation.channels.email.enabled) {
      customCard.defaultChannels.push({
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: newAutomation.channels.email.subject,
          body: newAutomation.channels.email.template
        }
      });
    }

    // Save to database
    try {
      const { error } = await supabase
        .from('automation_settings')
        .insert({
          practice_id: user?.practice_id,
          automation_id: customCard.id,
          name: customCard.name,
          description: customCard.description,
          category: customCard.category,
          icon: customCard.icon,
          is_active: false,
          channels: customCard.defaultChannels,
          timings: customCard.defaultTimings,
          created_by: user?.id
        });
      
      if (error) throw error;
      
      // Add to custom automations
      setCustomAutomations([...customAutomations, customCard]);
      
      toast.success('Custom automation created successfully!');
    } catch (error) {
      console.error('Error creating custom automation:', error);
      toast.error('Failed to create automation. Please try again.');
      return;
    }
    
    // Reset form
    setNewAutomation({
      name: '',
      category: 'health',
      description: '',
      icon: 'solar:star-bold-duotone',
      trigger: 'appointment',
      channels: {
        sms: { enabled: false, template: '' },
        email: { enabled: false, subject: '', template: '' }
      },
      timing: []
    });
    
    setShowCreateAutomation(false);
    toast.success('Custom automation created successfully!');
  };

  const saveAutomation = async () => {
    if (!selectedCard) return;
    
    try {
      // Build channels array based on what's actually enabled
      const channels = [];
      
      if (setupData.channels.sms) {
        channels.push({
          type: 'SMS',
          enabled: true,
          template: {
            body: setupData.smsTemplate.body
          }
        });
      }
      
      if (setupData.channels.email) {
        channels.push({
          type: 'EMAIL',
          enabled: true,
          template: {
            subject: setupData.emailTemplate.subject,
            body: setupData.emailTemplate.body
          }
        });
      }
      
      const { error } = await supabase
        .from('automation_settings')
        .upsert({
          practice_id: user?.practice_id,
          automation_id: selectedCard.id,
          name: selectedCard.name,
          description: selectedCard.description,
          category: selectedCard.category,
          icon: selectedCard.icon,
          is_active: !setupData.testMode,
          channels: channels, // Use the properly built channels array
          timings: setupData.timings.filter(t => t.enabled), // Only save enabled timings
          sms_template: setupData.smsTemplate,
          email_template: setupData.emailTemplate,
          sms_template_id: setupData.smsTemplateId,
          email_template_id: setupData.emailTemplateId,
          variables: [
            ...(setupData.smsTemplateVariables || []),
            ...(setupData.emailTemplateVariables || [])
          ].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
          updated_at: new Date().toISOString(),
          created_by: user?.id
        }, {
          onConflict: 'practice_id,automation_id'
        });
      
      if (error) throw error;
      
      toast.success(`${selectedCard.name} saved successfully!`);
      setShowSetupWizard(false);
      setSelectedCard(null);
      loadActiveAutomations();
      
      // Trigger automation engine to process any pending executions
      setTimeout(() => {
        triggerAutomationEngine().then(result => {
          if (result.success && result.pendingCount > 0) {
            console.log(`Processed ${result.pendingCount} pending automations`);
          }
        }).catch(console.error);
      }, 1000);
    } catch (error) {
      console.error('Error saving automation:', error);
      toast.error('Failed to save automation settings');
    }
  };

  const replaceVariables = (text: string) => {
    const variables: Record<string, string> = {
      '{{patientName}}': 'John Smith',
      '{{appointmentDate}}': format(new Date(Date.now() + 86400000), 'MMMM d, yyyy'),
      '{{appointmentTime}}': '2:30 PM',
      '{{doctorName}}': 'Dr. Sarah Johnson',
      '{{practicePhone}}': '(555) 123-4567',
      '{{practiceName}}': 'HealthCare Clinic',
      '{{amount}}': '$125.00',
      '{{paymentLink}}': 'pay.healthcareclinic.com',
      '{{followUpInstructions}}': 'take your medication daily and rest',
      '{{message}}': 'this is your customized message'
    };

    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(key, 'g'), value);
    });
    return result;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Channels
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSetupData({ ...setupData, channels: { ...setupData.channels, sms: !setupData.channels.sms }})}
                className={cn(
                  "relative p-6 border-2 rounded-xl cursor-pointer transition-all",
                  setupData.channels.sms 
                    ? "border-purple-500 bg-purple-50" 
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "p-3 rounded-lg",
                        setupData.channels.sms ? "bg-purple-100" : "bg-gray-100"
                      )}>
                        <Icon 
                          icon="solar:chat-round-bold-duotone" 
                          className={cn(
                            "w-8 h-8",
                            setupData.channels.sms ? "text-purple-600" : "text-gray-400"
                          )}
                        />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">SMS Messages</h3>
                    </div>
                    <p className="text-gray-600 mb-4">Quick, direct messages to mobile phones</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">98% delivery rate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">Instant delivery</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">160 character limit</span>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    setupData.channels.sms 
                      ? "border-purple-500 bg-purple-500" 
                      : "border-gray-300"
                  )}>
                    {setupData.channels.sms && (
                      <Icon icon="solar:check-bold" className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSetupData({ ...setupData, channels: { ...setupData.channels, email: !setupData.channels.email }})}
                className={cn(
                  "relative p-6 border-2 rounded-xl cursor-pointer transition-all",
                  setupData.channels.email 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "p-3 rounded-lg",
                        setupData.channels.email ? "bg-blue-100" : "bg-gray-100"
                      )}>
                        <Icon 
                          icon="solar:letter-bold-duotone" 
                          className={cn(
                            "w-8 h-8",
                            setupData.channels.email ? "text-blue-600" : "text-gray-400"
                          )}
                        />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Email Messages</h3>
                    </div>
                    <p className="text-gray-600 mb-4">Detailed messages with rich formatting</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">Rich HTML content</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">Attachments support</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">Tracking available</span>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    setupData.channels.email 
                      ? "border-blue-500 bg-blue-500" 
                      : "border-gray-300"
                  )}>
                    {setupData.channels.email && (
                      <Icon icon="solar:check-bold" className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        );
        
      case 1: // Timing
        return (
          <div>
            <TimingPicker
              value={setupData.timings}
              onChange={(timings) => setSetupData({ ...setupData, timings })}
              maxTimings={5}
              customTemplates={customTimingTemplates}
              onCustomTemplateAdd={(template) => {
                setCustomTimingTemplates([...customTimingTemplates, template]);
              }}
              onCustomTemplateRemove={(id) => {
                setCustomTimingTemplates(customTimingTemplates.filter(t => t.id !== id));
              }}
              className="max-w-3xl mx-auto"
            />
          </div>
        );
        
      case 2: // Customize
        return (
          <div className="space-y-6">
            {/* SMS Template */}
            {setupData.channels.sms && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Icon icon="solar:chat-round-bold-duotone" className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">SMS Message</h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Template Selector */}
                    <TemplateSelector
                      practiceId={user?.practice_id || ''}
                      type="sms"
                      selectedTemplateId={setupData.smsTemplateId}
                      onTemplateSelect={(templateId, variables) => {
                        setSetupData({
                          ...setupData,
                          smsTemplateId: templateId,
                          smsTemplateVariables: variables || []
                        });
                      }}
                      templateType={selectedCard?.id === 'appointment-reminder' ? 'appointment_reminder' : undefined}
                    />

                    {/* Custom Message Input (only show if no template selected) */}
                    {!setupData.smsTemplateId && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
                          <textarea
                            value={setupData.smsTemplate.body}
                            onChange={(e) => setSetupData({ 
                              ...setupData, 
                              smsTemplate: { ...setupData.smsTemplate, body: e.target.value }
                            })}
                            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            rows={5}
                            maxLength={160}
                          />
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                              {setupData.smsTemplate.body.length}/160 characters
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Quick Variables</p>
                          <div className="flex flex-wrap gap-2">
                            {['{{patientName}}', '{{appointmentDate}}', '{{appointmentTime}}', '{{practicePhone}}'].map(variable => (
                              <button
                                key={variable}
                                onClick={() => {
                                  const newBody = setupData.smsTemplate.body + ' ' + variable;
                                  if (newBody.length <= 160) {
                                    setSetupData({ 
                                      ...setupData, 
                                      smsTemplate: { ...setupData.smsTemplate, body: newBody }
                                    });
                                  }
                                }}
                                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
                              >
                                {variable}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Live Preview</label>
                    <div className="bg-gray-100 rounded-xl p-4">
                      <div className="bg-white rounded-lg shadow-sm p-4 max-w-sm mx-auto">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                            <Icon icon="solar:chat-round-bold" className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">HealthCare Clinic</p>
                            <p className="text-xs text-gray-500">SMS • Just now</p>
                          </div>
                        </div>
                        <div className="bg-purple-100 rounded-lg p-3">
                          <p className="text-sm text-gray-800">
                            {replaceVariables(setupData.smsTemplate.body) || 'Your message will appear here...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            {setupData.channels.sms && setupData.channels.email && (
              <div className="border-t border-gray-200"></div>
            )}

            {/* Email Template */}
            {setupData.channels.email && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Email Message</h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Template Selector */}
                    <TemplateSelector
                      practiceId={user?.practice_id || ''}
                      type="email"
                      selectedTemplateId={setupData.emailTemplateId}
                      onTemplateSelect={(templateId, variables) => {
                        setSetupData({
                          ...setupData,
                          emailTemplateId: templateId,
                          emailTemplateVariables: variables || []
                        });
                      }}
                      templateType={selectedCard?.id === 'appointment-reminder' ? 'appointment_reminder' : undefined}
                    />

                    {/* Custom Message Input (only show if no template selected) */}
                    {!setupData.emailTemplateId && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
                          <input
                            type="text"
                            value={setupData.emailTemplate.subject}
                            onChange={(e) => setSetupData({ 
                              ...setupData, 
                              emailTemplate: { ...setupData.emailTemplate, subject: e.target.value }
                            })}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter email subject..."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email Body</label>
                          <textarea
                            value={setupData.emailTemplate.body}
                            onChange={(e) => setSetupData({ 
                              ...setupData, 
                              emailTemplate: { ...setupData.emailTemplate, body: e.target.value }
                            })}
                            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={8}
                          />
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Quick Variables</p>
                          <div className="flex flex-wrap gap-2">
                            {['{{patientName}}', '{{appointmentDate}}', '{{appointmentTime}}', '{{doctorName}}', '{{practiceName}}'].map(variable => (
                              <button
                                key={variable}
                                onClick={() => {
                                  setSetupData({ 
                                    ...setupData, 
                                    emailTemplate: { 
                                      ...setupData.emailTemplate, 
                                      body: setupData.emailTemplate.body + ' ' + variable 
                                    }
                                  });
                                }}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                              >
                                {variable}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Live Preview</label>
                    <div className="bg-gray-100 rounded-xl p-4 h-full">
                      <div className="bg-white rounded-lg shadow-sm h-full overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b">
                          <p className="text-sm font-medium text-gray-700">
                            {replaceVariables(setupData.emailTemplate.subject) || 'Email subject...'}
                          </p>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                              <Icon icon="solar:hospital-bold" className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">HealthCare Clinic</p>
                              <p className="text-sm text-gray-500">noreply@healthcareclinic.com</p>
                            </div>
                          </div>
                          <div className="prose prose-sm max-w-none">
                            <p className="whitespace-pre-wrap text-gray-700">
                              {replaceVariables(setupData.emailTemplate.body) || 'Your email content will appear here...'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        
      case 3: // Review
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Automation Summary</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:chat-round-bold-duotone" className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Communication Channels</p>
                    <div className="flex gap-2 mt-1">
                      {setupData.channels.sms && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">SMS</span>
                      )}
                      {setupData.channels.email && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">Email</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Reminder Schedule</p>
                    <div className="mt-1 space-y-1">
                      {setupData.timings.filter(t => t.enabled).map(timing => (
                        <p key={timing.id} className="text-sm text-gray-600">
                          • {timing.label || `${timing.value} ${timing.unit} before`}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Activation Mode</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {setupData.testMode ? 'Test Mode - Messages will only be sent to staff' : 'Live Mode - Messages will be sent to all patients'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setupData.testMode}
                  onChange={(e) => setSetupData({ ...setupData, testMode: e.target.checked })}
                  className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500 mt-0.5"
                />
                <div>
                  <p className="font-medium text-gray-900">Enable Test Mode</p>
                  <p className="text-sm text-gray-600 mt-1">
                    We recommend testing your automation with staff members before activating for all patients.
                    In test mode, messages will only be sent to practice staff email addresses and phone numbers.
                  </p>
                </div>
              </label>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header Section */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg">
              <Icon icon="solar:magic-stick-3-bold-duotone" className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Smart Automations</h2>
              <p className="text-gray-600 mt-1">Set up automated patient communications in minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Process Automations Button */}
            <motion.button
              onClick={async () => {
                try {
                  const toastId = toast.loading('Processing pending automations...');
                  const result = await triggerAutomationEngine();
                  
                  if (result.success && result.pendingCount > 0) {
                    toast.success(`Processed ${result.pendingCount} pending automation${result.pendingCount > 1 ? 's' : ''}`, { id: toastId });
                  } else if (result.success && result.pendingCount === 0) {
                    toast.success('No pending automations to process', { id: toastId });
                  } else {
                    toast.error('Failed to process automations', { id: toastId });
                  }
                } catch (error) {
                  console.error('Error triggering automation engine:', error);
                  toast.error('Failed to trigger automation processing');
                }
              }}
              className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:shadow-lg transition-all text-sm font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon icon="solar:play-circle-bold" className="w-4 h-4" />
              <span>Process Automations</span>
            </motion.button>
            
            {/* Create Custom Automation Button - Top Right */}
            <motion.button
              onClick={() => setShowCreateAutomation(true)}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:shadow-lg transition-all text-sm font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
              <span>Create Custom Automation</span>
            </motion.button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { id: 'all', label: 'All Automations', count: allAutomations.length, icon: 'solar:widget-6-bold-duotone' },
            { id: 'active', label: 'Active', count: allAutomations.filter(c => c.isActive).length, icon: 'solar:play-circle-bold-duotone' },
            { id: 'inactive', label: 'Inactive', count: allAutomations.filter(c => !c.isActive).length, icon: 'solar:pause-bold-duotone' }
          ].map(view => (
            <motion.button
              key={view.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveView(view.id as 'all' | 'active' | 'inactive')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeView === view.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Icon icon={view.icon} className="w-4 h-4" />
              <span>{view.label}</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                activeView === view.id
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-200 text-gray-600"
              )}>
                {view.count}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-8 py-4 bg-white/50 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Icon icon="solar:magnifer-bold-duotone" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search automations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-sm"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {categories.map(category => (
              <motion.button
                key={category.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCategoryFilter(category.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                  categoryFilter === category.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <Icon icon={category.icon} className="w-4 h-4 flex-shrink-0" />
                <span>{category.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {filteredCards.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-6">
                <Icon icon="solar:automation-bold-duotone" className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No automations found</h3>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredCards.map((card, index) => {
                const categoryStyle = getCategoryStyle(card.category);
                
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={cn(
                      "bg-white rounded-xl shadow-md overflow-hidden border transition-all",
                      card.isActive ? categoryStyle.borderColor : 'border-gray-200',
                      "hover:shadow-xl relative"
                    )}
                  >
                    {/* Top Right Controls */}
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                      {/* Configure Button */}
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(card);
                        }}
                        className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Configure settings"
                      >
                        <Icon icon="solar:settings-minimalistic-bold-duotone" className="w-4 h-4" />
                      </motion.button>
                      
                      {/* Delete button for custom automations */}
                      {card.id.startsWith('custom-') && (
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomAutomation(card.id);
                          }}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Delete custom automation"
                        >
                          <Icon icon="solar:trash-bin-minimalistic-bold" className="w-4 h-4" />
                        </motion.button>
                      )}
                    </div>

                    {/* Card Header */}
                    <div 
                      className={cn(
                        "p-6 cursor-pointer",
                        card.isActive ? categoryStyle.bgColor : 'bg-gray-50'
                      )}
                      onClick={() => handleCardClick(card)}
                    >
                      <div className="flex items-start">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-lg",
                            categoryStyle.bgColor
                          )}>
                            <Icon 
                              icon={card.icon} 
                              className={cn(
                                "w-6 h-6",
                                categoryStyle.color
                              )}
                            />
                          </div>
                          <div className="pr-12">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                              {card.name}
                              {card.id.startsWith('custom-') && (
                                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">Custom</span>
                              )}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">{card.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div 
                      className="p-6 pt-0 space-y-4 cursor-pointer"
                      onClick={() => handleCardClick(card)}
                    >
                      {/* Channel Configuration */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Channels</p>
                        <div className="flex gap-2">
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm",
                            card.defaultChannels.some(c => c.type === 'SMS' || c.type === 'BOTH') 
                              ? "bg-purple-50 border-purple-200 text-purple-700"
                              : "bg-gray-50 border-gray-200 text-gray-400"
                          )}>
                            <Icon icon="solar:chat-round-bold-duotone" className="w-4 h-4" />
                            <span>SMS</span>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm",
                            card.defaultChannels.some(c => c.type === 'EMAIL' || c.type === 'BOTH')
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-gray-50 border-gray-200 text-gray-400"
                          )}>
                            <Icon icon="solar:letter-bold-duotone" className="w-4 h-4" />
                            <span>Email</span>
                          </div>
                        </div>
                      </div>

                      {/* Timing Configuration */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Timing</p>
                        <div className="space-y-1">
                          {card.defaultTimings.filter(t => t.enabled).map(timing => (
                            <div key={timing.id} className="flex items-center gap-2 text-sm text-gray-600">
                              <Icon icon="solar:clock-circle-bold" className="w-3.5 h-3.5 text-gray-400" />
                              <span>{timing.label || `${timing.value} ${timing.unit} ${timing.when || 'before'}`}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Stats */}
                      {card.isActive && card.stats && (
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Success Rate</span>
                            <span className="font-medium text-green-600">{card.stats.success_rate}%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Activation Toggle */}
                    <div className="p-6 pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Automation Status</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={card.isActive}
                            onChange={() => toggleCardActivation(card)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-green-600"></div>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Setup Wizard Modal */}
      {showSetupWizard && selectedCard && (
        <motion.div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] max-h-[900px] flex flex-col overflow-hidden"
          >
            {/* Wizard Header with Embedded Stepper */}
            <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
              <div className="p-6 pb-2">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedCard.name}</h2>
                    <p className="text-gray-600 mt-1">{selectedCard.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSetupWizard(false);
                      setSelectedCard(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>
              
              {/* Embedded Professional Stepper */}
              <div className="px-6 pb-6">
                <Stepper 
                  steps={steps}
                  currentStep={currentStep}
                  variant="embedded"
                  size="md"
                  colorScheme="primary"
                />
              </div>
            </div>

            {/* Wizard Content */}
            <div className="flex-1 p-8 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Wizard Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <motion.button
                  onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : null}
                  className={cn(
                    "px-6 py-2.5 border rounded-lg font-medium transition-all flex items-center gap-2",
                    currentStep > 0 
                      ? "border-gray-300 text-gray-700 hover:bg-gray-100" 
                      : "border-gray-200 text-gray-400 cursor-not-allowed"
                  )}
                  disabled={currentStep === 0}
                  whileHover={currentStep > 0 ? { scale: 1.05 } : {}}
                  whileTap={currentStep > 0 ? { scale: 0.95 } : {}}
                >
                  <motion.div
                    animate={{ x: currentStep > 0 ? [0, -3, 0] : 0 }}
                    transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <Icon icon="solar:arrow-left-bold-duotone" className="w-4 h-4" />
                  </motion.div>
                  Back
                </motion.button>
                
                {currentStep < steps.length - 1 ? (
                  <motion.button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={
                      (currentStep === 0 && !setupData.channels.sms && !setupData.channels.email) ||
                      (currentStep === 1 && !setupData.timings.some(t => t.enabled))
                    }
                    className={cn(
                      "px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 shadow-md",
                      ((currentStep === 0 && (!setupData.channels.sms && !setupData.channels.email)) ||
                       (currentStep === 1 && !setupData.timings.some(t => t.enabled)))
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:shadow-lg"
                    )}
                    whileHover={
                      !((currentStep === 0 && (!setupData.channels.sms && !setupData.channels.email)) ||
                        (currentStep === 1 && !setupData.timings.some(t => t.enabled)))
                        ? { scale: 1.05 } : {}
                    }
                    whileTap={
                      !((currentStep === 0 && (!setupData.channels.sms && !setupData.channels.email)) ||
                        (currentStep === 1 && !setupData.timings.some(t => t.enabled)))
                        ? { scale: 0.95 } : {}
                    }
                  >
                    Continue
                    <motion.div
                      animate={{ x: [0, 3, 0] }}
                      transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Icon icon="solar:arrow-right-bold-duotone" className="w-4 h-4" />
                    </motion.div>
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={saveAutomation}
                    className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2 shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                    </motion.div>
                    {setupData.testMode ? 'Save in Test Mode' : 'Activate Automation'}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Custom Automation Creation Modal */}
      {showCreateAutomation && (
        <motion.div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] max-h-[800px] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Create Custom Automation</h2>
                  <p className="text-purple-100 mt-1">Design your own automation workflow</p>
                </div>
                <button
                  onClick={() => setShowCreateAutomation(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-purple-600" />
                    Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Automation Name *</label>
                      <input
                        type="text"
                        value={newAutomation.name}
                        onChange={(e) => setNewAutomation({ ...newAutomation, name: e.target.value })}
                        placeholder="e.g., Weekly Health Tips"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        value={newAutomation.category}
                        onChange={(e) => setNewAutomation({ ...newAutomation, category: e.target.value as AutomationCard['category'] })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="appointment">Appointment</option>
                        <option value="health">Health</option>
                        <option value="billing">Billing</option>
                        <option value="engagement">Engagement</option>
                        <option value="marketing">Marketing</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                    <textarea
                      value={newAutomation.description}
                      onChange={(e) => setNewAutomation({ ...newAutomation, description: e.target.value })}
                      placeholder="e.g., Send weekly health tips and wellness advice to engaged patients"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        'solar:star-bold-duotone',
                        'solar:heart-bold-duotone',
                        'solar:bell-bold-duotone',
                        'solar:calendar-bold-duotone',
                        'solar:chat-round-bold-duotone',
                        'solar:letter-bold-duotone',
                        'solar:pill-bold-duotone',
                        'solar:test-tube-bold-duotone',
                        'solar:document-text-bold-duotone',
                        'solar:gift-bold-duotone',
                        'solar:notification-bold-duotone',
                        'solar:folder-with-files-bold-duotone'
                      ].map(icon => (
                        <button
                          key={icon}
                          onClick={() => setNewAutomation({ ...newAutomation, icon })}
                          className={cn(
                            "p-3 rounded-lg border transition-all",
                            newAutomation.icon === icon
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <Icon icon={icon} className="w-6 h-6 text-gray-700" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Channel Configuration */}
                <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Icon icon="solar:chat-round-bold-duotone" className="w-5 h-5 text-purple-600" />
                    Communication Channels
                  </h3>
                  
                  <div className="space-y-4">
                    {/* SMS Channel */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAutomation.channels.sms.enabled}
                          onChange={(e) => setNewAutomation({
                            ...newAutomation,
                            channels: {
                              ...newAutomation.channels,
                              sms: { ...newAutomation.channels.sms, enabled: e.target.checked }
                            }
                          })}
                          className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:smartphone-bold-duotone" className="w-5 h-5 text-purple-600" />
                          <span className="font-medium">SMS</span>
                        </div>
                      </label>
                      
                      {newAutomation.channels.sms.enabled && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">SMS Template</label>
                          <textarea
                            value={newAutomation.channels.sms.template}
                            onChange={(e) => setNewAutomation({
                              ...newAutomation,
                              channels: {
                                ...newAutomation.channels,
                                sms: { ...newAutomation.channels.sms, template: e.target.value }
                              }
                            })}
                            placeholder="Hi {{patientName}}, this is your custom message..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            rows={3}
                            maxLength={160}
                          />
                          <p className="text-xs text-gray-500 mt-1">{newAutomation.channels.sms.template.length}/160 characters</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Email Channel */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAutomation.channels.email.enabled}
                          onChange={(e) => setNewAutomation({
                            ...newAutomation,
                            channels: {
                              ...newAutomation.channels,
                              email: { ...newAutomation.channels.email, enabled: e.target.checked }
                            }
                          })}
                          className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 text-blue-600" />
                          <span className="font-medium">Email</span>
                        </div>
                      </label>
                      
                      {newAutomation.channels.email.enabled && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email Subject</label>
                            <input
                              type="text"
                              value={newAutomation.channels.email.subject}
                              onChange={(e) => setNewAutomation({
                                ...newAutomation,
                                channels: {
                                  ...newAutomation.channels,
                                  email: { ...newAutomation.channels.email, subject: e.target.value }
                                }
                              })}
                              placeholder="Your Custom Subject - {{practiceName}}"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email Body</label>
                            <textarea
                              value={newAutomation.channels.email.template}
                              onChange={(e) => setNewAutomation({
                                ...newAutomation,
                                channels: {
                                  ...newAutomation.channels,
                                  email: { ...newAutomation.channels.email, template: e.target.value }
                                }
                              })}
                              placeholder="Dear {{patientName}},\n\nYour custom email content here...\n\nBest regards,\n{{practiceName}}"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              rows={5}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timing Configuration */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-purple-600" />
                    Timing Configuration
                  </h3>
                  
                  <TimingPicker
                    value={newAutomation.timing}
                    onChange={(timing) => setNewAutomation({ ...newAutomation, timing })}
                    maxTimings={5}
                  />
                </div>

                {/* Available Variables */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-2">Available Variables</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          '{{patientName}}',
                          '{{practiceName}}',
                          '{{practicePhone}}',
                          '{{appointmentDate}}',
                          '{{appointmentTime}}',
                          '{{doctorName}}',
                          '{{confirmationCode}}'
                        ].map(variable => (
                          <code key={variable} className="px-2 py-1 bg-blue-100 rounded text-xs">
                            {variable}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowCreateAutomation(false)}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all font-medium"
                >
                  Cancel
                </button>
                <motion.button
                  onClick={createCustomAutomation}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                  Create Automation
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default SmartAutomations;