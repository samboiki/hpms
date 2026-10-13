// Invites a staff member: creates their login and staff record, and emails them a link to choose their own password.
// Only a practice administrator (for their own practice), a super admin or the platform may call it. The email goes
// through centralized-email-gateway, so it is logged with the practice's other email. The link opens the app's
// /set-password page; add APP_URL/set-password to Supabase Auth > URL Configuration > Redirect URLs.
// Optional setting: APP_URL (default https://app.onehealthsystems.com).
// With "resend": true it sends a new link to someone already invited (the first email failed or the link expired).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { deniedResponse, loadCaller } from '../_shared/callerAccess.ts';
import { decideInviteAccess, exactLikePattern, inviteEmail, validateInvite } from '../_shared/staffInvite.ts';

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
  if (req.method !== 'POST') return json(405, { success: false, error: 'Use POST.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await req.json().catch(() => null);
    const caller = await loadCaller(admin, req.headers.get('Authorization'), serviceRoleKey);
    const access = decideInviteAccess(caller, (body as Record<string, unknown> | null)?.practiceId);
    if (!access.allowed) return deniedResponse(access, corsHeaders);
    const checked = validateInvite(body);
    if (!checked.ok) return json(400, { success: false, error: checked.error });
    const invite = checked.invite;
    const practiceId = access.practiceId ?? invite.practiceId;

    const { data: practice } = await admin.from('practices').select('name').eq('id', practiceId).maybeSingle();
    const redirectTo = `${(Deno.env.get('APP_URL') || 'https://app.onehealthsystems.com').replace(/\/+$/, '')}/set-password`;
    const { data: existing, error: lookupError } = await admin
      .from('users')
      .select('id, full_name, role, practice_id')
      .ilike('email', exactLikePattern(invite.email))
      .maybeSingle();
    if (lookupError) return json(500, { success: false, error: 'Existing staff could not be checked, so nothing was created. Please try again.' });

    let link: string;
    let fullName = invite.fullName;
    let role: string = invite.role;
    let userId: string;
    if (invite.resend) {
      // Only someone already on this practice's staff list gets a new link
      if (!existing || existing.practice_id !== practiceId) {
        return json(404, { success: false, error: 'No staff member with this email address is on your practice.' });
      }
      const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: invite.email, options: { redirectTo } });
      if (error || !data?.properties?.action_link) {
        return json(502, { success: false, error: `A new link could not be made: ${error?.message ?? 'no link returned'}.` });
      }
      link = data.properties.action_link;
      fullName = existing.full_name ?? '';
      role = existing.role ?? '';
      userId = existing.id;
    } else {
      if (existing) return json(409, { success: false, error: 'Someone with this email address already has a OneHealth login.' });
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'invite',
        email: invite.email,
        options: { redirectTo, data: { full_name: invite.fullName } }
      });
      if (error || !data?.user || !data.properties?.action_link) {
        const taken = /already|registered|exists/i.test(error?.message ?? '');
        return json(taken ? 409 : 502, {
          success: false,
          error: taken
            ? 'This email address already has a login (perhaps as a patient). Use another address.'
            : `The login could not be created: ${error?.message ?? 'no link returned'}.`
        });
      }
      link = data.properties.action_link;
      userId = data.user.id;

      // upsert: if the database already made a staff row for the new login, fill it in instead of failing
      const { error: staffError } = await admin.from('users').upsert(
        {
          id: userId,
          email: invite.email,
          full_name: invite.fullName,
          role: invite.role,
          practice_id: practiceId,
          is_active: true,
          job_title: invite.jobTitle,
          department: invite.department,
          contact_number: invite.contactNumber,
          address: invite.address,
          employee_number: invite.employeeNumber,
          hpcsa_number: invite.hpcsaNumber,
          start_date: invite.startDate
        },
        { onConflict: 'id' }
      );
      if (staffError) {
        // No half-made accounts: a login without a staff record could not use the app
        await admin.auth.admin.deleteUser(userId);
        return json(500, { success: false, error: `The staff record could not be saved, so nothing was created: ${staffError.message}.` });
      }
    }

    const message = inviteEmail({ practiceName: practice?.name ?? '', fullName, role, link, resend: invite.resend });
    const sent = await fetch(`${supabaseUrl}/functions/v1/centralized-email-gateway`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId,
        recipientEmail: invite.email,
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        emailType: 'custom'
      })
    });
    const result = (await sent.json().catch(() => null)) as { success?: boolean; error?: string } | null;
    if (!sent.ok || result?.success === false) {
      // The login exists; the link is never returned to the browser, so the administrator sends a new one
      return json(502, {
        success: false,
        userId,
        error: `The login was created, but the email could not be sent (${result?.error ?? `status ${sent.status}`}). Use "Send sign-in link" on their profile once email works.`
      });
    }
    return json(200, { success: true, userId, message: `Invitation sent to ${invite.email}.` });
  } catch (error) {
    console.error('invite-staff failed:', error instanceof Error ? error.message : error);
    return json(500, { success: false, error: 'The invitation could not be sent. Please try again.' });
  }
});
