import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  Search,
  Mail,
  MessageSquare,
  Copy,
  Check,
  X,
  Save,
  Tag,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import EmailTemplatePreview from './EmailTemplatePreview';
import { professionalEmailTemplates } from './EmailTemplates';

interface Template {
  id?: string;
  name: string;
  type: 'EMAIL' | 'SMS';
  subject?: string;
  body: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const Templates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'EMAIL' | 'SMS'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

  // Enhanced professional templates with proper email structure
  const sampleTemplates: Template[] = [
    // Professional email templates from our new collection
    ...professionalEmailTemplates.map(template => ({
      id: template.id,
      name: template.name,
      type: 'EMAIL' as const,
      subject: template.subject,
      body: template.body,
      is_active: true,
      created_at: new Date().toISOString()
    })),
    {
      id: 'sample-1',
      name: '24 Hour Appointment Reminder',
      type: 'SMS',
      body: 'Hi {patientName}, this is a reminder about your appointment with Dr. {doctorName} tomorrow at {appointmentTime}. Please call {clinicPhone} if you need to reschedule.',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'sample-2', 
      name: '2 Hour Appointment Reminder',
      type: 'SMS',
      body: 'Hello {patientName}, your appointment with Dr. {doctorName} is in 2 hours at {appointmentTime}. Please arrive 15 minutes early. Location: {clinicName}',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'sample-3',
      name: 'Appointment Confirmation Email',
      type: 'EMAIL',
      subject: 'Appointment Confirmation - {appointmentDate}',
      body: 'Dear {patientName},\n\nYour appointment has been confirmed for {appointmentDate} at {appointmentTime} with Dr. {doctorName}.\n\nPlease arrive 15 minutes early and bring:\n• Your ID document\n• Medical aid card (if applicable)\n• Any previous medical records\n\nIf you need to reschedule, please call us at {clinicPhone}.\n\nBest regards,\n{clinicName}',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'sample-4',
      name: 'Post-Appointment Follow-up',
      type: 'EMAIL',
      subject: 'Thank you for your visit - Follow-up Instructions',
      body: 'Dear {patientName},\n\nThank you for visiting us today. We hope you had a positive experience.\n\nFollow-up Instructions:\n{followUpInstructions}\n\nNext Appointment: {nextAppointmentDate}\n\nIf you have any questions or concerns, please don\'t hesitate to contact us.\n\nBest regards,\nDr. {doctorName}\n{clinicName}',
      is_active: false,
      created_at: new Date().toISOString()
    },
    {
      id: 'sample-5',
      name: 'Waitlist Notification',
      type: 'SMS',
      body: 'Good news {patientName}! An appointment slot is now available with Dr. {doctorName} on {appointmentDate} at {appointmentTime}. Reply YES to confirm or call {clinicPhone}.',
      is_active: true,
      created_at: new Date().toISOString()
    }
  ];

