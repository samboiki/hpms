import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface AutomationExecution {
  id: string;
  automation_id: string;
  practice_id: string;
  patient_id?: string;
  visit_id?: string;
  invoice_id?: string;
  scheduled_at: string;
  channel: 'SMS' | 'EMAIL';
  template_data: any;
  variables_used: any;
}

interface AutomationSettings {
  id: string;
  practice_id: string;
  automation_id: string;
  name: string;
  is_active: boolean;
  channels: any[];
  timings: any[];
  sms_template: any;
  email_template: any;
  variables: string[];
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
        
        // Process each channel
        for (const channel of automation.channels) {
          if (!channel.enabled) continue;

          try {
            if (channel.type === 'SMS' || channel.type === 'BOTH') {
              await sendSMS(supabase, execution, automation, variables);
            }
            
            if (channel.type === 'EMAIL' || channel.type === 'BOTH') {
              await sendEmail(supabase, execution, automation, variables);
            }
          } catch (error) {
            console.error(`Error sending ${channel.type}:`, error);
            // Continue with other channels even if one fails
          }
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

        results.push({ id: execution.id, status: 'completed' });
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

async function prepareVariables(supabase: any, execution: AutomationExecution): Promise<Record<string, string>> {
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

async function sendSMS(supabase: any, execution: AutomationExecution, automation: AutomationSettings, variables: Record<string, string>) {
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

  // Get SMS template
  const template = automation.sms_template?.body || automation.channels[0]?.template?.body || '';
  const message = replaceVariables(template, variables);

  // Call centralized SMS gateway
  const { data, error } = await supabase.functions.invoke('centralized-sms-gateway', {
    body: {
      practiceId: execution.practice_id,  // Changed from practice_id to practiceId
      recipientPhone: recipientPhone,
      messageContent: message,  // Changed from message_content to messageContent
      messageType: 'system',  // Changed from automation.automation_id to 'system'
      patientId: execution.patient_id,  // Changed from patient_id to patientId
      appointmentId: execution.appointment_id,  // Added appointmentId
      visitId: execution.visit_id,  // Changed from visit_id to visitId
      metadata: {
        automation_id: automation.id,
        automation_type: automation.automation_id,
        execution_id: execution.id
      }
    }
  });

  if (error) throw error;

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

async function sendEmail(supabase: any, execution: AutomationExecution, automation: AutomationSettings, variables: Record<string, string>) {
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

  // Get email template
  const subject = replaceVariables(
    automation.email_template?.subject || automation.channels[0]?.template?.subject || 'Notification',
    variables
  );
  const body = replaceVariables(
    automation.email_template?.body || automation.channels[0]?.template?.body || '',
    variables
  );

  // Call centralized email gateway
  const { data, error } = await supabase.functions.invoke('centralized-email-gateway', {
    body: {
      practiceId: execution.practice_id,  // Changed to camelCase
      recipientEmail: recipientEmail,  // Changed to camelCase
      subject: subject,
      htmlContent: convertToHtml(body),  // Changed to camelCase
      textContent: body,  // Changed to camelCase
      emailType: 'system',  // Changed from automation.automation_id to 'system'
      patientId: execution.patient_id,  // Changed to camelCase
      appointmentId: execution.appointment_id,  // Added
      visitId: execution.visit_id,  // Changed to camelCase
      invoiceId: execution.invoice_id,  // Changed to camelCase
      metadata: {
        automation_id: automation.id,
        automation_type: automation.automation_id,
        execution_id: execution.id
      }
    }
  });

  if (error) throw error;

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

function convertToHtml(text: string): string {
  // Convert line breaks to <br> tags
  let html = text.replace(/\n/g, '<br>');
  
  // Wrap in basic HTML template
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;
}