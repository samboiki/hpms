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
      
      // Calculate statistics
      const stats = {
        total: deliveries?.length || 0,
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
      
      deliveries?.forEach(delivery => {
        // Count by channel
        if (delivery.in_app_delivered !== null) {
          stats.byChannel.inApp.sent++;
          if (delivery.in_app_delivered) stats.byChannel.inApp.delivered++;
        }
        
        if (delivery.email_delivered !== null) {
          stats.byChannel.email.sent++;
          if (delivery.email_delivered) stats.byChannel.email.delivered++;
          if (delivery.email_opened_at) stats.byChannel.email.opened++;
          if (delivery.email_clicked_at) stats.byChannel.email.clicked++;
        }
        
        if (delivery.sms_delivered !== null) {
          stats.byChannel.sms.sent++;
          if (delivery.sms_delivered) stats.byChannel.sms.delivered++;
        }
        
        if (delivery.push_delivered !== null) {
          stats.byChannel.push.sent++;
          if (delivery.push_delivered) stats.byChannel.push.delivered++;
          if (delivery.push_clicked_at) stats.byChannel.push.clicked++;
        }
        
        // Count by overall status
        const channelsAttempted = [
          delivery.in_app_delivered !== null,
          delivery.email_delivered !== null,
          delivery.sms_delivered !== null,
          delivery.push_delivered !== null
        ].filter(Boolean).length;
        
        const channelsDelivered = [
          delivery.in_app_delivered,
          delivery.email_delivered,
          delivery.sms_delivered,
          delivery.push_delivered
        ].filter(Boolean).length;
        
        if (channelsDelivered === channelsAttempted) {
          stats.byStatus.successful++;
        } else if (channelsDelivered > 0) {
          stats.byStatus.partial++;
        } else {
          stats.byStatus.failed++;
        }
      });
      
      // Calculate failure rates
      if (stats.byChannel.inApp.sent > 0) {
        stats.byChannel.inApp.failureRate = 
          ((stats.byChannel.inApp.sent - stats.byChannel.inApp.delivered) / stats.byChannel.inApp.sent) * 100;
      }
      
      if (stats.byChannel.email.sent > 0) {
        stats.byChannel.email.failureRate = 
          ((stats.byChannel.email.sent - stats.byChannel.email.delivered) / stats.byChannel.email.sent) * 100;
      }
      
      if (stats.byChannel.sms.sent > 0) {
        stats.byChannel.sms.failureRate = 
          ((stats.byChannel.sms.sent - stats.byChannel.sms.delivered) / stats.byChannel.sms.sent) * 100;
      }
      
      if (stats.byChannel.push.sent > 0) {
        stats.byChannel.push.failureRate = 
          ((stats.byChannel.push.sent - stats.byChannel.push.delivered) / stats.byChannel.push.sent) * 100;
      }
      
      return stats;
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