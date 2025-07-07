import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AutomationExecution {
  id: string;
  automation_id: string;
  practice_id: string;
  patient_id?: string;
  visit_id?: string;
  invoice_id?: string;
  scheduled_at: string;
  channel: 'SMS' | 'EMAIL';
  template_data: Record<string, string>;
  variables_used: Record<string, string>;
}

interface AutomationSettings {
  id: string;
  practice_id: string;
  automation_id: string;
  name: string;
  is_active: boolean;
  channels: Array<{ type: string; enabled: boolean; template?: { body?: string; subject?: string } }>;
  timings: Array<{ delay_minutes: number; delay_days: number }>;
  sms_template: { body?: string };
  email_template: { subject?: string; body?: string };
  sms_template_id?: string;
  email_template_id?: string;
  variables: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get pending automations to execute
    const { data: pendingExecutions, error: fetchError } = await supabase
      .from('automation_executions')
      .select(`
        *,
        automation:automation_settings(*)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch pending executions: ${fetchError.message}`);
    }

    console.log(`Found ${pendingExecutions?.length || 0} pending executions to process`);
    const results = [];

    for (const execution of pendingExecutions || []) {
      try {
        // Update status to processing
        await supabase
          .from('automation_executions')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', execution.id);

        // Get the automation settings
        const automation = execution.automation as AutomationSettings;
        if (!automation || !automation.is_active) {
          await supabase
            .from('automation_executions')
            .update({ 
              status: 'cancelled',
              error_message: 'Automation is not active',
              updated_at: new Date().toISOString()
            })
            .eq('id', execution.id);
          continue;
        }

        // Prepare variables
        const variables = await prepareVariables(supabase, execution);
        
        // Process based on execution channel
        const executionChannel = execution.channel;
        const result: any = { execution_id: execution.id };

        try {
          if (executionChannel === 'SMS') {
            await sendSMS(supabase, execution, automation, variables);
            result.sms = { success: true };
          } else if (executionChannel === 'EMAIL') {
            await sendEmail(supabase, execution, automation, variables);
            result.email = { success: true };
          }
        } catch (error: any) {
          console.error(`Error sending ${executionChannel}:`, error);
          if (executionChannel === 'SMS') {
            result.sms = { success: false, error: error.message };
          } else if (executionChannel === 'EMAIL') {
            result.email = { success: false, error: error.message };
          }
          throw error; // Re-throw to mark execution as failed
        }

        // Mark as completed
        await supabase
          .from('automation_executions')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            variables_used: variables,
            updated_at: new Date().toISOString()
          })
          .eq('id', execution.id);

        results.push({ ...result, status: 'completed' });
      } catch (error) {
        // Mark as failed
        await supabase
          .from('automation_executions')
          .update({ 
            status: 'failed',
            error_message: error.message,
            retry_count: execution.retry_count + 1,
            next_retry_at: calculateNextRetry(execution.retry_count + 1),
            updated_at: new Date().toISOString()
          })
          .eq('id', execution.id);

        results.push({ id: execution.id, status: 'failed', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function prepareVariables(supabase: ReturnType<typeof createClient>, execution: AutomationExecution): Promise<Record<string, string>> {
  const variables: Record<string, string> = {};

  // Get patient info if available
  if (execution.patient_id) {
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', execution.patient_id)
      .single();

    if (patient) {
      variables.patientName = `${patient.first_name} ${patient.last_name}`;
      variables.patientPhone = patient.cell_number || patient.mobile_phone || '';
      variables.patientEmail = patient.email || '';
      variables.patientAge = calculateAge(patient.date_of_birth);
    }
  }

  // Get practice info
  const { data: practice } = await supabase
    .from('practices')
    .select('*')
    .eq('id', execution.practice_id)
    .single();

  if (practice) {
    variables.practiceName = practice.name;
    variables.practicePhone = practice.contact_phone || '';
    variables.practiceWebsite = practice.website_url || '';
    variables.practiceEmail = practice.contact_email || '';
  }

  // Get visit info if available
  if (execution.visit_id) {
    const { data: visit } = await supabase
      .from('visits')
      .select(`
        *,
        doctor:users(first_name, last_name)
      `)
      .eq('id', execution.visit_id)
      .single();

    if (visit) {
      variables.appointmentDate = formatDate(visit.scheduled_date || visit.visit_date);
      variables.appointmentTime = formatTime(visit.scheduled_time || visit.visit_time);
      variables.doctorName = visit.doctor ? `Dr. ${visit.doctor.first_name} ${visit.doctor.last_name}` : '';
      variables.visitType = visit.visit_type || '';
      variables.visitDate = formatDate(visit.visit_date);
    }
  }

  // Get invoice info if available
  if (execution.invoice_id) {
    const { data: invoice } = await supabase
      .from('invoices_enhanced')
      .select('*')
      .eq('id', execution.invoice_id)
      .single();

    if (invoice) {
      variables.invoiceNumber = invoice.invoice_number;
      variables.amount = formatCurrency(invoice.total);
      variables.dueDate = formatDate(invoice.due_date);
      variables.paymentLink = `${practice?.website_url || ''}/pay/${invoice.id}`;
    }
  }

  // Add any template-specific variables from execution
  if (execution.template_data) {
    Object.assign(variables, execution.template_data);
  }

  return variables;
}

async function sendSMS(supabase: ReturnType<typeof createClient>, execution: AutomationExecution, automation: AutomationSettings, variables: Record<string, string>) {
  // Get recipient phone
  let recipientPhone = variables.patientPhone;
  if (!recipientPhone && execution.patient_id) {
    const { data: patient } = await supabase
      .from('patients')
      .select('cell_number, mobile_phone')
      .eq('id', execution.patient_id)
      .single();
    
    recipientPhone = patient?.cell_number || patient?.mobile_phone;
  }

  if (!recipientPhone) {
    throw new Error('No phone number available for SMS');
  }

  // Prepare SMS payload
  const smsPayload: Record<string, unknown> = {
    practiceId: execution.practice_id,
    recipientPhone: recipientPhone,
    messageType: 'system',
    patientId: execution.patient_id,
    appointmentId: execution.appointment_id,
    visitId: execution.visit_id,
    metadata: {
      automation_id: automation.id,
      automation_type: automation.automation_id,
      execution_id: execution.id
    }
  };

  // Check if template ID is available
  if (automation.sms_template_id) {
    // Use template ID approach
    smsPayload.templateId = automation.sms_template_id;
    smsPayload.templateVariables = variables;
  } else {
    // Fall back to inline template
    const template = automation.sms_template?.body || automation.channels[0]?.template?.body || '';
    const message = replaceVariables(template, variables);
    smsPayload.messageContent = message;
  }

  // Call SMS gateway using direct fetch (supabase.functions.invoke has issues)
  console.log('Calling centralized-sms-gateway with payload:', smsPayload);
  
  const smsResponse = await fetch(`${supabaseUrl}/functions/v1/centralized-sms-gateway`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(smsPayload)
  });

  const data = await smsResponse.json();
  
  if (!smsResponse.ok) {
    console.error('SMS gateway error:', data);
    throw new Error(data.error || 'Failed to send SMS');
  }

  // Update execution with message ID
  if (data?.log_id) {
    await supabase
      .from('automation_executions')
      .update({ 
        message_id: data.log_id,
        channel: 'SMS'
      })
      .eq('id', execution.id);
  }
}

async function sendEmail(supabase: ReturnType<typeof createClient>, execution: AutomationExecution, automation: AutomationSettings, variables: Record<string, string>) {
  // Get recipient email
  let recipientEmail = variables.patientEmail;
  if (!recipientEmail && execution.patient_id) {
    const { data: patient } = await supabase
      .from('patients')
      .select('email')
      .eq('id', execution.patient_id)
      .single();
    
    recipientEmail = patient?.email;
  }

  if (!recipientEmail) {
    throw new Error('No email address available');
  }

  // Prepare email payload
  const emailPayload: Record<string, unknown> = {
    practiceId: execution.practice_id,
    recipientEmail: recipientEmail,
    recipientName: variables.patientName || variables.patient_name || 'Valued Patient',
    emailType: 'system',
    patientId: execution.patient_id,
    appointmentId: execution.appointment_id,
    visitId: execution.visit_id,
    invoiceId: execution.invoice_id,
    metadata: {
      automation_id: automation.id,
      automation_type: automation.automation_id,
      execution_id: execution.id
    }
  };

  // Check if template ID is available
  if (automation.email_template_id) {
    // Use template ID approach
    emailPayload.templateId = automation.email_template_id;
    emailPayload.templateVariables = variables;
  } else {
    // Fall back to inline template
    const subject = replaceVariables(
      automation.email_template?.subject || automation.channels[0]?.template?.subject || 'Notification',
      variables
    );
    const body = replaceVariables(
      automation.email_template?.body || automation.channels[0]?.template?.body || '',
      variables
    );
    emailPayload.subject = subject;
    emailPayload.textContent = body;
  }

  // Call email gateway using direct fetch (supabase.functions.invoke has issues)
  console.log('Calling email-gateway-v2 with payload:', emailPayload);
  
  const emailResponse = await fetch(`${supabaseUrl}/functions/v1/email-gateway-v2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailPayload)
  });

  const data = await emailResponse.json();
  
  if (!emailResponse.ok) {
    console.error('Email gateway error:', data);
    throw new Error(data.error || 'Failed to send email');
  }

  // Update execution with message ID
  if (data?.log_id) {
    await supabase
      .from('automation_executions')
      .update({ 
        message_id: data.log_id,
        channel: 'EMAIL'
      })
      .eq('id', execution.id);
  }
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  
  // Remove any remaining unreplaced variables
  result = result.replace(/{{[^}]+}}/g, '');
  
  return result;
}

function calculateNextRetry(retryCount: number): string {
  // Exponential backoff: 5min, 15min, 1hr, 6hr, 24hr
  const delays = [5, 15, 60, 360, 1440];
  const delayMinutes = delays[Math.min(retryCount - 1, delays.length - 1)];
  
  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
  
  return nextRetry.toISOString();
}

function calculateAge(dateOfBirth: string): string {
  if (!dateOfBirth) return '';
  
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age.toString();
}

function formatDate(date: string): string {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatTime(time: string): string {
  if (!time) return '';
  
  // Handle both HH:mm and HH:mm:ss formats
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NA', {
    style: 'currency',
    currency: 'NAD'
  }).format(amount);
}

