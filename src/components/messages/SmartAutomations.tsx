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
import { TemplateSelector } from '../ui/TemplateSelector';
import { TemplateEditor } from '../ui/TemplateEditor';
import { emailTemplateService } from '../../services/emailTemplateService';

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
  {
    id: 'imaging-results',
    name: 'Imaging Results Ready',
    category: 'health',
    description: 'Notify when imaging results are available',
    icon: 'solar:bone-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Your Imaging Results Are Ready',
          body: 'Dear {{patientName}}, your imaging results from {{imagingDate}} are now available. Please log in to your patient portal at {{portalLink}} or call {{practicePhone}} to discuss with your doctor.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Immediately', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },

  // Billing & Payment Related

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
      { id: '1', label: 'Birthday morning at 9 AM', value: 9, unit: 'hours', when: 'after', enabled: true, timeOfDay: '09:00' }
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
  
  // Additional 10 Templates
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
  
  // New Templates Added
  {
    id: 'invoice-sent',
    name: 'Invoice Sent',
    category: 'billing',
    description: 'Send invoices to patients after visits',
    icon: 'solar:document-text-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Invoice #{{invoiceNumber}} - {{practiceName}}',
          body: 'Dear {{patientName}},\n\nThank you for your visit on {{visitDate}}. Please find attached your invoice for the services rendered.\n\nInvoice Number: {{invoiceNumber}}\nTotal Amount: {{invoiceAmount}}\nDue Date: {{dueDate}}\n\nYou can pay online at: {{paymentLink}}\n\nFor any questions, please contact us at {{practicePhone}}.\n\nBest regards,\n{{practiceName}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Immediately after visit', value: 0, unit: 'minutes', when: 'after', enabled: true },
      { id: '2', label: '1 day after visit', value: 1, unit: 'days', when: 'after', enabled: false }
    ]
  },
  {
    id: 'leave-form-ready',
    name: 'Leave Form Ready',
    category: 'health',
    description: 'Send medical leave certificates to patients',
    icon: 'solar:document-medicine-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Medical Leave Certificate - {{practiceName}}',
          body: 'Dear {{patientName}},\n\nYour medical leave certificate is ready.\n\nLeave Period: {{leaveFromDate}} to {{leaveToDate}}\nTotal Days: {{leaveDays}}\nDiagnosis: {{diagnosis}}\nFitness Status: {{fitnessStatus}}\n\nPlease find the certificate attached. If you need any modifications, contact us at {{practicePhone}}.\n\nGet well soon!\n{{doctorName}}\n{{practiceName}}'
        }
      },
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, your medical leave certificate ({{leaveDays}} days) is ready. Check your email or collect from reception. {{practiceName}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'When leave form is issued', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },
  {
    id: 'prescription-ready',
    name: 'Prescription Ready',
    category: 'health',
    description: 'Send prescriptions to patients',
    icon: 'solar:pills-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Your Prescription - {{practiceName}}',
          body: 'Dear {{patientName}},\n\nYour prescription from Dr. {{doctorName}} is ready.\n\nMedications prescribed:\n{{medicationsList}}\n\nPlease take medications as directed. The prescription has been sent to your preferred pharmacy: {{pharmacyName}}.\n\nFor any questions about your medications, contact us at {{practicePhone}}.\n\nBest regards,\n{{practiceName}}'
        }
      },
      {
        type: 'SMS',
        enabled: true,
        template: {
          body: 'Hi {{patientName}}, your prescription is ready at {{pharmacyName}}. {{medicationCount}} medications prescribed. Questions? Call {{practicePhone}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'After prescription created', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },
  {
    id: 'transactions-import',
    name: 'Bank Transactions Import',
    category: 'billing',
    description: 'Import bank transactions from Gmail',
    icon: 'solar:card-transfer-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Transaction Import Summary - {{practiceName}}',
          body: 'Transaction import completed.\n\nImported: {{transactionCount}} transactions\nTotal Amount: {{totalAmount}}\nDate Range: {{fromDate}} to {{toDate}}\n\nKeywords matched: {{matchedKeywords}}\n\nReview imported transactions in the reconciliation module.'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Daily at 9 AM', value: 9, unit: 'hours', when: 'daily', enabled: true, timeOfDay: '09:00' },
      { id: '2', label: 'Daily at 6 PM', value: 18, unit: 'hours', when: 'daily', enabled: false, timeOfDay: '18:00' }
    ]
  },
  {
    id: 'remittance-recon',
    name: 'Auto Reconciliation Remittance',
    category: 'billing',
    description: 'Automatic payment reconciliation from medical aids',
    icon: 'solar:safe-square-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Remittance Reconciliation Report - {{practiceName}}',
          body: 'Remittance reconciliation completed.\n\nMedical Aid: {{medicalAidName}}\nRemittance Date: {{remittanceDate}}\nClaims Processed: {{claimsCount}}\n\nPaid: {{paidCount}} claims ({{paidAmount}})\nPartially Paid: {{partialCount}} claims ({{partialAmount}})\nRejected: {{rejectedCount}} claims ({{rejectedAmount}})\n\nView full report: {{reportLink}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'When remittance received', value: 0, unit: 'minutes', when: 'after', enabled: true }
    ]
  },
  {
    id: 'batch-submission',
    name: 'Batch Submission to Medical Aids',
    category: 'billing',
    description: 'Auto-submit claim batches to medical aid emails',
    icon: 'solar:inbox-line-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Batch Submission Completed - {{batchNumber}}',
          body: 'Batch submission successful.\n\nBatch Number: {{batchNumber}}\nMedical Aid: {{medicalAidName}}\nClaims: {{claimsCount}}\nTotal Amount: {{totalAmount}}\n\nSubmitted to: {{medicalAidEmail}}\nSubmission Time: {{submissionTime}}\n\nTracking Reference: {{trackingReference}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: 'Weekly on Monday', value: 1, unit: 'weeks', when: 'weekly', enabled: true, timeOfDay: '08:00' },
      { id: '2', label: 'Every 3 days', value: 3, unit: 'days', when: 'interval', enabled: false },
      { id: '3', label: 'Monthly on 1st', value: 1, unit: 'months', when: 'monthly', enabled: false }
    ]
  },
  {
    id: 'payroll-process',
    name: 'Process Payroll',
    category: 'billing',
    description: 'Automated payroll processing reminders',
    icon: 'solar:wallet-money-bold-duotone',
    isActive: false,
    defaultChannels: [
      {
        type: 'EMAIL',
        enabled: true,
        template: {
          subject: 'Payroll Processing - {{payPeriod}}',
          body: 'Payroll processing initiated.\n\nPay Period: {{payPeriodStart}} to {{payPeriodEnd}}\nEmployees: {{employeeCount}}\nTotal Payroll: {{totalPayroll}}\n\nTimesheets Approved: {{approvedTimesheets}}\nPending Approval: {{pendingTimesheets}}\n\nDeductions Applied:\n{{deductionsList}}\n\nReview and approve payroll: {{payrollLink}}'
        }
      }
    ],
    defaultTimings: [
      { id: '1', label: '3 days before month end', value: 3, unit: 'days', when: 'before_month_end', enabled: true },
      { id: '2', label: 'On 25th of month', value: 25, unit: 'days', when: 'monthly_date', enabled: false },
      { id: '3', label: 'Bi-weekly Friday', value: 2, unit: 'weeks', when: 'biweekly', enabled: false }
    ]
  }
];

