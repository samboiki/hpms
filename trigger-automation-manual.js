// Script to manually trigger automation engine with service role key
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('Run: export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function triggerAutomationEngine() {
  try {
    console.log('🚀 Triggering automation engine...');
    
    // First check pending automations
    const { data: pendingCount, error: countError } = await supabase
      .from('automation_executions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString());
    
    if (countError) {
      console.error('❌ Error checking pending automations:', countError);
      return;
    }
    
    console.log(`📊 Found ${pendingCount} pending automations`);
    
    // Trigger the automation engine
    const { data, error } = await supabase.functions.invoke('automation-engine', {
      body: { trigger: 'manual' }
    });
    
    if (error) {
      console.error('❌ Error invoking automation engine:', error);
      return;
    }
    
    console.log('✅ Automation engine response:', data);
    
    // Check SMS logs to see if any were sent
    const { data: recentSMS } = await supabase
      .from('practice_sms_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('\n📱 Recent SMS logs:');
    recentSMS?.forEach(sms => {
      console.log(`- ${sms.created_at}: ${sms.status} to ${sms.recipient_phone} (${sms.message_type})`);
    });
    
  } catch (error) {
    console.error('❌ Failed to trigger automation engine:', error);
  }
}

// Run it
triggerAutomationEngine();