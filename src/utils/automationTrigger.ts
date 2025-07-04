import { supabase } from '../lib/supabase';

/**
 * Manually trigger the automation engine to process pending automations
 * This can be called from anywhere in your app
 */
export async function triggerAutomationEngine() {
  try {
    // First check if there are pending automations
    const { data: pendingCount, error: countError } = await supabase.rpc('trigger_automations');
    
    if (countError) {
      console.error('Error checking pending automations:', countError);
      return { success: false, error: countError };
    }
    
    console.log(`Found ${pendingCount} pending automations`);
    
    // If there are pending automations, invoke the edge function
    if (pendingCount > 0) {
      const { data, error } = await supabase.functions.invoke('automation-engine', {
        body: {}
      });
      
      if (error) {
        console.error('Error invoking automation engine:', error);
        return { success: false, error };
      }
      
      console.log('Automation engine response:', data);
      return { success: true, data, pendingCount };
    }
    
    return { success: true, pendingCount: 0, message: 'No pending automations' };
  } catch (error) {
    console.error('Failed to trigger automation engine:', error);
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
 * Set up periodic automation processing
 * Call this once when your app starts
 */
export function setupAutomationProcessing(intervalMinutes: number = 5) {
  // Trigger immediately on startup
  triggerAutomationEngine();
  
  // Then set up periodic triggering
  setInterval(() => {
    triggerAutomationEngine();
  }, intervalMinutes * 60 * 1000);
  
  console.log(`Automation engine will run every ${intervalMinutes} minutes`);
}