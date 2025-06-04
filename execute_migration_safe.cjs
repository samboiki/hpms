const https = require('https');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

function executePostgreSQLDirectly(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'jjxlfunlbyayxwvlpgwt.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: responseData });
        } else {
          resolve({ success: false, error: responseData, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function executeMigrationSections() {
  console.log('🚀 Executing Enhanced Practice Management Migration');
  console.log('==================================================\n');

  const sections = [
    {
      name: 'Enhance practices table',
      sqls: [
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
      ]
    },
    {
      name: 'Create practice_tariffs table',
      sqls: [`
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
      `]
    },
    {
      name: 'Create practice_settings table',
      sqls: [`
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
      `]
    },
    {
      name: 'Create admin_audit_logs table',
      sqls: [`
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
      `]
    },
    {
      name: 'Create practice_analytics table',
      sqls: [`
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
      `]
    }
  ];

  console.log('⚠️  Note: This approach may not work for all DDL operations.');
  console.log('If errors occur, manual execution via Supabase Dashboard is recommended.\n');

  for (const section of sections) {
    console.log(`📋 ${section.name}...`);
    
    for (const sql of section.sqls) {
      const shortSql = sql.replace(/\s+/g, ' ').substring(0, 80) + '...';
      console.log(`   💼 ${shortSql}`);
      
      try {
        const result = await executePostgreSQLDirectly(sql.trim());
        
        if (result.success) {
          console.log('   ✅ Executed successfully');
        } else {
          console.log(`   ❌ Failed (${result.statusCode}): ${result.error}`);
          console.log('   🔄 Consider manual execution in Supabase Dashboard');
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        console.log('   🔄 Consider manual execution in Supabase Dashboard');
      }
    }
    console.log('');
  }

  console.log('📊 FINAL RECOMMENDATION:');
  console.log('========================');
  console.log('For the most reliable execution of this migration:');
  console.log('1. Go to https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new');
  console.log('2. Copy the entire migration file content');
  console.log('3. Paste it into the SQL Editor');
  console.log('4. Execute the entire migration at once');
  console.log('5. This ensures all DDL operations complete successfully\n');
  
  console.log('✅ Migration attempt completed!');
}

executeMigrationSections();