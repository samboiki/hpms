/**
 * Staff chat (Messages > Messaging). Switching to another conversation kept the previous conversation's thread until
 * the new one loaded: a message typed meanwhile, or after the new one failed to open, went into the PREVIOUS
 * conversation (to the wrong people). And a conversation that could not be opened looked empty ("No messages yet").
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
  failThreadsFor: null as string | null
}));

vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'me', practice_id: 'practice-1', role: 'nurse', name: 'Test Nurse' } })
}));
vi.mock('../../../../services/unreadMessagesService', () => ({
  unreadMessagesService: { initialize: vi.fn(), setActiveChannel: vi.fn(), subscribe: () => () => undefined }
}));
vi.mock('../../NotificationPreferences', () => ({ NotificationPreferences: () => null }));
vi.mock('../../../../lib/supabase', () => {
  const channels = [
    { channel_id: 'chan-a', internal_message_channels: { id: 'chan-a', name: 'Front desk', channel_type: 'group', created_at: '2026-10-13T08:00:00Z', created_by: 'me' } },
    { channel_id: 'chan-b', internal_message_channels: { id: 'chan-b', name: 'Night shift', channel_type: 'group', created_at: '2026-10-12T08:00:00Z', created_by: 'me' } }
  ];
  const builder = (table: string): Record<string, unknown> => {
    const filters: Record<string, unknown> = {};
    let selected = '';
    let inserting: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    for (const name of ['order', 'limit', 'in', 'neq', 'not', 'or', 'single', 'gt', 'gte', 'lt']) chain[name] = () => chain;
    chain.select = (columns = '') => {
      selected = String(columns);
      return chain;
    };
    chain.eq = (column: string, value: unknown) => {
      filters[column] = value;
      return chain;
    };
    chain.insert = (values: Record<string, unknown>) => {
      inserting = values;
      mocks.inserts.push({ table, values });
      return chain;
    };
    chain.upsert = () => Promise.resolve({ data: null, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      let result: { data: unknown; error: unknown } = { data: [], error: null };
      if (inserting) result = { data: { id: 'new-message', created_at: '2026-10-13T09:00:00Z', ...inserting }, error: null };
      else if (table === 'internal_channel_members' && selected.includes('internal_message_channels')) result = { data: channels, error: null };
      else if (table === 'internal_channel_members') result = { data: [{ user_id: 'me' }, { user_id: 'colleague' }], error: null };
      else if (table === 'internal_message_threads') {
        result = filters.channel_id === mocks.failThreadsFor
          ? { data: null, error: { message: 'relation access refused' } }
          : { data: [{ id: `thread-${String(filters.channel_id).slice(-1)}` }], error: null };
      }
      return Promise.resolve(result).then(resolve, reject);
    };
    return chain;
  };
  const realtime = () => {
    const sub: Record<string, unknown> = {};
    sub.on = () => sub;
    sub.subscribe = () => sub;
    sub.unsubscribe = () => undefined;
    return sub;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: () => Promise.resolve({ data: [], error: null }),
      channel: realtime
    }
  };
});

import { EnhancedMessagingV2 } from '../EnhancedMessagingV2';

beforeEach(() => {
  mocks.inserts = [];
  mocks.failThreadsFor = null;
  // jsdom cannot scroll: the chat scrolls to its newest message
  Element.prototype.scrollIntoView = vi.fn();
});

const send = (text: string) => {
  const input = screen.getByLabelText('Message');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('switching conversations', () => {
  it('never sends into the previous conversation when the next one cannot be opened', async () => {
    mocks.failThreadsFor = 'chan-b';
    render(<EnhancedMessagingV2 practiceId="practice-1" />);
    fireEvent.click(await screen.findByText('Front desk'));
    await waitFor(() => expect(screen.getByLabelText('Message')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Night shift'));
    });
    expect(await screen.findByText('This conversation could not be opened. Please try again.')).toBeInTheDocument();

    send('For the night shift only');
    await act(async () => undefined);
    expect(mocks.inserts.filter(insert => insert.table === 'internal_messages')).toEqual([]);
  });

  it('sends into the conversation that is open', async () => {
    render(<EnhancedMessagingV2 practiceId="practice-1" />);
    fireEvent.click(await screen.findByText('Night shift'));
    await waitFor(() => expect(screen.getByLabelText('Message')).toBeInTheDocument());
    await act(async () => undefined);
    send('Hello night shift');
    await waitFor(() => expect(mocks.inserts.filter(insert => insert.table === 'internal_messages')).toHaveLength(1));
    expect(mocks.inserts[0].values).toMatchObject({ thread_id: 'thread-b', content: 'Hello night shift' });
  });
});
