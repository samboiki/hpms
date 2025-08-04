import { supabase } from '../lib/supabase';
import { triggerAutomationEngine } from '../utils/automationTrigger';

class AutomationProcessingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isStarted = false;
  private intervalMinutes = 5; // Process every 5 minutes (reduced for performance)

  async start() {
    try {
      // Prevent duplicate starts
      if (this.isStarted) {
        console.log('⚠️ Automation Processing Service already started');
        return;
      }
      
      console.log('🚀 Starting Automation Processing Service');
      this.isStarted = true;
      
      // Don't process immediately on start - wait for first interval
      // This prevents blocking the app startup
      
      // Set up interval
      this.intervalId = setInterval(async () => {
        await this.processAutomations();
      }, this.intervalMinutes * 60 * 1000);
      
      console.log(`⏰ Automation processing scheduled every ${this.intervalMinutes} minutes`);
      
      // Process after a short delay to not block app startup
      setTimeout(() => {
        this.processAutomations().catch(error => {
          console.error('Error in initial automation processing:', error);
        });
      }, 5000); // 5 second delay
    } catch (error) {
      console.error('Failed to start automation processing service:', error);
      this.isStarted = false;
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isStarted = false;
      console.log('🛑 Automation Processing Service stopped');
    }
  }

  private async processAutomations() {
    // Prevent overlapping executions
    if (this.isProcessing) {
      console.log('⏭️ Skipping automation processing - already in progress');
      return;
    }

    this.isProcessing = true;
    
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('⚠️ No authenticated session - skipping automation processing');
        return;
      }

      // Use the same triggerAutomationEngine function that the manual button uses
      const result = await triggerAutomationEngine();
      
      if (result.success && result.pendingCount && result.pendingCount > 0) {
        console.log(`✅ Processed ${result.pendingCount} automation(s)`);
      } else if (result.success && result.pendingCount === 0) {
        // Silent when no automations to process
      } else if (!result.success) {
        console.error('❌ Failed to process automations:', result.error);
      }
    } catch (error) {
      console.error('❌ Error in automation processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Allow manual triggering
  async trigger() {
    await this.processAutomations();
  }

  // Update interval
  setInterval(minutes: number) {
    this.intervalMinutes = minutes;
    this.stop();
    this.start();
  }
}

// Export singleton instance
export const automationProcessingService = new AutomationProcessingService();