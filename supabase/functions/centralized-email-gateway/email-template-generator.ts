export interface EmailTemplateData {
  subject: string;
  content: string;
  recipientName?: string;
  practiceName: string;
  practicePhone?: string;
  practiceEmail?: string;
  practiceWebsite?: string;
  practiceAddress?: string;
  practiceLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function generateEmailHTML(data: EmailTemplateData): string {
  const {
    content,
    recipientName,
    practiceName,
    practicePhone,
    practiceEmail,
    practiceWebsite,
    practiceAddress,
    practiceLogo,
    primaryColor = '#4f46e5',
    secondaryColor = '#6366f1'
  } = data;

  // Convert line breaks to HTML paragraphs with proper spacing
  // Also handle bullet points and bold labels
  const htmlContent = content
    .split('\n\n')
    .map(paragraph => {
      // Check if paragraph contains bullet points
      if (paragraph.includes('•')) {
        const lines = paragraph.split('\n');
        const items = lines.map(line => {
          if (line.trim().startsWith('•')) {
            // Handle bold labels (e.g., "Time: value" becomes "<b>Time:</b> value")
            const bulletContent = line.substring(1).trim();
            const formattedContent = bulletContent.replace(/^(\w+):\s*(.+)$/, '<strong>$1:</strong> $2');
            return `<li style="margin-bottom: 8px;">${formattedContent}</li>`;
          }
          return line;
        }).filter(line => line.includes('<li>'));
        
        return `<ul style="margin: 0 0 16px 0; padding-left: 20px;">${items.join('')}</ul>`;
      }
      
      // Handle bold labels in regular paragraphs too
      const formattedParagraph = paragraph.replace(/^(\w+):\s*(.+)$/gm, '<strong>$1:</strong> $2');
      return `<p style="margin: 0 0 16px 0;">${formattedParagraph.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.subject}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        /* Reset styles */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        
        /* Remove default styling */
        body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; }
        
        /* Font styles */
        @media screen {
            body, table, td, p, a, li, blockquote {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
        }
        
        /* Mobile styles */
        @media screen and (max-width: 600px) {
            .mobile-hidden { display: none !important; }
            .mobile-center { text-align: center !important; }
            .container { width: 100% !important; max-width: 100% !important; }
            .mobile-padding { padding: 20px !important; }
            .logo { max-width: 150px !important; max-height: 50px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="700" class="container" style="max-width: 700px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td style="padding: 24px 24px 20px 24px; border-bottom: 1px dashed #e5e7eb;">
                            ${practiceLogo ? `
                            <img src="${practiceLogo}" alt="${practiceName}" class="logo" style="max-height: 60px; max-width: 200px; height: auto; display: block; margin: 0; padding: 0;">
                            ` : `
                            <h1 style="margin: 0; font-family: -apple-system, system-ui, BlinkMacSystemFont; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.2;">
                                ${practiceName}
                            </h1>
                            `}
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px 24px;" class="mobile-padding">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="font-family: -apple-system, system-ui, BlinkMacSystemFont; font-size: 14px; line-height: 1.625; color: #525252;">
                                        <div style="margin: 0.4em 0 1.1875em;">
                                            ${htmlContent}
                                        </div>
                                        ${practiceWebsite ? `
                                        <div style="text-align: right; margin-top: 24px;">
                                            <a href="${practiceWebsite}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">
                                                Visit us →
                                            </a>
                                        </div>
                                        ` : ''}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    
                    <!-- Compact Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px;" class="mobile-padding">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <!-- Logo -->
                                        ${practiceLogo ? `
                                        <img src="${practiceLogo}" alt="${practiceName}" style="max-height: 40px; max-width: 120px; height: auto; display: block; margin: 0 auto 12px;">
                                        ` : ''}
                                        
                                        <!-- Practice Info Compact -->
                                        <p style="margin: 0 0 8px 0; font-family: -apple-system, system-ui, BlinkMacSystemFont; font-size: 13px; line-height: 18px; color: #4b5563;">
                                            <strong>${practiceName}</strong>${practiceAddress ? ` • ${practiceAddress}` : ''}
                                        </p>
                                        
                                        <!-- Contact Info Single Line -->
                                        <p style="margin: 0 0 12px 0; font-family: -apple-system, system-ui, BlinkMacSystemFont; font-size: 12px; line-height: 18px; color: #6b7280;">
                                            ${practicePhone ? `Tel: <a href="tel:${practicePhone.replace(/\s/g, '')}" style="color: #6b7280; text-decoration: none;">${practicePhone}</a>` : ''}
                                            ${practicePhone && practiceEmail ? ' • ' : ''}
                                            ${practiceEmail ? `Email: <a href="mailto:${practiceEmail}" style="color: #6b7280; text-decoration: none;">${practiceEmail}</a>` : ''}
                                        </p>
                                        
                                        <!-- Social Media Icons -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                            <tr>
                                                <td style="padding: 0 6px;">
                                                    <a href="#" style="text-decoration: none;">
                                                        <img src="https://img.icons8.com/ios-glyphs/30/9ca3af/facebook-new.png" alt="Facebook" style="width: 20px; height: 20px; opacity: 0.6;">
                                                    </a>
                                                </td>
                                                <td style="padding: 0 6px;">
                                                    <a href="#" style="text-decoration: none;">
                                                        <img src="https://img.icons8.com/ios-glyphs/30/9ca3af/instagram-new.png" alt="Instagram" style="width: 20px; height: 20px; opacity: 0.6;">
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Legal text -->
                                        <p style="margin: 16px 0 0 0; font-family: -apple-system, system-ui, BlinkMacSystemFont; font-size: 10px; color: #9ca3af; text-align: center; line-height: 14px;">
                                            © ${new Date().getFullYear()} ${practiceName}. All rights reserved. Powered by OneHealth.<br>
                                            You are receiving this email because you are a patient at ${practiceName}. To update preferences, contact our office.<br>
                                            This email contains confidential information. If received in error, please delete immediately.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `.trim();
}

// Function to generate a simple text version from HTML content
export function generateEmailText(data: EmailTemplateData): string {
  const {
    content,
    recipientName,
    practiceName,
    practicePhone,
    practiceEmail,
    practiceWebsite,
    practiceAddress
  } = data;

  let text = '';
  
  if (recipientName) {
    text += `Dear ${recipientName},\n\n`;
  }
  
  text += content + '\n\n';
  
  text += '---\n';
  text += `${practiceName}\n`;
  
  if (practicePhone) {
    text += `Phone: ${practicePhone}\n`;
  }
  
  if (practiceEmail) {
    text += `Email: ${practiceEmail}\n`;
  }
  
  if (practiceWebsite) {
    text += `Website: ${practiceWebsite}\n`;
  }
  
  if (practiceAddress) {
    text += `\n${practiceAddress}\n`;
  }
  
  text += `\n© ${new Date().getFullYear()} ${practiceName}. All rights reserved.`;
  
  return text;
}