import { supabase } from '../lib/supabase';
import { notificationDeliveryService } from './notificationDeliveryService';
import { edgeFunctionService } from './edgeFunctionService';

// SMS Types
export type SMSMessageType = 
  | 'appointment_reminder' 
  | 'follow_up' 
  | 'marketing' 
  | 'system' 
  | 'custom';

export interface SendSMSRequest {
  practiceId: string;
  recipientPhone: string;
  senderPhone?: string;
  messageContent: string;
  messageType: SMSMessageType;
  patientId?: string;
  appointmentId?: string;
  visitId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  notificationId?: string; // Link to system notification for delivery tracking
}

export interface SendSMSResponse {
  success: boolean;
  logId: string;
  messageId?: string;
  status: string;
  remainingCredits?: number;
  error?: string;
  deliveryId?: string; // Delivery tracking ID
}

// Email Types
export type EmailType = 
  | 'appointment_confirmation' 
  | 'invoice' 
  | 'report' 
  | 'marketing' 
  | 'system' 
  | 'custom';

export interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  type?: string;
}

export interface TemplateVariable {
  key: string;
  value: string;
}

export interface SendEmailRequest {
  practiceId: string;
  recipientEmail: string;
  recipientName?: string;
  senderEmail?: string;
  senderName?: string;
  subject?: string; // Optional when using template
  htmlContent?: string; // Optional when using template
  textContent?: string; // Optional when using template
  emailType: EmailType;
  attachments?: EmailAttachment[];
  patientId?: string;
  appointmentId?: string;
  visitId?: string;
  invoiceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  notificationId?: string; // Link to system notification for delivery tracking
  templateId?: string; // Email template ID
  templateVariables?: TemplateVariable[]; // Variables for template replacement
}

export interface SendEmailResponse {
  success: boolean;
  logId: string;
  messageId?: string;
  status: string;
  error?: string;
  deliveryId?: string; // Delivery tracking ID
}

// Communication Log Types
export interface SMSLog {
  id: string;
  practice_id: string;
  recipient_phone: string;
  sender_phone?: string;
  message_content: string;
  message_type: SMSMessageType;
  provider: string;
  provider_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'blocked';
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  failure_reason?: string;
  cost_units?: number;
  cost_amount?: number;
  patient_id?: string;
  appointment_id?: string;
  visit_id?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  practice_id: string;
  recipient_email: string;
  recipient_name?: string;
  sender_email: string;
  sender_name?: string;
  subject: string;
  html_content?: string;
  text_content?: string;
  email_type: EmailType;
  provider: string;
  provider_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'spam';
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  failed_at?: string;
  failure_reason?: string;
  open_count?: number;
  click_count?: number;
  attachments?: EmailAttachment[];
  patient_id?: string;
  appointment_id?: string;
  visit_id?: string;
  invoice_id?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

class CommunicationService {
  /**
   * Send SMS through centralized gateway
   */
  async sendSMS(request: SendSMSRequest): Promise<SendSMSResponse> {
    let deliveryId: string | undefined;
    
    try {
      // Create delivery tracking record if notification ID provided
      if (request.notificationId) {
        try {
          const delivery = await notificationDeliveryService.createDeliveryTracking({
            notificationId: request.notificationId,
            channels: { sms: true }
          });
          deliveryId = delivery.id;
        } catch (trackingError) {
          console.error('Failed to create delivery tracking:', trackingError);
          // Continue with SMS sending even if tracking fails
        }
      }
      
      // Use edge function service instead of supabase.functions.invoke
      const { data, error } = await edgeFunctionService.sendSMS(request);

      if (error) {
        // Update delivery tracking if available
        if (deliveryId) {
          notificationDeliveryService.updateDeliveryStatus({
            deliveryId,
            channel: 'sms',
            status: 'failed',
            failureReason: error.message
          }).catch(console.error);
        }
        
        // Check if it's a limit reached error
        if (error.message?.includes('subscription limit reached')) {
          return {
            success: false,
            logId: '',
            status: 'blocked',
            error: 'SMS_LIMIT_REACHED',
            deliveryId
          };
        }
        
        return {
          success: false,
          logId: '',
          status: 'failed',
          error: error.message || 'Failed to send SMS',
          deliveryId
        };
      }

      // Handle limit reached response from edge function
      if (!data.success && data.error?.includes('subscription limit reached')) {
        if (deliveryId) {
          notificationDeliveryService.updateDeliveryStatus({
            deliveryId,
            channel: 'sms',
            status: 'failed',
            failureReason: 'Subscription limit reached'
          }).catch(console.error);
        }
        
        return {
          success: false,
          logId: data.logId || '',
          status: 'blocked',
          error: 'SMS_LIMIT_REACHED',
          deliveryId
        };
      }
      
      // Update delivery tracking on success
      if (deliveryId && data.success) {
        notificationDeliveryService.updateDeliveryStatus({
          deliveryId,
          channel: 'sms',
          status: 'delivered',
          timestamp: new Date().toISOString()
        }).catch(console.error);
      }

      return {
        success: true,
        ...data,
        deliveryId
      };
    } catch (error) {
      console.error('SMS service error:', error);
      
      if (deliveryId) {
        notificationDeliveryService.updateDeliveryStatus({
          deliveryId,
          channel: 'sms',
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        }).catch(console.error);
      }
      
      return {
        success: false,
        logId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        deliveryId
      };
    }
  }

