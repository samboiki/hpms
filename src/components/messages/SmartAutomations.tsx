import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Edit3, 
  Trash2,
  Play,
  Pause,
  Settings,
  Calendar,
  Bell,
  Heart,
  Gift,
  DollarSign,
  FileText,
  Users,
  Sparkles,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Clock,
  MessageSquare,
  Mail,
  Star,
  Target,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import VisualWorkflowBuilder from './VisualWorkflowBuilder';

interface CommunicationCampaign {
  id: string;
  name: string;
  category: 'appointment' | 'lifecycle' | 'health' | 'practice' | 'marketing';
  description: string;
  icon: any;
  color: string;
  gradient: string;
  templates: Template[];
  triggers: Trigger[];
  is_active: boolean;
  is_preset: boolean;
  setup_progress: number;
  performance?: {
    sent: number;
    delivered: number;
    engagement: number;
  };
  created_at?: string;
}

interface Template {
  id: string;
  name: string;
  type: 'SMS' | 'EMAIL';
  subject?: string;
  body: string;
  variables: string[];
}

interface Trigger {
  event: string;
  timing: string;
  conditions?: any;
}

const SmartAutomations: React.FC = () => {
  const [campaigns, setCampaigns] = useState<CommunicationCampaign[]>([]);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'templates'>('presets');
  const [selectedCampaign, setSelectedCampaign] = useState<CommunicationCampaign | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Pre-built Communication Campaigns
  const presetCampaigns: CommunicationCampaign[] = [
    {
      id: 'preset-appointment-reminders',
      name: 'Appointment Reminders',
      category: 'appointment',
      description: 'Reduce no-shows with automated 24h and 2h appointment reminders',
      icon: Calendar,
      color: 'blue',
      gradient: 'from-blue-500 to-indigo-600',
      is_preset: true,
      is_active: false,
      setup_progress: 0,
      templates: [
        {
          id: 'tmpl-24h-reminder',
          name: '24 Hour SMS Reminder',
          type: 'SMS',
          body: 'Hi {patientName}, this is a reminder about your appointment with Dr. {doctorName} tomorrow at {appointmentTime}. Please call {clinicPhone} if you need to reschedule.',
          variables: ['patientName', 'doctorName', 'appointmentTime', 'clinicPhone']
        },
        {
          id: 'tmpl-2h-reminder',
          name: '2 Hour SMS Reminder',
          type: 'SMS',
          body: 'Hello {patientName}, your appointment with Dr. {doctorName} is in 2 hours at {appointmentTime}. Please arrive 15 minutes early. Location: {clinicName}',
          variables: ['patientName', 'doctorName', 'appointmentTime', 'clinicName']
        },
        {
          id: 'tmpl-confirmation-email',
          name: 'Appointment Confirmation',
          type: 'EMAIL',
          subject: 'Appointment Confirmed - {appointmentDate}',
          body: 'Dear {patientName},\\n\\nYour appointment has been confirmed for {appointmentDate} at {appointmentTime} with Dr. {doctorName}.\\n\\nPlease arrive 15 minutes early and bring your ID and medical aid card.\\n\\nBest regards,\\n{clinicName}',
          variables: ['patientName', 'appointmentDate', 'appointmentTime', 'doctorName', 'clinicName']
        }
      ],
      triggers: [
        { event: 'appointment_scheduled', timing: 'immediate' },
        { event: 'appointment_reminder', timing: '24_hours_before' },
        { event: 'appointment_reminder', timing: '2_hours_before' }
      ],
      performance: { sent: 0, delivered: 0, engagement: 0 }
    },
    {
      id: 'preset-birthday-greetings',
      name: 'Birthday Greetings',
      category: 'lifecycle',
      description: 'Send personalized birthday wishes and promote annual checkups',
      icon: Gift,
      color: 'pink',
      gradient: 'from-pink-500 to-rose-600',
      is_preset: true,
      is_active: false,
      setup_progress: 0,
      templates: [
        {
          id: 'tmpl-birthday-sms',
          name: 'Birthday SMS',
          type: 'SMS',
          body: 'Happy Birthday {patientName}! 🎉 Wishing you a wonderful year ahead. It\'s a great time to schedule your annual checkup. Call {clinicPhone} to book.',
          variables: ['patientName', 'clinicPhone']
        },
        {
          id: 'tmpl-birthday-email',
          name: 'Birthday Email with Offer',
          type: 'EMAIL',
          subject: 'Happy Birthday {patientName}! 🎂',
          body: 'Dear {patientName},\\n\\nHappy Birthday from all of us at {clinicName}!\\n\\nAs a birthday gift, we\'re offering you 15% off your next health screening. This is perfect timing for your annual checkup.\\n\\nTo book your appointment, call us at {clinicPhone} or reply to this email.\\n\\nHere\'s to another year of good health!\\n\\nWarm wishes,\\n{clinicName} Team',
          variables: ['patientName', 'clinicName', 'clinicPhone']
        }
      ],
      triggers: [
        { event: 'patient_birthday', timing: 'on_date' }
      ],
      performance: { sent: 0, delivered: 0, engagement: 0 }
    },
    {
      id: 'preset-follow-up-care',
      name: 'Follow-up Care',
      category: 'health',
      description: 'Ensure patients follow treatment plans and medication schedules',
      icon: Heart,
      color: 'red',
      gradient: 'from-red-500 to-pink-600',
      is_preset: true,
      is_active: false,
      setup_progress: 0,
      templates: [
        {
          id: 'tmpl-post-visit',
          name: 'Post-Visit Follow-up',
          type: 'EMAIL',
          subject: 'Your visit follow-up - {visitDate}',
          body: 'Dear {patientName},\\n\\nThank you for your visit on {visitDate}. We hope you\'re feeling better.\\n\\nReminder:\\n• Take medications as prescribed\\n• Follow-up appointment: {nextAppointmentDate}\\n• Contact us if you have any concerns\\n\\nYour health is our priority.\\n\\nBest regards,\\nDr. {doctorName}',
          variables: ['patientName', 'visitDate', 'nextAppointmentDate', 'doctorName']
        },
        {
          id: 'tmpl-medication-reminder',
          name: 'Medication Reminder',
          type: 'SMS',
          body: 'Hi {patientName}, friendly reminder to take your {medicationName} as prescribed. If you have questions, call {clinicPhone}.',
          variables: ['patientName', 'medicationName', 'clinicPhone']
        }
      ],
      triggers: [
        { event: 'visit_completed', timing: '1_day_after' },
        { event: 'medication_due', timing: 'scheduled' }
      ],
      performance: { sent: 0, delivered: 0, engagement: 0 }
    },
    {
      id: 'preset-payment-reminders',
      name: 'Payment Reminders',
      category: 'practice',
      description: 'Gentle reminders for outstanding balances and payment options',
      icon: DollarSign,
      color: 'green',
      gradient: 'from-green-500 to-emerald-600',
      is_preset: true,
      is_active: false,
      setup_progress: 0,
      templates: [
        {
          id: 'tmpl-payment-due',
          name: 'Payment Reminder',
          type: 'EMAIL',
          subject: 'Payment Reminder - Account {accountNumber}',
          body: 'Dear {patientName},\\n\\nThis is a friendly reminder that you have an outstanding balance of {amount} for services received on {serviceDate}.\\n\\nYou can pay online, call us at {clinicPhone}, or visit our office.\\n\\nThank you for choosing {clinicName}.\\n\\nBest regards,\\nAccounts Team',
          variables: ['patientName', 'amount', 'serviceDate', 'clinicPhone', 'clinicName', 'accountNumber']
        },
        {
          id: 'tmpl-payment-overdue',
          name: 'Overdue Payment SMS',
          type: 'SMS',
          body: 'Hi {patientName}, you have an overdue balance of {amount}. Please call {clinicPhone} to arrange payment. Thank you.',
          variables: ['patientName', 'amount', 'clinicPhone']
        }
      ],
      triggers: [
        { event: 'payment_due', timing: '7_days_after' },
        { event: 'payment_overdue', timing: '30_days_after' }
      ],
      performance: { sent: 0, delivered: 0, engagement: 0 }
    },
    {
      id: 'preset-health-screenings',
      name: 'Health Screenings',
      category: 'health',
      description: 'Promote preventive care with age-appropriate screening reminders',
      icon: FileText,
      color: 'purple',
      gradient: 'from-purple-500 to-indigo-600',
      is_preset: true,
      is_active: false,
      setup_progress: 0,
      templates: [
        {
          id: 'tmpl-annual-screening',
          name: 'Annual Screening Reminder',
          type: 'EMAIL',
          subject: 'Time for Your Annual Health Screening',
          body: 'Dear {patientName},\\n\\nIt\'s time for your annual health screening. Regular checkups help catch potential issues early.\\n\\nBased on your age and health history, we recommend:\\n• Blood pressure check\\n• Cholesterol screening\\n• {ageSpecificTests}\\n\\nCall {clinicPhone} to schedule your appointment.\\n\\nYour health is worth it!\\n\\n{clinicName}',
          variables: ['patientName', 'ageSpecificTests', 'clinicPhone', 'clinicName']
        },
        {
          id: 'tmpl-screening-sms',
          name: 'Screening Due SMS',
          type: 'SMS',
          body: 'Hi {patientName}, your annual {screeningType} is due. Call {clinicPhone} to schedule. Early detection saves lives!',
          variables: ['patientName', 'screeningType', 'clinicPhone']
        }
      ],
      triggers: [
        { event: 'annual_screening_due', timing: 'on_date' },
        { event: 'age_milestone', timing: 'on_birthday' }
      ],
      performance: { sent: 0, delivered: 0, engagement: 0 }
    },
    {
      id: 'preset-welcome-sequence',
      name: 'Welcome New Patients',
      category: 'lifecycle',
      description: 'Onboard new patients with a warm welcome sequence over 2 weeks',
      icon: Users,
      color: 'teal',
      gradient: 'from-teal-500 to-cyan-600',
      is_preset: true,
      is_active: false,
      setup_progress: 0,
      templates: [
        {
          id: 'tmpl-welcome-day1',
          name: 'Welcome Email - Day 1',
          type: 'EMAIL',
          subject: 'Welcome to {clinicName}!',
          body: 'Dear {patientName},\\n\\nWelcome to {clinicName}! We\'re thrilled to have you as part of our healthcare family.\\n\\nWhat to expect:\\n• Personalized care from our experienced team\\n• Easy online appointment booking\\n• Reminder notifications\\n• 24/7 support for urgent concerns\\n\\nYour first appointment is scheduled for {firstAppointmentDate}.\\n\\nWe look forward to caring for you!\\n\\n{clinicName} Team',
          variables: ['patientName', 'clinicName', 'firstAppointmentDate']
        },
        {
          id: 'tmpl-welcome-week2',
          name: 'Welcome Follow-up - Week 2',
          type: 'EMAIL',
          subject: 'How was your first visit?',
          body: 'Dear {patientName},\\n\\nIt\'s been two weeks since your first visit with us. We hope you had a positive experience!\\n\\nA few things that might be helpful:\\n• Patient portal access for test results\\n• Our mobile app for easy scheduling\\n• Health tips and resources on our website\\n\\nIf you have any questions or feedback, please don\'t hesitate to reach out.\\n\\nThank you for choosing {clinicName}!',
          variables: ['patientName', 'clinicName']
        }
      ],
      triggers: [
        { event: 'patient_registered', timing: 'immediate' },
        { event: 'patient_registered', timing: '2_weeks_after' }
      ],
      performance: { sent: 0, delivered: 0, engagement: 0 }
    }
  ];

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = () => {
    // Combine preset campaigns with any custom campaigns from database
    setCampaigns(presetCampaigns);
  };

  const handleActivateCampaign = (campaign: CommunicationCampaign) => {
    setSelectedCampaign(campaign);
    setShowSetupModal(true);
  };

  const handleQuickActivate = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    setIsLoading(true);
    
    // Simulate activation process
    setTimeout(() => {
      // Quick activation with default settings
      const updatedCampaigns = campaigns.map(c => 
        c.id === campaignId 
          ? { 
              ...c, 
              is_active: true, 
              setup_progress: 100,
              performance: { sent: 0, delivered: 98, engagement: 85 }
            }
          : c
      );
      
      setCampaigns(updatedCampaigns);
      setIsLoading(false);
      
      // Show success animation or toast
      console.log(`✅ ${campaign.name} activated successfully!`);
    }, 1500);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'appointment': return Calendar;
      case 'lifecycle': return Users;
      case 'health': return Heart;
      case 'practice': return FileText;
      case 'marketing': return TrendingUp;
      default: return Zap;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'appointment': return 'blue';
      case 'lifecycle': return 'purple';
      case 'health': return 'red';
      case 'practice': return 'green';
      case 'marketing': return 'orange';
      default: return 'gray';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[30px] font-bold font-heading text-[#494c61] flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-[#01b9d5]" />
              Smart Automations
            </h1>
            <p className="text-gray-600 mt-1">Set up intelligent patient communication in minutes</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('custom')}
            className="bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-lg transition-all duration-300 font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Custom Campaign
          </motion.button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Active Campaigns</p>
              <p className="text-2xl font-bold">{campaigns.filter(c => c.is_active).length}</p>
            </div>
            <Zap className="w-8 h-8 opacity-80" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Messages Today</p>
              <p className="text-2xl font-bold">0</p>
            </div>
            <MessageSquare className="w-8 h-8 opacity-80" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Delivery Rate</p>
              <p className="text-2xl font-bold">-</p>
            </div>
            <Target className="w-8 h-8 opacity-80" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Time Saved</p>
              <p className="text-2xl font-bold">0h</p>
            </div>
            <Clock className="w-8 h-8 opacity-80" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {[
            { id: 'presets', label: 'Quick Setup', icon: Star },
            { id: 'custom', label: 'Custom Campaigns', icon: Settings },
            { id: 'templates', label: 'Template Library', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'text-[#01b9d5] border-[#01b9d5]'
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
      {activeTab === 'presets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {presetCampaigns.map((campaign) => {
            const Icon = campaign.icon;
            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
              >
                <div className={`h-2 bg-gradient-to-r ${campaign.gradient}`}></div>
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 bg-gradient-to-br ${campaign.gradient} rounded-xl`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    
                    {campaign.is_active ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Active</span>
                      </div>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleQuickActivate(campaign.id)}
                        disabled={isLoading}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            Setting up...
                          </>
                        ) : (
                          'Quick Setup'
                        )}
                      </motion.button>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{campaign.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{campaign.description}</p>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Templates</span>
                      <span className="font-medium">{campaign.templates.length} included</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Triggers</span>
                      <span className="font-medium">{campaign.triggers.length} automated</span>
                    </div>
                  </div>
                  
                  {campaign.is_active && campaign.performance && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-gray-900">{campaign.performance.sent}</p>
                          <p className="text-xs text-gray-600">Sent</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-green-600">{campaign.performance.delivered}%</p>
                          <p className="text-xs text-gray-600">Delivered</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-blue-600">{campaign.performance.engagement}%</p>
                          <p className="text-xs text-gray-600">Engagement</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleActivateCampaign(campaign)}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        campaign.is_active
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : `bg-gradient-to-r ${campaign.gradient} text-white hover:shadow-lg`
                      }`}
                    >
                      {campaign.is_active ? 'Manage' : 'Setup & Activate'}
                    </motion.button>
                    
                    <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {activeTab === 'custom' && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Custom Campaign Builder</h3>
            <p className="text-gray-600 mb-6">Create your own communication campaigns with our visual builder.</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowWorkflowBuilder(true)}
              className="bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white px-6 py-3 rounded-xl font-medium"
            >
              Start Building
            </motion.button>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Template Library</h3>
            <p className="text-gray-600 mb-6">Browse and customize our collection of healthcare message templates.</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white px-6 py-3 rounded-xl font-medium"
            >
              Browse Templates
            </motion.button>
          </div>
        </div>
      )}

      {/* Setup Modal */}
      <AnimatePresence>
        {showSetupModal && selectedCampaign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSetupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`h-2 bg-gradient-to-r ${selectedCampaign.gradient}`}></div>
              
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`p-3 bg-gradient-to-br ${selectedCampaign.gradient} rounded-xl`}>
                    <selectedCampaign.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedCampaign.name}</h3>
                    <p className="text-gray-600">{selectedCampaign.description}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Included Templates:</h4>
                    <div className="space-y-2">
                      {selectedCampaign.templates.map((template) => (
                        <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {template.type === 'SMS' ? (
                              <MessageSquare className="w-4 h-4 text-purple-600" />
                            ) : (
                              <Mail className="w-4 h-4 text-blue-600" />
                            )}
                            <span className="font-medium">{template.name}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.type === 'SMS' 
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {template.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSetupModal(false)}
                      className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Customize Later
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        handleQuickActivate(selectedCampaign.id);
                        setShowSetupModal(false);
                      }}
                      className={`flex-1 py-3 px-4 bg-gradient-to-r ${selectedCampaign.gradient} text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300`}
                    >
                      Activate Now
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Workflow Builder */}
      {showWorkflowBuilder && (
        <VisualWorkflowBuilder onClose={() => setShowWorkflowBuilder(false)} />
      )}
    </div>
  );
};

export default SmartAutomations;