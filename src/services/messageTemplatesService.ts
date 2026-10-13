/**
 * The practice's saved SMS and email templates (message_templates; its policies belong to the practice-isolation
 * work and are not changed here). The patient file's Message and Email windows (UnifiedCommunicationModal) read the
 * same rows. The text is kept in body, text_content and content alike, so every reader sees the edited text; a
 * removed template is switched off (is_active false), never deleted.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  isMessageCategory,
  type MessageChannel,
  type MessageTemplate,
  type MessageTemplateDraft
} from '../utils/templates/messageTemplates';

// message_templates' newer columns (channel, category, body) are not all in the generated types
const db = supabase as unknown as SupabaseClient;

const COLUMNS = 'id, name, type, channel, category, subject, body, text_content, content, updated_at';

type Row = Record<string, unknown>;
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const channelOf = (row: Row): MessageChannel => {
  if (row.channel === 'sms' || row.channel === 'email' || row.channel === 'both') return row.channel;
  return row.type === 'email' ? 'email' : 'sms';
};

export function toMessageTemplate(row: Row): MessageTemplate {
  return {
    id: String(row.id),
    name: text(row.name),
    channel: channelOf(row),
    category: isMessageCategory(row.category) ? row.category : 'custom',
    subject: text(row.subject),
    // The same order the patient file's Message window reads them in
    body: text(row.body) || text(row.text_content) || text(row.content),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null
  };
}

/** The practice's templates in use, by name. */
export async function loadMessageTemplates(practiceId: string): Promise<MessageTemplate[]> {
  const { data, error } = await db
    .from('message_templates')
    .select(COLUMNS)
    .eq('practice_id', practiceId)
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(`Could not load the SMS and email templates: ${error.message}`);
  return ((data ?? []) as Row[]).map(toMessageTemplate);
}

const permissionMessage = 'Your role cannot change SMS and email templates. Ask a practice administrator.';

/** Adds a template (no id) or changes one. */
export async function saveMessageTemplate(practiceId: string, draft: MessageTemplateDraft, templateId: string | null): Promise<MessageTemplate> {
  const body = draft.body.trim();
  const values = {
    practice_id: practiceId,
    name: draft.name.trim(),
    // type allows email, sms and reminder: a template for both channels is filed as an SMS one
    type: draft.channel === 'email' ? 'email' : 'sms',
    channel: draft.channel,
    category: draft.category,
    subject: draft.channel === 'sms' ? null : draft.subject.trim(),
    body,
    text_content: body,
    content: body,
    html_content: null,
    is_active: true,
    updated_at: new Date().toISOString()
  };
  const request = templateId
    ? db.from('message_templates').update(values).eq('id', templateId).eq('practice_id', practiceId).select(COLUMNS)
    : db.from('message_templates').insert(values).select(COLUMNS);
  const { data, error } = await request;
  if (error) {
    if (error.code === '42501') throw new Error(permissionMessage);
    throw new Error(`Could not save the template: ${error.message}`);
  }
  const row = ((data ?? []) as Row[])[0];
  // RLS hides a row the user may not change: nothing comes back
  if (!row) throw new Error(permissionMessage);
  return toMessageTemplate(row);
}

/** Takes a template out of use (the Message and Email windows stop offering it). */
export async function removeMessageTemplate(practiceId: string, templateId: string): Promise<void> {
  const { data, error } = await db
    .from('message_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .eq('practice_id', practiceId)
    .select('id');
  if (error) {
    if (error.code === '42501') throw new Error(permissionMessage);
    throw new Error(`Could not remove the template: ${error.message}`);
  }
  if (((data ?? []) as Row[]).length === 0) throw new Error(permissionMessage);
}
