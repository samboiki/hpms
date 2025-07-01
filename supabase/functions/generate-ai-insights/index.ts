import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
};

serve(async (req) => {
  console.log('🚀 Edge function called:', req.method);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📥 Processing request...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request
    const requestBody = await req.json();
    console.log('📨 Request body:', requestBody);
    
    const { practiceId, forceGenerate = false } = requestBody;

    if (!practiceId) {
      console.error('❌ No practice ID provided');
      throw new Error('Practice ID is required');
    }
    
    console.log('✅ Practice ID:', practiceId);
    console.log('Force generate:', forceGenerate);

    // Check if we should generate insights (weekly on Sunday or forced)
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    if (!forceGenerate && dayOfWeek !== 0) { // 0 = Sunday
      // Check if we already have insights for this week
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);

      const { data: existingInsights } = await supabaseClient
        .from('ai_insights')
        .select('*')
        .eq('practice_id', practiceId)
        .gte('generated_at', startOfWeek.toISOString())
        .single();

      if (existingInsights) {
        return new Response(
          JSON.stringify({ insights: existingInsights }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch comprehensive data for analysis
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // Analyze last 3 months
    
    console.log('📅 Date range:', {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    });

    console.log('🔍 Fetching visits data...');
    
    // First, let's check if the practice exists
    const { data: practiceCheck, error: practiceError } = await supabaseClient
      .from('practices')
      .select('id')
      .eq('id', practiceId)
      .single();
      
    if (practiceError || !practiceCheck) {
      console.error('❌ Practice not found:', practiceId);
      throw new Error(`Practice not found: ${practiceId}`);
    }
    
    // Fetch visits data with related information
    const { data: visits, error: visitsError } = await supabaseClient
      .from('visits')
      .select(`
        *,
        patient:patients!visits_patient_id_fkey(
          id,
          first_name,
          last_name,
          gender,
          date_of_birth
        ),
        vitals:vitals!vitals_visit_id_fkey(
          blood_pressure_systolic,
          blood_pressure_diastolic,
          heart_rate,
          temperature,
          weight,
          height,
          bmi
        ),
        medications:medications!medications_visit_id_fkey(
          drug_code,
          drug_name,
          dosage,
          frequency,
          duration
        ),
        lab_requests:lab_requests!lab_requests_visit_id_fkey(
          test_name,
          status,
          results,
          created_at
        ),
        invoices:invoices_enhanced!fk_invoices_enhanced_visit_id(
          total_amount,
          payment_status,
          medical_aid_claimed
        )
      `)
      .eq('practice_id', practiceId)
      .gte('visit_date', startDate.toISOString())
      .lte('visit_date', endDate.toISOString());

    console.log('📊 Visits query result:', {
      visitsCount: visits?.length || 0,
      error: visitsError
    });

    if (visitsError) {
      console.error('❌ Error fetching visits:', visitsError);
      throw visitsError;
    }

    console.log('🧮 Analyzing healthcare data...');
    // Analyze the data to generate insights
    const insights = await analyzeHealthcareData(visits || []);
    console.log('✅ Analysis complete');

    console.log('💾 Saving insights to database...');
    // Store the generated insights
    const { data: savedInsights, error: saveError } = await supabaseClient
      .from('ai_insights')
      .insert({
        practice_id: practiceId,
        insights: insights,
        generated_at: new Date().toISOString(),
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString()
      })
      .select()
      .single();

    console.log('💾 Save result:', {
      saved: !!savedInsights,
      error: saveError
    });

    if (saveError) {
      console.error('❌ Error saving insights:', saveError);
      throw saveError;
    }

    console.log('🎉 Successfully generated and saved insights');
    
    return new Response(
      JSON.stringify({ insights: savedInsights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating insights:', error);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        details: error.toString(),
        stack: error.stack
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

async function analyzeHealthcareData(visits: any[]): Promise<any> {
  const insights = {
    summary: {
      totalVisits: visits.length,
      completedVisits: visits.filter(v => v.status === 'completed').length,
      cancelledVisits: visits.filter(v => v.is_cancelled).length,
      noShowRate: 0,
      averageVisitsPerDay: 0
    },
    patientDemographics: {
      genderDistribution: {} as Record<string, number>,
      ageGroups: {} as Record<string, number>,
      medicalAidCoverage: 0
    },
    clinicalInsights: {
      topDiagnoses: [] as Array<{ diagnosis: string; count: number; percentage: number }>,
      commonMedications: [] as Array<{ medication: string; count: number }>,
      vitalTrends: {
        averageBP: { systolic: 0, diastolic: 0 },
        averageHeartRate: 0,
        averageBMI: 0,
        hypertensionPrevalence: 0
      },
      labTestPatterns: {
        mostRequestedTests: [] as Array<{ test: string; count: number }>,
        pendingTestsRate: 0,
        averageResultsTurnaround: 0
      }
    },
    operationalInsights: {
      peakVisitTimes: [] as Array<{ hour: string; avgVisits: number }>,
      averageWaitTime: 0,
      providerProductivity: {} as Record<string, number>,
      appointmentUtilization: 0
    },
    financialInsights: {
      totalRevenue: 0,
      averageRevenuePerVisit: 0,
      medicalAidClaimRate: 0,
      unpaidInvoicesValue: 0,
      paymentTrends: {
        onTimePayments: 0,
        latePayments: 0,
        pendingPayments: 0
      }
    },
    recommendations: [] as string[],
    alerts: [] as Array<{ type: 'warning' | 'info' | 'success'; message: string }>
  };

  // Calculate summary metrics
  const totalDays = 90; // 3 months
  insights.summary.averageVisitsPerDay = Math.round(visits.length / totalDays * 10) / 10;
  insights.summary.noShowRate = visits.length > 0 
    ? Math.round((visits.filter(v => v.no_show).length / visits.length) * 100) 
    : 0;

  // Analyze patient demographics
  const genderCounts: Record<string, number> = {};
  const ageGroups: Record<string, number> = {
    '0-17': 0,
    '18-30': 0,
    '31-50': 0,
    '51-70': 0,
    '71+': 0
  };

  visits.forEach(visit => {
    if (visit.patient) {
      // Gender distribution
      const gender = visit.patient.gender || 'unknown';
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;

      // Age groups
      if (visit.patient.date_of_birth) {
        const age = new Date().getFullYear() - new Date(visit.patient.date_of_birth).getFullYear();
        if (age < 18) ageGroups['0-17']++;
        else if (age <= 30) ageGroups['18-30']++;
        else if (age <= 50) ageGroups['31-50']++;
        else if (age <= 70) ageGroups['51-70']++;
        else ageGroups['71+']++;
      }

      // Medical aid coverage - check from invoices
      // We'll calculate this from invoice data instead
    }
  });

  insights.patientDemographics.genderDistribution = genderCounts;
  insights.patientDemographics.ageGroups = ageGroups;
  // Medical aid coverage will be calculated from invoices data later

  // Analyze clinical data
  const diagnosisCounts: Record<string, number> = {};
  const medicationCounts: Record<string, number> = {};
  const labTestCounts: Record<string, number> = {};
  let totalBPReadings = 0;
  let totalSystolic = 0;
  let totalDiastolic = 0;
  let totalHeartRate = 0;
  let heartRateCount = 0;
  let totalBMI = 0;
  let bmiCount = 0;
  let hypertensionCount = 0;

  visits.forEach(visit => {
    // Diagnoses - now from visits table directly
    if (visit.diagnosis) {
      diagnosisCounts[visit.diagnosis] = (diagnosisCounts[visit.diagnosis] || 0) + 1;
    }

    // Medications
    if (visit.medications && visit.medications.length > 0) {
      visit.medications.forEach((med: any) => {
        if (med.drug_name) {
          medicationCounts[med.drug_name] = (medicationCounts[med.drug_name] || 0) + 1;
        }
      });
    }

    // Lab tests
    if (visit.lab_requests && visit.lab_requests.length > 0) {
      visit.lab_requests.forEach((lab: any) => {
        if (lab.test_name) {
          labTestCounts[lab.test_name] = (labTestCounts[lab.test_name] || 0) + 1;
        }
      });
    }

    // Vitals analysis
    if (visit.vitals && visit.vitals.length > 0) {
      const vital = visit.vitals[0];
      if (vital.blood_pressure_systolic && vital.blood_pressure_diastolic) {
        totalSystolic += vital.blood_pressure_systolic;
        totalDiastolic += vital.blood_pressure_diastolic;
        totalBPReadings++;
        
        // Check for hypertension (>140/90)
        if (vital.blood_pressure_systolic >= 140 || vital.blood_pressure_diastolic >= 90) {
          hypertensionCount++;
        }
      }
      if (vital.heart_rate) {
        totalHeartRate += vital.heart_rate;
        heartRateCount++;
      }
      if (vital.bmi) {
        totalBMI += vital.bmi;
        bmiCount++;
      }
    }
  });

  // Process clinical insights
  insights.clinicalInsights.topDiagnoses = Object.entries(diagnosisCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([diagnosis, count]) => ({
      diagnosis,
      count,
      percentage: Math.round((count / visits.length) * 100)
    }));

  insights.clinicalInsights.commonMedications = Object.entries(medicationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([medication, count]) => ({ medication, count }));

  insights.clinicalInsights.labTestPatterns.mostRequestedTests = Object.entries(labTestCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([test, count]) => ({ test, count }));

  // Calculate vital trends
  if (totalBPReadings > 0) {
    insights.clinicalInsights.vitalTrends.averageBP.systolic = Math.round(totalSystolic / totalBPReadings);
    insights.clinicalInsights.vitalTrends.averageBP.diastolic = Math.round(totalDiastolic / totalBPReadings);
    insights.clinicalInsights.vitalTrends.hypertensionPrevalence = 
      Math.round((hypertensionCount / totalBPReadings) * 100);
  }
  if (heartRateCount > 0) {
    insights.clinicalInsights.vitalTrends.averageHeartRate = Math.round(totalHeartRate / heartRateCount);
  }
  if (bmiCount > 0) {
    insights.clinicalInsights.vitalTrends.averageBMI = Math.round(totalBMI / bmiCount * 10) / 10;
  }

  // Financial analysis
  let totalRevenue = 0;
  let unpaidInvoices = 0;
  let medicalAidClaims = 0;
  const paymentCounts = { paid: 0, pending: 0, overdue: 0 };

  visits.forEach(visit => {
    if (visit.invoices && visit.invoices.length > 0) {
      visit.invoices.forEach((invoice: any) => {
        if (invoice.total_amount) {
          totalRevenue += parseFloat(invoice.total_amount);
        }
        if (invoice.payment_status === 'pending' || invoice.payment_status === 'overdue') {
          unpaidInvoices += parseFloat(invoice.total_amount || 0);
        }
        if (invoice.medical_aid_claimed) {
          medicalAidClaims++;
        }
        
        // Payment status tracking
        if (invoice.payment_status in paymentCounts) {
          paymentCounts[invoice.payment_status as keyof typeof paymentCounts]++;
        }
      });
    }
  });

  insights.financialInsights.totalRevenue = Math.round(totalRevenue);
  insights.financialInsights.averageRevenuePerVisit = 
    visits.length > 0 ? Math.round(totalRevenue / visits.length) : 0;
  insights.financialInsights.unpaidInvoicesValue = Math.round(unpaidInvoices);
  insights.financialInsights.medicalAidClaimRate = 
    visits.length > 0 ? Math.round((medicalAidClaims / visits.length) * 100) : 0;
  
  // Set medical aid coverage based on claims
  insights.patientDemographics.medicalAidCoverage = insights.financialInsights.medicalAidClaimRate;
  
  const totalPayments = paymentCounts.paid + paymentCounts.pending + paymentCounts.overdue;
  if (totalPayments > 0) {
    insights.financialInsights.paymentTrends.onTimePayments = 
      Math.round((paymentCounts.paid / totalPayments) * 100);
    insights.financialInsights.paymentTrends.pendingPayments = 
      Math.round((paymentCounts.pending / totalPayments) * 100);
    insights.financialInsights.paymentTrends.latePayments = 
      Math.round((paymentCounts.overdue / totalPayments) * 100);
  }

  // Generate recommendations based on insights
  const recommendations = [];
  
  // Clinical recommendations
  if (insights.clinicalInsights.vitalTrends.hypertensionPrevalence > 30) {
    recommendations.push(
      "High hypertension prevalence detected (>" + insights.clinicalInsights.vitalTrends.hypertensionPrevalence + 
      "%). Consider implementing a hypertension management program."
    );
  }
  
  if (insights.clinicalInsights.vitalTrends.averageBMI > 25) {
    recommendations.push(
      "Average BMI indicates overweight population. Consider nutrition counseling services."
    );
  }

  // Operational recommendations
  if (insights.summary.noShowRate > 10) {
    recommendations.push(
      "No-show rate is " + Math.round(insights.summary.noShowRate) + 
      "%. Implement appointment reminder system to reduce no-shows."
    );
  }

  // Financial recommendations
  if (insights.financialInsights.paymentTrends.latePayments > 20) {
    recommendations.push(
      "High rate of late payments (" + insights.financialInsights.paymentTrends.latePayments + 
      "%). Consider implementing automated payment reminders."
    );
  }

  if (insights.financialInsights.medicalAidClaimRate < 50 && 
      insights.patientDemographics.medicalAidCoverage > 60) {
    recommendations.push(
      "Low medical aid claim rate despite high coverage. Review claim submission process."
    );
  }

  insights.recommendations = recommendations;

  // Generate alerts
  const alerts = [];

  if (insights.summary.noShowRate > 20) {
    alerts.push({
      type: 'warning' as const,
      message: `Critical: No-show rate exceeds 20% (${Math.round(insights.summary.noShowRate)}%)`
    });
  }

  if (insights.financialInsights.unpaidInvoicesValue > totalRevenue * 0.3) {
    alerts.push({
      type: 'warning' as const,
      message: `High unpaid invoices: N$${insights.financialInsights.unpaidInvoicesValue.toLocaleString()}`
    });
  }

  if (insights.summary.averageVisitsPerDay > 50) {
    alerts.push({
      type: 'info' as const,
      message: `High patient volume: ${insights.summary.averageVisitsPerDay} visits per day`
    });
  }

  insights.alerts = alerts;

  return insights;
}