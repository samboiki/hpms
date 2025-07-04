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

  // Convert line breaks to HTML
  const htmlContent = content.replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.subject}</title>
    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
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
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Montserrat', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 40px 40px 30px 40px;" class="mobile-padding">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        ${practiceLogo ? `
                                        <img src="${practiceLogo}" alt="${practiceName}" style="max-height: 60px; max-width: 200px; height: auto; display: block; margin: 0 auto 20px;">
                                        ` : ''}
                                        <h1 style="margin: 0; font-family: 'Rubik', Arial, sans-serif; font-size: 32px; font-weight: 700; color: #ffffff; text-align: center; line-height: 1.2;">
                                            ${practiceName}
                                        </h1>
                                        ${practiceAddress ? `
                                        <p style="margin: 10px 0 0 0; font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; color: rgba(255, 255, 255, 0.9); text-align: center;">
                                            Excellence in Healthcare
                                        </p>
                                        ` : ''}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;" class="mobile-padding">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="font-family: 'Montserrat', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #333333;">
                                        ${recipientName ? `<p style="margin: 0 0 20px 0; font-size: 18px;">Dear ${recipientName},</p>` : ''}
                                        ${htmlContent}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Call to Action (if needed) -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;" class="mobile-padding">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        ${practicePhone ? `
                                        <a href="tel:${practicePhone.replace(/\s/g, '')}" style="display: inline-block; padding: 14px 30px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-family: 'Rubik', Arial, sans-serif; font-size: 16px; font-weight: 600; border-radius: 8px; transition: background-color 0.3s ease;">
                                            Call Us: ${practicePhone}
                                        </a>
                                        ` : ''}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 30px 40px;" class="mobile-padding">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 10px 0; font-family: 'Rubik', Arial, sans-serif; font-size: 18px; font-weight: 600; color: ${primaryColor};">
                                            ${practiceName}
                                        </p>
                                        ${practicePhone ? `
                                        <p style="margin: 0 0 5px 0; font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; color: #666666;">
                                            📞 ${practicePhone}
                                        </p>
                                        ` : ''}
                                        ${practiceEmail ? `
                                        <p style="margin: 0 0 5px 0; font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; color: #666666;">
                                            ✉️ <a href="mailto:${practiceEmail}" style="color: ${primaryColor}; text-decoration: none;">${practiceEmail}</a>
                                        </p>
                                        ` : ''}
                                        ${practiceWebsite ? `
                                        <p style="margin: 0 0 5px 0; font-family: 'Montserrat', Arial, sans-serif; font-size: 14px; color: #666666;">
                                            🌐 <a href="${practiceWebsite}" style="color: ${primaryColor}; text-decoration: none;">${practiceWebsite}</a>
                                        </p>
                                        ` : ''}
                                        ${practiceAddress ? `
                                        <p style="margin: 15px 0 0 0; font-family: 'Montserrat', Arial, sans-serif; font-size: 13px; color: #999999; line-height: 1.5;">
                                            ${practiceAddress}
                                        </p>
                                        ` : ''}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Legal Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f3f4f6;" class="mobile-padding">
                            <p style="margin: 0; font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; color: #999999; text-align: center; line-height: 1.5;">
                                This email was sent by ${practiceName}. If you have any questions or concerns, please contact us.
                                <br>
                                © ${new Date().getFullYear()} ${practiceName}. All rights reserved.
                            </p>
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