  const [formData, setFormData] = useState<Template>({
    name: '',
    type: 'EMAIL',
    subject: '',
    body: '',
    is_active: true
  });

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, filterType]);

  const fetchTemplates = async () => {
    try {
      // Try to fetch from database first
      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Database not available, using sample templates');
        setTemplates(sampleTemplates);
      } else {
        // If database is empty, load sample templates, otherwise use database data
        if (!data || data.length === 0) {
          setTemplates(sampleTemplates);
        } else {
          setTemplates(data);
        }
      }
    } catch (error) {
      console.log('Database error, loading sample templates:', error);
      setTemplates(sampleTemplates);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.subject && t.subject.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTemplates(filtered);
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }

    if (formData.type === 'EMAIL' && !formData.subject?.trim()) {
      newErrors.subject = 'Subject is required for email templates';
    }

    if (!formData.body.trim()) {
      newErrors.body = 'Template content is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const newTemplate: Template = {
        id: editingTemplate?.id || `template-${Date.now()}`,
        name: formData.name,
        type: formData.type,
        subject: formData.subject,
        body: formData.body,
        is_active: formData.is_active,
        created_at: editingTemplate?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (editingTemplate) {
        // Update existing template
        try {
          const { error } = await supabase
            .from('communication_templates')
            .update({
              name: formData.name,
              type: formData.type,
              subject: formData.subject,
              body: formData.body,
              is_active: formData.is_active,
              updated_at: new Date().toISOString()
            })
            .eq('id', editingTemplate.id);

          if (error) throw error;
        } catch (dbError) {
          // Fallback to local state update
          console.log('Database update failed, updating locally');
          setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? newTemplate : t));
          handleCloseModal();
          return;
        }
      } else {
        // Create new template
        try {
          const { error } = await supabase
            .from('communication_templates')
            .insert({
              name: formData.name,
              type: formData.type,
              subject: formData.subject,
              body: formData.body,
              is_active: formData.is_active
            });

          if (error) throw error;
        } catch (dbError) {
          // Fallback to local state update
          console.log('Database insert failed, adding locally');
          setTemplates(prev => [...prev, newTemplate]);
          handleCloseModal();
          return;
        }
      }

      await fetchTemplates();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      // Try to delete from database first
      const { error } = await supabase
        .from('communication_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.log('Database delete failed, removing locally');
      // Fallback to local state update
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleDuplicate = async (template: Template) => {
    try {
      const { error } = await supabase
        .from('communication_templates')
        .insert({
          name: `${template.name} (Copy)`,
          type: template.type,
          subject: template.subject,
          body: template.body,
          is_active: true
        });

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      alert('Failed to duplicate template. Please try again.');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('communication_templates')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.error('Error updating template status:', error);
      alert('Failed to update template status. Please try again.');
    }
  };

  const handleCopyContent = (template: Template) => {
    const content = template.type === 'EMAIL' 
      ? `Subject: ${template.subject}\n\n${template.body}`
      : template.body;
    
    navigator.clipboard.writeText(content);
    setCopiedId(template.id || null);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      type: 'EMAIL',
      subject: '',
      body: '',
      is_active: true
    });
    setErrors({});
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData(template);
    setShowModal(true);
  };

  const extractVariables = (text: string): string[] => {
    const regex = /\{(\w+)\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[30px] font-bold font-heading text-[#494c61]">Message Templates</h1>
          <p className="text-gray-600 text-lg">Create and manage reusable message templates</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-[#01b9d4] to-[#0197d4] text-white px-6 py-3 rounded-xl flex items-center gap-3 hover:shadow-xl transition-all duration-300 font-medium"
        >
          <Plus className="w-5 h-5" />
          New Template
        </motion.button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div className="flex gap-2">
            {(['all', 'EMAIL', 'SMS'] as const).map((type) => (
              <motion.button
                key={type}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterType === type
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {type === 'all' ? 'All' : type}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No templates found</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowModal(true)}
            className="text-primary-500 hover:text-primary-600"
          >
            Create your first template
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const variables = extractVariables(template.body);
            
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {template.type === 'EMAIL' ? (
                        <Mail className="w-5 h-5 text-blue-500" />
                      ) : (
                        <MessageSquare className="w-5 h-5 text-purple-500" />
                      )}
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      template.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {template.subject && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Subject:</span> {template.subject}
                    </p>
                  )}

                  <p className="text-sm text-gray-700 mb-3 line-clamp-3">{template.body}</p>

                  {variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {variables.map((variable) => (
                        <span
                          key={variable}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                        >
                          <Tag className="w-3 h-3" />
                          {variable}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex gap-1">
                      {template.type === 'EMAIL' && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setPreviewTemplate(template)}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Preview Email"
                        >
                          <Eye className="w-4 h-4" />
                        </motion.button>
                      )}
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(template)}
                        className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleCopyContent(template)}
                        className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Copy content"
                      >
                        {copiedId === template.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDuplicate(template)}
                        className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Duplicate"
                      >
                        <FileText className="w-4 h-4" />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(template.id!)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                    
                    <button
                      onClick={() => handleToggleActive(template.id!, template.is_active)}
                      className={`text-xs font-medium ${
                        template.is_active ? 'text-gray-600' : 'text-primary-600'
                      } hover:underline`}
                    >
                      {template.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Template Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            style={{ marginLeft: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/50"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingTemplate ? 'Edit Template' : 'Create New Template'}
                  </h3>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., Appointment Reminder"
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message Type
                    </label>
                    <div className="flex gap-4">
                      {(['EMAIL', 'SMS'] as const).map((type) => (
                        <label key={type} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="type"
                            value={type}
                            checked={formData.type === type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'EMAIL' | 'SMS' })}
                            className="text-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {formData.type === 'EMAIL' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject Line
                      </label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="e.g., Appointment Reminder - {patientName}"
                      />
                      {errors.subject && <p className="text-red-500 text-sm mt-1">{errors.subject}</p>}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message Content
                    </label>
                    <textarea
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      rows={formData.type === 'SMS' ? 4 : 8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder={formData.type === 'SMS' 
                        ? "Hi {patientName}, this is a reminder about your appointment on {appointmentDate} at {appointmentTime}." 
                        : "Dear {patientName},\n\nThis is a reminder about your upcoming appointment..."}
                    />
                    {errors.body && <p className="text-red-500 text-sm mt-1">{errors.body}</p>}
                    
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-1">Available Variables:</p>
                      <p className="text-xs text-gray-600">
                        {'{patientName}'}, {'{appointmentDate}'}, {'{appointmentTime}'}, {'{doctorName}'}, 
                        {'{clinicName}'}, {'{clinicPhone}'}, {'{medication}'}, {'{amount}'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-gray-300 text-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Template is active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  className="flex-1 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Template Preview Modal */}
      {previewTemplate && (
        <EmailTemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
};

export default Templates;