// SMS Portal Integration Service
// Documentation: https://www.smsportal.com/api

interface SMSPortalConfig {
  clientId: string;
  apiSecret: string;
  baseUrl?: string;
}

interface SMSMessage {
  to: string;
  content: string;
  reference?: string;
}

interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
  remainingCredits?: number;
}

interface BulkSMSResponse {
  success: boolean;
  messages: Array<{
    to: string;
    messageId?: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
  totalCost?: number;
  remainingCredits?: number;
}

export class SMSPortalService {
  private config: SMSPortalConfig;
  private baseUrl: string;

  constructor(config: SMSPortalConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://rest.smsportal.com/v1';
  }

  /**
   * Send a single SMS message
   */
  async sendSMS(message: SMSMessage): Promise<SMSResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            to: this.formatPhoneNumber(message.to),
            content: message.content,
            reference: message.reference,
          }]
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `SMS Portal API Error: ${response.status} - ${error}`,
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        messageId: data.messages?.[0]?.messageId,
        cost: data.cost,
        remainingCredits: data.remainingCredits,
      };
    } catch (error) {
      console.error('SMS Portal Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(messages: SMSMessage[]): Promise<BulkSMSResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            to: this.formatPhoneNumber(msg.to),
            content: msg.content,
            reference: msg.reference,
          }))
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          messages: messages.map(msg => ({
            to: msg.to,
            status: 'failed',
            error: `API Error: ${response.status}`,
          })),
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        messages: data.messages.map((msg: any, index: number) => ({
          to: messages[index].to,
          messageId: msg.messageId,
          status: msg.status === 'sent' ? 'sent' : 'failed',
          error: msg.error,
        })),
        totalCost: data.cost,
        remainingCredits: data.remainingCredits,
      };
    } catch (error) {
      console.error('SMS Portal Bulk Error:', error);
      return {
        success: false,
        messages: messages.map(msg => ({
          to: msg.to,
          status: 'failed',
          error: 'Network error',
        })),
      };
    }
  }

  /**
   * Check SMS delivery status
   */
  async checkStatus(messageId: string): Promise<{
    status: 'pending' | 'sent' | 'delivered' | 'failed';
    deliveredAt?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/messages/${messageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        return { status: 'failed', error: 'Failed to check status' };
      }

      const data = await response.json();
      return {
        status: data.status,
        deliveredAt: data.deliveredAt,
        error: data.error,
      };
    } catch (error) {
      return { status: 'failed', error: 'Network error' };
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{
    success: boolean;
    credits?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to get balance' };
      }

      const data = await response.json();
      return {
        success: true,
        credits: data.credits,
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format phone number for SMS Portal
   * Ensures number is in international format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle Namibian numbers (assuming default country)
    if (cleaned.startsWith('0')) {
      cleaned = '264' + cleaned.substring(1);
    }
    
    // Add + if not present
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Generate auth token from client ID and API secret
   */
  private getAuthToken(): string {
    // SMS Portal uses Basic Auth with clientId:apiSecret
    const credentials = `${this.config.clientId}:${this.config.apiSecret}`;
    return Buffer.from(credentials).toString('base64');
  }

  /**
   * Validate SMS content
   */
  static validateSMSContent(content: string): {
    valid: boolean;
    error?: string;
    characterCount: number;
    messageCount: number;
  } {
    const length = content.length;
    
    if (length === 0) {
      return {
        valid: false,
        error: 'Message content cannot be empty',
        characterCount: 0,
        messageCount: 0,
      };
    }
    
    if (length > 918) { // 6 SMS messages max
      return {
        valid: false,
        error: 'Message too long (max 918 characters)',
        characterCount: length,
        messageCount: Math.ceil(length / 153),
      };
    }
    
    // Calculate SMS count
    const messageCount = length <= 160 ? 1 : Math.ceil(length / 153);
    
    return {
      valid: true,
      characterCount: length,
      messageCount,
    };
  }

  /**
   * Replace template variables in message content
   */
  static replaceTemplateVariables(
    template: string, 
    variables: Record<string, string>
  ): string {
    let content = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(regex, value);
    }
    
    return content;
  }
}

// Factory function to create SMS service from practice settings
export function createSMSService(practiceSettings: any): SMSPortalService | null {
  const smsSettings = practiceSettings?.notification_settings?.sms;
  
  if (!smsSettings?.enabled || !smsSettings?.credentials) {
    return null;
  }
  
  const { clientId, apiSecret } = smsSettings.credentials;
  
  if (!clientId || !apiSecret) {
    console.error('SMS Portal credentials not configured');
    return null;
  }
  
  return new SMSPortalService({
    clientId,
    apiSecret,
  });
}

// Default instance with provided credentials (for testing)
export const defaultSMSService = new SMSPortalService({
  clientId: '7c193f5e-c862-43be-baa9-73e45e676e74',
  apiSecret: 'db3defe7-b01e-4983-b28d-88f228c16301',
});