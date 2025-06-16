#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 Checking patient_documents table schema...');

// First check current schema
const checkSchemaQuery = `
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'patient_documents' 
ORDER BY ordinal_position;
`;

console.log('\n📝 Executing schema check...');
console.log('🗂️  SQL:', checkSchemaQuery);

try {
  const result = execSync(`node mcp-sql-standard.js`, {
    input: checkSchemaQuery,
    encoding: 'utf-8'
  });
  console.log('✅ Schema check result:', result);
} catch (error) {
  console.error('❌ Schema check failed:', error.message);
}

// Add missing is_processed column if needed
const addColumnQuery = `
ALTER TABLE patient_documents 
ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT FALSE;
`;

console.log('\n📝 Adding is_processed column if missing...');
console.log('🗂️  SQL:', addColumnQuery);

try {
  const result = execSync(`node mcp-sql-standard.js`, {
    input: addColumnQuery,
    encoding: 'utf-8'
  });
  console.log('✅ Column addition result:', result);
} catch (error) {
  console.error('❌ Column addition failed:', error.message);
}

console.log('\n🎉 Patient documents schema fix completed!');