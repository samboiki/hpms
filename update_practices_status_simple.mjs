#!/usr/bin/env node

/**
 * Update practices table status constraint using Supabase Management API
 * Adds new status values: lead, contacted, qualified, onboarding, active, inactive
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROJECT_REF = 'jjxlfunlbyayxwvlpgwt';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const SQL_COMMANDS = [
  {
    name: 'Drop old constraint',
    sql: 'ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;'
  },
  {
    name: 'Add new constraint',
    sql: `ALTER TABLE practices ADD CONSTRAINT practices_status_check CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive'));`
  }
];

async function executeSql(sql, description) {
  console.log(`\n🔧 ${description}...`);
  console.log(`📝 SQL: ${sql}\n`);

  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql_query: sql })
    });

    const responseText = await response.text();
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response: ${responseText}`);

    if (!response.ok) {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`✅ ${description} - Success!`);
    return true;
  } catch (error) {
    console.error(`❌ Error during ${description}:`, error.message);
    return false;
  }
}

async function updatePracticesStatusConstraint() {
  console.log('🚀 UPDATING PRACTICES TABLE STATUS CONSTRAINT');
  console.log('=' .repeat(60));
  console.log('📋 Project: jjxlfunlbyayxwvlpgwt');
  console.log('📋 New status values: lead, contacted, qualified, onboarding, active, inactive');
  console.log('=' .repeat(60));

  for (const command of SQL_COMMANDS) {
    const success = await executeSql(command.sql, command.name);
    if (!success) {
      console.error(`\n❌ Migration failed at step: ${command.name}`);
      process.exit(1);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('=' .repeat(60));
  console.log('📋 Status constraint updated with new values:');
  console.log('   - lead');
  console.log('   - contacted');
  console.log('   - qualified');
  console.log('   - onboarding');
  console.log('   - active');
  console.log('   - inactive');
  console.log('=' .repeat(60));
}

updatePracticesStatusConstraint();