/**
 * Edge Function Service
 * 
 * This service provides a wrapper for calling Supabase edge functions using direct fetch
 * instead of the Supabase client's .functions.invoke() method, which has issues.
 */

interface EdgeFunctionResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    details?: unknown;
  };
}

class EdgeFunctionService {
  private supabaseUrl: string;
  
  constructor() {
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!this.supabaseUrl) {
      throw new Error('Missing VITE_SUPABASE_URL environment variable');
    }
  }

  /**
   * Get the auth token from localStorage
   */
  private getAuthToken(): string | null {
    const authData = localStorage.getItem('hpms-auth');
    if (!authData) return null;
    
    try {
      const { access_token } = JSON.parse(authData);
      return access_token;
    } catch (error) {
      console.error('Failed to parse auth data:', error);
      return null;
    }
  }

  /**
   * Invoke an edge function
   */
  async invoke<T = unknown>(
    functionName: string, 
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<EdgeFunctionResponse<T>> {
    try {
      const token = this.getAuthToken();
      if (!token) {
        return {
          error: {
            message: 'No authentication token found. Please login.',
          }
        };
      }

      const url = `${this.supabaseUrl}/functions/v1/${functionName}`;
      
      // Only log non-SMS calls to reduce noise
      if (functionName !== 'centralized-sms-gateway') {
        console.log(`🚀 Calling edge function: ${functionName}`);
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options?.headers
        },
        body: options?.body ? JSON.stringify(options.body) : undefined
      });

      const data = await response.json();

      if (!response.ok) {
        // Only log errors for non-SMS functions or if SMS actually failed
        if (functionName !== 'centralized-sms-gateway' || !data.success) {
          console.error(`❌ Edge function error:`, data);
        }
        return {
          error: {
            message: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
            details: data
          }
        };
      }

      // Only log success for non-SMS calls
      if (functionName !== 'centralized-sms-gateway') {
        console.log(`✅ Edge function success:`, functionName);
      }
      return { data };

    } catch (error) {
      console.error(`❌ Edge function exception:`, error);
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to call edge function',
          details: error
        }
      };
    }
  }

  /**
   * Send an email via the email gateway
   */
  async sendEmail(params: {
    practiceId: string;
    recipientEmail: string;
    recipientName?: string;
    subject: string;
    textContent: string;
    htmlContent?: string;
    emailType?: string;
    patientId?: string;
    appointmentId?: string;
    visitId?: string;
    invoiceId?: string;
  }) {
    return this.invoke('email-gateway-v2', { body: params });
  }

  /**
   * Send an SMS via the SMS gateway
   */
  async sendSMS(params: {
    practiceId: string;
    recipientPhone: string;
    messageContent: string;
    messageType?: string;
    patientId?: string;
    appointmentId?: string;
    visitId?: string;
  }) {
    return this.invoke('centralized-sms-gateway', { body: params });
  }

  // Removed processAutomations - n8n handles automation processing now
}

// Export singleton instance
export const edgeFunctionService = new EdgeFunctionService();