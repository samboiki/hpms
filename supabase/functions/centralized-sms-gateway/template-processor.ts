import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export class TemplateProcessor {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async processTemplate(templateId: string, variables: Record<string, string>): Promise<{ content: string } | null> {
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

      // Process variables in the template content
      let processedContent = template.content || '';
      
      // Replace all template variables with actual values
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        processedContent = processedContent.replace(regex, value || '');
      }
      
      // Remove any remaining unreplaced variables
      processedContent = processedContent.replace(/{{[^}]+}}/g, '');

      return {
        content: processedContent
      };
    } catch (error) {
      console.error('Template processing error:', error);
      return null;
    }
  }
}