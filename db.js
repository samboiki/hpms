#!/usr/bin/env node
// Database utility for quick queries
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

const command = process.argv[2];
const args = process.argv.slice(3);

async function query(table, ...conditions) {
  let query = supabase.from(table).select('*');
  
  // Parse conditions like "email=ilike.maria"
  conditions.forEach(cond => {
    const [field, operatorAndValue] = cond.split('=');
    if (!operatorAndValue) return;
    
    const [operator, ...valueParts] = operatorAndValue.split('.');
    const value = valueParts.join('.');
    
    if (operator === 'eq') query = query.eq(field, value);
    else if (operator === 'ilike') query = query.ilike(field, `%${value}%`);
    else if (operator === 'gt') query = query.gt(field, value);
    else if (operator === 'lt') query = query.lt(field, value);
  });
  
  const { data, error } = await query;
  if (error) throw error;
  
  console.log(JSON.stringify(data, null, 2));
}

async function count(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  
  if (error) throw error;
  console.log(`${table}: ${count} records`);
}

async function insert(table, jsonData) {
  const data = JSON.parse(jsonData);
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select();
    
  if (error) throw error;
  console.log('Inserted:', JSON.stringify(result, null, 2));
}

async function update(table, id, jsonData) {
  const data = JSON.parse(jsonData);
  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .select();
    
  if (error) throw error;
  console.log('Updated:', JSON.stringify(result, null, 2));
}

async function del(table, id) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);
    
  if (error) throw error;
  console.log(`Deleted ${id} from ${table}`);
}

async function sql(query) {
  // For complex SQL queries, we'd need an RPC function
  console.log('SQL execution would require an RPC function.');
  console.log('Query:', query);
}

async function related(table, id, relation) {
  // Query related data
  const relationMap = {
    'patients': {
      'visits': 'patient_id',
      'appointments': 'patient_id',
      'medical_aid': 'patient_id',
      'next_of_kin': 'patient_id',
      'lab_results': 'patient_id'
    },
    'visits': {
      'vitals': 'visit_id',
      'lab_results': 'visit_id',
      'patient': 'id'
    }
  };
  
  if (!relationMap[table] || !relationMap[table][relation]) {
    console.error(`Unknown relation: ${table} → ${relation}`);
    return;
  }
  
  if (relation === 'patient') {
    // Special case: get parent patient from visit
    const { data: visit } = await supabase.from('visits').select('patient_id').eq('id', id).single();
    if (visit) {
      const { data } = await supabase.from('patients').select('*').eq('id', visit.patient_id);
      console.log(JSON.stringify(data, null, 2));
    }
  } else {
    const foreignKey = relationMap[table][relation];
    const targetTable = relation === 'medical_aid' ? 'medical_aid_details' : relation;
    
    const { data, error } = await supabase
      .from(targetTable)
      .select('*')
      .eq(foreignKey, id);
      
    if (error) throw error;
    console.log(JSON.stringify(data, null, 2));
  }
}

async function schema(table) {
  // Show table schema
  if (!table) {
    // List all tables
    const tables = [
      'patients', 'visits', 'appointments', 'vitals',
      'lab_results', 'medical_aid_details', 'next_of_kin',
      'users', 'lab_requests', 'media_files'
    ];
    console.log('Available tables:');
    for (const t of tables) {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      console.log(`  - ${t} (${count || 0} records)`);
    }
  } else {
    // Show specific table info
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    
    console.log(`\nTable: ${table}`);
    console.log('Columns:');
    
    if (data && data.length > 0) {
      Object.keys(data[0]).forEach(col => {
        const value = data[0][col];
        const type = value === null ? 'unknown' : typeof value;
        console.log(`  - ${col} (${type})`);
      });
    } else {
      console.log('  (no data to infer schema)');
    }
    
    // Show relationships
    console.log('\nRelationships:');
    const relations = {
      'patients': '→ visits, appointments, medical_aid_details, next_of_kin',
      'visits': '← patients, → vitals, lab_results',
      'appointments': '← patients, users',
      'vitals': '← visits',
      'lab_results': '← visits',
      'medical_aid_details': '← patients',
      'next_of_kin': '← patients',
      'users': '→ visits, appointments'
    };
    
    console.log(relations[table] || '  (none detected)');
  }
}

// Help text
function help() {
  console.log(`
Database CLI Tool

Usage:
  ./db.js query <table> [conditions]      Query records
  ./db.js count <table>                   Count records
  ./db.js insert <table> '<json>'         Insert record
  ./db.js update <table> <id> '<json>'    Update record
  ./db.js delete <table> <id>             Delete record
  ./db.js related <table> <id> <relation> Get related records
  ./db.js schema [table]                  Show schema info
  ./db.js sql '<query>'                   Run SQL (needs RPC)
  
Examples:
  ./db.js query patients
  ./db.js query patients email=ilike.maria
  ./db.js query visits patient_id=eq.327925ed-6d7d-4464-8581-5a6fae75931e
  ./db.js count patients
  ./db.js related patients 327925ed-6d7d-4464-8581-5a6fae75931e visits
  ./db.js schema
  ./db.js schema patients
  ./db.js insert patients '{"first_name":"John","last_name":"Doe"}'
  
Operators:
  eq    - equals
  ilike - case-insensitive like (use % for wildcard)
  gt    - greater than  
  lt    - less than
  
Relations:
  patients → visits, appointments, medical_aid, next_of_kin
  visits → vitals, lab_results, patient
`);
}

// Main
try {
  switch(command) {
    case 'query':
      await query(...args);
      break;
    case 'count':
      await count(args[0]);
      break;
    case 'insert':
      await insert(args[0], args[1]);
      break;
    case 'update':
      await update(args[0], args[1], args[2]);
      break;
    case 'delete':
      await del(args[0], args[1]);
      break;
    case 'related':
      await related(args[0], args[1], args[2]);
      break;
    case 'schema':
      await schema(args[0]);
      break;
    case 'sql':
      await sql(args[0]);
      break;
    default:
      help();
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}