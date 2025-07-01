/**
 * @deprecated This service is deprecated. Use communicationService instead.
 * 
 * DEPRECATED: DO NOT USE THIS SERVICE
 * This simple email service has been replaced by the centralized communication gateway.
 * All email sending should now go through:
 * - communicationService.sendEmail() for application code
 * - centralized-email-gateway edge function for direct calls
 * 
 * This file is kept only for reference and will be removed in a future release.
 * 
 * Migration guide:
 * Old: sendSimpleEmail({ to, subject, html, text })
 * New: communicationService.sendEmail({ practiceId, recipientEmail, subject, htmlContent, emailType, ... })
 */

import { supabase } from '../lib/supabase';

interface SimpleEmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendSimpleEmail(emailData: SimpleEmailData) {
  try {
    console.log('Sending email to:', emailData.to);
    
    const { data, error } = await supabase.functions.invoke('send-individual-email', {
      body: emailData
    });

    if (error) {
      console.error('Email error:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// Example usage:
// await sendSimpleEmail({
//   to: 'patient@example.com',
//   subject: 'Appointment Reminder',
//   html: '<h1>Your appointment is tomorrow</h1><p>Don't forget!</p>',
//   text: 'Your appointment is tomorrow. Don\'t forget!'
// });