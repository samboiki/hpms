// AI assist for staff: natural-language patient search and reading results from uploaded lab reports.
// The Gemini key (GEMINI_API_KEY) and the prompts stay on the server; the browser sends only the query or the
// document and must be signed in as an active staff member. Optional: GEMINI_MODEL (default gemini-2.0-flash).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { buildGeminiBody, parseLabResults, parseSearchPlan, validateAiAssistRequest } from '../_shared/aiAssist.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json(503, { error: 'AI reading is not set up yet: an administrator needs to add GEMINI_API_KEY to the edge function secrets.' });

    // Only active staff may use the AI (the platform has already checked that the token is valid)
    const authorization = req.headers.get('Authorization') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL') as string, Deno.env.get('SUPABASE_ANON_KEY') as string, {
      global: { headers: { Authorization: authorization } }
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json(401, { error: 'Sign in again to use AI reading.' });
    const { data: staff } = await supabase.from('users').select('is_active').eq('id', user.id).maybeSingle();
    if (!staff || staff.is_active === false) return json(403, { error: 'AI reading is available to active practice staff only.' });

    const checked = validateAiAssistRequest(await req.json().catch(() => null));
    if (!checked.ok) return json(400, { error: checked.error });
    const request = checked.request;

    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      // The key goes in a header, not the URL, so it never appears in request logs
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGeminiBody(request))
    });
    if (!response.ok) {
      console.error('Gemini error', response.status, (await response.text()).slice(0, 300));
      return json(502, { error: response.status === 429 ? 'The AI service is busy. Try again in a minute.' : 'The AI service could not read this request. Try again.' });
    }
    const geminiResponse = await response.json();

    return request.task === 'search-plan'
      ? json(200, { plan: parseSearchPlan(geminiResponse, request.query) })
      : json(200, { results: parseLabResults(geminiResponse) });
  } catch (error) {
    console.error('ai-assist failed', error);
    return json(500, { error: 'AI reading failed. Try again, or enter the results by hand.' });
  }
});
