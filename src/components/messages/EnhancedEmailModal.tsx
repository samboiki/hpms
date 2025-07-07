import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  User, 
  ChevronDown, 
  Eye, 
  Edit3, 
  Send,
  Calendar,
  Heart,
  AlertCircle,
  CheckCircle,
  Sparkles,
  X,
  Shield,
  UserCheck,
  FileText,
  Paperclip,
  Image,
  Type,
  Bold,
  Italic,
  List,
  Link2,
} from 'lucide-react';
import FullScreenModal from '../ui/FullScreenModal';
import { Patient } from '../../stores/patientsStoreNew';
import { PremiumEmailTemplate } from './PremiumEmailTemplate';
import { useCurrentUserAndPractice } from '../../hooks/useCurrentUserAndPractice';
import { emailEdgeService } from '../../services/emailEdgeService';
import { toast } from 'react-hot-toast';

interface EnhancedEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onSend: (email: string, subject: string, message: string) => void;
  isSending?: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  content: string;
  icon: React.ElementType;
  color: string;
}

const emailTemplates: EmailTemplate[] = [
  {
    id: 'appointment-confirmation',
    name: 'Appointment Confirmation',
    category: 'Appointments',
    subject: 'Appointment Confirmation - {{practiceName}}',
    content: `Dear {{patientName}},

This email confirms your appointment with {{practiceName}}.

**Appointment Details:**
- Date: {{date}}
- Time: {{time}}
- Doctor: Dr. {{doctor}}
- Location: {{practiceAddress}}

**What to bring:**
- Valid ID document
- Medical aid card (if applicable)
- Any previous medical records
- List of current medications

Please arrive 15 minutes early for check-in. If you need to reschedule or cancel, please contact us at least 24 hours in advance.

Best regards,
{{practiceName}} Team
{{practicePhone}} | {{practiceEmail}}`,
    icon: Calendar,
    color: 'blue'
  },
  {
    id: 'test-results',
    name: 'Test Results Available',
    category: 'Results',
    subject: 'Your Test Results Are Ready - {{practiceName}}',
    content: `Dear {{patientName}},

We hope this email finds you well. Your recent test results are now available.

**Next Steps:**
- Schedule a follow-up appointment to discuss your results
- Our medical team will explain the findings in detail
- Bring any questions you may have

To schedule your appointment, please call us at {{practicePhone}} or reply to this email.

Your health is our priority, and we're here to support you every step of the way.

Best regards,
{{practiceName}} Medical Team`,
    icon: CheckCircle,
    color: 'green'
  },
  {
    id: 'welcome',
    name: 'Welcome to Practice',
    category: 'Onboarding',
    subject: 'Welcome to {{practiceName}} - Your Healthcare Journey Begins',
    content: `Dear {{patientName}},

Welcome to {{practiceName}}! We're honored that you've chosen us as your healthcare partner.

**What you can expect:**
- Personalized, patient-centered care
- Access to experienced healthcare professionals
- Modern facilities and advanced medical technology
- Convenient appointment scheduling

**Important Information:**
- Practice Hours: Monday-Friday 8:00 AM - 5:00 PM
- Emergency Contact: {{emergencyPhone}}
- Patient Portal: {{portalLink}}

We look forward to supporting your health and wellness journey.

Warm regards,
The {{practiceName}} Team`,
    icon: UserCheck,
    color: 'teal'
  },
  {
    id: 'follow-up',
    name: 'Post-Visit Follow-up',
    category: 'Care',
    subject: 'Following Up on Your Recent Visit - {{practiceName}}',
    content: `Dear {{patientName}},

We hope you're feeling better after your recent visit on {{visitDate}}.

**Post-Visit Reminders:**
{{followUpInstructions}}

**Your Prescribed Medications:**
{{medications}}

If you have any questions or concerns about your treatment plan, please don't hesitate to contact us.

Take care and be well,
Dr. {{doctor}} and the {{practiceName}} Team`,
    icon: Heart,
    color: 'pink'
  },
  {
    id: 'birthday',
    name: 'Birthday Wishes',
    category: 'Special',
    subject: 'Happy Birthday from {{practiceName}}! 🎉',
    content: `Dear {{patientName}},

On behalf of everyone at {{practiceName}}, we wish you a very Happy Birthday!

May this special day bring you joy, good health, and wonderful memories. We're grateful to be part of your healthcare journey and look forward to supporting your wellness for many years to come.

**Birthday Special:**
Enjoy 15% off your next wellness check-up when you book within the next 30 days.

Warmest wishes,
The {{practiceName}} Family`,
    icon: Sparkles,
    color: 'yellow'
  },
  {
    id: 'custom',
    name: 'Custom Email',
    category: 'Custom',
    subject: '',
    content: '',
    icon: Edit3,
    color: 'gray'
  }
];

