import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { decidePlatformAccess, deniedResponse } from '../_shared/callerAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Debug tool that sends a real SMS and reads SMS subscriptions: the service role key only (the owner should delete it)
  const access = decidePlatformAccess(req.headers.get('Authorization'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!access.allowed) return deniedResponse(access, corsHeaders);

  const logs: string[] = [];
  
  try {
    logs.push('Starting test-sms-debug');
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const smsPortalClientId = Deno.env.get('SMS_PORTAL_CLIENT_ID');
    const smsPortalApiSecret = Deno.env.get('SMS_PORTAL_API_SECRET');
    
    logs.push(`SUPABASE_URL exists: ${!!supabaseUrl}`);
    logs.push(`SUPABASE_SERVICE_ROLE_KEY exists: ${!!supabaseServiceKey}`);
    logs.push(`SMS_PORTAL_CLIENT_ID exists: ${!!smsPortalClientId}`);
    logs.push(`SMS_PORTAL_API_SECRET exists: ${!!smsPortalApiSecret}`);
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    // Test database connection
    logs.push('Creating Supabase client');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test query
    logs.push('Testing database query');
    const { data: testData, error: testError } = await supabase
      .from('practice_sms_subscriptions')
      .select('id, practice_id, is_active, billing_cycle_end')
      .eq('practice_id', '5da3896d-b9f3-4b0a-996a-3adca867cb30')
      .limit(1);
    
    if (testError) {
      logs.push(`Database error: ${testError.message}`);
    } else {
      logs.push(`Database query successful, found ${testData?.length || 0} records`);
      if (testData && testData.length > 0) {
        logs.push(`First record: ${JSON.stringify(testData[0])}`);
      }
    }
    
    // Test SMS Portal API
    if (smsPortalClientId && smsPortalApiSecret) {
      logs.push('Testing SMS Portal API');
      
      const smsData = {
        ClientId: smsPortalClientId,
        ApiSecret: smsPortalApiSecret,
        SenderId: 'TEST',
        Content: 'Test message',
        Mobiles: '+264812222331'
      };
      
      logs.push(`SMS data: ${JSON.stringify({ ...smsData, ApiSecret: 'HIDDEN' })}`);
      
      try {
        const smsResponse = await fetch('https://api.smsportal.com/v3/api/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(smsData),
        });
        
        logs.push(`SMS Portal response status: ${smsResponse.status}`);
        const responseText = await smsResponse.text();
        logs.push(`SMS Portal response: ${responseText}`);
        
        try {
          const smsResult = JSON.parse(responseText);
          logs.push(`Parsed response: ${JSON.stringify(smsResult)}`);
        } catch (e) {
          logs.push(`Failed to parse response as JSON`);
        }
      } catch (smsError) {
        logs.push(`SMS Portal error: ${smsError.message}`);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        logs: logs
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    logs.push(`Error: ${error.message}`);
    logs.push(`Stack: ${error.stack}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        logs: logs
      }),
      { 
        status: 200, // Return 200 so we can see the logs
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});