const fs = require('fs');
const path = require('path');

function compileSchemaFromMigrations() {
  console.log('🔄 Compiling schema from migration files and SQL scripts...');
  
  const timestamp = new Date().toISOString().split('T')[0];
  let compiledSchema = `-- ============================================
-- HPMS Database Schema Compilation
-- Compiled from migration files and SQL scripts
-- Generated on: ${new Date().toISOString()}
-- Database: PostgreSQL (Supabase)
-- Password: T@ngisasa200
-- ============================================

`;

  // Read supabase migrations
  const migrationsDir = './supabase/migrations';
  console.log('📋 Reading Supabase migrations...');
  
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    compiledSchema += `\n-- ============================================\n-- SUPABASE MIGRATIONS (${migrationFiles.length} files)\n-- ============================================\n\n`;
    
    migrationFiles.forEach(file => {
      console.log(`  📄 Processing: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      compiledSchema += `-- Migration: ${file}\n`;
      compiledSchema += `-- File: ${filePath}\n`;
      compiledSchema += content + '\n\n';
    });
  }

  // Read standalone SQL files in root directory
  console.log('📋 Reading standalone SQL files...');
  const sqlFiles = [
    'ADD_DOCUMENT_TITLE_FIELD.sql',
    'ADD_MEDICAL_AID_REFERENCES.sql',
    'BUCKET_VISIBILITY_FIX.sql',
    'COMPLETE_BILLING_SYSTEM_FIX.sql',
    'COMPLETE_DENTAL_MIGRATION.sql',
    'COMPLETE_MIGRATION_EXECUTE_IN_SUPABASE.sql',
    'CREATE_DOCUMENTS_TABLE_IN_SUPABASE.sql',
    'CREATE_FREQUENT_CODES_VIEW.sql',
    'CREATE_MEDICAL_AID_BUCKET_AND_UPDATE_PROVIDERS.sql',
    'CREATE_STORAGE_POLICIES_FOR_DOCUMENTS.sql',
    'DEBUG_USER_PRACTICE_RELATIONSHIP.sql',
    'EMERGENCY_DISABLE_RLS.sql',
    'EXECUTE_PRACTICE_TYPES_SQL.sql',
    'EXECUTE_THIS_SQL_IN_SUPABASE.sql',
    'EXECUTE_THIS_SQL_NOW.sql',
    'EXECUTE_THIS_SQL_TO_FIX_BILLING.sql',
    'FINAL_ADMIN_SETUP.sql',
    'FIXED_SIMPLE_BILLING_FIX.sql',
    'FIX_BILLING_TABLES_NOW.sql',
    'FIX_DOCUMENTS_PERMISSIONS_FOR_FRONTEND.sql',
    'FIX_DOCUMENTS_RLS_POLICY.sql',
    'FIX_EXISTING_TOTALS.sql',
    'LINK_ADMIN_USERS_IN_SUPABASE.sql',
    'NEWCHARM_FINAL_MIGRATION.sql',
    'NEWCHARM_MIGRATION_CORRECTED.sql',
    'NEWCHARM_WITH_LOCAL_IMAGES.sql',
    'NEWCHARM_WITH_STOCK_IMAGES.sql',
    'NUCLEAR_BILLING_FIX.sql',
    'SIMPLE_BILLING_FIX.sql',
    'STEP1_ADD_COLUMNS.sql',
    'STEP1_ADD_COLUMNS_SAFE.sql',
    'STEP2_CLEAR_AND_INSERT_DATA.sql',
    'STEP2_INSERT_DATA_COMPLETE.sql',
    'STEP2_INSERT_DATA_SIMPLE.sql',
    'STEP2_INSERT_DATA_WITH_PRACTICE_ID.sql',
    'TEST_BILLING_SYSTEM.sql',
    'ULTRA_SIMPLE_BILLING_FIX.sql',
    'UPDATE_BATCH_SYSTEM_FOR_EXISTING_TABLES.sql',
    'UPDATE_COMPONENT_FOR_VIEW.sql',
    'add_ready_status_column.sql',
    'apply_ai_search_migrations.sql',
    'apply_multi_tenant_migration.sql',
    'check_appointment_practice.sql',
    'check_practices_table.sql',
    'cleanup_appointments_without_doctors.sql',
    'create-storage-bucket.sql',
    'create_documents_table.sql',
    'create_medical_aid_providers_table.sql',
    'create_onehealth_admin_complete.sql',
    'create_onehealth_admins_simple.sql',
    'create_onehealth_super_admin.sql',
    'create_onehealth_super_admin_fixed.sql',
    'create_supabase_admin_users.sql',
    'fix-appointments-rls.sql',
    'fix-practice-tariffs-rls.sql',
    'fix_dr_polina_slug.sql',
    'fix_medical_aid_rls.sql',
    'fix_pending_appointments.sql',
    'fix_practices_rls.sql',
    'import-179-dental-codes-supabase-cli.sql',
    'import_comprehensive_dental_tariffs.sql',
    'import_dental_tariffs.sql',
    'import_dental_tariffs_supabase.sql',
    'insert_dr_polina_practice.sql',
    'insert_dr_polina_simple.sql',
    'insert_medical_aid_data.sql',
    'populate-batches-from-existing-invoices.sql',
    'sample_medical_aid_insert.sql',
    'setup_sms_management.sql',
    'sms_management_functions.sql',
    'test_create_pending_appointment.sql',
    'test_practice_query.sql',
    'update-medical-aid-logos.sql',
    'update_appointment_statuses.sql',
    'update_drpolina_passwords.sql'
  ];

  const existingSqlFiles = sqlFiles.filter(file => fs.existsSync(file));
  
  if (existingSqlFiles.length > 0) {
    compiledSchema += `\n-- ============================================\n-- STANDALONE SQL FILES (${existingSqlFiles.length} files)\n-- ============================================\n\n`;
    
    existingSqlFiles.forEach(file => {
      console.log(`  📄 Processing: ${file}`);
      try {
        const content = fs.readFileSync(file, 'utf8');
        compiledSchema += `-- File: ${file}\n`;
        compiledSchema += content + '\n\n';
      } catch (error) {
        console.log(`  ⚠️  Could not read ${file}: ${error.message}`);
      }
    });
  }

  // Read landing migrations
  const landingMigrationsDir = './hpms-landing/supabase/migrations';
  if (fs.existsSync(landingMigrationsDir)) {
    console.log('📋 Reading landing migrations...');
    const landingFiles = fs.readdirSync(landingMigrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (landingFiles.length > 0) {
      compiledSchema += `\n-- ============================================\n-- LANDING MIGRATIONS (${landingFiles.length} files)\n-- ============================================\n\n`;
      
      landingFiles.forEach(file => {
        console.log(`  📄 Processing: ${file}`);
        const filePath = path.join(landingMigrationsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        compiledSchema += `-- Landing Migration: ${file}\n`;
        compiledSchema += content + '\n\n';
      });
    }
  }

  // Read OneHealth migrations
  const oneHealthMigrationsDir = './onehealth/supabase/migrations';
  if (fs.existsSync(oneHealthMigrationsDir)) {
    console.log('📋 Reading OneHealth migrations...');
    const oneHealthFiles = fs.readdirSync(oneHealthMigrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (oneHealthFiles.length > 0) {
      compiledSchema += `\n-- ============================================\n-- ONEHEALTH MIGRATIONS (${oneHealthFiles.length} files)\n-- ============================================\n\n`;
      
      oneHealthFiles.forEach(file => {
        console.log(`  📄 Processing: ${file}`);
        const filePath = path.join(oneHealthMigrationsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        compiledSchema += `-- OneHealth Migration: ${file}\n`;
        compiledSchema += content + '\n\n';
      });
    }
  }

  // Add database configuration info
  compiledSchema += `\n-- ============================================\n-- DATABASE CONNECTION INFORMATION\n-- ============================================\n\n`;
  compiledSchema += `-- Host: db.jjxlfunlbyayxwvlpgwt.supabase.co\n`;
  compiledSchema += `-- Port: 5432\n`;
  compiledSchema += `-- Database: postgres\n`;
  compiledSchema += `-- User: postgres\n`;
  compiledSchema += `-- Password: T@ngisasa200\n`;
  compiledSchema += `-- URL: https://jjxlfunlbyayxwvlpgwt.supabase.co\n\n`;

  // Add summary
  compiledSchema += `\n-- ============================================\n-- COMPILATION SUMMARY\n-- ============================================\n\n`;
  compiledSchema += `-- Total files processed: ${existingSqlFiles.length + (fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).length : 0)}\n`;
  compiledSchema += `-- Compilation date: ${new Date().toISOString()}\n`;
  compiledSchema += `-- Source directories:\n`;
  compiledSchema += `--   - ./supabase/migrations/ (Main migrations)\n`;
  compiledSchema += `--   - ./hpms-landing/supabase/migrations/ (Landing page migrations)\n`;
  compiledSchema += `--   - ./onehealth/supabase/migrations/ (OneHealth admin migrations)\n`;
  compiledSchema += `--   - ./ (Standalone SQL files)\n\n`;

  // Write compiled schema
  const filename = `hpms_compiled_schema_${timestamp}.sql`;
  fs.writeFileSync(filename, compiledSchema);
  
  console.log(`\n✅ Schema compilation completed!`);
  console.log(`📄 File: ${filename}`);
  console.log(`📊 Total SQL files processed: ${existingSqlFiles.length}`);
  console.log(`💾 File size: ${(fs.statSync(filename).size / 1024 / 1024).toFixed(2)} MB`);

  // Create a summary JSON file
  const summary = {
    compilation_date: new Date().toISOString(),
    total_files: existingSqlFiles.length,
    files_processed: existingSqlFiles,
    database_info: {
      host: 'db.jjxlfunlbyayxwvlpgwt.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      url: 'https://jjxlfunlbyayxwvlpgwt.supabase.co'
    },
    export_files: [
      filename,
      `export_hpms_schema_${timestamp}.sh`,
      `export_hpms_schema_${timestamp}.bat`,
      `hpms_schema_queries_${timestamp}.sql`
    ]
  };

  const summaryFilename = `hpms_compilation_summary_${timestamp}.json`;
  fs.writeFileSync(summaryFilename, JSON.stringify(summary, null, 2));
  console.log(`📋 Summary: ${summaryFilename}`);

  return {
    schemaFile: filename,
    summaryFile: summaryFilename,
    totalFiles: existingSqlFiles.length
  };
}

compileSchemaFromMigrations();