import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function executeSql(sql, description = '') {
  console.log('🔗 MCP SQL Executor');
  console.log(`📝 ${description}`);
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: sql
    });
    
    if (error) {
      console.log('❌ SQL execution failed:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    return { success: true, result: data };
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    return { success: false, error: error.message };
  }
}

async function insertDefaultData() {
  console.log('🚀 Inserting default data...\n');
  
  // Check if data already exists
  const checkPlansSQL = `SELECT COUNT(*) as count FROM service_plans;`;
  const checkResult = await executeSql(checkPlansSQL, 'Checking existing service plans');
  
  if (checkResult.success && checkResult.result.includes('0')) {
    // Insert default service plans
    const defaultPlansSQL = `
      INSERT INTO service_plans (name, description, plan_type, price_monthly, limits, features) VALUES
      ('Basic SMS', 'Basic SMS package for small practices', 'sms', 29.99, '{"monthly_limit": 500}', '["basic_templates", "delivery_reports"]'),
      ('Premium SMS', 'Premium SMS package with advanced features', 'sms', 79.99, '{"monthly_limit": 2000}', '["advanced_templates", "delivery_reports", "scheduling", "bulk_send"]'),
      ('Basic Email', 'Basic email package for patient communication', 'email', 19.99, '{"monthly_limit": 1000}', '["basic_templates", "delivery_reports"]'),
      ('Premium Email', 'Premium email package with analytics', 'email', 49.99, '{"monthly_limit": 5000}', '["advanced_templates", "delivery_reports", "open_tracking", "click_tracking"]'),
      ('Vitals Tracking', 'Enable vitals recording and tracking', 'feature', 15.00, '{"unlimited": true}', '["vitals_recording", "vitals_history", "vitals_charts"]'),
      ('Lab Integration', 'Integration with lab systems', 'feature', 25.00, '{"requests_per_month": 200}', '["lab_requests", "results_integration", "automated_alerts"]'),
      ('Media Requests', 'Medical imaging and media request management', 'feature', 20.00, '{"requests_per_month": 100}', '["imaging_requests", "media_storage", "viewer_integration"]');
    `;
    
    await executeSql(defaultPlansSQL, 'Inserting default service plans');
  } else {
    console.log('⏭️ Service plans already exist, skipping...');
  }
  
  // Check email plans
  const checkEmailPlansSQL = `SELECT COUNT(*) as count FROM email_plans;`;
  const checkEmailResult = await executeSql(checkEmailPlansSQL, 'Checking existing email plans');
  
  if (checkEmailResult.success && checkEmailResult.result.includes('0')) {
    const defaultEmailPlansSQL = `
      INSERT INTO email_plans (name, description, monthly_limit, price_per_email, features) VALUES
      ('Starter Email', 'Perfect for small practices starting out', 500, 0.04, '["basic_templates", "delivery_reports"]'),
      ('Professional Email', 'For growing practices with more patients', 2000, 0.035, '["advanced_templates", "delivery_reports", "scheduling"]'),
      ('Enterprise Email', 'For large practices with high volume', 10000, 0.025, '["custom_templates", "advanced_analytics", "priority_support"]');
    `;
    
    await executeSql(defaultEmailPlansSQL, 'Inserting default email plans');
  } else {
    console.log('⏭️ Email plans already exist, skipping...');
  }
  
  console.log('\n🎉 Default data insertion completed!');
}

insertDefaultData();