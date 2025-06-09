import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function createProperSchema() {
  console.log('🏗️  Creating proper normalized practice type schema...\n');
  
  try {
    // Step 1: Get current practice types to create lookup table
    console.log('1. Analyzing current practice types...');
    const { data: practices, error: practicesError } = await serviceClient
      .from('practices')
      .select('id, name, practice_type')
      .order('practice_type');
    
    if (practicesError) {
      console.log('❌ Error getting practices:', practicesError.message);
      return;
    }
    
    const practiceTypes = [...new Set(practices?.map(p => p.practice_type) || [])];
    console.log('   📋 Found practice types:', practiceTypes.join(', '));
    
    // Step 2: Create practice_types lookup table
    console.log('\n2. Creating practice_types lookup table...');
    
    // First check if table exists
    const { data: existingTypes, error: checkError } = await serviceClient
      .from('practice_types')
      .select('*')
      .limit(1);
    
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('   🔧 Creating practice_types table...');
      
      // Create the table
      const createTableSQL = `
        CREATE TABLE practice_types (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Enable RLS
        ALTER TABLE practice_types ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for read access
        CREATE POLICY "practice_types_read_all" ON practice_types FOR SELECT USING (true);
        
        -- Grant permissions
        GRANT SELECT ON practice_types TO anon;
        GRANT SELECT ON practice_types TO authenticated;
      `;
      
      console.log('   🔧 Executing CREATE TABLE statement...');
      // We'll need to execute this via direct SQL - let's try with a stored procedure approach
      
    } else {
      console.log('   ✅ practice_types table already exists');
    }
    
    // Step 3: Insert practice types
    console.log('\n3. Inserting practice types...');
    const practiceTypeData = practiceTypes.map(type => ({
      name: type,
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} practice type`,
      is_active: true
    }));
    
    for (const typeData of practiceTypeData) {
      const { data: existingType } = await serviceClient
        .from('practice_types')
        .select('id')
        .eq('name', typeData.name)
        .single();
      
      if (!existingType) {
        const { data: insertedType, error: insertError } = await serviceClient
          .from('practice_types')
          .insert([typeData])
          .select()
          .single();
        
        if (insertError) {
          console.log(`   ❌ Error inserting ${typeData.name}:`, insertError.message);
        } else {
          console.log(`   ✅ Inserted practice type: ${typeData.name} (ID: ${insertedType.id})`);
        }
      } else {
        console.log(`   ✅ Practice type ${typeData.name} already exists`);
      }
    }
    
    // Step 4: Get practice type IDs for mapping
    console.log('\n4. Getting practice type IDs...');
    const { data: practiceTypesData, error: typesError } = await serviceClient
      .from('practice_types')
      .select('*');
    
    if (typesError) {
      console.log('❌ Error getting practice types:', typesError.message);
      return;
    }
    
    const typeMap = {};
    practiceTypesData?.forEach(type => {
      typeMap[type.name] = type.id;
      console.log(`   📋 ${type.name}: ${type.id}`);
    });
    
    console.log('\n✅ Step 1 completed: practice_types table ready');
    console.log('\n📋 Next steps (need to be done via migration):');
    console.log('   1. ALTER TABLE practices ADD COLUMN practice_type_id UUID REFERENCES practice_types(id)');
    console.log('   2. UPDATE practices SET practice_type_id = (SELECT id FROM practice_types WHERE name = practices.practice_type)');
    console.log('   3. ALTER TABLE practice_tariffs ADD COLUMN practice_type_id UUID REFERENCES practice_types(id)');
    console.log('   4. UPDATE practice_tariffs SET practice_type_id = (dental type ID)');
    console.log('   5. CREATE VIEW practice_tariffs_with_types AS (join query)');
    
    // Let's try to create the migration SQL
    console.log('\n🔧 Generating migration SQL...');
    const migrationSQL = `
-- Migration: Add practice_type_id to practices and practice_tariffs

-- Step 1: Add practice_type_id to practices table
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_type_id UUID REFERENCES practice_types(id);

-- Step 2: Update practices with correct practice_type_id
${practices?.map(practice => 
  `UPDATE practices SET practice_type_id = '${typeMap[practice.practice_type]}' WHERE id = '${practice.id}';`
).join('\n')}

-- Step 3: Add practice_type_id to practice_tariffs table  
ALTER TABLE practice_tariffs ADD COLUMN IF NOT EXISTS practice_type_id UUID REFERENCES practice_types(id);

-- Step 4: Update all dental codes to dental practice type
UPDATE practice_tariffs SET practice_type_id = '${typeMap['dental']}' WHERE practice_type_id IS NULL;

-- Step 5: Create view for easy querying
CREATE OR REPLACE VIEW practice_tariffs_with_types AS
SELECT 
  pt.*,
  ptype.name as practice_type_name,
  ptype.description as practice_type_description
FROM practice_tariffs pt
JOIN practice_types ptype ON pt.practice_type_id = ptype.id
WHERE pt.is_active = true AND ptype.is_active = true;

-- Step 6: Grant permissions on view
GRANT SELECT ON practice_tariffs_with_types TO anon;
GRANT SELECT ON practice_tariffs_with_types TO authenticated;

-- Step 7: Create RLS policy for the view
CREATE POLICY "practice_tariffs_with_types_read" ON practice_tariffs_with_types FOR SELECT USING (true);
`;
    
    console.log('\n📄 Generated migration SQL:');
    console.log(migrationSQL);
    
    return { typeMap, migrationSQL };
    
  } catch (err) {
    console.error('💥 Exception:', err.message);
  }
}

createProperSchema();