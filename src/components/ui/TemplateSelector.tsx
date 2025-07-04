import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailTemplateService, EmailTemplate, SmsTemplate, TemplateVariable } from '../../services/emailTemplateService';
import { cn } from '../../utils/cn';

interface TemplateSelectorProps {
  practiceId: string;
  type: 'email' | 'sms';
  selectedTemplateId?: string;
  onTemplateSelect: (templateId: string | null, variables?: string[]) => void;
  templateType?: string; // e.g., 'appointment_reminder', 'invoice', etc.
  className?: string;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  practiceId,
  type,
  selectedTemplateId,
  onTemplateSelect,
  templateType,
  className
}) => {
  const [templates, setTemplates] = useState<(EmailTemplate | SmsTemplate)[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | SmsTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);

  useEffect(() => {
    fetchTemplates();
  }, [practiceId, type]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setSelectedTemplate(template);
        updateVariables(template);
      }
    }
  }, [selectedTemplateId, templates]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = type === 'email' 
        ? await emailTemplateService.getEmailTemplates(practiceId)
        : await emailTemplateService.getSmsTemplates(practiceId);
      
      // Filter by template type if specified
      const filtered = templateType 
        ? data.filter(t => t.template_type === templateType)
        : data;
      
      setTemplates(filtered);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateVariables = (template: EmailTemplate | SmsTemplate) => {
    const vars = emailTemplateService.getTemplateVariables(template.template_type);
    setVariables(vars);
  };

  const handleTemplateChange = (templateId: string) => {
    if (templateId === 'custom') {
      setSelectedTemplate(null);
      onTemplateSelect(null);
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      updateVariables(template);
      onTemplateSelect(template.id, template.variables);
    }
  };

  const generatePreview = () => {
    if (!selectedTemplate) return;

    // Generate sample data for preview
    const sampleVariables: TemplateVariable[] = variables.map(v => ({
      key: v.key,
      value: getSampleValue(v.key)
    }));

    if (type === 'email' && 'subject' in selectedTemplate) {
      const preview = emailTemplateService.previewEmailTemplate(
        selectedTemplate as EmailTemplate,
        sampleVariables
      );
      setPreviewContent(preview);
    } else {
      // For SMS, just replace variables in content
      let content = selectedTemplate.content;
      sampleVariables.forEach(({ key, value }) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        content = content.replace(regex, value);
      });
      setPreviewContent(content);
    }
    setShowPreview(true);
  };

  const getSampleValue = (key: string): string => {
    const sampleData: Record<string, string> = {
      patientName: 'John Doe',
      practiceName: 'Health Practice',
      practicePhone: '(123) 456-7890',
      practiceEmail: 'info@practice.com',
      practiceAddress: '123 Main St, City, State 12345',
      practiceLogo: '/logo.png',
      appointmentDate: 'March 15, 2024',
      appointmentTime: '2:30 PM',
      doctorName: 'Dr. Smith',
      branchName: 'Main Branch',
      branchAddress: '123 Main St',
      invoiceNumber: 'INV-2024-001',
      invoiceDate: 'March 1, 2024',
      invoiceAmount: '$250.00',
      dueDate: 'March 31, 2024',
      billingPhone: '(123) 456-7891',
      billingEmail: 'billing@practice.com',
      taxNumber: '123-45-6789',
      practiceHours: 'Mon-Fri 9AM-5PM',
      confirmationCode: 'APT-12345'
    };
    return sampleData[key] || `{{${key}}}`;
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <Icon icon="solar:spinner-bold-duotone" className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Template Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {type === 'email' ? 'Email' : 'SMS'} Template
        </label>
        <select
          value={selectedTemplate?.id || 'custom'}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="custom">Custom Message</option>
          <optgroup label="System Templates">
            {templates.filter(t => t.is_default).map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </optgroup>
          {templates.filter(t => !t.is_default).length > 0 && (
            <optgroup label="Practice Templates">
              {templates.filter(t => !t.is_default).map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Template Actions */}
      {selectedTemplate && (
        <div className="flex items-center gap-2">
          <button
            onClick={generatePreview}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
            Preview
          </button>
          
          {variables.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Icon icon="solar:code-square-bold-duotone" className="w-4 h-4" />
              <span>{variables.length} variables available</span>
            </div>
          )}
        </div>
      )}

      {/* Variables Display */}
      {selectedTemplate && variables.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Available Variables:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {variables.map(variable => (
              <div key={variable.key} className="flex items-center gap-2 text-xs">
                <code className="px-2 py-1 bg-white rounded border border-gray-200">
                  {`{{${variable.key}}}`}
                </code>
                {variable.description && (
                  <Icon 
                    icon="solar:info-circle-bold-duotone" 
                    className="w-3.5 h-3.5 text-gray-400"
                    title={variable.description}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            >
              {/* Preview Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Template Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon icon="solar:close-bold-duotone" className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {type === 'email' && selectedTemplate && 'subject' in selectedTemplate ? (
                  <div>
                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-600">Subject:</label>
                      <p className="text-gray-900 font-medium">
                        {selectedTemplate.subject.replace(/{{[^}]+}}/g, (match) => {
                          const key = match.replace(/[{}]/g, '').trim();
                          return getSampleValue(key);
                        })}
                      </p>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm">{previewContent}</pre>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};