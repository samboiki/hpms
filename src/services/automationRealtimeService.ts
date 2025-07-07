import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Automation Realtime Service
 * Listens for new automation executions and processes them immediately
 */
class AutomationRealtimeService {
  private channel: RealtimeChannel | null = null;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Start listening for automation events
   */
  async startListening() {
    console.log('🚀 Starting Automation Realtime Service');
    
    // Subscribe to automation_executions inserts
    this.channel = supabase
      .channel('automation-processor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_executions',
          filter: 'status=eq.pending'
        },
        async (payload) => {
          console.log('📬 New automation execution detected:', payload.new);
          
          const execution = payload.new as any;
          const scheduledAt = new Date(execution.scheduled_at);
          const now = new Date();
          const delayMs = scheduledAt.getTime() - now.getTime();
          
          // If it should run within the next 2 minutes, process it
          if (delayMs <= 120000) { // 2 minutes
            if (delayMs > 0) {
              // Schedule it for the exact time
              console.log(`⏰ Scheduling automation ${execution.id} to run in ${delayMs}ms`);
              setTimeout(() => this.processAutomation(execution.id), delayMs);
            } else {
              // Run immediately
              console.log(`▶️ Running automation ${execution.id} immediately`);
              this.processAutomation(execution.id);
            }
          }
        }
      )
      .subscribe();

    // Also set up a periodic check every 30 seconds for any missed automations
    this.processingInterval = setInterval(() => {
      this.processPendingAutomations();
    }, 30000); // 30 seconds

    // Process any existing pending automations on startup
    await this.processPendingAutomations();
  }

  /**
   * Stop listening for automation events
   */
  stopListening() {
    console.log('🛑 Stopping Automation Realtime Service');
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Process a specific automation
   */
  private async processAutomation(executionId: string) {
    try {
      console.log(`🔄 Processing automation ${executionId}`);
      
      // Call the automation engine for this specific execution
      const { data, error } = await supabase.functions.invoke('automation-engine', {
        body: { executionIds: [executionId] }
      });
      
      if (error) {
        console.error(`❌ Error processing automation ${executionId}:`, error);
      } else {
        console.log(`✅ Successfully processed automation ${executionId}`, data);
      }
    } catch (error) {
      console.error(`❌ Unexpected error processing automation ${executionId}:`, error);
    }
  }

  /**
   * Process all pending automations that are due
   */
  private async processPendingAutomations() {
    if (this.isProcessing) {
      console.log('⏳ Already processing automations, skipping...');
      return;
    }

    this.isProcessing = true;
    
    try {
      // Check for any pending automations that are due
      const { data: pendingExecutions, error } = await supabase
        .from('automation_executions')
        .select('id, scheduled_at')
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
        .limit(10);
      
      if (error) {
        console.error('❌ Error fetching pending automations:', error);
        return;
      }
      
      if (pendingExecutions && pendingExecutions.length > 0) {
        console.log(`📋 Found ${pendingExecutions.length} pending automations to process`);
        
        // Process all pending automations
        const { data, error } = await supabase.functions.invoke('automation-engine', {
          body: {}
        });
        
        if (error) {
          console.error('❌ Error invoking automation engine:', error);
        } else {
          console.log('✅ Automation engine processed successfully', data);
        }
      }
    } catch (error) {
      console.error('❌ Error in processPendingAutomations:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}

// Create singleton instance
export const automationRealtimeService = new AutomationRealtimeService();

// Auto-start when imported (can be disabled if needed)
if (typeof window !== 'undefined') {
  // Only run in browser environment
  automationRealtimeService.startListening().catch(console.error);
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    automationRealtimeService.stopListening();
  });
}