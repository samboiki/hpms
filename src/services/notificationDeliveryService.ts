// ========================================
// NOTIFICATION DELIVERY TRACKING SERVICE
// Multi-channel delivery tracking for all communications
// ========================================

import { supabase } from '../lib/supabase';

export interface DeliveryStatus {
  delivered: boolean;
  deliveredAt?: string;
  failureReason?: string;
  openedAt?: string;
  clickedAt?: string;
}

export interface NotificationDelivery {
  id: string;
  notification_id: string;
  
  // In-app delivery
  in_app_delivered: boolean;
  in_app_delivered_at?: string;
  
  // Email delivery
  email_delivered: boolean;
  email_delivered_at?: string;
  email_failure_reason?: string;
  email_opened_at?: string;
  email_clicked_at?: string;
  
  // SMS delivery
  sms_delivered: boolean;
  sms_delivered_at?: string;
  sms_failure_reason?: string;
  
  // Push notification delivery
  push_delivered: boolean;
  push_delivered_at?: string;
  push_failure_reason?: string;
  push_clicked_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryTrackingRequest {
  notificationId: string;
  channels: {
    inApp?: boolean;
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
}

export interface UpdateDeliveryStatusRequest {
  deliveryId: string;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  status: 'delivered' | 'failed' | 'opened' | 'clicked';
  failureReason?: string;
  timestamp?: string;
}

export interface DeliveryStatistics {
  total: number;
  byChannel: {
    inApp: { sent: number; delivered: number; failureRate: number };
    email: { sent: number; delivered: number; opened: number; clicked: number; failureRate: number };
    sms: { sent: number; delivered: number; failureRate: number };
    push: { sent: number; delivered: number; clicked: number; failureRate: number };
  };
  byStatus: {
    successful: number;
    partial: number;
    failed: number;
  };
}

const failureRate = (sent: number, delivered: number): number => (sent > 0 ? ((sent - delivered) / sent) * 100 : 0);

/**
 * Delivery statistics from tracking rows. Every row starts with all four channels set to false,
 * so false alone means "never tried": a channel only counts as sent once it has an outcome
 * (delivered, a failure reason, or an open/click). Counting false as sent made every SMS-only
 * notification look like three failed channels and a "partial" delivery.
 */
export function computeDeliveryStatistics(deliveries: NotificationDelivery[]): DeliveryStatistics {
  const stats: DeliveryStatistics = {
    total: deliveries.length,
    byChannel: {
      inApp: { sent: 0, delivered: 0, failureRate: 0 },
      email: { sent: 0, delivered: 0, opened: 0, clicked: 0, failureRate: 0 },
      sms: { sent: 0, delivered: 0, failureRate: 0 },
      push: { sent: 0, delivered: 0, clicked: 0, failureRate: 0 }
    },
    byStatus: { successful: 0, partial: 0, failed: 0 }
  };

  deliveries.forEach(delivery => {
    const channels = [
      { attempted: delivery.in_app_delivered === true, delivered: delivery.in_app_delivered === true },
      {
        attempted: delivery.email_delivered === true || !!delivery.email_failure_reason || !!delivery.email_opened_at || !!delivery.email_clicked_at,
        delivered: delivery.email_delivered === true
      },
      { attempted: delivery.sms_delivered === true || !!delivery.sms_failure_reason, delivered: delivery.sms_delivered === true },
      {
        attempted: delivery.push_delivered === true || !!delivery.push_failure_reason || !!delivery.push_clicked_at,
        delivered: delivery.push_delivered === true
      }
    ];
    const [inApp, email, sms, push] = channels;

    if (inApp.attempted) {
      stats.byChannel.inApp.sent++;
      if (inApp.delivered) stats.byChannel.inApp.delivered++;
    }
    if (email.attempted) {
      stats.byChannel.email.sent++;
      if (email.delivered) stats.byChannel.email.delivered++;
      if (delivery.email_opened_at) stats.byChannel.email.opened++;
      if (delivery.email_clicked_at) stats.byChannel.email.clicked++;
    }
    if (sms.attempted) {
      stats.byChannel.sms.sent++;
      if (sms.delivered) stats.byChannel.sms.delivered++;
    }
    if (push.attempted) {
      stats.byChannel.push.sent++;
      if (push.delivered) stats.byChannel.push.delivered++;
      if (delivery.push_clicked_at) stats.byChannel.push.clicked++;
    }

    const attempted = channels.filter(channel => channel.attempted);
    // No outcome on any channel yet: still in progress, so neither a success nor a failure
    if (attempted.length === 0) return;
    const delivered = attempted.filter(channel => channel.delivered).length;
    if (delivered === attempted.length) {
      stats.byStatus.successful++;
    } else if (delivered > 0) {
      stats.byStatus.partial++;
    } else {
      stats.byStatus.failed++;
    }
  });

  const { inApp, email, sms, push } = stats.byChannel;
  inApp.failureRate = failureRate(inApp.sent, inApp.delivered);
  email.failureRate = failureRate(email.sent, email.delivered);
  sms.failureRate = failureRate(sms.sent, sms.delivered);
  push.failureRate = failureRate(push.sent, push.delivered);

  return stats;
}

class NotificationDeliveryService {
  private static instance: NotificationDeliveryService;
  
  static getInstance(): NotificationDeliveryService {
    if (!NotificationDeliveryService.instance) {
      NotificationDeliveryService.instance = new NotificationDeliveryService();
    }
    return NotificationDeliveryService.instance;
  }

  // ========================================
  // CREATE DELIVERY TRACKING
  // ========================================
  
  /**
   * Create a new delivery tracking record for a notification
   */
  async createDeliveryTracking(request: CreateDeliveryTrackingRequest): Promise<NotificationDelivery> {
    try {
      const { data, error } = await supabase
        .from('notification_deliveries')
        .insert({
          notification_id: request.notificationId,
          // Initialize all channels as not delivered
          in_app_delivered: false,
          email_delivered: false,
          sms_delivered: false,
          push_delivered: false
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create delivery tracking: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error creating delivery tracking:', error);
      throw error;
    }
  }

  // ========================================
  // UPDATE DELIVERY STATUS
  // ========================================
  
  /**
   * Update the delivery status for a specific channel
   */
  async updateDeliveryStatus(request: UpdateDeliveryStatusRequest): Promise<NotificationDelivery> {
    try {
      const timestamp = request.timestamp || new Date().toISOString();
      const updateData: any = {};
      
      switch (request.channel) {
        case 'in_app':
          if (request.status === 'delivered') {
            updateData.in_app_delivered = true;
            updateData.in_app_delivered_at = timestamp;
          }
          break;
          
        case 'email':
          if (request.status === 'delivered') {
            updateData.email_delivered = true;
            updateData.email_delivered_at = timestamp;
          } else if (request.status === 'failed') {
            updateData.email_delivered = false;
            updateData.email_failure_reason = request.failureReason;
          } else if (request.status === 'opened') {
            updateData.email_opened_at = timestamp;
          } else if (request.status === 'clicked') {
            updateData.email_clicked_at = timestamp;
          }
          break;
          
        case 'sms':
          if (request.status === 'delivered') {
            updateData.sms_delivered = true;
            updateData.sms_delivered_at = timestamp;
          } else if (request.status === 'failed') {
            updateData.sms_delivered = false;
            updateData.sms_failure_reason = request.failureReason;
          }
          break;
          
        case 'push':
          if (request.status === 'delivered') {
            updateData.push_delivered = true;
            updateData.push_delivered_at = timestamp;
          } else if (request.status === 'failed') {
            updateData.push_delivered = false;
            updateData.push_failure_reason = request.failureReason;
          } else if (request.status === 'clicked') {
            updateData.push_clicked_at = timestamp;
          }
          break;
      }
      
      updateData.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('notification_deliveries')
        .update(updateData)
        .eq('id', request.deliveryId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update delivery status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error updating delivery status:', error);
      throw error;
    }
  }

  // ========================================
  // QUERY DELIVERY STATUS
  // ========================================
  
  /**
   * Get delivery status for a notification
   */
  async getDeliveryStatus(notificationId: string): Promise<NotificationDelivery | null> {
    try {
      const { data, error } = await supabase
        .from('notification_deliveries')
        .select('*')
        .eq('notification_id', notificationId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw new Error(`Failed to get delivery status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error getting delivery status:', error);
      throw error;
    }
  }

  /**
   * Get delivery statistics for a practice
   */
  async getDeliveryStatistics(
    practiceId: string,
    dateRange?: { from: string; to: string }
  ): Promise<{
    total: number;
    byChannel: {
      inApp: { sent: number; delivered: number; failureRate: number };
      email: { sent: number; delivered: number; opened: number; clicked: number; failureRate: number };
      sms: { sent: number; delivered: number; failureRate: number };
      push: { sent: number; delivered: number; clicked: number; failureRate: number };
    };
    byStatus: {
      successful: number;
      partial: number;
      failed: number;
    };
  }> {
    try {
      // First get all notification IDs for the practice
      let notificationQuery = supabase
        .from('system_notifications')
        .select('id')
        .eq('practice_id', practiceId);
        
      if (dateRange) {
        notificationQuery = notificationQuery
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to);
      }
      
      const { data: notifications, error: notifError } = await notificationQuery;
      
      if (notifError) {
        throw new Error(`Failed to get notifications: ${notifError.message}`);
      }
      
      if (!notifications || notifications.length === 0) {
        return {
          total: 0,
          byChannel: {
            inApp: { sent: 0, delivered: 0, failureRate: 0 },
            email: { sent: 0, delivered: 0, opened: 0, clicked: 0, failureRate: 0 },
            sms: { sent: 0, delivered: 0, failureRate: 0 },
            push: { sent: 0, delivered: 0, clicked: 0, failureRate: 0 }
          },
          byStatus: {
            successful: 0,
            partial: 0,
            failed: 0
          }
        };
      }
      
      const notificationIds = notifications.map(n => n.id);
      
      // Get all delivery records
      const { data: deliveries, error: deliveryError } = await supabase
        .from('notification_deliveries')
        .select('*')
        .in('notification_id', notificationIds);
        
      if (deliveryError) {
        throw new Error(`Failed to get deliveries: ${deliveryError.message}`);
      }

      // notification_deliveries is missing from the generated database types, hence the cast
      return computeDeliveryStatistics((deliveries || []) as unknown as NotificationDelivery[]);
    } catch (error) {
      console.error('Error getting delivery statistics:', error);
      throw error;
    }
  }

  // ========================================
  // REAL-TIME SUBSCRIPTIONS
  // ========================================
  
  /**
   * Subscribe to delivery updates for a notification
   */
  subscribeToDeliveryUpdates(
    notificationId: string,
    callback: (delivery: NotificationDelivery) => void
  ) {
    return supabase
      .channel(`delivery-updates-${notificationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notification_deliveries',
        filter: `notification_id=eq.${notificationId}`
      }, (payload) => {
        if (payload.new) {
          callback(payload.new as NotificationDelivery);
        }
      })
      .subscribe();
  }

  /**
   * Subscribe to all delivery updates for a practice
   */
  subscribeToPracticeDeliveries(
    practiceId: string,
    callback: (delivery: NotificationDelivery) => void
  ) {
    // We need to join with system_notifications to filter by practice
    // For now, we'll subscribe to all and filter client-side
    return supabase
      .channel(`practice-deliveries-${practiceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notification_deliveries'
      }, async (payload) => {
        if (payload.new) {
          const delivery = payload.new as NotificationDelivery;
          
          // Check if this delivery belongs to the practice
          const { data: notification } = await supabase
            .from('system_notifications')
            .select('practice_id')
            .eq('id', delivery.notification_id)
            .single();
            
          if (notification?.practice_id === practiceId) {
            callback(delivery);
          }
        }
      })
      .subscribe();
  }
}

// ========================================
// EXPORT SINGLETON INSTANCE
// ========================================

export const notificationDeliveryService = NotificationDeliveryService.getInstance();
export default notificationDeliveryService;