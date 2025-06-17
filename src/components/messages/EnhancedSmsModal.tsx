import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Phone, 
  User, 
  ChevronDown, 
  Eye, 
  Edit3, 
  Send,
  Clock,
  Calendar,
  Heart,
  AlertCircle,
  CheckCircle,
  Sparkles,
  X,
  Shield,
  UserCheck
} from 'lucide-react';
import FullScreenModal from '../ui/FullScreenModal';
import { Patient } from '../../stores/patientsStoreNew';

interface EnhancedSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onSend: (phone: string, message: string) => void;
  isSending?: boolean;
}

interface SmsTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  icon: React.ElementType;
  color: string;
}

const smsTemplates: SmsTemplate[] = [
  {
    id: 'appointment-reminder',
    name: 'Appointment Reminder',
    category: 'Appointments',
    content: 'Hi {{patientName}}, this is a reminder about your appointment on {{date}} at {{time}} with Dr. {{doctor}}. Please arrive 15 minutes early. Reply CONFIRM to confirm or CANCEL to cancel.',
    icon: Calendar,
    color: 'blue'
  },
  {
    id: 'test-results',
    name: 'Test Results Ready',
    category: 'Results',
    content: 'Hi {{patientName}}, your test results are ready for collection. Please visit our practice during business hours or call us at {{practicePhone}} to discuss your results.',
    icon: CheckCircle,
    color: 'green'
  },
  {
    id: 'prescription-ready',
    name: 'Prescription Ready',
    category: 'Pharmacy',
    content: 'Hi {{patientName}}, your prescription is ready for collection at {{pharmacy}}. Please bring your ID and medical aid card if applicable.',
    icon: Shield,
    color: 'purple'
  },
  {
    id: 'follow-up',
    name: 'Follow-up Care',
    category: 'Care',
    content: 'Hi {{patientName}}, we hope you\'re feeling better after your recent visit. Please remember to {{followUpInstructions}}. If you have any concerns, call us at {{practicePhone}}.',
    icon: Heart,
    color: 'pink'
  },
  {
    id: 'payment-reminder',
    name: 'Payment Reminder',
    category: 'Billing',
    content: 'Hi {{patientName}}, this is a friendly reminder about your outstanding balance of {{amount}}. Please contact our billing department at {{practicePhone}} to arrange payment.',
    icon: AlertCircle,
    color: 'amber'
  },
  {
    id: 'birthday',
    name: 'Birthday Wishes',
    category: 'Special',
    content: 'Happy Birthday {{patientName}}! 🎉 Wishing you good health and happiness. From all of us at {{practiceName}}.',
    icon: Sparkles,
    color: 'yellow'
  },
  {
    id: 'welcome',
    name: 'Welcome Message',
    category: 'Onboarding',
    content: 'Welcome to {{practiceName}}, {{patientName}}! We\'re honored to be part of your healthcare journey. Save our number {{practicePhone}} for any questions.',
    icon: UserCheck,
    color: 'teal'
  },
  {
    id: 'custom',
    name: 'Custom Message',
    category: 'Custom',
    content: '',
    icon: Edit3,
    color: 'gray'
  }
];

