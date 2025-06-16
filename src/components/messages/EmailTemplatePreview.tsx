import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Eye, 
  Smartphone, 
  Monitor, 
  Building2, 
  Calendar, 
  Phone, 
  Globe,
  ArrowLeft,
  Download,
  Settings,
  Star,
  Archive,
  MoreHorizontal,
  Reply
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';

interface EmailTemplatePreviewProps {
  template: {
    id?: string;
    name: string;
    type: 'EMAIL' | 'SMS';
    subject?: string;
    body: string;
    category?: string;
  };
  onClose?: () => void;
  variables?: { [key: string]: string };
  practiceData?: any;
}

const EmailTemplatePreview: React.FC<EmailTemplatePreviewProps> = ({ 
  template, 
  onClose, 
  variables = {}, 
  practiceData 
}) => {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [currentPracticeData, setCurrentPracticeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sample variables for preview
  const defaultVariables = {
    '{{patientName}}': 'Sarah Johnson',
    '{{doctorName}}': 'Dr. Michael Smith',
    '{{practiceName}}': practiceData?.name || currentPracticeData?.name || 'HealthCare Medical Center',
    '{{practicePhone}}': practiceData?.contact_phone || currentPracticeData?.contact_phone || '+264 61 123 4567',
    '{{practiceEmail}}': practiceData?.contact_email || currentPracticeData?.contact_email || 'info@healthcare.com',
    '{{practiceWebsite}}': practiceData?.website_url || currentPracticeData?.website_url || 'www.healthcare.com',
    '{{practiceAddress}}': practiceData?.address || currentPracticeData?.address || '123 Independence Avenue, Windhoek',
    '{{appointmentDate}}': 'Friday, March 15, 2024',
    '{{appointmentTime}}': '2:30 PM',
    '{{invoiceNumber}}': 'INV-2024-0127',
    '{{amount}}': 'N$450.00',
    '{{dueDate}}': 'March 30, 2024',
    '{{visitDate}}': 'March 10, 2024',
    '{{followUpInstructions}}': 'Take prescribed medication twice daily with meals',
    '{{careInstructions}}': 'Rest for 24 hours and avoid strenuous activities',
    '{{paymentLink}}': `${window.location.origin}/pay/invoice/INV-2024-0127`,
    '{{portalLink}}': `${window.location.origin}/portal`,
    '{{nextAppointment}}': 'April 15, 2024 at 10:00 AM'
  };

  // Load practice data
  useEffect(() => {
    const loadPracticeData = async () => {
      if (!user?.practice_id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: practice, error } = await supabase
          .from('practices')
          .select('*')
          .eq('id', user.practice_id)
          .single();

        if (error) {
          console.error('Error loading practice data:', error);
        } else if (practice) {
          setCurrentPracticeData(practice);
        }
      } catch (error) {
        console.error('Error loading practice data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPracticeData();
  }, [user?.practice_id]);

  // Merge default variables with provided ones
  const allVariables = { ...defaultVariables, ...variables };

  // Replace variables in template content
  const processTemplate = (content: string) => {
    let processed = content;
    Object.entries(allVariables).forEach(([key, value]) => {
      const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processed = processed.replace(regex, value);
    });
    return processed;
  };

  // Get logo URL
  const logoUrl = practiceData?.logo_url || currentPracticeData?.logo_url || 
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=200&h=80&fit=crop&crop=center';

  // Professional email HTML template
  const generateEmailHTML = () => {
    const processedSubject = template.subject ? processTemplate(template.subject) : '';
    const processedBody = processTemplate(template.body);
    
    // Convert plain text to HTML with basic formatting
    const htmlBody = processedBody
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${processedSubject}</title>
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f8fafc;
            line-height: 1.6;
          }
          .email-container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #01b9d5 0%, #0ea5e9 100%); 
            padding: 30px; 
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: shimmer 3s ease-in-out infinite;
          }
          @keyframes shimmer {
            0%, 100% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
          }
          .logo { 
            max-width: 180px; 
            height: auto; 
            margin-bottom: 15px;
            filter: brightness(0) invert(1);
            border-radius: 8px;
          }
          .practice-name { 
            color: white; 
            font-size: 28px; 
            font-weight: 700; 
            margin: 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .practice-tagline {
            color: rgba(255,255,255,0.9);
            font-size: 16px;
            margin: 5px 0 0 0;
            font-weight: 400;
          }
          .content { 
            padding: 40px 30px;
            color: #374151;
            font-size: 16px;
          }
          .content p {
            margin: 0 0 20px 0;
          }
          .appointment-card, .invoice-card {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            position: relative;
            overflow: hidden;
          }
          .appointment-card::before, .invoice-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #01b9d5, #0ea5e9);
          }
          .card-title {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 16px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .card-details {
            display: grid;
            gap: 12px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 500;
            color: #6b7280;
          }
          .detail-value {
            font-weight: 600;
            color: #1f2937;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #01b9d5 0%, #0ea5e9 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            box-shadow: 0 4px 12px rgba(1, 185, 213, 0.3);
            transition: all 0.3s ease;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(1, 185, 213, 0.4);
          }
          .footer { 
            background: #f8fafc; 
            padding: 30px; 
            text-align: center; 
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .contact-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
            padding: 20px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          .contact-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #4b5563;
          }
          .social-links {
            margin: 20px 0;
          }
          .social-links a {
            color: #01b9d5;
            text-decoration: none;
            margin: 0 10px;
            font-weight: 500;
          }
          .disclaimer {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 20px;
            line-height: 1.4;
          }
          @media (max-width: 600px) {
            .email-container { margin: 10px; border-radius: 8px; }
            .header { padding: 20px; }
            .content { padding: 24px 20px; }
            .practice-name { font-size: 24px; }
            .contact-info { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            ${currentPracticeData?.logo_url ? 
              `<img src="${currentPracticeData.logo_url}" alt="${allVariables['{{practiceName}}']}" class="logo">` : 
              `<div style="width: 60px; height: 60px; background: white; border-radius: 12px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#01b9d5"/>
                </svg>
              </div>`
            }
            <h1 class="practice-name">${allVariables['{{practiceName}}']}</h1>
            <p class="practice-tagline">Your Health, Our Priority</p>
          </div>
          
          <div class="content">
            ${template.category === 'appointment' ? `
              <div class="appointment-card">
                <h3 class="card-title">
                  📅 Appointment Details
                </h3>
                <div class="card-details">
                  <div class="detail-row">
                    <span class="detail-label">Date</span>
                    <span class="detail-value">${allVariables['{{appointmentDate}}']}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Time</span>
                    <span class="detail-value">${allVariables['{{appointmentTime}}']}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Doctor</span>
                    <span class="detail-value">${allVariables['{{doctorName}}']}</span>
                  </div>
                </div>
              </div>
            ` : ''}
            
            ${template.category === 'invoice' ? `
              <div class="invoice-card">
                <h3 class="card-title">
                  💰 Invoice Details
                </h3>
                <div class="card-details">
                  <div class="detail-row">
                    <span class="detail-label">Invoice Number</span>
                    <span class="detail-value">${allVariables['{{invoiceNumber}}']}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Amount</span>
                    <span class="detail-value">${allVariables['{{amount}}']}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Due Date</span>
                    <span class="detail-value">${allVariables['{{dueDate}}']}</span>
                  </div>
                </div>
                <a href="${allVariables['{{paymentLink}}']}" class="cta-button">Pay Invoice Online</a>
              </div>
            ` : ''}
            
            ${htmlBody}
            
            ${template.category === 'welcome' ? `
              <a href="${allVariables['{{portalLink}}']}" class="cta-button">Access Patient Portal</a>
            ` : ''}
          </div>
          
          <div class="footer">
            <div class="contact-info">
              <div class="contact-item">
                📞 ${allVariables['{{practicePhone}}']}
              </div>
              <div class="contact-item">
                ✉️ ${allVariables['{{practiceEmail}}']}
              </div>
              <div class="contact-item">
                🌐 ${allVariables['{{practiceWebsite}}']}
              </div>
              <div class="contact-item">
                📍 ${allVariables['{{practiceAddress}}']}
              </div>
            </div>
            
            <div class="social-links">
              <a href="${allVariables['{{practiceWebsite}}']}" target="_blank">Visit Website</a>
              <a href="tel:${allVariables['{{practicePhone}}']}" target="_blank">Call Us</a>
              <a href="${allVariables['{{portalLink}}']}" target="_blank">Patient Portal</a>
            </div>
            
            <div class="disclaimer">
              This email was sent from ${allVariables['{{practiceName}}']}. If you no longer wish to receive emails from us, 
              please contact us at ${allVariables['{{practiceEmail}}']}.
              <br><br>
              © ${new Date().getFullYear()} ${allVariables['{{practiceName}}']}. All rights reserved.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  if (template.type === 'SMS') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">SMS Preview</h3>
              {onClose && (
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          
          <div className="p-6">
            <div className="bg-gray-100 rounded-2xl p-4 mb-4">
              <div className="bg-blue-500 text-white rounded-2xl rounded-bl-sm p-3 max-w-[85%] ml-auto">
                <p className="text-sm leading-relaxed">{processTemplate(template.body)}</p>
                <div className="text-xs opacity-75 mt-1">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 text-center">
              Character count: {processTemplate(template.body).length}/160
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onClose && (
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Email Preview</h3>
                <p className="text-gray-600">{template.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('desktop')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('mobile')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
              
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4" />
                Export HTML
              </button>
            </div>
          </div>
        </div>

        {/* Email Client Mockup */}
        <div className="flex-1 bg-gray-100 p-6">
          <div className={`mx-auto bg-white rounded-lg shadow-lg overflow-hidden ${
            viewMode === 'desktop' ? 'max-w-4xl' : 'max-w-sm'
          }`}>
            {/* Email Client Header */}
            <div className="bg-gray-50 border-b border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Mail className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{allVariables['{{practiceName}}']}</div>
                    <div className="text-sm text-gray-600">{allVariables['{{practiceEmail}}']}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <Star className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <Archive className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {template.subject ? processTemplate(template.subject) : 'Email Subject'}
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>to: {allVariables['{{patientName}}']}</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Email Content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              <iframe
                srcDoc={generateEmailHTML()}
                className="w-full h-full border-none"
                style={{ minHeight: '600px' }}
                title="Email Preview"
              />
            </div>

            {/* Email Actions */}
            <div className="bg-gray-50 border-t border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Reply className="w-4 h-4" />
                  Reply
                </button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Forward
                </button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Variables Display */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="text-sm text-gray-600">
            <strong>Template Variables:</strong> {Object.keys(allVariables).slice(0, 6).join(', ')}
            {Object.keys(allVariables).length > 6 && ` +${Object.keys(allVariables).length - 6} more`}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EmailTemplatePreview;