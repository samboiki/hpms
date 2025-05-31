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
    // Updated to use v3 API
    this.baseUrl = config.baseUrl || 'https://rest.smsportal.com/v3';
  }

  /**
   * Get basic auth token for SMS Portal v3 API
   */
  private getBasicAuthToken(): string {
    const credentials = `${this.config.clientId}:${this.config.apiSecret}`;
    return btoa(credentials); // Browser-compatible base64 encoding
  }

  /**
   * Get authentication headers for SMS Portal v3 API
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      'accept': 'application/json',
      'content-type': 'application/json',
      'Authorization': `Basic ${this.getBasicAuthToken()}`, // v3 uses Basic Auth
    };
  }

  /**
   * Test the connection and credentials
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('Testing SMS Portal v3 connection...');
      console.log('Base URL:', this.baseUrl);
      console.log('Client ID:', this.config.clientId);
      
      const result = await this.getBalance();
      return {
        success: result.success,
        error: result.error,
        details: { credits: result.credits }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: { error }
      };
    }
  }

  /**
   * Send a single SMS message using SMS Portal v3 BulkMessages API
   */
  async sendSMS(message: SMSMessage): Promise<SMSResponse> {
    try {
      console.log('📱 Sending SMS via SMS Portal v3 API');
      console.log('To:', message.to);
      console.log('Content:', message.content);
      console.log('Reference:', message.reference);

      const payload = {
        sendOptions: {
          allowContentTrimming: true,
          senderId: 'HPMS', // Your sender ID - can be customized
          checkOptOuts: true,
          shortenUrls: false,
          testMode: false, // Set to false for real sending
          validityPeriod: 1440 // 24 hours in minutes
        },
        messages: [
          {
            content: message.content,
            destination: this.formatPhoneNumber(message.to),
            customerId: message.reference || `msg-${Date.now()}`
          }
        ]
      };

      console.log('📤 SMS Portal v3 payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.baseUrl}/BulkMessages`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ SMS Portal v3 API Error:', response.status, errorText);
        
        return {
          success: false,
          error: `SMS Portal v3 Error: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();
      console.log('✅ SMS Portal v3 response:', data);
      
      // Extract message ID from response
      const messageId = data.messages?.[0]?.messageId || data.messageId || `sent-${Date.now()}`;
      
      return {
        success: true,
        messageId,
        cost: data.cost || 0.5, // Default cost if not provided
        remainingCredits: data.remainingCredits || null,
      };
    } catch (error) {
      console.error('❌ SMS Portal Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Send bulk SMS messages using SMS Portal v3 BulkMessages API
   */
  async sendBulkSMS(messages: SMSMessage[]): Promise<BulkSMSResponse> {
    try {
      console.log(`📱 Sending ${messages.length} bulk SMS via SMS Portal v3 API`);

      const payload = {
        sendOptions: {
          allowContentTrimming: true,
          senderId: 'HPMS',
          checkOptOuts: true,
          shortenUrls: false,
          testMode: false,
          validityPeriod: 1440 // 24 hours
        },
        messages: messages.map(msg => ({
          content: msg.content,
          destination: this.formatPhoneNumber(msg.to),
          customerId: msg.reference || `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }))
      };

      const response = await fetch(`${this.baseUrl}/BulkMessages`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ SMS Portal v3 Bulk API Error:', response.status, errorText);
        
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
      console.log('✅ SMS Portal v3 bulk response:', data);
      
      return {
        success: true,
        messages: messages.map((msg, index) => ({
          to: msg.to,
          messageId: data.messages?.[index]?.messageId || `bulk-${Date.now()}-${index}`,
          status: 'sent',
          error: undefined,
        })),
        totalCost: data.cost || messages.length * 0.5,
        remainingCredits: data.remainingCredits,
      };
    } catch (error) {
      console.error('❌ SMS Portal Bulk Error:', error);
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
      const response = await fetch(`${this.baseUrl}/Messages/${messageId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
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
   * Get account balance using SMS Portal v3 API
   */
  async getBalance(): Promise<{
    success: boolean;
    credits?: number;
    error?: string;
  }> {
    try {
      console.log('💰 Checking SMS Portal v3 balance...');
      
      const response = await fetch(`${this.baseUrl}/Balance`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ SMS Portal v3 Balance API Error:', response.status, errorText);
        return { 
          success: false, 
          error: `Balance API Error: ${response.status} - ${errorText}` 
        };
      }

      const data = await response.json();
      console.log('✅ SMS Portal v3 balance response:', data);
      
      return {
        success: true,
        credits: data.credits || data.balance || 0,
      };
    } catch (error) {
      console.error('❌ Balance check error:', error);
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