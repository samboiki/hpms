/**
 * Owner decision 13 Oct 2026: practices connect their own Facebook page and Instagram business account; until the
 * Meta app is registered and meta-oauth deployed, Settings > Social says "not set up yet" instead of failing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: fx.invoke } } }));

import { loadMetaSetup, metaReturnMessage, startMetaConnect } from '../metaConnectService';

beforeEach(() => fx.invoke.mockReset());

describe('loadMetaSetup', () => {
  it('a function that is not deployed yet means "not set up yet", never an error on screen', async () => {
    fx.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', context: { status: 404 } } });
    expect(await loadMetaSetup()).toBe('not_set_up');
  });

  it('deployed without the Meta app keys: not configured; with them: ready to connect', async () => {
    fx.invoke.mockResolvedValue({ data: { configured: false }, error: null });
    expect(await loadMetaSetup()).toBe('not_configured');
    fx.invoke.mockResolvedValue({ data: { configured: true }, error: null });
    expect(await loadMetaSetup()).toBe('ready');
  });
});

describe('startMetaConnect', () => {
  it('only ever sends the person to Facebook itself', async () => {
    fx.invoke.mockResolvedValue({ data: { configured: true, url: 'https://evil.example/login' }, error: null });
    expect((await startMetaConnect('p1')).ok).toBe(false);
    fx.invoke.mockResolvedValue({ data: { configured: true, url: 'https://www.facebook.com/v21.0/dialog/oauth?x=1' }, error: null });
    expect(await startMetaConnect('p1')).toEqual({ ok: true, url: 'https://www.facebook.com/v21.0/dialog/oauth?x=1' });
  });
});

describe('metaReturnMessage', () => {
  it('says plainly what happened when Facebook sends the person back', () => {
    expect(metaReturnMessage(new URLSearchParams('meta=connected&count=2'))?.text).toMatch(/Connected 2/);
    expect(metaReturnMessage(new URLSearchParams('meta=connected&count=0'))?.tone).toBe('error');
    expect(metaReturnMessage(new URLSearchParams('meta=cancelled'))?.text).toMatch(/cancelled/);
    expect(metaReturnMessage(new URLSearchParams('tab=social'))).toBeNull();
  });
});
