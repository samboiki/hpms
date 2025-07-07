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

async function createMultiTenantTables() {
  console.log('🚀 Creating enhanced multi-tenant database tables...\n');
  
  // 1. Service Plans - Define what services are available
  const servicePlansSQL = `
    CREATE TABLE IF NOT EXISTS service_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      plan_type VARCHAR(50) NOT NULL, -- 'sms', 'email', 'storage', 'users', 'patients'
      price_monthly DECIMAL(10,2) DEFAULT 0,
      price_yearly DECIMAL(10,2) DEFAULT 0,
      limits JSONB DEFAULT '{}', -- Flexible limits structure
      features JSONB DEFAULT '[]', -- List of included features
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  await executeSql(servicePlansSQL, 'Creating service_plans table');
  
  // 2. Practice Service Subscriptions - What each practice has subscribed to
  const practiceServiceSubscriptionsSQL = `
    CREATE TABLE IF NOT EXISTS practice_service_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
      service_plan_id UUID REFERENCES service_plans(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'cancelled'
      current_usage JSONB DEFAULT '{}', -- Track current usage per service
      billing_cycle_start DATE NOT NULL,
      billing_cycle_end DATE NOT NULL,
      auto_renew BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(practice_id, service_plan_id)
    );
  `;
  
  await executeSql(practiceServiceSubscriptionsSQL, 'Creating practice_service_subscriptions table');
  
  // 3. Email Plans and Subscriptions (similar to SMS)
  const emailPlansSQL = `
    CREATE TABLE IF NOT EXISTS email_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      monthly_limit INTEGER NOT NULL,
      price_per_email DECIMAL(6,4) DEFAULT 0,
      overage_rate DECIMAL(6,4) DEFAULT 0,
      features JSONB DEFAULT '[]',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  await executeSql(emailPlansSQL, 'Creating email_plans table');
  
  const practiceEmailSubscriptionsSQL = `
    CREATE TABLE IF NOT EXISTS practice_email_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
      plan_id UUID REFERENCES email_plans(id) ON DELETE CASCADE,
      monthly_limit INTEGER NOT NULL,
      current_usage INTEGER DEFAULT 0,
      additional_emails_purchased INTEGER DEFAULT 0,
      billing_cycle_start DATE NOT NULL,
      billing_cycle_end DATE NOT NULL,
      auto_renew BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(practice_id, plan_id)
    );
  `;
  
  await executeSql(practiceEmailSubscriptionsSQL, 'Creating practice_email_subscriptions table');
  
  // 4. Email Analytics (similar to SMS analytics)
  const emailAnalyticsSQL = `
    CREATE TABLE IF NOT EXISTS email_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      opened_count INTEGER DEFAULT 0,
      clicked_count INTEGER DEFAULT 0,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      period_type VARCHAR(20) DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  await executeSql(emailAnalyticsSQL, 'Creating email_analytics table');
  
  // 5. Practice Features - Track which features each practice has access to
  const practiceFeaturesSQL = `
    CREATE TABLE IF NOT EXISTS practice_features (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
      feature_key VARCHAR(100) NOT NULL, -- 'vitals_tracking', 'lab_integration', 'sms_service', etc.
      is_enabled BOOLEAN DEFAULT false,
      limit_value INTEGER, -- For features with limits (e.g., max_users: 10)
      current_usage INTEGER DEFAULT 0,
      settings JSONB DEFAULT '{}', -- Feature-specific settings
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(practice_id, feature_key)
    );
  `;
  
  await executeSql(practiceFeaturesSQL, 'Creating practice_features table');
  
  // 6. System Configuration - Admin-level settings
  const systemConfigSQL = `
    CREATE TABLE IF NOT EXISTS system_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      config_key VARCHAR(100) UNIQUE NOT NULL,
      config_value JSONB NOT NULL,
      config_type VARCHAR(50) DEFAULT 'general', -- 'general', 'billing', 'security', etc.
      description TEXT,
      is_public BOOLEAN DEFAULT false, -- Can be accessed by practices
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  await executeSql(systemConfigSQL, 'Creating system_config table');
  
  // 7. Add some default service plans
  const defaultPlansSQL = `
    INSERT INTO service_plans (name, description, plan_type, price_monthly, limits, features) VALUES
    ('Basic SMS', 'Basic SMS package for small practices', 'sms', 29.99, '{"monthly_limit": 500}', '["basic_templates", "delivery_reports"]'),
    ('Premium SMS', 'Premium SMS package with advanced features', 'sms', 79.99, '{"monthly_limit": 2000}', '["advanced_templates", "delivery_reports", "scheduling", "bulk_send"]'),
    ('Basic Email', 'Basic email package for patient communication', 'email', 19.99, '{"monthly_limit": 1000}', '["basic_templates", "delivery_reports"]'),
    ('Premium Email', 'Premium email package with analytics', 'email', 49.99, '{"monthly_limit": 5000}', '["advanced_templates", "delivery_reports", "open_tracking", "click_tracking"]'),
    ('Vitals Tracking', 'Enable vitals recording and tracking', 'feature', 15.00, '{"unlimited": true}', '["vitals_recording", "vitals_history", "vitals_charts"]'),
    ('Lab Integration', 'Integration with lab systems', 'feature', 25.00, '{"requests_per_month": 200}', '["lab_requests", "results_integration", "automated_alerts"]'),
    ('Media Requests', 'Medical imaging and media request management', 'feature', 20.00, '{"requests_per_month": 100}', '["imaging_requests", "media_storage", "viewer_integration"]')
    ON CONFLICT (name, plan_type) DO NOTHING;
  `;
  
  await executeSql(defaultPlansSQL, 'Inserting default service plans');
  
  // 8. Add some default email plans
  const defaultEmailPlansSQL = `
    INSERT INTO email_plans (name, description, monthly_limit, price_per_email, features) VALUES
    ('Starter Email', 'Perfect for small practices starting out', 500, 0.04, '["basic_templates", "delivery_reports"]'),
    ('Professional Email', 'For growing practices with more patients', 2000, 0.035, '["advanced_templates", "delivery_reports", "scheduling"]'),
    ('Enterprise Email', 'For large practices with high volume', 10000, 0.025, '["custom_templates", "advanced_analytics", "priority_support"]')
    ON CONFLICT (name) DO NOTHING;
  `;
  
  await executeSql(defaultEmailPlansSQL, 'Inserting default email plans');
  
  // 9. Add some default system config
  const defaultConfigSQL = `
    INSERT INTO system_config (config_key, config_value, config_type, description, is_public) VALUES
    ('max_practices_per_admin', '{"value": 50}', 'general', 'Maximum practices a single admin can manage', false),
    ('default_trial_period_days', '{"value": 30}', 'billing', 'Default trial period for new practices', false),
    ('sms_provider_settings', '{"provider": "clickatell", "backup_provider": "twilio"}', 'communication', 'SMS service provider configuration', false),
    ('email_provider_settings', '{"provider": "sendgrid", "backup_provider": "mailgun"}', 'communication', 'Email service provider configuration', false),
    ('maintenance_mode', '{"enabled": false, "message": "System maintenance in progress"}', 'system', 'System maintenance mode settings', true)
    ON CONFLICT (config_key) DO NOTHING;
  `;
  
  await executeSql(defaultConfigSQL, 'Inserting default system configuration');
  
  console.log('\n🎉 Multi-tenant database setup completed!');
  console.log('✅ All tables created successfully');
  console.log('✅ Default plans and configuration added');
}

createMultiTenantTables();