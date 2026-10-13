/**
 * A practice's letter templates (letter_templates, proposals/2026-10-12-letter-templates.sql): every staff member
 * reads them; the practice's administrators add, change and remove them through save_letter_template and
 * archive_letter_template, which check the role and answer in plain words. Before the proposal is applied the
 * templates are "not set up yet" and letters keep their built-in wording.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingFunctionError, isMissingTableError } from '../utils/diary/dbErrors';
import { isLetterTemplateKind, type LetterTemplate, type LetterTemplateDraft } from '../utils/templates/letterTemplates';

export const LETTER_TEMPLATES_TABLE = 'letter_templates';

// The generated database types do not include letter_templates or its functions yet
const db = supabase as unknown as SupabaseClient;

export class LetterTemplatesNotSetUpError extends Error {
  constructor() {
    super('Letter templates are not set up yet: OneHealth support applies the letter templates update.');
    this.name = 'LetterTemplatesNotSetUpError';
  }
}

export const isLetterTemplatesNotSetUp = (error: unknown): boolean =>
  error instanceof LetterTemplatesNotSetUpError ||
  isMissingTableError(error, LETTER_TEMPLATES_TABLE) ||
  isMissingFunctionError(error, 'save_letter_template') ||
  isMissingFunctionError(error, 'archive_letter_template');

const COLUMNS = 'id, kind, name, title, recipient, subject, greeting, body, updated_at';

type Row = Record<string, unknown>;
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function toLetterTemplate(row: Row): LetterTemplate {
  return {
    id: String(row.id),
    kind: isLetterTemplateKind(row.kind) ? row.kind : 'letter',
    name: text(row.name),
    title: text(row.title),
    recipient: text(row.recipient),
    subject: text(row.subject),
    greeting: text(row.greeting),
    body: text(row.body),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null
  };
}

/** The practice's templates in use, by kind and name. */
export async function loadLetterTemplates(practiceId: string): Promise<LetterTemplate[]> {
  const { data, error } = await db
    .from(LETTER_TEMPLATES_TABLE)
    .select(COLUMNS)
    .eq('practice_id', practiceId)
    .eq('is_active', true)
    .order('kind')
    .order('name');
  if (error) {
    if (isLetterTemplatesNotSetUp(error)) throw new LetterTemplatesNotSetUpError();
    throw new Error(`Could not load the letter templates: ${error.message}`);
  }
  return ((data ?? []) as Row[]).map(toLetterTemplate);
}

/**
 * The practice's sick note wording, if it keeps one. Null when it has none, and while templates are not set up: the
 * sick note then prints in its built-in wording, so a missing template never stops a sick note.
 */
export async function loadSickNoteTemplate(practiceId: string): Promise<LetterTemplate | null> {
  const { data, error } = await db
    .from(LETTER_TEMPLATES_TABLE)
    .select(COLUMNS)
    .eq('practice_id', practiceId)
    .eq('is_active', true)
    .eq('kind', 'sick_note')
    .limit(1);
  if (error) {
    if (isLetterTemplatesNotSetUp(error)) return null;
    throw new Error(`Could not load the practice's sick note wording: ${error.message}`);
  }
  const row = ((data ?? []) as Row[])[0];
  return row ? toLetterTemplate(row) : null;
}

interface DbError {
  code?: string;
  message?: string;
}

/** The save and remove functions answer in plain words; anything else becomes one plain sentence. */
function failed(error: DbError, action: string): never {
  if (isLetterTemplatesNotSetUp(error)) throw new LetterTemplatesNotSetUpError();
  if (error.code === '42501') throw new Error('Only a practice administrator can change letter templates.');
  if ((error.code === '22023' || error.code === '23505' || error.code === 'P0002') && error.message) throw new Error(error.message);
  throw new Error(`Could not ${action} the template. Please try again.`);
}

/** Adds a template (no id) or changes one; returns its id. */
export async function saveLetterTemplate(practiceId: string, draft: LetterTemplateDraft, templateId: string | null): Promise<string> {
  const { data, error } = await db.rpc('save_letter_template', {
    p_practice_id: practiceId,
    p_template_id: templateId,
    p_kind: draft.kind,
    p_name: draft.name,
    p_title: draft.title,
    p_recipient: draft.recipient,
    p_subject: draft.subject,
    p_greeting: draft.greeting,
    p_body: draft.body
  });
  if (error) failed(error, 'save');
  return String(data);
}

/** Removes a template from use; letters made from it keep their text and still name it. */
export async function archiveLetterTemplate(templateId: string): Promise<void> {
  const { error } = await db.rpc('archive_letter_template', { p_template_id: templateId });
  if (error) failed(error, 'remove');
}