// Get available variables based on automation type
const getVariablesForAutomationType = (automationId: string) => {
  const baseVariables = [
    { key: 'patientName', description: 'Patient full name' },
    { key: 'patientFirstName', description: 'Patient first name' },
    { key: 'patientLastName', description: 'Patient last name' },
    { key: 'practiceName', description: 'Practice/clinic name' },
    { key: 'practicePhone', description: 'Practice phone number' },
    { key: 'practiceEmail', description: 'Practice email address' }
  ];

  const appointmentVariables = [
    { key: 'appointmentDate', description: 'Appointment date' },
    { key: 'appointmentTime', description: 'Appointment time' },
    { key: 'doctorName', description: 'Doctor name' },
    { key: 'confirmationCode', description: 'Appointment confirmation code' }
  ];

  const healthVariables = [
    { key: 'medicationName', description: 'Medication name' },
    { key: 'dosageInstructions', description: 'Dosage instructions' },
    { key: 'refillDate', description: 'Refill date' },
    { key: 'testDate', description: 'Test/lab date' },
    { key: 'testName', description: 'Test/lab name' },
    { key: 'imagingDate', description: 'Imaging/X-ray date' },
    { key: 'imagingType', description: 'Type of imaging (X-ray, MRI, etc.)' },
    { key: 'followUpInstructions', description: 'Follow-up care instructions' },
    { key: 'portalLink', description: 'Patient portal link' }
  ];

  const billingVariables = [
    { key: 'invoiceNumber', description: 'Invoice number' },
    { key: 'invoiceAmount', description: 'Invoice amount' },
    { key: 'dueDate', description: 'Payment due date' },
    { key: 'paymentLink', description: 'Online payment link' },
    { key: 'outstandingBalance', description: 'Outstanding balance' }
  ];

  const engagementVariables = [
    { key: 'birthdayOffer', description: 'Birthday special offer' },
    { key: 'referralBonus', description: 'Referral bonus details' },
    { key: 'reviewLink', description: 'Review/feedback link' },
    { key: 'programName', description: 'Wellness program name' },
    { key: 'programDate', description: 'Program start date' },
    { key: 'programDescription', description: 'Program description' }
  ];

  switch (automationId) {
    case 'appointment-reminder':
    case 'appointment-confirmation':
    case 'no-show-followup':
    case 'surgery-pre-op':
      return [...baseVariables, ...appointmentVariables];
    
    case 'follow-up':
    case 'prescription-refill':
    case 'lab-results':
    case 'imaging-results':
    case 'test-results-follow-up':
    case 'post-procedure-care':
    case 'chronic-condition-monitoring':
      return [...baseVariables, ...healthVariables];
    
    case 'invoice-sent':
    case 'payment-received':
    case 'insurance-verification':
    case 'transactions-import':
    case 'remittance-recon':
    case 'batch-submission':
    case 'payroll-process':
      return [...baseVariables, ...billingVariables, 
        { key: 'visitDate', description: 'Visit date' },
        { key: 'batchNumber', description: 'Batch reference number' },
        { key: 'medicalAidName', description: 'Medical aid name' },
        { key: 'medicalAidEmail', description: 'Medical aid email' },
        { key: 'claimsCount', description: 'Number of claims' },
        { key: 'trackingReference', description: 'Tracking reference' },
        { key: 'transactionCount', description: 'Number of transactions' },
        { key: 'matchedKeywords', description: 'Matched keywords' },
        { key: 'remittanceDate', description: 'Remittance date' },
        { key: 'paidCount', description: 'Paid claims count' },
        { key: 'paidAmount', description: 'Paid amount' },
        { key: 'partialCount', description: 'Partially paid count' },
        { key: 'partialAmount', description: 'Partially paid amount' },
        { key: 'rejectedCount', description: 'Rejected claims count' },
        { key: 'rejectedAmount', description: 'Rejected amount' },
        { key: 'reportLink', description: 'Report link' },
        { key: 'payPeriod', description: 'Pay period' },
        { key: 'payPeriodStart', description: 'Pay period start' },
        { key: 'payPeriodEnd', description: 'Pay period end' },
        { key: 'employeeCount', description: 'Number of employees' },
        { key: 'totalPayroll', description: 'Total payroll amount' },
        { key: 'approvedTimesheets', description: 'Approved timesheets' },
        { key: 'pendingTimesheets', description: 'Pending timesheets' },
        { key: 'deductionsList', description: 'List of deductions' },
        { key: 'payrollLink', description: 'Payroll review link' },
        { key: 'submissionTime', description: 'Submission timestamp' },
        { key: 'fromDate', description: 'Date range start' },
        { key: 'toDate', description: 'Date range end' }
      ];
    
    case 'birthday-wishes':
    case 'patient-feedback':
    case 'referral-program':
    case 'wellness-program':
    case 'practice-announcements':
    case 'welcome-new-patient':
    case 'review-request':
      return [...baseVariables, ...engagementVariables];
    
    case 'annual-checkup':
      return [...baseVariables, { key: 'lastVisitDate', description: 'Last visit date' }];
    
    case 'leave-form-ready':
      return [...baseVariables, 
        { key: 'leaveFromDate', description: 'Leave start date' },
        { key: 'leaveToDate', description: 'Leave end date' },
        { key: 'leaveDays', description: 'Total leave days' },
        { key: 'diagnosis', description: 'Medical diagnosis' },
        { key: 'fitnessStatus', description: 'Fitness status' },
        { key: 'doctorName', description: 'Doctor name' }
      ];
    
    case 'prescription-ready':
      return [...baseVariables, ...healthVariables,
        { key: 'medicationsList', description: 'List of medications' },
        { key: 'medicationCount', description: 'Number of medications' },
        { key: 'pharmacyName', description: 'Pharmacy name' }
      ];
    
    default:
      return baseVariables;
  }
};

