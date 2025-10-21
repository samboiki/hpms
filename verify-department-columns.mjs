import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
);

async function verifyColumns() {
  console.log('✅ VERIFICATION: Checking if columns were added successfully');
  console.log('================================================\n');

  try {
    // First, let's insert a test department to check columns
    const testDept = {
      name: 'Test Department',
      code: 'TEST-001',
      description: 'Testing description field',
      contact_email: 'test@example.com',
      contact_phone: '+1234567890',
      practice_id: 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3', // Your practice ID
      is_active: true,
      color: '#10B981'
    };

    console.log('🧪 Attempting to insert test department with new columns...');

    const { data: insertData, error: insertError } = await supabase
      .from('departments')
      .insert(testDept)
      .select()
      .single();

    if (insertError) {
      if (insertError.message.includes('contact_email') || insertError.message.includes('contact_phone')) {
        console.log('❌ Columns still missing:', insertError.message);
        console.log('\n⚠️  The columns need to be added manually in the Supabase Dashboard');
      } else {
        console.log('⚠️  Insert error (not column related):', insertError.message);
      }
    } else {
      console.log('✅ SUCCESS! Test department inserted with all columns:');
      console.log('  - name:', insertData.name);
      console.log('  - code:', insertData.code);
      console.log('  - description:', insertData.description);
      console.log('  - contact_email:', insertData.contact_email);
      console.log('  - contact_phone:', insertData.contact_phone);
      console.log('  - color:', insertData.color);

      // Clean up - delete test department
      const { error: deleteError } = await supabase
        .from('departments')
        .delete()
        .eq('id', insertData.id);

      if (!deleteError) {
        console.log('\n🧹 Test department cleaned up successfully');
      }

      console.log('\n🎉 ALL COLUMNS ARE WORKING CORRECTLY!');
      console.log('The departments table now has:');
      console.log('  ✅ contact_email column');
      console.log('  ✅ contact_phone column');
      console.log('  ✅ description column');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyColumns();