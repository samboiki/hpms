import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface TemplateVariable {
  key: string;
  description: string;
}

interface TemplateEditorProps {
  type: 'email' | 'sms';
  subject?: string;
  content: string;
  variables?: TemplateVariable[];
  onUpdate: (data: { subject?: string; content: string }) => void;
  className?: string;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  type,
  subject: initialSubject,
  content: initialContent,
  variables = [],
  onUpdate,
  className
}) => {
  const [subject, setSubject] = useState(initialSubject || '');
  const [content, setContent] = useState(initialContent || '');
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');

  useEffect(() => {
    setSubject(initialSubject || '');
    setContent(initialContent || '');
  }, [initialSubject, initialContent]);

  const handleContentChange = (value: string) => {
    setContent(value);
    onUpdate({ subject, content: value });
  };

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    onUpdate({ subject: value, content });
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('.template-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + `{{${variable}}}` + content.substring(end);
      handleContentChange(newContent);
      
      // Reset cursor position
      setTimeout(() => {
        textarea.selectionStart = start + variable.length + 4;
        textarea.selectionEnd = start + variable.length + 4;
        textarea.focus();
      }, 0);
    }
  };

  const generatePreview = () => {
    // Generate sample data for preview
    const sampleData: Record<string, string> = {
      patientName: 'John Doe',
      patientFirstName: 'John',
      patientLastName: 'Doe',
      practiceName: 'New Charm Dental Practice',
      practicePhone: '+264 81 435 8843',
      practiceEmail: 'info@newcharmdental.na',
      appointmentDate: 'Monday, March 15, 2024',
      appointmentTime: '2:30 PM',
      doctorName: 'Dr. Smith',
      confirmationCode: 'APT-12345',
      invoiceNumber: 'INV-2024-001',
      invoiceAmount: 'NAD 1,250.00',
      dueDate: 'March 31, 2024'
    };

    // Replace variables in content
    let processedContent = content;
    let processedSubject = subject;

    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processedContent = processedContent.replace(regex, value);
      processedSubject = processedSubject.replace(regex, value);
    });

    // Replace any remaining variables with placeholder
    processedContent = processedContent.replace(/{{[^}]+}}/g, '[Variable]');
    processedSubject = processedSubject.replace(/{{[^}]+}}/g, '[Variable]');

    setPreviewContent(processedContent);
    setPreviewSubject(processedSubject);
    setShowPreview(true);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Subject Line (Email only) */}
      {type === 'email' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject Line
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            placeholder="Enter email subject..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      )}

      {/* Content Editor */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            {type === 'email' ? 'Email Content' : 'SMS Message'}
          </label>
          <button
            onClick={generatePreview}
            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
            Preview
          </button>
        </div>
        
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={type === 'email' 
            ? "Enter your email content here...\n\nYou can use variables like {{patientName}}, {{appointmentDate}}, etc."
            : "Enter your SMS message here. Use variables like {{patientName}}, {{appointmentTime}}, etc."
          }
          rows={type === 'email' ? 8 : 4}
          className="template-content w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none font-mono text-sm"
        />
        
        <div className="mt-2 text-xs text-gray-500">
          {type === 'sms' 
            ? `${content.length} characters (${Math.ceil(content.length / 160)} SMS)`
            : `${content.split(/\s+/).filter(w => w).length} words`
          }
        </div>
      </div>

      {/* Variables */}
      {variables.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Available Variables</h4>
          <div className="flex flex-wrap gap-2">
            {variables.map((variable) => (
              <button
                key={variable.key}
                onClick={() => insertVariable(variable.key)}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors group"
                title={variable.description}
              >
                <Icon icon="solar:code-square-bold-duotone" className="w-3.5 h-3.5 text-gray-500 group-hover:text-primary" />
                <code className="font-mono">{`{{${variable.key}}}`}</code>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
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
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
          >
            {/* Preview Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {type === 'email' ? 'Email Preview' : 'SMS Preview'}
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon="solar:close-bold-duotone" className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {type === 'email' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Subject:</label>
                    <p className="text-gray-900 font-medium">{previewSubject || 'No subject'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Content:</label>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                        {previewContent}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 rounded-xl p-4 max-w-sm mx-auto">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:smartphone-bold-duotone" className="w-6 h-6 text-green-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{previewContent}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {Math.ceil(previewContent.length / 160)} SMS • {previewContent.length} chars
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};