  /**
   * Send email through centralized gateway
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    let deliveryId: string | undefined;
    
    try {
      // Create delivery tracking record if notification ID provided
      if (request.notificationId) {
        try {
          const delivery = await notificationDeliveryService.createDeliveryTracking({
            notificationId: request.notificationId,
            channels: { email: true }
          });
          deliveryId = delivery.id;
        } catch (trackingError) {
          console.error('Failed to create delivery tracking:', trackingError);
          // Continue with email sending even if tracking fails
        }
      }
      
      // Use edge function service instead of supabase.functions.invoke
      const { data, error } = await edgeFunctionService.sendEmail(request);

      if (error) {
        console.error('Email sending error:', error);
        
        // Update delivery tracking if available
        if (deliveryId) {
          notificationDeliveryService.updateDeliveryStatus({
            deliveryId,
            channel: 'email',
            status: 'failed',
            failureReason: error.message
          }).catch(console.error);
        }
        
        return {
          success: false,
          logId: '',
          status: 'failed',
          error: error.message || 'Failed to send email',
          deliveryId
        };
      }
      
      // Update delivery tracking on success
      if (deliveryId && data.success) {
        notificationDeliveryService.updateDeliveryStatus({
          deliveryId,
          channel: 'email',
          status: 'delivered',
          timestamp: new Date().toISOString()
        }).catch(console.error);
      }

      return {
        success: true,
        ...data,
        deliveryId
      };
    } catch (error) {
      console.error('Email service error:', error);
      
      if (deliveryId) {
        notificationDeliveryService.updateDeliveryStatus({
          deliveryId,
          channel: 'email',
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error'
        }).catch(console.error);
      }
      
      return {
        success: false,
        logId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        deliveryId
      };
    }
  }

  /**
   * Get SMS logs for a practice
   */
  async getSMSLogs(practiceId: string, options?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    messageType?: SMSMessageType;
    patientId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SMSLog[]; error: unknown }> {
    let query = supabase
      .from('practice_sms_logs')
      .select('*')
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.messageType) {
      query = query.eq('message_type', options.messageType);
    }
    if (options?.patientId) {
      query = query.eq('patient_id', options.patientId);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    return await query;
  }

  /**
   * Get email logs for a practice
   */
  async getEmailLogs(practiceId: string, options?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    emailType?: EmailType;
    patientId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: EmailLog[]; error: unknown }> {
    let query = supabase
      .from('practice_email_logs')
      .select('*')
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.emailType) {
      query = query.eq('email_type', options.emailType);
    }
    if (options?.patientId) {
      query = query.eq('patient_id', options.patientId);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    return await query;
  }

  /**
   * Check SMS subscription status
   */
  async checkSMSSubscription(practiceId: string) {
    try {
      const { data, error } = await supabase
        .from('practice_sms_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .gte('billing_cycle_end', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return {
          hasSubscription: false,
          canSend: false,
          reason: 'No active SMS subscription'
        };
      }

      const remaining = data.monthly_limit - data.current_usage;
      const usagePercentage = (data.current_usage / data.monthly_limit) * 100;

      return {
        hasSubscription: true,
        canSend: remaining > 0,
        subscription: data,
        remaining,
        usagePercentage,
        isNearLimit: usagePercentage >= 80,
        isExhausted: remaining <= 0,
        reason: remaining <= 0 ? 'Monthly SMS limit reached' : null
      };
    } catch (error) {
      console.error('Error checking SMS subscription:', error);
      return {
        hasSubscription: false,
        canSend: false,
        reason: 'Error checking subscription'
      };
    }
  }

