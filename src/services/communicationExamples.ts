import { communicationService } from './communicationService';

/**
 * Example implementations for common communication scenarios
 * All SMS and Email MUST go through these centralized methods
 */

// ==================== SMS EXAMPLES ====================

/**
 * Send appointment reminder SMS
 */
export async function sendAppointmentReminderSMS(
  practiceId: string,
  patientPhone: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  doctorName: string,
  patientId?: string,
  appointmentId?: string
) {
  const message = `Hi ${patientName}, this is a reminder for your appointment with Dr. ${doctorName} on ${appointmentDate} at ${appointmentTime}. If you need to change or cancel it, please call the practice.`;
  
  return await communicationService.sendSMS({
    practiceId,
    recipientPhone: patientPhone,
    messageContent: message,
    messageType: 'appointment_reminder',
    patientId,
    appointmentId,
    metadata: {
      appointmentDate,
      appointmentTime,
      doctorName
    },
    tags: ['reminder', 'appointment']
  });
}

/**
 * Send follow-up SMS after visit
 */
export async function sendFollowUpSMS(
  practiceId: string,
  patientPhone: string,
  patientName: string,
  visitDate: string,
  nextAppointmentDate?: string,
  patientId?: string,
  visitId?: string
) {
  let message = `Hi ${patientName}, thank you for visiting us on ${visitDate}. We hope you're feeling better.`;
  
  if (nextAppointmentDate) {
    message += ` Your next appointment is scheduled for ${nextAppointmentDate}.`;
  }
  
  message += ` If you have any concerns, please call us.`;
  
  return await communicationService.sendSMS({
    practiceId,
    recipientPhone: patientPhone,
    messageContent: message,
    messageType: 'follow_up',
    patientId,
    visitId,
    metadata: {
      visitDate,
      nextAppointmentDate
    },
    tags: ['follow-up', 'post-visit']
  });
}

/**
 * Send custom SMS
 */
export async function sendCustomSMS(
  practiceId: string,
  patientPhone: string,
  message: string,
  patientId?: string,
  metadata?: Record<string, any>
) {
  return await communicationService.sendSMS({
    practiceId,
    recipientPhone: patientPhone,
    messageContent: message,
    messageType: 'custom',
    patientId,
    metadata,
    tags: ['custom']
  });
}

// ==================== EMAIL EXAMPLES ====================

/**
 * Send appointment confirmation email
 */
export async function sendAppointmentConfirmationEmail(
  practiceId: string,
  patientEmail: string,
  patientName: string,
  appointmentDetails: {
    date: string;
    time: string;
    doctorName: string;
    practiceAddress: string;
    practicePhone: string;
  },
  patientId?: string,
  appointmentId?: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #06B6D4; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .appointment-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Confirmation</h1>
        </div>
        <div class="content">
          <p>Dear ${patientName},</p>
          <p>Your appointment has been confirmed with the following details:</p>
          
          <div class="appointment-details">
            <p><strong>Date:</strong> ${appointmentDetails.date}</p>
            <p><strong>Time:</strong> ${appointmentDetails.time}</p>
            <p><strong>Doctor:</strong> Dr. ${appointmentDetails.doctorName}</p>
            <p><strong>Location:</strong> ${appointmentDetails.practiceAddress}</p>
            <p><strong>Contact:</strong> ${appointmentDetails.practicePhone}</p>
          </div>
          
          <p>Please arrive 10 minutes early to complete any necessary paperwork.</p>
          <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
          
          <p>Best regards,<br>Healthcare Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
Appointment Confirmation

Dear ${patientName},

Your appointment has been confirmed with the following details:

Date: ${appointmentDetails.date}
Time: ${appointmentDetails.time}
Doctor: Dr. ${appointmentDetails.doctorName}
Location: ${appointmentDetails.practiceAddress}
Contact: ${appointmentDetails.practicePhone}

Please arrive 10 minutes early to complete any necessary paperwork.
If you need to reschedule or cancel, please contact us at least 24 hours in advance.

Best regards,
Healthcare Team
  `;
  
  return await communicationService.sendEmail({
    practiceId,
    recipientEmail: patientEmail,
    recipientName: patientName,
    subject: 'Appointment Confirmation',
    htmlContent,
    textContent,
    emailType: 'appointment_confirmation',
    patientId,
    appointmentId,
    metadata: appointmentDetails,
    tags: ['appointment', 'confirmation']
  });
}

/**
 * Send invoice email with PDF attachment
 */
export async function sendInvoiceEmail(
  practiceId: string,
  patientEmail: string,
  patientName: string,
  invoiceNumber: string,
  invoiceAmount: string,
  invoicePDFBase64: string,
  patientId?: string,
  invoiceId?: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #06B6D4; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .invoice-summary { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #06B6D4; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice #${invoiceNumber}</h1>
        </div>
        <div class="content">
          <p>Dear ${patientName},</p>
          <p>Please find attached your invoice for recent services.</p>
          
          <div class="invoice-summary">
            <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p><strong>Amount Due:</strong> <span class="amount">${invoiceAmount}</span></p>
          </div>
          
          <p>Payment is due within 30 days. You can pay:</p>
          <ul>
            <li>Online through our patient portal</li>
            <li>By phone using a credit card</li>
            <li>In person at our office</li>
          </ul>
          
          <p>If you have any questions about this invoice, please contact our billing department.</p>
          
          <p>Thank you for choosing our practice.</p>
          
          <p>Best regards,<br>Billing Department</p>
        </div>
        <div class="footer">
          <p>This invoice is for your records. A detailed breakdown is attached as a PDF.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await communicationService.sendEmail({
    practiceId,
    recipientEmail: patientEmail,
    recipientName: patientName,
    subject: `Invoice #${invoiceNumber}`,
    htmlContent,
    emailType: 'invoice',
    patientId,
    invoiceId,
    attachments: [{
      filename: `invoice_${invoiceNumber}.pdf`,
      content: invoicePDFBase64,
      type: 'application/pdf'
    }],
    metadata: {
      invoiceNumber,
      invoiceAmount
    },
    tags: ['invoice', 'billing']
  });
}

