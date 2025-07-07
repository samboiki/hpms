import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function executeSql(sql, description = '') {
  console.log(`🔗 ${description}`);
  
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: sql
    });
    
    if (error) {
      console.log('❌ SQL execution failed:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ SQL executed successfully!');
    return { success: true, result: data };
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    return { success: false, error: error.message };
  }
}

async function createMissingViews() {
  console.log('🚀 Creating missing database views for admin dashboard...\n');

  // Create practice_performance_dashboard view
  const practicePerformanceView = `
    CREATE OR REPLACE VIEW practice_performance_dashboard AS
    SELECT 
      p.id as practice_id,
      p.name as practice_name,
      p.slug,
      p.city,
      p.contact_email,
      p.contact_phone,
      p.status,
      p.subscription_tier,
      p.created_at as practice_created_at,
      
      -- Patient stats
      COALESCE(patient_stats.total_patients, 0) as total_patients,
      COALESCE(patient_stats.new_patients_30_days, 0) as new_patients_30_days,
      COALESCE(patient_stats.new_patients_7_days, 0) as new_patients_7_days,
      
      -- Appointment stats
      COALESCE(appt_stats.total_appointments, 0) as total_appointments,
      COALESCE(appt_stats.completed_appointments, 0) as completed_appointments,
      COALESCE(appt_stats.cancelled_appointments, 0) as cancelled_appointments,
      COALESCE(appt_stats.no_show_appointments, 0) as no_show_appointments,
      COALESCE(appt_stats.appointments_last_30_days, 0) as appointments_last_30_days,
      COALESCE(appt_stats.appointments_last_7_days, 0) as appointments_last_7_days,
      
      -- Calculate completion rate
      CASE 
        WHEN COALESCE(appt_stats.total_appointments, 0) > 0 
        THEN (COALESCE(appt_stats.completed_appointments, 0) * 100.0 / appt_stats.total_appointments)
        ELSE 0 
      END as completion_rate_percentage,
      
      -- SMS stats
      COALESCE(sms_stats.sms_monthly_limit, 0) as sms_monthly_limit,
      COALESCE(sms_stats.sms_current_usage, 0) as sms_current_usage,
      COALESCE(sms_stats.sms_sent_last_30_days, 0) as sms_sent_last_30_days,
      
      -- Calculate SMS usage percentage
      CASE 
        WHEN COALESCE(sms_stats.sms_monthly_limit, 0) > 0 
        THEN (COALESCE(sms_stats.sms_current_usage, 0) * 100.0 / sms_stats.sms_monthly_limit)
        ELSE 0 
      END as sms_usage_percentage,
      
      -- Revenue potential (mock calculation)
      CASE p.subscription_tier
        WHEN 'trial' THEN 0
        WHEN 'standard' THEN 99
        WHEN 'premium' THEN 199
        WHEN 'enterprise' THEN 499
        ELSE 0
      END as total_potential_revenue,
      
      -- Active services count
      1 as active_services
      
    FROM practices p
    
    -- Patient statistics subquery
    LEFT JOIN (
      SELECT 
        practice_id,
        COUNT(*) as total_patients,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_patients_30_days,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_patients_7_days
      FROM patients 
      GROUP BY practice_id
    ) patient_stats ON p.id = patient_stats.practice_id
    
    -- Appointment statistics subquery
    LEFT JOIN (
      SELECT 
        practice_id,
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_appointments,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as appointments_last_30_days,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as appointments_last_7_days
      FROM appointments 
      GROUP BY practice_id
    ) appt_stats ON p.id = appt_stats.practice_id
    
    -- SMS statistics subquery
    LEFT JOIN (
      SELECT 
        practice_id,
        monthly_limit as sms_monthly_limit,
        current_usage as sms_current_usage,
        current_usage as sms_sent_last_30_days
      FROM practice_sms_subscriptions
      WHERE is_active = true
    ) sms_stats ON p.id = sms_stats.practice_id
    
    WHERE p.status IS NOT NULL
    ORDER BY p.name;
  `;

  await executeSql(practicePerformanceView, 'Creating practice_performance_dashboard view');

  // Create sms_analytics view if it doesn't exist
  const smsAnalyticsView = `
    CREATE OR REPLACE VIEW sms_analytics AS
    SELECT 
      p.id as practice_id,
      p.name as practice_name,
      p.city,
      sms.monthly_limit,
      sms.current_usage,
      sms.billing_cycle_start,
      sms.billing_cycle_end,
      CASE 
        WHEN sms.monthly_limit > 0 
        THEN (sms.current_usage * 100.0 / sms.monthly_limit)
        ELSE 0 
      END as usage_percentage,
      sms.created_at,
      sms.updated_at
    FROM practices p
    LEFT JOIN practice_sms_subscriptions sms ON p.id = sms.practice_id AND sms.is_active = true
    WHERE p.status = 'active'
    ORDER BY usage_percentage DESC;
  `;

  await executeSql(smsAnalyticsView, 'Creating sms_analytics view');

  console.log('\n✅ Views created successfully!');
  
  // Test the views
  console.log('\n🧪 Testing the created views...');
  
  const { data: testData, error: testError } = await supabase
    .from('practice_performance_dashboard')
    .select('practice_name, total_patients, total_appointments, sms_usage_percentage')
    .limit(3);

  if (testError) {
    console.log('❌ View test failed:', testError);
  } else {
    console.log('✅ View test successful!');
    console.log('Sample data:', testData);
  }
}

createMissingViews().catch(console.error);