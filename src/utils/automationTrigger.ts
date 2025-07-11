import { supabase } from '../lib/supabase';

/**
 * Check pending automations status (n8n handles processing)
 * This is now just a status check - actual processing is done by n8n
 */
export async function triggerAutomationEngine() {
  try {
    // Check if there are pending automations in the queue
    const { data: pendingAutomations, error } = await supabase
      .from('automation_queue')
      .select('id')
      .in('status', ['queued', 'pending'])
      .lte('scheduled_for', new Date().toISOString());
    
    if (error) {
      console.error('Error checking pending automations:', error);
      return { success: false, error };
    }
    
    const pendingCount = pendingAutomations?.length || 0;
    console.log(`Found ${pendingCount} pending automations (n8n will process these)`);
    
    return { 
      success: true, 
      pendingCount, 
      message: pendingCount > 0 
        ? 'Automations queued for n8n processing' 
        : 'No pending automations'
    };
  } catch (error) {
    console.error('Failed to check automation queue:', error);
    return { success: false, error };
  }
}

/**
 * Check if there are any pending automations
 */
export async function checkPendingAutomations(practiceId?: string) {
  try {
    let query = supabase
      .from('automation_executions')
      .select('count')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString());
    
    if (practiceId) {
      query = query.eq('practice_id', practiceId);
    }
    
    const { count, error } = await query.single();
    
    if (error) {
      console.error('Error checking pending automations:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Failed to check pending automations:', error);
    return 0;
  }
}

/**
 * Set up periodic automation status checking
 * Note: Actual processing is handled by n8n workflow running every minute
 */
export function setupAutomationProcessing(intervalMinutes: number = 5) {
  // Check status immediately on startup
  triggerAutomationEngine();
  
  // Then set up periodic status checking (for monitoring purposes)
  setInterval(() => {
    triggerAutomationEngine();
  }, intervalMinutes * 60 * 1000);
  
  console.log(`Automation status check will run every ${intervalMinutes} minutes (n8n handles actual processing)`);
}