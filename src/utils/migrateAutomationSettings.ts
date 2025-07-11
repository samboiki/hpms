import { supabase } from '../lib/supabase';

// Map old automation keys to new automation IDs
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

export async function migrateAutomationSettings(practiceId: string) {
  try {
    // Get existing settings in old format
    const { data: oldSettings, error } = await supabase
      .from('practice_automation_settings')
      .select('*')
      .eq('practice_id', practiceId)
      .single();
    
    if (error || !oldSettings?.settings) {
      console.log('No old settings to migrate');
      return { success: true, migrated: 0 };
    }
    
    const settings = oldSettings.settings;
    let migrated = 0;
    
    // Convert each automation setting
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'object' && value !== null && 'enabled' in value) {
        const automationId = automationIdMap[key] || key;
        const setting = value as {
          enabled: boolean;
          timing?: string[];
          sequence?: string[];
          method?: string | string[];
          template?: string;
          includeOffer?: boolean;
        };
        
        // Convert method to array format
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
            const subjectMatch = lines[0].match(/Subject:\s*(.+)|(.+)/);
            if (subjectMatch) {
              emailSubject = subjectMatch[1] || subjectMatch[2] || '';
              emailBody = lines.slice(1).join('\n').trim();
            }
          }
        }
        
        // Check if individual setting already exists
        const { data: existing } = await supabase
          .from('practice_automation_settings')
          .select('id')
          .eq('practice_id', practiceId)
          .eq('automation_id', automationId)
          .single();
        
        if (!existing) {
          // Insert new individual setting
          const { error: insertError } = await supabase
            .from('practice_automation_settings')
            .insert({
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
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (!insertError) {
            migrated++;
          }
        }
      }
    }
    
    return { success: true, migrated };
  } catch (error) {
    console.error('Error migrating automation settings:', error);
    return { success: false, error, migrated: 0 };
  }
}