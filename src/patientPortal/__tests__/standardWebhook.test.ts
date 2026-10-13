// @vitest-environment node
// Web Crypto (crypto.subtle) as in Deno; jsdom does not provide it.
import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhook, webhookSecretKey, WEBHOOK_TOLERANCE_SECONDS } from '../../../supabase/functions/_shared/standardWebhook.ts';

// A secret as the Supabase dashboard shows it for an Auth hook
const keyBytes = randomBytes(32);
const SECRET = `v1,whsec_${keyBytes.toString('base64')}`;
const NOW = 1_791_000_000;
const BODY = JSON.stringify({ user: { id: 'u1', phone: '264811234567' }, sms: { otp: '482913' } });

// Signed independently of the code under test (Node's HMAC), the way Standard Webhooks specifies
const sign = (id: string, timestamp: number, body: string, key: Buffer = keyBytes) =>
  `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;

const headers = (overrides: Partial<{ id: string | null; timestamp: string | null; signature: string | null }> = {}) => ({
  id: 'msg_1',
  timestamp: String(NOW),
  signature: sign('msg_1', NOW, BODY),
  ...overrides,
});

describe('only Supabase Auth may ask the SMS hook to send a code', () => {
  it('accepts a call signed with the hook secret', async () => {
    await expect(verifyWebhook({ body: BODY, headers: headers(), secret: SECRET, nowSeconds: NOW })).resolves.toEqual({ ok: true });
  });

  it('refuses a changed body: nobody can swap in their own number or code', async () => {
    const changed = BODY.replace('264811234567', '264859999999');
    await expect(verifyWebhook({ body: changed, headers: headers(), secret: SECRET, nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('refuses a call signed with another secret', async () => {
    const other = randomBytes(32);
    const forged = headers({ signature: sign('msg_1', NOW, BODY, other) });
    await expect(verifyWebhook({ body: BODY, headers: forged, secret: SECRET, nowSeconds: NOW })).resolves.toMatchObject({ ok: false });
  });

  it('refuses a recorded call replayed later, and one dated in the future', async () => {
    const late = NOW + WEBHOOK_TOLERANCE_SECONDS + 1;
    await expect(verifyWebhook({ body: BODY, headers: headers(), secret: SECRET, nowSeconds: late })).resolves.toEqual({ ok: false, reason: 'expired' });
    const early = NOW - WEBHOOK_TOLERANCE_SECONDS - 1;
    await expect(verifyWebhook({ body: BODY, headers: headers(), secret: SECRET, nowSeconds: early })).resolves.toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses calls without the signature headers or with a bad timestamp', async () => {
    await expect(verifyWebhook({ body: BODY, headers: headers({ signature: null }), secret: SECRET, nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      reason: 'missing_headers',
    });
    await expect(verifyWebhook({ body: BODY, headers: headers({ timestamp: 'yesterday' }), secret: SECRET, nowSeconds: NOW })).resolves.toEqual({
      ok: false,
      reason: 'bad_timestamp',
    });
  });

  it('refuses everything while the secret is not set, instead of sending codes for anyone', async () => {
    await expect(verifyWebhook({ body: BODY, headers: headers(), secret: undefined, nowSeconds: NOW })).resolves.toEqual({ ok: false, reason: 'no_secret' });
    expect(webhookSecretKey('v1,whsec_c2hvcnQ=')).toBeNull(); // "short": too short to be a real secret
  });

  it('accepts any of several signatures (Supabase may send more than one while a secret is rotated)', async () => {
    const both = `${sign('msg_1', NOW, BODY, randomBytes(32))} ${sign('msg_1', NOW, BODY)}`;
    await expect(verifyWebhook({ body: BODY, headers: headers({ signature: both }), secret: SECRET, nowSeconds: NOW })).resolves.toEqual({ ok: true });
  });

  it('reads the secret with or without the "v1," and "whsec_" prefixes', () => {
    const plain = keyBytes.toString('base64');
    expect(webhookSecretKey(`whsec_${plain}`)).toEqual(new Uint8Array(keyBytes));
    expect(webhookSecretKey(plain)).toEqual(new Uint8Array(keyBytes));
  });
});
