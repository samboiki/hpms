import { supabase } from '../lib/supabase';

export interface EmailTemplate {
  id: string;
  practice_id: string | null;
  name: string;
  template_type: string;
  subject: string;
  content: string;
  header_html?: string;
  footer_html?: string;
  variables: string[];
  custom_styles?: string;
  font_config?: {
    body: string;
    headers: string;
  };
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SmsTemplate {
  id: string;
  practice_id: string | null;
  name: string;
  template_type: string;
  content: string;
  variables: string[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  key: string;
  value: string;
  description?: string;
}

class EmailTemplateService {
  /**
   * Get all email templates for a practice (including default system templates)
   */
  async getEmailTemplates(practiceId: string): Promise<EmailTemplate[]> {
    // Use RPC function to avoid RLS issues
    const { data, error } = await supabase
      .rpc('get_email_templates_for_practice', { p_practice_id: practiceId });

    if (error) {
      console.error('Error fetching email templates:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get all SMS templates for a practice (including default system templates)
   */
  async getSmsTemplates(practiceId: string): Promise<SmsTemplate[]> {
    // Use RPC function to avoid RLS issues
    const { data, error } = await supabase
      .rpc('get_sms_templates_for_practice', { p_practice_id: practiceId });

    if (error) {
      console.error('Error fetching SMS templates:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get email template by ID
   */
  async getEmailTemplate(templateId: string): Promise<EmailTemplate | null> {
    // Use RPC function to avoid RLS issues
    const { data, error } = await supabase
      .rpc('get_email_template_by_id', { p_template_id: templateId })
      .single();

    if (error) {
      console.error('Error fetching email template:', error);
      return null;
    }

    return data;
  }

  /**
   * Get SMS template by ID
   */
  async getSmsTemplate(templateId: string): Promise<SmsTemplate | null> {
    // Use RPC function to avoid RLS issues
    const { data, error } = await supabase
      .rpc('get_sms_template_by_id', { p_template_id: templateId })
      .single();

    if (error) {
      console.error('Error fetching SMS template:', error);
      return null;
    }

    return data;
  }

  /**
   * Create a new email template
   */
  async createEmailTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_templates')
      .insert(template)
      .select()
      .single();

    if (error) {
      console.error('Error creating email template:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update an email template
   */
  async updateEmailTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('Error updating email template:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete an email template
   */
  async deleteEmailTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('Error deleting email template:', error);
      throw error;
    }
  }

  /**
   * Get variable definitions for different template types
   */
  getTemplateVariables(templateType: string): TemplateVariable[] {
    const commonVariables: TemplateVariable[] = [
      { key: 'practiceName', description: 'Name of the practice' },
      { key: 'practicePhone', description: 'Practice phone number' },
      { key: 'practiceEmail', description: 'Practice email address' },
      { key: 'practiceAddress', description: 'Practice physical address' },
      { key: 'practiceLogo', description: 'URL to practice logo' },
    ];

    const typeSpecificVariables: Record<string, TemplateVariable[]> = {
      appointment_reminder: [
        { key: 'patientName', description: 'Patient full name' },
        { key: 'appointmentDate', description: 'Appointment date' },
        { key: 'appointmentTime', description: 'Appointment time' },
        { key: 'doctorName', description: 'Doctor/Provider name' },
        { key: 'branchName', description: 'Branch/Location name' },
        { key: 'branchAddress', description: 'Branch address' },
      ],
      invoice: [
        { key: 'patientName', description: 'Patient full name' },
        { key: 'invoiceNumber', description: 'Invoice number' },
        { key: 'invoiceDate', description: 'Invoice date' },
        { key: 'invoiceAmount', description: 'Total amount due' },
        { key: 'dueDate', description: 'Payment due date' },
        { key: 'billingPhone', description: 'Billing department phone' },
        { key: 'billingEmail', description: 'Billing department email' },
        { key: 'taxNumber', description: 'Practice tax number' },
      ],
      welcome: [
        { key: 'patientName', description: 'Patient full name' },
        { key: 'practiceHours', description: 'Practice operating hours' },
      ],
    };

    return [
      ...commonVariables,
      ...(typeSpecificVariables[templateType] || [])
    ];
  }

  /**
   * Preview email template with sample data
   */
  previewEmailTemplate(template: EmailTemplate, variables: TemplateVariable[]): string {
    let content = template.content;
    let header = template.header_html || '';
    let footer = template.footer_html || '';

    // Replace variables in all sections
    variables.forEach(({ key, value }) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(regex, value);
      header = header.replace(regex, value);
      footer = footer.replace(regex, value);
    });

    // Build preview HTML
    const fontConfig = template.font_config || { body: 'Montserrat', headers: 'Rubik' };
    
    return `
      <div style="font-family: '${fontConfig.body}', sans-serif;">
        <style>${template.custom_styles || ''}</style>
        ${header}
        ${content}
        ${footer}
      </div>
    `;
  }
}

export const emailTemplateService = new EmailTemplateService();