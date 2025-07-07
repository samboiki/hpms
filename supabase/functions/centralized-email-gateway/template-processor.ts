import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export interface ProcessedTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export class TemplateProcessor {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async processTemplate(templateId: string, variables: Record<string, string>): Promise<ProcessedTemplate | null> {
    try {
      // Fetch the template from the database
      const { data: template, error } = await this.supabase
        .from('message_templates')
        .select('*')
        .eq('id', templateId)
        .eq('is_active', true)
        .single();

      if (error || !template) {
        console.error('Template fetch error:', error);
        return null;
      }

      // Process variables in all template fields
      let subject = template.subject || '';
      let htmlContent = template.html_content || template.body || '';
      let textContent = template.text_content || '';

      // Replace all template variables with actual values
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value || '');
        htmlContent = htmlContent.replace(regex, value || '');
        textContent = textContent.replace(regex, value || '');
      }
      
      // Remove any remaining unreplaced variables
      subject = subject.replace(/{{[^}]+}}/g, '');
      htmlContent = htmlContent.replace(/{{[^}]+}}/g, '');
      textContent = textContent.replace(/{{[^}]+}}/g, '');

      // If no text content, generate from HTML
      if (!textContent && htmlContent) {
        textContent = htmlContent
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      }

      return {
        subject,
        htmlContent,
        textContent
      };
    } catch (error) {
      console.error('Template processing error:', error);
      return null;
    }
  }
}