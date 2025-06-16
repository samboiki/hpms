import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Mail, 
  MessageSquare, 
  Search,
  Calendar,
  Paperclip,
  Clock,
  User,
  Phone,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Image,
  File,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { usePatientsStore } from '../../stores/patientsStore';
import { useAuthStore } from '../../stores/authStore';

interface Message {
  type: 'email' | 'sms';
  recipient: string;
  patientId?: string;
  patientName: string;
  subject: string;
  content: string;
  attachments?: File[];
  scheduleFor?: string;
  templateId?: string;
}

const Compose: React.FC = () => {
  const [message, setMessage] = useState<Message>({
    type: 'email',
    recipient: '',
    patientName: '',
    subject: '',
    content: '',
    attachments: []
  });

  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<any[]>([]);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { patients, fetchPatients } = usePatientsStore();
  const { user } = useAuthStore();

  // Get practice_id from user metadata or local storage
  const practiceId = user?.user_metadata?.practice_id || localStorage.getItem('currentPracticeId');

  useEffect(() => {
    fetchPatients();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const filteredPatients = patients.filter(patient => {
    if (!patient) return false;
    const searchLower = patientSearchTerm.toLowerCase();
    return (
      patient.firstName?.toLowerCase().includes(searchLower) ||
      patient.lastName?.toLowerCase().includes(searchLower) ||
      patient.email?.toLowerCase().includes(searchLower) ||
      patient.phone?.toLowerCase().includes(searchLower)
    );
  });

  const handlePatientSelect = (patient: any) => {
    if (sendingBulk) {
      const isSelected = selectedPatients.some(p => p.id === patient.id);
      if (isSelected) {
        setSelectedPatients(selectedPatients.filter(p => p.id !== patient.id));
      } else {
        setSelectedPatients([...selectedPatients, patient]);
      }
    } else {
      setMessage({
        ...message,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        recipient: message.type === 'email' ? patient.email : patient.phone
      });
      setShowPatientSearch(false);
      setPatientSearchTerm('');
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage({
        ...message,
        subject: template.subject || '',
        content: template.body || '',
        templateId: template.id
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setMessage({
        ...message,
        attachments: [...(message.attachments || []), ...files]
      });
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = [...(message.attachments || [])];
    newAttachments.splice(index, 1);
    setMessage({ ...message, attachments: newAttachments });
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!message.recipient && selectedPatients.length === 0) {
      newErrors.recipient = 'Please select at least one recipient';
    }

    if (message.type === 'email' && !message.subject) {
      newErrors.subject = 'Subject is required for email';
    }

    if (!message.content) {
      newErrors.content = 'Message content is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSend = async () => {
    if (!validateForm()) return;

    setIsSending(true);
    try {
      const recipients = sendingBulk ? selectedPatients : [{ 
        id: message.patientId,
        email: message.type === 'email' ? message.recipient : undefined,
        phone: message.type === 'sms' ? message.recipient : undefined,
        name: message.patientName
      }];

      for (const recipient of recipients) {
        const communicationData = {
          practice_id: practiceId,
          patient_id: recipient.id,
          type: message.type.toUpperCase(),
          direction: 'OUTGOING',
          sender_address: message.type === 'email' ? 'clinic@example.com' : '+1234567890',
          recipient_address: message.type === 'email' ? recipient.email : recipient.phone,
          subject: message.subject,
          body_preview: message.content.substring(0, 200),
          status: message.scheduleFor ? 'PENDING' : 'SENT',
          scheduled_at: message.scheduleFor || null,
          sent_at: message.scheduleFor ? null : new Date().toISOString(),
          template_id: message.templateId || null
        };

        const { error } = await supabase
          .from('communications_log')
          .insert(communicationData);

        if (error) throw error;
      }

      // Reset form
      setMessage({
        type: 'email',
        recipient: '',
        patientName: '',
        subject: '',
        content: '',
        attachments: []
      });
      setSelectedPatients([]);
      setSelectedTemplate('');
      setSendingBulk(false);
      
      alert(`Message ${message.scheduleFor ? 'scheduled' : 'sent'} successfully!`);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-3 md:p-4 max-h-screen overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Compact Header */}
        <div className="mb-3">
          <h1 className="text-[20px] md:text-[24px] font-bold font-heading text-[#494c61]">Compose Message</h1>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          {/* Left Column - Recipients & Settings */}
          <div className="space-y-3">
            {/* Message Type Selector - Compact */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex gap-2">
                {['email', 'sms'].map((type) => (
                  <motion.button
                    key={type}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMessage({ ...message, type: type as 'email' | 'sms' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                      message.type === type
                        ? 'bg-gradient-to-r from-[#01b9d4] to-[#0197d4] text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {type === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    <span>{type === 'email' ? 'Email' : 'SMS'}</span>
                  </motion.button>
                ))}
              </div>
              
              {/* Bulk Send Toggle - Inline */}
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={sendingBulk}
                  onChange={(e) => {
                    setSendingBulk(e.target.checked);
                    setSelectedPatients([]);
                    setMessage({ ...message, recipient: '', patientName: '', patientId: undefined });
                  }}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-xs font-medium text-gray-700">Send to multiple patients</span>
              </label>
            </div>

            {/* Recipient Selection - Compact */}
            <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                {sendingBulk ? 'Recipients' : 'Recipient'}
              </label>
              
              {sendingBulk ? (
                <div>
                  <button
                    onClick={() => setShowPatientSearch(!showPatientSearch)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 text-sm"
                  >
                    <span className="text-gray-700">
                      {selectedPatients.length > 0 
                        ? `${selectedPatients.length} patients selected`
                        : 'Select patients'
                      }
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {showPatientSearch && (
                    <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-white shadow-lg">
                      <input
                        type="text"
                        placeholder="Search patients..."
                        value={patientSearchTerm}
                        onChange={(e) => setPatientSearchTerm(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg mb-2 text-sm"
                      />
                      <div className="max-h-36 overflow-y-auto">
                        {filteredPatients.map((patient) => (
                          <label
                            key={patient.id}
                            className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPatients.some(p => p.id === patient.id)}
                              onChange={() => handlePatientSelect(patient)}
                              className="rounded border-gray-300 text-primary-500"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {patient.firstName} {patient.lastName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {message.type === 'email' ? patient.email : patient.phone}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPatients.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedPatients.slice(0, 3).map((patient) => (
                        <span
                          key={patient.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-lg text-xs"
                        >
                          {patient.firstName} {patient.lastName}
                          <button
                            onClick={() => setSelectedPatients(selectedPatients.filter(p => p.id !== patient.id))}
                            className="hover:bg-primary-200 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {selectedPatients.length > 3 && (
                        <span className="text-xs text-gray-500">+{selectedPatients.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search for patient..."
                    value={message.patientName || patientSearchTerm}
                    onChange={(e) => {
                      setPatientSearchTerm(e.target.value);
                      setShowPatientSearch(true);
                    }}
                    onFocus={() => setShowPatientSearch(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  
                  {showPatientSearch && patientSearchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                      {filteredPatients.map((patient) => (
                        <button
                          key={patient.id}
                          onClick={() => handlePatientSelect(patient)}
                          className="w-full text-left p-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="text-sm font-medium text-gray-900">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {message.type === 'email' ? patient.email : patient.phone}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {errors.recipient && <p className="text-red-500 text-xs mt-1">{errors.recipient}</p>}
            </div>

            {/* Subject (Email only) - Compact */}
            {message.type === 'email' && (
              <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                <label className="block text-sm font-semibold text-gray-800 mb-2">Subject</label>
                <input
                  type="text"
                  value={message.subject}
                  onChange={(e) => setMessage({ ...message, subject: e.target.value })}
                  placeholder="Enter subject..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject}</p>}
              </div>
            )}

            {/* Advanced Options - Collapsible */}
            <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-800"
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Advanced Options
                </span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-3">
                      {/* Template Selection */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Template</label>
                        <select
                          value={selectedTemplate}
                          onChange={(e) => handleTemplateChange(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">Select a template...</option>
                          {templates
                            .filter(t => t.type === message.type.toUpperCase())
                            .map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Schedule */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Schedule Send</label>
                        <input
                          type="datetime-local"
                          value={message.scheduleFor || ''}
                          onChange={(e) => setMessage({ ...message, scheduleFor: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>

                      {/* Attachments (Email only) */}
                      {message.type === 'email' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Attachments</label>
                          <div className="border border-dashed border-gray-300 rounded-lg p-2">
                            <input
                              type="file"
                              onChange={handleFileUpload}
                              multiple
                              className="hidden"
                              id="file-upload"
                            />
                            <label
                              htmlFor="file-upload"
                              className="flex items-center justify-center gap-2 cursor-pointer text-gray-600 hover:text-gray-800 text-xs"
                            >
                              <Paperclip className="w-4 h-4" />
                              <span>Click to attach files</span>
                            </label>
                            
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {message.attachments.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between p-1 bg-gray-50 rounded text-xs">
                                    <div className="flex items-center gap-1 truncate">
                                      {file.type.startsWith('image/') ? (
                                        <Image className="w-3 h-3 text-gray-500" />
                                      ) : (
                                        <File className="w-3 h-3 text-gray-500" />
                                      )}
                                      <span className="text-gray-700 truncate">{file.name}</span>
                                    </div>
                                    <button
                                      onClick={() => removeAttachment(index)}
                                      className="text-red-500 hover:text-red-700 ml-2"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column - Message Content */}
          <div className="space-y-3">
            {/* Message Content - Prominent */}
            <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm h-full">
              <label className="block text-sm font-semibold text-gray-800 mb-2">Message</label>
              <textarea
                value={message.content}
                onChange={(e) => setMessage({ ...message, content: e.target.value })}
                placeholder={message.type === 'sms' ? 'Enter your SMS message (160 characters)...' : 'Enter your message...'}
                rows={message.type === 'sms' ? 4 : 10}
                maxLength={message.type === 'sms' ? 160 : undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              />
              {message.type === 'sms' && (
                <p className="text-xs text-gray-500 mt-1">
                  {message.content.length}/160 characters
                </p>
              )}
              {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content}</p>}
              
              {/* Actions - Inline at bottom */}
              <div className="flex gap-2 mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSend}
                  disabled={isSending}
                  className="flex-1 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] text-white px-4 py-2.5 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  {isSending ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {message.scheduleFor ? 'Schedule' : 'Send Now'}
                    </>
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMessage({
                      type: 'email',
                      recipient: '',
                      patientName: '',
                      subject: '',
                      content: '',
                      attachments: []
                    });
                    setSelectedPatients([]);
                    setSelectedTemplate('');
                    setSendingBulk(false);
                    setErrors({});
                  }}
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 text-sm"
                >
                  Clear
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Compose;