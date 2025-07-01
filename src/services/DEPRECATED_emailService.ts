/**
 * @deprecated This service is deprecated. Use communicationService instead.
 * 
 * DEPRECATED: DO NOT USE THIS SERVICE
 * This email service has been replaced by the centralized communication gateway.
 * All email sending should now go through:
 * - communicationService.sendEmail() for application code
 * - centralized-email-gateway edge function for direct calls
 * 
 * This file is kept only for reference and will be removed in a future release.
 * 
 * Migration guide:
 * Old: emailService.sendEmail({ to, subject, html, text })
 * New: communicationService.sendEmail({ practiceId, recipientEmail, subject, htmlContent, emailType, ... })
 */

interface EmailData {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResponse {
  success: boolean;
  id?: string;
  error?: string;
}

class EmailService {
  private apiKey: string;
  private baseUrl: string = 'https://api.resend.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(emailData: EmailData): Promise<EmailResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailData.from || 'OneHealth Medical <noreply@onehealth.com.na>',
          to: [emailData.to],
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        id: result.id,
      };
    } catch (error) {
      console.error('Email service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Generate HTML email from practice data
  generateEmailHTML(data: {
    recipientName: string;
    message: string;
    doctorName: string;
    doctorRole: string;
    practiceInfo: {
      name: string;
      logo?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
    };
  }): string {
    const { recipientName, message, doctorName, doctorRole, practiceInfo } = data;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message from ${practiceInfo.name}</title>
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
            max-width: 80px; 
            height: 80px; 
            border-radius: 50%; 
            margin: 0 auto 15px; 
            object-fit: cover; 
            border: 3px solid rgba(255,255,255,0.3); 
        }
        .logo-fallback { 
            width: 80px; 
            height: 80px; 
            background: rgba(255,255,255,0.2); 
            border-radius: 50%; 
            margin: 0 auto 15px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 24px; 
            font-weight: bold; 
            color: white; 
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
            .contact-info { flex-direction: column; gap: 10px; align-items: center; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header with Practice Branding -->
        <div class="header">
            ${practiceInfo.logo ? 
                `<img src="${practiceInfo.logo}" alt="${practiceInfo.name} Logo" class="logo" />` :
                `<div class="logo-fallback">
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
                <div>${practiceInfo.address || ''}</div>
            </div>

            <div class="contact-info">
                ${practiceInfo.phone ? `<div class="contact-item">📞 ${practiceInfo.phone}</div>` : ''}
                ${practiceInfo.email ? `<div class="contact-item">✉️ ${practiceInfo.email}</div>` : ''}
                ${practiceInfo.website ? `<div class="contact-item">🌐 ${practiceInfo.website}</div>` : ''}
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
  }
}

// Create singleton instance
let emailService: EmailService | null = null;

export const getEmailService = (): EmailService => {
  if (!emailService) {
    const apiKey = import.meta.env.VITE_RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_RESEND_API_KEY environment variable is not set');
    }
    emailService = new EmailService(apiKey);
  }
  return emailService;
};

export { EmailService };
export type { EmailData, EmailResponse };