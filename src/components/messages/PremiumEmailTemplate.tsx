import React from 'react';

interface PremiumEmailTemplateProps {
  recipientName?: string;
  recipientEmail?: string;
  subject?: string;
  message?: string;
  doctorName?: string;
  doctorRole?: string;
  practiceInfo?: {
    name: string;
    logo?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

const PremiumEmailTemplate: React.FC<PremiumEmailTemplateProps> = ({
  recipientName = "Patient",
  recipientEmail = "",
  subject = "",
  message = "",
  doctorName = "Dr. Smith",
  doctorRole = "General Practitioner",
  practiceInfo = {
    name: "OneHealth Medical Practice",
    address: "123 Medical Drive, Windhoek, Namibia",
    phone: "+264 61 123 456",
    email: "info@onehealth.com.na",
    website: "www.onehealth.com.na"
  }
}) => {
  
  // Generate the HTML email template
  const generateEmailHTML = () => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background-color: #f8fafc; 
            color: #334155; 
            line-height: 1.6; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #01b9d5 0%, #6366f1 100%); 
            padding: 30px; 
            text-align: center; 
        }
        .logo { 
            max-width: 200px; 
            height: auto; 
            margin-bottom: 15px; 
        }
        .practice-name { 
            color: white; 
            font-size: 24px; 
            font-weight: 700; 
            margin-bottom: 8px; 
        }
        .practice-tagline { 
            color: rgba(255,255,255,0.9); 
            font-size: 14px; 
        }
        .content { 
            padding: 40px 30px; 
        }
        .greeting { 
            font-size: 18px; 
            font-weight: 600; 
            color: #1e293b; 
            margin-bottom: 25px; 
        }
        .message-body { 
            font-size: 16px; 
            line-height: 1.7; 
            color: #475569; 
            margin-bottom: 30px; 
            white-space: pre-wrap; 
        }
        .signature { 
            background: #f1f5f9; 
            border-left: 4px solid #01b9d5; 
            padding: 25px; 
            margin: 30px 0; 
        }
        .signature-name { 
            font-size: 18px; 
            font-weight: 600; 
            color: #1e293b; 
            margin-bottom: 5px; 
        }
        .signature-role { 
            color: #64748b; 
            font-size: 14px; 
            margin-bottom: 15px; 
        }
        .signature-practice { 
            color: #01b9d5; 
            font-weight: 600; 
            font-size: 16px; 
        }
        .footer { 
            background: #1e293b; 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .practice-info { 
            margin-bottom: 20px; 
        }
        .practice-info div { 
            margin: 5px 0; 
            font-size: 14px; 
        }
        .contact-info { 
            display: flex; 
            justify-content: center; 
            gap: 20px; 
            margin-bottom: 20px; 
            flex-wrap: wrap; 
        }
        .contact-item { 
            display: flex; 
            align-items: center; 
            gap: 5px; 
            font-size: 13px; 
        }
        .disclaimer { 
            font-size: 11px; 
            color: #94a3b8; 
            border-top: 1px solid #374151; 
            padding-top: 20px; 
            line-height: 1.5; 
        }
        .disclaimer p { 
            margin: 5px 0; 
        }
        @media only screen and (max-width: 600px) {
            .email-container { margin: 0 10px; }
            .header, .content, .footer { padding: 20px; }
            .contact-info { flex-direction: column; gap: 10px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header with Practice Branding -->
        <div class="header">
            ${practiceInfo.logo ? 
                `<img src="${practiceInfo.logo}" alt="${practiceInfo.name} Logo" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 15px; object-fit: cover; border: 3px solid rgba(255,255,255,0.3);" />` :
                `<div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: white;">
                    ${practiceInfo.name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase()}
                </div>`
            }
            <div class="practice-name">${practiceInfo.name}</div>
            <div class="practice-tagline">Excellence in Healthcare • Compassionate Care</div>
        </div>

        <!-- Main Content -->
        <div class="content">
            <div class="greeting">Dear ${recipientName},</div>
            
            <div class="message-body">${message}</div>

            <!-- Professional Signature -->
            <div class="signature">
                <div class="signature-name">${doctorName}</div>
                <div class="signature-role">${doctorRole}</div>
                <div class="signature-practice">${practiceInfo.name}</div>
            </div>
        </div>

        <!-- Footer with Practice Information -->
        <div class="footer">
            <div class="practice-info">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: #01b9d5;">
                    ${practiceInfo.name}
                </div>
                <div>${practiceInfo.address}</div>
            </div>

            <div class="contact-info">
                <div class="contact-item">
                    📞 ${practiceInfo.phone}
                </div>
                <div class="contact-item">
                    ✉️ ${practiceInfo.email}
                </div>
                <div class="contact-item">
                    🌐 ${practiceInfo.website}
                </div>
            </div>

            <div class="disclaimer">
                <p><strong>Medical Disclaimer:</strong> This email may contain confidential medical information intended only for the named recipient. If you are not the intended recipient, please notify the sender immediately and delete this email.</p>
                <p><strong>Privacy Notice:</strong> Your privacy is important to us. This communication is governed by our Privacy Policy available on our website.</p>
                <p><strong>Emergency Notice:</strong> This email is not monitored 24/7. For urgent medical matters, please call our emergency line or visit the nearest emergency facility.</p>
                <p style="margin-top: 15px; color: #64748b;">© ${new Date().getFullYear()} ${practiceInfo.name}. All rights reserved. | Powered by OneHealth Practice Management System</p>
            </div>
        </div>
    </div>
</body>
</html>`;
  };

  // Component renders a preview of the email
  return (
    <div className="w-full h-full">
      {/* Email Preview */}
      <div className="bg-gray-50 p-4 h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#01b9d5] to-indigo-600 p-6 text-center text-white">
            {practiceInfo.logo ? (
              <img 
                src={practiceInfo.logo} 
                alt={`${practiceInfo.name} Logo`}
                className="w-16 h-16 rounded-full mx-auto mb-4 object-cover border-2 border-white/30"
              />
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center text-xl font-bold">
                {practiceInfo.name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <h1 className="text-xl font-bold mb-2">{practiceInfo.name}</h1>
            <p className="text-white/90 text-sm">Excellence in Healthcare • Compassionate Care</p>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="text-lg font-semibold text-gray-800 mb-6">
              Dear {recipientName},
            </div>
            
            <div className="text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap">
              {message || "Your email message will appear here..."}
            </div>

            {/* Signature */}
            <div className="bg-gray-50 border-l-4 border-[#01b9d5] p-4 mb-6">
              <div className="font-semibold text-gray-800">{doctorName}</div>
              <div className="text-gray-600 text-sm mb-2">{doctorRole}</div>
              <div className="text-[#01b9d5] font-semibold">{practiceInfo.name}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-800 text-white p-6 text-center">
            <div className="mb-4">
              <div className="text-[#01b9d5] font-semibold mb-2">{practiceInfo.name}</div>
              <div className="text-sm text-gray-300">{practiceInfo.address}</div>
            </div>
            
            <div className="flex justify-center gap-6 mb-4 text-sm">
              <span>📞 {practiceInfo.phone}</span>
              <span>✉️ {practiceInfo.email}</span>
              <span>🌐 {practiceInfo.website}</span>
            </div>

            <div className="text-xs text-gray-400 border-t border-gray-700 pt-4 space-y-2">
              <p><strong>Medical Disclaimer:</strong> This email contains confidential medical information.</p>
              <p><strong>Emergency Notice:</strong> For urgent matters, call our emergency line.</p>
              <p className="mt-3">© {new Date().getFullYear()} {practiceInfo.name}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { PremiumEmailTemplate };
export type { PremiumEmailTemplateProps };