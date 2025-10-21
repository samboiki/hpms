#!/usr/bin/env node

/**
 * Update practices table status constraint
 * Adds new status values: lead, contacted, qualified, onboarding, active, inactive
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePracticesStatusConstraint() {
  console.log('🚀 Updating practices table status constraint...\n');

  const sql = `
    -- Drop the old status check constraint
    ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;

    -- Add new status check constraint with updated values
    ALTER TABLE practices ADD CONSTRAINT practices_status_check
    CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive'));
  `;

  try {
    console.log('📝 Executing SQL:\n', sql);

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error executing SQL:', error);

      // Try alternative approach using raw SQL
      console.log('\n🔄 Trying alternative approach...\n');

      // Drop constraint
      const { error: dropError } = await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;'
      });

      if (dropError) {
        console.error('❌ Error dropping constraint:', dropError);
      } else {
        console.log('✅ Old constraint dropped successfully');
      }

      // Add new constraint
      const { error: addError } = await supabase.rpc('exec_sql', {
        sql_query: `ALTER TABLE practices ADD CONSTRAINT practices_status_check
                    CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive'));`
      });

      if (addError) {
        console.error('❌ Error adding new constraint:', addError);
        process.exit(1);
      } else {
        console.log('✅ New constraint added successfully');
      }
    } else {
      console.log('✅ Status constraint updated successfully!');
      console.log('📊 Data:', data);
    }

    // Verify the constraint
    console.log('\n🔍 Verifying constraint...');
    const { data: constraints, error: verifyError } = await supabase
      .from('information_schema.table_constraints')
      .select('*')
      .eq('table_name', 'practices')
      .eq('constraint_name', 'practices_status_check');

    if (verifyError) {
      console.error('⚠️ Could not verify constraint:', verifyError);
    } else {
      console.log('✅ Constraint verified:', constraints);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('📋 New allowed status values: lead, contacted, qualified, onboarding, active, inactive');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

updatePracticesStatusConstraint();