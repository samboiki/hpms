import { supabase } from '../lib/supabase';

interface AutomationSetting {
  enabled: boolean;
  timing?: string[];
  sequence?: string[];
  method?: string | string[];
  template?: string;
  includeOffer?: boolean;
}

// Map Communications page automation keys to n8n automation IDs
const automationIdMap: Record<string, string> = {
  'welcomeNewPatients': 'welcome-new-patient',
  'appointmentReminders': 'appointment-reminder',
  'birthdayMessages': 'birthday-wishes',
  'followUpCare': 'post-visit-follow-up',
  'paymentReminders': 'payment-reminder',
  'invoiceDelivery': 'invoice-sent',
  'thankYouMessages': 'visit-thank-you',
  'healthScreenings': 'health-screening-reminder'
};

export async function saveAutomationSettings(
  practiceId: string,
  key: string,
  setting: AutomationSetting
) {
  try {
    const automationId = automationIdMap[key] || key;
    
    // Convert method to array format for database
    const methods = Array.isArray(setting.method) ? setting.method : [setting.method];
    const smsEnabled = methods.includes('sms');
    const emailEnabled = methods.includes('email');
    
    // Parse template to extract subject and body for email
    let emailSubject = '';
    let emailBody = setting.template || '';
    
    // For email templates, extract subject from first line if it looks like a subject
    if (emailEnabled && setting.template) {
      const lines = setting.template.split('\n');
      if (lines[0] && !lines[0].includes('{{')) {
        // If first line doesn't contain variables, treat it as subject
        const subjectMatch = lines[0].match(/Subject:\s*(.+)|(.+)/);
        if (subjectMatch) {
          emailSubject = subjectMatch[1] || subjectMatch[2] || '';
          emailBody = lines.slice(1).join('\n').trim();
        }
      }
    }
    
    // Check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('practice_automation_settings')
      .select('id')
      .eq('practice_id', practiceId)
      .eq('automation_id', automationId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw checkError;
    }
    
    const settingsData = {
      practice_id: practiceId,
      automation_id: automationId,
      enabled: setting.enabled,
      sms_enabled: smsEnabled,
      email_enabled: emailEnabled,
      sms_template: smsEnabled ? setting.template : null,
      email_subject: emailEnabled ? (emailSubject || `${key.replace(/([A-Z])/g, ' $1').trim()} - {{practiceName}}`) : null,
      email_body: emailEnabled ? (emailBody || setting.template) : null,
      timing_settings: {
        timing: setting.timing || setting.sequence || [],
        includeOffer: setting.includeOffer
      },
      updated_at: new Date().toISOString()
    };
    
    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('practice_automation_settings')
        .update(settingsData)
        .eq('id', existing.id);
    } else {
      // Insert new record
      result = await supabase
        .from('practice_automation_settings')
        .insert(settingsData);
    }
    
    if (result.error) throw result.error;
    
    return { success: true };
  } catch (error) {
    console.error('Error saving automation settings:', error);
    return { success: false, error };
  }
}