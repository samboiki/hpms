import { supabase } from '../lib/supabase';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResponse {
  success: boolean;
  id?: string;
  error?: string;
}

interface PracticeEmailData {
  recipientName: string;
  recipientEmail: string;
  subject: string;
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
    themeColor?: string;
  };
}

class EmailEdgeService {
  /**
   * Send email using Supabase Edge Function (which uses Resend)
   */
  async sendEmail(emailData: EmailData): Promise<EmailResponse> {
    try {
      console.log('📧 Sending email via Supabase Edge Function...');
      
      // Use the individual email function for single emails
      const { data, error } = await supabase.functions.invoke('send-individual-email', {
        body: {
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send email via edge function'
        };
      }

      return {
        success: true,
        id: data?.email_id || data?.id
      };

    } catch (error) {
      console.error('Email edge service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate premium HTML email template for practice communications
   */
  generatePracticeEmailHTML(data: PracticeEmailData): string {
    const { recipientName, message, doctorName, doctorRole, practiceInfo } = data;
    
    // Get theme color (default to brand color if not provided)
    const themeColor = practiceInfo.themeColor || '#01b9d4';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message from ${practiceInfo.name}</title>
    <style>
        /* Advanced email-safe font loading */
        @import url('https://fonts.bunny.net/css?family=inter:300,400,500,600,700,800|lexend:300,400,500,600,700');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        /* Superior font stacks with system fonts */
        .header-font { 
            font-family: 'Lexend', 'SF Pro Display', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important; 
        }
        
        .body-font { 
            font-family: 'Inter', 'SF Pro Text', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important; 
        }
        
        body { 
            font-family: 'Inter', 'SF Pro Text', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important; 
            background: #f8fafc;
            color: #1e293b; 
            line-height: 1.7; 
            padding: 0;
            margin: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        .email-container { 
            max-width: 700px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 0;
            overflow: hidden;
            box-shadow: 0 40px 80px rgba(0,0,0,0.12);
            border: none;
        }
        
        /* WOW HEADER DESIGN */
        .header { 
            background: linear-gradient(135deg, ${themeColor} 0%, ${themeColor}e6 50%, ${themeColor}cc 100%); 
            position: relative;
            overflow: hidden;
            min-height: 280px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: 
                radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 50%);
        }
        
        .header::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%),
                repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px);
        }
        
        .header-content {
            position: relative;
            z-index: 10;
            text-align: center;
            width: 100%;
            padding: 50px 40px;
        }
        
        .logo { 
            max-width: 180px; 
            max-height: 90px; 
            margin: 0 auto 35px; 
            object-fit: contain; 
            filter: brightness(1.1) contrast(1.1) drop-shadow(0 8px 16px rgba(0,0,0,0.15));
            position: relative;
            z-index: 2;
        }
        
        .logo-fallback { 
            width: 180px; 
            height: 90px; 
            background: rgba(255,255,255,0.15); 
            margin: 0 auto 35px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            border-radius: 16px;
            border: 2px solid rgba(255,255,255,0.25);
            backdrop-filter: blur(10px);
            position: relative;
            z-index: 2;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        
        .logo-fallback-text {
            font-family: 'Lexend', 'SF Pro Display', system-ui, sans-serif !important;
            font-size: 28px; 
            font-weight: 700; 
            color: white; 
            letter-spacing: 3px;
            text-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        .practice-name { 
            font-family: 'Lexend', 'SF Pro Display', 'Segoe UI Variable', system-ui, sans-serif !important;
            color: white; 
            font-size: 42px; 
            font-weight: 700; 
            margin-bottom: 16px; 
            text-shadow: 0 4px 20px rgba(0,0,0,0.25);
            position: relative;
            z-index: 2;
            letter-spacing: -0.5px;
            line-height: 1.1;
        }
        
        .practice-tagline { 
            font-family: 'Inter', 'SF Pro Text', 'Segoe UI Variable', system-ui, sans-serif !important;
            color: rgba(255,255,255,0.95); 
            font-size: 18px; 
            font-weight: 400;
            letter-spacing: 0.5px;
            position: relative;
            z-index: 2;
            line-height: 1.4;
        }
        
        .content { 
            padding: 50px 40px; 
            background: white;
        }
        
        .greeting { 
            font-family: 'Lexend', 'SF Pro Display', 'Segoe UI Variable', system-ui, sans-serif !important;
            font-size: 26px; 
            font-weight: 600; 
            color: #1e293b; 
            margin-bottom: 35px; 
            letter-spacing: -0.2px;
        }
        
        .message-body { 
            font-family: 'Inter', 'SF Pro Text', 'Segoe UI Variable', system-ui, sans-serif !important;
            font-size: 18px; 
            line-height: 1.7; 
            color: #374151; 
            margin-bottom: 50px; 
            white-space: pre-wrap; 
            font-weight: 400;
            letter-spacing: -0.1px;
        }
        
        /* PREMIUM WOW SIGNATURE */
        .signature {
            margin: 50px 0;
            border-radius: 0;
            overflow: hidden;
            background: #ffffff;
            border: none;
            box-shadow: 0 20px 40px rgba(0,0,0,0.08);
        }
        
        .signature-table {
            width: 100%;
            border-collapse: collapse;
            background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
        }
        
        .signature-header {
            background: linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%);
            padding: 25px 40px;
            text-align: center;
        }
        
        .signature-header-text {
            font-family: 'Lexend', 'SF Pro Display', system-ui, sans-serif !important;
            font-size: 16px;
            font-weight: 600;
            color: white;
            margin: 0;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        
        .signature-main {
            padding: 40px;
        }
        
        .signature-profile {
            display: flex;
            align-items: center;
            gap: 30px;
            margin-bottom: 35px;
        }
        
        .signature-logo-container {
            flex-shrink: 0;
        }
        
        .signature-logo {
            width: 100px;
            height: 60px;
            object-fit: contain;
            filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1));
        }
        
        .signature-logo-fallback {
            width: 100px;
            height: 60px;
            background: linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .signature-logo-fallback-text {
            font-family: 'Lexend', 'SF Pro Display', system-ui, sans-serif !important;
            font-size: 16px;
            font-weight: 700;
            color: white;
            letter-spacing: 1px;
        }
        
        .signature-info {
            flex: 1;
        }
        
        .signature-name {
            font-family: 'Lexend', 'SF Pro Display', system-ui, sans-serif !important;
            font-size: 28px;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 8px 0;
            letter-spacing: -0.3px;
        }
        
        .signature-role {
            font-family: 'Inter', 'SF Pro Text', system-ui, sans-serif !important;
            font-size: 16px;
            font-weight: 500;
            color: #4a5568;
            margin: 0 0 6px 0;
        }
        
        .signature-practice {
            font-family: 'Lexend', 'SF Pro Display', system-ui, sans-serif !important;
            font-size: 18px;
            font-weight: 600;
            color: ${themeColor};
            margin: 0;
        }
        
        .signature-contact {
            border-top: 2px solid #f1f5f9;
            padding-top: 30px;
            display: flex;
            flex-wrap: wrap;
            gap: 25px;
        }
        
        .signature-contact-item {
            display: flex;
            align-items: center;
            gap: 10px;
            background: #f8fafc;
            padding: 12px 18px;
            border-radius: 8px;
            border-left: 3px solid ${themeColor};
        }
        
        .signature-icon {
            width: 16px;
            height: 16px;
            color: ${themeColor};
        }
        
        .signature-contact-text {
            font-family: 'Inter', 'SF Pro Text', system-ui, sans-serif !important;
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            margin: 0;
        }
        
        .footer { 
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
            color: white; 
            padding: 50px 40px; 
            text-align: center; 
            position: relative;
        }
        
        .footer-logo {
            width: 60px;
            height: 60px;
            margin: 0 auto 25px;
            opacity: 0.9;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.2);
        }
        
        .footer-logo-fallback {
            width: 60px;
            height: 60px;
            background: ${themeColor}44;
            margin: 0 auto 25px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Poppins', 'Trebuchet MS', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
            font-size: 18px;
            font-weight: 700;
            color: white;
            border: 2px solid rgba(255,255,255,0.2);
        }
        
        .practice-info { 
            margin-bottom: 35px; 
        }
        
        .practice-info .practice-name-footer { 
            font-family: 'Poppins', 'Trebuchet MS', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
            font-size: 20px; 
            font-weight: 600; 
            margin-bottom: 20px; 
            color: ${themeColor};
        }
        
        .practice-info .address {
            font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
            font-size: 15px;
            color: #cbd5e1;
            line-height: 1.6;
        }
        
        .contact-info { 
            display: flex; 
            justify-content: center; 
            gap: 30px; 
            margin-bottom: 35px; 
            flex-wrap: wrap; 
        }
        
        .contact-item { 
            font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
            font-size: 14px; 
            background: rgba(255,255,255,0.1);
            padding: 12px 20px;
            border-radius: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            transition: all 0.3s ease;
        }
        
        .contact-item:hover {
            background: rgba(255,255,255,0.2);
            transform: translateY(-2px);
        }
        
        .disclaimer { 
            font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
            font-size: 12px; 
            color: #94a3b8; 
            border-top: 1px solid #374151; 
            padding-top: 30px; 
            line-height: 1.6; 
        }
        
        .disclaimer p { 
            margin: 8px 0; 
        }
        
        .disclaimer .copyright {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #2d3748;
            color: #64748b;
            font-size: 11px;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container { 
                margin: 10px; 
                border-radius: 0;
            }
            .header-content { padding: 40px 25px; }
            .content, .footer { padding: 30px 25px; }
            .practice-name { font-size: 34px; }
            .greeting { font-size: 22px; }
            .message-body { font-size: 17px; }
            .logo { max-width: 140px; max-height: 70px; }
            .logo-fallback { width: 140px; height: 70px; }
            .logo-fallback-text { font-size: 20px; }
            
            .signature-main { padding: 25px 20px; }
            .signature-profile { 
                flex-direction: column; 
                text-align: center; 
                gap: 20px;
                margin-bottom: 25px;
            }
            .signature-logo { width: 80px; height: 50px; }
            .signature-logo-fallback { width: 80px; height: 50px; }
            .signature-logo-fallback-text { font-size: 14px; }
            .signature-name { font-size: 24px; }
            .signature-contact { 
                flex-direction: column; 
                gap: 15px; 
                align-items: center; 
            }
            .signature-contact-item {
                width: fit-content;
                min-width: 200px;
                justify-content: center;
            }
            .contact-info { 
                flex-direction: column; 
                gap: 15px; 
                align-items: center; 
            }
            .contact-item {
                width: fit-content;
            }
        }
        
        /* Additional font fallbacks for better email client support */
        .poppins-font {
            font-family: 'Poppins', 'Trebuchet MS', 'Lucida Grande', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
        }
        
        .montserrat-font {
            font-family: 'Montserrat', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- WOW Header Design -->
        <div class="header">
            <div class="header-content">
                ${practiceInfo.logo ? 
                    `<img src="${practiceInfo.logo}" alt="${practiceInfo.name} Logo" class="logo" />` :
                    `<div class="logo-fallback">
                        <div class="logo-fallback-text">${practiceInfo.name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase()}</div>
                    </div>`
                }
                <div class="practice-name">${practiceInfo.name}</div>
                <div class="practice-tagline">Excellence in Healthcare • Compassionate Care</div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="content">
            <div class="greeting">Dear ${recipientName},</div>
            
            <div class="message-body">${message}</div>

            <!-- PREMIUM WOW SIGNATURE -->
            <div class="signature">
                <table class="signature-table" cellpadding="0" cellspacing="0">
                    <tr>
                        <td class="signature-header">
                            <div class="signature-header-text">Your Healthcare Professional</div>
                        </td>
                    </tr>
                    <tr>
                        <td class="signature-main">
                            <div class="signature-profile">
                                <div class="signature-logo-container">
                                    ${practiceInfo.logo ? 
                                        `<img src="${practiceInfo.logo}" alt="${practiceInfo.name} Logo" class="signature-logo" />` :
                                        `<div class="signature-logo-fallback">
                                            <div class="signature-logo-fallback-text">${practiceInfo.name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase()}</div>
                                        </div>`
                                    }
                                </div>
                                <div class="signature-info">
                                    <div class="signature-name">${doctorName}</div>
                                    <div class="signature-role">${doctorRole}</div>
                                    <div class="signature-practice">${practiceInfo.name}</div>
                                </div>
                            </div>
                            
                            <div class="signature-contact">
                                ${practiceInfo.phone ? `
                                <div class="signature-contact-item">
                                    <span class="signature-icon">📞</span>
                                    <div class="signature-contact-text">${practiceInfo.phone}</div>
                                </div>` : ''}
                                ${practiceInfo.email ? `
                                <div class="signature-contact-item">
                                    <span class="signature-icon">✉️</span>
                                    <div class="signature-contact-text">${practiceInfo.email}</div>
                                </div>` : ''}
                                ${practiceInfo.website ? `
                                <div class="signature-contact-item">
                                    <span class="signature-icon">🌐</span>
                                    <div class="signature-contact-text">${practiceInfo.website}</div>
                                </div>` : ''}
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Enhanced Footer -->
        <div class="footer">
            ${practiceInfo.logo ? 
                `<img src="${practiceInfo.logo}" alt="${practiceInfo.name} Logo" class="footer-logo" />` :
                `<div class="footer-logo-fallback">
                    ${practiceInfo.name.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase()}
                </div>`
            }
            
            <div class="practice-info">
                <div class="practice-name-footer">${practiceInfo.name}</div>
                ${practiceInfo.address ? `<div class="address">${practiceInfo.address}</div>` : ''}
            </div>

            <div class="contact-info">
                ${practiceInfo.phone ? `<div class="contact-item">📞 ${practiceInfo.phone}</div>` : ''}
                ${practiceInfo.email ? `<div class="contact-item">✉️ ${practiceInfo.email}</div>` : ''}
                ${practiceInfo.website ? `<div class="contact-item">🌐 ${practiceInfo.website}</div>` : ''}
            </div>

            <div class="disclaimer">
                <p><strong>Medical Disclaimer:</strong> This email contains confidential medical information intended only for the named recipient.</p>
                <p><strong>Privacy Notice:</strong> Your privacy is important to us. This communication is governed by our Privacy Policy.</p>
                <p><strong>Emergency Notice:</strong> This email is not monitored 24/7. For urgent medical matters, please call our emergency line immediately.</p>
                <div class="copyright">© ${new Date().getFullYear()} ${practiceInfo.name}. All rights reserved. | Powered by OneHealth Practice Management System</div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Send a practice email with premium template
   */
  async sendPracticeEmail(data: PracticeEmailData): Promise<EmailResponse> {
    const htmlContent = this.generatePracticeEmailHTML(data);
    
    return this.sendEmail({
      to: data.recipientEmail,
      subject: data.subject,
      html: htmlContent,
      text: data.message // Fallback plain text
    });
  }
}

// Create singleton instance
const emailEdgeService = new EmailEdgeService();

export { emailEdgeService };
export type { EmailData, EmailResponse, PracticeEmailData };