/**
 * Send lab results notification email
 */
export async function sendLabResultsEmail(
  practiceId: string,
  patientEmail: string,
  patientName: string,
  labTestName: string,
  resultsAvailable: boolean,
  patientId?: string,
  visitId?: string
) {
  const subject = resultsAvailable ? 
    `Your ${labTestName} Results Are Ready` : 
    `Lab Test ${labTestName} Scheduled`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .alert { background-color: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Lab Results Notification</h1>
        </div>
        <div class="content">
          <p>Dear ${patientName},</p>
          
          ${resultsAvailable ? `
            <p>Your <strong>${labTestName}</strong> results are now available.</p>
            <div class="alert">
              <p><strong>Important:</strong> Please log in to your patient portal to view your results, or contact our office to discuss them with your healthcare provider.</p>
            </div>
            <p>Your healthcare provider will review these results and contact you if any follow-up is needed.</p>
          ` : `
            <p>Your <strong>${labTestName}</strong> has been scheduled.</p>
            <p>Please follow any pre-test instructions provided by your healthcare provider.</p>
            <p>We will notify you as soon as your results are available.</p>
          `}
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>Lab Department</p>
        </div>
        <div class="footer">
          <p>This is an automated notification. Your privacy is important to us.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await communicationService.sendEmail({
    practiceId,
    recipientEmail: patientEmail,
    recipientName: patientName,
    subject,
    htmlContent,
    emailType: 'report',
    patientId,
    visitId,
    metadata: {
      labTestName,
      resultsAvailable
    },
    tags: ['lab-results', 'notification']
  });
}

/**
 * Send bulk marketing email (with unsubscribe)
 */
export async function sendMarketingEmail(
  practiceId: string,
  recipients: Array<{ email: string; name: string; patientId?: string }>,
  subject: string,
  htmlContent: string,
  campaignName: string
) {
  const results = await Promise.all(
    recipients.map(async (recipient) => {
      // Add unsubscribe footer to HTML content
      const htmlWithFooter = htmlContent + `
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #ddd; margin-top: 40px;">
          <p>You received this email because you are a patient at our practice.</p>
          <p>To unsubscribe from marketing emails, please contact our office.</p>
        </div>
      `;
      
      try {
        const result = await communicationService.sendEmail({
          practiceId,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          subject,
          htmlContent: htmlWithFooter,
          emailType: 'marketing',
          patientId: recipient.patientId,
          metadata: {
            campaignName,
            bulkSend: true
          },
          tags: ['marketing', campaignName.toLowerCase().replace(/\s+/g, '-')]
        });
        
        return { ...result, recipient };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          recipient 
        };
      }
    })
  );
  
  return {
    total: results.length,
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}