const SmartAutomations: React.FC = () => {
  const { user } = useAuthStore();
  const [cards, setCards] = useState<AutomationCard[]>(automationCards);
  const [activeView, setActiveView] = useState<'all' | 'active' | 'inactive'>('active');
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

  // Load SMS template content when template is selected
  useEffect(() => {
    const loadSmsTemplate = async () => {
      if (setupData.smsTemplateId) {
        try {
          const template = await emailTemplateService.getSmsTemplate(setupData.smsTemplateId);
          if (template) {
            setSetupData(prev => ({
              ...prev,
              smsTemplate: { body: template.content },
              smsTemplateVariables: template.variables || []
            }));
          }
        } catch (error) {
          console.error('Error loading SMS template:', error);
          toast.error('Failed to load SMS template');
        }
      }
    };
    loadSmsTemplate();
  }, [setupData.smsTemplateId]);  

  // Load Email template content when template is selected
  useEffect(() => {
    const loadEmailTemplate = async () => {
      if (setupData.emailTemplateId) {
        try {
          const template = await emailTemplateService.getEmailTemplate(setupData.emailTemplateId);
          if (template) {
            setSetupData(prev => ({
              ...prev,
              emailTemplate: { 
                subject: template.subject,
                body: template.content 
              },
              emailTemplateVariables: template.variables || []
            }));
          }
        } catch (error) {
          console.error('Error loading email template:', error);
          toast.error('Failed to load email template');
        }
      }
    };
    loadEmailTemplate();
  }, [setupData.emailTemplateId]);  

  const loadActiveAutomations = async () => {
    if (!user?.practice_id) return;
    
    try {
      const { data, error } = await supabase
        .from('practice_automation_settings')
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
        if (settings) {
          // Convert from database format to card format
          const channels: ChannelConfig[] = [];
          
          if (settings.sms_enabled) {
            channels.push({
              type: 'SMS',
              enabled: true,
              template: {
                body: settings.sms_template || card.defaultChannels.find(c => c.type === 'SMS')?.template?.body || ''
              }
            });
          }
          
          if (settings.email_enabled) {
            channels.push({
              type: 'EMAIL', 
              enabled: true,
              template: {
                subject: settings.email_subject || card.defaultChannels.find(c => c.type === 'EMAIL')?.template?.subject || '',
                body: settings.email_body || card.defaultChannels.find(c => c.type === 'EMAIL')?.template?.body || ''
              }
            });
          }
          
          return {
            ...card,
            isActive: settings.enabled || false,
            defaultChannels: channels.length > 0 ? channels : card.defaultChannels,
            defaultTimings: settings.timings?.timings || card.defaultTimings
          };
        }
        return card;
      });
      
      setCards(updatedCards);
    } catch (error) {
      console.error('Error loading automations:', error);
    }
  };

  const toggleCardActivation = async (card: AutomationCard) => {
    try {
      const newStatus = !card.isActive;
      
      const { error } = await supabase
        .from('practice_automation_settings')
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
          .from('practice_automation_settings')
          .select('*')
          .eq('practice_id', user.practice_id)
          .eq('automation_id', card.id)
          .single();
          
        if (!error && data) {
          // Update setup data with saved settings
          setupDataToUse = {
            channels: {
              sms: data.sms_enabled || false,
              email: data.email_enabled || false
            },
            timings: data.timings?.timings || card.defaultTimings,
            smsTemplate: { 
              body: data.sms_template || setupDataToUse.smsTemplate.body 
            },
            emailTemplate: { 
              subject: data.email_subject || setupDataToUse.emailTemplate.subject,
              body: data.email_body || setupDataToUse.emailTemplate.body
            },
            smsTemplateId: null,
            emailTemplateId: null,
            smsTemplateVariables: [],
            emailTemplateVariables: [],
            testMode: !data.enabled
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
          .from('practice_automation_settings')
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
        .from('practice_automation_settings')
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
    if (!selectedCard || !user?.practice_id) return;
    
    try {
      // Prepare the data for practice_automation_settings table
      const settingsData = {
        practice_id: user.practice_id,
        automation_id: selectedCard.id,
        enabled: true,
        sms_enabled: setupData.channels.sms,
        email_enabled: setupData.channels.email,
        sms_template: setupData.channels.sms ? setupData.smsTemplate.body : null,
        email_subject: setupData.channels.email ? setupData.emailTemplate.subject : null,
        email_body: setupData.channels.email ? setupData.emailTemplate.body : null,
        timings: {
          timings: setupData.timings,
          testMode: setupData.testMode
        },
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('practice_automation_settings')
        .upsert(settingsData, {
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
    const sampleData: Record<string, string> = {
      // camelCase versions
      patientName: 'John Smith',
      patientFirstName: 'John',
      appointmentDate: format(new Date(Date.now() + 86400000), 'MMMM d, yyyy'),
      appointmentTime: '2:30 PM',
      doctorName: 'Dr. Sarah Johnson',
      practicePhone: '(555) 123-4567',
      practiceName: 'HealthCare Clinic',
      practiceEmail: 'info@healthcareclinic.com',
      practiceAddress: '123 Main St, City, State 12345',
      practiceLogo: '/logo.png',
      branchName: 'Main Branch',
      branchAddress: '123 Main St',
      invoiceNumber: 'INV-2024-001',
      invoiceDate: 'March 1, 2024',
      invoiceAmount: '$250.00',
      amount: '$125.00',
      dueDate: 'March 31, 2024',
      billingPhone: '(123) 456-7891',
      billingEmail: 'billing@practice.com',
      taxNumber: '123-45-6789',
      practiceHours: 'Mon-Fri 9AM-5PM',
      confirmationCode: 'APT-12345',
      paymentLink: 'pay.healthcareclinic.com',
      followUpInstructions: 'take your medication daily and rest',
      message: 'this is your customized message',
      medicationName: 'Aspirin',
      dosageInstructions: 'Take 1 tablet daily with food',
      testDate: 'March 10, 2024',
      portalLink: 'portal.healthcareclinic.com',
      transactionId: 'TRX-12345',
      paymentDate: format(new Date(), 'MMMM d, yyyy'),
      conditionType: 'Diabetes',
      programName: 'Wellness Program',
      programDate: 'April 1, 2024',
      programDescription: 'Join our wellness program for better health',
      // snake_case versions (for backward compatibility)
      patient_name: 'John Smith',
      appointment_date: format(new Date(Date.now() + 86400000), 'MMMM d, yyyy'),
      appointment_time: '2:30 PM',
      doctor_name: 'Dr. Sarah Johnson',
      practice_phone: '(555) 123-4567',
      practice_name: 'HealthCare Clinic',
      practice_email: 'info@healthcareclinic.com',
      practice_address: '123 Main St, City, State 12345',
      practice_logo: '/logo.png',
      branch_name: 'Main Branch',
      branch_address: '123 Main St'
    };

    let result = text;
    // Replace all variables in {{variableName}} format
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
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

                    {/* Message Editor - Always show to allow template customization */}
                    {setupData.smsTemplateId && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 mb-2">
                        <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                        <span>Editing template - Feel free to customize the message</span>
                      </div>
                    )}
                    <TemplateEditor
                      type="sms"
                      content={setupData.smsTemplate.body}
                      variables={getVariablesForAutomationType(selectedCard?.id || '')}
                      onUpdate={(data) => {
                        setSetupData({
                          ...setupData,
                          smsTemplate: { ...setupData.smsTemplate, body: data.content },
                          // Keep the template ID to show it's based on a template
                        });
                      }}
                    />
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
                            {replaceVariables(setupData.smsTemplate.body || '') || 'Your message will appear here...'}
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

                    {/* Message Editor - Always show to allow template customization */}
                    {setupData.emailTemplateId && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 mb-2">
                        <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                        <span>Editing template - Feel free to customize the message</span>
                      </div>
                    )}
                    <TemplateEditor
                      type="email"
                      subject={setupData.emailTemplate.subject}
                      content={setupData.emailTemplate.body}
                      variables={getVariablesForAutomationType(selectedCard?.id || '')}
                      onUpdate={(data) => setSetupData({
                        ...setupData,
                        emailTemplate: { 
                          subject: data.subject || setupData.emailTemplate.subject,
                          body: data.content 
                        }
                      })}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Live Preview</label>
                    <div className="bg-gray-100 rounded-xl p-4 h-full">
                      <div className="bg-white rounded-lg shadow-sm h-full overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b">
                          <p className="text-sm font-medium text-gray-700">
                            {replaceVariables(setupData.emailTemplate.subject || '') || 'Email subject...'}
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
                              {replaceVariables(setupData.emailTemplate.body || '') || 'Your email content will appear here...'}
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
                          <TemplateEditor
                            type="sms"
                            content={newAutomation.channels.sms.template}
                            variables={getVariablesForAutomationType(newAutomation.trigger)}
                            onUpdate={(data) => setNewAutomation({
                              ...newAutomation,
                              channels: {
                                ...newAutomation.channels,
                                sms: { ...newAutomation.channels.sms, template: data.content }
                              }
                            })}
                          />
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
                        <div className="mt-4">
                          <TemplateEditor
                            type="email"
                            subject={newAutomation.channels.email.subject}
                            content={newAutomation.channels.email.template}
                            variables={getVariablesForAutomationType(newAutomation.trigger)}
                            onUpdate={(data) => setNewAutomation({
                              ...newAutomation,
                              channels: {
                                ...newAutomation.channels,
                                email: { 
                                  ...newAutomation.channels.email, 
                                  subject: data.subject || newAutomation.channels.email.subject,
                                  template: data.content 
                                }
                              }
                            })}
                          />
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