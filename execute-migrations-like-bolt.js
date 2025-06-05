#!/usr/bin/env node

import pg from 'pg';
import fs from 'fs';
import path from 'path';

// 🔑 CONFIGURATION - Direct connection string format like bolt.new uses
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

const DB_CONFIG = {
  connectionString,
  ssl: { rejectUnauthorized: false }
};

async function executeMigrationsLikeBolt() {
  console.log('🚀 Executing migrations like bolt.new does...\n');
  
  const client = new pg.Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL directly\n');
    
    // Read and execute NewCharm migration
    const newcharmMigration = fs.readFileSync('/home/happy/projects/hpms/supabase/migrations/20250605000002_newcharm_setup.sql', 'utf8');
    console.log('📋 Executing NewCharm practice setup...');
    await client.query(newcharmMigration);
    console.log('✅ NewCharm practice created!\n');
    
    // Read and execute storage migration
    const storageMigration = fs.readFileSync('/home/happy/projects/hpms/supabase/migrations/20250605000003_storage_bucket.sql', 'utf8');
    console.log('📁 Creating storage bucket...');
    await client.query(storageMigration);
    console.log('✅ Storage bucket created!\n');
    
    // Test the setup
    const { rows } = await client.query("SELECT slug, name, primary_color FROM practices WHERE slug = 'newcharm-dental'");
    if (rows.length > 0) {
      console.log('🦷 NewCharm Dental Practice is LIVE!');
      console.log(`   • Name: ${rows[0].name}`);
      console.log(`   • Slug: ${rows[0].slug}`);
      console.log(`   • Theme: ${rows[0].primary_color}`);
      console.log('\n🌐 Test at: http://localhost:3000?practice=newcharm-dental');
    } else {
      console.log('❌ NewCharm setup failed');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 To fix this:');
    console.log('   1. Get your database password from Supabase Dashboard → Settings → Database');
    console.log('   2. Update DB_CONFIG.password in this script');
    console.log('   3. Run again');
  } finally {
    await client.end();
  }
}

// Check if pg module is available
try {
  await executeMigrationsLikeBolt();
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('📦 Installing pg module...');
    console.log('Run: npm install pg');
    console.log('Then run this script again');
  } else {
    console.error('Error:', error.message);
  }
}