export const EnhancedSmsModal: React.FC<EnhancedSmsModalProps> = ({
  isOpen,
  onClose,
  patient,
  onSend,
  isSending = false
}) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SmsTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    if (patient?.cell_number) {
      setPhone(patient.cell_number);
    }
  }, [patient]);

  const replaceVariables = (text: string): string => {
    if (!patient) return text;
    
    const variables: Record<string, string> = {
      '{{patientName}}': `${patient.first_name} ${patient.last_name}`,
      '{{date}}': new Date().toLocaleDateString(),
      '{{time}}': '2:00 PM',
      '{{doctor}}': 'Smith',
      '{{practicePhone}}': '+264 61 123 456',
      '{{practiceName}}': 'OneHealth Medical',
      '{{amount}}': 'N$500.00',
      '{{pharmacy}}': 'OneHealth Pharmacy',
      '{{followUpInstructions}}': 'take your medication as prescribed'
    };

    let processedText = text;
    Object.entries(variables).forEach(([key, value]) => {
      processedText = processedText.replace(new RegExp(key, 'g'), value);
    });
    
    return processedText;
  };

  const handleTemplateSelect = (template: SmsTemplate) => {
    setSelectedTemplate(template);
    if (template.content) {
      setMessage(replaceVariables(template.content));
    }
    setShowTemplates(false);
    setIsEditing(template.id === 'custom');
  };

  const handleSend = () => {
    if (phone && message) {
      onSend(phone, message);
    }
  };

  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    pink: 'from-pink-500 to-pink-600',
    amber: 'from-amber-500 to-amber-600',
    yellow: 'from-yellow-500 to-yellow-600',
    teal: 'from-teal-500 to-teal-600',
    gray: 'from-gray-500 to-gray-600'
  };

  return (
    <FullScreenModal isOpen={isOpen} onClose={onClose} modalId="enhanced-sms-modal">
      <div className="h-full bg-white flex flex-col">
        {/* Premium Header */}
        <div className="relative bg-gradient-to-r from-[#01b9d5] to-purple-600 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/20 to-purple-600/20 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Send SMS Message</h2>
                <p className="text-blue-100 text-sm">
                  {patient ? `To: ${patient.first_name} ${patient.last_name}` : 'Compose new message'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-hidden h-[calc(100vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left Column - Form */}
            <div className="space-y-6 overflow-y-auto pr-2">
              {/* Patient Info Card */}
              {patient && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{patient.first_name} {patient.last_name}</p>
                      <p className="text-sm text-gray-500">Patient ID: {patient.id.substring(0, 8)}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Phone Number Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all font-mono text-gray-800"
                  placeholder="Enter phone number"
                />
                {patient?.cell_number && phone !== patient.cell_number && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Using different number than patient's registered number
                  </p>
                )}
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Message Template</label>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {selectedTemplate ? (
                      <>
                        <div className={`p-2 bg-gradient-to-r ${colorClasses[selectedTemplate.color as keyof typeof colorClasses]} rounded-lg`}>
                          <selectedTemplate.icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{selectedTemplate.name}</p>
                          <p className="text-xs text-gray-500">{selectedTemplate.category}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <MessageSquare className="w-4 h-4 text-gray-600" />
                        </div>
                        <span className="text-gray-700">Select a template</span>
                      </>
                    )}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
                </button>

                {/* Template Dropdown */}
                <AnimatePresence>
                  {showTemplates && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto">
                        {smsTemplates.map(template => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template)}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                          >
                            <div className={`p-2 bg-gradient-to-r ${colorClasses[template.color as keyof typeof colorClasses]} rounded-lg`}>
                              <template.icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-left flex-1">
                              <p className="font-medium text-gray-900 text-sm">{template.name}</p>
                              <p className="text-xs text-gray-500">{template.category}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">Message Content</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                        isEditing 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Edit3 className="w-3 h-3 inline mr-1" />
                      {isEditing ? 'Editing' : 'Edit'}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={!isEditing}
                    className={`w-full p-4 bg-white border border-gray-200 rounded-lg transition-all resize-none ${
                      isEditing 
                        ? 'focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5]' 
                        : 'bg-gray-50 cursor-not-allowed'
                    }`}
                    placeholder="Type your message here..."
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    {message.length}/160 ({Math.ceil(message.length / 160)} SMS)
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSend}
                  disabled={!phone || !message || isSending}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send SMS
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Right Column - Preview - Always Visible */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
                <div className="relative">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    SMS Preview
                  </h3>
                  
                  {/* Phone Mock */}
                  <div className="bg-black rounded-3xl p-4 shadow-2xl max-w-sm mx-auto">
                    <div className="bg-gray-900 rounded-2xl p-1">
                      <div className="bg-white rounded-2xl p-4">
                        {/* Phone Header */}
                        <div className="flex items-center justify-between mb-4 text-xs">
                          <span className="text-gray-500">Messages</span>
                          <div className="flex items-center gap-1 text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        
                        {/* Message Bubble */}
                        <div className="space-y-2">
                          <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-3 max-w-[80%]">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{message || 'Your message will appear here...'}</p>
                          </div>
                          <p className="text-xs text-gray-400 ml-1">From: {phone || 'Your practice number'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* SMS Info */}
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Characters:</span>
                      <span className="text-white font-medium">{message.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">SMS Count:</span>
                      <span className="text-white font-medium">{Math.ceil(message.length / 160)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Recipient:</span>
                      <span className="text-white font-medium">{phone || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
          </div>
        </div>
      </div>
    </FullScreenModal>
  );
};