  /**
   * Check Email subscription status
   */
  async checkEmailSubscription(practiceId: string) {
    try {
      const { data, error } = await supabase
        .from('practice_email_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .gte('billing_cycle_end', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return {
          hasSubscription: false,
          canSend: false,
          reason: 'No active email subscription'
        };
      }

      const remaining = data.monthly_limit - data.current_usage;
      const usagePercentage = (data.current_usage / data.monthly_limit) * 100;

      return {
        hasSubscription: true,
        canSend: remaining > 0,
        subscription: data,
        remaining,
        usagePercentage,
        isNearLimit: usagePercentage >= 80,
        isExhausted: remaining <= 0,
        reason: remaining <= 0 ? 'Monthly email limit reached' : null
      };
    } catch (error) {
      console.error('Error checking email subscription:', error);
      return {
        hasSubscription: false,
        canSend: false,
        reason: 'Error checking subscription'
      };
    }
  }

  /**
   * Get SMS usage statistics
   */
  async getSMSStats(practiceId: string, period: 'today' | 'week' | 'month' | 'year' = 'month') {
    const startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const { data, error } = await supabase
      .from('practice_sms_logs')
      .select('status, message_type, cost_amount')
      .eq('practice_id', practiceId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Error fetching SMS stats:', error);
      return null;
    }

    const stats = {
      total: data.length,
      sent: data.filter(s => s.status === 'sent').length,
      delivered: data.filter(s => s.status === 'delivered').length,
      failed: data.filter(s => s.status === 'failed').length,
      blocked: data.filter(s => s.status === 'blocked').length,
      totalCost: data.reduce((sum, s) => sum + (s.cost_amount || 0), 0),
      byType: {} as Record<string, number>
    };

    // Count by message type
    data.forEach(sms => {
      stats.byType[sms.message_type] = (stats.byType[sms.message_type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get email usage statistics
   */
  async getEmailStats(practiceId: string, period: 'today' | 'week' | 'month' | 'year' = 'month') {
    const startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const { data, error } = await supabase
      .from('practice_email_logs')
      .select('status, email_type, open_count, click_count')
      .eq('practice_id', practiceId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Error fetching email stats:', error);
      return null;
    }

    const stats = {
      total: data.length,
      sent: data.filter(e => e.status === 'sent').length,
      delivered: data.filter(e => e.status === 'delivered').length,
      opened: data.filter(e => e.status === 'opened').length,
      clicked: data.filter(e => e.status === 'clicked').length,
      bounced: data.filter(e => e.status === 'bounced').length,
      failed: data.filter(e => e.status === 'failed').length,
      spam: data.filter(e => e.status === 'spam').length,
      totalOpens: data.reduce((sum, e) => sum + (e.open_count || 0), 0),
      totalClicks: data.reduce((sum, e) => sum + (e.click_count || 0), 0),
      byType: {} as Record<string, number>
    };

    // Count by email type
    data.forEach(email => {
      stats.byType[email.email_type] = (stats.byType[email.email_type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Check subscription status
   */
  async checkSubscriptionStatus(practiceId: string) {
    const [smsResult, emailResult] = await Promise.all([
      supabase
        .from('practice_sms_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .gte('billing_cycle_end', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      supabase
        .from('practice_email_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .gte('billing_cycle_end', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ]);

    return {
      sms: {
        active: !smsResult.error && smsResult.data,
        data: smsResult.data,
        remaining: smsResult.data ? (smsResult.data.monthly_limit || 0) - (smsResult.data.current_usage || 0) : 0
      },
      email: {
        active: !emailResult.error && emailResult.data,
        data: emailResult.data,
        remaining: emailResult.data ? (emailResult.data.monthly_limit || 0) - (emailResult.data.current_usage || 0) : 0
      }
    };
  }
}

// Export singleton instance
export const communicationService = new CommunicationService();