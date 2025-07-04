export interface TemplateVariable {
  key: string;
  value: string;
}

export interface ProcessedTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export class TemplateProcessor {
  static processTemplate(
    template: any,
    variables: TemplateVariable[]
  ): ProcessedTemplate {
    let subject = template.subject || '';
    let htmlContent = template.html_content || template.body || '';
    let textContent = template.text_content || '';

    // Replace variables in all fields
    variables.forEach(({ key, value }) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value || '');
      htmlContent = htmlContent.replace(regex, value || '');
      textContent = textContent.replace(regex, value || '');
    });

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
  }
}