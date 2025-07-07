import React, { useState } from 'react';
import { 
  X, 
  Eye, 
  Smartphone, 
  Monitor, 
  Mail,
  Calendar,
  DollarSign,
  Heart,
  UserPlus,
  FileText,
  Bell,
  Activity,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailTemplatePreviewsProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  practiceData?: any;
}

const EmailTemplatePreviews: React.FC<EmailTemplatePreviewsProps> = ({ 
  isOpen, 
  onClose, 
  serviceName,
  practiceData 
}) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Get template data based on service name
  const getTemplateData = () => {
    const practiceName = practiceData?.name || 'HealthCare Medical Center';
    const practicePhone = practiceData?.contact_phone || '+264 61 123 4567';
    const practiceEmail = practiceData?.contact_email || 'info@healthcare.com';
    const practiceWebsite = practiceData?.website_url || 'www.healthcare.com';
    const logoUrl = practiceData?.logo_url;

    const templates = {
      'appointmentReminders': {
        subject: 'Appointment Reminder - Tomorrow at 2:30 PM',
        icon: Calendar,
        color: 'blue',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #01b9d5 0%, #0ea5e9 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              ${logoUrl ? 
                `<img src="${logoUrl}" alt="${practiceName}" style="max-width: 150px; height: auto; margin-bottom: 15px; filter: brightness(0) invert(1);">` :
                `<div style="width: 60px; height: 60px; background: white; border-radius: 12px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#01b9d5"/>
                  </svg>
                </div>`
              }
              <h1 style="color: white; font-size: 28px; font-weight: 700; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${practiceName}
              </h1>
              <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 5px 0 0 0;">Your Health, Our Priority</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px; background: white;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Appointment Reminder</h2>
              
              <!-- Appointment Card -->
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; position: relative; border-top: 4px solid #01b9d5;">
                <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                  📅 Appointment Details
                </h3>
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="font-weight: 500; color: #6b7280;">Date</span>
                    <span style="font-weight: 600; color: #1f2937;">Friday, March 15, 2024</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="font-weight: 500; color: #6b7280;">Time</span>
                    <span style="font-weight: 600; color: #1f2937;">2:30 PM</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                    <span style="font-weight: 500; color: #6b7280;">Doctor</span>
                    <span style="font-weight: 600; color: #1f2937;">Dr. Michael Smith</span>
                  </div>
                </div>
              </div>
              
              <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                Dear Sarah Johnson,<br><br>
                This is a friendly reminder about your upcoming appointment scheduled for tomorrow.
              </p>
              
              <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h4 style="color: #92400e; margin: 0 0 8px 0; font-size: 16px;">What to bring:</h4>
                <ul style="color: #92400e; margin: 0; padding-left: 16px;">
                  <li>Valid ID document</li>
                  <li>Medical aid card (if applicable)</li>
                  <li>Any previous medical records</li>
                  <li>List of current medications</li>
                </ul>
              </div>
              
              <p style="color: #374151; line-height: 1.6;">
                Please arrive 15 minutes early for check-in. If you need to reschedule, please contact us immediately.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  📞 ${practicePhone}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  ✉️ ${practiceEmail}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  🌐 ${practiceWebsite}
                </div>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0;">
                © ${new Date().getFullYear()} ${practiceName}. All rights reserved.
              </p>
            </div>
          </div>
        `
      },
      
      'invoiceDelivery': {
        subject: 'Invoice INV-2024-0127 - HealthCare Medical Center',
        icon: DollarSign,
        color: 'green',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #01b9d5 0%, #0ea5e9 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              ${logoUrl ? 
                `<img src="${logoUrl}" alt="${practiceName}" style="max-width: 150px; height: auto; margin-bottom: 15px; filter: brightness(0) invert(1);">` :
                `<div style="width: 60px; height: 60px; background: white; border-radius: 12px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#01b9d5"/>
                  </svg>
                </div>`
              }
              <h1 style="color: white; font-size: 28px; font-weight: 700; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${practiceName}
              </h1>
              <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 5px 0 0 0;">Your Health, Our Priority</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px; background: white;">
              <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0;">Invoice</h2>
              
              <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                Dear Sarah Johnson,<br><br>
                Thank you for visiting ${practiceName}. We hope you had a positive experience with our healthcare services.
              </p>
              
              <!-- Invoice Card -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; margin: 24px 0; position: relative; border-top: 4px solid #22c55e;">
                <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                  💰 Invoice Details
                </h3>
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #bbf7d0;">
                    <span style="font-weight: 500; color: #6b7280;">Invoice Number</span>
                    <span style="font-weight: 600; color: #1f2937;">INV-2024-0127</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #bbf7d0;">
                    <span style="font-weight: 500; color: #6b7280;">Amount</span>
                    <span style="font-weight: 600; color: #1f2937; font-size: 18px;">N$450.00</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #bbf7d0;">
                    <span style="font-weight: 500; color: #6b7280;">Due Date</span>
                    <span style="font-weight: 600; color: #1f2937;">March 30, 2024</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                    <span style="font-weight: 500; color: #6b7280;">Service Date</span>
                    <span style="font-weight: 600; color: #1f2937;">March 10, 2024</span>
                  </div>
                </div>
                <div style="text-align: center; margin: 20px 0 0 0;">
                  <a href="#" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
                    Pay Invoice Online
                  </a>
                </div>
              </div>
              
              <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h4 style="color: #374151; margin: 0 0 8px 0; font-size: 16px;">Payment Options:</h4>
                <ul style="color: #6b7280; margin: 0; padding-left: 16px;">
                  <li>Online payment (recommended)</li>
                  <li>Bank transfer</li>
                  <li>In-person at reception</li>
                  <li>Phone payment</li>
                </ul>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  📞 ${practicePhone}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  ✉️ ${practiceEmail}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  🌐 ${practiceWebsite}
                </div>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0;">
                © ${new Date().getFullYear()} ${practiceName}. All rights reserved.
              </p>
            </div>
          </div>
        `
      },
      
      'birthdayMessages': {
        subject: '🎉 Happy Birthday Sarah! Special offer inside',
        icon: Heart,
        color: 'pink',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              ${logoUrl ? 
                `<img src="${logoUrl}" alt="${practiceName}" style="max-width: 150px; height: auto; margin-bottom: 15px; filter: brightness(0) invert(1);">` :
                `<div style="width: 60px; height: 60px; background: white; border-radius: 12px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#ec4899"/>
                  </svg>
                </div>`
              }
              <h1 style="color: white; font-size: 28px; font-weight: 700; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${practiceName}
              </h1>
              <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 5px 0 0 0;">Your Health, Our Priority</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px; background: white; text-align: center;">
              <div style="font-size: 48px; margin: 0 0 20px 0;">🎂</div>
              <h2 style="color: #1f2937; font-size: 28px; margin: 0 0 10px 0;">Happy Birthday, Sarah!</h2>
              <p style="color: #ec4899; font-size: 18px; font-weight: 600; margin: 0 0 30px 0;">
                Wishing you a year filled with health and happiness! 🎉
              </p>
              
              <!-- Birthday Offer Card -->
              <div style="background: linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%); border: 2px solid #f9a8d4; border-radius: 16px; padding: 30px; margin: 30px 0; position: relative;">
                <div style="position: absolute; top: -15px; left: 50%; transform: translateX(-50%); background: #ec4899; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                  BIRTHDAY SPECIAL
                </div>
                <h3 style="color: #be185d; font-size: 24px; margin: 0 0 16px 0;">15% OFF Health Screening</h3>
                <p style="color: #831843; margin: 0 0 20px 0;">
                  As our birthday gift to you! Valid for the next 30 days.
                </p>
                <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <h4 style="color: #be185d; margin: 0 0 8px 0;">Your birthday offer includes:</h4>
                  <ul style="color: #831843; margin: 0; padding-left: 16px; text-align: left;">
                    <li>15% off comprehensive health check-up</li>
                    <li>Complimentary wellness consultation</li>
                    <li>Priority booking</li>
                  </ul>
                </div>
                <a href="#" style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin: 16px 0 0 0; box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);">
                  Book Your Birthday Check-up
                </a>
                <p style="color: #9d174d; font-size: 12px; margin: 16px 0 0 0;">
                  Use code: BIRTHDAY2024
                </p>
              </div>
              
              <p style="color: #374151; line-height: 1.6;">
                This is also the perfect time to schedule your annual health screening if you haven't already this year.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  📞 ${practicePhone}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  ✉️ ${practiceEmail}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #4b5563; justify-content: center;">
                  🌐 ${practiceWebsite}
                </div>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0;">
                © ${new Date().getFullYear()} ${practiceName}. All rights reserved.
              </p>
            </div>
          </div>
        `
      }
    };

    return templates[serviceName as keyof typeof templates] || templates.appointmentReminders;
  };

  const template = getTemplateData();

  if (!isOpen) return null;

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
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Professional Email Preview</h3>
                <p className="text-gray-600">How your patients will see this email</p>
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
            </div>
          </div>
        </div>

        {/* Email Client Mockup */}
        <div className="flex-1 bg-gray-100 p-6">
          <div className={`mx-auto bg-white rounded-lg shadow-lg overflow-hidden ${
            viewMode === 'desktop' ? 'max-w-4xl' : 'max-w-sm'
          }`}>
            {/* Gmail-style Header */}
            <div className="bg-gray-50 border-b border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Mail className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{practiceData?.name || 'HealthCare Medical Center'}</div>
                    <div className="text-sm text-gray-600">{practiceData?.contact_email || 'info@healthcare.com'}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">{new Date().toLocaleDateString()}</div>
              </div>
              
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {template.subject}
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>to: Sarah Johnson</span>
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Email Content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 300px)' }}>
              <div 
                dangerouslySetInnerHTML={{ __html: template.html }}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="text-sm text-gray-600 text-center">
            This is how your professional email will appear in your patients' inboxes
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EmailTemplatePreviews;