export const EnhancedEmailModal: React.FC<EnhancedEmailModalProps> = ({
  isOpen,
  onClose,
  patient,
  onSend,
  isSending = false
}) => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [isSendingLocal, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  
  // Ref for textarea to handle text formatting
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get current user and practice data
  const { currentUser, practice, loading: userLoading } = useCurrentUserAndPractice();

  useEffect(() => {
    if (patient?.email) {
      setEmail(patient.email);
    }
    
    // Check for invoice attachment
    if ((window as any).invoiceAttachment) {
      setAttachments([(window as any).invoiceAttachment]);
      // Clear the global attachment after picking it up
      delete (window as any).invoiceAttachment;
    }
  }, [patient]);

  // Text formatting functions
  const insertTextAtCursor = (startTag: string, endTag: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    
    let newText;
    if (selectedText) {
      // Wrap selected text
      newText = message.substring(0, start) + startTag + selectedText + endTag + message.substring(end);
    } else {
      // Insert at cursor
      newText = message.substring(0, start) + startTag + endTag + message.substring(end);
    }
    
    setMessage(newText);
    
    // Set cursor position after formatting
    setTimeout(() => {
      const newCursorPos = selectedText ? start + startTag.length + selectedText.length + endTag.length : start + startTag.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleBold = () => insertTextAtCursor('**', '**');
  const handleItalic = () => insertTextAtCursor('*', '*');
  const handleLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = message.substring(start, end);
      const linkText = selectedText || 'Link Text';
      
      insertTextAtCursor(`[${linkText}](${url})`);
    }
  };

  const handleAttachment = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      setAttachments(prev => [...prev, ...files]);
    };
    input.click();
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const replaceVariables = (text: string): string => {
    if (!patient) return text;
    
    const variables: Record<string, string> = {
      '{{patientName}}': `${patient.first_name} ${patient.last_name}`,
      '{{date}}': new Date().toLocaleDateString(),
      '{{time}}': '2:00 PM',
      '{{doctor}}': 'Smith',
      '{{practicePhone}}': '+264 61 123 456',
      '{{practiceEmail}}': 'info@onehealth.com.na',
      '{{practiceName}}': 'OneHealth Medical',
      '{{practiceAddress}}': '123 Independence Ave, Windhoek',
      '{{visitDate}}': new Date().toLocaleDateString(),
      '{{followUpInstructions}}': '- Take prescribed medications as directed\n- Rest and stay hydrated\n- Monitor your symptoms',
      '{{medications}}': '- Paracetamol 500mg - Take 2 tablets every 6 hours\n- Amoxicillin 250mg - Take 1 capsule 3 times daily',
      '{{emergencyPhone}}': '+264 61 999 999',
      '{{portalLink}}': 'https://portal.onehealth.com.na'
    };

    let processedText = text;
    Object.entries(variables).forEach(([key, value]) => {
      processedText = processedText.replace(new RegExp(key, 'g'), value);
    });
    
    return processedText;
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    if (template.subject) {
      setSubject(replaceVariables(template.subject));
    }
    if (template.content) {
      setMessage(replaceVariables(template.content));
    }
    setShowTemplates(false);
    setIsEditing(template.id === 'custom');
  };

  const handleSend = async () => {
    if (!email || !subject || !message) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!currentUser || !practice) {
      toast.error('Unable to load user or practice information');
      return;
    }

    // Start loading state
    setIsSending(true);
    
    // Show loading toast
    const loadingToastId = toast.loading('📧 Preparing your premium email...', {
      duration: Infinity,
      style: {
        background: 'linear-gradient(135deg, #01b9d4 0%, #0891b2 100%)',
        color: 'white',
        fontWeight: '500',
      }
    });

    try {
      // Send email via secure edge function
      const result = await emailEdgeService.sendPracticeEmail({
        recipientName: patient ? `${patient.first_name} ${patient.last_name}` : "Patient",
        recipientEmail: email,
        subject: subject,
        message: message,
        doctorName: currentUser.full_name,
        doctorRole: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
        practiceInfo: {
          name: practice.name,
          logo: practice.logo_url,
          address: practice.address,
          phone: practice.contact_phone,
          email: practice.contact_email,
          website: practice.slug ? `www.${practice.slug}.com.na` : undefined,
          themeColor: '#01b9d4' // You can make this dynamic from practice settings
        },
        attachments: attachments.length > 0 ? attachments : undefined
      });

      // Dismiss loading toast
      toast.dismiss(loadingToastId);

      if (result.success) {
        // Show success toast with custom styling
        toast.success('✨ Email delivered successfully!', {
          duration: 4000,
          style: {
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            fontWeight: '600',
          }
        });
        
        onSend(email, subject, message);
        
        // Close modal after a short delay for better UX
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        toast.error(`❌ Failed to send email: ${result.error}`, {
          duration: 5000,
          style: {
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            fontWeight: '500',
          }
        });
      }
    } catch (error) {
      // Dismiss loading toast
      toast.dismiss(loadingToastId);
      
      console.error('Error sending email:', error);
      toast.error('🚫 Network error. Please check your connection and try again.', {
        duration: 5000,
        style: {
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          fontWeight: '500',
        }
      });
    } finally {
      setIsSending(false);
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
    <FullScreenModal isOpen={isOpen} onClose={onClose} modalId="enhanced-email-modal">
      <div className="h-full bg-white flex flex-col">
        {/* Premium Header */}
        <div className="relative bg-gradient-to-r from-purple-600 to-[#01b9d5] p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-[#01b9d5]/20 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Compose Email</h2>
                <p className="text-purple-100 text-sm">
                  {patient ? `To: ${patient.first_name} ${patient.last_name}` : 'Create professional email'}
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
                  className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{patient.first_name} {patient.last_name}</p>
                      <p className="text-sm text-gray-500">Patient ID: {patient.id.substring(0, 8)}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                  placeholder="Enter email address"
                />
                {patient?.email && email !== patient.email && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Using different email than patient's registered email
                  </p>
                )}
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Email Template</label>
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
                          <FileText className="w-4 h-4 text-gray-600" />
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
                        {emailTemplates.map(template => (
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

              {/* Subject Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!isEditing}
                  className={`w-full p-3 bg-white border border-gray-200 rounded-lg transition-all ${
                    isEditing 
                      ? 'focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500' 
                      : 'bg-gray-50 cursor-not-allowed'
                  }`}
                  placeholder="Enter email subject"
                />
              </div>

              {/* Attachments Section */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Attachments ({attachments.length})
                  </label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white rounded-lg p-2 border border-blue-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            {file.type.includes('pdf') ? (
                              <FileText className="w-4 h-4 text-blue-600" />
                            ) : file.type.includes('image') ? (
                              <Image className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Paperclip className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove attachment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">Message</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                        isEditing 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Edit3 className="w-3 h-3 inline mr-1" />
                      {isEditing ? 'Editing' : 'Edit'}
                    </button>
                  </div>
                </div>
                
                {/* Simple Editor Toolbar */}
                {isEditing && (
                  <div className="flex items-center gap-1 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <button 
                      onClick={handleBold}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors" 
                      title="Bold (Markdown: **text**)"
                    >
                      <Bold className="w-4 h-4 text-gray-600" />
                    </button>
                    <button 
                      onClick={handleItalic}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors" 
                      title="Italic (Markdown: *text*)"
                    >
                      <Italic className="w-4 h-4 text-gray-600" />
                    </button>
                    <button 
                      onClick={() => insertTextAtCursor('• ')}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors" 
                      title="Add bullet point"
                    >
                      <List className="w-4 h-4 text-gray-600" />
                    </button>
                    <button 
                      onClick={handleLink}
                      className="p-1.5 hover:bg-gray-200 rounded transition-colors" 
                      title="Insert Link"
                    >
                      <Link2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="h-4 w-px bg-gray-300 mx-1" />
                    <button 
                      onClick={handleAttachment}
                      className={`p-1.5 hover:bg-gray-200 rounded transition-colors relative ${
                        attachments.length > 0 ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                      }`}
                      title={`Attach Files (${attachments.length} attached)`}
                    >
                      <Paperclip className="w-4 h-4" />
                      {attachments.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                          {attachments.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}
                
                <textarea
                  ref={textareaRef}
                  rows={10}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!isEditing}
                  className={`w-full p-4 bg-white border border-gray-200 rounded-lg transition-all resize-none ${
                    isEditing 
                      ? 'focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500' 
                      : 'bg-gray-50 cursor-not-allowed'
                  }`}
                  placeholder="Type your email message here..."
                />
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
                  disabled={!email || !subject || !message || isSendingLocal}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-[#01b9d5] text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSendingLocal ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email{attachments.length > 0 ? ` (${attachments.length} attachment${attachments.length !== 1 ? 's' : ''})` : ''}
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Right Column - Premium Email Preview - Always Visible */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden h-full"
              >
                <div className="bg-gradient-to-r from-purple-600 to-[#01b9d5] p-4 text-white">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Premium Email Preview
                  </h3>
                </div>
                
                {/* Premium Email Template Preview */}
                <div className="h-[calc(100%-60px)] overflow-hidden">
                  <PremiumEmailTemplate
                    recipientName={patient ? `${patient.first_name} ${patient.last_name}` : "Patient"}
                    recipientEmail={email}
                    subject={subject}
                    message={message}
                    doctorName={currentUser?.full_name || "Dr. Smith"}
                    doctorRole={currentUser?.role ? 
                      currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 
                      "General Practitioner"
                    }
                    practiceInfo={{
                      name: practice?.name || "OneHealth Medical Practice",
                      logo: practice?.logo_url,
                      address: practice?.address || "123 Medical Drive, Windhoek, Namibia",
                      phone: practice?.contact_phone || "+264 61 123 456",
                      email: practice?.contact_email || "info@onehealth.com.na",
                      website: practice?.slug ? `www.${practice.slug}.com.na` : "www.onehealth.com.na"
                    }}
                  />
                </div>
              </motion.div>
          </div>
        </div>
      </div>
    </FullScreenModal>
  );
};