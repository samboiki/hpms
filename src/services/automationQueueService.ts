import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Enterprise Automation Queue Service
 * Real-time queue processing with webhook integration
 * Similar to Amazon SQS + Lambda architecture
 */
class AutomationQueueService {
  private channel: RealtimeChannel | null = null;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private workerId: string;
  private stats = {
    processed: 0,
    failed: 0,
    startTime: new Date()
  };

  constructor() {
    this.workerId = `web-worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the queue service
   */
  async start() {
    console.log('🚀 Starting Enterprise Automation Queue Service');
    console.log(`📋 Worker ID: ${this.workerId}`);
    
    // Subscribe to real-time queue notifications
    this.channel = supabase
      .channel('automation-queue-processor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_queue',
          filter: 'status=eq.queued'
        },
        async (payload) => {
          console.log('📬 New queue item detected:', payload.new);
          const item = payload.new as any;
          
          // Check if it needs immediate processing
          const scheduledAt = new Date(item.scheduled_for);
          const now = new Date();
          
          if (scheduledAt <= new Date(now.getTime() + 60000)) { // Within 1 minute
            console.log('⚡ Triggering immediate processing for high-priority item');
            this.processQueue();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'automation_queue',
          filter: 'status=eq.retrying'
        },
        async (payload) => {
          console.log('🔄 Retry item detected:', payload.new);
          this.processQueue();
        }
      )
      .subscribe();

    // Listen for webhook notifications
    this.channel.on('broadcast', { event: 'process_queue' }, () => {
      console.log('📡 Received process_queue broadcast');
      this.processQueue();
    });

    // Set up periodic processing (every 15 seconds for reliability)
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 15000);

    // Process immediately on start
    await this.processQueue();
    
    // Log stats periodically
    setInterval(() => {
      this.logStats();
    }, 60000); // Every minute
  }

  /**
   * Stop the queue service
   */
  stop() {
    console.log('🛑 Stopping Automation Queue Service');
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.logStats();
  }

  /**
   * Process the queue
   */
  private async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      // Call the queue worker edge function
      const { data, error } = await supabase.functions.invoke('automation-queue-worker', {
        body: {
          action: 'process',
          workerId: this.workerId
        }
      });
      
      if (error) {
        console.error('❌ Queue worker error:', error);
        this.stats.failed++;
      } else if (data && data.processed > 0) {
        console.log(`✅ Processed ${data.processed} queue items`);
        this.stats.processed += data.processed;
        
        // Log results
        if (data.results) {
          data.results.forEach((result: any) => {
            if (result.success) {
              console.log(`✅ ${result.queue_id}: Successfully processed`);
            } else {
              console.error(`❌ ${result.queue_id}: Failed - ${result.error}`);
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ Unexpected error processing queue:', error);
      this.stats.failed++;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const { data, error } = await supabase
        .from('automation_queue_dashboard')
        .select('*');
      
      if (error) throw error;
      
      return {
        queue: data,
        worker: {
          id: this.workerId,
          processed: this.stats.processed,
          failed: this.stats.failed,
          uptime: Date.now() - this.stats.startTime.getTime()
        }
      };
    } catch (error) {
      console.error('Error fetching queue stats:', error);
      return null;
    }
  }

  /**
   * Manually trigger processing
   */
  async triggerProcessing() {
    console.log('🔧 Manual trigger requested');
    await this.processQueue();
  }

  /**
   * Log current statistics
   */
  private logStats() {
    const runtime = Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000);
    console.log(`📊 Queue Service Stats - Runtime: ${runtime}s, Processed: ${this.stats.processed}, Failed: ${this.stats.failed}`);
  }
}

// Create singleton instance
export const automationQueueService = new AutomationQueueService();

// Auto-start in browser environment
if (typeof window !== 'undefined') {
  // Start the service
  automationQueueService.start().catch(console.error);
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    automationQueueService.stop();
  });
  
  // Expose for debugging
  (window as any).automationQueueService = automationQueueService;
}