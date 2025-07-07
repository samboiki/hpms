import { supabase } from '../lib/supabase';

/**
 * Process pending SMS messages by invoking the centralized SMS gateway
 */
export async function processPendingSMS() {
  try {
    // Get pending SMS messages
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('practice_sms_logs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (fetchError) {
      console.error('Error fetching pending SMS:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('No pending SMS messages found');
      return { success: true, processed: 0 };
    }

    console.log(`Found ${pendingMessages.length} pending SMS messages`);
    const results = [];

    for (const sms of pendingMessages) {
      try {
        console.log(`Processing SMS ${sms.id} to ${sms.recipient_phone}`);
        
        // Get current session to ensure we have auth
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('No active session for SMS sending');
          results.push({
            id: sms.id,
            success: false,
            error: 'No active session'
          });
          continue;
        }

        // Invoke the centralized SMS gateway with proper auth
        const { data, error } = await supabase.functions.invoke('centralized-sms-gateway', {
          body: {
            practiceId: sms.practice_id,
            recipientPhone: sms.recipient_phone,
            messageContent: sms.message_content,
            messageType: sms.message_type || 'custom',
            patientId: sms.patient_id,
            appointmentId: sms.appointment_id,
            visitId: sms.visit_id,
            metadata: sms.metadata || {},
            tags: sms.tags || []
          }
        });

        if (error) {
          console.error(`Error sending SMS ${sms.id}:`, error);
          results.push({
            id: sms.id,
            success: false,
            error: error.message
          });
        } else if (data && data.success) {
          console.log(`SMS ${sms.id} sent successfully`);
          results.push({
            id: sms.id,
            success: true,
            messageId: data.messageId
          });
        } else {
          console.error(`SMS ${sms.id} failed:`, data?.error);
          results.push({
            id: sms.id,
            success: false,
            error: data?.error || 'Unknown error'
          });
        }
      } catch (error) {
        console.error(`Exception processing SMS ${sms.id}:`, error);
        results.push({
          id: sms.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      results
    };
  } catch (error) {
    console.error('Error in processPendingSMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send a specific pending SMS
 */
export async function sendPendingSMS(smsId: string) {
  try {
    // Get the SMS record
    const { data: sms, error: fetchError } = await supabase
      .from('practice_sms_logs')
      .select('*')
      .eq('id', smsId)
      .single();

    if (fetchError) {
      console.error('Error fetching SMS:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!sms) {
      return { success: false, error: 'SMS not found' };
    }

    if (sms.status !== 'pending') {
      return { success: false, error: `SMS is not pending (status: ${sms.status})` };
    }

    // Invoke the centralized SMS gateway
    const { data, error } = await supabase.functions.invoke('centralized-sms-gateway', {
      body: {
        practiceId: sms.practice_id,
        recipientPhone: sms.recipient_phone,
        messageContent: sms.message_content,
        messageType: sms.message_type || 'custom',
        patientId: sms.patient_id,
        appointmentId: sms.appointment_id,
        visitId: sms.visit_id,
        metadata: sms.metadata || {},
        tags: sms.tags || []
      }
    });

    if (error) {
      console.error('Error sending SMS:', error);
      return { success: false, error: error.message };
    }

    if (data && data.success) {
      console.log('SMS sent successfully:', data);
      return {
        success: true,
        messageId: data.messageId,
        logId: data.logId,
        status: data.status
      };
    } else {
      console.error('SMS sending failed:', data);
      return {
        success: false,
        error: data?.error || 'Unknown error'
      };
    }
  } catch (error) {
    console.error('Error in sendPendingSMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}