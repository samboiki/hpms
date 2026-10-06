import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import Button from '../ui/Button';
import FullScreenModal from '../ui/FullScreenModal';
import { communicationService, getCommunicationErrorMessage } from '../../services/communicationService';
// import { useTheme } from '../../stores/themeStore';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import toast from 'react-hot-toast';
import { fillPlaceholders, findPlaceholders, formatMessageDate, getSmsLength } from '../messages/messageText';

interface UnifiedCommunicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    cell_number?: string;
    email?: string;
  } | null;
}

type CommunicationType = 'sms' | 'email' | null;

interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  type: string;
  size: number;
}

interface Template {
  id: string;
  name: string;
  type: string;
  category: string;
  channel: string;
  subject?: string | null;
  body?: string;
  text_content?: string;
  html_content?: string;
  variables?: Record<string, string>;
}


const UnifiedCommunicationModal: React.FC<UnifiedCommunicationModalProps> = ({ 
  isOpen, 
  onClose, 
  patient 
}) => {
  // const { currentTheme } = useTheme(); // Uncomment if theme is needed
  const { user } = useAuthStore();
  const { practiceId } = usePractice();
  
  const [communicationType, setCommunicationType] = useState<CommunicationType>(null);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(patient?.cell_number || '');
  const [email, setEmail] = useState(patient?.email || '');
  const [isSending, setIsSending] = useState(false);
  const [, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [practiceData, setPracticeData] = useState<{
    name: string;
    contact_phone?: string;
    contact_email?: string;
    domain?: string;
    address?: string;
  } | null>(null);
  const [hasGmailConnected, setHasGmailConnected] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCommunicationType(null);
      setMessage('');
      setSubject('');
      setPhoneNumber(patient?.cell_number || '');
      setEmail(patient?.email || '');
      setSendStatus('idle');
      setSelectedTemplate(null);
      setAttachments([]);
    }
  }, [isOpen, patient]);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen && practiceId) {
      fetchPracticeData();
      checkGmailConnection();
      fetchTemplates();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, practiceId]);

  const fetchPracticeData = async () => {
    if (!practiceId) return;
    
    try {
      const { data, error } = await supabase
        .from('practices')
        .select('name, contact_phone, contact_email, domain, address')
        .eq('id', practiceId)
        .single();
        
      if (data && !error) {
        setPracticeData(data);
      }
    } catch (error) {
      console.error('Error fetching practice data:', error);
    }
  };

  const checkGmailConnection = async () => {
    if (!practiceId) return;
    
    try {
      const { data } = await supabase
        .from('practice_oauth_credentials')
        .select('id')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();
        
      setHasGmailConnected(!!data);
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
    }
  };

  const fetchTemplates = async () => {
    if (!practiceId) return;
    
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
        
      if (data && !error) {
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: EmailAttachment[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }
      
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          resolve(base64.split(',')[1]); // Remove data:type;base64, prefix
        };
      });
      
      reader.readAsDataURL(file);
      const base64Content = await base64Promise;
      
      newAttachments.push({
        filename: file.name,
        content: base64Content,
        type: file.type || 'application/octet-stream',
        size: file.size
      });
    }
    
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const content = template.body || template.text_content || '';
    const subject = template.subject || '';
    
    // Only real values are filled in. Unknown ones (e.g. {{appointmentDate}}) stay visible so they
    // are completed before sending; they used to be replaced with blanks ("your appointment on  at .")
    const patientFullName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();
    const website = practiceData?.domain ? `https://${practiceData.domain}` : '';
    const values: Record<string, string> = {
      patientName: patientFullName,
      patient_name: patientFullName,
      patientFirstName: patient?.first_name || '',
      patientLastName: patient?.last_name || '',
      practiceName: practiceData?.name || '',
      practice_name: practiceData?.name || '',
      practicePhone: practiceData?.contact_phone || '',
      practice_phone: practiceData?.contact_phone || '',
      practiceEmail: practiceData?.contact_email || '',
      practice_email: practiceData?.contact_email || '',
      practiceWebsite: website,
      practice_website: website,
      practiceAddress: practiceData?.address || '',
      practice_address: practiceData?.address || '',
      currentDate: formatMessageDate(new Date()),
      currentTime: new Date().toLocaleTimeString()
    };

    let finalContent = fillPlaceholders(content, values);
    const finalSubject = fillPlaceholders(subject, values);
    
    // Add signature for emails if not already present
    if (communicationType === 'email' && practiceData?.name) {
      const signatureText = `\n\nBest regards,\n${practiceData.name} Team`;
      
      // Check if signature is already present
      if (!finalContent.includes('Best regards') && !finalContent.includes('Sincerely')) {
        finalContent += signatureText;
      }
    }
    
    setMessage(finalContent);
    if (communicationType === 'email' && subject) {
      setSubject(finalSubject);
    }
  };

  const handleSend = async () => {
    if (isSending) return;

    if (!practiceId) {
      toast.error('Practice ID not found');
      return;
    }

    if (communicationType === 'sms') {
      if (!message.trim() || !phoneNumber.trim()) {
        toast.error('Please enter both phone number and message content');
        return;
      }
      const unfilledSms = findPlaceholders(message);
      if (unfilledSms.length > 0) {
        toast.error(`Please replace ${unfilledSms.join(', ')} before sending`);
        return;
      }

      setIsSending(true);
      setSendStatus('idle');

      try {
        const response = await communicationService.sendSMS({
          practiceId: practiceId as string,
          recipientPhone: phoneNumber,
          messageContent: message,
          messageType: 'custom',
          patientId: patient?.id,
          metadata: {
            sentBy: user?.email || 'Unknown',
            sentByUserId: user?.id,
            source: 'UnifiedCommunicationModal'
          }
        });
        
        if (response.success) {
          setSendStatus('success');
          toast.success('SMS sent successfully!');
          setTimeout(() => {
            onClose();
            setSendStatus('idle');
          }, 1500);
        } else {
          setSendStatus('error');
          toast.error(getCommunicationErrorMessage('sms', response.error));
        }
      } catch (error) {
        console.error('Failed to send SMS:', error);
        setSendStatus('error');
        toast.error('Failed to send SMS');
      } finally {
        setIsSending(false);
      }
    } else if (communicationType === 'email') {
      if (!message.trim() || !email.trim() || !subject.trim()) {
        toast.error('Please enter email address, subject, and message content');
        return;
      }
      const unfilledEmail = findPlaceholders(`${subject}\n${message}`);
      if (unfilledEmail.length > 0) {
        toast.error(`Please replace ${unfilledEmail.join(', ')} before sending`);
        return;
      }

      setIsSending(true);
      setSendStatus('idle');

      try {
        const response = await communicationService.sendEmail({
          practiceId: practiceId as string,
          recipientEmail: email,
          recipientName: `${patient?.first_name} ${patient?.last_name}`,
          senderName: practiceData?.name,
          subject: subject,
          textContent: message,
          emailType: 'custom',
          patientId: patient?.id,
          attachments: attachments.map(att => ({
            filename: att.filename,
            content: att.content,
            type: att.type
          })),
          metadata: {
            sentBy: user?.email || 'Unknown',
            sentByUserId: user?.id,
            source: 'UnifiedCommunicationModal',
            useGmail: hasGmailConnected,
            practiceData: {
              name: practiceData?.name,
              phone: practiceData?.contact_phone,
              email: practiceData?.contact_email,
              website: practiceData?.domain ? `https://${practiceData.domain}` : null,
              address: practiceData?.address
            }
          }
        });
        
        if (response.success) {
          setSendStatus('success');
          toast.success('Email sent successfully!');
          setTimeout(() => {
            onClose();
            setSendStatus('idle');
          }, 1500);
        } else {
          setSendStatus('error');
          toast.error(getCommunicationErrorMessage('email', response.error));
        }
      } catch (error) {
        console.error('Failed to send email:', error);
        setSendStatus('error');
        toast.error('Failed to send email');
      } finally {
        setIsSending(false);
      }
    }
  };

  const smsLength = getSmsLength(message);

  return (
    <FullScreenModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        communicationType 
          ? `Send ${communicationType === 'sms' ? 'SMS' : 'Email'} to ${patient?.first_name} ${patient?.last_name}`
          : `Contact ${patient?.first_name} ${patient?.last_name}`
      }
      data-testid="unified-communication-modal"
    >
      <div className="flex flex-col h-full">
        <AnimatePresence mode="wait">
          {!communicationType ? (
            // Communication type selection
            <motion.div
              key="type-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="max-w-2xl w-full mx-auto p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-8 text-center">
                  How would you like to contact the patient?
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SMS Option */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCommunicationType('sms')}
                    disabled={!patient?.cell_number}
                    className={`p-8 rounded-xl border-2 transition-all ${
                      patient?.cell_number
                        ? 'border-gray-300 hover:border-indigo-500 hover:shadow-lg cursor-pointer'
                        : 'border-gray-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Icon 
                      icon="solar:smartphone-bold-duotone" 
                      className="w-16 h-16 mx-auto mb-4 text-indigo-600"
                    />
                    <h3 className="text-lg font-semibold mb-2">Send SMS</h3>
                    <p className="text-sm text-gray-600">
                      {patient?.cell_number 
                        ? `Send text message to ${patient.cell_number}`
                        : 'No phone number available'
                      }
                    </p>
                  </motion.button>

                  {/* Email Option */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCommunicationType('email')}
                    disabled={!patient?.email}
                    className={`p-8 rounded-xl border-2 transition-all ${
                      patient?.email
                        ? 'border-gray-300 hover:border-purple-500 hover:shadow-lg cursor-pointer'
                        : 'border-gray-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Icon 
                      icon="solar:letter-bold-duotone" 
                      className="w-16 h-16 mx-auto mb-4 text-purple-600"
                    />
                    <h3 className="text-lg font-semibold mb-2">Send Email</h3>
                    <p className="text-sm text-gray-600">
                      {patient?.email 
                        ? `Send email to ${patient.email}`
                        : 'No email address available'
                      }
                    </p>
                    {hasGmailConnected && (
                      <p className="text-xs text-green-600 mt-2">
                        <Icon icon="solar:check-circle-bold" className="inline w-4 h-4 mr-1" />
                        Gmail connected
                      </p>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ) : (
            // Message composition
            <motion.div
              key="message-composition"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Back button */}
                <button
                  onClick={() => setCommunicationType(null)}
                  className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                  <Icon icon="solar:arrow-left-bold" className="w-5 h-5 mr-2" />
                  Back to selection
                </button>

                {/* Contact field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {communicationType === 'sms' ? 'Phone Number' : 'Email Address'}
                  </label>
                  {communicationType === 'sms' ? (
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g. 081 123 4567"
                    />
                  ) : (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="patient@example.com"
                    />
                  )}
                </div>

                {/* Subject field for email */}
                {communicationType === 'email' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter email subject"
                    />
                  </div>
                )}

                {/* Templates */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Templates
                  </label>
                  {templates.length > 0 ? (
                    <select
                      value={selectedTemplate || ''}
                      onChange={(e) => applyTemplate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
                    >
                      <option value="">Select a template...</option>
                      {templates
                        .filter(t => 
                          (communicationType === 'sms' && (t.channel === 'sms' || t.channel === 'both')) ||
                          (communicationType === 'email' && (t.channel === 'email' || t.channel === 'both'))
                        )
                        .map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.category})
                          </option>
                        ))
                      }
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No saved templates yet. Type your message below.</p>
                  )}
                </div>

                {/* Message field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={communicationType === 'sms' ? 4 : 8}
                    placeholder={
                      communicationType === 'sms' 
                        ? "Type your SMS message here..."
                        : "Type your email message here..."
                    }
                  />
                  {communicationType === 'sms' && (
                    <p className="text-xs text-gray-500 mt-1">
                      {smsLength.used} characters ({smsLength.parts} SMS)
                    </p>
                  )}
                </div>

                {/* Attachments for email */}
                {communicationType === 'email' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Attachments
                    </label>
                    
                    {/* File input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {/* Attachment list */}
                    {attachments.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Icon icon="solar:document-bold-duotone" className="w-5 h-5 text-gray-600" />
                              <span className="text-sm text-gray-700">{attachment.filename}</span>
                              <span className="text-xs text-gray-500">
                                ({(attachment.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              onClick={() => removeAttachment(index)}
                              aria-label={`Remove ${attachment.filename}`}
                              title="Remove attachment"
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <Icon icon="solar:close-bold" className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add attachment button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Icon icon="solar:paperclip-bold-duotone" className="w-5 h-5" />
                      Add Attachment
                    </button>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={isSending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={isSending || !message.trim() || (communicationType === 'email' && !subject.trim())}
                    title={
                      communicationType === 'email' && !subject.trim()
                        ? 'Enter a subject first'
                        : !message.trim() ? 'Type a message or choose a template first' : undefined
                    }
                    className={
                      communicationType === 'sms'
                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'
                        : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                    }
                  >
                    {isSending ? (
                      <>
                        <Icon icon="solar:refresh-circle-bold-duotone" className="w-5 h-5 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:send-square-bold-duotone" className="w-5 h-5 mr-2" />
                        Send {communicationType === 'sms' ? 'SMS' : 'Email'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FullScreenModal>
  );
};

export default UnifiedCommunicationModal;