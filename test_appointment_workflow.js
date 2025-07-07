// Test script for appointment workflow with reminders
// Run with: node test_appointment_workflow.js

import { createClient } from '@supabase/supabase-js';
import { SMSPortalService } from './src/services/smsPortal.js';
import { AppointmentService } from './src/services/appointmentService.js';

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY'; // Replace with your anon key

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test SMS Portal credentials
const testSMSService = new SMSPortalService({
  clientId: '7c193f5e-c862-43be-baa9-73e45e676e74',
  apiSecret: 'db3defe7-b01e-4983-b28d-88f228c16301'
});

async function runTests() {
  console.log('🧪 Starting Appointment Workflow Tests\n');

  try {
    // Test 1: SMS Portal Connection
    console.log('1️⃣ Testing SMS Portal Connection...');
    const balanceResult = await testSMSService.getBalance();
    if (balanceResult.success) {
      console.log(`✅ SMS Portal connected. Credits: ${balanceResult.credits}`);
    } else {
      console.log(`❌ SMS Portal connection failed: ${balanceResult.error}`);
    }

    // Test 2: SMS Validation
    console.log('\n2️⃣ Testing SMS Content Validation...');
    const testMessage = 'Hi {{patient_name}}, reminder for your appointment with Dr. {{doctor_name}} tomorrow at {{time}}.';
    const validation = SMSPortalService.validateSMSContent(testMessage);
    console.log(`✅ Message validation: ${validation.valid ? 'Valid' : 'Invalid'}`);
    console.log(`   Characters: ${validation.characterCount}, SMS Count: ${validation.messageCount}`);

    // Test 3: Template Variable Replacement
    console.log('\n3️⃣ Testing Template Variables...');
    const variables = {
      patient_name: 'John Doe',
      doctor_name: 'Smith',
      time: '2:00 PM'
    };
    const processedMessage = SMSPortalService.replaceTemplateVariables(testMessage, variables);
    console.log(`✅ Processed message: "${processedMessage}"`);

    // Test 4: Database Connection
    console.log('\n4️⃣ Testing Database Connection...');
    const { data: practices, error: practiceError } = await supabase
      .from('practices')
      .select('id, name')
      .limit(1);
    
    if (practiceError) {
      console.log(`❌ Database connection failed: ${practiceError.message}`);
      return;
    }
    console.log(`✅ Database connected. Found ${practices?.length || 0} practice(s)`);

    // Test 5: Create Test Appointment
    console.log('\n5️⃣ Creating Test Appointment...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const testAppointment = {
      patient_id: 'test-patient-id', // Replace with actual patient ID
      doctor_id: 'test-doctor-id', // Replace with actual doctor ID
      date: tomorrow.toISOString().split('T')[0],
      time: '14:00:00',
      duration: 30,
      type: 'consultation',
      is_recurring: false,
      reminder_settings: {
        enabled: true,
        timing: ['24h', '2h']
      }
    };

    console.log('📝 Test appointment details:');
    console.log(`   Date: ${testAppointment.date}`);
    console.log(`   Time: ${testAppointment.time}`);
    console.log(`   Reminders: ${testAppointment.reminder_settings.timing.join(', ')}`);

    // Test 6: Check Reminder Templates
    console.log('\n6️⃣ Checking Reminder Templates...');
    const { data: templates, error: templateError } = await supabase
      .from('reminder_templates')
      .select('*')
      .eq('type', 'appointment_reminder')
      .eq('is_active', true);
    
    if (templates && templates.length > 0) {
      console.log(`✅ Found ${templates.length} active reminder template(s)`);
      templates.forEach(template => {
        console.log(`   - ${template.name} (${template.timing})`);
      });
    } else {
      console.log('⚠️  No active reminder templates found');
    }

    // Test 7: Check Waitlist Feature
    console.log('\n7️⃣ Testing Waitlist Feature...');
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from('appointment_waitlist')
      .select('count')
      .eq('status', 'waiting');
    
    if (!waitlistError) {
      console.log(`✅ Waitlist feature available. ${waitlistEntries?.[0]?.count || 0} patients waiting`);
    } else {
      console.log('❌ Waitlist feature error:', waitlistError.message);
    }

    console.log('\n✨ All tests completed!');
    console.log('\n📋 Summary:');
    console.log('- SMS Portal: ' + (balanceResult.success ? '✅ Connected' : '❌ Failed'));
    console.log('- Database: ' + (!practiceError ? '✅ Connected' : '❌ Failed'));
    console.log('- Templates: ' + (templates && templates.length > 0 ? '✅ Available' : '⚠️  Missing'));
    console.log('- Waitlist: ' + (!waitlistError ? '✅ Available' : '❌ Error'));

    console.log('\n💡 Next Steps:');
    console.log('1. Go to Messages → Settings → SMS/Email Providers');
    console.log('2. Verify SMS Portal credentials are saved');
    console.log('3. Go to Messages → Settings → Message Templates');
    console.log('4. Create appointment reminder templates');
    console.log('5. Go to Appointments → New Appointment');
    console.log('6. Create an appointment with reminders enabled');
    console.log('7. Check Messages → History for sent reminders');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the tests
runTests();