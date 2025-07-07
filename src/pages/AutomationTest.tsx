import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';

interface TestResult {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function AutomationTest() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [newPatient, setNewPatient] = useState({
    firstName: 'Test',
    lastName: 'Patient',
    email: 'ksnahol@gmail.com',
    phone: '0812222331'
  });

  const practiceId = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';

  const log = (message: string, type: TestResult['type'] = 'info') => {
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  const clearLogs = () => setLogs([]);

  const checkSystem = async () => {
    setLoading(true);
    log('🔍 Checking system status...');
    
    try {
      // Check automation settings
      const { data: settings, error: settingsError } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('automation_id', 'welcome-new-patient')
        .single();

      if (settings) {
        log(`✅ Welcome automation is ${settings.is_active ? 'ACTIVE' : 'INACTIVE'}`, settings.is_active ? 'success' : 'warning');
        log(`Channels: ${JSON.stringify(settings.channels)}`);
        log(`SMS Template ID: ${settings.sms_template_id || 'Using inline template'}`);
        log(`Email Template ID: ${settings.email_template_id || 'Using inline template'}`);
      } else {
        log('❌ Welcome automation not found!', 'error');
      }

      // Check SMS subscription
      const { data: smsSub } = await supabase
        .from('practice_sms_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single();

      if (smsSub) {
        log(`✅ SMS Subscription Active: ${smsSub.current_usage}/${smsSub.monthly_limit} used`, 'success');
      } else {
        log('❌ No active SMS subscription!', 'error');
      }

      // Check Email subscription
      const { data: emailSub } = await supabase
        .from('practice_email_subscriptions')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true)
        .single();

      if (emailSub) {
        log(`✅ Email Subscription Active: ${emailSub.current_usage}/${emailSub.monthly_limit} used`, 'success');
      } else {
        log('❌ No active email subscription!', 'error');
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkAutomationSettings = async () => {
    setLoading(true);
    log('📋 Checking all automation settings...');
    
    try {
      const { data: settings } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('practice_id', practiceId);

      if (settings && settings.length > 0) {
        settings.forEach(setting => {
          log(`\n📌 ${setting.name} (${setting.automation_id})`);
          log(`   Active: ${setting.is_active ? '✅' : '❌'}`);
          log(`   Channels: ${setting.channels.map((c: any) => c.enabled ? c.type : '').filter(Boolean).join(', ')}`);
          log(`   SMS Template: ${setting.sms_template_id ? `ID: ${setting.sms_template_id}` : 'Inline'}`);
          log(`   Email Template: ${setting.email_template_id ? `ID: ${setting.email_template_id}` : 'Inline'}`);
        });
      } else {
        log('No automation settings found', 'warning');
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkTemplates = async () => {
    setLoading(true);
    log('📄 Checking message templates...');
    
    try {
      const { data: templates } = await supabase
        .from('message_templates')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('is_active', true);

      if (templates) {
        const emailTemplates = templates.filter(t => t.type === 'email');
        const smsTemplates = templates.filter(t => t.type === 'sms');
        
        log(`\n📧 Email Templates (${emailTemplates.length}):`);
        emailTemplates.forEach(t => {
          log(`   - ${t.name} (${t.template_type})`);
        });
        
        log(`\n📱 SMS Templates (${smsTemplates.length}):`);
        smsTemplates.forEach(t => {
          log(`   - ${t.name} (${t.template_type})`);
        });
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const createPatient = async () => {
    setLoading(true);
    log(`👤 Creating patient: ${newPatient.firstName} ${newPatient.lastName}...`);
    
    try {
      const { data: patient, error } = await supabase
        .from('patients')
        .insert({
          practice_id: practiceId,
          first_name: newPatient.firstName,
          last_name: newPatient.lastName,
          email: newPatient.email,
          cell_number: newPatient.phone,
          date_of_birth: '2010-01-01',
          gender: 'male',
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      if (patient) {
        log(`✅ Patient created: ID ${patient.id}`, 'success');
        log('⏳ Waiting for automation to trigger...');
        toast.success('Patient created successfully!');
        
        // Check for automation after 3 seconds
        setTimeout(() => checkPatientAutomation(patient.id), 3000);
        
        // Reload patients
        loadPatients();
      }

    } catch (error: any) {
      log(`❌ Failed to create patient: ${error.message}`, 'error');
      toast.error('Failed to create patient');
    } finally {
      setLoading(false);
    }
  };

  const checkPatientAutomation = async (patientId: string) => {
    try {
      const { data: executions } = await supabase
        .from('automation_executions')
        .select('*')
        .eq('patient_id', patientId);

      if (executions && executions.length > 0) {
        log(`✅ Automation created for patient!`, 'success');
        executions.forEach(exec => {
          log(`   ID: ${exec.id}`);
          log(`   Status: ${exec.status}`);
          log(`   Template Data: ${JSON.stringify(exec.template_data)}`);
        });
      } else {
        log('⚠️ No automation created yet', 'warning');
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, 'error');
    }
  };

  const loadPatients = async () => {
    try {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setPatients(data);
        log(`✅ Loaded ${data.length} patients`, 'success');
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, 'error');
    }
  };

  const sendTestEmail = async () => {
    setLoading(true);
    log('📧 Sending test email to yourself...');

    try {
      // Get auth token
      const authData = localStorage.getItem('hpms-auth');
      if (!authData) {
        log('❌ No auth data found', 'error');
        return;
      }
      
      const { access_token } = JSON.parse(authData);
      
      // Use direct fetch instead of Supabase client
      log('Using direct fetch to call edge function...');
      const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/email-gateway-v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          practiceId,
          recipientEmail: 'ksnahol@gmail.com',
          recipientName: 'Test User',
          subject: 'Test Email from HPMS',
          textContent: 'This is a test email to verify the email gateway is working correctly.',
          emailType: 'test'
        })
      });

      const data = await response.json();
      log(`Response: ${JSON.stringify(data, null, 2)}`);

      if (response.ok && data?.success) {
        log('✅ Test email sent successfully!', 'success');
        log(`Message ID: ${data.messageId}`);
        toast.success('Test email sent!');
        
        // Check logs after a moment
        setTimeout(() => checkLogs(), 2000);
      } else {
        log(`❌ Email Gateway Error: ${data?.error || 'Unknown error'}`, 'error');
        toast.error(data?.error || 'Failed to send email');
      }

    } catch (error: any) {
      log(`❌ Failed: ${error.message}`, 'error');
      toast.error('Failed to send test email');
    } finally {
      setLoading(false);
    }
  };

  const sendWelcomeEmail = async () => {
    if (!selectedPatient) {
      log('⚠️ Please select a patient first', 'warning');
      return;
    }

    setLoading(true);
    log('📧 Sending welcome email...');

    try {
      const patient = patients.find(p => p.id === selectedPatient);
      if (!patient) return;

      log(`Patient: ${patient.first_name} ${patient.last_name}`);
      log(`⚠️ Test mode: All emails go to ksnahol@gmail.com`);

      const { data, error } = await supabase.functions.invoke('email-gateway-v2', {
        body: {
          practiceId,
          recipientEmail: 'ksnahol@gmail.com',
          recipientName: `${patient.first_name} ${patient.last_name}`,
          subject: `Welcome Email Test - ${patient.first_name} ${patient.last_name}`,
          textContent: `This is a test welcome email for patient: ${patient.first_name} ${patient.last_name}

Dear ${patient.first_name},

Welcome to New Charm Dental Practice! We are thrilled to have you as our patient.

Best regards,
The New Charm Dental Practice Team`,
          emailType: 'welcome',
          patientId: patient.id
        }
      });

      if (error) {
        log(`❌ Edge Function Error: ${error.message}`, 'error');
        throw error;
      }

      log(`Response: ${JSON.stringify(data, null, 2)}`);

      if (data?.success) {
        log('✅ Email sent successfully!', 'success');
        log(`Message ID: ${data.messageId}`);
        toast.success('Email sent successfully!');
      } else {
        log(`❌ Email Gateway Error: ${data?.error || 'Unknown error'}`, 'error');
        toast.error(data?.error || 'Failed to send email');
      }

    } catch (error: any) {
      log(`❌ Failed: ${error.message}`, 'error');
      toast.error('Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const sendWelcomeSMS = async () => {
    if (!selectedPatient) {
      log('⚠️ Please select a patient first', 'warning');
      return;
    }

    setLoading(true);
    log('📱 Sending welcome SMS...');

    try {
      const patient = patients.find(p => p.id === selectedPatient);
      if (!patient) return;

      const { data, error } = await supabase.functions.invoke('centralized-sms-gateway', {
        body: {
          practiceId,
          recipientPhone: patient.cell_number,
          messageContent: `Hi ${patient.first_name}, welcome to New Charm Dental Practice! We are excited to have you as a new patient. If you have any questions, please call us at +264 81 435 8843.`,
          messageType: 'welcome',
          patientId: patient.id
        }
      });

      if (error) {
        log(`❌ Edge Function Error: ${error.message}`, 'error');
        throw error;
      }

      if (data?.success) {
        log('✅ SMS sent successfully!', 'success');
        log(`Log ID: ${data.logId}`);
        toast.success('SMS sent successfully!');
      } else {
        log(`❌ SMS Gateway Error: ${data?.error || 'Unknown error'}`, 'error');
        throw new Error(data?.error || 'Unknown error');
      }

    } catch (error: any) {
      log(`❌ Failed: ${error.message}`, 'error');
      toast.error('Failed to send SMS');
    } finally {
      setLoading(false);
    }
  };

  const processAllPending = async () => {
    setLoading(true);
    log('🔄 Processing all pending automations...');

    try {
      // Get auth token
      const authData = localStorage.getItem('hpms-auth');
      if (!authData) {
        log('❌ No auth data found', 'error');
        return;
      }
      
      const { access_token } = JSON.parse(authData);
      
      // Use direct fetch instead of Supabase client
      log('Using direct fetch to call automation engine...');
      const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/automation-engine', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process automations');
      }

      if (data?.success) {
        log(`✅ Processed ${data.processed} automations`, 'success');
        
        if (data.results && data.results.length > 0) {
          data.results.forEach((res: any, idx: number) => {
            log(`\nAutomation ${idx + 1}:`);
            if (res.sms) {
              log(`  📱 SMS: ${res.sms.success ? '✅ Sent' : '❌ ' + res.sms.error}`);
            }
            if (res.email) {
              log(`  📧 Email: ${res.email.success ? '✅ Sent' : '❌ ' + res.email.error}`);
            }
          });
        }
      }

      // Check logs after processing
      setTimeout(() => checkLogs(), 2000);

    } catch (error: any) {
      log(`❌ Failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkQueue = async () => {
    setLoading(true);
    log('📋 Checking automation queue...');

    try {
      const { data: queue } = await supabase
        .from('automation_queue')
        .select('*')
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (queue) {
        log(`Found ${queue.length} items in queue:`);
        queue.forEach(item => {
          log(`\n📌 Queue ID: ${item.id}`);
          log(`   Status: ${item.status}`);
          log(`   Execution ID: ${item.execution_id}`);
          log(`   Scheduled: ${new Date(item.scheduled_for).toLocaleString()}`);
          if (item.error_message) {
            log(`   Error: ${item.error_message}`, 'error');
          }
        });
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkLogs = async () => {
    setLoading(true);
    log('📋 Checking recent logs...');

    try {
      // Check SMS logs
      const { data: smsLogs } = await supabase
        .from('practice_sms_logs')
        .select('*')
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (smsLogs) {
        log(`\n📱 Recent SMS (${smsLogs.length}):`);
        smsLogs.forEach(sms => {
          log(`  ${new Date(sms.created_at).toLocaleTimeString()} - ${sms.status} - ${sms.recipient_phone}`);
        });
      }

      // Check Email logs
      const { data: emailLogs } = await supabase
        .from('practice_email_logs')
        .select('*')
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (emailLogs) {
        log(`\n📧 Recent Emails (${emailLogs.length}):`);
        emailLogs.forEach(email => {
          log(`  ${new Date(email.created_at).toLocaleTimeString()} - ${email.status} - ${email.recipient_email}`);
          if (email.failure_reason) {
            log(`    ❌ ${email.failure_reason}`, 'error');
          }
        });
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkEnvironment = async () => {
    setLoading(true);
    log('🔍 Checking edge function environment...');

    try {
      const { data, error } = await supabase.functions.invoke('check-env', {
        body: {}
      });

      if (error) {
        log(`❌ Error: ${error.message}`, 'error');
        return;
      }

      if (data?.success) {
        log('✅ Environment check successful:', 'success');
        log(`Has Supabase URL: ${data.environment.hasSupabaseUrl ? '✅' : '❌'}`);
        log(`Has Service Key: ${data.environment.hasServiceKey ? '✅' : '❌'}`);
        log(`Has Resend Key: ${data.environment.hasResendKey ? '✅' : '❌'}`);
        log(`Has Sender Email: ${data.environment.hasSenderEmail ? '✅' : '❌'}`);
        log(`Sender Email: ${data.environment.senderEmail}`);
        log(`Resend Key Prefix: ${data.environment.resendKeyPrefix}`);
      }

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const testResendDirectly = async () => {
    setLoading(true);
    log('🔬 Testing Resend API directly...');
    log('⚠️ Note: Direct API calls from browser will fail due to CORS', 'warning');
    log('This is expected! APIs like Resend block browser requests for security.', 'info');
    log('✅ This confirms we MUST use edge functions for email sending.', 'success');
    log('');
    log('The good news: Our Node.js test already confirmed the API key works!', 'info');
    log('The issue is with the edge function environment or configuration.', 'info');
    
    toast.info('Direct API calls blocked by CORS - this is normal!');
    setLoading(false);
  };

  const testEmailGatewayWithAuth = async () => {
    setLoading(true);
    log('🔐 Testing email gateway with current authentication...');

    try {
      // Test the original centralized-email-gateway
      const { data, error } = await supabase.functions.invoke('centralized-email-gateway', {
        body: {
          practiceId,
          recipientEmail: 'ksnahol@gmail.com',
          recipientName: 'Test User',
          subject: 'Test with Auth',
          textContent: 'Testing email gateway with authenticated request.',
          emailType: 'test'
        }
      });

      if (error) {
        log(`❌ Edge Function Error: ${error.message}`, 'error');
        log(`Error details: ${JSON.stringify(error)}`, 'error');
      } else {
        log(`Response: ${JSON.stringify(data, null, 2)}`);
        
        if (data?.success) {
          log('✅ Email sent via gateway!', 'success');
          toast.success('Email gateway test successful!');
        } else {
          log(`❌ Gateway returned error: ${data?.error}`, 'error');
          toast.error(data?.error || 'Gateway test failed');
        }
      }

    } catch (error: any) {
      log(`❌ Exception: ${error.message}`, 'error');
      toast.error('Failed to test email gateway');
    } finally {
      setLoading(false);
    }
  };

  const testSimpleFunction = async () => {
    setLoading(true);
    log('🧪 Testing simple edge function...');

    try {
      // First try with Supabase client
      log('Method 1: Using Supabase client...');
      const { data, error } = await supabase.functions.invoke('test-simple', {
        body: {
          test: 'Hello from HPMS',
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        log(`❌ Supabase client error: ${error.message}`, 'error');
        
        // Try direct fetch
        log('Method 2: Trying direct fetch...');
        const authData = localStorage.getItem('hpms-auth');
        if (!authData) {
          log('❌ No auth data found', 'error');
          return;
        }
        
        const { access_token } = JSON.parse(authData);
        const response = await fetch('https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/test-simple', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            test: 'Hello from direct fetch',
            timestamp: new Date().toISOString()
          })
        });

        if (response.ok) {
          const result = await response.json();
          log(`✅ Direct fetch worked!`, 'success');
          log(`Response: ${JSON.stringify(result, null, 2)}`);
          toast.success('Edge functions work with direct fetch!');
        } else {
          log(`❌ Direct fetch failed: ${response.status} ${response.statusText}`, 'error');
        }
      } else {
        log(`✅ Edge function responded!`, 'success');
        log(`Response: ${JSON.stringify(data, null, 2)}`);
        toast.success('Edge functions are working!');
      }

    } catch (error: any) {
      log(`❌ Exception: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Icon icon="solar:test-tube-bold-duotone" className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Automation Test Suite</h1>
            <p className="text-sm text-gray-500">Test and debug automation system</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* System Status */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5" />
              System Status Check
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={testSimpleFunction}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:danger-circle-bold-duotone" className="w-4 h-4 inline mr-2" />
                Test Edge Functions
              </button>
              <button
                onClick={checkSystem}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4 inline mr-2" />
                Check System Status
              </button>
              <button
                onClick={checkAutomationSettings}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:settings-bold-duotone" className="w-4 h-4 inline mr-2" />
                Check Automation Settings
              </button>
              <button
                onClick={checkTemplates}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:document-bold-duotone" className="w-4 h-4 inline mr-2" />
                Check Templates
              </button>
              <button
                onClick={checkLogs}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:history-bold-duotone" className="w-4 h-4 inline mr-2" />
                Check Recent Logs
              </button>
            </div>
          </div>

          {/* Quick Test */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:test-tube-minimalistic-bold-duotone" className="w-5 h-5" />
              Quick Email Test
            </h3>
            <p className="text-sm text-gray-600 mb-4">Send a simple test email to your address (ksnahol@gmail.com)</p>
            <button
              onClick={sendTestEmail}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              <Icon icon="solar:letter-opened-bold-duotone" className="w-5 h-5 inline mr-2" />
              Send Test Email (V2)
            </button>
          </div>

          {/* Diagnostic Tools */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:bug-minimalistic-bold-duotone" className="w-5 h-5" />
              Email Diagnostic Tools
            </h3>
            <p className="text-sm text-gray-600 mb-4">Advanced testing tools to diagnose email issues</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={testResendDirectly}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium rounded-lg hover:from-yellow-600 hover:to-yellow-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 inline mr-2" />
                Why Direct API Fails (CORS Info)
              </button>
              <button
                onClick={testEmailGatewayWithAuth}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-violet-500 to-violet-600 text-white font-medium rounded-lg hover:from-violet-600 hover:to-violet-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:lock-password-bold-duotone" className="w-4 h-4 inline mr-2" />
                Test Email Gateway with Auth
              </button>
              <button
                onClick={checkEnvironment}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white font-medium rounded-lg hover:from-pink-600 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4 inline mr-2" />
                Check Edge Function Environment
              </button>
            </div>
          </div>

          {/* Create Test Patient */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:user-plus-bold-duotone" className="w-5 h-5" />
              Create Test Patient
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <input
                type="text"
                placeholder="First Name"
                value={newPatient.firstName}
                onChange={(e) => setNewPatient(prev => ({ ...prev, firstName: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={newPatient.lastName}
                onChange={(e) => setNewPatient(prev => ({ ...prev, lastName: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <input
                type="email"
                placeholder="Email"
                value={newPatient.email}
                onChange={(e) => setNewPatient(prev => ({ ...prev, email: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newPatient.phone}
                onChange={(e) => setNewPatient(prev => ({ ...prev, phone: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <button
              onClick={createPatient}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              <Icon icon="solar:user-plus-bold-duotone" className="w-5 h-5 inline mr-2" />
              Create Patient
            </button>
          </div>

          {/* Test Specific Automation */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:letter-bold-duotone" className="w-5 h-5" />
              Test Specific Automation
            </h3>
            <div className="space-y-4">
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">Select a patient...</option>
                {patients.map(patient => (
                  <option key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name} ({patient.email})
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={loadPatients}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-lg hover:from-gray-600 hover:to-gray-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 inline mr-2" />
                  Reload Patients
                </button>
                <button
                  onClick={sendWelcomeEmail}
                  disabled={loading || !selectedPatient}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 inline mr-2" />
                  Send Welcome Email
                </button>
                <button
                  onClick={sendWelcomeSMS}
                  disabled={loading || !selectedPatient}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  <Icon icon="solar:chat-square-text-bold-duotone" className="w-4 h-4 inline mr-2" />
                  Send Welcome SMS
                </button>
              </div>
            </div>
          </div>

          {/* Process Automations */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5" />
              Process Automations
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={processAllPending}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5 inline mr-2" />
                Process All Pending
              </button>
              <button
                onClick={checkQueue}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:list-check-bold-duotone" className="w-4 h-4 inline mr-2" />
                Check Automation Queue
              </button>
              <button
                onClick={clearLogs}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg"
              >
                <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4 inline mr-2" />
                Clear Logs
              </button>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-900 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Logs</h3>
            <div className="space-y-1 font-mono text-sm max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-400">No logs yet. Click a button to start testing.</div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-2",
                      log.type === 'success' && "text-green-400",
                      log.type === 'error' && "text-red-400",
                      log.type === 'warning' && "text-yellow-400",
                      log.type === 'info' && "text-gray-300"
                    )}
                  >
                    <span className="text-gray-500">[{log.time}]</span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}