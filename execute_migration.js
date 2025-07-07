import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql, description) {
  console.log(`   Executing: ${description}`);
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
      // Try alternative approach with direct query
      const { data: altData, error: altError } = await supabase.rpc('sql', { query: sql });
      if (altError) throw altError;
      return altData;
    }
    return data;
  } catch (err) {
    console.error(`   ❌ Failed: ${description}`, err);
    throw err;
  }
}

async function executeMigration() {
  console.log('🚀 Starting Enhanced Practice Management migration...\n');

  try {
    // Section 1: Enhance practices table
    console.log('✅ SECTION 1: Enhancing practices table...');
    
    const practiceAlterations = [
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending'))",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'standard' CHECK (subscription_tier IN ('trial', 'standard', 'premium', 'enterprise'))",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 10",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS max_patients INTEGER DEFAULT 1000",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Windhoek'",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'NAD'",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50)",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS license_number VARCHAR(50)",
      "ALTER TABLE practices ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES users(id)"
    ];

    for (const sql of practiceAlterations) {
      await executeSQL(sql, 'Enhancing practices table');
    }
    console.log('   ✓ Practices table enhanced successfully\n');

    // Section 2: Create practice_tariffs table
    console.log('✅ SECTION 2: Creating practice_tariffs table...');
    const tariffsSQL = `
      CREATE TABLE IF NOT EXISTS practice_tariffs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
        service_name VARCHAR(255) NOT NULL,
        service_code VARCHAR(50),
        category VARCHAR(100),
        description TEXT,
        base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'NAD',
        is_active BOOLEAN DEFAULT true,
        medical_aid_pricing JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(practice_id, service_code)
      )
    `;
    
    await executeSQL(tariffsSQL, 'Creating practice_tariffs table');
    console.log('   ✓ Practice tariffs table created successfully\n');

    // Section 3: Create practice_settings table
    console.log('✅ SECTION 3: Creating practice_settings table...');
    const settingsSQL = `
      CREATE TABLE IF NOT EXISTS practice_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
        setting_key VARCHAR(100) NOT NULL,
        setting_value JSONB,
        setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array')),
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(practice_id, setting_key)
      )
    `;
    
    await executeSQL(settingsSQL, 'Creating practice_settings table');
    console.log('   ✓ Practice settings table created successfully\n');

    // Section 4: Create admin_audit_logs table
    console.log('✅ SECTION 4: Creating admin_audit_logs table...');
    const auditSQL = `
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_user_id UUID NOT NULL REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id UUID,
        target_practice_id UUID REFERENCES practices(id),
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    await executeSQL(auditSQL, 'Creating admin_audit_logs table');
    console.log('   ✓ Admin audit logs table created successfully\n');

    // Section 5: Create practice_analytics table
    console.log('✅ SECTION 5: Creating practice_analytics table...');
    const analyticsSQL = `
      CREATE TABLE IF NOT EXISTS practice_analytics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
        period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        total_appointments INTEGER DEFAULT 0,
        completed_appointments INTEGER DEFAULT 0,
        cancelled_appointments INTEGER DEFAULT 0,
        new_patients INTEGER DEFAULT 0,
        total_revenue DECIMAL(12,2) DEFAULT 0,
        total_visits INTEGER DEFAULT 0,
        active_users INTEGER DEFAULT 0,
        metrics JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(practice_id, period_type, period_start)
      )
    `;
    
    await executeSQL(analyticsSQL, 'Creating practice_analytics table');
    console.log('   ✓ Practice analytics table created successfully\n');

    console.log('🎉 Migration Phase 1 completed successfully!');
    console.log('Core tables have been created. Continuing with remaining sections...\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

executeMigration();